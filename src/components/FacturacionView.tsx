/**
 * "Facturación SRI" del administrador: firma electrónica, datos tributarios, emisión automática
 * al hacer check-out, prueba de conexión y facturas emitidas con su estado ante el SRI.
 * Cada establecimiento factura con su propio RUC y firma; Roomia emite en su nombre.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Loader2, PlugZap, RefreshCw, Save, ShieldCheck, Upload, XCircle } from 'lucide-react';
import type { Hotel, User } from '../types';
import { CORREO_ESTADO, ESTADOS_COMPROBANTE, FORMAS_PAGO, isValidRuc, numeroFactura, type EstadoComprobante, type Regimen } from '../utils/sri';
import {
  fetchComprobantes, fetchEmisor, fileToBase64, guardarEmisor, probarConexion, subirFirma,
  type SriComprobante, type SriEmisor
} from '../utils/sriApi';
import { notify } from '../utils/notify';
import { friendlyError } from '../utils/errors';
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select } from './ui';
import { ComprobantePanel, EstadoBadge } from './FacturaSriModal';

const VACIO: SriEmisor = {
  hotelId: '', activo: false, ruc: '', razonSocial: '', nombreComercial: '', dirMatriz: '', dirEstablecimiento: '',
  estab: '001', ptoEmi: '001', obligadoContabilidad: false, contribuyenteEspecial: '', agenteRetencion: '',
  regimen: 'general', ambiente: '1', codigoIva: '4', formaPago: '19', correoCopia: '', secuencialPruebas: 1,
  secuencialProduccion: 1, certTitular: null, certEmisor: null, certValidoHasta: null, certSubidoAt: null, certRucOk: null
};

const IVAS = [
  { value: '4', label: 'IVA 15 % (hospedaje y servicios)' },
  { value: '0', label: 'IVA 0 % (p. ej. arriendo de vivienda)' },
  { value: '6', label: 'No objeto de IVA' },
  { value: '7', label: 'Exento de IVA' }
];

const FILTROS: Array<{ value: string; label: string; estados?: EstadoComprobante[] }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'autorizadas', label: 'Autorizadas', estados: ['autorizado'] },
  { value: 'tramite', label: 'En trámite', estados: ['pendiente', 'procesando', 'recibida', 'error'] },
  { value: 'rechazadas', label: 'Por corregir', estados: ['devuelta', 'no_autorizado'] }
];

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const mensajeError = (e: unknown) => (e instanceof Error && e.message ? e.message : friendlyError(e));

export default function FacturacionView({ activeUser, hotels }: { activeUser: User; hotels: Hotel[] }) {
  const isSuper = activeUser.rol === 'super_admin';
  const opciones = useMemo(() => (isSuper ? hotels : hotels.filter(h => h.id === activeUser.hotelId)), [hotels, isSuper, activeUser.hotelId]);
  const [hotelId, setHotelId] = useState(opciones[0]?.id ?? '');
  const hotel = hotels.find(h => h.id === hotelId);

  const [loading, setLoading] = useState(true);
  const [emisor, setEmisor] = useState<SriEmisor | null>(null);
  const [form, setForm] = useState<SriEmisor>(VACIO);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<Array<{ paso: string; ok: boolean; detalle: string }> | null>(null);
  const [comprobantes, setComprobantes] = useState<SriComprobante[]>([]);
  const [filtro, setFiltro] = useState('todas');
  const [abierto, setAbierto] = useState<SriComprobante | null>(null);
  const [avanzado, setAvanzado] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hotelId && opciones[0]) setHotelId(opciones[0].id);
  }, [opciones, hotelId]);

  const recargarComprobantes = useCallback(async () => {
    if (!hotelId) return;
    try {
      setComprobantes(await fetchComprobantes({ hotelId }));
    } catch (e) {
      notify.error(mensajeError(e));
    }
  }, [hotelId]);

  useEffect(() => {
    if (!hotelId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setChecks(null);
    (async () => {
      try {
        const [e, cs] = await Promise.all([fetchEmisor(hotelId), fetchComprobantes({ hotelId })]);
        if (!alive) return;
        setEmisor(e);
        setForm(e ?? { ...VACIO, hotelId, nombreComercial: hotel?.nombre ?? '', dirMatriz: hotel?.ubicacion ?? '' });
        setComprobantes(cs);
      } catch (e) {
        if (alive) notify.error(mensajeError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  // Mientras haya facturas en trámite, la lista se actualiza sola
  const enTramite = comprobantes.some(c => ['pendiente', 'procesando', 'recibida'].includes(c.estado));
  useEffect(() => {
    if (!enTramite) return;
    const t = setInterval(recargarComprobantes, 20000);
    return () => clearInterval(t);
  }, [enTramite, recargarComprobantes]);

  const set = (patch: Partial<SriEmisor>) => setForm(f => ({ ...f, ...patch }));
  const firmaVigente = !!emisor?.certValidoHasta && new Date(emisor.certValidoHasta) > new Date();
  const diasFirma = emisor?.certValidoHasta ? Math.floor((new Date(emisor.certValidoHasta).getTime() - Date.now()) / 86400000) : null;

  const guardar = async () => {
    const e: Record<string, string | null> = {
      ruc: isValidRuc(form.ruc) ? null : 'RUC no válido (13 dígitos que terminan en 001 o más).',
      razonSocial: form.razonSocial.trim() ? null : 'Escribe la razón social tal como consta en el RUC.',
      dirMatriz: form.dirMatriz.trim() ? null : 'Escribe la dirección de la matriz.',
      estab: /^\d{3}$/.test(form.estab) && form.estab !== '000' ? null : '3 dígitos, ej. 001.',
      ptoEmi: /^\d{3}$/.test(form.ptoEmi) && form.ptoEmi !== '000' ? null : '3 dígitos, ej. 001.'
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      if (e.estab || e.ptoEmi) setAvanzado(true);
      return;
    }
    if (form.ambiente === '2' && emisor?.ambiente !== '2' &&
      !window.confirm('¿Pasar a producción? Desde ahora las facturas serán reales y tendrán validez tributaria.')) return;
    setSaving(true);
    try {
      const r = await guardarEmisor(hotelId, form);
      setEmisor(r);
      setForm(r);
      notify.success('Facturación guardada.');
    } catch (err) {
      notify.error(mensajeError(err));
    } finally {
      setSaving(false);
    }
  };

  const subir = async () => {
    if (!file || !password) return;
    if (!/\.(p12|pfx)$/i.test(file.name)) {
      notify.error('Selecciona el archivo de firma con extensión .p12 o .pfx.');
      return;
    }
    setUploading(true);
    try {
      const r = await subirFirma(hotelId, await fileToBase64(file), password);
      setEmisor(r);
      setForm(f => ({ ...f, certTitular: r.certTitular, certEmisor: r.certEmisor, certValidoHasta: r.certValidoHasta, certSubidoAt: r.certSubidoAt, certRucOk: r.certRucOk }));
      setFile(null);
      setPassword('');
      if (fileInput.current) fileInput.current.value = '';
      notify.success('Firma electrónica guardada de forma segura.');
    } catch (err) {
      notify.error(mensajeError(err));
    } finally {
      setUploading(false);
    }
  };

  const probar = async () => {
    setTesting(true);
    setChecks(null);
    try {
      setChecks((await probarConexion(hotelId)).checks);
    } catch (err) {
      notify.error(mensajeError(err));
    } finally {
      setTesting(false);
    }
  };

  const estadosFiltro = FILTROS.find(x => x.value === filtro)?.estados;
  const visibles = comprobantes.filter(c => !estadosFiltro || estadosFiltro.includes(c.estado));
  const autorizadasMes = comprobantes.filter(c => c.estado === 'autorizado' && c.fechaEmision.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const porCorregir = comprobantes.filter(c => ['devuelta', 'no_autorizado'].includes(c.estado)).length;

  if (!opciones.length) {
    return <Card><p className="text-sm text-neutral-500">No tienes un establecimiento asignado para configurar la facturación.</p></Card>;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Facturación electrónica"
        description="Firma electrónica, datos tributarios y facturas enviadas al SRI."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {opciones.length > 1 && (
              <Select value={hotelId} onChange={e => setHotelId(e.target.value)} className="min-w-56">
                {opciones.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </Select>
            )}
            {!loading && <Badge tone={emisor?.activo ? 'success' : 'neutral'}>{emisor?.activo ? 'Emisión automática activa' : 'Emisión automática desactivada'}</Badge>}
          </div>
        }
      />

      {loading ? (
        <Card><div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div></Card>
      ) : (
        <>
          {emisor?.ambiente === '1' && emisor.activo && (
            <div className="flex gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p><strong>Estás en ambiente de pruebas.</strong> Las facturas van al SRI de pruebas y no tienen validez tributaria. Cuando todo esté correcto, cambia a Producción.</p>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Firma electrónica" description="El archivo .p12 que te entregó la entidad certificadora (Banco Central, Security Data, ANF, Uanataca…).">
              {emisor?.certTitular ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-neutral-500">Titular</dt><dd className="font-semibold text-neutral-800">{emisor.certTitular}</dd>
                  <dt className="text-neutral-500">Emitida por</dt><dd className="text-neutral-700">{emisor.certEmisor}</dd>
                  <dt className="text-neutral-500">Vence</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-neutral-700">
                    {fecha(emisor.certValidoHasta)}
                    <Badge tone={!firmaVigente ? 'danger' : (diasFirma ?? 0) <= 30 ? 'warning' : 'success'}>
                      {!firmaVigente ? 'Vencida' : (diasFirma ?? 0) <= 30 ? `Vence en ${diasFirma} días` : 'Vigente'}
                    </Badge>
                  </dd>
                  <dt className="text-neutral-500">RUC</dt>
                  <dd><Badge tone={emisor.certRucOk ? 'success' : 'warning'}>{emisor.certRucOk ? 'Coincide con la firma' : 'No se pudo verificar'}</Badge></dd>
                </dl>
              ) : (
                <p className="text-sm text-neutral-500">{emisor ? 'Aún no has cargado la firma.' : 'Guarda primero los datos tributarios.'}</p>
              )}
              {emisor && (
                <div className="space-y-3">
                  <Field label={emisor.certTitular ? 'Reemplazar firma (.p12)' : 'Archivo de firma (.p12)'}>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".p12,.pfx,application/x-pkcs12"
                      onChange={e => setFile(e.target.files?.[0] ?? null)}
                      className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                    />
                  </Field>
                  <Field label="Clave de la firma" hint="Se guarda cifrada en el servidor y nunca vuelve a mostrarse.">
                    <Input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
                  </Field>
                  <div className="flex justify-end">
                    <Button loading={uploading} disabled={!file || !password} leftIcon={<Upload className="h-4 w-4" />} onClick={subir}>
                      {uploading ? 'Verificando…' : 'Cargar firma'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Datos tributarios" description="Tal como constan en el RUC.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="RUC" required error={errors.ruc}>
                  <Input value={form.ruc} inputMode="numeric" maxLength={13} invalid={!!errors.ruc} onChange={e => set({ ruc: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label="Ambiente del SRI">
                  <Select value={form.ambiente} onChange={e => set({ ambiente: e.target.value as '1' | '2' })}>
                    <option value="1">Pruebas (sin validez tributaria)</option>
                    <option value="2">Producción</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Razón social" required error={errors.razonSocial}>
                    <Input value={form.razonSocial} maxLength={300} invalid={!!errors.razonSocial} onChange={e => set({ razonSocial: e.target.value })} />
                  </Field>
                </div>
                <Field label="Nombre comercial">
                  <Input value={form.nombreComercial} maxLength={300} onChange={e => set({ nombreComercial: e.target.value })} />
                </Field>
                <Field label="Régimen">
                  <Select value={form.regimen} onChange={e => set({ regimen: e.target.value as Regimen })}>
                    <option value="general">Régimen general</option>
                    <option value="rimpe_emprendedor">RIMPE · Emprendedor</option>
                    <option value="rimpe_negocio_popular">RIMPE · Negocio popular</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Dirección matriz" required error={errors.dirMatriz}>
                    <Input value={form.dirMatriz} maxLength={300} invalid={!!errors.dirMatriz} onChange={e => set({ dirMatriz: e.target.value })} />
                  </Field>
                </div>
                <Field label="Obligado a llevar contabilidad">
                  <Select value={form.obligadoContabilidad ? 'SI' : 'NO'} onChange={e => set({ obligadoContabilidad: e.target.value === 'SI' })}>
                    <option value="NO">No</option>
                    <option value="SI">Sí</option>
                  </Select>
                </Field>
                <Field label="Copia de cada factura a" hint="Opcional, p. ej. tu contador">
                  <Input type="email" value={form.correoCopia} maxLength={254} onChange={e => set({ correoCopia: e.target.value.trim() })} />
                </Field>
              </div>

              <button type="button" className="text-xs font-semibold text-brand-cyan underline" onClick={() => setAvanzado(v => !v)}>
                {avanzado ? 'Ocultar opciones avanzadas' : 'Opciones avanzadas'}
              </button>
              {avanzado && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Establecimiento" error={errors.estab}>
                    <Input value={form.estab} inputMode="numeric" maxLength={3} invalid={!!errors.estab} onChange={e => set({ estab: e.target.value.replace(/\D/g, '') })} />
                  </Field>
                  <Field label="Punto de emisión" error={errors.ptoEmi}>
                    <Input value={form.ptoEmi} inputMode="numeric" maxLength={3} invalid={!!errors.ptoEmi} onChange={e => set({ ptoEmi: e.target.value.replace(/\D/g, '') })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Dirección del establecimiento" hint="Si es distinta de la matriz">
                      <Input value={form.dirEstablecimiento} maxLength={300} onChange={e => set({ dirEstablecimiento: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Tarifa de IVA">
                    <Select value={form.codigoIva} onChange={e => set({ codigoIva: e.target.value })}>
                      {IVAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Forma de pago habitual">
                    <Select value={form.formaPago} onChange={e => set({ formaPago: e.target.value })}>
                      {FORMAS_PAGO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Contribuyente especial (N.º resolución)">
                    <Input value={form.contribuyenteEspecial} maxLength={13} placeholder="Opcional" onChange={e => set({ contribuyenteEspecial: e.target.value.trim() })} />
                  </Field>
                  <Field label="Agente de retención (N.º resolución)">
                    <Input value={form.agenteRetencion} inputMode="numeric" maxLength={8} placeholder="Opcional" onChange={e => set({ agenteRetencion: e.target.value.replace(/\D/g, '') })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Siguiente secuencial en producción" hint="Cámbialo solo si ya facturabas con esta serie en otro sistema">
                      <Input type="number" min={1} value={form.secuencialProduccion} onChange={e => set({ secuencialProduccion: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-cyan" checked={form.activo} disabled={!firmaVigente}
                  onChange={e => set({ activo: e.target.checked })} />
                <span>
                  <strong>Emitir la factura automáticamente al hacer check-out</strong>
                  <span className="block text-neutral-500">{firmaVigente ? 'Se envía al SRI y al correo del huésped sin que tengas que hacer nada.' : 'Carga primero una firma vigente.'}</span>
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" loading={testing} disabled={!emisor} leftIcon={<PlugZap className="h-4 w-4" />} onClick={probar}>
                  {testing ? 'Probando…' : 'Probar conexión con el SRI'}
                </Button>
                <Button loading={saving} leftIcon={<Save className="h-4 w-4" />} onClick={guardar}>Guardar</Button>
              </div>
              {checks && (
                <ul className="space-y-1.5">
                  {checks.map(c => (
                    <li key={c.paso} className="flex items-start gap-2 text-sm">
                      {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />}
                      <span><strong className="text-neutral-800">{c.paso}:</strong> <span className="text-neutral-600">{c.detalle}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card
            title="Facturas"
            description={`${autorizadasMes} autorizadas este mes${porCorregir ? ` · ${porCorregir} por corregir` : ''}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Select size="sm" value={filtro} onChange={e => setFiltro(e.target.value)}>
                  {FILTROS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
                <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={recargarComprobantes}>Actualizar</Button>
              </div>
            }
          >
            {visibles.length === 0 ? (
              <p className="text-sm text-neutral-500">{comprobantes.length ? 'No hay facturas con este filtro.' : 'Todavía no hay facturas. Se crean al hacer check-out o con el botón Factura SRI de la reserva.'}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-neutral-200 text-micro font-bold uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Número</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {visibles.map(c => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {numeroFactura(c.estab, c.ptoEmi, c.secuencial)}
                          {c.ambiente === '1' && <span className="ml-1 text-micro font-bold text-warning-700">PRUEBA</span>}
                        </td>
                        <td className="px-3 py-2 text-neutral-600">{c.fechaEmision.split('-').reverse().join('/')}</td>
                        <td className="px-3 py-2 text-neutral-700">
                          {c.comprador?.razonSocial ?? '—'}
                          {c.estado === 'autorizado' && <span className="block text-micro text-neutral-500">{CORREO_ESTADO[c.correoEstado]}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{c.total !== null ? `$${c.total.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2">
                          <EstadoBadge c={c} />
                          {c.anulacionPortal && <span className="mt-1 block text-micro font-bold text-warning-700">Anular en SRI en línea</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="secondary" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setAbierto(c)}>Ver</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {emisor?.certTitular && (
            <p className="flex items-center gap-2 text-xs text-neutral-500">
              <ShieldCheck className="h-4 w-4" /> Las facturas que no llegan al SRI por fallas de conexión se reintentan solas, sin duplicarse.
            </p>
          )}
        </>
      )}

      {abierto && (
        <Modal open onClose={() => setAbierto(null)} size="lg" title="Factura electrónica" subtitle={ESTADOS_COMPROBANTE[abierto.estado]?.label}>
          <ComprobantePanel
            comprobante={abierto}
            onChange={c => {
              setAbierto(c);
              setComprobantes(prev => prev.map(p => (p.id === c.id ? c : p)));
            }}
          />
        </Modal>
      )}
    </div>
  );
}
