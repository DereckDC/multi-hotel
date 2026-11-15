/**
 * Datos de la prefactura en un solo lugar. La vista en pantalla, el PDF A4 y el ticket térmico
 * se dibujan a partir de este mismo objeto para que siempre muestren lo mismo.
 *
 * Módulo puro (sin navegador): se prueba con `node --test`.
 */
import type { Hotel, Reservation, Room, User } from '../types.ts';
import { daysBetween } from './availability.ts';
import { formatRentalMonths, isRentalProperty } from './rental.ts';

export const IVA_RATE = 0.16;

export interface InvoiceLine {
  descripcion: string;
  detalle?: string;
  cantidad: string;
  /** null = sin precio unitario que mostrar */
  unitario: number | null;
  importe: number;
}

export interface InvoiceData {
  id: string;
  fechaEmision: string; // DD/MM/YYYY
  estado: string;
  isAlquiler: boolean;
  emisor: { nombre: string; direccion: string; telefono: string; email: string };
  cliente: { nombre: string; email: string; telefono: string; documento: string };
  estadia: { unidad: string; tipo: string; entrada: string; salida: string; duracion: string };
  lineas: InvoiceLine[];
  subtotal: number;
  impuestos: number;
  total: number;
  ivaLabel: string;
  abonado: number | null;
  pendiente: number | null;
  pago: { titulo: string; detalle: string; tono: 'ok' | 'warn' | 'bad' };
  qr: string;
  politicas: string[];
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const money = (n: number) => `$${round2(n).toFixed(2)}`;

/** "2026-11-25" -> "25/11/2026" (sin pasar por Date, para no depender de la zona horaria) */
export function formatYmd(ymd?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (ymd || '');
}

/**
 * Los servicios se guardan como texto: "Desayuno (2 pers x 3 días - $30.00)".
 * Nombre = lo que va antes del paréntesis; importe = el último "$n" del texto.
 */
export function parseService(raw: string): { nombre: string; detalle: string; importe: number } {
  const text = (raw || '').trim();
  const amounts = [...text.matchAll(/\$\s*([0-9]+(?:[.,][0-9]+)?)/g)];
  const importe = amounts.length ? parseFloat(amounts[amounts.length - 1][1].replace(',', '.')) : 0;
  const open = text.indexOf(' (');
  const nombre = (open > 0 ? text.slice(0, open) : text).trim();
  let detalle = '';
  if (open > 0) {
    detalle = text.slice(open + 2).replace(/\)\s*$/, '').replace(/\s*-\s*\$\s*[0-9.,]+\s*$/, '').trim();
  }
  return { nombre, detalle, importe: round2(importe) };
}

/** Meses completos entre dos fechas (0 si es menos de un mes) */
function wholeMonths(start: string, end: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(start || '');
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(end || '');
  if (!a || !b) return 0;
  let months = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
  if (Number(b[3]) < Number(a[3])) months -= 1;
  return Math.max(0, months);
}

export function buildInvoiceData(
  reservation: Reservation,
  hotel?: Hotel,
  room?: Room,
  guest?: User
): InvoiceData {
  const isAlquiler = isRentalProperty(hotel);
  const subtotal = round2(reservation.subtotal);
  const impuestos = round2(reservation.impuestos);
  const total = round2(reservation.total);
  const nights = Math.max(1, daysBetween(reservation.fechaEntrada, reservation.fechaSalida) || 1);

  const lineas: InvoiceLine[] = [];
  let duracion = `${nights} ${nights === 1 ? 'noche' : 'noches'}`;
  let unidad = room ? `N° ${room.numero} · ${room.nombre}` : 'Habitación';
  let tipo = room?.tipo || '';

  if (isAlquiler) {
    const months = wholeMonths(reservation.fechaEntrada, reservation.fechaSalida);
    duracion = months >= 1 ? formatRentalMonths(months) : duracion;
    unidad = 'Propiedad completa';
    tipo = hotel?.tipoEstablecimiento === 'casa' ? 'Casa' : 'Departamento';

    // El IVA solo grava la mensualidad, así que la mensualidad se deduce del IVA guardado.
    // Si no hay IVA guardado se usa el precio actual de la propiedad o la mitad del subtotal.
    const propPrice = Number(hotel?.detallesInmueble?.precio) || 0;
    let mensual = impuestos > 0 ? round2(impuestos / IVA_RATE) : 0;
    if (!mensual || mensual > subtotal) mensual = propPrice > 0 && propPrice <= subtotal ? propPrice : round2(subtotal / 2);
    const garantia = mensual;
    const renta = round2(Math.max(0, subtotal - garantia));

    lineas.push({
      descripcion: 'Alquiler · primera mensualidad',
      detalle: `${hotel?.nombre || 'Propiedad'} · contrato por ${duracion}`,
      cantidad: '1 mes',
      unitario: renta,
      importe: renta
    });
    lineas.push({
      descripcion: 'Depósito de garantía',
      detalle: 'Reembolsable al finalizar el contrato',
      cantidad: '1',
      unitario: garantia,
      importe: garantia
    });
  } else {
    const servicios = (reservation.serviciosAdicionales || []).map(parseService);
    const serviciosTotal = round2(servicios.reduce((s, x) => s + x.importe, 0));
    // El hospedaje es lo que queda del subtotal: así cuadra siempre, también con tarifas variables
    const hospedaje = round2(Math.max(0, subtotal - serviciosTotal));

    lineas.push({
      descripcion: room?.nombre ? `Hospedaje · ${room.nombre}` : 'Hospedaje',
      detalle: room ? `Hab. ${room.numero}${room.tipo ? ' · ' + room.tipo : ''}` : undefined,
      cantidad: duracion,
      unitario: round2(hospedaje / nights),
      importe: hospedaje
    });
    servicios.forEach(s => {
      lineas.push({
        descripcion: s.nombre || 'Servicio adicional',
        detalle: s.detalle || undefined,
        cantidad: '1',
        unitario: null,
        importe: s.importe
      });
    });
  }

  const abonado = reservation.montoPagado !== undefined && reservation.montoPagado > 0 ? round2(reservation.montoPagado) : null;
  const pendiente = reservation.montoPendiente !== undefined && reservation.montoPendiente > 0 ? round2(reservation.montoPendiente) : null;

  let pago: InvoiceData['pago'];
  if (reservation.estado === 'cancelada') {
    pago = { titulo: 'RESERVA CANCELADA', detalle: 'Este documento no es válido como comprobante de estadía.', tono: 'bad' };
  } else if (reservation.estado === 'confirmada' && pendiente !== null) {
    pago = { titulo: 'RESERVADA CON PAGO PARCIAL', detalle: `Saldo pendiente ${money(pendiente)} USD, pagadero al check-in.`, tono: 'warn' };
  } else if (reservation.estado === 'confirmada' || reservation.estado === 'ocupada' || reservation.estado === 'finalizada') {
    pago = { titulo: 'PAGADO Y CONFIRMADO', detalle: `Ref: ADM-REF-${reservation.id}`, tono: 'ok' };
  } else {
    pago = { titulo: 'PENDIENTE DE PAGO', detalle: 'Contacte a la administración o recepción para realizar su pago.', tono: 'warn' };
  }

  return {
    id: reservation.id,
    fechaEmision: formatYmd(reservation.fechaRegistro),
    estado: (reservation.estado || '').toUpperCase(),
    isAlquiler,
    emisor: {
      nombre: hotel?.nombre || 'Roomia',
      direccion: hotel?.ubicacion || '',
      telefono: hotel?.contacto?.telefono || '',
      email: hotel?.contacto?.email || ''
    },
    cliente: {
      nombre: guest ? `${guest.nombre} ${guest.apellido}`.trim() : 'Cliente',
      email: guest?.email || '',
      telefono: guest?.telefono || '',
      documento: guest?.documento || ''
    },
    estadia: {
      unidad,
      tipo,
      entrada: formatYmd(reservation.fechaEntrada),
      salida: formatYmd(reservation.fechaSalida),
      duracion
    },
    lineas,
    subtotal,
    impuestos,
    total,
    ivaLabel: `IVA ${Math.round(IVA_RATE * 100)}%`,
    abonado,
    pendiente,
    pago,
    qr: reservation.qrCode || reservation.id,
    politicas: isAlquiler
      ? [
          'El depósito de garantía se devuelve al finalizar el contrato, descontando daños si los hubiera.',
          'Presente su identificación oficial (cédula o pasaporte) a la entrega de la propiedad.'
        ]
      : [
          'Check-in presentando identificación oficial (cédula o pasaporte).',
          'Cancelaciones con al menos 24 horas de anticipación para evitar cargos de No-Show.',
          'Los daños a las instalaciones se cargan a la cuenta de la reserva.'
        ]
  };
}
