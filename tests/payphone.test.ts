import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterPayment, allowedKinds, checkConfirmation, makeClientTransactionId, minimumReservationTotal,
  paymentAmounts, readPaymentInfo, sumsUp, toCents
} from '../supabase/functions/payphone/paymentRules.ts';

const pendiente = { estado: 'pendiente', total: 116, impuestos: 16, montoPagado: 0 };

test('allowedKinds según el estado y lo pagado', () => {
  assert.deepEqual(allowedKinds(pendiente), ['reserva_abono', 'reserva_total']);
  assert.deepEqual(allowedKinds({ ...pendiente, estado: 'confirmada', montoPagado: 23.2 }), ['reserva_saldo']);
  assert.deepEqual(allowedKinds({ ...pendiente, estado: 'confirmada', montoPagado: 116 }), []);
  assert.deepEqual(allowedKinds({ ...pendiente, estado: 'cancelada' }), []);
  assert.deepEqual(allowedKinds({ ...pendiente, estado: 'finalizada', montoPagado: 50 }), []);
  assert.deepEqual(allowedKinds({ ...pendiente, total: 0 }), []);
});

test('paymentAmounts: abono, total y saldo cuadran en centavos', () => {
  const abono = paymentAmounts(pendiente, 'reserva_abono');
  assert.ok(!('error' in abono));
  if ('error' in abono) return;
  assert.equal(abono.amount, 2320);
  assert.equal(abono.tax, 320);
  assert.ok(sumsUp(abono));

  const total = paymentAmounts(pendiente, 'reserva_total');
  if ('error' in total) throw new Error(total.error);
  assert.deepEqual(total, { amount: 11600, amountWithTax: 10000, amountWithoutTax: 0, tax: 1600 });

  const saldo = paymentAmounts({ ...pendiente, estado: 'confirmada', montoPagado: 23.2 }, 'reserva_saldo');
  if ('error' in saldo) throw new Error(saldo.error);
  assert.equal(saldo.amount, 9280);
  assert.ok(sumsUp(saldo));
});

test('paymentAmounts: montos con decimales raros siguen cuadrando', () => {
  for (const total of [33.33, 74, 101.01, 999.99, 5.55]) {
    const r = { estado: 'pendiente', total, impuestos: total * 0.16, montoPagado: 0 };
    for (const kind of ['reserva_abono', 'reserva_total'] as const) {
      const a = paymentAmounts(r, kind);
      if ('error' in a) throw new Error(a.error);
      assert.ok(sumsUp(a), `${total} ${kind}`);
    }
  }
});

test('paymentAmounts: sin IVA va como base no gravada', () => {
  const a = paymentAmounts({ estado: 'pendiente', total: 50, impuestos: 0 }, 'reserva_total');
  assert.deepEqual(a, { amount: 5000, amountWithTax: 0, amountWithoutTax: 5000, tax: 0 });
});

test('paymentAmounts: rechaza pagos no permitidos o menores a 1 USD', () => {
  assert.ok('error' in paymentAmounts(pendiente, 'reserva_saldo'));
  assert.ok('error' in paymentAmounts({ estado: 'pendiente', total: 3, impuestos: 0 }, 'reserva_abono'));
});

test('readPaymentInfo y afterPayment', () => {
  assert.deepEqual(readPaymentInfo('hola [PAYMENT_INFO:{"montoPagado":23.2,"montoPendiente":92.8}]'), { montoPagado: 23.2, montoPendiente: 92.8 });
  assert.deepEqual(readPaymentInfo('sin pago'), {});
  assert.deepEqual(readPaymentInfo('[PAYMENT_INFO:roto]'), {});
  assert.deepEqual(afterPayment(116, 0, 2320), { montoPagado: 23.2, montoPendiente: 92.8 });
  assert.deepEqual(afterPayment(116, 23.2, 9280), { montoPagado: 116, montoPendiente: 0 });
  assert.deepEqual(afterPayment(116, 100, 9999), { montoPagado: 116, montoPendiente: 0 });
});

test('minimumReservationTotal', () => {
  assert.equal(minimumReservationTotal({ roomPrice: 50, variationPrices: [40, 80], noches: 3, isRental: false }), 120);
  assert.equal(minimumReservationTotal({ roomPrice: 400, variationPrices: [], noches: 90, isRental: true }), 400);
});

test('makeClientTransactionId: máx. 50 caracteres y sin símbolos', () => {
  const id = makeClientTransactionId('RES-12345', 'a1b2c3d4e5f6g7');
  assert.equal(id, 'RM-RES-12345-a1b2c3d4e5f6');
  assert.ok(makeClientTransactionId('X'.repeat(80), 'z'.repeat(40)).length <= 50);
});

test('checkConfirmation', () => {
  const exp = { clientTransactionId: 'RM-1', amountCents: 2320 };
  assert.equal(checkConfirmation(exp, { statusCode: 3, transactionStatus: 'Approved', clientTransactionId: 'RM-1', amount: 2320 }), 'aprobado');
  assert.equal(checkConfirmation(exp, { statusCode: 3, transactionStatus: 'Approved', clientTransactionId: 'RM-1', amount: 100 }), 'no_coincide');
  assert.equal(checkConfirmation(exp, { statusCode: 3, clientTransactionId: 'RM-2', amount: 2320 }), 'no_coincide');
  assert.equal(checkConfirmation(exp, { statusCode: 2, transactionStatus: 'Canceled', clientTransactionId: 'RM-1', amount: 2320 }), 'cancelado');
  assert.equal(toCents(0.1 + 0.2), 30);
});
