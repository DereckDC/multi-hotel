/**
 * Planes de los anfitriones: lectura y gestión de suscripciones y de sus pagos.
 * Las reglas (precios, estado real, vencimientos) están en supabase/functions/_shared/plans.ts.
 */
import { supabase } from '../supabase';
import { isNativeApp } from './platform';
import type { Billing, StoredStatus, SubscriptionDates } from './plans';

export interface Subscription extends SubscriptionDates {
  id: string;
  ownerId: string;
  planId: string;
  billing: Billing;
  setupPaid: boolean;
  /** El período pagado incluye el módulo de facturación electrónica del SRI */
  sriModulo: boolean;
  /** Fecha hasta la que está pagado el módulo SRI (null: nunca se pagó) */
  sriHasta: string | null;
  notes: string;
  createdAt: string;
}

export interface PlanPayment {
  id: string;
  ownerId: string;
  kind: 'plan' | 'puesta_en_marcha';
  amount: number;
  status: string;
  method: string;
  planId: string | null;
  billing: Billing | null;
  sri: boolean;
  /** Propiedades por las que se cobró el módulo SRI */
  sriProps: number;
  /** El pago incluyó la puesta en marcha como adicional */
  setup: boolean;
  note: string | null;
  card: string;
  createdAt: string;
  confirmedAt: string | null;
}

const toSubscription = (row: any): Subscription => ({
  id: row.id,
  ownerId: row.owner_id,
  planId: row.plan_id,
  billing: row.billing,
  status: row.status as StoredStatus,
  trialEndsAt: row.trial_ends_at,
  currentPeriodEnd: row.current_period_end,
  graceDays: Number(row.grace_days ?? 7),
  setupPaid: Boolean(row.setup_paid),
  sriModulo: Boolean(row.sri_modulo),
  sriHasta: row.sri_hasta ?? null,
  notes: row.notes ?? '',
  createdAt: row.created_at
});

const toPayment = (row: any): PlanPayment => ({
  id: row.id,
  ownerId: row.payer_id,
  kind: row.kind,
  amount: Number(row.amount_cents) / 100,
  status: row.status,
  method: row.method ?? 'payphone',
  planId: row.details?.planId ?? null,
  billing: row.details?.billing ?? null,
  sri: row.details?.sri === true,
  sriProps: Number(row.details?.sriProps ?? (row.details?.sri === true ? 1 : 0)),
  setup: row.details?.setup === true,
  note: row.status_detail ?? null,
  card: [row.card_brand, row.last_digits ? `****${row.last_digits}` : ''].filter(Boolean).join(' '),
  createdAt: row.created_at,
  confirmedAt: row.confirmed_at
});

const PAYMENT_FIELDS = 'id, payer_id, kind, amount_cents, status, method, details, status_detail, card_brand, last_digits, created_at, confirmed_at';

/** Suscripción del anfitrión con sesión iniciada (null si todavía no tiene) */
export async function fetchMySubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase.from('subscriptions').select('*').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  return data ? toSubscription(data) : null;
}

/** Pagos de plan de un anfitrión (los más recientes primero) */
export async function fetchPlanPayments(ownerId?: string): Promise<PlanPayment[]> {
  let query = supabase.from('payments').select(PAYMENT_FIELDS).in('kind', ['plan', 'puesta_en_marcha']).order('created_at', { ascending: false }).limit(200);
  if (ownerId) query = query.eq('payer_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toPayment);
}

/** Todas las suscripciones (superadmin) */
export async function fetchAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toSubscription);
}

/** Crea la suscripción de un anfitrión con días de prueba (superadmin) */
export async function createSubscription(ownerId: string, planId: string, billing: Billing, trialDays: number): Promise<Subscription> {
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ owner_id: ownerId, plan_id: planId, billing, status: 'prueba', trial_ends_at: trialEndsAt })
    .select('*')
    .single();
  if (error) throw error;
  return toSubscription(data);
}

export interface SubscriptionPatch {
  planId?: string;
  billing?: Billing;
  status?: StoredStatus;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  graceDays?: number;
  notes?: string;
  sriModulo?: boolean;
  /** Hasta cuándo está pagado el módulo SRI (null lo desactiva) */
  sriHasta?: string | null;
}

/** Cambia el plan, el estado o las fechas de una suscripción (superadmin) */
export async function updateSubscription(id: string, patch: SubscriptionPatch): Promise<Subscription> {
  const row: Record<string, unknown> = {};
  if (patch.planId !== undefined) row.plan_id = patch.planId;
  if (patch.billing !== undefined) row.billing = patch.billing;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.trialEndsAt !== undefined) row.trial_ends_at = patch.trialEndsAt;
  if (patch.currentPeriodEnd !== undefined) row.current_period_end = patch.currentPeriodEnd;
  if (patch.graceDays !== undefined) row.grace_days = patch.graceDays;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.sriModulo !== undefined) row.sri_modulo = patch.sriModulo;
  if (patch.sriHasta !== undefined) row.sri_hasta = patch.sriHasta;
  const { data, error } = await supabase.from('subscriptions').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return toSubscription(data);
}

/** Registra un pago hecho por transferencia o en efectivo y extiende el plan (superadmin) */
export async function registerManualPayment(input: {
  ownerId: string;
  kind: 'plan' | 'puesta_en_marcha';
  planId: string;
  billing: Billing;
  amount: number;
  method: 'transferencia' | 'efectivo' | 'otro';
  note: string;
  /** El pago incluye el módulo de facturación electrónica del SRI */
  sri: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('registrar_pago_plan_manual', {
    p_owner_id: input.ownerId,
    p_kind: input.kind,
    p_plan_id: input.planId,
    p_billing: input.billing,
    p_amount: input.amount,
    p_method: input.method,
    p_note: input.note,
    p_sri: input.kind === 'plan' && input.sri
  });
  if (error) throw error;
}

/** Establecimientos que hoy no reciben reservas (anfitrión suspendido o cancelado) */
export async function fetchBlockedHotels(): Promise<string[]> {
  const { data, error } = await supabase.rpc('hoteles_sin_reservas');
  if (error) return [];
  return (data ?? []).map((row: any) => (typeof row === 'string' ? row : row?.hoteles_sin_reservas)).filter(Boolean);
}

/**
 * Inicia el pago del plan con Payphone: el servidor calcula el monto y se abre la página /pago/<id>.
 * En el APK se abre en el navegador del teléfono (la Cajita no funciona dentro de la app).
 */
export async function startPlanPayment(kind: 'plan' | 'puesta_en_marcha', planId: string, billing: Billing, sri = false, setup = false): Promise<void> {
  const { data, error } = await supabase.functions.invoke('payphone', {
    body: { action: 'prepare_plan', kind, planId, billing, sri: kind === 'plan' && sri, setup: kind === 'plan' && setup }
  });
  let paymentId: string | undefined = data?.paymentId;
  let message: string | undefined = data?.error;
  if (!paymentId && error && 'context' in error) {
    try { message = (await (error as any).context.json())?.error; } catch { /* sin cuerpo */ }
  }
  if (!paymentId) throw new Error(message || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
  const path = `/pago/${paymentId}`;
  if (isNativeApp()) window.open(`https://roomiapms.site${path}`, '_blank');
  else window.location.assign(path);
}

/** ¿El módulo SRI está pagado y vigente para este establecimiento? (el superadmin siempre lo ve) */
export const sriModuloVigente = (sub: Pick<Subscription, 'sriHasta'> | null | undefined, now: number = Date.now()): boolean =>
  !!sub?.sriHasta && new Date(sub.sriHasta).getTime() >= now;

/** Consulta en el servidor si el establecimiento tiene el módulo SRI pagado y vigente */
export async function fetchSriModuloActivo(hotelId: string | undefined): Promise<boolean> {
  if (!hotelId) return false;
  const { data, error } = await supabase.rpc('sri_modulo_activo', { p_hotel_id: hotelId });
  if (error) return false;
  return data === true;
}
