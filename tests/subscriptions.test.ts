import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS, SETUP_FEE, canOperate, daysLeft, effectiveStatus, extendPeriod, findPlan, planCharge, type SubscriptionDates
} from '../supabase/functions/_shared/plans.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 19, 12);
const sub = (over: Partial<SubscriptionDates> = {}): SubscriptionDates => ({
  status: 'activa',
  trialEndsAt: null,
  currentPeriodEnd: new Date(NOW + 10 * DAY).toISOString(),
  graceDays: 7,
  ...over
});

test('sin suscripción o sin fechas: sin plan', () => {
  assert.equal(effectiveStatus(null, NOW), 'sin_plan');
  assert.equal(effectiveStatus(sub({ currentPeriodEnd: null }), NOW), 'sin_plan');
});

test('al día mientras no pase la fecha pagada', () => {
  assert.equal(effectiveStatus(sub(), NOW), 'activa');
  assert.equal(daysLeft(sub(), NOW), 10);
});

test('la prueba usa su propia fecha de fin', () => {
  const trial = sub({ status: 'prueba', currentPeriodEnd: null, trialEndsAt: new Date(NOW + 3 * DAY).toISOString() });
  assert.equal(effectiveStatus(trial, NOW), 'prueba');
  assert.equal(daysLeft(trial, NOW), 3);
});

test('vencida durante los días de gracia y suspendida después', () => {
  const s = sub({ currentPeriodEnd: new Date(NOW - 3 * DAY).toISOString() });
  assert.equal(effectiveStatus(s, NOW), 'vencida');
  assert.equal(canOperate('vencida'), true);
  const late = sub({ currentPeriodEnd: new Date(NOW - 8 * DAY).toISOString() });
  assert.equal(effectiveStatus(late, NOW), 'suspendida');
  assert.equal(canOperate('suspendida'), false);
});

test('suspendida o cancelada a mano manda sobre las fechas', () => {
  assert.equal(effectiveStatus(sub({ status: 'suspendida' }), NOW), 'suspendida');
  assert.equal(effectiveStatus(sub({ status: 'cancelada' }), NOW), 'cancelada');
  assert.equal(canOperate('cancelada'), false);
});

test('el cobro del plan suma las unidades extra y el anual cobra 10 meses', () => {
  const plan = findPlan('roomia-1')!;
  assert.equal(planCharge('plan', plan, 8, 'mensual'), plan.price);
  assert.equal(planCharge('plan', plan, 12, 'mensual'), plan.price + 2 * plan.extraUnit);
  assert.equal(planCharge('plan', plan, 8, 'anual'), plan.price * 10);
  assert.equal(planCharge('puesta_en_marcha', plan, 50, 'anual'), SETUP_FEE);
  assert.equal(findPlan('no-existe'), undefined);
  assert.equal(PLANS.length, 3);
});

test('pagar suma el período desde hoy o desde lo ya pagado', () => {
  const fromToday = new Date(extendPeriod(null, 'mensual', NOW));
  assert.equal(fromToday.getUTCMonth(), 11);
  const ahead = new Date(NOW + 20 * DAY).toISOString();
  const fromAhead = new Date(extendPeriod(ahead, 'anual', NOW));
  assert.equal(fromAhead.getTime(), new Date(new Date(ahead).setUTCFullYear(2027)).getTime());
  const expired = new Date(NOW - 40 * DAY).toISOString();
  assert.equal(new Date(extendPeriod(expired, 'mensual', NOW)).getTime(), fromToday.getTime());
});
