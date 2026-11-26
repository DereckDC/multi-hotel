/**
 * Facturación electrónica del SRI en el navegador: códigos, estados y vista previa de la factura
 * de una reserva. El XML, la firma, el envío al SRI, el RIDE y el correo los hace la función del
 * servidor `sri` con los mismos módulos de supabase/functions/_shared/sri.
 */
import type { Hotel, Reservation, Room, User } from '../types.ts';
import { daysBetween } from './availability.ts';
import { isRentalProperty } from './rental.ts';
import { compradorDeHuesped, itemsDeReserva } from '../../supabase/functions/_shared/sri/reserva.ts';

export * from '../../supabase/functions/_shared/sri/claveAcceso.ts';
export * from '../../supabase/functions/_shared/sri/identificacion.ts';
export { FORMAS_PAGO, TARIFAS_IVA, lineasDesdeImportes, fechaEcuador } from '../../supabase/functions/_shared/sri/factura.ts';
export type { LineaFactura, Regimen } from '../../supabase/functions/_shared/sri/factura.ts';
export { compradorDeHuesped, itemsDeReserva } from '../../supabase/functions/_shared/sri/reserva.ts';
export type { CompradorFactura, ItemFactura } from '../../supabase/functions/_shared/sri/reserva.ts';

/** Lo que se facturará de una reserva (mismo cálculo que el servidor) */
export function vistaPreviaFactura(reservation: Reservation, hotel?: Hotel, room?: Room, guest?: User) {
  const r = itemsDeReserva({
    id: reservation.id,
    total: Number(reservation.total) || 0,
    subtotal: Number(reservation.subtotal) || 0,
    impuestos: Number(reservation.impuestos) || 0,
    noches: Math.max(1, daysBetween(reservation.fechaEntrada, reservation.fechaSalida) || 1),
    servicios: reservation.serviciosAdicionales || [],
    esAlquiler: isRentalProperty(hotel),
    precioPropiedad: Number(hotel?.detallesInmueble?.precio) || 0,
    habitacion: room ? [room.nombre, room.numero ? `Hab. ${room.numero}` : ''].filter(Boolean).join(' · ') : undefined
  });
  return { ...r, comprador: compradorDeHuesped(guest, r.total) };
}

export type EstadoComprobante =
  | 'pendiente' | 'procesando' | 'recibida' | 'autorizado' | 'devuelta' | 'no_autorizado' | 'error' | 'anulado';

export const ESTADOS_COMPROBANTE: Record<EstadoComprobante, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info'; detalle: string }> = {
  pendiente: { label: 'En cola', tone: 'info', detalle: 'Se enviará al SRI en unos segundos.' },
  procesando: { label: 'Enviando', tone: 'info', detalle: 'Se está enviando al SRI.' },
  recibida: { label: 'Recibida por el SRI', tone: 'warn', detalle: 'El SRI la recibió y la está autorizando. Roomia consulta sola cada pocos minutos.' },
  autorizado: { label: 'Autorizada', tone: 'ok', detalle: 'Válida ante el SRI.' },
  devuelta: { label: 'Devuelta', tone: 'bad', detalle: 'El SRI o Roomia encontraron un problema en los datos. Corrige y reenvía.' },
  no_autorizado: { label: 'No autorizada', tone: 'bad', detalle: 'El SRI no la autorizó. Revisa el mensaje, corrige y reenvía.' },
  error: { label: 'Reintentando', tone: 'warn', detalle: 'No hubo conexión con el SRI. Roomia la reintenta sola, sin duplicarla.' },
  anulado: { label: 'Descartada', tone: 'info', detalle: 'No se envió al SRI o no fue autorizada.' }
};

export const CORREO_ESTADO: Record<string, string> = {
  pendiente: 'Correo pendiente',
  enviado: 'Correo enviado',
  sin_correo: 'Sin correo del cliente',
  sin_configurar: 'Envío de correo no disponible',
  error: 'El correo no se pudo enviar'
};

/** "001-001-000000123" */
export const numeroFactura = (estab: string, ptoEmi: string, secuencial: number | string) =>
  `${estab}-${ptoEmi}-${String(secuencial).padStart(9, '0')}`;
