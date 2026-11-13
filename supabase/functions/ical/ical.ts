/**
 * Lógica pura de iCal para la función Edge `ical` (sin APIs de Deno: se prueba con Node).
 *  - parseIcal:         lee el calendario que entrega Airbnb/Booking y lo reduce a fechas.
 *  - buildIcs:          genera el calendario que Roomia publica para cada plataforma.
 *  - validateImportUrl: reglas de la URL de importación (mismas que el trigger SQL).
 *  - isPrivateIp:       protección SSRF para las IP que resuelve un dominio.
 *
 * Todas las fechas son "YYYY-MM-DD". La fecha de fin es EXCLUSIVA (día de salida),
 * igual que en iCal y que en la validación de reservas de Roomia.
 */

export interface ParsedEvent {
  uid: string;
  start: string;
  stop: string;
  summary: string;
}

export interface ParseResult {
  /** El texto tiene BEGIN:VCALENDAR y END:VCALENDAR. Sin esto no se debe tocar nada en la base. */
  valid: boolean;
  events: ParsedEvent[];
  /** Se superó el máximo de eventos: el resultado es incompleto y no debe aplicarse. */
  truncated: boolean;
  stats: { cancelled: number; invalid: number; past: number; recurring: number };
}

export interface ParseOptions {
  /** Hoy en "YYYY-MM-DD" (zona del hotel). Los eventos que terminaron antes se ignoran. */
  today: string;
  tz?: string;
  maxEvents?: number;
}

export interface ExportEvent {
  uid: string;
  start: string;
  end: string;
  summary: string;
}

export const DEFAULT_TZ = 'America/Guayaquil';
const MAX_SPAN_DAYS = 1100;

const pad = (n: number): string => String(n).padStart(2, '0');

export function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Fecha local "YYYY-MM-DD" de un instante en una zona horaria. */
export function dateInTz(tz: string, instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(instant);
}

/** Desdobla las líneas plegadas (RFC 5545 §3.1) y separa por líneas. */
export function unfoldLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** NOMBRE;PARAM=VALOR:valor  (los dos puntos dentro de comillas no cuentan). */
export function parseProp(line: string): Prop | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  const parts: string[] = [];
  let buf = '';
  inQuotes = false;
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === ';' && !inQuotes) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);

  const name = parts[0].trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).trim().toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

/** Convierte un valor DATE o DATE-TIME de iCal a "YYYY-MM-DD" en la zona del hotel. */
export function parseIcsDate(value: string, tz: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidYmd(y, mo, d)) return null;

  if (m[4] !== undefined && m[7]) {
    // Instante en UTC: se pasa a la fecha local del hotel
    const instant = new Date(Date.UTC(y, mo - 1, d, Number(m[4]), Number(m[5]), Number(m[6] ?? 0)));
    return dateInTz(tz, instant);
  }
  // Fecha sola, o fecha-hora local/con TZID: la fecha tal cual viene
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseDurationDays(value: string): number | null {
  const m = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T.*)?$/i.exec(value.trim());
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  return Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0);
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim();
}

export function parseIcal(text: string, opts: ParseOptions): ParseResult {
  const tz = opts.tz ?? DEFAULT_TZ;
  const max = opts.maxEvents ?? 5000;
  const result: ParseResult = {
    valid: false,
    events: [],
    truncated: false,
    stats: { cancelled: 0, invalid: 0, past: 0, recurring: 0 }
  };

  const byUid = new Map<string, ParsedEvent>();
  let hasBegin = false;
  let hasEnd = false;
  let current: Record<string, Prop> | null = null;
  let nested = 0; // componentes anidados dentro de un VEVENT (p. ej. VALARM)

  const finalize = (ev: Record<string, Prop>) => {
    if ((ev['STATUS']?.value ?? '').trim().toUpperCase() === 'CANCELLED') {
      result.stats.cancelled++;
      return;
    }
    if (ev['RRULE']) result.stats.recurring++;

    const startRaw = ev['DTSTART'];
    const start = startRaw ? parseIcsDate(startRaw.value, tz) : null;
    if (!start) {
      result.stats.invalid++;
      return;
    }

    let stop: string | null = null;
    if (ev['DTEND']) {
      stop = parseIcsDate(ev['DTEND'].value, tz);
    } else if (ev['DURATION']) {
      const days = parseDurationDays(ev['DURATION'].value);
      if (days !== null) stop = addDays(start, Math.max(1, days));
    }
    // Sin fin, o que termina el mismo día: cuenta como una noche
    if (!stop || stop <= start) stop = addDays(start, 1);
    if (diffDays(start, stop) > MAX_SPAN_DAYS) stop = addDays(start, MAX_SPAN_DAYS);

    if (stop < opts.today) {
      result.stats.past++;
      return;
    }

    const rawUid = (ev['UID']?.value ?? '').trim();
    const recurrence = (ev['RECURRENCE-ID']?.value ?? '').trim();
    const uid = (rawUid ? rawUid + (recurrence ? '#' + recurrence : '') : `sin-uid-${start}-${stop}`).slice(0, 300);

    byUid.set(uid, { uid, start, stop, summary: unescapeText(ev['SUMMARY']?.value ?? '').slice(0, 200) });
  };

  for (const rawLine of unfoldLines(text)) {
    const line = rawLine.trim();
    if (!line) continue;
    const upper = line.toUpperCase();

    if (upper === 'BEGIN:VCALENDAR') {
      hasBegin = true;
    } else if (upper === 'END:VCALENDAR') {
      hasEnd = true;
    } else if (upper === 'BEGIN:VEVENT') {
      current = {};
      nested = 0;
    } else if (upper === 'END:VEVENT') {
      if (current) {
        finalize(current);
        if (byUid.size > max) {
          result.truncated = true;
          break;
        }
      }
      current = null;
    } else if (current) {
      if (upper.startsWith('BEGIN:')) {
        nested++;
      } else if (upper.startsWith('END:')) {
        if (nested > 0) nested--;
      } else if (nested === 0) {
        const prop = parseProp(rawLine);
        if (prop && !(prop.name in current)) current[prop.name] = prop;
      }
    }
  }

  result.valid = hasBegin && hasEnd;
  result.events = [...byUid.values()];
  return result;
}

// -----------------------------------------------------------------------------
// Generación del calendario que Roomia publica
// -----------------------------------------------------------------------------

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Plegado a 75 octetos por línea (RFC 5545 §3.1), respetando caracteres multibyte. */
export function foldLine(line: string): string[] {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return [line];
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
      limit = 74;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.map((l, i) => (i === 0 ? l : ' ' + l));
}

export function buildIcs(calendarName: string, events: ExportEvent[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const compact = (ymd: string) => ymd.replace(/-/g, '');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roomia PMS//Calendario de disponibilidad//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}

// -----------------------------------------------------------------------------
// Seguridad de la URL de importación (mismas reglas que ical_feeds_validate en SQL)
// -----------------------------------------------------------------------------

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const BLOCKED_SUFFIX_RE = /(^|\.)(localhost|local|internal|lan|home|corp|intranet|localdomain)$/;

export function validateImportUrl(raw: string, platform: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'La dirección del calendario no es válida.' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'La dirección debe empezar por https://' };
  if (url.username || url.password) return { ok: false, error: 'La dirección no puede incluir usuario ni contraseña.' };
  if (url.port) return { ok: false, error: 'La dirección no puede usar un puerto distinto del estándar.' };

  const host = url.hostname.toLowerCase();
  if (!HOST_RE.test(host) || /^\d+(\.\d+){3}$/.test(host) || BLOCKED_SUFFIX_RE.test(host)) {
    return { ok: false, error: 'El dominio de la dirección no es válido.' };
  }
  // airbnb.com, airbnb.es, airbnb.co.uk, airbnb.com.ec... pero NO airbnb.com.evil.net ni airbnb.xx.yy
  if (platform === 'airbnb' && !/(^|\.)airbnb\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/.test(host)) {
    return { ok: false, error: 'La dirección no parece un calendario de Airbnb.' };
  }
  if (platform === 'booking' && !/(^|\.)booking\.com$/.test(host)) {
    return { ok: false, error: 'La dirección no parece un calendario de Booking.' };
  }
  return { ok: true, url };
}

/** IP (v4 o v6) que no debe contactarse desde el servidor. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  const m4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (m4) {
    const [a, b] = [Number(m4[1]), Number(m4[2])];
    if ([a, b, Number(m4[3]), Number(m4[4])].some((n) => n > 255)) return true;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v.includes(':')) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v);
    if (mapped) return isPrivateIp(mapped[1]);
    return (
      v === '::' ||
      v === '::1' ||
      v.startsWith('fc') ||
      v.startsWith('fd') ||
      v.startsWith('fe8') ||
      v.startsWith('fe9') ||
      v.startsWith('fea') ||
      v.startsWith('feb') ||
      v.startsWith('ff')
    );
  }
  return true; // lo que no es una IP reconocible se trata como no seguro
}
