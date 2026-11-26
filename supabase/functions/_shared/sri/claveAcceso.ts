/**
 * Clave de acceso de 49 dígitos de los comprobantes electrónicos del SRI (ficha técnica offline
 * v2.32, tabla 1). Es también el número de autorización del comprobante.
 *
 *   fecha de emisión ddmmaaaa (8) + tipo de comprobante (2) + RUC (13) + ambiente (1)
 *   + serie: establecimiento y punto de emisión (6) + secuencial (9) + código numérico (8)
 *   + tipo de emisión (1) + dígito verificador módulo 11 (1)
 *
 * Módulo puro, sin dependencias.
 */

export type Ambiente = '1' | '2';
/** 01 factura · 04 nota de crédito (tabla 3) */
export type TipoComprobante = '01' | '03' | '04' | '05' | '06' | '07';

/**
 * Dígito verificador módulo 11 con factor de chequeo ponderado 2..7 (de derecha a izquierda).
 * Si el resultado es 11 el dígito es 0, y si es 10 el dígito es 1.
 */
export function modulo11(digits: string): number {
  if (!/^\d+$/.test(digits)) throw new Error('El módulo 11 solo acepta dígitos.');
  let factor = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const result = 11 - (sum % 11);
  if (result === 11) return 0;
  if (result === 10) return 1;
  return result;
}

const pad = (value: string | number, length: number) => String(value).padStart(length, '0');

export interface ClaveAccesoInput {
  /** dd/mm/aaaa */
  fechaEmision: string;
  tipoComprobante: TipoComprobante;
  ruc: string;
  ambiente: Ambiente;
  estab: string;
  ptoEmi: string;
  secuencial: number | string;
  /** 8 dígitos elegidos por el emisor */
  codigoNumerico: string;
  /** Solo existe la emisión normal (1) en el esquema offline */
  tipoEmision?: '1';
}

export function buildClaveAcceso(input: ClaveAccesoInput): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.fechaEmision);
  if (!m) throw new Error('La fecha de emisión debe tener el formato dd/mm/aaaa.');
  if (!/^\d{13}$/.test(input.ruc)) throw new Error('El RUC debe tener 13 dígitos.');
  if (!/^\d{3}$/.test(input.estab) || !/^\d{3}$/.test(input.ptoEmi)) {
    throw new Error('El establecimiento y el punto de emisión deben tener 3 dígitos.');
  }
  const secuencial = pad(input.secuencial, 9);
  if (!/^\d{9}$/.test(secuencial) || Number(secuencial) < 1) throw new Error('El secuencial debe tener de 1 a 9 dígitos.');
  if (!/^\d{8}$/.test(input.codigoNumerico)) throw new Error('El código numérico debe tener 8 dígitos.');

  const base =
    `${m[1]}${m[2]}${m[3]}` +
    input.tipoComprobante +
    input.ruc +
    input.ambiente +
    input.estab +
    input.ptoEmi +
    secuencial +
    input.codigoNumerico +
    (input.tipoEmision ?? '1');
  if (base.length !== 48) throw new Error('La clave de acceso quedó mal conformada.');
  return base + modulo11(base);
}

/** ¿La clave tiene 49 dígitos y su dígito verificador es correcto? */
export function isValidClaveAcceso(clave: string): boolean {
  return /^\d{49}$/.test(clave) && modulo11(clave.slice(0, 48)) === Number(clave[48]);
}

/** Código numérico de 8 dígitos aleatorio (seguridad del emisor) */
export function randomCodigoNumerico(random: () => number = Math.random): string {
  return pad(Math.floor(random() * 100_000_000), 8);
}
