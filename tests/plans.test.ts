import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS, SETUP_FEE, TRIAL_DAYS, annualPerMonth, annualPrice, annualSavings, monthlyCost, planCharge, sriCharge, upgradeBreakEven, usd, usd2
} from '../src/utils/plans.ts';

test('constantes de la oferta', () => {
  assert.equal(TRIAL_DAYS, 15);
  assert.equal(SETUP_FEE, 30);
});

test('el plan anual son 10 mensualidades (2 meses gratis)', () => {
  assert.deepEqual(PLANS.map(p => annualPrice(p.price)), [290, 690, 1090]);
  assert.deepEqual(PLANS.map(p => annualPrice(p.old)), [390, 890, 1390]);
  assert.deepEqual(PLANS.map(p => annualSavings(p.price)), [58, 138, 218]);
  assert.equal(annualPerMonth(29), 24.17);
  assert.equal(annualPerMonth(69), 57.5);
});

test('formato de precios', () => {
  assert.equal(usd(29), '$29');
  assert.equal(usd(1.75), '$1.75');
  assert.equal(usd(2), '$2');
  assert.equal(usd(24.166), '$24.17');
  assert.equal(usd2(2), '$2.00');
  assert.equal(usd2(1.5), '$1.50');
});

test('cada plan incluye más que el anterior y la unidad adicional baja al subir de plan', () => {
  for (let i = 1; i < PLANS.length; i++) {
    assert.ok(PLANS[i].props > PLANS[i - 1].props);
    assert.ok(PLANS[i].units > PLANS[i - 1].units);
    assert.ok(PLANS[i].price > PLANS[i - 1].price);
    assert.ok(PLANS[i].extraUnit < PLANS[i - 1].extraUnit);
    assert.ok(PLANS[i].invoice <= PLANS[i - 1].invoice);
  }
  PLANS.forEach(p => assert.ok(p.old > p.price));
});

test('monthlyCost: solo se cobran las unidades que pasan del límite', () => {
  const [r1, r3] = PLANS;
  assert.equal(monthlyCost(r1, 8), 29);
  assert.equal(monthlyCost(r1, 10), 29);
  assert.equal(monthlyCost(r1, 15), 39);
  assert.equal(monthlyCost(r3, 44), 76);
});

test('pasar al plan siguiente conviene antes de llegar a su límite de unidades', () => {
  for (let i = 0; i < PLANS.length - 1; i++) {
    const breakEven = upgradeBreakEven(PLANS[i], PLANS[i + 1]);
    assert.ok(breakEven > PLANS[i].units, `${PLANS[i].name}: el punto de cambio debe superar sus unidades incluidas`);
    assert.ok(breakEven <= PLANS[i + 1].units, `${PLANS[i].name}: el punto de cambio debe caer dentro del plan siguiente`);
    // en ese punto, quedarse cuesta lo mismo o más que el plan siguiente
    assert.ok(monthlyCost(PLANS[i], breakEven) >= PLANS[i + 1].price);
  }
  assert.equal(upgradeBreakEven(PLANS[0], PLANS[1]), 30);
  assert.equal(upgradeBreakEven(PLANS[1], PLANS[2]), 63);
});

test('planCharge: el módulo SRI se cobra por propiedad: $40 al mes (Roomia 1 y 3) y $30 con Roomia 5', () => {
  const [r1, r3, r5] = PLANS;
  assert.equal(planCharge('plan', r1, 8, 'mensual', 1), 69);
  assert.equal(planCharge('plan', r3, 40, 'mensual', 3), 189);
  assert.equal(planCharge('plan', r5, 100, 'mensual', 1), 139);
  assert.equal(planCharge('plan', r5, 100, 'mensual', 5), 259);
  assert.equal(planCharge('plan', r5, 100, 'anual', 1), 1390);
  assert.equal(planCharge('plan', r1, 8, 'mensual'), 29);
  assert.equal(planCharge('puesta_en_marcha', r1, 8, 'mensual', 1), SETUP_FEE);
  assert.equal(sriCharge(r1, 'mensual'), 40);
  assert.equal(sriCharge(r5, 'mensual'), 30);
  assert.equal(sriCharge(r5, 'anual'), 300);
  assert.equal(sriCharge(r3, 'mensual', 2), 80);
  assert.equal(sriCharge(r1, 'mensual', 0), 0);
});

test('planCharge: la puesta en marcha es un adicional de $30 que no se multiplica en el plan anual', () => {
  const [r1, , r5] = PLANS;
  // Roomia 1 + SRI (1 propiedad) + puesta en marcha = 29 + 40 + 30
  assert.equal(planCharge('plan', r1, 1, 'mensual', 1, true), 99);
  assert.equal(planCharge('plan', r1, 1, 'mensual', 0, true), 59);
  assert.equal(planCharge('plan', r1, 1, 'anual', 1, true), 720);
  assert.equal(planCharge('plan', r5, 100, 'mensual', 1, false), 139);
});
