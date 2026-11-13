/**
 * Métricas del dashboard. Funciones puras (sin React ni Supabase) para poder probarlas.
 *
 * Definiciones (las mismas que se explican en los tooltips del dashboard):
 *  · Unidad: una habitación, o una casa/departamento completo en alquiler.
 *  · Noches disponibles = unidades × días del período.
 *  · Noches vendidas por Roomia: reservas confirmadas, ocupadas o finalizadas (las pendientes de
 *    pago NO cuentan). La salida es exclusiva: una reserva del 10 al 15 ocupa 5 noches.
 *  · Ocupación = (noches de Roomia + noches bloqueadas por otras plataformas) / noches disponibles.
 *  · Ingreso de hospedaje = subtotal sin IVA, repartido por noche (se reconoce al pasar la noche).
 *  · ADR = ingreso / noches vendidas por Roomia.
 *  · RevPAR = ingreso / (noches disponibles − noches vendidas en otras plataformas): de Airbnb y
 *    Booking se conocen las noches pero no el dinero, por eso se excluyen del denominador.
 */
import type { ExternalBlock, Hotel, IcalFeed, IcalPlatform, Reservation, Review, Room } from '../types.ts';
import { daysBetween, eachDay, fullPropertyRoomId, overlapNights, shiftDate } from './availability.ts';

const PLACEHOLDER_GUEST_ID = '__ocupado__';
const DAY_MS = 86_400_000;

export const PLATFORM_NAMES: Record<IcalPlatform, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  otro: 'Otro calendario'
};

export interface DashboardInput {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  externalBlocks: ExternalBlock[];
  reviews: Review[];
  icalFeeds: IcalFeed[];
  /** '' = todos los hoteles recibidos */
  hotelId: string;
  /** "YYYY-MM-DD" */
  today: string;
  /** milisegundos "ahora" (para vencimientos); por defecto Date.now() */
  nowMs?: number;
}

// -----------------------------------------------------------------------------
// Períodos
// -----------------------------------------------------------------------------
export type PeriodPreset = 'hoy' | '7d' | 'mes' | 'anio' | 'custom';

export interface Period {
  from: string;
  to: string;
}

export interface ResolvedPeriod {
  current: Period;
  previous: Period;
  days: number;
  label: string;
  compareLabel: string;
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function resolvePeriod(preset: PeriodPreset, today: string, custom?: Period): ResolvedPeriod {
  const finish = (current: Period, previous: Period, label: string, compareLabel: string): ResolvedPeriod => ({
    current,
    previous,
    days: daysBetween(current.from, current.to) + 1,
    label,
    compareLabel
  });

  if (preset === 'hoy') {
    const y = shiftDate(today, -1);
    return finish({ from: today, to: today }, { from: y, to: y }, 'Hoy', 'ayer');
  }

  if (preset === '7d') {
    return finish(
      { from: shiftDate(today, -6), to: today },
      { from: shiftDate(today, -13), to: shiftDate(today, -7) },
      'Últimos 7 días',
      'los 7 días previos'
    );
  }

  if (preset === 'mes') {
    const [y, m, d] = today.split('-').map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const pd = Math.min(d, lastDayOfMonth(py, pm));
    return finish(
      { from: `${y}-${pad2(m)}-01`, to: today },
      { from: `${py}-${pad2(pm)}-01`, to: `${py}-${pad2(pm)}-${pad2(pd)}` },
      'Este mes',
      'mes anterior'
    );
  }

  if (preset === 'anio') {
    const [y, m, d] = today.split('-').map(Number);
    const pd = Math.min(d, lastDayOfMonth(y - 1, m));
    return finish(
      { from: `${y}-01-01`, to: today },
      { from: `${y - 1}-01-01`, to: `${y - 1}-${pad2(m)}-${pad2(pd)}` },
      'Este año',
      'año anterior'
    );
  }

  let from = custom?.from || today;
  let to = custom?.to || today;
  if (from > to) [from, to] = [to, from];
  const len = daysBetween(from, to) + 1;
  return finish(
    { from, to },
    { from: shiftDate(from, -len), to: shiftDate(from, -1) },
    'Período personalizado',
    'período anterior'
  );
}

// -----------------------------------------------------------------------------
// Unidades
// -----------------------------------------------------------------------------
export interface Unit {
  id: string;
  hotelId: string;
  label: string;
  hotelName: string;
}

export const isPropertyHotel = (h: Hotel): boolean =>
  h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento';

/** Habitaciones de los hoteles, y casas/departamentos en alquiler como una unidad completa. */
export function getUnits(hotels: Hotel[], rooms: Room[], hotelId: string = ''): Unit[] {
  const units: Unit[] = [];
  for (const h of hotels) {
    if (hotelId && h.id !== hotelId) continue;
    if (h.estado === 'inactivo') continue;
    if (isPropertyHotel(h)) {
      if (h.finalidad === 'venta') continue;
      units.push({ id: fullPropertyRoomId(h.id), hotelId: h.id, label: h.nombre, hotelName: h.nombre });
    } else {
      for (const r of rooms) {
        if (r.hotelId !== h.id) continue;
        units.push({ id: r.id, hotelId: h.id, label: `${h.nombre} · ${r.nombre}`, hotelName: h.nombre });
      }
    }
  }
  return units;
}

// -----------------------------------------------------------------------------
// Reservas
// -----------------------------------------------------------------------------
export const reservationUnitId = (r: Reservation): string => r.roomId || fullPropertyRoomId(r.hotelId);

const isRealReservation = (r: Reservation): boolean =>
  r.guestId !== PLACEHOLDER_GUEST_ID && r.reservationType !== 'venta';

const isSold = (r: Reservation): boolean =>
  r.estado === 'confirmada' || r.estado === 'ocupada' || r.estado === 'finalizada';

/** Ingreso de hospedaje de la reserva sin IVA. */
export function reservationRevenueBase(r: Reservation): number {
  if (r.subtotal > 0) return r.subtotal;
  return Math.max(0, (r.total || 0) - (r.impuestos || 0));
}

/** Instante en que vence una reserva pendiente de pago (24 h después de crearse). */
export function pendingExpiryMs(r: Reservation): number {
  const created = r.fechaRegistroTimestamp
    ? Date.parse(r.fechaRegistroTimestamp)
    : Date.parse(`${r.fechaRegistro || ''}T00:00:00`);
  return (isFinite(created) ? created : 0) + DAY_MS;
}

interface UnitNights {
  roomia: Set<string>;
  web: Set<string>;
  recepcion: Set<string>;
  external: Map<IcalPlatform, Set<string>>;
  revenue: number;
  revenuePending: number;
}

interface Analysis {
  units: Unit[];
  byUnit: Map<string, UnitNights>;
}

function analyze(input: DashboardInput, from: string, to: string): Analysis {
  const units = getUnits(input.hotels, input.rooms, input.hotelId);
  const byUnit = new Map<string, UnitNights>();
  for (const u of units) {
    byUnit.set(u.id, {
      roomia: new Set(),
      web: new Set(),
      recepcion: new Set(),
      external: new Map(),
      revenue: 0,
      revenuePending: 0
    });
  }

  for (const r of input.reservations) {
    if (!isRealReservation(r)) continue;
    const acc = byUnit.get(reservationUnitId(r));
    if (!acc) continue;

    const sold = isSold(r);
    const pending = r.estado === 'pendiente';
    if (!sold && !pending) continue;

    const total = daysBetween(r.fechaEntrada, r.fechaSalida);
    if (!(total > 0)) continue;
    const inPeriod = overlapNights(r.fechaEntrada, r.fechaSalida, from, to);
    if (inPeriod === 0) continue;

    const perNight = reservationRevenueBase(r) / total;
    if (pending) {
      acc.revenuePending += perNight * inPeriod;
      continue;
    }

    acc.revenue += perNight * inPeriod;
    const start = r.fechaEntrada > from ? r.fechaEntrada : from;
    for (let i = 0; i < inPeriod; i++) {
      const night = shiftDate(start, i);
      acc.roomia.add(night);
      (r.recepcionistaId ? acc.recepcion : acc.web).add(night);
    }
  }

  for (const b of input.externalBlocks) {
    const acc = byUnit.get(b.roomId);
    if (!acc) continue;
    const inPeriod = overlapNights(b.fechaInicio, b.fechaFin, from, to);
    if (inPeriod === 0) continue;
    let set = acc.external.get(b.platform);
    if (!set) {
      set = new Set();
      acc.external.set(b.platform, set);
    }
    const start = b.fechaInicio > from ? b.fechaInicio : from;
    for (let i = 0; i < inPeriod; i++) set.add(shiftDate(start, i));
  }

  return { units, byUnit };
}

/** Noches bloqueadas por otras plataformas que Roomia no vendió (evita contar dos veces). */
function externalOnlyNights(acc: UnitNights): Map<IcalPlatform, Set<string>> {
  const out = new Map<IcalPlatform, Set<string>>();
  const seen = new Set<string>();
  for (const [platform, nights] of acc.external) {
    const only = new Set<string>();
    for (const n of nights) {
      if (acc.roomia.has(n) || seen.has(n)) continue;
      seen.add(n);
      only.add(n);
    }
    out.set(platform, only);
  }
  return out;
}

const sumSizes = (m: Map<unknown, Set<string>>): number => {
  let n = 0;
  for (const s of m.values()) n += s.size;
  return n;
};

// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------
export interface Kpis {
  days: number;
  units: number;
  availableNights: number;
  roomiaNights: number;
  externalNights: number;
  occupiedNights: number;
  /** 0-100, null si no hay unidades */
  occupancy: number | null;
  revenue: number;
  revenuePending: number;
  adr: number | null;
  revpar: number | null;
  created: number;
  cancelled: number;
  cancellationRate: number | null;
}

export function computeKpis(input: DashboardInput, period: Period): Kpis {
  const days = daysBetween(period.from, period.to) + 1;
  const { units, byUnit } = analyze(input, period.from, period.to);

  let roomiaNights = 0;
  let externalNights = 0;
  let revenue = 0;
  let revenuePending = 0;
  for (const acc of byUnit.values()) {
    roomiaNights += acc.roomia.size;
    externalNights += sumSizes(externalOnlyNights(acc));
    revenue += acc.revenue;
    revenuePending += acc.revenuePending;
  }

  const availableNights = units.length * days;
  const occupiedNights = roomiaNights + externalNights;
  const sellable = availableNights - externalNights;

  const hotelIds = new Set(units.map(u => u.hotelId));
  let created = 0;
  let cancelled = 0;
  for (const r of input.reservations) {
    if (!isRealReservation(r) || !hotelIds.has(r.hotelId)) continue;
    const day = (r.fechaRegistro || '').slice(0, 10);
    if (!day || day < period.from || day > period.to) continue;
    created++;
    if (r.estado === 'cancelada') cancelled++;
  }

  return {
    days,
    units: units.length,
    availableNights,
    roomiaNights,
    externalNights,
    occupiedNights,
    occupancy: availableNights > 0 ? Math.min(100, (occupiedNights / availableNights) * 100) : null,
    revenue,
    revenuePending,
    adr: roomiaNights > 0 ? revenue / roomiaNights : null,
    revpar: sellable > 0 ? revenue / sellable : null,
    created,
    cancelled,
    cancellationRate: created > 0 ? (cancelled / created) * 100 : null
  };
}

export type Delta = { kind: 'pts' | 'pct'; value: number } | null;

/** Variación contra el período anterior: puntos para porcentajes, % para dinero. */
export function computeDelta(current: number | null, previous: number | null, kind: 'pts' | 'pct'): Delta {
  if (current === null || previous === null) return null;
  if (kind === 'pts') return { kind, value: current - previous };
  if (previous === 0) return current === 0 ? { kind, value: 0 } : null;
  return { kind, value: ((current - previous) / previous) * 100 };
}

export interface KpiSeries {
  occupancy: number[];
  adr: number[];
  revpar: number[];
  revenue: number[];
  cancellation: number[];
}

/** Serie por tramos para las mini-gráficas (vacía si el período es de un solo día). */
export function kpiSeries(input: DashboardInput, period: Period, maxBuckets = 8): KpiSeries {
  const days = daysBetween(period.from, period.to) + 1;
  const empty: KpiSeries = { occupancy: [], adr: [], revpar: [], revenue: [], cancellation: [] };
  if (days < 2) return empty;

  const size = Math.max(1, Math.ceil(days / maxBuckets));
  const out = { ...empty, occupancy: [] as number[], adr: [] as number[], revpar: [] as number[], revenue: [] as number[], cancellation: [] as number[] };
  for (let start = 0; start < days; start += size) {
    const from = shiftDate(period.from, start);
    const toCandidate = shiftDate(period.from, Math.min(days - 1, start + size - 1));
    const k = computeKpis(input, { from, to: toCandidate });
    out.occupancy.push(k.occupancy ?? 0);
    out.adr.push(k.adr ?? 0);
    out.revpar.push(k.revpar ?? 0);
    out.revenue.push(k.revenue);
    out.cancellation.push(k.cancellationRate ?? 0);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Ocupación diaria y previsión
// -----------------------------------------------------------------------------
export interface DailyPoint {
  date: string;
  occupiedUnits: number;
  units: number;
  pct: number;
  forecast: boolean;
}

export function dailySeries(input: DashboardInput, from: string, to: string): DailyPoint[] {
  const { units, byUnit } = analyze(input, from, to);
  const counts = new Map<string, number>();
  for (const acc of byUnit.values()) {
    const nights = new Set<string>(acc.roomia);
    for (const set of acc.external.values()) for (const n of set) nights.add(n);
    for (const n of nights) counts.set(n, (counts.get(n) || 0) + 1);
  }
  return eachDay(from, to).map(date => {
    const occupiedUnits = counts.get(date) || 0;
    return {
      date,
      occupiedUnits,
      units: units.length,
      pct: units.length > 0 ? Math.min(100, (occupiedUnits / units.length) * 100) : 0,
      forecast: date > input.today
    };
  });
}

export interface ForecastSummary {
  averagePct: number | null;
  peak: DailyPoint | null;
}

export function summarizeForecast(points: DailyPoint[]): ForecastSummary {
  const future = points.filter(p => p.forecast);
  if (future.length === 0) return { averagePct: null, peak: null };
  const averagePct = future.reduce((s, p) => s + p.pct, 0) / future.length;
  const peak = future.reduce((best, p) => (p.pct > best.pct ? p : best), future[0]);
  return { averagePct, peak };
}

// -----------------------------------------------------------------------------
// Origen de las reservas
// -----------------------------------------------------------------------------
export interface SourceRow {
  key: 'web' | 'recepcion' | IcalPlatform;
  label: string;
  nights: number;
  pct: number;
}

export function sourceMix(input: DashboardInput, period: Period): SourceRow[] {
  const { byUnit } = analyze(input, period.from, period.to);
  let web = 0;
  let recepcion = 0;
  const ext: Record<IcalPlatform, number> = { airbnb: 0, booking: 0, otro: 0 };
  for (const acc of byUnit.values()) {
    web += acc.web.size;
    recepcion += acc.recepcion.size;
    for (const [platform, only] of externalOnlyNights(acc)) ext[platform] += only.size;
  }
  const total = web + recepcion + ext.airbnb + ext.booking + ext.otro;
  const row = (key: SourceRow['key'], label: string, nights: number): SourceRow => ({
    key,
    label,
    nights,
    pct: total > 0 ? (nights / total) * 100 : 0
  });
  const rows = [
    row('web', 'Web de Roomia', web),
    row('recepcion', 'Recepción', recepcion),
    row('airbnb', PLATFORM_NAMES.airbnb, ext.airbnb),
    row('booking', PLATFORM_NAMES.booking, ext.booking),
    row('otro', PLATFORM_NAMES.otro, ext.otro)
  ];
  // "Otro calendario" solo aparece si tiene noches
  return rows.filter(r => r.key !== 'otro' || r.nights > 0);
}

// -----------------------------------------------------------------------------
// Valoraciones
// -----------------------------------------------------------------------------
export interface ReviewsSummary {
  average: number | null;
  count: number;
  /** índice 0 = 5 estrellas ... 4 = 1 estrella, en porcentaje */
  distribution: number[];
  deltaAverage: number | null;
}

export function reviewsSummary(input: DashboardInput, windowDays = 90): ReviewsSummary {
  const hotelIds = new Set(getUnits(input.hotels, input.rooms, input.hotelId).map(u => u.hotelId));
  const mine = input.reviews.filter(r => hotelIds.has(r.hotelId));
  const from = shiftDate(input.today, -(windowDays - 1));
  const prevFrom = shiftDate(from, -windowDays);
  const prevTo = shiftDate(from, -1);

  const cur = mine.filter(r => r.fecha >= from && r.fecha <= input.today);
  const prev = mine.filter(r => r.fecha >= prevFrom && r.fecha <= prevTo);
  const avg = (list: Review[]) => (list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : null);

  const counts = [0, 0, 0, 0, 0];
  for (const r of cur) {
    const idx = 5 - Math.min(5, Math.max(1, Math.round(r.rating)));
    counts[idx]++;
  }
  const a = avg(cur);
  const p = avg(prev);
  return {
    average: a,
    count: cur.length,
    distribution: counts.map(c => (cur.length ? (c / cur.length) * 100 : 0)),
    deltaAverage: a !== null && p !== null ? a - p : null
  };
}

// -----------------------------------------------------------------------------
// Rendimiento por unidad
// -----------------------------------------------------------------------------
export interface UnitRow {
  unit: Unit;
  occupancy: number | null;
  adr: number | null;
  revpar: number | null;
  revenue: number;
  rating: number | null;
  reviewCount: number;
}

export function unitPerformance(input: DashboardInput, period: Period): UnitRow[] {
  const days = daysBetween(period.from, period.to) + 1;
  const { units, byUnit } = analyze(input, period.from, period.to);

  const ratingByHotel = new Map<string, { sum: number; n: number }>();
  for (const r of input.reviews) {
    const cur = ratingByHotel.get(r.hotelId) || { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n++;
    ratingByHotel.set(r.hotelId, cur);
  }

  return units
    .map(unit => {
      const acc = byUnit.get(unit.id)!;
      const ext = sumSizes(externalOnlyNights(acc));
      const roomia = acc.roomia.size;
      const sellable = days - ext;
      const rating = ratingByHotel.get(unit.hotelId);
      return {
        unit,
        occupancy: days > 0 ? Math.min(100, ((roomia + ext) / days) * 100) : null,
        adr: roomia > 0 ? acc.revenue / roomia : null,
        revpar: sellable > 0 ? acc.revenue / sellable : null,
        revenue: acc.revenue,
        rating: rating ? rating.sum / rating.n : null,
        reviewCount: rating ? rating.n : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue || a.unit.label.localeCompare(b.unit.label));
}

// -----------------------------------------------------------------------------
// Hoy
// -----------------------------------------------------------------------------
export interface TodayArrival {
  reservation: Reservation;
  unitLabel: string;
  nights: number;
}

export interface TodaySummary {
  arrivals: TodayArrival[];
  arrivalsCount: number;
  departures: number;
  inHouse: number;
  maintenance: number;
  pendingPayments: number;
  pendingAmount: number;
  pendingExpiringIn24h: number;
  pendingExpiringAmount: number;
}

export function todaySummary(input: DashboardInput): TodaySummary {
  const units = getUnits(input.hotels, input.rooms, input.hotelId);
  const unitById = new Map(units.map(u => [u.id, u]));
  const hotelIds = new Set(units.map(u => u.hotelId));
  const nowMs = input.nowMs ?? Date.now();

  const arrivals: TodayArrival[] = [];
  let departures = 0;
  let inHouse = 0;
  let pendingPayments = 0;
  let pendingAmount = 0;
  let pendingExpiringIn24h = 0;
  let pendingExpiringAmount = 0;

  for (const r of input.reservations) {
    if (!isRealReservation(r) || !hotelIds.has(r.hotelId)) continue;
    const unit = unitById.get(reservationUnitId(r));

    if (r.fechaEntrada === input.today && (r.estado === 'pendiente' || r.estado === 'confirmada' || r.estado === 'ocupada')) {
      arrivals.push({
        reservation: r,
        unitLabel: unit ? unit.label : 'Unidad',
        nights: Math.max(1, daysBetween(r.fechaEntrada, r.fechaSalida))
      });
    }
    if (r.fechaSalida === input.today && (r.estado === 'ocupada' || r.estado === 'finalizada')) departures++;
    if (r.estado === 'ocupada') inHouse++;

    if (r.estado === 'pendiente' && r.fechaSalida >= input.today) {
      pendingPayments++;
      pendingAmount += r.total || 0;
      const left = pendingExpiryMs(r) - nowMs;
      if (left <= DAY_MS) {
        pendingExpiringIn24h++;
        pendingExpiringAmount += r.total || 0;
      }
    }
  }

  arrivals.sort((a, b) => a.reservation.id.localeCompare(b.reservation.id));
  const maintenance = input.rooms.filter(r => hotelIds.has(r.hotelId) && r.estado === 'mantenimiento').length;

  return {
    arrivals: arrivals.slice(0, 5),
    arrivalsCount: arrivals.length,
    departures,
    inHouse,
    maintenance,
    pendingPayments,
    pendingAmount,
    pendingExpiringIn24h,
    pendingExpiringAmount
  };
}

// -----------------------------------------------------------------------------
// Requiere atención
// -----------------------------------------------------------------------------
export type AttentionTab = 'reservations' | 'rooms' | 'incidents' | 'logs' | 'properties';

export interface AttentionItem {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  kind: 'conflict' | 'expiring' | 'sync' | 'checkout' | 'maintenance';
  title: string;
  detail: string;
  tab: AttentionTab;
  actionLabel: string;
}

function agoText(iso: string | null, nowMs: number): string {
  if (!iso) return 'nunca';
  const min = Math.floor((nowMs - Date.parse(iso)) / 60000);
  if (!isFinite(min) || min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function attentionItems(input: DashboardInput): AttentionItem[] {
  const nowMs = input.nowMs ?? Date.now();
  const units = getUnits(input.hotels, input.rooms, input.hotelId);
  const unitById = new Map(units.map(u => [u.id, u]));
  const hotelIds = new Set(units.map(u => u.hotelId));
  const items: AttentionItem[] = [];

  // 1. Posibles dobles reservas con plataformas externas
  const conflicts = input.externalBlocks.filter(b => b.conflict && hotelIds.has(b.hotelId));
  if (conflicts.length > 0) {
    const first = conflicts[0];
    const unit = unitById.get(first.roomId);
    items.push({
      id: 'conflict',
      severity: 'danger',
      kind: 'conflict',
      title:
        conflicts.length === 1
          ? `Posible doble reserva con ${PLATFORM_NAMES[first.platform]}`
          : `${conflicts.length} posibles dobles reservas con plataformas externas`,
      detail: `${unit ? unit.label : 'Unidad'} · ${first.fechaInicio} al ${first.fechaFin} · coincide con una reserva de Roomia`,
      tab: 'reservations',
      actionLabel: 'Revisar'
    });
  }

  // 2. Reservas pendientes de pago por vencer (se cancelan solas a las 24 h)
  const expiring = input.reservations.filter(r =>
    isRealReservation(r) &&
    hotelIds.has(r.hotelId) &&
    r.estado === 'pendiente' &&
    r.fechaSalida >= input.today &&
    pendingExpiryMs(r) - nowMs <= 6 * 3600 * 1000
  );
  if (expiring.length > 0) {
    items.push({
      id: 'expiring',
      severity: 'warning',
      kind: 'expiring',
      title: `${plural(expiring.length, 'reserva pendiente de pago vence', 'reservas pendientes de pago vencen')} en menos de 6 h`,
      detail: 'Si no se paga, se cancela sola y la habitación queda libre.',
      tab: 'reservations',
      actionLabel: 'Ver reservas'
    });
  }

  // 3. Calendarios externos sin sincronizar
  const staleMs = 2 * 3600 * 1000;
  const badFeeds = input.icalFeeds.filter(f => {
    if (!f.importUrl || !hotelIds.has(f.hotelId)) return false;
    if (f.lastStatus === 'error') return true;
    return f.lastStatus === 'ok' && f.lastSyncedAt !== null && nowMs - Date.parse(f.lastSyncedAt) > staleMs;
  });
  if (badFeeds.length > 0) {
    const f = badFeeds[0];
    const unit = unitById.get(f.roomId || fullPropertyRoomId(f.hotelId));
    items.push({
      id: 'sync',
      severity: 'warning',
      kind: 'sync',
      title:
        badFeeds.length === 1
          ? `${PLATFORM_NAMES[f.platform]} sin sincronizar desde ${agoText(f.lastSyncedAt, nowMs)}`
          : `${badFeeds.length} calendarios externos sin sincronizar`,
      detail: `${unit ? unit.label : 'Unidad'} · ${f.lastStatus === 'error' && f.lastError ? f.lastError : 'hace más de 2 horas sin leerse'}`,
      tab: f.roomId ? 'rooms' : 'properties',
      actionLabel: 'Ver calendario'
    });
  }

  // 4. Salidas vencidas sin check-out
  const overdue = input.reservations.filter(r =>
    isRealReservation(r) && hotelIds.has(r.hotelId) && r.estado === 'ocupada' && r.fechaSalida < input.today
  );
  if (overdue.length > 0) {
    items.push({
      id: 'checkout',
      severity: 'warning',
      kind: 'checkout',
      title: `${plural(overdue.length, 'check-out pendiente', 'check-outs pendientes')}`,
      detail: 'Estadías con fecha de salida pasada que siguen marcadas como ocupadas.',
      tab: 'reservations',
      actionLabel: 'Resolver'
    });
  }

  // 5. Habitaciones en mantenimiento
  const maintenance = input.rooms.filter(r => hotelIds.has(r.hotelId) && r.estado === 'mantenimiento');
  if (maintenance.length > 0) {
    items.push({
      id: 'maintenance',
      severity: 'info',
      kind: 'maintenance',
      title: `${plural(maintenance.length, 'habitación en mantenimiento', 'habitaciones en mantenimiento')}`,
      detail: maintenance.slice(0, 3).map(r => `Cuarto ${r.numero}`).join(', '),
      tab: 'incidents',
      actionLabel: 'Abrir'
    });
  }

  return items;
}

// -----------------------------------------------------------------------------
// Huéspedes recurrentes
// -----------------------------------------------------------------------------
export interface FrequentGuest {
  guestId: string;
  stays: number;
}

/** Huéspedes con 2 o más estadías confirmadas, ocupadas o finalizadas. */
export function frequentGuests(input: DashboardInput, limit = 6): FrequentGuest[] {
  const hotelIds = new Set(getUnits(input.hotels, input.rooms, input.hotelId).map(u => u.hotelId));
  const counts = new Map<string, number>();
  for (const r of input.reservations) {
    if (!isRealReservation(r) || !isSold(r) || !hotelIds.has(r.hotelId) || !r.guestId) continue;
    counts.set(r.guestId, (counts.get(r.guestId) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, stays]) => stays >= 2)
    .map(([guestId, stays]) => ({ guestId, stays }))
    .sort((a, b) => b.stays - a.stays)
    .slice(0, limit);
}

/** ¿Hay algún dato con el que dibujar el dashboard? */
export function hasAnyActivity(input: DashboardInput): boolean {
  const units = new Set(getUnits(input.hotels, input.rooms, input.hotelId).map(u => u.hotelId));
  return (
    input.reservations.some(r => isRealReservation(r) && units.has(r.hotelId)) ||
    input.externalBlocks.some(b => units.has(b.hotelId))
  );
}
