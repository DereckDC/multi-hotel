/**
 * Colores de la marca para los documentos (PDF). Salen de los mismos valores que los correos
 * (`BRAND` en supabase/functions/_shared/brandEmail.ts) y que la interfaz (src/index.css), para que
 * una factura, un correo y la pantalla se vean como una sola marca.
 */
import { BRAND } from '../../supabase/functions/_shared/brandEmail.ts';

export type RGB = [number, number, number];

/** "#0E2A47" -> [14, 42, 71] */
export const hexToRgb = (hex: string): RGB => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16)) as RGB;
};

export const PDF_COLORS = {
  navy: hexToRgb(BRAND.navy),
  navyDark: hexToRgb(BRAND.navyDark),
  cyan: hexToRgb(BRAND.cyan),
  /** Texto principal */
  ink: hexToRgb(BRAND.text),
  /** Texto secundario */
  muted: hexToRgb(BRAND.muted),
  border: hexToRgb(BRAND.border),
  /** Línea más marcada (cabecera de tabla, separadores) */
  borderStrong: hexToRgb('#CBD5E1'),
  soft: hexToRgb(BRAND.soft),
  /** Texto sobre fondo navy */
  onNavy: hexToRgb('#BECAD6'),
  success: hexToRgb('#047857'),
  warning: hexToRgb('#B45309'),
  danger: hexToRgb('#B91C1C')
} as const;

/** Nombre de la marca en documentos */
export const PDF_BRAND_NAME = 'ROOMIA PMS';
export const PDF_BRAND_TAGLINE = 'Gestión hotelera y reservas directas';
