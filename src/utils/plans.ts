/**
 * Planes y precios de Roomia (landing). Todo el dinero se define aquí: para cambiar un precio
 * basta con editar este archivo, la landing lo muestra sola.
 *
 * Módulo puro (sin navegador): se prueba con `node --test`.
 */

/** Días de prueba gratis al elegir un plan */
export const TRIAL_DAYS = 15;

/** Pago único por cargar la información de las unidades y capacitar al personal */
export const SETUP_FEE = 30;

/** El plan anual se paga como 10 mensualidades: 2 meses gratis */
export const ANNUAL_PAID_MONTHS = 10;
export const ANNUAL_FREE_MONTHS = 12 - ANNUAL_PAID_MONTHS;

export interface Plan {
  id: string;
  name: string;
  /** Propiedades (hotel, casa o edificio de departamentos) */
  props: number;
  /** Unidades incluidas (habitaciones o departamentos) */
  units: number;
  /** Precio fundador, por mes */
  price: number;
  /** Precio oficial, por mes (el que se muestra tachado) */
  old: number;
  /** Precio por mes de cada unidad que supere las incluidas. Baja al subir de plan */
  extraUnit: number;
  /** Complemento de facturación electrónica del SRI (próximamente), por mes */
  invoice: number;
  desc: string;
  soporte: string;
  featured: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'roomia-1', name: 'Roomia 1', props: 1, units: 10, price: 29, old: 39, extraUnit: 2, invoice: 12,
    desc: 'Para una casa, departamento o hotel independiente.', soporte: 'Soporte en español', featured: false
  },
  {
    id: 'roomia-3', name: 'Roomia 3', props: 3, units: 40, price: 69, old: 89, extraUnit: 1.75, invoice: 25,
    desc: 'Para anfitriones que ya manejan varias propiedades.', soporte: 'Soporte prioritario', featured: true
  },
  {
    id: 'roomia-5', name: 'Roomia 5', props: 5, units: 100, price: 109, old: 139, extraUnit: 1.5, invoice: 35,
    desc: 'Para redes de departamentos o gestores turísticos.', soporte: 'Asesoría personalizada', featured: false
  }
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "$29" o "$1.75" */
export const usd = (n: number): string => (Number.isInteger(n) ? `$${n}` : `$${round2(n).toFixed(2)}`);

/** Siempre con dos decimales: "$2.00", "$1.75" (para el valor de una unidad adicional, así se comparan entre planes) */
export const usd2 = (n: number): string => `$${round2(n).toFixed(2)}`;

/** Precio del año completo a partir del mensual */
export const annualPrice = (monthly: number): number => round2(monthly * ANNUAL_PAID_MONTHS);

/** Lo que equivale por mes pagando el año completo */
export const annualPerMonth = (monthly: number): number => round2(annualPrice(monthly) / 12);

/** Cuánto ahorra al año frente a pagar mes a mes */
export const annualSavings = (monthly: number): number => round2(monthly * 12 - annualPrice(monthly));

/** Cuota mensual de un plan para una cantidad de unidades (las que pasan del límite se cobran aparte) */
export const monthlyCost = (plan: Plan, units: number): number =>
  round2(plan.price + Math.max(0, units - plan.units) * plan.extraUnit);

/** Unidades a partir de las cuales conviene más el plan siguiente que pagar unidades adicionales */
export function upgradeBreakEven(plan: Plan, next: Plan): number {
  const extraNeeded = (next.price - plan.price) / plan.extraUnit;
  return Math.ceil(plan.units + extraNeeded);
}
