/**
 * Página de pago con la Cajita de Payphone. Se monta sola (sin la app completa ni sesión):
 *   /pago/<paymentId>   muestra el resumen y la Cajita
 *   /pago/respuesta     Payphone vuelve aquí con ?id=&clientTransactionId= y se confirma el pago
 *
 * En el APK la Cajita no funciona dentro de la app: la app abre esta página en el navegador del
 * teléfono y el botón final vuelve a la app (App Links de www.roomiapms.site).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../supabase';
import { isNativeApp, PRODUCTION_ORIGIN } from '../utils/platform';

const BOX_JS = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js';
const BOX_CSS = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css';

type Summary = {
  kindLabel: string;
  amount: number;
  reservationId: string | null;
  hotel: string;
  room: string;
  fechaEntrada: string;
  fechaSalida: string;
};

type BoxConfig = {
  token: string;
  storeId: string;
  clientTransactionId: string;
  amount: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
  service: number;
  tip: number;
  currency: string;
  reference: string;
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Lee el mensaje de error de la función (también en respuestas 4xx/5xx) */
async function callPayphone(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('payphone', { body });
  if (data) return data;
  let payload: any = null;
  if (error && 'context' in error) {
    try { payload = await (error as any).context.json(); } catch { /* sin cuerpo */ }
  }
  return payload ?? { error: 'No pudimos comunicarnos con Roomia. Revisa tu conexión e inténtalo de nuevo.' };
}

function loadBoxAssets(): Promise<void> {
  if (!document.querySelector(`link[href="${BOX_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BOX_CSS;
    document.head.appendChild(link);
  }
  if ((window as any).PPaymentButtonBox) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${BOX_JS}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('No se pudo cargar la Cajita de Payphone.')));
    if (!existing) {
      script.type = 'module';
      script.src = BOX_JS;
      document.head.appendChild(script);
    }
  });
}

/** Payphone pide esta política de referrer en la página de la Cajita */
function setReferrerPolicy() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'referrer';
    document.head.appendChild(meta);
  }
  meta.content = 'origin-when-cross-origin';
}

/** Dirección para volver a Roomia: en el navegador del teléfono abre la app si está instalada */
const backHref = (section: 'mis-reservas' | 'mi-plan' = 'mis-reservas') => {
  const path = `/?seccion=${section}`;
  return isNativeApp() || window.location.hostname === 'localhost' ? path : `${PRODUCTION_ORIGIN}${path}`;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center px-4 py-8" style={{ paddingTop: 'calc(2rem + var(--safe-top))' }}>
      <a href={backHref()} className="mb-6 flex items-center gap-2 text-brand-navy1 font-bold text-lg">
        <img src="/RoomiaPMSLogoSinFondo.png" alt="Roomia PMS" className="h-10 w-auto" />
      </a>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 sm:p-6">{children}</div>
      <p className="mt-6 text-xs text-neutral-500 text-center max-w-md">
        El pago lo procesa Payphone. Roomia no ve ni guarda los datos de tu tarjeta.
      </p>
    </div>
  );
}

function SummaryCard({ s }: { s: Summary }) {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm space-y-1.5">
      <div className="flex justify-between gap-3"><span className="text-neutral-500">Concepto</span><span className="font-semibold text-right">{s.kindLabel}</span></div>
      {s.reservationId && <div className="flex justify-between gap-3"><span className="text-neutral-500">Reserva</span><span className="font-mono font-semibold">{s.reservationId}</span></div>}
      {s.hotel && <div className="flex justify-between gap-3"><span className="text-neutral-500">Establecimiento</span><span className="font-semibold text-right">{s.hotel}</span></div>}
      {s.room && <div className="flex justify-between gap-3"><span className="text-neutral-500">Alojamiento</span><span className="text-right">{s.room}</span></div>}
      {s.fechaEntrada && <div className="flex justify-between gap-3"><span className="text-neutral-500">Fechas</span><span>{s.fechaEntrada} → {s.fechaSalida}</span></div>}
      <div className="flex justify-between gap-3 pt-2 mt-2 border-t border-neutral-200">
        <span className="font-semibold">Total a pagar</span>
        <span className="text-xl font-extrabold text-brand-navy1">{usd(s.amount)}</span>
      </div>
    </div>
  );
}

/** Pagos del plan de un anfitrión (no de una reserva) */
const isPlanKind = (kind: unknown) => kind === 'plan' || kind === 'puesta_en_marcha';

const BackButton = ({ label = 'Volver a Roomia', section }: { label?: string; section?: 'mis-reservas' | 'mi-plan' }) => (
  <a href={backHref(section)} className="mt-5 block w-full text-center rounded-xl bg-brand-navy1 hover:bg-brand-navy2 text-white font-bold py-3">
    {label}
  </a>
);

// ---------------------------------------------------------------- /pago/<id>
function PayView({ paymentId }: { paymentId: string }) {
  const [state, setState] = useState<'cargando' | 'listo' | 'fin' | 'error'>('cargando');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const rendered = useRef(false);

  useEffect(() => {
    setReferrerPolicy();
    let cancelled = false;
    (async () => {
      const res = await callPayphone({ action: 'box', paymentId });
      if (cancelled) return;
      if (res.summary) setSummary(res.summary);
      if (res.error) { setMessage(res.error); setState('error'); return; }
      if (res.status !== 'creado' || !res.box) { setStatus(res.status); setState('fin'); return; }
      try {
        await loadBoxAssets();
        if (cancelled || rendered.current) return;
        rendered.current = true;
        const box: BoxConfig = res.box;
        const Ctor = (window as any).PPaymentButtonBox;
        new Ctor({ ...box, lang: 'es', defaultMethod: 'card', timeZone: -5 }).render('pp-button');
        setState('listo');
      } catch (e: any) {
        setMessage(e?.message || 'No se pudo cargar la Cajita de Payphone.');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [paymentId]);

  const finText: Record<string, string> = {
    aprobado: 'Este pago ya fue aprobado.',
    procesando: 'Este pago se está confirmando.',
    cancelado: 'Este pago no se completó. Vuelve a Roomia para intentarlo de nuevo.',
    expirado: 'Este enlace de pago venció (dura 10 minutos). Vuelve a Roomia y pulsa pagar otra vez.',
    error: 'Este pago necesita revisión del establecimiento.',
  };

  return (
    <Shell>
      <h1 className="text-xl font-extrabold text-brand-navy1 mb-4">Pagar reserva</h1>
      {summary && <SummaryCard s={summary} />}
      {state === 'cargando' && <p className="mt-5 text-sm text-neutral-500 text-center">Cargando el formulario de pago…</p>}
      {state === 'error' && (<><p className="mt-5 text-sm text-danger-600">{message}</p><BackButton /></>)}
      {state === 'fin' && (<><p className="mt-5 text-sm text-neutral-700">{finText[status] ?? 'Este pago ya no está disponible.'}</p><BackButton /></>)}
      <div id="pp-button" className={state === 'listo' ? 'mt-5' : 'hidden'} />
      {state === 'listo' && (
        <p className="mt-3 text-micro text-neutral-500 text-center">
          Tienes 10 minutos para completar el pago. Puedes pagar con tarjeta o con tu cuenta Payphone.
        </p>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- /pago/respuesta
function ResponseView() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') ?? '';
  const clientTransactionId = params.get('clientTransactionId') ?? '';
  const [state, setState] = useState<'confirmando' | 'aprobado' | 'cancelado' | 'error'>('confirmando');
  const [data, setData] = useState<any>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!id || id === '0' || !clientTransactionId) { setState('cancelado'); return; }
    (async () => {
      // "procesando" = otra pestaña o la app la está confirmando: se reintenta unos segundos
      for (let i = 0; i < 6; i++) {
        const res = await callPayphone({ action: 'confirm', id, clientTransactionId });
        if (res.status === 'procesando' || (res.error && i < 2)) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        setData(res);
        setState(res.status === 'aprobado' ? 'aprobado' : res.status === 'cancelado' ? 'cancelado' : 'error');
        return;
      }
      setData({ error: 'El pago sigue en proceso. Revisa tu reserva en Roomia en unos minutos.' });
      setState('error');
    })();
  }, [id, clientTransactionId]);

  return (
    <Shell>
      {state === 'confirmando' && (
        <div className="text-center py-6">
          <div className="mx-auto w-10 h-10 rounded-full border-4 border-neutral-200 border-t-brand-cyan animate-spin" />
          <p className="mt-4 font-semibold text-brand-navy1">Confirmando tu pago…</p>
          <p className="text-xs text-neutral-500 mt-1">No cierres esta página.</p>
        </div>
      )}
      {state === 'aprobado' && (
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-success-100 text-success-600 flex items-center justify-center text-3xl">✓</div>
          <h1 className="mt-3 text-xl font-extrabold text-brand-navy1">Pago aprobado</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {isPlanKind(data?.kind)
              ? 'Tu plan de Roomia PMS quedó al día. Te enviamos el comprobante por correo.'
              : 'Tu reserva quedó confirmada. Te enviamos el comprobante por correo.'}
          </p>
          <div className="mt-4 rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-left space-y-1.5">
            {data?.reservationId && <div className="flex justify-between"><span className="text-neutral-500">Reserva</span><span className="font-mono font-semibold">{data.reservationId}</span></div>}
            {typeof data?.amount === 'number' && <div className="flex justify-between"><span className="text-neutral-500">Pagado ahora</span><span className="font-semibold">{usd(data.amount)}</span></div>}
            {typeof data?.montoPendiente === 'number' && data.montoPendiente > 0 && (
              <div className="flex justify-between"><span className="text-neutral-500">Saldo pendiente</span><span className="font-semibold">${Number(data.montoPendiente).toFixed(2)}</span></div>
            )}
          </div>
          {isPlanKind(data?.kind)
            ? <BackButton label="Ver mi plan" section="mi-plan" />
            : <BackButton label="Ver mis reservas" />}
        </div>
      )}
      {state === 'cancelado' && (
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center text-3xl">!</div>
          <h1 className="mt-3 text-xl font-extrabold text-brand-navy1">Pago no completado</h1>
          <p className="mt-1 text-sm text-neutral-600">{data?.detail || (isPlanKind(data?.kind) ? 'No se realizó ningún cobro. Puedes intentarlo de nuevo desde Mi plan.' : 'No se realizó ningún cobro. Puedes intentarlo de nuevo desde tu reserva.')}</p>
          <BackButton label="Volver e intentar de nuevo" section={isPlanKind(data?.kind) ? 'mi-plan' : undefined} />
        </div>
      )}
      {state === 'error' && (
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-brand-navy1">No pudimos confirmar el pago</h1>
          <p className="mt-2 text-sm text-neutral-600">{data?.detail || data?.error || 'Inténtalo de nuevo en unos segundos.'}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-xl border border-neutral-300 py-3 font-semibold text-neutral-700">
            Reintentar
          </button>
          <BackButton />
        </div>
      )}
    </Shell>
  );
}

export default function PaymentPage() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/pago/respuesta') return <ResponseView />;
  const paymentId = decodeURIComponent(path.split('/')[2] || '');
  return <PayView paymentId={paymentId} />;
}
