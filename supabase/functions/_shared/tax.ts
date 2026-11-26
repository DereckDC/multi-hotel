/**
 * IVA de Roomia en un solo lugar: lo usan la app (reservas, prefactura, recepción) y el servidor
 * (factura electrónica del SRI). Módulo puro, sin dependencias.
 *
 * Tarifa general vigente en Ecuador: 15 % (código 4 de la tabla 17 de la ficha técnica del SRI,
 * versión 2.32). El SRI rechaza tarifas que no estén en su catálogo.
 */

/** Tarifa general del IVA (15 %) */
export const IVA_RATE = 0.15;
/** "15" para mostrar en pantalla y en los comprobantes */
export const IVA_PERCENT = Math.round(IVA_RATE * 100);
/** Código del impuesto IVA en el SRI (tabla 16) */
export const SRI_CODIGO_IVA = '2';
/** codigoPorcentaje del IVA 15 % en el SRI (tabla 17) */
export const SRI_CODIGO_PORCENTAJE_IVA = '4';
/** codigoPorcentaje del IVA 0 % en el SRI (tabla 17) */
export const SRI_CODIGO_PORCENTAJE_IVA_0 = '0';

export const round2 = (n: number): number => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

/** Precio sin IVA al que se le suma el IVA: base 100 → IVA 15, total 115 */
export function addIva(base: number): { base: number; iva: number; total: number } {
  const b = round2(base);
  const iva = round2(b * IVA_RATE);
  return { base: b, iva, total: round2(b + iva) };
}

/** Precio que ya incluye el IVA: total 115 → base 100, IVA 15 (base + IVA siempre igual al precio) */
export function splitIncludedIva(gross: number): { base: number; iva: number; total: number } {
  const total = round2(gross);
  const base = round2(total / (1 + IVA_RATE));
  return { base, iva: round2(total - base), total };
}
