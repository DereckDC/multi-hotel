import React, { useMemo, useState } from 'react';
import { X, RefreshCw, Copy, Check, Link2, Trash2, AlertTriangle } from 'lucide-react';
import type { ExternalBlock, Hotel, IcalFeed, IcalPlatform, Room } from '../types';
import { fullPropertyRoomId } from '../supabase';
import { Button, Modal } from './ui';
import {
  ICAL_PLATFORMS,
  PLATFORM_LABEL,
  buildExportUrl,
  connectPlatform,
  disconnectPlatform,
  maskImportUrl,
  regenerateExportToken,
  saveImportUrl,
  syncFeedNow,
  timeAgo
} from '../services/ical';

interface IcalSyncModalProps {
  hotel: Hotel;
  /** null = inmueble completo (casa o departamento) */
  room: Room | null;
  feeds: IcalFeed[];
  blocks: ExternalBlock[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

const PLATFORM_HELP: Record<IcalPlatform, { importHint: string; exportHint: string }> = {
  airbnb: {
    importHint: 'En Airbnb, abre el calendario de tu anuncio, busca la opción para exportar el calendario y copia el enlace iCal.',
    exportHint: 'En Airbnb, en el calendario de tu anuncio, usa la opción para importar o sincronizar otro calendario y pega este enlace.'
  },
  booking: {
    importHint: 'En la extranet de Booking.com, entra a la sincronización de calendarios (iCal) de la unidad y copia el enlace de exportación.',
    exportHint: 'En la extranet de Booking.com, en la sincronización de calendarios (iCal) de la unidad, pega este enlace como calendario a importar.'
  },
  otro: {
    importHint: 'Copia el enlace iCal (.ics) que te entrega la otra plataforma.',
    exportHint: 'Pega este enlace en la otra plataforma, en su opción de importar calendarios.'
  }
};

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function PlatformCard({
  platform,
  feed,
  hotel,
  room,
  canManage,
  onChanged
}: {
  platform: IcalPlatform;
  feed: IcalFeed | undefined;
  hotel: Hotel;
  room: Room | null;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const label = PLATFORM_LABEL[platform];
  const help = PLATFORM_HELP[platform];

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [urlInput, setUrlInput] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<'regenerate' | 'disconnect' | null>(null);

  const run = async (name: string, action: () => Promise<{ error?: string; ok?: boolean; message?: string }>) => {
    setBusy(name);
    setNotice(null);
    const result = await action();
    if (result.error) {
      setNotice({ kind: 'error', text: result.error });
    } else if (result.message) {
      setNotice({ kind: 'ok', text: result.message });
    }
    await onChanged();
    setBusy(null);
  };

  const handleConnect = () =>
    run('connect', async () => {
      const res = await connectPlatform({ hotelId: hotel.id, roomId: room ? room.id : null, platform });
      return res.error ? { error: res.error } : { message: `${label} conectado. Copia el enlace de Roomia en ${label} y pega aquí el de ${label}.` };
    });

  const handleSaveUrl = () =>
    run('save', async () => {
      if (!feed) return { error: 'Primero conecta la plataforma.' };
      const res = await saveImportUrl(feed.id, urlInput);
      if (res.error) return res;
      setEditingUrl(false);
      setUrlInput('');
      if (!urlInput.trim()) return { message: 'Enlace de importación eliminado.' };
      // Sincroniza de inmediato para validar el enlace
      const sync = await syncFeedNow(feed.id);
      return sync.ok
        ? { message: `Enlace guardado y sincronizado (${sync.events ?? 0} bloqueos).` }
        : { error: sync.error || 'El enlace se guardó, pero no se pudo sincronizar.' };
    });

  const handleSync = () =>
    run('sync', async () => {
      if (!feed) return { error: 'Primero conecta la plataforma.' };
      const sync = await syncFeedNow(feed.id);
      return sync.ok
        ? { message: `Sincronizado: ${sync.events ?? 0} bloqueos${sync.conflicts ? `, ${sync.conflicts} en conflicto` : ''}.` }
        : { error: sync.error };
    });

  const handleRegenerate = () =>
    run('regenerate', async () => {
      if (!feed) return {};
      setConfirm(null);
      const res = await regenerateExportToken(feed.id);
      return res.error
        ? res
        : { message: `Enlace nuevo generado. Pégalo otra vez en ${label}: el anterior ya no funciona.` };
    });

  const handleDisconnect = () =>
    run('disconnect', async () => {
      if (!feed) return {};
      setConfirm(null);
      const res = await disconnectPlatform(feed.id);
      return res.error ? res : { message: `${label} desconectado.` };
    });

  const copyExportUrl = async () => {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(buildExportUrl(feed.exportToken));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ kind: 'error', text: 'No se pudo copiar. Selecciona el enlace y cópialo manualmente.' });
    }
  };

  const importConfigured = !!feed?.importUrl;
  const syncedAgoMs = feed?.lastSyncedAt ? Date.now() - Date.parse(feed.lastSyncedAt) : null;
  const stale = feed?.lastStatus === 'ok' && syncedAgoMs !== null && syncedAgoMs > 2 * 60 * 60 * 1000;

  let pill = { text: 'Sin conectar', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' };
  if (feed) {
    if (!importConfigured) pill = { text: 'Solo exportación', cls: 'bg-info-50 text-info-700 border-info-200' };
    else if (feed.lastStatus === 'error') pill = { text: 'Error', cls: 'bg-danger-50 text-danger-700 border-danger-200' };
    else if (feed.lastStatus === 'ok' && !stale) pill = { text: 'Sincronizado', cls: 'bg-success-50 text-success-700 border-success-200' };
    else if (stale) pill = { text: 'Desactualizado', cls: 'bg-warning-50 text-warning-700 border-warning-200' };
    else pill = { text: 'Pendiente', cls: 'bg-warning-50 text-warning-700 border-warning-200' };
  }

  return (
    <div className="border border-neutral-200 rounded-2xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between gap-2">
        <h5 className="font-bold text-neutral-800 text-sm">{label}</h5>
        <span className={`text-micro uppercase font-bold px-2 py-0.5 rounded-full border ${pill.cls}`}>{pill.text}</span>
      </div>

      {!feed ? (
        <div className="space-y-2">
          <p className="text-micro text-neutral-500 leading-relaxed">
            Conecta {label} para bloquear en Roomia las fechas que ya se reservaron allí, y para que {label} bloquee las que se reserven en Roomia.
          </p>
          {canManage && (
            <Button
              type="button"
              onClick={handleConnect}
              disabled={busy !== null}
              variant="primary" size="md"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{busy === 'connect' ? 'Conectando…' : `Conectar ${label}`}</span>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* 1. IMPORTAR */}
          <div className="space-y-1.5">
            <p className="text-micro font-bold text-neutral-400 uppercase tracking-wider">1. Importar desde {label}</p>
            <p className="text-micro text-neutral-500 leading-relaxed">{help.importHint}</p>

            {importConfigured && !editingUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-micro bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 font-mono text-neutral-600 break-all">
                  {maskImportUrl(feed.importUrl!)}
                </code>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingUrl(true)}
                    className="text-micro font-semibold text-teal-700 hover:underline cursor-pointer"
                  >
                    Cambiar enlace
                  </button>
                )}
              </div>
            ) : (
              canManage && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://…  (enlace iCal de la plataforma)"
                    aria-label={`Enlace iCal de ${label}`}
                    className="flex-1 text-xs border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveUrl}
                      disabled={busy !== null || (!urlInput.trim() && !importConfigured)}
                      variant="primary" size="md"
                    >
                      {busy === 'save' ? 'Guardando…' : 'Guardar y sincronizar'}
                    </Button>
                    {editingUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUrl(false);
                          setUrlInput('');
                        }}
                        className="px-3 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 rounded-xl cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {importConfigured && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-neutral-500">
                <span>Última sincronización: <strong className="text-neutral-700">{timeAgo(feed.lastSyncedAt)}</strong></span>
                <span><strong className="text-neutral-700">{feed.lastEventCount}</strong> bloqueos importados</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={busy !== null}
                    className="flex items-center gap-1 font-semibold text-teal-700 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${busy === 'sync' ? 'animate-spin' : ''}`} />
                    <span>{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar ahora'}</span>
                  </button>
                )}
              </div>
            )}

            {importConfigured && feed.lastStatus === 'error' && feed.lastError && (
              <div className="flex gap-2 items-start text-micro text-danger-700 bg-danger-50 border border-danger-100 rounded-xl p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {feed.lastError}
                  {feed.consecutiveFailures > 1 ? ` (${feed.consecutiveFailures} intentos seguidos)` : ''}. Se conservan los bloqueos anteriores.
                </span>
              </div>
            )}
            {stale && (
              <p className="text-micro text-warning-700 bg-warning-50 border border-warning-100 rounded-xl p-2.5">
                Hace más de 2 horas que no se sincroniza este calendario: los bloqueos podrían estar desactualizados.
              </p>
            )}
          </div>

          {/* 2. EXPORTAR */}
          <div className="space-y-1.5 pt-2 border-t border-dashed border-neutral-200">
            <p className="text-micro font-bold text-neutral-400 uppercase tracking-wider">2. Exportar hacia {label}</p>
            <p className="text-micro text-neutral-500 leading-relaxed">{help.exportHint}</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={buildExportUrl(feed.exportToken)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={`Enlace de Roomia para ${label}`}
                className="flex-1 min-w-0 text-micro border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2 font-mono text-neutral-600"
              />
              <Button
                type="button"
                onClick={copyExportUrl}
                variant="primary" size="md" className="shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
            <p className="text-micro text-neutral-500">
              {feed.lastExportAt
                ? <>{label} leyó este calendario <strong className="text-neutral-700">{timeAgo(feed.lastExportAt)}</strong>.</>
                : <>Aún no se ha leído este enlace. {label} puede tardar varias horas en consultarlo después de pegarlo.</>}
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-dashed border-neutral-200 text-micro">
              {confirm === 'regenerate' ? (
                <span className="flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-lg px-2 py-1">
                  <span className="text-warning-800">El enlace actual dejará de funcionar.</span>
                  <button type="button" onClick={() => setConfirm(null)} className="font-semibold text-neutral-500 hover:underline cursor-pointer">Volver</button>
                  <button type="button" onClick={handleRegenerate} className="font-bold text-warning-800 hover:underline cursor-pointer">Sí, regenerar</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm('regenerate')} disabled={busy !== null} className="font-semibold text-neutral-500 hover:text-neutral-800 cursor-pointer">
                  Regenerar enlace de Roomia
                </button>
              )}

              {confirm === 'disconnect' ? (
                <span className="flex items-center gap-2 bg-danger-50 border border-danger-200 rounded-lg px-2 py-1">
                  <span className="text-danger-800">Se borran los bloqueos importados.</span>
                  <button type="button" onClick={() => setConfirm(null)} className="font-semibold text-neutral-500 hover:underline cursor-pointer">Volver</button>
                  <button type="button" onClick={handleDisconnect} className="font-bold text-danger-700 hover:underline cursor-pointer">Sí, desconectar</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm('disconnect')} disabled={busy !== null} className="flex items-center gap-1 font-semibold text-danger-600 hover:text-danger-700 cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                  <span>Desconectar {label}</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {notice && (
        <p
          role="status"
          className={`text-micro rounded-xl px-3 py-2 border ${
            notice.kind === 'ok' ? 'bg-success-50 text-success-800 border-success-100' : 'bg-danger-50 text-danger-700 border-danger-100'
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}

export default function IcalSyncModal({ hotel, room, feeds, blocks, canManage, onClose, onChanged }: IcalSyncModalProps) {
  const unitLabel = room ? `Habitación ${room.numero} · ${room.nombre}` : hotel.nombre;
  const unitRoomId = room ? room.id : fullPropertyRoomId(hotel.id);

  const unitFeeds = useMemo(
    () => feeds.filter((f) => f.hotelId === hotel.id && (room ? f.roomId === room.id : f.roomId === null)),
    [feeds, hotel.id, room]
  );

  const today = new Date().toISOString().slice(0, 10);
  const unitBlocks = useMemo(
    () => blocks.filter((b) => b.hotelId === hotel.id && b.roomId === unitRoomId && b.fechaFin >= today)
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)),
    [blocks, hotel.id, unitRoomId, today]
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Calendarios iCal"
      subtitle={unitLabel}
      bodyClassName="p-5 space-y-4"
    >
      <p className="text-xs text-neutral-500 leading-relaxed bg-neutral-50 border border-neutral-100 rounded-xl p-3">
        Sincroniza este {room ? 'alojamiento' : 'inmueble'} con otras plataformas para evitar dobles reservas.
        Solo se intercambian <strong>fechas ocupadas</strong>: no se comparten nombres, precios ni pagos.
        La sincronización no es instantánea: Roomia lee a {`Airbnb`} y {`Booking`} cada 15 minutos, pero ellas pueden tardar varias horas en leer tu calendario.
      </p>

      {!canManage && (
        <p className="text-xs text-warning-700 bg-warning-50 border border-warning-100 rounded-xl p-3">
          Solo el administrador del establecimiento puede cambiar estas conexiones.
        </p>
      )}

      {ICAL_PLATFORMS.map((platform) => (
        <React.Fragment key={platform}>
          <PlatformCard
            platform={platform}
            feed={unitFeeds.find((f) => f.platform === platform)}
            hotel={hotel}
            room={room}
            canManage={canManage}
            onChanged={onChanged}
          />
        </React.Fragment>
      ))}

      <div className="space-y-2">
        <h4 className="text-micro font-bold text-neutral-400 uppercase tracking-wider">
          Fechas bloqueadas por otras plataformas ({unitBlocks.length})
        </h4>
        {unitBlocks.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">No hay bloqueos importados próximos.</p>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {unitBlocks.map((b) => (
              <li
                key={b.id}
                className={`flex flex-wrap items-center justify-between gap-2 text-xs rounded-xl border px-3 py-2 ${
                  b.conflict ? 'bg-danger-50 border-danger-200' : 'bg-info-50/60 border-info-100'
                }`}
              >
                <span className="font-mono text-neutral-700">
                  {b.fechaInicio} → {b.fechaFin}
                </span>
                <span className="flex items-center gap-2">
                  {b.conflict && (
                    <span className="flex items-center gap-1 text-danger-700 font-bold text-micro uppercase">
                      <AlertTriangle className="w-3 h-3" /> Conflicto con una reserva de Roomia
                    </span>
                  )}
                  <span className="text-micro font-bold uppercase text-info-700">{PLATFORM_LABEL[b.platform]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
