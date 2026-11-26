/**
 * "Suscripciones" del superadministrador: planes de todos los anfitriones (admin de hotel),
 * su estado, vencimientos y pagos. Permite asignar o cambiar el plan, extender la prueba,
 * suspender o reactivar y registrar pagos hechos por transferencia o en efectivo.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Loader2, Search, X } from 'lucide-react';
import type { Hotel, Room, User } from '../types';
import {
  PLANS, STATUS_LABEL, TRIAL_DAYS, daysLeft, effectiveStatus, findPlan, paidUntil, planCharge,
  type Billing, type EffectiveStatus, type StoredStatus
} from '../utils/plans';
import {
  createSubscription, fetchAllSubscriptions, fetchPlanPayments, registerManualPayment, sriModuloVigente, updateSubscription,
  type PlanPayment, type Subscription
} from '../utils/subscriptions';
import { notify } from '../utils/notify';
import { cx } from '../utils/cx';
import { friendlyError } from '../utils/errors';
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, SelectPicker, Textarea } from './ui';
import { METHOD_LABEL, PAYMENT_STATUS, STATUS_TONE, downloadPaymentsPdf, longDate, paymentConcept, propertiesOf, unitsOf } from './PlanView';

interface Row {
  host: User;
  hotelName: string;
  units: number;
  sub: Subscription | null;
  status: EffectiveStatus;
  left: number | null;
  lastPayment: PlanPayment | undefined;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDateInput = (value: string) => (value ? new Date(`${value}T23:59:59`).toISOString() : null);

export default function SubscriptionsView({ users, hotels, rooms }: { users: User[]; hotels: Hotel[]; rooms: Room[] }) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<PlanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | EffectiveStatus>('todos');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, p] = await Promise.all([fetchAllSubscriptions(), fetchPlanPayments()]);
      setSubs(s);
      setPayments(p);
    } catch (err) {
      setLoadError(friendlyError(err, 'cargar'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const rows: Row[] = useMemo(() => users
    .filter(u => u.rol === 'hotel_admin')
    .map(host => {
      const sub = subs.find(s => s.ownerId === host.id) ?? null;
      return {
        host,
        hotelName: hotels.find(h => h.id === host.hotelId)?.nombre ?? 'Sin establecimiento',
        units: unitsOf(host.hotelId, hotels, rooms),
        sub,
        status: effectiveStatus(sub),
        left: daysLeft(sub),
        lastPayment: payments.find(p => p.ownerId === host.id && p.status === 'aprobado')
      };
    }), [users, hotels, rooms, subs, payments]);

  const visible = rows.filter(r => {
    if (filter !== 'todos' && r.status !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || `${r.host.nombre} ${r.host.apellido} ${r.host.email} ${r.hotelName}`.toLowerCase().includes(q);
  });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const incomeMonth = payments
    .filter(p => p.status === 'aprobado' && new Date(p.confirmedAt || p.createdAt).getTime() >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0);
  const count = (s: EffectiveStatus) => rows.filter(r => r.status === s).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando suscripciones…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Suscripciones"
        description="Planes de los anfitriones: estado, vencimientos y pagos."
        actions={
          <Button
            variant="secondary" size="sm"
            disabled={payments.length === 0}
            onClick={() => downloadPaymentsPdf(payments.filter(p => p.status === 'aprobado'), 'Todos los anfitriones').catch(err => notify.error(friendlyError(err, 'pdf')))}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Pagos en PDF</span>
          </Button>
        }
      />

      {loadError && (
        <Card>
          <p className="text-sm text-danger-700">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={load}>Reintentar</Button>
        </Card>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Ingresos del mes', value: `$${incomeMonth.toFixed(2)}` },
          { label: 'Al día', value: String(count('activa')) },
          { label: 'En prueba', value: String(count('prueba')) },
          { label: 'Vencidas', value: String(count('vencida')) },
          { label: 'Suspendidas', value: String(count('suspendida')) }
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">{k.label}</span>
            <span className="mt-1 block font-mono text-xl font-extrabold text-brand-navy1">{k.value}</span>
          </div>
        ))}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-brand-cyan">
            <Search className="h-4 w-4 shrink-0 text-neutral-500" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar anfitrión o establecimiento"
              aria-label="Buscar anfitrión o establecimiento"
              className="w-full bg-transparent text-sm text-brand-navy1 placeholder:text-neutral-500 focus:outline-none"
            />
          </label>
          <SelectPicker label="Estado" showLabel value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="todos">Todos los estados</option>
            {(['activa', 'prueba', 'vencida', 'suspendida', 'cancelada', 'sin_plan'] as EffectiveStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </SelectPicker>
        </div>

        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No hay anfitriones con ese filtro.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visible.map(r => {
              const plan = findPlan(r.sub?.planId);
              return (
                <li key={r.host.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-brand-navy1">{r.host.nombre} {r.host.apellido}</span>
                    <span className="block truncate text-xs text-neutral-500">{r.hotelName} · {r.units} {r.units === 1 ? 'unidad' : 'unidades'} · {r.host.email}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="text-left sm:text-right">
                      <span className="block text-sm font-semibold text-brand-navy1">{plan ? `${plan.name} · ${r.sub?.billing}${sriModuloVigente(r.sub) ? ' + SRI' : ''}` : 'Sin plan'}</span>
                      <span className="block text-xs text-neutral-500">
                        {r.sub ? `Hasta ${longDate(paidUntil(r.sub))}` : '—'}
                        {r.left !== null && r.left < 0 ? ` · venció hace ${Math.abs(r.left)} d` : ''}
                      </span>
                    </div>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                      {r.sub ? 'Gestionar' : 'Asignar plan'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && (
        <ManageModal
          row={editing}
          payments={payments.filter(p => p.ownerId === editing.host.id)}
          onClose={() => setEditing(null)}
          onSaved={async () => { await load(); setEditing(null); }}
        />
      )}
    </div>
  );
}

type ManageTab = 'suscripcion' | 'pago' | 'pagos';

function ManageModal({ row, payments, onClose, onSaved }: {
  row: Row;
  payments: PlanPayment[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const sub = row.sub;
  const [tab, setTab] = useState<ManageTab>('suscripcion');
  const [planId, setPlanId] = useState(sub?.planId ?? 'roomia-1');
  const [billing, setBilling] = useState<Billing>(sub?.billing ?? 'mensual');
  const [status, setStatus] = useState<StoredStatus>(sub?.status ?? 'prueba');
  const [trialDays, setTrialDays] = useState(String(TRIAL_DAYS));
  const [trialEnd, setTrialEnd] = useState(toDateInput(sub?.trialEndsAt ?? null));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(sub?.currentPeriodEnd ?? null));
  const [graceDays, setGraceDays] = useState(String(sub?.graceDays ?? 7));
  const [notes, setNotes] = useState(sub?.notes ?? '');
  const [sriModulo, setSriModulo] = useState(sriModuloVigente(sub));
  const [saving, setSaving] = useState(false);

  const plan = findPlan(planId) ?? PLANS[0];
  const [payKind, setPayKind] = useState<'plan' | 'puesta_en_marcha'>('plan');
  const [payAmount, setPayAmount] = useState(String(planCharge('plan', plan, row.units, billing)));
  const [payMethod, setPayMethod] = useState<'transferencia' | 'efectivo' | 'otro'>('transferencia');
  const [payNote, setPayNote] = useState('');
  const [paySri, setPaySri] = useState(sub?.sriModulo ?? false);
  /** El módulo SRI se cobra por propiedad del anfitrión */
  const hostProps = propertiesOf(row.host.hotelId);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    setPayAmount(String(planCharge(payKind, plan, row.units, billing, paySri ? hostProps : 0)));
  }, [payKind, planId, billing, paySri]);

  const price = planCharge('plan', plan, row.units, billing, sub && sriModulo ? hostProps : 0);
  const trialUntil = new Date(Date.now() + Math.max(0, Number(trialDays) || 0) * 24 * 60 * 60 * 1000).toISOString();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (!sub) {
        await createSubscription(row.host.id, planId, billing, Math.max(0, Number(trialDays) || 0));
        notify.success('Plan asignado.');
      } else {
        await updateSubscription(sub.id, {
          planId,
          billing,
          status,
          trialEndsAt: fromDateInput(trialEnd),
          currentPeriodEnd: fromDateInput(periodEnd),
          graceDays: Math.min(60, Math.max(0, Number(graceDays) || 0)),
          notes,
          sriModulo,
          // Activar a mano: el módulo queda vigente hasta la fecha pagada (o el fin de la prueba)
          sriHasta: sriModulo ? (fromDateInput(periodEnd) ?? fromDateInput(trialEnd)) : null
        });
        notify.success('Suscripción actualizada.');
      }
      await onSaved();
    } catch (err) {
      notify.error(friendlyError(err, 'guardar'));
    } finally {
      setSaving(false);
    }
  };

  const registerPayment = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(payAmount);
    if (!(amount > 0)) {
      notify.warning('Escribe un monto mayor a cero.');
      return;
    }
    setPaying(true);
    try {
      await registerManualPayment({ ownerId: row.host.id, kind: payKind, planId, billing, amount, method: payMethod, note: payNote, sri: paySri });
      notify.success(payKind === 'plan' ? 'Pago registrado: el plan se extendió un período.' : 'Pago de la puesta en marcha registrado.');
      await onSaved();
    } catch (err) {
      notify.error(friendlyError(err, 'pago'));
    } finally {
      setPaying(false);
    }
  };

  const tabs: Array<{ id: ManageTab; label: string }> = sub
    ? [{ id: 'suscripcion', label: 'Suscripción' }, { id: 'pago', label: 'Registrar pago' }, { id: 'pagos', label: `Pagos (${payments.length})` }]
    : [];

  /** Botones al pie: los mismos de los demás formularios (Cancelar a la izquierda, acción principal a la derecha) */
  const actions = (submitLabel: string, busy: boolean) => (
    <div className="sticky bottom-0 flex gap-3 bg-white pb-1 pt-2">
      <Button type="button" onClick={onClose} variant="secondary" size="md" className="w-1/2">Cancelar</Button>
      <Button type="submit" loading={busy} variant="primary" size="md" className="w-1/2">{submitLabel}</Button>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      bodyClassName="p-0"
      header={
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <h4 className="font-semibold text-neutral-800">{sub ? 'Gestionar suscripción' : 'Asignar plan'}</h4>
            <p className="truncate text-xs text-neutral-500">
              {row.host.nombre} {row.host.apellido} · {row.hotelName} · {row.units} {row.units === 1 ? 'unidad' : 'unidades'}
            </p>
          </div>
          <Button onClick={onClose} variant="icon" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>
      }
    >
      {tabs.length > 0 && (
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-neutral-100 bg-neutral-50 p-1" role="tablist" aria-label="Secciones">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'cursor-pointer truncate rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors',
                  tab === t.id ? 'bg-brand-navy1 text-white shadow-sm' : 'text-neutral-500 hover:text-brand-navy1'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Asignar o editar la suscripción */}
      {tab === 'suscripcion' && (
        <form onSubmit={save} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Plan">
              <SelectPicker label="Plan" value={planId} onChange={e => setPlanId(e.target.value)}>
                {PLANS.map(p => <option key={p.id} value={p.id}>{p.name} · {p.units} unidades</option>)}
              </SelectPicker>
            </Field>
            <Field label="Forma de pago">
              <SelectPicker label="Forma de pago" value={billing} onChange={e => setBilling(e.target.value as Billing)}>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </SelectPicker>
            </Field>
            {!sub ? (
              <Field label="Días de prueba" hint={`La prueba termina el ${longDate(trialUntil)}.`}>
                <Input type="number" min={0} max={90} required value={trialDays} onChange={e => setTrialDays(e.target.value)} />
              </Field>
            ) : (
              <>
                <Field label="Estado">
                  <SelectPicker label="Estado" value={status} onChange={e => setStatus(e.target.value as StoredStatus)}>
                    <option value="prueba">En prueba</option>
                    <option value="activa">Activa</option>
                    <option value="suspendida">Suspendida (a mano)</option>
                    <option value="cancelada">Cancelada</option>
                  </SelectPicker>
                </Field>
                <Field label="Días de gracia">
                  <Input type="number" min={0} max={60} value={graceDays} onChange={e => setGraceDays(e.target.value)} />
                </Field>
                <Field label="Prueba hasta">
                  <Input type="date" value={trialEnd} onChange={e => setTrialEnd(e.target.value)} />
                </Field>
                <Field label="Pagado hasta">
                  <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                </Field>
                <label className="sm:col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 text-sm text-brand-navy1 hover:border-brand-cyan">
                  <input type="checkbox" checked={sriModulo} onChange={e => setSriModulo(e.target.checked)} className="h-4 w-4 cursor-pointer accent-brand-cyan" />
                  <span>Módulo de facturación electrónica del SRI activo (hasta la fecha pagada)</span>
                </label>
                <div className="sm:col-span-2">
                  <Field label="Notas internas">
                    <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Acuerdos, descuentos, contacto…" />
                  </Field>
                </div>
              </>
            )}
          </div>

          <p className="rounded-xl border border-info-200 bg-info-50 p-3 text-sm text-info-900">
            {plan.name} {billing}: <strong>${price.toFixed(2)} USD</strong> {billing === 'anual' ? 'al año' : 'al mes'} con {row.units} {row.units === 1 ? 'unidad' : 'unidades'}.
            {sub ? ' Vencida y suspendida por falta de pago se calculan solas con las fechas.' : ' Al terminar la prueba, el anfitrión paga desde "Mi plan".'}
          </p>

          {actions(sub ? 'Guardar' : 'Asignar plan', saving)}
        </form>
      )}

      {/* Pago por transferencia o en efectivo */}
      {tab === 'pago' && (
        <form onSubmit={registerPayment} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Concepto">
              <SelectPicker label="Concepto" value={payKind} onChange={e => setPayKind(e.target.value as any)}>
                <option value="plan">Plan {plan.name} · {billing}</option>
                <option value="puesta_en_marcha">Puesta en marcha</option>
              </SelectPicker>
            </Field>
            <Field label="Medio de pago">
              <SelectPicker label="Medio de pago" value={payMethod} onChange={e => setPayMethod(e.target.value as any)}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </SelectPicker>
            </Field>
            <Field label="Monto (USD)">
              <Input type="number" min={0.01} step="0.01" required value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </Field>
            <Field label="Comprobante o nota">
              <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Ej. Transferencia #12345" />
            </Field>
          </div>

          {payKind === 'plan' && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 text-sm text-brand-navy1 hover:border-brand-cyan">
              <input type="checkbox" checked={paySri} onChange={e => setPaySri(e.target.checked)} className="h-4 w-4 cursor-pointer accent-brand-cyan" />
              <span>Incluye la facturación electrónica del SRI (+${plan.invoice} al mes por propiedad)</span>
            </label>
          )}

          <p className="rounded-xl border border-info-200 bg-info-50 p-3 text-sm text-info-900">
            {payKind === 'plan'
              ? `El plan se extiende un período (${billing === 'anual' ? 'un año' : 'un mes'}) desde la fecha pagada o desde hoy si ya venció.`
              : 'Marca la puesta en marcha como pagada.'}
          </p>

          {actions('Registrar pago', paying)}
        </form>
      )}

      {/* Historial de pagos del anfitrión */}
      {tab === 'pagos' && (
        <div className="space-y-4 p-6">
          {payments.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-500">Todavía no hay pagos.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-4">
              {payments.map(p => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-brand-navy1">{paymentConcept(p)}</span>
                    <span className="block text-xs text-neutral-500">
                      {longDate(p.confirmedAt || p.createdAt)} · {[METHOD_LABEL[p.method] ?? p.method, p.card, p.method !== 'payphone' ? p.note : ''].filter(Boolean).join(' · ')}
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
          <div className="sticky bottom-0 bg-white pb-1 pt-2">
            <Button type="button" onClick={onClose} variant="secondary" size="md" fullWidth>Cerrar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
