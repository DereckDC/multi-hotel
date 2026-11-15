import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Hotel, Reservation, Room, User } from '../src/types.ts';
import { buildInvoiceData, formatYmd, parseService } from '../src/utils/invoiceData.ts';

const hotel = { id: 'h1', nombre: 'Eco Glamping', ubicacion: 'Baños', contacto: { telefono: '099', email: 'h@x.com' }, tipoEstablecimiento: 'hotel' } as unknown as Hotel;
const room = { id: 'r1', hotelId: 'h1', numero: '001', nombre: 'Domo Suite', tipo: 'Suite', precio: 70 } as unknown as Room;
const guest = { id: 'u1', nombre: 'Ana', apellido: 'Pérez', email: 'a@x.com', telefono: '098', documento: '0912345678' } as unknown as User;
const res = (over: Partial<Reservation>): Reservation => ({
  id: 'RES-1', hotelId: 'h1', roomId: 'r1', guestId: 'u1', fechaEntrada: '2026-11-20', fechaSalida: '2026-11-23',
  serviciosAdicionales: [], subtotal: 210, impuestos: 33.6, total: 243.6, qrCode: 'QR', estado: 'confirmada',
  fechaRegistro: '2026-11-14', ...over
} as Reservation);

test('parseService toma el nombre y el importe real', () => {
  assert.deepEqual(parseService('Desayuno (2 pers x 3 días - $30.00)'), { nombre: 'Desayuno', detalle: '2 pers x 3 días', importe: 30 });
  assert.deepEqual(parseService('Spa (1 pers - $45)'), { nombre: 'Spa', detalle: '1 pers', importe: 45 });
  assert.equal(parseService('srv-antiguo').importe, 0);
});

test('formatYmd', () => {
  assert.equal(formatYmd('2026-11-25'), '25/11/2026');
  assert.equal(formatYmd('2026-11-25T10:00:00Z'), '25/11/2026');
});

test('hospedaje: las líneas cuadran con el subtotal guardado', () => {
  const d = buildInvoiceData(res({ serviciosAdicionales: ['Desayuno (2 pers x 3 días - $30.00)'], subtotal: 240, impuestos: 38.4, total: 278.4 }), hotel, room, guest);
  assert.equal(d.lineas.length, 2);
  assert.equal(d.lineas[0].importe, 210);
  assert.equal(d.lineas[0].unitario, 70);
  assert.equal(d.lineas[0].cantidad, '3 noches');
  assert.equal(d.lineas[1].descripcion, 'Desayuno');
  assert.equal(d.lineas[1].importe, 30);
  assert.equal(d.lineas.reduce((s, l) => s + l.importe, 0), d.subtotal);
  assert.equal(d.estadia.unidad, 'N° 001 · Domo Suite');
  assert.equal(d.fechaEmision, '14/11/2026');
});

test('hospedaje con tarifa variable: el unitario es el promedio por noche', () => {
  const d = buildInvoiceData(res({ subtotal: 250, impuestos: 40, total: 290 }), hotel, room, guest);
  assert.equal(d.lineas[0].importe, 250);
  assert.equal(d.lineas[0].unitario, 83.33);
});

test('alquiler: mensualidad + garantía y plazo en meses, sin habitación', () => {
  const casa = { ...hotel, id: 'c1', nombre: 'Suite Amoblada', tipoEstablecimiento: 'departamento', finalidad: 'alquiler', detallesInmueble: { habitaciones: 1, banos: 1, precio: 244 } } as unknown as Hotel;
  const d = buildInvoiceData(
    res({ hotelId: 'c1', roomId: 'room-full-c1', fechaEntrada: '2026-11-25', fechaSalida: '2027-11-25', subtotal: 488, impuestos: 39.04, total: 527.04 }),
    casa, undefined, guest
  );
  assert.equal(d.isAlquiler, true);
  assert.equal(d.estadia.unidad, 'Propiedad completa');
  assert.equal(d.estadia.duracion, '1 año');
  assert.deepEqual(d.lineas.map(l => l.importe), [244, 244]);
  assert.equal(d.lineas[0].cantidad, '1 mes');
});

test('alquiler con IVA incluido en el precio', () => {
  const casa = { ...hotel, id: 'c1', tipoEstablecimiento: 'casa', finalidad: 'alquiler', detallesInmueble: { habitaciones: 1, banos: 1, precio: 100 } } as unknown as Hotel;
  const d = buildInvoiceData(res({ hotelId: 'c1', fechaSalida: '2027-05-20', subtotal: 184, impuestos: 16, total: 200 }), casa, undefined, guest);
  assert.deepEqual(d.lineas.map(l => l.importe), [84, 100]);
  assert.equal(d.estadia.duracion, '6 meses');
});

test('estado de pago', () => {
  assert.equal(buildInvoiceData(res({}), hotel, room, guest).pago.titulo, 'PAGADO Y CONFIRMADO');
  const parcial = buildInvoiceData(res({ montoPagado: 48.72, montoPendiente: 194.88 }), hotel, room, guest);
  assert.equal(parcial.pago.titulo, 'RESERVADA CON PAGO PARCIAL');
  assert.equal(parcial.abonado, 48.72);
  assert.equal(parcial.pendiente, 194.88);
  assert.equal(buildInvoiceData(res({ estado: 'pendiente' }), hotel, room, guest).pago.titulo, 'PENDIENTE DE PAGO');
  assert.equal(buildInvoiceData(res({ estado: 'cancelada' }), hotel, room, guest).pago.tono, 'bad');
});
