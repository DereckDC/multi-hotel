// Reglas puras de la función `import-image` (sin Deno), para poder probarlas con node --test.
// La validación de URL e IP es la misma que usa la función `ical` (supabase/functions/ical/ical.ts).

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const BLOCKED_SUFFIX_RE = /(^|\.)(localhost|local|internal|lan|home|corp|intranet|localdomain)$/;

export const BUCKET = 'establecimientos';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // igual que el límite del bucket
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof ALLOWED_TYPES)[number];

/** Dirección de una imagen que el servidor puede descargar sin riesgo. */
export function validateImageUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    return { ok: false, error: 'La dirección de la imagen no es válida.' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'La dirección de la imagen debe empezar por https://' };
  if (url.username || url.password) return { ok: false, error: 'La dirección no puede incluir usuario ni contraseña.' };
  if (url.port) return { ok: false, error: 'La dirección no puede usar un puerto distinto del estándar.' };
  const host = url.hostname.toLowerCase();
  if (!HOST_RE.test(host) || /^\d+(\.\d+){3}$/.test(host) || BLOCKED_SUFFIX_RE.test(host)) {
    return { ok: false, error: 'El dominio de la dirección no es válido.' };
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
      a === 0 || a === 10 || a === 127 ||
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
    return v === '::' || v === '::1' || /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

/** Tipo real de la imagen según sus primeros bytes (no se confía en la extensión ni en la cabecera). */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export const extensionFor = (type: ImageType): string =>
  type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';

/** Carpeta de destino válida: hotels/<id> o rooms/<id> */
export function validateFolder(folder: unknown): string | null {
  const f = String(folder || '').trim();
  return /^(hotels|rooms)\/[A-Za-z0-9_-]{1,80}$/.test(f) ? f : null;
}

/** ¿La imagen ya está en el almacenamiento de Roomia? */
export function isOwnStorageUrl(url: string, supabaseUrl: string): boolean {
  const base = supabaseUrl.replace(/\/+$/, '');
  return typeof url === 'string' && url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`);
}

/**
 * Videos (YouTube, Vimeo, mp4/webm): se guardan como enlace. Las plataformas de video son estables
 * y el bucket solo admite imágenes.
 */
export function isVideoLink(url: string): boolean {
  const v = String(url || '').trim().toLowerCase();
  return /^https?:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be|vimeo\.com)\//.test(v) || /\.(mp4|webm|mov)(\?|#|$)/.test(v);
}

/** Decodifica una imagen "data:image/...;base64,..." */
export function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl || '');
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
