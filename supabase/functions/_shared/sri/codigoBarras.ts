/**
 * Código de barras Code 128 para la clave de acceso del RIDE (49 dígitos).
 * Los dígitos van de dos en dos con el juego C; si queda uno suelto se cambia al juego B.
 * Devuelve los anchos de barras y espacios alternados (empieza en barra), en módulos.
 * Módulo puro, sin dependencias.
 */

/** Anchos de cada símbolo 0..106 (barra, espacio, barra, espacio, barra, espacio[, barra]) */
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const START_C = 105;
const CODE_B = 100;
const STOP = 106;

/** Valores de los símbolos (sin el de control ni el de parada) */
export function code128Values(digits: string): number[] {
  if (!/^\d+$/.test(digits)) throw new Error('Code 128 C: solo dígitos.');
  const values = [START_C];
  const pares = digits.length - (digits.length % 2);
  for (let i = 0; i < pares; i += 2) values.push(Number(digits.slice(i, i + 2)));
  if (digits.length % 2) {
    values.push(CODE_B);
    values.push(digits.charCodeAt(digits.length - 1) - 32);
  }
  return values;
}

export function code128Checksum(values: number[]): number {
  return values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
}

/** Anchos (en módulos) de todas las barras y espacios, incluido el control y la parada */
export function code128Widths(digits: string): number[] {
  const values = code128Values(digits);
  const all = [...values, code128Checksum(values), STOP];
  return all.flatMap(v => CODE128_PATTERNS[v].split('').map(Number));
}
