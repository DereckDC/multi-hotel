import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExternalBlock, Hotel, IcalFeed, Reservation, Review, Room } from '../src/types.ts';
import {
  attentionItems,
  computeDelta,
  computeKpis,
  dailySeries,
  frequentGuests,
  getUnits,
  hasAnyActivity,
  kpiSeries,
  resolvePeriod,
  reviewsSummary,
  sourceMix,
  summarizeForecast,
  todaySummary,
  unitPerformance,
  type DashboardInput
} from '../src/utils/dashboardMetrics.ts';

const TODAY = '2026-11-12';
const NOW = Date.parse('2026-11-12T15:00:00Z');

const hotel = (id: string, extra: Partial<Hotel> = {}): Hotel => ({
  id, nombre: id.toUpperCase(), logo: '', portada: '', imagenes: [], descripcion: '', ubicacion: '',
  coordenadas: { lat: 0, lng: 0 }, servicios: [], politicas: [], horarios: { checkIn: '15:00', checkOut: '12:00' },
  contacto: { telefono: '', email: '' }, redesSociales: {}, estado: 'activo', tipoEstablecimiento: 'hotel', ...extra
});
const room = (id: string, hotelId: string, extra: Partial<Room> = {}): Room => ({
  id, hotelId, numero: id, nombre: `Hab ${id}`, descripcion: '', precio: 100, capacidad: 2, camas: 1, tipo: 'Estándar',
  imagenes: [], servicios: [], estado: 'disponible', ...extra
});
const res = (id: string, extra: Partial<Reservation>): Reservation => ({
  id, hotelId: 'h1', roomId: 'r1', guestId: 'g1', fechaEntrada: '2026-11-08', fechaSalida: '2026-11-12',
  serviciosAdicionales: [], subtotal: 400, impuestos: 64, total: 464, qrCode: '', estado: 'confirmada',
  fechaRegistro: '2026-10-01', ...extra
});
const block = (id: string, extra: Partial<ExternalBlock>): ExternalBlock => ({
  id, feedId: 'f1', hotelId: 'h1', roomId: 'r2', platform: 'airbnb', fechaInicio: '2026-11-05', fechaFin: '2026-11-07',
  summary: 'Reserved', conflict: false, ...extra
});
const feed = (extra: Partial<IcalFeed>): IcalFeed => ({
  id: 'f1', hotelId: 'h1', roomId: 'r1', platform: 'airbnb', importUrl: 'https://x', exportToken: 't', lastStatus: 'ok',
  lastError: null, lastEventCount: 1, consecutiveFailures: 0, lastSyncedAt: '2026-11-12T14:30:00Z', lastAttemptAt: null,
  lastExportAt: null, ...extra
});

const hotels = [
  hotel('h1'),
  hotel('casa', { tipoEstablecimiento: 'casa', finalidad: 'alquiler' }),
  hotel('venta', { tipoEstablecimiento: 'casa', finalidad: 'venta' }),
  hotel('off', { estado: 'inactivo' })
];
const rooms = [room('r1', 'h1'), room('r2', 'h1'), room('x', 'off')];

const base = (over: Partial<DashboardInput> = {}): DashboardInput => ({
  hotels, rooms, reservations: [], externalBlocks: [], reviews: [], icalFeeds: [], hotelId: '', today: TODAY, nowMs: NOW, ...over
});

test('períodos: mes, año, 7 días y personalizado con comparación equivalente', () => {
  const mar = resolvePeriod('mes', '2026-03-31');
  assert.deepEqual(mar.current, { from: '2026-03-01', to: '2026-03-31' });
  assert.deepEqual(mar.previous, { from: '2026-02-01', to: '2026-02-28' }); // febrero no tiene día 31
  assert.equal(mar.days, 31);

  const ene = resolvePeriod('mes', '2026-01-15');
  assert.deepEqual(ene.previous, { from: '2025-12-01', to: '2025-12-15' });

  const anio = resolvePeriod('anio', '2028-02-29');
  assert.deepEqual(anio.previous, { from: '2027-01-01', to: '2027-02-28' });

  const sem = resolvePeriod('7d', TODAY);
  assert.deepEqual(sem.current, { from: '2026-11-06', to: '2026-11-12' });
  assert.deepEqual(sem.previous, { from: '2026-10-30', to: '2026-11-05' });

  const hoy = resolvePeriod('hoy', TODAY);
  assert.deepEqual(hoy.previous, { from: '2026-11-11', to: '2026-11-11' });

  const custom = resolvePeriod('custom', TODAY, { from: '2026-11-10', to: '2026-11-01' });
  assert.deepEqual(custom.current, { from: '2026-11-01', to: '2026-11-10' });
  assert.deepEqual(custom.previous, { from: '2026-10-22', to: '2026-10-31' });
});

test('unidades: habitaciones y casas en alquiler; sin ventas ni hoteles inactivos', () => {
  const units = getUnits(hotels, rooms);
  assert.deepEqual(units.map(u => u.id).sort(), ['r1', 'r2', 'room-full-casa']);
  assert.deepEqual(getUnits(hotels, rooms, 'h1').map(u => u.id).sort(), ['r1', 'r2']);
  assert.equal(getUnits(hotels, rooms, 'off').length, 0);
});

test('KPIs: ocupación, ADR y RevPAR a mano', () => {
  const input = base({
    reservations: [
      res('A', {}),                                          // r1, 8→12 nov, subtotal 400 en 4 noches
      res('P', { roomId: 'r2', estado: 'pendiente' }),       // pendiente: no cuenta como venta
      res('C', { roomId: 'r2', estado: 'cancelada', fechaRegistro: '2026-11-03' }),
      res('N', { roomId: 'r2', fechaEntrada: '2026-11-20', fechaSalida: '2026-11-22', fechaRegistro: '2026-11-02' })
    ],
    externalBlocks: [block('B', {})]                         // r2, noches 5 y 6
  });
  const k = computeKpis(input, { from: '2026-11-01', to: '2026-11-10' });

  assert.equal(k.days, 10);
  assert.equal(k.units, 3);
  assert.equal(k.availableNights, 30);
  assert.equal(k.roomiaNights, 3);          // noches 8, 9 y 10 de la reserva A
  assert.equal(k.externalNights, 2);
  assert.equal(k.occupancy!.toFixed(2), '16.67');
  assert.equal(k.revenue, 300);             // 100 por noche × 3
  assert.equal(k.adr, 100);
  assert.equal(k.revpar!.toFixed(3), (300 / 28).toFixed(3)); // sin las 2 noches de otras plataformas
  assert.equal(k.created, 2);               // C (3 nov) y N (2 nov) nacieron en el período; A y P no
  assert.equal(k.cancelled, 1);
  assert.equal(k.cancellationRate, 50);
});

test('la fecha de salida es exclusiva y las reservas pendientes solo se estiman aparte', () => {
  const input = base({
    reservations: [
      res('A', { fechaEntrada: '2026-11-10', fechaSalida: '2026-11-12', subtotal: 200 }),
      res('P', { roomId: 'r2', estado: 'pendiente', fechaEntrada: '2026-11-10', fechaSalida: '2026-11-12', subtotal: 300 })
    ]
  });
  const k = computeKpis(input, { from: '2026-11-10', to: '2026-11-12' });
  assert.equal(k.roomiaNights, 2);          // noches 10 y 11; el 12 es el día de salida
  assert.equal(k.revenue, 200);
  assert.equal(k.revenuePending, 300);
});

test('una noche bloqueada por otra plataforma y vendida por Roomia no se cuenta dos veces', () => {
  const input = base({
    reservations: [res('A', { fechaEntrada: '2026-11-05', fechaSalida: '2026-11-07' })],
    externalBlocks: [block('B', { roomId: 'r1', fechaInicio: '2026-11-05', fechaFin: '2026-11-08' })]
  });
  const k = computeKpis(input, { from: '2026-11-01', to: '2026-11-10' });
  assert.equal(k.roomiaNights, 2);
  assert.equal(k.externalNights, 1);        // solo la noche del 7
});

test('marcadores anónimos, ventas y reservas de otros hoteles no cuentan', () => {
  const input = base({
    hotelId: 'h1',
    reservations: [
      res('A', {}),
      res('busy', { guestId: '__ocupado__' }),
      res('V', { reservationType: 'venta' }),
      res('Z', { hotelId: 'casa', roomId: 'room-full-casa' })
    ]
  });
  const k = computeKpis(input, { from: '2026-11-08', to: '2026-11-11' });
  assert.equal(k.roomiaNights, 4);
  assert.equal(k.units, 2);
});

test('una casa completa se reconoce con roomId sintético o nulo', () => {
  const input = base({
    hotelId: 'casa',
    reservations: [
      res('S', { hotelId: 'casa', roomId: 'room-full-casa', fechaEntrada: '2026-11-01', fechaSalida: '2026-11-03', subtotal: 300 }),
      res('N', { hotelId: 'casa', roomId: null, fechaEntrada: '2026-11-05', fechaSalida: '2026-11-06', subtotal: 150 })
    ]
  });
  const k = computeKpis(input, { from: '2026-11-01', to: '2026-11-10' });
  assert.equal(k.units, 1);
  assert.equal(k.roomiaNights, 3);
  assert.equal(k.revenue, 450);
});

test('variación: puntos para porcentajes y % para dinero', () => {
  assert.deepEqual(computeDelta(68, 62, 'pts'), { kind: 'pts', value: 6 });
  assert.deepEqual(computeDelta(110, 100, 'pct'), { kind: 'pct', value: 10 });
  assert.equal(computeDelta(50, 0, 'pct'), null);
  assert.deepEqual(computeDelta(0, 0, 'pct'), { kind: 'pct', value: 0 });
  assert.equal(computeDelta(null, 5, 'pts'), null);
});

test('mini-gráficas: tramos del período y vacías si es un solo día', () => {
  const input = base({ reservations: [res('A', {})] });
  const s = kpiSeries(input, { from: '2026-11-01', to: '2026-11-16' }, 8);
  assert.equal(s.occupancy.length, 8);
  assert.equal(kpiSeries(input, { from: TODAY, to: TODAY }).occupancy.length, 0);
});

test('ocupación diaria y previsión: real hasta hoy, prevista después', () => {
  const input = base({
    reservations: [
      res('A', { fechaEntrada: '2026-11-10', fechaSalida: '2026-11-14' }),
      res('F', { roomId: 'r2', fechaEntrada: '2026-11-20', fechaSalida: '2026-11-22' })
    ]
  });
  const pts = dailySeries(input, '2026-11-10', '2026-11-22');
  const byDate = Object.fromEntries(pts.map(p => [p.date, p]));
  assert.equal(byDate['2026-11-10'].occupiedUnits, 1);
  assert.equal(byDate['2026-11-10'].forecast, false);
  assert.equal(byDate['2026-11-13'].occupiedUnits, 1);
  assert.equal(byDate['2026-11-13'].forecast, true);
  assert.equal(byDate['2026-11-14'].occupiedUnits, 0);   // día de salida
  assert.equal(byDate['2026-11-21'].occupiedUnits, 1);
  assert.equal(byDate['2026-11-22'].occupiedUnits, 0);

  const f = summarizeForecast(pts);
  assert.ok(f.averagePct !== null && f.averagePct > 0);
  assert.ok(f.peak !== null && f.peak.pct > 0);
  assert.equal(summarizeForecast([]).averagePct, null);
});

test('origen de las reservas: web, recepción y plataformas', () => {
  const input = base({
    reservations: [
      res('W', { fechaEntrada: '2026-11-01', fechaSalida: '2026-11-04' }),                      // web: 3 noches
      res('R', { roomId: 'r2', fechaEntrada: '2026-11-01', fechaSalida: '2026-11-02', recepcionistaId: 'rec' }) // 1
    ],
    externalBlocks: [block('B', { roomId: 'r1', fechaInicio: '2026-11-06', fechaFin: '2026-11-08' })]            // airbnb: 2
  });
  const mix = sourceMix(input, { from: '2026-11-01', to: '2026-11-10' });
  const get = (k: string) => mix.find(m => m.key === k)!;
  assert.equal(get('web').nights, 3);
  assert.equal(get('recepcion').nights, 1);
  assert.equal(get('airbnb').nights, 2);
  assert.equal(get('booking').nights, 0);
  assert.equal(mix.find(m => m.key === 'otro'), undefined);
  assert.equal(Math.round(get('web').pct), 50);
});

test('valoraciones: promedio, distribución y variación contra los 90 días previos', () => {
  const rv = (id: string, fecha: string, rating: number, hotelId = 'h1'): Review => ({
    id, reservationId: id, hotelId, guestId: 'g', rating, comentario: '', fecha
  });
  const input = base({
    reviews: [
      rv('1', '2026-11-01', 5), rv('2', '2026-10-01', 5), rv('3', '2026-09-20', 4), rv('4', '2026-08-01', 3),
      rv('5', '2026-06-01', 2),  // período previo
      rv('6', '2026-11-02', 1, 'off') // hotel inactivo: no cuenta
    ]
  });
  const s = reviewsSummary(input);
  assert.equal(s.count, 3);
  assert.equal(s.average!.toFixed(2), '4.67');
  assert.equal(Math.round(s.distribution[0]), 67);   // 5 estrellas
  assert.equal(Math.round(s.distribution[1]), 33);   // 4 estrellas
  assert.ok(s.deltaAverage !== null && s.deltaAverage > 0);
  assert.equal(reviewsSummary(base()).average, null);
});

test('requiere atención: conflictos, vencimientos, sincronización, check-outs y mantenimiento', () => {
  const input = base({
    rooms: [room('r1', 'h1', { estado: 'mantenimiento' }), room('r2', 'h1')],
    reservations: [
      res('E', { roomId: 'r2', estado: 'pendiente', fechaRegistroTimestamp: '2026-11-11T12:00:00Z', fechaEntrada: '2026-11-14', fechaSalida: '2026-11-16' }), // vence 12/11 12:00Z → ya vencida
      res('L', { roomId: 'r2', estado: 'pendiente', fechaRegistroTimestamp: '2026-11-12T14:00:00Z', fechaEntrada: '2026-11-20', fechaSalida: '2026-11-22' }), // vence mañana: no
      res('O', { estado: 'ocupada', fechaEntrada: '2026-11-08', fechaSalida: '2026-11-10' })                                                             // salida pasada
    ],
    externalBlocks: [block('B', { conflict: true })],
    icalFeeds: [
      feed({ id: 'bad', lastStatus: 'error', lastError: 'HTTP 404', lastSyncedAt: '2026-11-12T10:00:00Z' }),
      feed({ id: 'ok', roomId: 'r2' })
    ]
  });
  const items = attentionItems(input);
  const kinds = items.map(i => i.kind);
  assert.deepEqual(kinds, ['conflict', 'expiring', 'sync', 'checkout', 'maintenance']);
  assert.equal(items[0].severity, 'danger');
  assert.match(items[0].title, /Airbnb/);
  assert.match(items[1].title, /^1 reserva pendiente de pago vence/);
  assert.match(items[2].detail, /HTTP 404/);
  assert.match(items[3].title, /^1 check-out pendiente/);
  assert.match(items[4].detail, /Cuarto r1/);

  // Sin problemas no hay avisos
  assert.deepEqual(attentionItems(base()), []);
  // Un calendario sin sincronizar desde hace más de 2 h también avisa
  const stale = attentionItems(base({ icalFeeds: [feed({ lastSyncedAt: '2026-11-12T10:00:00Z' })] }));
  assert.equal(stale[0].kind, 'sync');
});

test('hoy: llegadas, salidas, en casa y pagos por vencer', () => {
  const input = base({
    rooms: [room('r1', 'h1', { estado: 'mantenimiento' }), room('r2', 'h1')],
    reservations: [
      res('A1', { fechaEntrada: TODAY, fechaSalida: '2026-11-14', estado: 'confirmada' }),
      res('A2', { roomId: 'r2', fechaEntrada: TODAY, fechaSalida: '2026-11-13', estado: 'pendiente', fechaRegistroTimestamp: '2026-11-12T10:00:00Z', total: 150 }),
      res('D1', { roomId: 'r2', fechaEntrada: '2026-11-09', fechaSalida: TODAY, estado: 'ocupada' }),
      res('H1', { fechaEntrada: '2026-11-10', fechaSalida: '2026-11-15', estado: 'ocupada' }),
      res('X', { fechaEntrada: TODAY, estado: 'cancelada' })
    ]
  });
  const t = todaySummary(input);
  assert.equal(t.arrivalsCount, 2);
  assert.equal(t.arrivals[0].reservation.id, 'A1');
  assert.equal(t.departures, 1);
  assert.equal(t.inHouse, 2);
  assert.equal(t.maintenance, 1);
  assert.equal(t.pendingPayments, 1);
  assert.equal(t.pendingAmount, 150);
  assert.equal(t.pendingExpiringIn24h, 1);
});

test('rendimiento por unidad: ordenado por ingresos', () => {
  const input = base({
    hotelId: 'h1',
    reservations: [
      res('A', { roomId: 'r1', fechaEntrada: '2026-11-01', fechaSalida: '2026-11-05', subtotal: 400 }),
      res('B', { roomId: 'r2', fechaEntrada: '2026-11-01', fechaSalida: '2026-11-03', subtotal: 600 })
    ],
    reviews: [{ id: 'v', reservationId: 'a', hotelId: 'h1', guestId: 'g', rating: 4, comentario: '', fecha: '2026-11-02' }]
  });
  const rows = unitPerformance(input, { from: '2026-11-01', to: '2026-11-10' });
  assert.deepEqual(rows.map(r => r.unit.id), ['r2', 'r1']);
  assert.equal(rows[0].revenue, 600);
  assert.equal(rows[0].adr, 300);
  assert.equal(rows[0].occupancy, 20);
  assert.equal(rows[1].occupancy, 40);
  assert.equal(rows[0].rating, 4);
});

test('huéspedes recurrentes y estado vacío', () => {
  const input = base({
    reservations: [
      res('1', { guestId: 'a' }), res('2', { guestId: 'a', estado: 'finalizada' }), res('3', { guestId: 'a', estado: 'ocupada' }),
      res('4', { guestId: 'b' }), res('5', { guestId: 'b', estado: 'cancelada' }), res('6', { guestId: 'c' }), res('7', { guestId: 'c' })
    ]
  });
  assert.deepEqual(frequentGuests(input), [{ guestId: 'a', stays: 3 }, { guestId: 'c', stays: 2 }]);
  assert.equal(hasAnyActivity(base()), false);
  assert.equal(hasAnyActivity(input), true);
  assert.equal(computeKpis(base({ hotels: [], rooms: [] }), { from: '2026-11-01', to: '2026-11-10' }).occupancy, null);
});
