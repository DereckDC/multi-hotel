/**
 * Factura electrónica del SRI de una reserva.
 *  · Sin factura: vista previa (líneas, total y cliente tomado del huésped) y "Emitir factura".
 *    Si el establecimiento tiene la emisión automática, la factura se crea sola al hacer check-out.
 *  · Con factura: estado ante el SRI, mensajes, RIDE y XML, reintentar, corregir y reenviar,
 *    descartar (si no llegó al SRI) y reenviar el correo.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileCode2, Loader2, Mail, ReceiptText, RefreshCw, Send, Trash2 } from 'lucide-react';
import type { Hotel, Reservation, Room, User } from '../types';
import {
  CORREO_ESTADO, ESTADOS_COMPROBANTE, FORMAS_PAGO, MAX_CONSUMIDOR_FINAL, TARIFAS_IVA, TIPOS_IDENTIFICACION,
  numeroFactura, validarIdentificacion, vistaPreviaFactura, type CompradorFactura, type TipoIdentificacion
} from '../utils/sri';
import {
  anularComprobante, emitirFactura, fetchComprobantes, fetchEmisor, reenviarCorreo, reintentarComprobante,
  type SriComprobante, type SriEmisor
} from '../utils/sriApi';
import { descargarRide, descargarXml } from '../utils/sriRide';
import { notify } from '../utils/notify';
import { friendlyError } from '../utils/errors';
import { Badge, Button, Field, Input, Modal, Select, type BadgeTone } from './ui';

const TONE: Record<string, BadgeTone> = { ok: 'success', warn: 'warning', bad: 'danger', info: 'info' };
const EMAIL_RE = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;
const usd = (n: number | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`;
const mensajeError = (e: unknown) => (e instanceof Error && e.message ? e.message : friendlyError(e));

export function EstadoBadge({ c }: { c: SriComprobante }) {
  const e = ESTADOS_COMPROBANTE[c.estado] ?? { label: c.estado, tone: 'info' };
  return <Badge tone={TONE[e.tone]}>{e.label}</Badge>;
}

function erroresComprador(c: CompradorFactura, total: number): Record<string, string | null> {
  return {
    identificacion: validarIdentificacion(c.tipoIdentificacion, c.identificacion) ??
      (c.tipoIdentificacion === '07' && total > MAX_CONSUMIDOR_FINAL ? `Consumidor final solo hasta $${MAX_CONSUMIDOR_FINAL}.` : null),
    razonSocial: c.razonSocial.trim() ? null : 'Escribe el nombre o la razón social.',
    email: c.email && !EMAIL_RE.test(c.email) ? 'El correo no es válido.' : null
  };
}

function CompradorForm({ value, onChange, total, errors }: {
  value: CompradorFactura;
  onChange: (c: CompradorFactura) => void;
  total: number;
  errors: Record<string, string | null>;
}) {
  const set = (patch: Partial<CompradorFactura>) => onChange({ ...value, ...patch });
  const cf = value.tipoIdentificacion === '07';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tipo de identificación" required>
        <Select
          value={value.tipoIdentificacion}
          onChange={e => {
            const tipo = e.target.value as TipoIdentificacion;
            set(tipo === '07'
              ? { tipoIdentificacion: tipo, identificacion: '9999999999999', razonSocial: 'CONSUMIDOR FINAL' }
              : { tipoIdentificacion: tipo, identificacion: cf ? '' : value.identificacion, razonSocial: cf ? '' : value.razonSocial });
          }}
        >
          {TIPOS_IDENTIFICACION.map(t => (
            <option key={t.value} value={t.value} disabled={t.value === '07' && total > MAX_CONSUMIDOR_FINAL}>
              {t.label}{t.value === '07' && total > MAX_CONSUMIDOR_FINAL ? ` (hasta $${MAX_CONSUMIDOR_FINAL})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Número" required error={errors.identificacion}>
        <Input value={value.identificacion} disabled={cf} maxLength={20} invalid={!!errors.identificacion}
          inputMode={['04', '05'].includes(value.tipoIdentificacion) ? 'numeric' : 'text'}
          onChange={e => set({ identificacion: e.target.value.trim() })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Nombre o razón social" required error={errors.razonSocial}>
          <Input value={value.razonSocial} disabled={cf} maxLength={300} invalid={!!errors.razonSocial} onChange={e => set({ razonSocial: e.target.value })} />
        </Field>
      </div>
      <Field label="Correo" hint="Aquí llega la factura" error={errors.email}>
        <Input type="email" value={value.email ?? ''} maxLength={254} invalid={!!errors.email} onChange={e => set({ email: e.target.value.trim() })} />
      </Field>
      {!cf && (
        <Field label="Dirección">
          <Input value={value.direccion ?? ''} maxLength={300} onChange={e => set({ direccion: e.target.value })} />
        </Field>
      )}
    </div>
  );
}

const ResumenCliente = ({ c }: { c: CompradorFactura }) => (
  <p className="text-sm text-neutral-700">
    <strong>{c.razonSocial || 'Sin nombre'}</strong>
    <span className="text-neutral-500"> · {TIPOS_IDENTIFICACION.find(t => t.value === c.tipoIdentificacion)?.label} {c.tipoIdentificacion !== '07' ? c.identificacion : ''}</span>
    {c.email && <span className="block text-neutral-500">{c.email}</span>}
  </p>
);

/** Estado de una factura y sus acciones (también se usa en la lista de Facturación SRI) */
export function ComprobantePanel({ comprobante, onChange }: { comprobante: SriComprobante; onChange: (c: SriComprobante) => void }) {
  const c = comprobante;
  const [busy, setBusy] = useState<string | null>(null);
  const [correo, setCorreo] = useState(c.comprador?.email ?? '');
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [comprador, setComprador] = useState<CompradorFactura | null>(c.comprador);
  const [formaPago, setFormaPago] = useState(c.formaPago ?? '19');
  const info = ESTADOS_COMPROBANTE[c.estado];
  const total = Number(c.total) || 0;
  const errores = comprador ? erroresComprador(comprador, total) : {};

  const run = async (kind: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      notify.error(mensajeError(e));
    } finally {
      setBusy(null);
    }
  };
  const actualizar = (r: SriComprobante | null, ok?: string) => {
    if (!r) return;
    onChange(r);
    if (r.estado === 'autorizado') notify.success(ok ?? 'Factura autorizada por el SRI.');
    else if (r.estado === 'devuelta' || r.estado === 'no_autorizado') notify.error('El SRI no aceptó la factura. Revisa el mensaje.');
    else notify.info(ESTADOS_COMPROBANTE[r.estado]?.detalle ?? r.estado);
  };

  const enCola = ['pendiente', 'error', 'recibida'].includes(c.estado);
  const corregible = ['devuelta', 'no_autorizado'].includes(c.estado);
  // Una factura no autorizada se corrige y se reenvía con el mismo número aunque el SRI la haya recibido
  const editable = !c.recibido || c.estado === 'no_autorizado';
  const descartable = editable && ['pendiente', 'error', 'devuelta', 'no_autorizado'].includes(c.estado);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-base font-bold text-brand-navy1">{numeroFactura(c.estab, c.ptoEmi, c.secuencial)}</p>
          {c.comprador && <p className="text-sm text-neutral-600">{c.comprador.razonSocial} · {c.comprador.identificacion}</p>}
          <p className="text-sm text-neutral-500">
            {c.fechaEmision.split('-').reverse().join('/')}{c.total !== null ? ` · ${usd(c.total)}` : ''}
            {c.origen === 'automatica' ? ' · emitida al hacer check-out' : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <EstadoBadge c={c} />
          <Badge tone={c.ambiente === '2' ? 'brand' : 'warning'}>{c.ambiente === '2' ? 'Producción' : 'Pruebas'}</Badge>
        </div>
      </div>

      <p className="text-sm text-neutral-600">
        {info?.detalle}
        {c.intentos > 1 && ` Intentos: ${c.intentos}.`}
        {c.estado === 'autorizado' && ` ${CORREO_ESTADO[c.correoEstado] ?? ''}.`}
      </p>

      {c.anulacionPortal && (
        <p className="flex gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          La reserva se canceló con esta factura autorizada: anúlala en SRI en línea → Facturación electrónica → Anulación de comprobantes.
        </p>
      )}

      {c.mensajes.length > 0 && c.estado !== 'autorizado' && (
        <ul className="space-y-1.5">
          {c.mensajes.map((m, i) => (
            <li key={i} className={`rounded-xl border px-3 py-2 text-xs ${m.tipo === 'ERROR' ? 'border-danger-200 bg-danger-50 text-danger-800' : 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
              <span className="font-bold">{/^\d+$/.test(m.identificador) ? `Error ${m.identificador}: ` : ''}{m.mensaje}</span>
              {m.informacionAdicional && <span className="mt-0.5 block">{m.informacionAdicional}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {(c.xmlAutorizado || c.xmlFirmado) && (
          <>
            <Button variant="secondary" size="sm" loading={busy === 'pdf'} leftIcon={<Download className="h-4 w-4" />} onClick={() => run('pdf', () => descargarRide(c))}>RIDE</Button>
            <Button variant="secondary" size="sm" loading={busy === 'xml'} leftIcon={<FileCode2 className="h-4 w-4" />} onClick={() => run('xml', () => descargarXml(c))}>XML</Button>
          </>
        )}
        {enCola && (
          <Button size="sm" loading={busy === 'reintentar'} leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => run('reintentar', async () => actualizar(await reintentarComprobante(c.id)))}>
            Enviar ahora
          </Button>
        )}
        {corregible && !corrigiendo && (
          <Button size="sm" leftIcon={<Send className="h-4 w-4" />} onClick={() => setCorrigiendo(true)}>Corregir y reenviar</Button>
        )}
        {descartable && (
          <Button size="sm" variant="ghost" loading={busy === 'anular'} leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              if (!window.confirm('¿Descartar esta factura? No llegó al SRI; podrás emitir una nueva para la reserva.')) return;
              run('anular', async () => {
                const r = await anularComprobante(c.id);
                if (r) onChange(r);
              });
            }}>
            Descartar
          </Button>
        )}
      </div>

      {corrigiendo && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
          {!editable ? (
            <p className="text-sm text-neutral-600">El SRI ya recibió esta factura: se vuelve a consultar su autorización sin cambiar datos.</p>
          ) : (
            <>
              <p className="text-sm text-neutral-600">Se reenvía con el mismo número y clave de acceso.</p>
              {comprador && <CompradorForm value={comprador} onChange={setComprador} total={total} errors={errores} />}
              <Field label="Forma de pago" required>
                <Select value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                  {FORMAS_PAGO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              </Field>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCorrigiendo(false)}>Cancelar</Button>
            <Button size="sm" loading={busy === 'reenviar'} disabled={Object.values(errores).some(Boolean)} leftIcon={<Send className="h-4 w-4" />}
              onClick={() => run('reenviar', async () => {
                actualizar(await reintentarComprobante(c.id, !editable ? {} : { comprador: comprador ?? undefined, formaPago }));
                setCorrigiendo(false);
              })}>
              Reenviar
            </Button>
          </div>
        </div>
      )}

      {c.estado === 'autorizado' && (
        <Field label="Enviar la factura a" hint={c.correoEnviadoAt ? `Última vez: ${new Date(c.correoEnviadoAt).toLocaleString('es-EC')}` : 'Se adjuntan el RIDE y el XML'}>
          <div className="flex gap-2">
            <Input type="email" value={correo} onChange={e => setCorreo(e.target.value.trim())} className="flex-1" />
            <Button loading={busy === 'correo'} disabled={!EMAIL_RE.test(correo)} leftIcon={<Mail className="h-4 w-4" />}
              onClick={() => run('correo', async () => {
                const r = await reenviarCorreo(c.id, correo);
                if (r) onChange(r);
                notify.success(`Factura enviada a ${correo}.`);
              })}>
              Enviar
            </Button>
          </div>
        </Field>
      )}
    </div>
  );
}

export default function FacturaSriModal({ reservation, hotel, room, guest, onClose }: {
  reservation: Reservation;
  hotel: Hotel | undefined;
  room: Room | undefined;
  guest: User | undefined;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emisor, setEmisor] = useState<SriEmisor | null>(null);
  const [comprobantes, setComprobantes] = useState<SriComprobante[]>([]);
  const previa = useMemo(() => vistaPreviaFactura(reservation, hotel, room, guest), [reservation, hotel, room, guest]);
  const [comprador, setComprador] = useState<CompradorFactura>(previa.comprador);
  const [editarCliente, setEditarCliente] = useState(false);
  const [formaPago, setFormaPago] = useState('19');
  const [emitiendo, setEmitiendo] = useState(false);
  const errores = erroresComprador(comprador, previa.total);
  const faltanDatos = Object.values(errores).some(Boolean);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [e, cs] = await Promise.all([fetchEmisor(reservation.hotelId), fetchComprobantes({ reservationId: reservation.id })]);
        if (!alive) return;
        setEmisor(e);
        if (e) setFormaPago(e.formaPago);
        setComprobantes(cs);
      } catch (e) {
        if (alive) setLoadError(mensajeError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reservation.hotelId, reservation.id]);

  // Si faltan datos del cliente, el formulario se abre solo
  useEffect(() => {
    if (faltanDatos) setEditarCliente(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vigente = comprobantes.find(c => c.estado !== 'anulado' && c.ambiente === emisor?.ambiente) ?? null;
  const tarifa = emisor ? TARIFAS_IVA[emisor.codigoIva] ?? 15 : 15;
  const base = Math.round((previa.total / (1 + tarifa / 100)) * 100) / 100;
  const listo = !!emisor?.certTitular;

  const emitir = async () => {
    if (faltanDatos) {
      setEditarCliente(true);
      return;
    }
    setEmitiendo(true);
    try {
      const c = await emitirFactura(reservation.id, { comprador, formaPago });
      if (!c) return;
      setComprobantes(prev => [c, ...prev.filter(p => p.id !== c.id)]);
      if (c.estado === 'autorizado') notify.success('Factura autorizada por el SRI.');
      else if (c.estado === 'devuelta' || c.estado === 'no_autorizado') notify.error('El SRI no aceptó la factura. Revisa el mensaje.');
      else notify.info(ESTADOS_COMPROBANTE[c.estado]?.detalle ?? 'Factura enviada.');
    } catch (e) {
      notify.error(mensajeError(e));
    } finally {
      setEmitiendo(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      layer="critical"
      title="Factura electrónica"
      subtitle={`Reserva ${reservation.id}${hotel?.nombre ? ` · ${hotel.nombre}` : ''}`}
      footer={!loading && listo && !vigente ? (
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={emitiendo} disabled={!previa.items.length} leftIcon={<ReceiptText className="h-4 w-4" />} onClick={emitir}>
            {emitiendo ? 'Enviando al SRI…' : 'Emitir factura'}
          </Button>
        </div>
      ) : undefined}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : loadError ? (
        <p className="text-sm text-danger-700">{loadError}</p>
      ) : !listo ? (
        <div className="flex gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>Este establecimiento aún no factura electrónicamente. El administrador debe cargar su firma y sus datos en <strong>Facturación SRI</strong>.</p>
        </div>
      ) : vigente ? (
        <ComprobantePanel comprobante={vigente} onChange={c => setComprobantes(prev => prev.map(p => (p.id === c.id ? c : p)))} />
      ) : (
        <div className="space-y-5">
          {emisor?.ambiente === '1' && (
            <p className="rounded-xl border border-info-100 bg-info-50 p-3 text-sm text-info-700">Ambiente de <strong>pruebas</strong>: la factura no tiene validez tributaria.</p>
          )}
          {emisor?.activo && (
            <p className="text-sm text-neutral-500">Este establecimiento factura solo al hacer check-out. Emítela aquí si el cliente la necesita antes.</p>
          )}

          <section className="space-y-2">
            {previa.items.length === 0 ? (
              <p className="text-sm text-neutral-500">Esta reserva no tiene valores que facturar.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                {previa.items.map(it => (
                  <li key={it.codigo} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 text-neutral-700">{it.descripcion}</span>
                    <span className="font-semibold text-neutral-800">{usd(it.importe)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-right text-sm text-neutral-600">
              <p>Subtotal {usd(base)} · IVA {tarifa}% {usd(previa.total - base)}</p>
              <p className="text-base font-bold text-brand-navy1">Total {usd(previa.total)}</p>
              {previa.garantia > 0 && <p className="text-xs text-neutral-500">La garantía ({usd(previa.garantia)}) no se factura: es reembolsable.</p>}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-sm font-bold text-brand-navy1">Cliente</h5>
              {!editarCliente && <Button size="sm" variant="ghost" onClick={() => setEditarCliente(true)}>Cambiar</Button>}
            </div>
            {editarCliente
              ? <CompradorForm value={comprador} onChange={setComprador} total={previa.total} errors={errores} />
              : <ResumenCliente c={comprador} />}
          </section>

          <Field label="Forma de pago">
            <Select value={formaPago} onChange={e => setFormaPago(e.target.value)}>
              {FORMAS_PAGO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
