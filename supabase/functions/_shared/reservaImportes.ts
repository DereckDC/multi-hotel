/**
 * Importes de una reserva a partir de lo que se guarda en la base: servicios adicionales (texto)
 * y mensualidad de un alquiler. Lo usan la prefactura (navegador) y la factura electrónica
 * (navegador y función del servidor). Módulo puro, sin dependencias.
 */
import { IVA_RATE, round2 } from './tax.ts';

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

/**
 * Mensualidad de un alquiler a partir del IVA guardado en la reserva. Se prueba con la tarifa
 * vigente (15 %) y con la anterior (16 %, reservas antiguas), y con el IVA sumado al precio o
 * incluido en él; se queda la combinación que cuadra con el subtotal guardado.
 * Subtotal guardado: IVA sumado → mensualidad + garantía · IVA incluido → base + garantía.
 */
export function rentFromStoredIva(subtotal: number, impuestos: number): number {
  for (const rate of [IVA_RATE, 0.16]) {
    const added = round2(impuestos / rate);
    if (Math.abs(added * 2 - subtotal) <= 0.05) return added;
    const included = round2((impuestos * (1 + rate)) / rate);
    if (Math.abs(included / (1 + rate) + included - subtotal) <= 0.05) return included;
  }
  return 0;
}

/** Mensualidad (= garantía) de un alquiler: del IVA guardado, del precio actual o la mitad del subtotal */
export function rentalMonthly(subtotal: number, impuestos: number, propertyPrice = 0): number {
  let mensual = impuestos > 0 ? rentFromStoredIva(subtotal, impuestos) : 0;
  if (!mensual || mensual > subtotal) mensual = propertyPrice > 0 && propertyPrice <= subtotal ? propertyPrice : round2(subtotal / 2);
  return mensual;
}
