/**
 * Planes y precios de Roomia. Todo el dinero se define aquí: lo usan la landing, el panel
 * ("Mi plan" y "Suscripciones") y la función de pagos del servidor.
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
  /** Módulo adicional de facturación electrónica del SRI, por mes (con Roomia 5 cuesta menos) */
  invoice: number;
  desc: string;
  soporte: string;
  featured: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'roomia-1', name: 'Roomia 1', props: 1, units: 10, price: 29, old: 39, extraUnit: 2, invoice: 40,
    desc: 'Para una casa, departamento o hotel independiente.', soporte: 'Soporte en español', featured: false
  },
  {
    id: 'roomia-3', name: 'Roomia 3', props: 3, units: 40, price: 69, old: 89, extraUnit: 1.75, invoice: 40,
    desc: 'Para anfitriones que ya manejan varias propiedades.', soporte: 'Soporte prioritario', featured: true
  },
  {
    id: 'roomia-5', name: 'Roomia 5', props: 5, units: 100, price: 109, old: 139, extraUnit: 1.5, invoice: 30,
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

// ---------------------------------------------------------------- Cobro de planes a anfitriones

export type Billing = 'mensual' | 'anual';
export const BILLINGS: Billing[] = ['mensual', 'anual'];

/** Lo que se guarda de la suscripción de un anfitrión (tabla subscriptions) */
export type StoredStatus = 'prueba' | 'activa' | 'suspendida' | 'cancelada';
/**
 * Estado real, calculado con las fechas:
 * · prueba / activa: al día · vencida: pasó la fecha, pero está en los días de gracia
 * · suspendida: venció la gracia o la suspendió el superadmin · cancelada · sin_plan
 */
export type EffectiveStatus = StoredStatus | 'vencida' | 'sin_plan';

export interface SubscriptionDates {
  status: StoredStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const findPlan = (id: string | null | undefined): Plan | undefined => PLANS.find(p => p.id === id);

/** Fecha hasta la que está pagado (o hasta la que dura la prueba) */
export const paidUntil = (s: SubscriptionDates): string | null => s.currentPeriodEnd || s.trialEndsAt;

export function effectiveStatus(s: SubscriptionDates | null | undefined, now: number = Date.now()): EffectiveStatus {
  if (!s) return 'sin_plan';
  if (s.status === 'cancelada' || s.status === 'suspendida') return s.status;
  const until = paidUntil(s);
  if (!until) return 'sin_plan';
  const end = new Date(until).getTime();
  if (now <= end) return s.status;
  if (now <= end + Math.max(0, s.graceDays) * DAY_MS) return 'vencida';
  return 'suspendida';
}

/** Días que faltan para que venza (negativo si ya venció) */
export function daysLeft(s: SubscriptionDates | null | undefined, now: number = Date.now()): number | null {
  const until = s ? paidUntil(s) : null;
  if (!until) return null;
  return Math.ceil((new Date(until).getTime() - now) / DAY_MS);
}

/** ¿El anfitrión puede recibir reservas nuevas y crear habitaciones o propiedades? */
export const canOperate = (status: EffectiveStatus): boolean => status !== 'suspendida' && status !== 'cancelada';

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  prueba: 'En prueba',
  activa: 'Al día',
  vencida: 'Vencida',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
  sin_plan: 'Sin plan'
};

/**
 * Monto de un cobro, en dólares. Plan: según unidades y forma de pago, más el módulo de
 * facturación electrónica del SRI, que se cobra por propiedad (hotel, casa o departamento)
 * · puesta en marcha: pago único. sriProperties = 0 significa sin el módulo. withSetup suma la
 * puesta en marcha como adicional del mismo pago (no se multiplica en el plan anual).
 */
export function planCharge(kind: 'plan' | 'puesta_en_marcha', plan: Plan, units: number, billing: Billing, sriProperties = 0, withSetup = false): number {
  if (kind === 'puesta_en_marcha') return SETUP_FEE;
  const sri = plan.invoice * Math.max(0, Math.floor(sriProperties));
  const monthly = round2(monthlyCost(plan, Math.max(0, Math.floor(units))) + sri);
  const period = billing === 'anual' ? annualPrice(monthly) : monthly;
  return round2(period + (withSetup ? SETUP_FEE : 0));
}

/** Precio del módulo SRI en el período elegido, por una propiedad o por varias */
export const sriCharge = (plan: Plan, billing: Billing, properties = 1): number => {
  const monthly = round2(plan.invoice * Math.max(0, Math.floor(properties)));
  return billing === 'anual' ? annualPrice(monthly) : monthly;
};

/** Nueva fecha de vencimiento al pagar un período: se suma desde hoy o desde lo que ya estaba pagado */
export function extendPeriod(currentEnd: string | null, billing: Billing, now: number = Date.now()): string {
  const base = new Date(Math.max(now, currentEnd ? new Date(currentEnd).getTime() : 0));
  if (billing === 'anual') base.setUTCFullYear(base.getUTCFullYear() + 1);
  else base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString();
}
