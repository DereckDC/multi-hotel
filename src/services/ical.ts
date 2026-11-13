import { supabase, SUPABASE_URL, mapIcalFeedFromDb } from '../supabase';
import type { IcalFeed, IcalPlatform } from '../types';

export const ICAL_PLATFORMS: IcalPlatform[] = ['airbnb', 'booking', 'otro'];

export const PLATFORM_LABEL: Record<IcalPlatform, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  otro: 'Otro calendario'
};

/** Enlace público que Roomia publica para que la plataforma lea sus reservas. */
export function buildExportUrl(token: string): string {
  return `${SUPABASE_URL}/functions/v1/ical/${token}.ics`;
}

/** Convierte los errores de la base de datos en mensajes que entiende el propietario. */
function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message || '';
  const custom = message.match(/ICAL_[A-Z_]+:\s*(.+)$/);
  if (custom) {
    const text = custom[1].trim();
    return text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? '' : '.');
  }
  if (error?.code === '23505' || /duplicate key/i.test(message)) {
    return 'Esta plataforma ya está conectada para esta unidad.';
  }
  if (error?.code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'No tienes permiso para gestionar los calendarios de este establecimiento.';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ConnectArgs {
  hotelId: string;
  roomId: string | null; // null = inmueble completo
  platform: IcalPlatform;
  importUrl?: string;
}

/** Crea la conexión de una unidad con una plataforma (la URL de importación es opcional). */
export async function connectPlatform(args: ConnectArgs): Promise<{ feed?: IcalFeed; error?: string }> {
  const { data, error } = await supabase
    .from('ical_feeds')
    .insert({
      hotel_id: args.hotelId,
      room_id: args.roomId,
      platform: args.platform,
      import_url: args.importUrl?.trim() || null
    })
    .select('*')
    .single();
  if (error || !data) return { error: friendlyError(error) };
  return { feed: mapIcalFeedFromDb(data) };
}

/** Guarda (o quita, si va vacío) el enlace del calendario de la plataforma. */
export async function saveImportUrl(feedId: string, url: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('ical_feeds')
    .update({ import_url: url.trim() || null })
    .eq('id', feedId);
  return error ? { error: friendlyError(error) } : {};
}

/** Genera un enlace de exportación nuevo: el anterior deja de funcionar de inmediato. */
export async function regenerateExportToken(feedId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('ical_feeds').update({ export_token: randomToken() }).eq('id', feedId);
  return error ? { error: friendlyError(error) } : {};
}

/** Elimina la conexión y los bloqueos que había importado. */
export async function disconnectPlatform(feedId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('ical_feeds').delete().eq('id', feedId);
  return error ? { error: friendlyError(error) } : {};
}

export interface SyncOutcome {
  ok: boolean;
  error?: string;
  events?: number;
  conflicts?: number;
}

/** Pide al servicio que lea ahora el calendario de la plataforma. */
export async function syncFeedNow(feedId: string): Promise<SyncOutcome> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: 'Tu sesión expiró. Inicia sesión nuevamente.' };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/ical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'sync', feed_id: feedId })
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return { ok: false, error: body?.error || 'No se pudo sincronizar. Inténtalo de nuevo.' };
    }
    if (body && body.ok === false) {
      return { ok: false, error: body.error || 'La sincronización falló.' };
    }
    return { ok: true, events: body?.events, conflicts: body?.conflicts };
  } catch (err) {
    return { ok: false, error: 'No se pudo conectar con el servicio de sincronización.' };
  }
}

/** "hace 5 min", "hace 3 h", "hace 2 días" */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'nunca';
  const ms = now - Date.parse(iso);
  if (!isFinite(ms) || ms < 0) return 'ahora';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** Muestra solo el dominio y el final del enlace: la URL completa es un secreto. */
export function maskImportUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = (u.pathname + u.search).slice(-4);
    return `${u.hostname}/…${tail}`;
  } catch {
    return '••••••••';
  }
}
