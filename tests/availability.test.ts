import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangesOverlap, shiftDate, occupiedNights, isRangeFree } from '../src/utils/availability.ts';

test('el día de salida queda libre para otra entrada', () => {
  assert.equal(rangesOverlap('2027-03-10', '2027-03-15', '2027-03-15', '2027-03-18'), false);
  assert.equal(rangesOverlap('2027-03-10', '2027-03-15', '2027-03-14', '2027-03-18'), true);
  assert.equal(rangesOverlap('2027-03-10', '2027-03-15', '2027-03-05', '2027-03-10'), false);
  assert.equal(rangesOverlap('2027-03-10', '2027-03-15', '2027-03-11', '2027-03-12'), true);
});

test('shiftDate cruza meses y años', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2027-03-01', -1), '2027-02-28');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
});

test('occupiedNights cuenta noches, no el día de salida', () => {
  const nights = occupiedNights([{ fechaEntrada: '2027-03-10', fechaSalida: '2027-03-13' }]);
  assert.deepEqual([...nights].sort(), ['2027-03-10', '2027-03-11', '2027-03-12']);
  assert.equal(nights.has('2027-03-13'), false);
});

test('occupiedNights ignora rangos inválidos y limita los muy largos', () => {
  assert.equal(occupiedNights([{ fechaEntrada: '2027-03-10', fechaSalida: '2027-03-10' }]).size, 0);
  assert.equal(occupiedNights([{ fechaEntrada: '2027-03-10', fechaSalida: '2027-03-01' }]).size, 0);
  assert.equal(occupiedNights([{ fechaEntrada: '', fechaSalida: '2027-03-01' }]).size, 0);
  assert.equal(occupiedNights([{ fechaEntrada: '2027-01-01', fechaSalida: '2040-01-01' }]).size, 1100);
});

test('isRangeFree: salida el mismo día que entra otra reserva es válida', () => {
  const nights = occupiedNights([{ fechaEntrada: '2027-03-10', fechaSalida: '2027-03-15' }]);
  assert.equal(isRangeFree(nights, '2027-03-05', '2027-03-10'), true);   // sale el día que entra la otra
  assert.equal(isRangeFree(nights, '2027-03-15', '2027-03-18'), true);   // entra el día que sale la otra
  assert.equal(isRangeFree(nights, '2027-03-08', '2027-03-11'), false);  // pisa la primera noche
  assert.equal(isRangeFree(nights, '2027-03-14', '2027-03-16'), false);  // pisa la última noche
  assert.equal(isRangeFree(nights, '2027-03-09', '2027-03-16'), false);  // la cubre entera
  assert.equal(isRangeFree(nights, '2027-03-12', '2027-03-12'), false);  // rango vacío
  assert.equal(isRangeFree(nights, '', '2027-03-12'), false);
});
