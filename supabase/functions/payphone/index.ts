// Función Edge `payphone` (Supabase) · cobro de reservas con la Cajita de Pagos de Payphone.
//
//   POST {action: "prepare", reservationId, kind}   Con sesión del huésped. Calcula el monto en el
//        servidor a partir de la reserva guardada y crea el pago (status "creado"). Devuelve {paymentId}.
//   POST {action: "box", paymentId}                 Sin sesión (el APK abre la página de pago en el
//        navegador del teléfono). Devuelve los datos para dibujar la Cajita. El id del pago es un
//        UUID aleatorio; el token de la Cajita es público por diseño de Payphone (va en la página).
//   POST {action: "confirm", id, clientTransactionId} Sin sesión. Confirma con Payphone (antes de
//        5 min o Payphone revierte el cobro), valida monto e identificador y aplica el pago a la
//        reserva en una sola operación (función SQL aplicar_pago_reserva). Idempotente.
//
// Secretos: PAYPHONE_TOKEN, PAYPHONE_STORE_ID. Se despliega con verify_jwt = false.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  PAYMENT_KINDS,
  type PaymentKind,
  checkConfirmation,
  makeClientTransactionId,
  minimumReservationTotal,
  paymentAmounts,
  readPaymentInfo,
  sumsUp,
  toCents,
} from "./paymentRules.ts";
import { BRAND, type BrandEmail, renderBrandEmail, renderBrandText } from "../_shared/brandEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAYPHONE_TOKEN = Deno.env.get("PAYPHONE_TOKEN") ?? "";
const PAYPHONE_STORE_ID = Deno.env.get("PAYPHONE_STORE_ID") ?? "";
const CONFIRM_URL = "https://paymentbox.payphonetodoesposible.com/api/confirm";
const SEND_EMAIL_URL = Deno.env.get("ROOMIA_SEND_EMAIL_URL") ?? "https://www.roomiapms.site/api/send-email";
const BOX_VALID_MS = 10 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

const KIND_LABEL: Record<string, string> = {
  reserva_abono: "Abono del 20% de la reserva",
  reserva_total: "Pago total de la reserva",
  reserva_saldo: "Saldo pendiente de la reserva",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Reservation = {
  id: string;
  hotelid: string;
  roomid: string;
  guestid: string;
  estado: string;
  total: number;
  impuestos: number;
  noches: number;
  notes: string | null;
  fechaentrada: string;
  fechasalida: string;
};

async function loadReservation(id: string): Promise<Reservation | null> {
  const { data } = await admin
    .from("reservations")
    .select("id, hotelid, roomid, guestid, estado, total, impuestos, noches, notes, fechaentrada, fechasalida")
    .eq("id", id)
    .maybeSingle();
  return data ? { ...data, total: Number(data.total), impuestos: Number(data.impuestos), noches: Number(data.noches) } : null;
}

const forPayment = (r: Reservation) => ({
  estado: r.estado,
  total: r.total,
  impuestos: r.impuestos,
  montoPagado: readPaymentInfo(r.notes).montoPagado ?? 0,
});

// ---------------------------------------------------------------- prepare
async function prepare(req: Request, body: Record<string, unknown>): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json(401, { error: "Inicia sesión para pagar tu reserva." });

  const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
  const kind = body.kind as PaymentKind;
  if (!reservationId || !PAYMENT_KINDS.includes(kind)) return json(400, { error: "Datos del pago incompletos." });

  const r = await loadReservation(reservationId);
  if (!r) return json(404, { error: "No encontramos la reserva." });
  if (r.guestid !== auth.user.id) return json(403, { error: "Solo el huésped de la reserva puede pagarla en línea." });

  const amounts = paymentAmounts(forPayment(r), kind);
  if ("error" in amounts) return json(409, { error: amounts.error });
  if (!sumsUp(amounts)) return json(500, { error: "No se pudo calcular el monto del pago." });

  // El total lo calculó el navegador al reservar: se comprueba contra la tarifa de la habitación
  const [{ data: room }, { data: variations }, { data: hotel }] = await Promise.all([
    admin.from("rooms").select("precio").eq("id", r.roomid).maybeSingle(),
    admin.from("room_price_variations").select("precio").eq("room_id", r.roomid),
    admin.from("hotels").select("tipoestablecimiento, contacto").eq("id", r.hotelid).maybeSingle(),
  ]);
  if (!room) return json(409, { error: "La habitación de esta reserva ya no existe." });
  const isRental = ["casa", "departamento"].includes(String(hotel?.tipoestablecimiento ?? "")) &&
    (hotel?.contacto as Record<string, unknown> | null)?.finalidad === "alquiler";
  const minimum = minimumReservationTotal({
    roomPrice: Number(room.precio),
    variationPrices: (variations ?? []).map((v: { precio: number }) => Number(v.precio)),
    noches: r.noches,
    isRental,
  });
  if (toCents(r.total) < toCents(minimum)) {
    return json(409, { error: "El total de la reserva no coincide con la tarifa de la habitación. Comunícate con el establecimiento." });
  }

  const clientTransactionId = makeClientTransactionId(r.id, crypto.randomUUID());
  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      kind,
      reservation_id: r.id,
      hotel_id: r.hotelid,
      payer_id: auth.user.id,
      amount_cents: amounts.amount,
      amount_with_tax: amounts.amountWithTax,
      amount_without_tax: amounts.amountWithoutTax,
      tax_cents: amounts.tax,
      client_transaction_id: clientTransactionId,
    })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("payphone prepare:", error?.message);
    return json(500, { error: "No se pudo iniciar el pago. Inténtalo de nuevo." });
  }
  return json(200, { paymentId: payment.id, amount: amounts.amount });
}

// ---------------------------------------------------------------- box
async function box(body: Record<string, unknown>): Promise<Response> {
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  if (!UUID_RE.test(paymentId)) return json(400, { error: "Enlace de pago no válido." });

  const { data: p } = await admin
    .from("payments")
    .select("id, kind, reservation_id, hotel_id, amount_cents, amount_with_tax, amount_without_tax, tax_cents, currency, client_transaction_id, status, created_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (!p) return json(404, { error: "No encontramos este pago." });

  const [{ data: hotel }, r] = await Promise.all([
    admin.from("hotels").select("nombre").eq("id", p.hotel_id).maybeSingle(),
    p.reservation_id ? loadReservation(p.reservation_id) : Promise.resolve(null),
  ]);
  const { data: room } = r ? await admin.from("rooms").select("nombre").eq("id", r.roomid).maybeSingle() : { data: null };
  const summary = {
    kind: p.kind,
    kindLabel: KIND_LABEL[p.kind] ?? "Pago",
    amount: p.amount_cents,
    reservationId: p.reservation_id,
    hotel: hotel?.nombre ?? "",
    room: room?.nombre ?? "",
    fechaEntrada: r?.fechaentrada ?? "",
    fechaSalida: r?.fechasalida ?? "",
  };

  const expiresAt = new Date(p.created_at).getTime() + BOX_VALID_MS;
  if (p.status !== "creado") return json(200, { status: p.status, summary });
  if (Date.now() > expiresAt) return json(200, { status: "expirado", summary });
  if (!PAYPHONE_TOKEN || !PAYPHONE_STORE_ID) {
    return json(503, { error: "Los pagos en línea todavía no están activos. Paga en el establecimiento o por transferencia.", summary });
  }

  return json(200, {
    status: "creado",
    summary,
    expiresAt: new Date(expiresAt).toISOString(),
    box: {
      token: PAYPHONE_TOKEN,
      storeId: PAYPHONE_STORE_ID,
      clientTransactionId: p.client_transaction_id,
      amount: p.amount_cents,
      amountWithoutTax: p.amount_without_tax,
      amountWithTax: p.amount_with_tax,
      tax: p.tax_cents,
      service: 0,
      tip: 0,
      currency: p.currency,
      reference: `Reserva ${p.reservation_id ?? ""} · ${hotel?.nombre ?? "Roomia"}`.slice(0, 100),
    },
  });
}

// ---------------------------------------------------------------- confirm
async function sendPaymentEmails(paymentId: string) {
  try {
    const { data: p } = await admin
      .from("payments")
      .select("kind, amount_cents, reservation_id, hotel_id, payer_id, card_brand, last_digits")
      .eq("id", paymentId)
      .maybeSingle();
    if (!p) return;
    const [r, { data: guest }, { data: admins }, { data: hotel }] = await Promise.all([
      loadReservation(p.reservation_id),
      admin.from("users").select("nombre, email").eq("id", p.payer_id).maybeSingle(),
      admin.from("users").select("email").eq("rol", "hotel_admin").eq("hotelid", p.hotel_id),
      admin.from("hotels").select("nombre, contacto").eq("id", p.hotel_id).maybeSingle(),
    ]);
    if (!r) return;
    const info = readPaymentInfo(r.notes);
    const pendiente = Number(info.montoPendiente ?? 0);
    const pagado = Number(info.montoPagado ?? 0);
    const contacto = (hotel?.contacto ?? {}) as Record<string, unknown>;
    const { data: room } = await admin.from("rooms").select("numero, nombre").eq("id", r.roomid).maybeSingle();
    const card = [p.card_brand, p.last_digits ? `****${p.last_digits}` : ""].filter(Boolean).join(" ");
    const money = (n: number) => `$${n.toFixed(2)} USD`;

    const base = (forGuest: boolean): BrandEmail => ({
      preheader: `${forGuest ? "Recibimos tu pago" : "Pago en línea recibido"} de ${usd(p.amount_cents)} para la reserva ${r.id}.`,
      eyebrow: "Comprobante de pago",
      title: forGuest ? "¡Recibimos tu pago!" : "Pago en línea recibido",
      greeting: forGuest ? `Hola, ${guest?.nombre ?? ""}`.trim() : `Hola, equipo de ${hotel?.nombre ?? "tu establecimiento"}`,
      paragraphs: [
        forGuest
          ? `Tu pago para **${hotel?.nombre ?? "tu reserva"}** fue aprobado${pendiente > 0 ? ". Tu reserva está confirmada; el saldo puedes pagarlo desde \"Mis reservas\" o en el establecimiento." : " y tu reserva está totalmente pagada."}`
          : `**${guest?.nombre ?? "El huésped"}** pagó en línea con Payphone. La reserva se actualizó automáticamente en Roomia.`,
      ],
      status: {
        label: "Estado de la reserva",
        value: pendiente > 0 ? "Confirmada · saldo pendiente" : "Confirmada y pagada",
        tone: "success",
        reference: `Código ${r.id}`,
      },
      sections: [
        {
          title: "Detalle del pago",
          rows: [
            ["Concepto", KIND_LABEL[p.kind] ?? "Pago"],
            ["Medio de pago", card ? `Payphone · ${card}` : "Payphone"],
            ["Fecha", new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })],
          ],
        },
        {
          title: "Estadía",
          rows: [
            ["Establecimiento", hotel?.nombre],
            ["Habitación", room ? `${room.numero ? `${room.numero} · ` : ""}${room.nombre}` : undefined],
            ["Entrada", r.fechaentrada],
            ["Salida", r.fechasalida],
          ],
        },
      ],
      amounts: {
        title: "Resumen",
        rows: [
          ["Pagado ahora", money(p.amount_cents / 100)],
          ["Total pagado de la reserva", money(pagado)],
          ["Total de la reserva", money(r.total)],
        ],
        total: ["Saldo pendiente", money(pendiente)],
      },
      cta: forGuest
        ? { label: pendiente > 0 ? "Ver mi reserva" : "Ver mis reservas", url: `${BRAND.site}/?seccion=mis-reservas` }
        : { label: "Abrir el panel de reservas", url: BRAND.site },
      contact: forGuest
        ? [contacto.telefono, contacto.email].filter(Boolean).length
          ? `${hotel?.nombre ?? "El establecimiento"}: ${[contacto.telefono, contacto.email].filter(Boolean).join(" · ")}`
          : undefined
        : undefined,
    });

    const send = (to: string, subject: string, email: BrandEmail) =>
      fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html: renderBrandEmail(email), text: renderBrandText(email) }),
      }).catch(() => null);

    const jobs: Promise<unknown>[] = [];
    if (guest?.email && EMAIL_RE.test(guest.email)) {
      jobs.push(send(guest.email, `Comprobante de pago · Reserva ${r.id} · ${hotel?.nombre ?? "Roomia"}`, base(true)));
    }
    const staff = [...(admins ?? []).map((a: { email: string | null }) => a.email), contacto.email]
      .filter((e): e is string => typeof e === "string" && EMAIL_RE.test(e.trim()))
      .map((e) => e.trim().toLowerCase());
    for (const to of new Set(staff)) {
      jobs.push(send(to, `Pago en línea recibido · Reserva ${r.id} · ${usd(p.amount_cents)}`, base(false)));
    }
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("payphone emails:", (e as Error)?.message);
  }
}

async function confirm(body: Record<string, unknown>): Promise<Response> {
  const payphoneId = String(body.id ?? "").trim();
  const clientTransactionId = typeof body.clientTransactionId === "string" ? body.clientTransactionId.trim() : "";
  if (!/^\d{1,20}$/.test(payphoneId) || !clientTransactionId || clientTransactionId.length > 50) {
    return json(400, { error: "Datos de confirmación no válidos." });
  }

  const { data: p } = await admin
    .from("payments")
    .select("id, kind, reservation_id, amount_cents, status, status_detail")
    .eq("client_transaction_id", clientTransactionId)
    .maybeSingle();
  if (!p) return json(404, { error: "No encontramos este pago." });

  const result = (status: string, extra: Record<string, unknown> = {}) =>
    json(200, { status, paymentId: p.id, reservationId: p.reservation_id, amount: p.amount_cents, ...extra });

  if (p.status === "aprobado") {
    // Confirmación repetida (recargar la página): se devuelve el estado actual sin tocar nada
    const r = p.reservation_id ? await loadReservation(p.reservation_id) : null;
    const info = readPaymentInfo(r?.notes);
    return result("aprobado", { montoPagado: info.montoPagado, montoPendiente: info.montoPendiente });
  }
  if (p.status === "cancelado" || p.status === "error") return result(p.status, { detail: p.status_detail });

  // Se reserva el pago para que dos confirmaciones a la vez no lo apliquen dos veces
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "procesando" })
    .eq("id", p.id)
    .in("status", ["creado", "expirado"])
    .select("id");
  if (!claimed?.length) return result("procesando");

  const setStatus = (status: string, detail: string | null, extra: Record<string, unknown> = {}) =>
    admin.from("payments").update({ status, status_detail: detail, payphone_transaction_id: payphoneId, ...extra }).eq("id", p.id);

  // Si la reserva ya no admite este cobro, no se confirma: Payphone lo revierte solo en 5 minutos
  const r = p.reservation_id ? await loadReservation(p.reservation_id) : null;
  const expected = r ? paymentAmounts(forPayment(r), p.kind as PaymentKind) : { error: "sin reserva" };
  if (!r || "error" in expected || expected.amount !== p.amount_cents) {
    const detail = "La reserva cambió o fue cancelada antes de confirmar el pago. Payphone revierte el cobro automáticamente.";
    await setStatus("cancelado", detail);
    return result("cancelado", { detail });
  }

  if (!PAYPHONE_TOKEN) {
    await admin.from("payments").update({ status: "creado" }).eq("id", p.id);
    return json(503, { error: "Los pagos en línea todavía no están activos." });
  }

  let pp: Record<string, unknown>;
  try {
    const res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYPHONE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(payphoneId), clientTxId: clientTransactionId }),
    });
    pp = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("payphone confirm http", res.status, JSON.stringify(pp).slice(0, 300));
      await admin.from("payments").update({ status: "creado" }).eq("id", p.id);
      return json(502, { error: "Payphone no respondió la confirmación. Vuelve a intentarlo en unos segundos." });
    }
  } catch (e) {
    console.error("payphone confirm red:", (e as Error)?.message);
    await admin.from("payments").update({ status: "creado" }).eq("id", p.id);
    return json(502, { error: "No pudimos comunicarnos con Payphone. Vuelve a intentarlo en unos segundos." });
  }

  const verdict = checkConfirmation(
    { clientTransactionId, amountCents: p.amount_cents },
    {
      statusCode: Number(pp.statusCode),
      transactionStatus: pp.transactionStatus as string | undefined,
      clientTransactionId: pp.clientTransactionId as string | undefined,
      amount: Number(pp.amount),
    },
  );

  if (verdict === "cancelado") {
    const detail = String(pp.message ?? "El pago no fue aprobado.");
    await setStatus("cancelado", detail);
    return result("cancelado", { detail });
  }
  if (verdict === "no_coincide") {
    const detail = `Payphone confirmó ${usd(Number(pp.amount) || 0)} y se esperaban ${usd(p.amount_cents)}. Revisar y devolver.`;
    console.error("payphone confirm no coincide:", p.id, detail);
    await setStatus("error", detail);
    return result("error", { detail: "El pago no coincide con la reserva. El establecimiento lo revisará y te contactará." });
  }

  const { data: applied, error } = await admin.rpc("aplicar_pago_reserva", {
    p_payment_id: p.id,
    p_payphone_id: String(pp.transactionId ?? payphoneId),
    p_card_brand: String(pp.cardBrand ?? ""),
    p_last_digits: String(pp.lastDigits ?? ""),
    p_authorization_code: String(pp.authorizationCode ?? ""),
  });
  if (error) {
    // El cobro ya está confirmado en Payphone: queda en "error" para revisarlo a mano
    console.error("aplicar_pago_reserva:", error.message);
    await setStatus("error", `Cobro confirmado en Payphone pero no se pudo aplicar a la reserva: ${error.message}`);
    return result("error", { detail: "Recibimos tu pago, pero no pudimos actualizar la reserva. El establecimiento lo revisará." });
  }

  await sendPaymentEmails(p.id);
  return result("aprobado", { montoPagado: applied?.montoPagado, montoPendiente: applied?.montoPendiente });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo no válido" });
  }

  try {
    if (body.action === "prepare") return await prepare(req, body);
    if (body.action === "box") return await box(body);
    if (body.action === "confirm") return await confirm(body);
    return json(400, { error: "Acción no válida" });
  } catch (e) {
    console.error("payphone:", (e as Error)?.message || e);
    return json(500, { error: "No se pudo procesar el pago." });
  }
});
