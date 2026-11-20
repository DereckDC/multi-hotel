/**
 * "Mi plan" del administrador de hotel: estado de su suscripción, elección del plan, pago con
 * Payphone (mensual o anual), puesta en marcha e historial de pagos.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, CreditCard, Download, Loader2 } from 'lucide-react';
import type { Hotel, Room, User } from '../types';
import {
  PLANS, SETUP_FEE, STATUS_LABEL, TRIAL_DAYS, ANNUAL_FREE_MONTHS, daysLeft, effectiveStatus, findPlan, paidUntil, planCharge, usd2,
  type Billing, type EffectiveStatus
} from '../utils/plans';
import { fetchMySubscription, fetchPlanPayments, startPlanPayment, type PlanPayment, type Subscription } from '../utils/subscriptions';
import { buildTableReport } from '../utils/reportPdf';
import { savePdfNative } from '../utils/nativeFiles';
import { isNativeApp } from '../utils/platform';
import { notify } from '../utils/notify';
import { friendlyError } from '../utils/errors';
import { Badge, Button, Card, SectionHeader, type BadgeTone } from './ui';
import { cx } from '../utils/cx';

export const STATUS_TONE: Record<EffectiveStatus, BadgeTone> = {
  prueba: 'info',
  activa: 'success',
  vencida: 'warning',
  suspendida: 'danger',
  cancelada: 'neutral',
  sin_plan: 'neutral'
};

export const longDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export const PAYMENT_STATUS: Record<string, string> = {
  aprobado: 'Aprobado',
  creado: 'Sin completar',
  procesando: 'En proceso',
  cancelado: 'No completado',
  expirado: 'Expirado',
  error: 'En revisión'
};

export const METHOD_LABEL: Record<string, string> = {
  payphone: 'Payphone',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro'
};

export const paymentConcept = (p: PlanPayment) =>
  p.kind === 'puesta_en_marcha'
    ? 'Puesta en marcha'
    : `Plan ${findPlan(p.planId)?.name ?? ''} · ${p.billing === 'anual' ? 'anual' : 'mensual'}`.replace('  ', ' ');

/** Unidades que usa el anfitrión: habitaciones de su establecimiento (una casa o departamento completo cuenta como 1) */
export function unitsOf(hotelId: string | undefined, hotels: Hotel[], rooms: Room[]): number {
  if (!hotelId) return 0;
  const hotel = hotels.find(h => h.id === hotelId);
  if (hotel && (hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento')) return 1;
  return rooms.filter(r => r.hotelId === hotelId).length;
}

export async function downloadPaymentsPdf(payments: PlanPayment[], subtitle: string) {
  const doc = await buildTableReport({
    title: 'Pagos del plan',
    subtitle,
    columns: [
      { title: 'Fecha', weight: 1.2 },
      { title: 'Concepto', weight: 2 },
      { title: 'Medio de pago', weight: 1.4 },
      { title: 'Estado', weight: 1 },
      { title: 'Monto', weight: 1, align: 'right' }
    ],
    rows: payments.map(p => [
      longDate(p.confirmedAt || p.createdAt),
      paymentConcept(p),
      [METHOD_LABEL[p.method] ?? p.method, p.card].filter(Boolean).join(' · '),
      PAYMENT_STATUS[p.status] ?? p.status,
      `$${p.amount.toFixed(2)}`
    ]),
    emptyText: 'Todavía no hay pagos.'
  });
  const fileName = `Roomia PMS - Pagos del plan - ${new Date().toISOString().slice(0, 10)}.pdf`;
  if (isNativeApp()) {
    const inDocs = await savePdfNative(doc.output('datauristring'), fileName, 'Pagos del plan');
    if (inDocs) notify.success('PDF guardado en Documentos/Roomia.');
  } else {
    doc.save(fileName);
  }
}

export default function PlanView({ activeUser, hotels, rooms }: { activeUser: User; hotels: Hotel[]; rooms: Room[] }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PlanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planId, setPlanId] = useState('roomia-1');
  const [billing, setBilling] = useState<Billing>('mensual');
  const [busy, setBusy] = useState<null | 'plan' | 'puesta_en_marcha'>(null);
  const [downloading, setDownloading] = useState(false);

  const units = unitsOf(activeUser.hotelId, hotels, rooms);
  const hotelName = hotels.find(h => h.id === activeUser.hotelId)?.nombre ?? '';

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, list] = await Promise.all([fetchMySubscription(activeUser.id), fetchPlanPayments(activeUser.id)]);
      setSub(s);
      setPayments(list);
      if (s) {
        setPlanId(s.planId);
        setBilling(s.billing);
      }
    } catch (err) {
      setLoadError(friendlyError(err, 'cargar'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeUser.id]);

  const status = effectiveStatus(sub);
  const left = daysLeft(sub);
  const current = findPlan(sub?.planId);
  const selected = findPlan(planId) ?? PLANS[0];
  const amount = planCharge('plan', selected, units, billing);
  const lastPaid = useMemo(() => payments.find(p => p.status === 'aprobado'), [payments]);
  /** Los intentos que no se terminaron (Cajita abierta y cerrada, o vencida) no se muestran */
  const shownPayments = useMemo(() => payments.filter(p => p.status !== 'creado' && p.status !== 'expirado'), [payments]);

  const pay = async (kind: 'plan' | 'puesta_en_marcha') => {
    if (busy) return;
    setBusy(kind);
    try {
      await startPlanPayment(kind, selected.id, billing);
    } catch (err: any) {
      notify.error(err?.message || 'No se pudo iniciar el pago.');
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu plan…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Mi plan"
        description="Tu suscripción a Roomia PMS: estado, pagos y cambio de plan."
      />

      {loadError && (
        <Card>
          <p className="text-sm text-danger-700">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={load}>Reintentar</Button>
        </Card>
      )}

      {/* Estado actual */}
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Plan</span>
            <span className="block text-base font-bold text-brand-navy1">{current ? `${current.name} · ${sub?.billing}` : 'Sin plan'}</span>
          </div>
          <div>
            <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Estado</span>
            <Badge tone={STATUS_TONE[status]} className="mt-1">{STATUS_LABEL[status]}</Badge>
          </div>
          <div>
            <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">
              {sub?.status === 'prueba' && !sub.currentPeriodEnd ? 'Prueba hasta' : 'Pagado hasta'}
            </span>
            <span className="block text-base font-bold text-brand-navy1">{longDate(sub ? paidUntil(sub) : null)}</span>
            {left !== null && (
              <span className={cx('block text-xs', left < 0 ? 'text-danger-700' : left <= 5 ? 'text-warning-700' : 'text-neutral-500')}>
                {left < 0 ? `Venció hace ${Math.abs(left)} ${Math.abs(left) === 1 ? 'día' : 'días'}` : left === 0 ? 'Vence hoy' : `Faltan ${left} ${left === 1 ? 'día' : 'días'}`}
              </span>
            )}
          </div>
          <div>
            <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Unidades</span>
            <span className="block text-base font-bold text-brand-navy1">
              {units}{current ? ` de ${current.units} incluidas` : ''}
            </span>
            {current && units > current.units && (
              <span className="block text-xs text-warning-700">{units - current.units} adicionales a {usd2(current.extraUnit)} c/u</span>
            )}
          </div>
        </div>

        {status === 'vencida' && (
          <p className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
            Tu plan venció. Tienes {sub?.graceDays ?? 7} días de gracia desde el vencimiento: después, tu establecimiento deja de recibir reservas nuevas.
          </p>
        )}
        {status === 'suspendida' && (
          <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-800">
            Tu plan está suspendido: tu establecimiento no recibe reservas nuevas y no puedes crear habitaciones ni propiedades. Tus reservas actuales siguen funcionando. Paga para reactivarlo al instante.
          </p>
        )}
        {status === 'cancelada' && (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            Tu plan está cancelado. Escríbenos por WhatsApp para reactivarlo.
          </p>
        )}
        {status === 'sin_plan' && (
          <p className="rounded-xl border border-info-200 bg-info-50 p-3 text-sm text-info-900">
            Aún no tienes un plan activo. Elige uno abajo y págalo en línea; se activa apenas se apruebe el pago.
          </p>
        )}
      </Card>

      {/* Elegir y pagar */}
      {status !== 'cancelada' && (
        <Card
          title={status === 'sin_plan' ? 'Elige tu plan' : 'Pagar o cambiar de plan'}
          description={`El monto se calcula con tus ${units} ${units === 1 ? 'unidad registrada' : 'unidades registradas'}. Pagar suma un período a la fecha que ya tienes pagada.`}
        >
          <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1" role="group" aria-label="Forma de pago">
            {(['mensual', 'anual'] as Billing[]).map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBilling(b)}
                aria-pressed={billing === b}
                className={cx(
                  'cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
                  billing === b ? 'bg-brand-navy1 text-white shadow-sm' : 'text-neutral-500 hover:text-brand-navy1'
                )}
              >
                {b === 'mensual' ? 'Mensual' : `Anual · ${ANNUAL_FREE_MONTHS} meses gratis`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PLANS.map(plan => {
              const active = plan.id === planId;
              const price = planCharge('plan', plan, units, billing);
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanId(plan.id)}
                  aria-pressed={active}
                  className={cx(
                    'cursor-pointer rounded-2xl border p-4 text-left transition-colors focus-brand',
                    active ? 'border-brand-cyan bg-info-50 ring-2 ring-brand-cyan/30' : 'border-neutral-200 bg-white hover:border-brand-cyan'
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-brand-navy1">{plan.name}</span>
                    {active && <Check className="h-4 w-4 text-info-600" />}
                  </span>
                  <span className="mt-1 block text-sm text-neutral-500">{plan.props} {plan.props === 1 ? 'propiedad' : 'propiedades'} · {plan.units} unidades</span>
                  <span className="mt-3 block font-mono text-xl font-extrabold text-brand-navy1">${price.toFixed(2)}</span>
                  <span className="block text-xs text-neutral-500">{billing === 'anual' ? 'por año' : 'por mes'}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-brand-navy1">
              {selected.name} {billing} · <strong>${amount.toFixed(2)} USD</strong>
            </p>
            <Button onClick={() => pay('plan')} loading={busy === 'plan'} disabled={!!busy}>
              {busy !== 'plan' && <CreditCard className="h-4 w-4" />}
              <span>Pagar</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Puesta en marcha */}
      {status !== 'cancelada' && !sub?.setupPaid && (
        <Card
          title="Puesta en marcha"
          description={`Pago único de $${SETUP_FEE} por cargar tus unidades y capacitar a tu personal. Incluye ${TRIAL_DAYS} días de prueba al empezar.`}
          actions={
            <Button variant="secondary" onClick={() => pay('puesta_en_marcha')} loading={busy === 'puesta_en_marcha'} disabled={!!busy}>
              <span>Pagar ${SETUP_FEE}</span>
            </Button>
          }
        >
          <></>
        </Card>
      )}

      {/* Historial */}
      <Card
        title="Historial de pagos"
        description={lastPaid ? `Último pago: ${longDate(lastPaid.confirmedAt || lastPaid.createdAt)}` : 'Todavía no hay pagos.'}
        actions={
          <Button
            variant="secondary" size="sm"
            disabled={shownPayments.length === 0 || downloading}
            loading={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadPaymentsPdf(shownPayments, `${activeUser.nombre} ${activeUser.apellido}${hotelName ? ` · ${hotelName}` : ''}`);
              } catch (err) {
                notify.error(friendlyError(err, 'pdf'));
              } finally {
                setDownloading(false);
              }
            }}
          >
            {!downloading && <Download className="h-3.5 w-3.5" />}
            <span>Descargar PDF</span>
          </Button>
        }
      >
        {shownPayments.length > 0 && (
          <ul className="divide-y divide-neutral-100">
            {shownPayments.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-brand-navy1">{paymentConcept(p)}</span>
                  <span className="block text-xs text-neutral-500">
                    {longDate(p.confirmedAt || p.createdAt)} · {[METHOD_LABEL[p.method] ?? p.method, p.card].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.status === 'aprobado' ? 'success' : p.status === 'error' ? 'danger' : 'neutral'}>{PAYMENT_STATUS[p.status] ?? p.status}</Badge>
                  <span className="font-mono text-sm font-bold text-brand-navy1">${p.amount.toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-neutral-500">
        <CalendarClock className="h-3.5 w-3.5" />
        Si tu plan vence, tienes {sub?.graceDays ?? 7} días de gracia. Después tu establecimiento deja de recibir reservas nuevas hasta que pagues.
      </p>
    </div>
  );
}
