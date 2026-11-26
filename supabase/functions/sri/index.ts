// Función Edge `sri` (Supabase) · facturación electrónica del SRI, esquema offline.
//
// Flujo: al hacer check-out un trigger crea la factura "pendiente" (secuencial y clave de acceso).
// Esta función la procesa: arma el XML con los datos de la reserva y del huésped, lo firma
// (XAdES-BES con la firma .p12 del establecimiento), lo envía a recepción, consulta la
// autorización, genera el RIDE y lo envía por correo. pg_cron la llama cada minuto para la cola.
//
// Acciones:
//   pendientes        (pg_cron, cabecera x-roomia-cron)            procesa la cola con reintentos
//   emitir            { reservationId, comprador?, formaPago? }    crea (si no existe) y procesa
//   reintentar        { comprobanteId, comprador?, formaPago? }    corrige y reenvía uno rechazado
//   anular            { comprobanteId }                            descarta uno que no llegó al SRI
//   reenviar_correo   { comprobanteId, correo? }
//   guardar_emisor    { hotelId, emisor }                          datos tributarios
//   subir_firma       { hotelId, p12Base64, password }             valida y guarda la firma en Vault
//   probar            { hotelId }                                  datos, firma y servicios del SRI
//
// Se despliega con verify_jwt = false: las acciones de usuario validan aquí su token y el permiso
// sobre el establecimiento; la cola valida el token de pg_cron guardado en Vault.
import { createClient } from "jsr:@supabase/supabase-js@2";
import forge from "node-forge";
import type { Ambiente } from "../_shared/sri/claveAcceso.ts";
import { isValidRuc, type TipoIdentificacion, TIPOS_IDENTIFICACION } from "../_shared/sri/identificacion.ts";
import { buildFacturaXml, type Emisor, fechaEcuador, FORMAS_PAGO, lineasDesdeImportes, type Regimen, TARIFAS_IVA, validarFactura } from "../_shared/sri/factura.ts";
import { firmarComprobante } from "../_shared/sri/firma.ts";
import { cargarFirmanteP12, certificadoDelRuc, type FirmanteP12 } from "../_shared/sri/p12.ts";
import { consultarAutorizacion, endpoints, enviarComprobante, xmlAutorizado } from "../_shared/sri/soap.ts";
import { compradorDeHuesped, type CompradorFactura, type ItemFactura, itemsDeReserva } from "../_shared/sri/reserva.ts";
import { generarRide } from "../_shared/sri/ride.ts";
import { emailSubject, renderBrandEmail, renderBrandText, type BrandEmail } from "../_shared/brandEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SEND_EMAIL_URL = Deno.env.get("ROOMIA_SEND_EMAIL_URL") ?? "https://www.roomiapms.site/api/send-email";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey, x-roomia-cron",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Minutos de espera antes de cada reintento, según el número de intentos */
const ESPERAS = [1, 2, 5, 10, 15, 30, 60, 120, 240, 480];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;
const ahoraMas = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------------------------------------------------------------- sesión y permisos

type Usuario = { id: string; rol: string; hotelid: string | null };

async function usuarioActual(req: Request): Promise<Usuario> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) throw new HttpError(401, "Inicia sesión para usar la facturación electrónica.");
  const { data: u } = await admin.from("users").select("id, rol, hotelid").eq("id", auth.user.id).maybeSingle();
  if (!u) throw new HttpError(403, "Tu usuario no tiene permisos de facturación.");
  return u as Usuario;
}

/** admin: administrador del establecimiento o superadmin · staff: también recepción */
function permiso(u: Usuario, hotelId: string, nivel: "admin" | "staff") {
  if (u.rol === "super_admin") return;
  const roles = nivel === "admin" ? ["hotel_admin"] : ["hotel_admin", "recepcionista"];
  if (roles.includes(u.rol) && u.hotelid === hotelId) return;
  throw new HttpError(403, nivel === "admin"
    ? "Solo el administrador del establecimiento puede configurar la facturación."
    : "No tienes permisos para facturar en este establecimiento.");
}

// ---------------------------------------------------------------- emisor y firma

type EmisorRow = {
  hotel_id: string;
  activo: boolean;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  dir_matriz: string;
  dir_establecimiento: string | null;
  estab: string;
  pto_emi: string;
  obligado_contabilidad: boolean;
  contribuyente_especial: string | null;
  agente_retencion: string | null;
  regimen: Regimen;
  ambiente: Ambiente;
  codigo_iva: string;
  forma_pago: string;
  correo_copia: string | null;
  cert_titular: string | null;
  cert_valido_hasta: string | null;
  cert_subido_at: string | null;
};

async function emisorDe(hotelId: string): Promise<EmisorRow> {
  const { data } = await admin.from("sri_emisores").select("*").eq("hotel_id", hotelId).maybeSingle();
  if (!data) throw new HttpError(409, "Este establecimiento aún no tiene configurada la facturación electrónica.");
  return data as EmisorRow;
}

const aEmisor = (e: EmisorRow, c?: { ambiente: Ambiente; estab: string; pto_emi: string }): Emisor => ({
  ambiente: c?.ambiente ?? e.ambiente,
  razonSocial: e.razon_social,
  nombreComercial: e.nombre_comercial ?? undefined,
  ruc: e.ruc,
  estab: c?.estab ?? e.estab,
  ptoEmi: c?.pto_emi ?? e.pto_emi,
  dirMatriz: e.dir_matriz,
  dirEstablecimiento: e.dir_establecimiento ?? undefined,
  obligadoContabilidad: e.obligado_contabilidad,
  contribuyenteEspecial: e.contribuyente_especial ?? undefined,
  agenteRetencion: e.agente_retencion ?? undefined,
  regimen: e.regimen,
});

// La llave incluye la fecha de subida: si se cargó una firma nueva no se usa la anterior
const cacheFirmas = new Map<string, FirmanteP12>();
async function firmanteDe(e: EmisorRow): Promise<FirmanteP12> {
  const llave = `${e.hotel_id}:${e.cert_subido_at ?? ""}`;
  const enCache = cacheFirmas.get(llave);
  if (enCache) return enCache;
  const { data, error } = await admin.rpc("sri_leer_firma", { p_hotel_id: e.hotel_id });
  if (error) throw new Error(`sri_leer_firma: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.p12_base64) throw new HttpError(409, "Sube la firma electrónica (.p12) del establecimiento.");
  const firmante = cargarFirmanteP12(forge, row.p12_base64, row.password ?? "");
  if (new Date(firmante.info.validoHasta).getTime() < Date.now()) {
    throw new HttpError(409, "La firma electrónica está caducada. Sube la firma vigente en Facturación SRI.");
  }
  cacheFirmas.set(llave, firmante);
  return firmante;
}

// ---------------------------------------------------------------- datos del comprobante

type Comprobante = {
  id: string;
  hotel_id: string;
  reservation_id: string | null;
  ambiente: Ambiente;
  ruc: string;
  estab: string;
  pto_emi: string;
  secuencial: number;
  clave_acceso: string;
  fecha_emision: string;
  estado: string;
  recibido: boolean;
  comprador: CompradorFactura | null;
  items: ItemFactura[] | null;
  forma_pago: string | null;
  total: number | null;
  xml_firmado: string | null;
  xml_autorizado: string | null;
  numero_autorizacion: string | null;
  fecha_autorizacion: string | null;
  intentos: number;
};

async function cargarReserva(id: string) {
  const { data: r } = await admin.from("reservations")
    .select("id, hotelid, roomid, guestid, total, subtotal, impuestos, noches, serviciosadicionales, estado")
    .eq("id", id).maybeSingle();
  if (!r) throw new HttpError(404, "No encontramos la reserva.");
  const [{ data: hotel }, { data: room }, { data: guest }] = await Promise.all([
    admin.from("hotels").select("nombre, tipoestablecimiento, contacto").eq("id", r.hotelid).maybeSingle(),
    r.roomid ? admin.from("rooms").select("nombre, numero").eq("id", r.roomid).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("users").select("nombre, apellido, documento, email, telefono").eq("id", r.guestid).maybeSingle(),
  ]);
  const contacto = (hotel?.contacto ?? {}) as Record<string, unknown>;
  const esAlquiler = ["casa", "departamento"].includes(String(hotel?.tipoestablecimiento ?? "")) && contacto.finalidad === "alquiler";
  const { data: detalles } = esAlquiler
    ? await admin.from("property_details").select("price").eq("hotel_id", r.hotelid).maybeSingle()
    : { data: null };
  const { items, total } = itemsDeReserva({
    id: r.id,
    total: Number(r.total),
    subtotal: Number(r.subtotal),
    impuestos: Number(r.impuestos),
    noches: Number(r.noches),
    servicios: (r.serviciosadicionales ?? []) as string[],
    esAlquiler,
    precioPropiedad: Number((detalles as { price?: number } | null)?.price) || 0,
    habitacion: room ? [room.nombre, room.numero ? `Hab. ${room.numero}` : ""].filter(Boolean).join(" · ") : undefined,
  });
  return { reserva: r, hotelNombre: String(hotel?.nombre ?? ""), items, total, comprador: compradorDeHuesped(guest, total) };
}

/** Arma y firma el XML del comprobante con su clave de acceso ya asignada */
async function firmar(c: Comprobante, e: EmisorRow) {
  let comprador = c.comprador;
  let items = c.items;
  if (!comprador || !items?.length) {
    if (!c.reservation_id) throw new HttpError(409, "El comprobante no tiene datos para facturar.");
    const datos = await cargarReserva(c.reservation_id);
    comprador = comprador ?? datos.comprador;
    items = items?.length ? items : datos.items;
  }
  const [y, m, d] = c.fecha_emision.split("-");
  const input = {
    emisor: aEmisor(e, c),
    comprador,
    fechaEmision: `${d}/${m}/${y}`,
    secuencial: Number(c.secuencial),
    codigoNumerico: c.clave_acceso.slice(39, 47),
    lineas: lineasDesdeImportes(items, e.codigo_iva),
    formaPago: c.forma_pago ?? e.forma_pago,
    infoAdicional: c.reservation_id ? [["Reserva", c.reservation_id]] as Array<[string, string]> : [],
  };
  const errores = validarFactura(input);
  if (errores.length) return { errores, comprador, items };
  const factura = buildFacturaXml(input);
  if (factura.claveAcceso !== c.clave_acceso) throw new Error("La clave de acceso no coincide al armar el comprobante.");
  const xml = firmarComprobante(factura.xml, await firmanteDe(e));
  return { errores: [], comprador, items, xml, factura };
}

// ---------------------------------------------------------------- correo

async function enviarCorreo(c: Comprobante, e: EmisorRow, destino?: string | null): Promise<"enviado" | "sin_correo" | "sin_configurar" | "error"> {
  const para = [destino || c.comprador?.email].filter((x): x is string => !!x && EMAIL_RE.test(x));
  const copia = e.correo_copia && EMAIL_RE.test(e.correo_copia) ? e.correo_copia : null;
  if (!para.length && !copia) return "sin_correo";
  const xml = c.xml_autorizado || c.xml_firmado;
  if (!xml) return "error";
  const { data: token } = await admin.rpc("sri_token", { p_nombre: "sri_correo_token" });
  if (!token) return "sin_configurar";

  const numero = `${c.estab}-${c.pto_emi}-${String(c.secuencial).padStart(9, "0")}`;
  const nombre = e.nombre_comercial || e.razon_social;
  const ride = await generarRide({ xml, autorizado: c.estado === "autorizado", numeroAutorizacion: c.numero_autorizacion, fechaAutorizacion: c.fecha_autorizacion });
  const b64 = (bytes: Uint8Array) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const email: BrandEmail = {
    preheader: `Factura ${numero} por $${Number(c.total ?? 0).toFixed(2)}`,
    eyebrow: "FACTURA ELECTRÓNICA",
    title: `Factura ${numero}`,
    greeting: c.comprador?.tipoIdentificacion !== "07" && c.comprador?.razonSocial ? `Hola, ${c.comprador.razonSocial}:` : "Hola:",
    paragraphs: [
      `**${nombre}** (RUC ${e.ruc}) te envía tu factura electrónica autorizada por el SRI. Adjuntamos el archivo XML (documento con validez tributaria) y su representación impresa (RIDE) en PDF.`,
      "Puedes verificarla en sri.gob.ec → SRI en línea → Facturación electrónica → Validez de comprobantes, con la clave de acceso.",
    ],
    status: { label: "Clave de acceso", value: "Autorizada por el SRI", tone: "success", reference: c.clave_acceso },
    amounts: { rows: [], total: ["Total", `$${Number(c.total ?? 0).toFixed(2)} USD`] },
    note: c.ambiente === "1" ? { text: "Emitida en el ambiente de pruebas del SRI: no tiene validez tributaria.", tone: "warning" } : undefined,
  };
  const archivo = `Factura ${numero}`;
  const enviar = (to: string) =>
    fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-roomia-token": String(token) },
      body: JSON.stringify({
        to,
        subject: emailSubject("Factura electrónica", numero, nombre),
        html: renderBrandEmail(email),
        text: renderBrandText(email),
        attachments: [
          { filename: `${archivo}.xml`, content: b64(new TextEncoder().encode(xml)) },
          { filename: `${archivo}.pdf`, content: b64(ride) },
        ],
      }),
    }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, body: {} }));

  const resultados = await Promise.all([...new Set([...para, ...(copia ? [copia] : [])])].map(enviar));
  if (resultados.some((r) => (r.body as { simulated?: boolean }).simulated)) return "sin_configurar";
  if (!para.length) return resultados.every((r) => r.ok) ? "sin_correo" : "error";
  return resultados[0]?.ok ? "enviado" : "error";
}

// ---------------------------------------------------------------- proceso de un comprobante

async function actualizar(id: string, cambios: Record<string, unknown>) {
  const { data } = await admin.from("sri_comprobantes")
    .update({ ...cambios, bloqueado_hasta: null, updated_at: new Date().toISOString() })
    .eq("id", id).select("*").single();
  return data as Comprobante;
}

async function procesar(id: string): Promise<Comprobante | null> {
  const { data: tomado } = await admin.rpc("sri_tomar", { p_id: id });
  const c = tomado as Comprobante | null;
  if (!c?.id) {
    const { data } = await admin.from("sri_comprobantes").select("*").eq("id", id).maybeSingle();
    return data as Comprobante | null;
  }

  let recibido = c.recibido;
  try {
    const e = await emisorDe(c.hotel_id);
    let xml = c.xml_firmado;

    // 1. Firma y recepción (si el SRI ya lo recibió, no se vuelve a enviar)
    if (!recibido) {
      const firmado = await firmar(c, e);
      if (firmado.errores.length) {
        return await actualizar(c.id, {
          estado: "devuelta",
          comprador: firmado.comprador,
          items: firmado.items,
          mensajes: firmado.errores.map((m) => ({ identificador: "DATOS", mensaje: m, tipo: "ERROR" })),
        });
      }
      xml = firmado.xml!;
      await actualizar(c.id, {
        estado: "procesando",
        comprador: firmado.comprador,
        items: firmado.items,
        xml_firmado: xml,
        subtotal: firmado.factura!.totalSinImpuestos,
        iva: firmado.factura!.totalIva,
        total: firmado.factura!.importeTotal,
      });
      const r = await enviarComprobante(xml, c.ambiente);
      // 43 clave registrada · 45 secuencial registrado · 70 en procesamiento: ya está en el SRI
      const yaRecibido = r.mensajes.length > 0 && r.mensajes.every((m) => ["43", "45", "70"].includes(m.identificador));
      if (r.estado !== "RECIBIDA" && !yaRecibido) {
        return await actualizar(c.id, { estado: "devuelta", mensajes: r.mensajes });
      }
      recibido = true;
      await actualizar(c.id, { estado: "procesando", recibido: true, mensajes: r.mensajes });
    }

    // 2. Autorización (el SRI suele tardar unos segundos)
    let a = await consultarAutorizacion(c.clave_acceso, c.ambiente);
    for (let i = 0; i < 3 && (a.estado === "EN PROCESO" || a.estado === "NO ENCONTRADO"); i++) {
      await dormir(1500 * (i + 1));
      a = await consultarAutorizacion(c.clave_acceso, c.ambiente);
    }
    if (a.estado === "NO AUTORIZADO" || a.estado === "RECHAZADO") {
      return await actualizar(c.id, { estado: "no_autorizado", mensajes: a.mensajes });
    }
    if (a.estado !== "AUTORIZADO") {
      return await actualizar(c.id, {
        estado: "recibida",
        mensajes: [{ identificador: "SRI", mensaje: "Recibida por el SRI; autorización en proceso.", tipo: "INFORMATIVO" }],
        proximo_intento: ahoraMas(1),
      });
    }

    // 3. Autorizada: XML de autorización, RIDE y correo
    const fecha = a.fechaAutorizacion && !Number.isNaN(Date.parse(a.fechaAutorizacion)) ? new Date(a.fechaAutorizacion) : new Date();
    const autorizado = await actualizar(c.id, {
      estado: "autorizado",
      numero_autorizacion: a.numeroAutorizacion ?? c.clave_acceso,
      fecha_autorizacion: fecha.toISOString(),
      xml_autorizado: xmlAutorizado({ ...a, comprobante: a.comprobante || xml || "" }),
      mensajes: a.mensajes,
    });
    try {
      const correo = await enviarCorreo(autorizado, e);
      return await actualizar(c.id, { correo_estado: correo, correo_enviado_at: correo === "enviado" ? new Date().toISOString() : null });
    } catch (err) {
      console.error("sri correo:", (err as Error)?.message);
      return await actualizar(c.id, { correo_estado: "error" });
    }
  } catch (err) {
    const mensaje = (err as Error)?.message || String(err);
    return await actualizar(c.id, {
      estado: recibido ? "recibida" : "error",
      recibido,
      mensajes: [{ identificador: err instanceof HttpError ? "ROOMIA" : "RED", mensaje, tipo: "ERROR" }],
      proximo_intento: ahoraMas(ESPERAS[Math.min(Math.max(c.intentos, 1) - 1, ESPERAS.length - 1)]),
    });
  }
}

async function procesarPendientes() {
  const inicio = Date.now();
  const { data } = await admin.rpc("sri_pendientes", { p_limite: 15 });
  const ids = ((data as Array<string | { sri_pendientes: string }> | null) ?? []).map((x) => (typeof x === "string" ? x : x.sri_pendientes));
  const resultados: Record<string, string> = {};
  for (const id of ids) {
    if (Date.now() - inicio > 40_000) break; // margen dentro del tiempo máximo de la función
    resultados[id] = (await procesar(id))?.estado ?? "desconocido";
  }
  return resultados;
}

// ---------------------------------------------------------------- acciones de usuario

function parseComprador(raw: unknown): CompradorFactura | null {
  if (!raw) return null;
  const c = raw as Record<string, unknown>;
  const tipo = String(c.tipoIdentificacion ?? "") as TipoIdentificacion;
  if (!TIPOS_IDENTIFICACION.some((t) => t.value === tipo)) throw new HttpError(400, "Elige el tipo de identificación del cliente.");
  const email = str(c.email, 254);
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, "El correo del cliente no es válido.");
  return {
    tipoIdentificacion: tipo,
    identificacion: tipo === "07" ? "9999999999999" : str(c.identificacion, 20).toUpperCase(),
    razonSocial: tipo === "07" ? "CONSUMIDOR FINAL" : str(c.razonSocial),
    direccion: str(c.direccion) || undefined,
    email: email || undefined,
    telefono: str(c.telefono, 30) || undefined,
  };
}

function parseFormaPago(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const v = String(raw);
  if (!FORMAS_PAGO.some((f) => f.value === v)) throw new HttpError(400, "Elige la forma de pago.");
  return v;
}

async function comprobante(u: Usuario, id: unknown): Promise<Comprobante> {
  const cid = str(id, 40);
  if (!UUID_RE.test(cid)) throw new HttpError(400, "Comprobante no válido.");
  const { data } = await admin.from("sri_comprobantes").select("*").eq("id", cid).maybeSingle();
  if (!data) throw new HttpError(404, "No encontramos el comprobante.");
  permiso(u, data.hotel_id, "staff");
  return data as Comprobante;
}

async function emitir(u: Usuario, body: Record<string, unknown>) {
  const reservationId = str(body.reservationId, 100);
  if (!reservationId) throw new HttpError(400, "Falta la reserva.");
  const { data: r } = await admin.from("reservations").select("id, hotelid, estado").eq("id", reservationId).maybeSingle();
  if (!r) throw new HttpError(404, "No encontramos la reserva.");
  permiso(u, r.hotelid, "staff");

  const e = await emisorDe(r.hotelid);
  const { data: existente } = await admin.from("sri_comprobantes").select("*")
    .eq("reservation_id", reservationId).eq("ambiente", e.ambiente).neq("estado", "anulado").maybeSingle();
  if (existente) {
    // Ya existe (p. ej. la creó el check-out): se procesa si está en cola
    if (["pendiente", "error", "recibida"].includes(existente.estado)) return json(200, { comprobante: await procesar(existente.id) });
    return json(200, { comprobante: existente });
  }
  if (body.soloPendiente) return json(200, { comprobante: null });

  const comprador = parseComprador(body.comprador);
  const formaPago = parseFormaPago(body.formaPago);
  const { data: creado, error } = await admin.rpc("sri_crear_comprobante", {
    p_reservation: reservationId,
    p_origen: "manual",
    p_comprador: comprador,
    p_items: null,
    p_forma_pago: formaPago,
    p_usuario: u.id,
  });
  if (error) throw new HttpError(409, error.message);
  return json(200, { comprobante: await procesar((creado as Comprobante).id) });
}

async function reintentar(u: Usuario, body: Record<string, unknown>) {
  const c = await comprobante(u, body.comprobanteId);
  if (!["devuelta", "no_autorizado", "error", "pendiente", "recibida"].includes(c.estado)) {
    throw new HttpError(409, "Este comprobante no se puede reenviar.");
  }
  // Una factura NO AUTORIZADA se corrige y se vuelve a firmar y enviar con la misma clave de
  // acceso y secuencial. Una "recibida" solo se vuelve a consultar.
  const reenviar = !c.recibido || c.estado === "no_autorizado";
  const cambios: Record<string, unknown> = {
    estado: reenviar ? "pendiente" : "recibida",
    recibido: !reenviar,
    proximo_intento: new Date().toISOString(),
    bloqueado_hasta: null,
  };
  if (reenviar) {
    const comprador = parseComprador(body.comprador);
    const formaPago = parseFormaPago(body.formaPago);
    if (comprador) cambios.comprador = comprador;
    if (formaPago) cambios.forma_pago = formaPago;
  }
  await admin.from("sri_comprobantes").update(cambios).eq("id", c.id);
  return json(200, { comprobante: await procesar(c.id) });
}

async function anular(u: Usuario, body: Record<string, unknown>) {
  const c = await comprobante(u, body.comprobanteId);
  if ((c.recibido && c.estado !== "no_autorizado") || !["pendiente", "error", "devuelta", "no_autorizado"].includes(c.estado)) {
    throw new HttpError(409, "Solo se descarta un comprobante que el SRI no recibió o no autorizó. Una factura autorizada se anula en SRI en línea.");
  }
  const { data } = await admin.from("sri_comprobantes").update({ estado: "anulado", updated_at: new Date().toISOString() }).eq("id", c.id).select("*").single();
  return json(200, { comprobante: data });
}

async function reenviarCorreo(u: Usuario, body: Record<string, unknown>) {
  const c = await comprobante(u, body.comprobanteId);
  if (c.estado !== "autorizado") throw new HttpError(409, "Solo se envían facturas autorizadas.");
  const destino = str(body.correo, 254) || null;
  if (destino && !EMAIL_RE.test(destino)) throw new HttpError(400, "El correo no es válido.");
  const estado = await enviarCorreo(c, await emisorDe(c.hotel_id), destino);
  const { data } = await admin.from("sri_comprobantes")
    .update({ correo_estado: estado, correo_enviado_at: estado === "enviado" ? new Date().toISOString() : null })
    .eq("id", c.id).select("*").single();
  if (estado === "sin_configurar") throw new HttpError(409, "El envío de correos no está disponible por ahora.");
  if (estado === "sin_correo") throw new HttpError(400, "El cliente no tiene correo: escribe uno.");
  if (estado === "error") throw new HttpError(502, "No se pudo enviar el correo. Intenta de nuevo.");
  return json(200, { comprobante: data });
}

async function guardarEmisor(u: Usuario, body: Record<string, unknown>) {
  const hotelId = str(body.hotelId, 100);
  if (!hotelId) throw new HttpError(400, "Falta el establecimiento.");
  permiso(u, hotelId, "admin");
  const e = (body.emisor ?? {}) as Record<string, unknown>;

  const errores: string[] = [];
  const ruc = str(e.ruc, 13);
  if (!isValidRuc(ruc)) errores.push("El RUC no es válido.");
  const razonSocial = str(e.razonSocial);
  if (!razonSocial) errores.push("Escribe la razón social tal como consta en el RUC.");
  const dirMatriz = str(e.dirMatriz);
  if (!dirMatriz) errores.push("Escribe la dirección de la matriz.");
  const estab = str(e.estab, 3).padStart(3, "0");
  const ptoEmi = str(e.ptoEmi, 3).padStart(3, "0");
  if (!/^\d{3}$/.test(estab) || estab === "000") errores.push("El establecimiento debe tener 3 dígitos (ej. 001).");
  if (!/^\d{3}$/.test(ptoEmi) || ptoEmi === "000") errores.push("El punto de emisión debe tener 3 dígitos (ej. 001).");
  const codigoIva = String(e.codigoIva ?? "4");
  if (TARIFAS_IVA[codigoIva] === undefined) errores.push("La tarifa de IVA no es válida.");
  const formaPago = String(e.formaPago ?? "19");
  if (!FORMAS_PAGO.some((f) => f.value === formaPago)) errores.push("La forma de pago no es válida.");
  const especial = str(e.contribuyenteEspecial, 13);
  if (especial && !/^[0-9A-Za-z]{3,13}$/.test(especial)) errores.push("El número de contribuyente especial no es válido.");
  const agente = str(e.agenteRetencion, 8).replace(/^0+/, "");
  if (agente && !/^[1-9]\d{0,7}$/.test(agente)) errores.push("El número de resolución de agente de retención no es válido.");
  const copia = str(e.correoCopia, 254);
  if (copia && !EMAIL_RE.test(copia)) errores.push("El correo de copia no es válido.");
  if (errores.length) throw new HttpError(400, errores.join(" "));

  const { data: actual } = await admin.from("sri_emisores").select("cert_titular, cert_valido_hasta, secuencial_produccion").eq("hotel_id", hotelId).maybeSingle();
  const activo = e.activo === true;
  if (activo && (!actual?.cert_titular || !actual.cert_valido_hasta || new Date(actual.cert_valido_hasta) <= new Date())) {
    throw new HttpError(409, "Sube una firma electrónica vigente antes de activar la emisión.");
  }

  const row: Record<string, unknown> = {
    hotel_id: hotelId,
    activo,
    ruc,
    razon_social: razonSocial,
    nombre_comercial: str(e.nombreComercial) || null,
    dir_matriz: dirMatriz,
    dir_establecimiento: str(e.dirEstablecimiento) || null,
    estab,
    pto_emi: ptoEmi,
    obligado_contabilidad: e.obligadoContabilidad === true,
    contribuyente_especial: especial || null,
    agente_retencion: agente || null,
    regimen: ["general", "rimpe_emprendedor", "rimpe_negocio_popular"].includes(String(e.regimen)) ? e.regimen : "general",
    ambiente: e.ambiente === "2" ? "2" : "1",
    codigo_iva: codigoIva,
    forma_pago: formaPago,
    correo_copia: copia || null,
  };

  // Siguiente secuencial de producción (si ya facturaba con esta serie en otro sistema)
  const inicial = Number(e.secuencialProduccion);
  if (Number.isInteger(inicial) && inicial >= 1 && inicial <= 999999999 && inicial !== Number(actual?.secuencial_produccion ?? 1)) {
    const { count } = await admin.from("sri_comprobantes").select("id", { count: "exact", head: true }).eq("hotel_id", hotelId).eq("ambiente", "2");
    if (count) throw new HttpError(409, "El secuencial de producción ya no se puede cambiar: hay facturas emitidas en producción.");
    row.secuencial_produccion = inicial;
  }

  const { data, error } = await admin.from("sri_emisores").upsert(row).select("*").single();
  if (error) throw new Error(`sri_emisores: ${error.message}`);
  return json(200, { emisor: data });
}

async function subirFirma(u: Usuario, body: Record<string, unknown>) {
  const hotelId = str(body.hotelId, 100);
  permiso(u, hotelId, "admin");
  const e = await emisorDe(hotelId);
  const p12Base64 = typeof body.p12Base64 === "string" ? body.p12Base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "") : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!p12Base64 || !password) throw new HttpError(400, "Selecciona el archivo .p12 y escribe su contraseña.");
  if (p12Base64.length > 270_000) throw new HttpError(400, "El archivo es demasiado grande para ser una firma .p12.");

  let firmante: FirmanteP12;
  try {
    firmante = cargarFirmanteP12(forge, p12Base64, password);
  } catch (err) {
    throw new HttpError(400, (err as Error).message);
  }
  const { info } = firmante;
  if (new Date(info.validoHasta).getTime() < Date.now()) throw new HttpError(400, `La firma caducó el ${info.validoHasta.slice(0, 10)}.`);
  const rucOk = certificadoDelRuc(firmante, e.ruc);
  if (!rucOk && firmante.identificaciones.length) {
    throw new HttpError(400, `La firma pertenece a otra identificación (${firmante.identificaciones.join(", ")}), no al RUC ${e.ruc}.`);
  }

  const { error } = await admin.rpc("sri_guardar_firma", { p_hotel_id: hotelId, p_p12_base64: p12Base64, p_password: password });
  if (error) throw new Error(`sri_guardar_firma: ${error.message}`);
  const { data } = await admin.from("sri_emisores").update({
    cert_titular: info.titular || info.sujeto,
    cert_emisor: info.emisor,
    cert_valido_hasta: info.validoHasta,
    cert_subido_at: new Date().toISOString(),
    cert_ruc_ok: rucOk,
  }).eq("hotel_id", hotelId).select("*").single();
  return json(200, { emisor: data });
}

async function probar(u: Usuario, body: Record<string, unknown>) {
  const hotelId = str(body.hotelId, 100);
  permiso(u, hotelId, "admin");
  const e = await emisorDe(hotelId);
  const checks: Array<{ paso: string; ok: boolean; detalle: string }> = [
    { paso: "Datos del emisor", ok: true, detalle: `${e.razon_social} · RUC ${e.ruc} · serie ${e.estab}-${e.pto_emi}` },
  ];
  try {
    const firmante = await firmanteDe(e);
    const prueba = buildFacturaXml({
      emisor: aEmisor(e),
      comprador: { tipoIdentificacion: "07", identificacion: "9999999999999", razonSocial: "CONSUMIDOR FINAL" },
      fechaEmision: fechaEcuador(),
      secuencial: 1,
      lineas: lineasDesdeImportes([{ codigo: "PRUEBA", descripcion: "Prueba de firma", cantidad: 1, importe: 1 }], e.codigo_iva),
      formaPago: "01",
    });
    firmarComprobante(prueba.xml, firmante);
    const dias = Math.floor((new Date(firmante.info.validoHasta).getTime() - Date.now()) / 86_400_000);
    checks.push({ paso: "Firma electrónica", ok: true, detalle: `${firmante.info.titular} · vigente ${dias} días más` });
  } catch (err) {
    checks.push({ paso: "Firma electrónica", ok: false, detalle: (err as Error).message });
  }
  const urls = endpoints(e.ambiente);
  for (const [paso, url] of [["Recepción del SRI", urls.recepcion], ["Autorización del SRI", urls.autorizacion]]) {
    const inicio = Date.now();
    try {
      const r = await fetch(`${url}?wsdl`, { signal: AbortSignal.timeout(15_000) });
      const ok = r.ok && (await r.text()).includes("definitions");
      checks.push({ paso, ok, detalle: ok ? `Responde en ${Date.now() - inicio} ms (${e.ambiente === "1" ? "pruebas" : "producción"})` : `Respondió ${r.status}` });
    } catch {
      checks.push({ paso, ok: false, detalle: "Sin respuesta. El SRI puede estar caído; las facturas se reintentarán solas." });
    }
  }
  return json(200, { ok: checks.every((c) => c.ok), checks });
}

// ---------------------------------------------------------------- servidor

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Solicitud no válida" });
  }

  // Tarea programada (pg_cron)
  const tokenCron = req.headers.get("x-roomia-cron");
  if (tokenCron) {
    const { data: esperado } = await admin.rpc("sri_token", { p_nombre: "sri_cron_token" });
    if (!esperado || tokenCron !== esperado) return json(401, { error: "No autorizado" });
    return json(200, { ok: true, procesados: await procesarPendientes() });
  }

  try {
    const u = await usuarioActual(req);
    switch (body.action) {
      case "emitir": return await emitir(u, body);
      case "reintentar": return await reintentar(u, body);
      case "anular": return await anular(u, body);
      case "reenviar_correo": return await reenviarCorreo(u, body);
      case "guardar_emisor": return await guardarEmisor(u, body);
      case "subir_firma": return await subirFirma(u, body);
      case "probar": return await probar(u, body);
      default: return json(400, { error: "Acción no válida" });
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error("sri:", (err as Error)?.message || err);
    return json(500, { error: "No se pudo completar la operación de facturación. Intenta de nuevo." });
  }
});

