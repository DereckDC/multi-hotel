import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, CheckCircle2, Clock, RefreshCw, Wrench, Info, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import type { ExternalBlock, Hotel, IcalFeed, Reservation, Review, Room, User } from '../types';
import {
  attentionItems,
  computeDelta,
  computeKpis,
  dailySeries,
  frequentGuests,
  hasAnyActivity,
  kpiSeries,
  resolvePeriod,
  reviewsSummary,
  sourceMix,
  summarizeForecast,
  todaySummary,
  unitPerformance,
  type AttentionItem,
  type AttentionTab,
  type Delta,
  type PeriodPreset,
  type DashboardInput
} from '../utils/dashboardMetrics';
import { shiftDate } from '../utils/availability';

interface DashboardViewProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  users: User[];
  reviews: Review[];
  externalBlocks: ExternalBlock[];
  icalFeeds: IcalFeed[];
  hotelFilter: string;
  onHotelFilterChange: (hotelId: string) => void;
  canFilterHotels: boolean;
  onNavigate: (tab: AttentionTab) => void;
}

const PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Año' },
  { id: 'custom', label: 'Rango' }
];

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const localToday = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shortDate = (ymd: string): string => {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

const money = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (Math.abs(v) >= 10000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};

const pct = (v: number | null | undefined): string => (v === null || v === undefined || !isFinite(v) ? '—' : `${Math.round(v)}%`);

const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

const SOURCE_COLORS: Record<string, string> = {
  web: '#0d9488',
  recepcion: '#23B4E6',
  airbnb: '#f43f5e',
  booking: '#1d4ed8',
  otro: '#64748b'
};

// -----------------------------------------------------------------------------
// Piezas pequeñas
// -----------------------------------------------------------------------------
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 48},${20 - ((v - min) / range) * 17 - 1.5}`)
    .join(' ');
  return (
    <svg viewBox="0 0 48 22" width="48" height="22" className="absolute right-3.5 bottom-3.5" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function DeltaChip({ delta, inverse = false, compareLabel }: { delta: Delta; inverse?: boolean; compareLabel: string }) {
  if (!delta) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-neutral-100 text-neutral-500 w-fit" title={`Sin datos de ${compareLabel} para comparar`}>
        <Minus className="w-3 h-3" /> sin comparar
      </span>
    );
  }
  const flat = Math.abs(delta.value) < 0.05;
  const up = delta.value > 0;
  const good = flat ? null : inverse ? !up : up;
  const cls = flat
    ? 'bg-neutral-100 text-neutral-600'
    : good
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-red-100 text-red-700';
  const text = delta.kind === 'pts'
    ? `${Math.abs(delta.value).toFixed(Math.abs(delta.value) < 10 ? 1 : 0)} pts`
    : `${Math.abs(delta.value).toFixed(Math.abs(delta.value) < 10 ? 1 : 0)}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 w-fit ${cls}`} title={`Frente a ${compareLabel}`}>
      {flat ? <Minus className="w-3 h-3" /> : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {flat ? 'igual' : text}
    </span>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  chip: React.ReactNode;
  sub: string;
  hint: string;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="relative bg-white border border-neutral-200 rounded-2xl p-4 pb-3.5 shadow-sm flex flex-col gap-0.5 min-w-0" title={props.hint}>
      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1">
        {props.label}
        <Info className="w-3 h-3 text-neutral-300 shrink-0" aria-hidden="true" />
      </span>
      <span className="font-mono text-[26px] leading-tight font-bold text-neutral-900 tabular-nums mt-0.5">{props.value}</span>
      {props.chip}
      <span className="text-[11px] text-neutral-400 mt-1 leading-snug pr-14">{props.sub}</span>
      {props.spark && <Sparkline values={props.spark} color={props.sparkColor || '#0d9488'} />}
    </div>
  );
}

const SEVERITY_STYLE: Record<AttentionItem['severity'], { box: string; icon: React.ReactNode }> = {
  danger: { box: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-4 h-4" /> },
  warning: { box: 'bg-amber-100 text-amber-700', icon: <Clock className="w-4 h-4" /> },
  info: { box: 'bg-neutral-200 text-neutral-600', icon: <Wrench className="w-4 h-4" /> }
};

// -----------------------------------------------------------------------------
// Vista
// -----------------------------------------------------------------------------
export default function DashboardView({
  hotels, rooms, reservations, users, reviews, externalBlocks, icalFeeds,
  hotelFilter, onHotelFilterChange, canFilterHotels, onNavigate
}: DashboardViewProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const today = localToday(nowMs);
  const [preset, setPreset] = useState<PeriodPreset>('mes');
  const [customFrom, setCustomFrom] = useState<string>(() => shiftDate(localToday(Date.now()), -29));
  const [customTo, setCustomTo] = useState<string>(() => localToday(Date.now()));
  const [compare, setCompare] = useState<boolean>(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const input: DashboardInput = useMemo(
    () => ({ hotels, rooms, reservations, externalBlocks, reviews, icalFeeds, hotelId: hotelFilter, today, nowMs }),
    [hotels, rooms, reservations, externalBlocks, reviews, icalFeeds, hotelFilter, today, nowMs]
  );

  const period = useMemo(
    () => resolvePeriod(preset, today, { from: customFrom, to: customTo }),
    [preset, today, customFrom, customTo]
  );

  const kpis = useMemo(() => computeKpis(input, period.current), [input, period]);
  const prevKpis = useMemo(() => (compare ? computeKpis(input, period.previous) : null), [input, period, compare]);
  const series = useMemo(() => kpiSeries(input, period.current), [input, period]);
  const rows = useMemo(() => unitPerformance(input, period.current), [input, period]);
  const mix = useMemo(() => sourceMix(input, period.current), [input, period]);
  const rating = useMemo(() => reviewsSummary(input), [input]);
  const attention = useMemo(() => attentionItems(input), [input]);
  const todayData = useMemo(() => todaySummary(input), [input]);
  const regulars = useMemo(() => frequentGuests(input), [input]);
  const daily = useMemo(() => dailySeries(input, shiftDate(today, -59), shiftDate(today, 30)), [input, today]);
  const forecast = useMemo(() => summarizeForecast(daily), [daily]);

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const empty = !hasAnyActivity(input);

  const deltaOf = (cur: number | null, prev: number | null | undefined, kind: 'pts' | 'pct'): Delta =>
    prevKpis && prev !== undefined ? computeDelta(cur, prev, kind) : null;

  const noCompare = (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-neutral-100 text-neutral-500 w-fit">
      <Minus className="w-3 h-3" /> sin comparar
    </span>
  );
  const chipFor = (delta: Delta, inverse = false) =>
    compare ? <DeltaChip delta={delta} inverse={inverse} compareLabel={period.compareLabel} /> : noCompare;

  const todayLabel = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const text = new Date(y, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  })();

  // ---- Gráfico de ocupación (30 días reales + 30 de previsión) ----
  const view = daily.slice(30); // [hoy-29 .. hoy+30]
  const byDate = new Map<string, (typeof daily)[number]>(daily.map(p => [p.date, p] as [string, (typeof daily)[number]]));
  const W = 760, H = 230, left = 40, right = 750, top = 20, bottom = 170;
  const xAt = (i: number) => left + (i / Math.max(1, view.length - 1)) * (right - left);
  const yAt = (v: number) => bottom - (Math.min(100, Math.max(0, v)) / 100) * (bottom - top);
  const todayIdx = view.findIndex(p => p.date === today);
  const real = view.slice(0, todayIdx + 1);
  const future = view.slice(todayIdx);
  const realPath = real.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.pct).toFixed(1)}`).join(' ');
  const futurePath = future.map((p, i) => `${xAt(todayIdx + i).toFixed(1)},${yAt(p.pct).toFixed(1)}`).join(' ');
  const prevPath = real
    .map((p, i) => {
      const prev = byDate.get(shiftDate(p.date, -30));
      return prev ? `${xAt(i).toFixed(1)},${yAt(prev.pct).toFixed(1)}` : null;
    })
    .filter(Boolean)
    .join(' ');
  const hover = hoverIdx !== null ? view[hoverIdx] : null;
  const tickIdx = [0, 14, todayIdx, 44, view.length - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controles */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h4 className="font-display font-bold text-2xl text-[#0E2A47]">Panel de control</h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            {period.label}: {shortDate(period.current.from)}{period.current.from !== period.current.to ? ` – ${shortDate(period.current.to)}` : ''} · datos al momento de abrir la página
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex bg-white border border-neutral-200 rounded-xl p-0.5" role="group" aria-label="Período">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={preset === p.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  preset === p.id ? 'bg-[#0E2A47] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs text-neutral-500">
              <input type="date" aria-label="Desde" value={customFrom} max={customTo} onChange={e => e.target.value && setCustomFrom(e.target.value)} className="bg-transparent font-semibold text-neutral-800 focus:outline-none" />
              <span>–</span>
              <input type="date" aria-label="Hasta" value={customTo} min={customFrom} onChange={e => e.target.value && setCustomTo(e.target.value)} className="bg-transparent font-semibold text-neutral-800 focus:outline-none" />
            </div>
          )}

          <label className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-400">
            Comparar con
            <select value={compare ? 'si' : 'no'} onChange={e => setCompare(e.target.value === 'si')} className="font-semibold text-neutral-800 bg-transparent focus:outline-none cursor-pointer">
              <option value="si">{period.compareLabel}</option>
              <option value="no">sin comparar</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-400">
            Establecimiento
            <select
              value={hotelFilter}
              disabled={!canFilterHotels}
              onChange={e => onHotelFilterChange(e.target.value)}
              className="font-semibold text-neutral-800 bg-transparent focus:outline-none cursor-pointer disabled:opacity-80 max-w-[11rem]"
            >
              {canFilterHotels && <option value="">Todos</option>}
              {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Estado vacío */}
      {empty && (
        <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h5 className="font-semibold text-neutral-900 text-sm">Aún no hay reservas que mostrar</h5>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              En cuanto entren reservas, aquí verás la ocupación, la tarifa media y lo que requiere tu atención. Mientras tanto, deja listo el establecimiento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('rooms')} className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl cursor-pointer">Revisar habitaciones y tarifas</button>
            <button type="button" onClick={() => onNavigate('rooms')} className="px-3.5 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold rounded-xl cursor-pointer">Conectar Airbnb o Booking</button>
          </div>
        </div>
      )}

      {/* Indicadores */}
      <section aria-label="Indicadores principales" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <KpiCard
          label="Ocupación"
          value={pct(kpis.occupancy)}
          chip={chipFor(deltaOf(kpis.occupancy, prevKpis?.occupancy, 'pts'))}
          sub={`${kpis.occupiedNights} de ${kpis.availableNights} noches`}
          hint="Noches ocupadas (Roomia + Airbnb/Booking) dividido entre las noches disponibles del período."
          spark={series.occupancy}
        />
        <KpiCard
          label="Tarifa media (ADR)"
          value={money(kpis.adr)}
          chip={chipFor(deltaOf(kpis.adr, prevKpis?.adr, 'pct'))}
          sub="por noche vendida"
          hint="Ingreso de hospedaje sin IVA dividido entre las noches vendidas por Roomia."
          spark={series.adr}
        />
        <KpiCard
          label="RevPAR"
          value={money(kpis.revpar)}
          chip={chipFor(deltaOf(kpis.revpar, prevKpis?.revpar, 'pct'))}
          sub="por noche disponible"
          hint="Ingreso de hospedaje dividido entre las noches disponibles (sin contar las vendidas en otras plataformas, de las que no se conoce el dinero)."
          spark={series.revpar}
        />
        <KpiCard
          label="Ingresos hospedaje"
          value={money(kpis.revenue)}
          chip={chipFor(deltaOf(kpis.revenue, prevKpis?.revenue, 'pct'))}
          sub={kpis.revenuePending > 0 ? `${money(kpis.revenuePending)} pendientes de pago` : 'sin IVA'}
          hint="Subtotal sin IVA de reservas confirmadas, ocupadas y finalizadas, repartido por noche. Las pendientes de pago no cuentan."
          spark={series.revenue}
        />
        <KpiCard
          label="Cancelaciones"
          value={pct(kpis.cancellationRate)}
          chip={chipFor(deltaOf(kpis.cancellationRate, prevKpis?.cancellationRate, 'pts'), true)}
          sub={`${kpis.cancelled} de ${kpis.created} reservas`}
          hint="Reservas canceladas entre las creadas en el período."
          spark={series.cancellation}
          sparkColor="#dc2626"
        />
        <KpiCard
          label="Pagos pendientes"
          value={money(todayData.pendingAmount)}
          chip={
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 w-fit bg-amber-100 text-amber-700">
              {todayData.pendingPayments} {todayData.pendingPayments === 1 ? 'reserva' : 'reservas'}
            </span>
          }
          sub={todayData.pendingExpiringIn24h > 0 ? `${money(todayData.pendingExpiringAmount)} vencen en 24 h` : 'ninguna vence pronto'}
          hint="Reservas pendientes de pago. Se cancelan solas a las 24 h de crearse."
        />
      </section>

      {/* Atención + Hoy */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5">
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h5 className="font-semibold text-sm text-[#0E2A47]">Requiere atención</h5>
              <p className="text-xs text-neutral-400 mt-0.5">Lo que conviene resolver hoy</p>
            </div>
            {attention.length > 0 && (
              <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-red-100 text-red-700">
                {attention.length} {attention.length === 1 ? 'pendiente' : 'pendientes'}
              </span>
            )}
          </div>

          {attention.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">Todo en orden. No hay nada urgente que resolver.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {attention.map(item => (
                <li key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50/70">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${SEVERITY_STYLE[item.severity].box}`}>
                    {item.kind === 'sync' ? <RefreshCw className="w-4 h-4" /> : SEVERITY_STYLE[item.severity].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-800 leading-snug">{item.title}</p>
                    <p className="text-[11.5px] text-neutral-400 mt-0.5 truncate" title={item.detail}>{item.detail}</p>
                  </div>
                  <button type="button" onClick={() => onNavigate(item.tab)} className="text-xs font-semibold text-cyan-700 hover:underline whitespace-nowrap cursor-pointer">
                    {item.actionLabel} →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h5 className="font-semibold text-sm text-[#0E2A47]">Hoy</h5>
          <p className="text-xs text-neutral-400 mt-0.5 mb-3">{todayLabel}</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Llegadas', value: todayData.arrivalsCount },
              { label: 'Salidas', value: todayData.departures },
              { label: 'En casa', value: todayData.inHouse },
              { label: 'Mantenim.', value: todayData.maintenance }
            ].map(t => (
              <div key={t.label} className="bg-neutral-100 rounded-xl px-2.5 py-2">
                <b className="block text-xl tabular-nums text-neutral-900">{t.value}</b>
                <span className="text-[10.5px] text-neutral-500">{t.label}</span>
              </div>
            ))}
          </div>

          {todayData.arrivals.length === 0 ? (
            <p className="text-xs text-neutral-400 italic border-t border-neutral-100 pt-3">No hay llegadas previstas para hoy.</p>
          ) : (
            <ul className="border-t border-neutral-100">
              {todayData.arrivals.map(a => {
                const guest = userById.get(a.reservation.guestId);
                const name = guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped';
                const estado = a.reservation.estado;
                const chip =
                  estado === 'pendiente' ? { text: 'Pago pendiente', cls: 'bg-amber-100 text-amber-700' }
                  : estado === 'ocupada' ? { text: 'En casa', cls: 'bg-blue-100 text-blue-700' }
                  : { text: 'Confirmada', cls: 'bg-emerald-100 text-emerald-700' };
                return (
                  <li key={a.reservation.id} className="flex items-center gap-2.5 py-2 border-b border-neutral-100 last:border-0 text-xs">
                    <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 font-bold text-[10.5px] flex items-center justify-center shrink-0">{initials(name)}</span>
                    <div className="min-w-0 flex-1">
                      <b className="font-semibold text-neutral-800 block truncate">{name}</b>
                      <span className="text-neutral-400 text-[11px] block truncate">{a.unitLabel} · {a.nights} {a.nights === 1 ? 'noche' : 'noches'}</span>
                    </div>
                    <span className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${chip.cls}`}>{chip.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {todayData.arrivalsCount > todayData.arrivals.length && (
            <button type="button" onClick={() => onNavigate('reservations')} className="text-xs font-semibold text-cyan-700 hover:underline mt-2 cursor-pointer">
              Ver las {todayData.arrivalsCount - todayData.arrivals.length} restantes →
            </button>
          )}
        </div>
      </section>

      {/* Ocupación diaria + origen */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <h5 className="font-semibold text-sm text-[#0E2A47]">Ocupación diaria y previsión</h5>
              <p className="text-xs text-neutral-400 mt-0.5">Real hasta hoy · reservas confirmadas hacia adelante</p>
            </div>
            <div className="flex items-center gap-3.5 text-[11.5px] text-neutral-500">
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-teal-600 inline-block" />Real</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-teal-300 inline-block" />Prevista</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-slate-300 inline-block" />30 días antes</span>
            </div>
          </div>

          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-labelledby="occ-title occ-desc"
              onMouseLeave={() => setHoverIdx(null)}
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * W;
                const i = Math.round(((x - left) / (right - left)) * (view.length - 1));
                setHoverIdx(i >= 0 && i < view.length ? i : null);
              }}
            >
              <title id="occ-title">Ocupación diaria real y prevista</title>
              <desc id="occ-desc">Porcentaje de unidades ocupadas por día: los últimos 30 días reales y los próximos 30 según reservas confirmadas.</desc>
              <defs>
                <linearGradient id="occ-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0d9488" stopOpacity=".28" />
                  <stop offset="1" stopColor="#0d9488" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[100, 75, 50, 25].map(v => (
                <g key={v}>
                  <line x1={left} x2={right} y1={yAt(v)} y2={yAt(v)} stroke="#eef2f6" />
                  <text x={6} y={yAt(v) + 4} fontSize="11" fill="#94a3b8">{v}%</text>
                </g>
              ))}
              {todayIdx >= 0 && <rect x={xAt(todayIdx)} y={top} width={right - xAt(todayIdx)} height={bottom - top} fill="#f8fafc" />}
              {prevPath && <polyline fill="none" stroke="#cbd5e1" strokeWidth="1.6" strokeDasharray="3 3" points={prevPath} />}
              {real.length > 1 && <polygon fill="url(#occ-area)" points={`${xAt(0)},${bottom} ${realPath} ${xAt(todayIdx)},${bottom}`} />}
              {real.length > 1 && <polyline fill="none" stroke="#0d9488" strokeWidth="2.6" strokeLinejoin="round" points={realPath} />}
              {future.length > 1 && <polyline fill="none" stroke="#5fd0c4" strokeWidth="2.6" strokeDasharray="6 5" strokeLinejoin="round" points={futurePath} />}
              {todayIdx >= 0 && (
                <g>
                  <line x1={xAt(todayIdx)} x2={xAt(todayIdx)} y1={top - 6} y2={bottom + 6} stroke="#0E2A47" strokeWidth="1.2" />
                  <rect x={xAt(todayIdx) - 27} y={2} width={54} height={17} rx={8} fill="#0E2A47" />
                  <text x={xAt(todayIdx)} y={14} fill="#fff" fontSize="10.5" textAnchor="middle" fontWeight="600">HOY</text>
                </g>
              )}
              {hover && hoverIdx !== null && (
                <g>
                  <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={top} y2={bottom} stroke="#94a3b8" strokeDasharray="2 3" />
                  <circle cx={xAt(hoverIdx)} cy={yAt(hover.pct)} r="4.5" fill="#fff" stroke="#0d9488" strokeWidth="2.4" />
                </g>
              )}
              {tickIdx.map(i => (
                <text key={i} x={xAt(i)} y={196} fontSize="11" fill="#94a3b8" textAnchor="middle">{shortDate(view[i].date)}</text>
              ))}
            </svg>

            {hover && hoverIdx !== null && (
              <div
                className="absolute pointer-events-none bg-[#0E2A47] text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg"
                style={{ left: `${(xAt(hoverIdx) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
              >
                <b className="block">{shortDate(hover.date)}{hover.forecast ? ' · prevista' : hover.date === today ? ' · hoy' : ''}</b>
                {Math.round(hover.pct)}% · {hover.occupiedUnits} de {hover.units} unidades
              </div>
            )}
          </div>

          <p className="text-[11.5px] text-neutral-500 text-right">
            {forecast.averagePct === null
              ? 'Sin unidades para calcular la previsión.'
              : <>Previsión próximos 30 días: <b className="text-neutral-900">{Math.round(forecast.averagePct)}%</b>{forecast.peak && forecast.peak.pct > 0 ? <> · pico el {shortDate(forecast.peak.date)} ({Math.round(forecast.peak.pct)}%)</> : null}</>}
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h5 className="font-semibold text-sm text-[#0E2A47]">Origen de las reservas</h5>
          <p className="text-xs text-neutral-400 mt-0.5 mb-4">Noches del período</p>
          <div className="space-y-3.5">
            {mix.map(row => (
              <div key={row.key}>
                <div className="flex justify-between text-[12.5px] font-medium text-neutral-700 mb-1.5">
                  <span>{row.label}</span>
                  <span className="text-neutral-400 font-normal">{row.nights} {row.nights === 1 ? 'noche' : 'noches'} · {Math.round(row.pct)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: SOURCE_COLORS[row.key] }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-neutral-400 leading-relaxed mt-4">
            De Airbnb y Booking solo se conocen las noches bloqueadas; el dinero de esos canales se ve en cada plataforma.
          </p>
        </div>
      </section>

      {/* Valoraciones + rendimiento */}
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_1.6fr] gap-5">
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h5 className="font-semibold text-sm text-[#0E2A47]">Valoraciones</h5>
          <p className="text-xs text-neutral-400 mt-0.5 mb-4">Últimos 90 días · {rating.count} {rating.count === 1 ? 'reseña' : 'reseñas'}</p>
          {rating.average === null ? (
            <p className="text-xs text-neutral-400 italic">Aún no hay valoraciones en los últimos 90 días.</p>
          ) : (
            <div className="flex items-center gap-5">
              <div className="text-center shrink-0">
                <div className="font-display font-bold text-4xl text-[#0E2A47] leading-none">{rating.average.toFixed(1)}</div>
                <div className="text-amber-500 text-sm tracking-widest mt-1" aria-label={`${rating.average.toFixed(1)} de 5 estrellas`}>
                  {'★'.repeat(Math.round(rating.average))}<span className="text-neutral-200">{'★'.repeat(5 - Math.round(rating.average))}</span>
                </div>
                {rating.deltaAverage !== null && (
                  <div className="text-[11px] text-neutral-400 mt-0.5">{rating.deltaAverage >= 0 ? '+' : '−'}{Math.abs(rating.deltaAverage).toFixed(1)} vs. anterior</div>
                )}
              </div>
              <div className="flex-1 space-y-1.5 text-[11.5px] text-neutral-500">
                {rating.distribution.map((share, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 tabular-nums">{5 - i}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${share}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h5 className="font-semibold text-sm text-[#0E2A47]">Rendimiento por unidad</h5>
          <p className="text-xs text-neutral-400 mt-0.5 mb-3">Ordenado por ingresos · {period.label.toLowerCase()}</p>
          {rows.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">No hay unidades en alquiler para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-neutral-400">
                    <th className="font-semibold pb-2 pr-3">Unidad</th>
                    <th className="font-semibold pb-2 pr-3">Ocupación</th>
                    <th className="font-semibold pb-2 pr-3">ADR</th>
                    <th className="font-semibold pb-2 pr-3">RevPAR</th>
                    <th className="font-semibold pb-2 pr-3">Ingresos</th>
                    <th className="font-semibold pb-2">Valoración</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map(r => (
                    <tr key={r.unit.id} className="border-t border-neutral-100 text-neutral-600">
                      <td className="py-2.5 pr-3 font-semibold text-neutral-900 whitespace-nowrap max-w-[16rem] truncate" title={r.unit.label}>{r.unit.label}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="inline-block w-20 h-1.5 rounded-full bg-slate-100 align-middle mr-2 overflow-hidden"><i className="block h-full bg-teal-600 rounded-full" style={{ width: `${r.occupancy ?? 0}%` }} /></span>
                        <span className="tabular-nums">{pct(r.occupancy)}</span>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{money(r.adr)}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{money(r.revpar)}</td>
                      <td className="py-2.5 pr-3 tabular-nums font-bold text-neutral-900">{money(r.revenue)}</td>
                      <td className="py-2.5 whitespace-nowrap">{r.rating === null ? <span className="text-neutral-400">sin datos</span> : `${r.rating.toFixed(1)} ★`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Huéspedes recurrentes */}
      {regulars.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h5 className="font-semibold text-sm text-[#0E2A47]">Huéspedes recurrentes</h5>
          <p className="text-xs text-neutral-400 mt-0.5 mb-3">Con 2 o más estadías confirmadas, ocupadas o finalizadas</p>
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {regulars.map(g => {
              const u = userById.get(g.guestId);
              const name = u ? `${u.nombre} ${u.apellido}` : 'Huésped';
              return (
                <li key={g.guestId} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">{initials(name)}</span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[13px] text-neutral-800 truncate">{name}</b>
                    <span className="block text-[11px] text-neutral-400 truncate">{u?.email || ''}</span>
                  </div>
                  <span className={`text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${g.stays >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                    {g.stays} estadías{g.stays >= 4 ? ' · VIP' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-neutral-400 text-center flex items-center justify-center gap-1.5">
        <CalendarDays className="w-3 h-3" />
        Las cifras de dinero no incluyen IVA. Pasa el cursor por cada indicador para ver cómo se calcula.
      </p>
    </div>
  );
}
