/**
 * Identificación del comprador en la factura electrónica (tabla 6 de la ficha técnica del SRI).
 * Módulo puro, sin dependencias.
 */

/** 04 RUC · 05 cédula · 06 pasaporte · 07 consumidor final · 08 identificación del exterior */
export type TipoIdentificacion = '04' | '05' | '06' | '07' | '08';

export const TIPOS_IDENTIFICACION: Array<{ value: TipoIdentificacion; label: string }> = [
  { value: '05', label: 'Cédula' },
  { value: '04', label: 'RUC' },
  { value: '06', label: 'Pasaporte' },
  { value: '08', label: 'Identificación del exterior' },
  { value: '07', label: 'Consumidor final' }
];

/** Consumidor final: 13 nueves y "CONSUMIDOR FINAL" */
export const CONSUMIDOR_FINAL = { identificacion: '9999999999999', razonSocial: 'CONSUMIDOR FINAL' } as const;

/** Monto máximo de una factura a consumidor final, en dólares (ficha técnica v2.32, numeral 9.10) */
export const MAX_CONSUMIDOR_FINAL = 50;

/** Cédula ecuatoriana: 10 dígitos, provincia 01-24 (o 30) y dígito verificador módulo 10 */
export function isValidCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(cedula[2]) > 5) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(cedula[9]);
}

/**
 * RUC: 13 dígitos que terminan en establecimiento (001 en adelante). Para personas naturales los
 * primeros 10 son la cédula. Las sociedades y el sector público usan otros dígitos verificadores
 * (tercer dígito 9 y 6): para ellos solo se comprueba la forma, el SRI valida el resto.
 */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  if (Number(ruc.slice(10)) < 1) return false;
  const tercero = Number(ruc[2]);
  if (tercero < 6) return isValidCedula(ruc.slice(0, 10));
  return tercero === 6 || tercero === 9;
}

/** Revisa la identificación según su tipo. Devuelve el mensaje de error o null si está bien. */
export function validarIdentificacion(tipo: TipoIdentificacion, valor: string): string | null {
  const v = (valor || '').trim();
  switch (tipo) {
    case '05':
      return isValidCedula(v) ? null : 'La cédula no es válida (10 dígitos con dígito verificador).';
    case '04':
      return isValidRuc(v) ? null : 'El RUC no es válido (13 dígitos que terminan en 001).';
    case '06':
    case '08':
      return /^[A-Za-z0-9-]{3,20}$/.test(v) ? null : 'Escribe el número de pasaporte o identificación (3 a 20 letras o números).';
    case '07':
      return v === CONSUMIDOR_FINAL.identificacion ? null : 'Consumidor final usa 9999999999999.';
    default:
      return 'Tipo de identificación no válido.';
  }
}
