import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, formatRentalMonths, getRentalMinMonths, isRentalProperty, rentalDurationOptions, rentalPricing } from '../src/utils/rental.ts';

test('addMonths suma meses y ajusta el fin de mes', () => {
  assert.equal(addMonths('2026-11-14', 3), '2027-02-14');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-14', 12), '2027-11-14');
  assert.equal(addMonths('', 3), '');
});

test('getRentalMinMonths usa 3 por defecto y respeta el del dueño', () => {
  assert.equal(getRentalMinMonths({}), 3);
  assert.equal(getRentalMinMonths({ detallesInmueble: { minimoMesesAlquiler: 12 } }), 12);
  assert.equal(getRentalMinMonths({ detallesInmueble: { minimoMesesAlquiler: 0 } }), 3);
});

test('rentalDurationOptions empieza en el mínimo', () => {
  assert.deepEqual(rentalDurationOptions(6).map(o => o.months), [6, 7, 8, 9, 10, 11, 12, 18, 24, 36]);
  assert.equal(rentalDurationOptions(12)[0].label, '1 año (mínimo)');
  assert.equal(rentalDurationOptions(12)[1].label, '1 año y 6 meses');
});

test('formatRentalMonths', () => {
  assert.equal(formatRentalMonths(1), '1 mes');
  assert.equal(formatRentalMonths(3), '3 meses');
  assert.equal(formatRentalMonths(24), '2 años');
});

test('isRentalProperty', () => {
  assert.equal(isRentalProperty({ tipoEstablecimiento: 'casa', finalidad: 'alquiler' }), true);
  assert.equal(isRentalProperty({ tipoEstablecimiento: 'casa', finalidad: 'venta' }), false);
  assert.equal(isRentalProperty({ tipoEstablecimiento: 'hotel', finalidad: 'alquiler' }), false);
});

test('rentalPricing: mensualidad + garantía, IVA solo sobre la mensualidad', () => {
  // IVA 15 % sumado a la mensualidad
  assert.deepEqual(rentalPricing(100, true), { mensualidad: 100, garantia: 100, subtotal: 200, tax: 15, total: 215 });
  // Mensualidad con IVA incluido: base 86.96 + IVA 13.04 = 100
  assert.deepEqual(rentalPricing(100, false), { mensualidad: 100, garantia: 100, subtotal: 186.96, tax: 13.04, total: 200 });
});
