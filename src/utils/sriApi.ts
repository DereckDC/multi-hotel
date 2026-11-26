/**
 * Facturación electrónica: lectura de datos (Supabase con RLS) y acciones de la función del
 * servidor `sri`.
 */
import { supabase } from '../supabase';
import { friendlyError } from './errors';
import type { CompradorFactura, EstadoComprobante, ItemFactura, Regimen } from './sri';

export interface SriEmisor {
  hotelId: string;
  activo: boolean;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  estab: string;
  ptoEmi: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string;
  agenteRetencion: string;
  regimen: Regimen;
  ambiente: '1' | '2';
  codigoIva: string;
  formaPago: string;
  correoCopia: string;
  secuencialPruebas: number;
  secuencialProduccion: number;
  certTitular: string | null;
  certEmisor: string | null;
  certValidoHasta: string | null;
  certSubidoAt: string | null;
  certRucOk: boolean | null;
}

export interface SriMensaje {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo?: string;
}

export interface SriComprobante {
  id: string;
  hotelId: string;
  reservationId: string | null;
  origen: 'automatica' | 'manual';
  ambiente: '1' | '2';
  estab: string;
  ptoEmi: string;
  secuencial: number;
  claveAcceso: string;
  fechaEmision: string;
  estado: EstadoComprobante;
  recibido: boolean;
  comprador: CompradorFactura | null;
  items: ItemFactura[] | null;
  formaPago: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  xmlFirmado: string | null;
  xmlAutorizado: string | null;
  numeroAutorizacion: string | null;
  fechaAutorizacion: string | null;
  mensajes: SriMensaje[];
  intentos: number;
  proximoIntento: string | null;
  correoEstado: string;
  correoEnviadoAt: string | null;
  anulacionPortal: boolean;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Error de lectura: si las tablas aún no existen en el servidor, un mensaje claro */
function errorDeLectura(error: { code?: string; message?: string }): Error {
  if (error.code === 'PGRST205' || error.code === '42P01' || /sri_(emisores|comprobantes)/.test(error.message ?? '')) {
    return new Error('La facturación electrónica aún no está instalada en el servidor.');
  }
  return new Error(friendlyError(error));
}

export const emisorFromDb = (r: Row): SriEmisor => ({
  hotelId: r.hotel_id,
  activo: !!r.activo,
  ruc: r.ruc ?? '',
  razonSocial: r.razon_social ?? '',
  nombreComercial: r.nombre_comercial ?? '',
  dirMatriz: r.dir_matriz ?? '',
  dirEstablecimiento: r.dir_establecimiento ?? '',
  estab: r.estab ?? '001',
  ptoEmi: r.pto_emi ?? '001',
  obligadoContabilidad: !!r.obligado_contabilidad,
  contribuyenteEspecial: r.contribuyente_especial ?? '',
  agenteRetencion: r.agente_retencion ?? '',
  regimen: r.regimen ?? 'general',
  ambiente: r.ambiente === '2' ? '2' : '1',
  codigoIva: r.codigo_iva ?? '4',
  formaPago: r.forma_pago ?? '19',
  correoCopia: r.correo_copia ?? '',
  secuencialPruebas: Number(r.secuencial_pruebas ?? 1),
  secuencialProduccion: Number(r.secuencial_produccion ?? 1),
  certTitular: r.cert_titular ?? null,
  certEmisor: r.cert_emisor ?? null,
  certValidoHasta: r.cert_valido_hasta ?? null,
  certSubidoAt: r.cert_subido_at ?? null,
  certRucOk: r.cert_ruc_ok ?? null
});

export const comprobanteFromDb = (r: Row): SriComprobante => ({
  id: r.id,
  hotelId: r.hotel_id,
  reservationId: r.reservation_id ?? null,
  origen: r.origen === 'automatica' ? 'automatica' : 'manual',
  ambiente: r.ambiente === '2' ? '2' : '1',
  estab: r.estab,
  ptoEmi: r.pto_emi,
  secuencial: Number(r.secuencial),
  claveAcceso: r.clave_acceso,
  fechaEmision: r.fecha_emision,
  estado: r.estado,
  recibido: !!r.recibido,
  comprador: r.comprador ?? null,
  items: Array.isArray(r.items) ? r.items : null,
  formaPago: r.forma_pago ?? null,
  subtotal: num(r.subtotal),
  iva: num(r.iva),
  total: num(r.total),
  xmlFirmado: r.xml_firmado ?? null,
  xmlAutorizado: r.xml_autorizado ?? null,
  numeroAutorizacion: r.numero_autorizacion ?? null,
  fechaAutorizacion: r.fecha_autorizacion ?? null,
  mensajes: Array.isArray(r.mensajes) ? r.mensajes : [],
  intentos: Number(r.intentos ?? 0),
  proximoIntento: r.proximo_intento ?? null,
  correoEstado: r.correo_estado ?? 'pendiente',
  correoEnviadoAt: r.correo_enviado_at ?? null,
  anulacionPortal: !!r.anulacion_portal,
  createdAt: r.created_at
});

export async function fetchEmisor(hotelId: string): Promise<SriEmisor | null> {
  const { data, error } = await supabase.from('sri_emisores').select('*').eq('hotel_id', hotelId).maybeSingle();
  if (error) throw errorDeLectura(error);
  return data ? emisorFromDb(data) : null;
}

export async function fetchComprobantes(filter: { hotelId?: string; reservationId?: string }, limit = 200): Promise<SriComprobante[]> {
  let q = supabase.from('sri_comprobantes').select('*').order('created_at', { ascending: false }).limit(limit);
  if (filter.hotelId) q = q.eq('hotel_id', filter.hotelId);
  if (filter.reservationId) q = q.eq('reservation_id', filter.reservationId);
  const { data, error } = await q;
  if (error) throw errorDeLectura(error);
  return (data ?? []).map(comprobanteFromDb);
}

/** Llama a la función `sri` y devuelve el cuerpo, o lanza el mensaje de error en español */
async function callSri<T = Row>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sri', { body });
  if (error) {
    let message = 'No se pudo completar la operación de facturación.';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any).context;
      const payload = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (payload?.error) message = payload.error;
    } catch {
      // sin cuerpo legible
    }
    throw new Error(message);
  }
  return data as T;
}

const comprobanteDe = async (body: Record<string, unknown>) => {
  const r = await callSri<{ comprobante: Row | null }>(body);
  return r.comprobante ? comprobanteFromDb(r.comprobante) : null;
};

export async function guardarEmisor(hotelId: string, emisor: Partial<SriEmisor>): Promise<SriEmisor> {
  const r = await callSri<{ emisor: Row }>({ action: 'guardar_emisor', hotelId, emisor });
  return emisorFromDb(r.emisor);
}

export async function subirFirma(hotelId: string, p12Base64: string, password: string): Promise<SriEmisor> {
  const r = await callSri<{ emisor: Row }>({ action: 'subir_firma', hotelId, p12Base64, password });
  return emisorFromDb(r.emisor);
}

export const probarConexion = (hotelId: string) =>
  callSri<{ ok: boolean; checks: Array<{ paso: string; ok: boolean; detalle: string }> }>({ action: 'probar', hotelId });

/** Crea (si no existe) y envía la factura de la reserva. Con datos del cliente, los usa en vez de los del huésped. */
export const emitirFactura = (reservationId: string, cambios: { comprador?: CompradorFactura; formaPago?: string } = {}) =>
  comprobanteDe({ action: 'emitir', reservationId, ...cambios });

/** Tras el check-out: envía al instante la factura automática que creó la base (si la hay) */
export const procesarFacturaDeReserva = (reservationId: string) =>
  comprobanteDe({ action: 'emitir', reservationId, soloPendiente: true });

export const reintentarComprobante = (comprobanteId: string, cambios: { comprador?: CompradorFactura; formaPago?: string } = {}) =>
  comprobanteDe({ action: 'reintentar', comprobanteId, ...cambios });

export const anularComprobante = (comprobanteId: string) => comprobanteDe({ action: 'anular', comprobanteId });

export const reenviarCorreo = (comprobanteId: string, correo?: string) =>
  comprobanteDe({ action: 'reenviar_correo', comprobanteId, correo });

/** Lee un archivo como base64 (sin el prefijo data:) */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
