/**
 * Alquiler de inmuebles completos (casas y departamentos): plazo mínimo que fija el dueño
 * y opciones de duración que puede elegir el cliente en el portal o el personal en el walk-in.
 */

export const DEFAULT_RENTAL_MIN_MONTHS = 3;

/** Plazos mínimos que el dueño puede fijar al publicar la propiedad. */
export const RENTAL_MIN_CHOICES = [1, 2, 3, 6, 12, 24];

/** Duraciones que se ofrecen al contratar (se filtran por el mínimo de la propiedad). */
const RENTAL_DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36];

interface RentalHotelLike {
  tipoEstablecimiento?: string;
  finalidad?: string;
  detallesInmueble?: { minimoMesesAlquiler?: number } | null;
}

export const isPropertyHotel = (h?: RentalHotelLike | null): boolean =>
  !!h && (h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento');

export const isRentalProperty = (h?: RentalHotelLike | null): boolean =>
  isPropertyHotel(h) && h!.finalidad === 'alquiler';

/** Plazo mínimo de alquiler de la propiedad, en meses (3 si el dueño no lo definió). */
export function getRentalMinMonths(h?: RentalHotelLike | null): number {
  const v = Number(h?.detallesInmueble?.minimoMesesAlquiler);
  return Number.isFinite(v) && v >= 1 ? Math.round(v) : DEFAULT_RENTAL_MIN_MONTHS;
}

/** "3 meses", "1 año", "1 año y 6 meses", "2 años" */
export function formatRentalMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years > 0 ? `${years} ${years === 1 ? 'año' : 'años'}` : '';
  const m = rest > 0 ? `${rest} ${rest === 1 ? 'mes' : 'meses'}` : '';
  return y && m ? `${y} y ${m}` : (y || m || '0 meses');
}

/** Duraciones disponibles a partir del mínimo de la propiedad (el mínimo siempre es la primera). */
export function rentalDurationOptions(minMonths: number): { months: number; label: string }[] {
  const list = RENTAL_DURATIONS.filter(n => n >= minMonths);
  if (!list.includes(minMonths)) list.unshift(minMonths);
  return list.map(n => ({
    months: n,
    label: n === minMonths ? `${formatRentalMonths(n)} (mínimo)` : formatRentalMonths(n)
  }));
}

/** Suma meses a "YYYY-MM-DD". Si el día no existe en el mes destino usa el último (31 ene + 1 mes = 28/29 feb). */
export function addMonths(ymd: string, months: number): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const total = (m - 1) + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

/**
 * Importe a pagar al iniciar el alquiler: primera mensualidad + depósito de garantía
 * (una mensualidad, reembolsable). El IVA solo aplica a la mensualidad.
 */
export function rentalPricing(monthlyPrice: number, addIva: boolean) {
  const garantia = monthlyPrice;
  if (!addIva) {
    const iva = monthlyPrice * 0.16;
    return { mensualidad: monthlyPrice, garantia, subtotal: monthlyPrice - iva + garantia, tax: iva, total: monthlyPrice + garantia };
  }
  const sub = monthlyPrice + garantia;
  const tax = monthlyPrice * 0.16;
  return { mensualidad: monthlyPrice, garantia, subtotal: sub, tax, total: sub + tax };
}
