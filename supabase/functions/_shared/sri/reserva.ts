/**
 * Factura de una reserva: líneas y datos del cliente. Lo usan la función del servidor (factura
 * automática al hacer check-out) y el navegador (vista previa antes de emitir). Módulo puro.
 *
 *  · Se factura el total cobrado sin el depósito de garantía (es reembolsable, no es un ingreso).
 *  · El total se reparte entre hospedaje y servicios en proporción a sus importes (IVA incluido).
 *  · El cliente sale del huésped: RUC o cédula válidos, si no pasaporte; sin documento y hasta
 *    $50, consumidor final.
 */
import { parseService, rentalMonthly } from '../reservaImportes.ts';
import { round2 } from '../tax.ts';
import { CONSUMIDOR_FINAL, MAX_CONSUMIDOR_FINAL, isValidCedula, isValidRuc, type TipoIdentificacion } from './identificacion.ts';

export interface ReservaParaFactura {
  id: string;
  total: number;
  subtotal: number;
  impuestos: number;
  noches: number;
  servicios: string[];
  esAlquiler: boolean;
  /** Precio actual de la propiedad (respaldo para deducir la garantía) */
  precioPropiedad?: number;
  /** "Domo Suite · Hab. 001" */
  habitacion?: string;
}

export interface ItemFactura {
  codigo: string;
  descripcion: string;
  cantidad: number;
  /** Importe cobrado con IVA incluido */
  importe: number;
}

export interface CompradorFactura {
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;
  razonSocial: string;
  direccion?: string;
  email?: string;
  telefono?: string;
}

export function itemsDeReserva(r: ReservaParaFactura): { items: ItemFactura[]; total: number; garantia: number } {
  const subtotal = round2(r.subtotal);
  const lineas: Array<{ codigo: string; descripcion: string; cantidad: number; peso: number }> = [];
  let garantia = 0;

  if (r.esAlquiler) {
    garantia = rentalMonthly(subtotal, round2(r.impuestos), r.precioPropiedad ?? 0);
    lineas.push({ codigo: 'ALQ', descripcion: `Alquiler · primera mensualidad${r.habitacion ? ` · ${r.habitacion}` : ''}`, cantidad: 1, peso: Math.max(0, subtotal - garantia) });
  } else {
    const servicios = (r.servicios || []).map(parseService).filter(s => s.importe > 0);
    const serviciosTotal = servicios.reduce((s, x) => s + x.importe, 0);
    const noches = Math.max(1, Math.round(r.noches) || 1);
    lineas.push({
      codigo: 'HOSP',
      descripcion: `Hospedaje${r.habitacion ? ` · ${r.habitacion}` : ''} · ${noches} ${noches === 1 ? 'noche' : 'noches'}`,
      cantidad: noches,
      peso: Math.max(0, subtotal - serviciosTotal)
    });
    servicios.forEach((s, i) =>
      lineas.push({ codigo: `SERV${i + 1}`, descripcion: [s.nombre || 'Servicio adicional', s.detalle].filter(Boolean).join(' · '), cantidad: 1, peso: s.importe })
    );
  }

  const total = round2(Math.max(0, r.total - garantia));
  const validas = lineas.filter(l => l.peso > 0);
  const suma = validas.reduce((s, l) => s + l.peso, 0);
  if (!validas.length || total <= 0 || suma <= 0) return { items: [], total: 0, garantia };

  const items = validas.map(l => ({ codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad, importe: round2((l.peso / suma) * total) }));
  const diff = round2(total - items.reduce((s, i) => s + i.importe, 0));
  items[items.length - 1].importe = round2(items[items.length - 1].importe + diff);
  return { items, total, garantia };
}

/** Cliente de la factura a partir de los datos del huésped */
export function compradorDeHuesped(
  huesped: { nombre?: string | null; apellido?: string | null; documento?: string | null; email?: string | null; telefono?: string | null } | null | undefined,
  total: number
): CompradorFactura {
  const doc = String(huesped?.documento ?? '').replace(/[\s.-]+/g, '').toUpperCase();
  const nombre = `${huesped?.nombre ?? ''} ${huesped?.apellido ?? ''}`.replace(/\s+/g, ' ').trim();
  const contacto = { email: huesped?.email?.trim() || undefined, telefono: huesped?.telefono?.trim() || undefined };
  if (isValidRuc(doc)) return { tipoIdentificacion: '04', identificacion: doc, razonSocial: nombre, ...contacto };
  if (isValidCedula(doc)) return { tipoIdentificacion: '05', identificacion: doc, razonSocial: nombre, ...contacto };
  if (/^[A-Z0-9]{3,20}$/.test(doc) && nombre) return { tipoIdentificacion: '06', identificacion: doc, razonSocial: nombre, ...contacto };
  if (total <= MAX_CONSUMIDOR_FINAL) {
    return { tipoIdentificacion: '07', identificacion: CONSUMIDOR_FINAL.identificacion, razonSocial: CONSUMIDOR_FINAL.razonSocial, ...contacto };
  }
  // Sin documento válido y más de $50: hay que pedir los datos al cliente
  return { tipoIdentificacion: '05', identificacion: doc, razonSocial: nombre, ...contacto };
}
