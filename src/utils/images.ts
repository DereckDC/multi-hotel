/**
 * Fotos de hoteles, propiedades y habitaciones: todas se guardan en el almacenamiento de Roomia
 * (bucket "establecimientos" de Supabase Storage). Así no dependen de que otra web las mantenga
 * ni de que la red del huésped la bloquee, y no se guardan como texto base64 en la base de datos.
 *
 *  · Desde el dispositivo: se reducen en el navegador (máx. 1600 px, WebP) y se suben directo.
 *  · Por enlace: la función `import-image` descarga la imagen en el servidor y la copia.
 *  · Los videos (YouTube, Vimeo, mp4) se guardan como enlace.
 */
import { supabase } from '../supabase';
import { BUCKET, isVideoLink } from '../../supabase/functions/import-image/imageRules.ts';

export { isVideoLink };

const MAX_SIDE = 1600;
const QUALITY = 0.82;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Carpeta del bucket: hotels/<id> o rooms/<id> */
export const imageFolder = (kind: 'hotels' | 'rooms', id?: string | null): string =>
  `${kind}/${String(id || 'nuevo').replace(/[^A-Za-z0-9_-]/g, '') || 'nuevo'}`;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('El archivo no es una imagen que el navegador pueda abrir.')); };
    img.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

/** Reduce la imagen a máx. 1600 px y la convierte a WebP (o JPEG si el navegador no soporta WebP) */
export async function prepareImage(file: File): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia al pasar a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const webp = await toBlob(canvas, 'image/webp', QUALITY);
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  const jpeg = await toBlob(canvas, 'image/jpeg', QUALITY);
  if (!jpeg) throw new Error('No se pudo procesar la imagen.');
  return { blob: jpeg, ext: 'jpg' };
}

/** Sube una foto del dispositivo al almacenamiento de Roomia y devuelve su dirección pública */
export async function uploadImageFile(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se pueden subir fotos. Para videos, súbelos a YouTube o Vimeo y pega el enlace.');
  }
  const { blob, ext } = await prepareImage(file);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('La foto sigue pesando más de 5 MB después de reducirla.');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false
  });
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Copia la imagen de un enlace al almacenamiento de Roomia (los videos se devuelven tal cual) */
export async function importImageFromUrl(url: string, folder: string): Promise<string> {
  const clean = url.trim();
  if (isVideoLink(clean)) return clean;
  const { data, error } = await supabase.functions.invoke('import-image', { body: { url: clean, folder } });
  if (data?.url) return data.url as string;
  // Mensaje de la función (422/400) si lo hay
  let message = data?.error as string | undefined;
  if (!message && error && 'context' in error) {
    try { message = (await (error as any).context.json())?.error; } catch { /* sin cuerpo */ }
  }
  throw new Error(message || 'No se pudo copiar la imagen de ese sitio. Descárgala y súbela desde tu dispositivo.');
}

/** ¿La dirección ya es del almacenamiento de Roomia? */
export function isStoredInRoomia(url: string): boolean {
  const prefix = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl.replace(/\/?$/, '/');
  return typeof url === 'string' && url.startsWith(prefix);
}

/**
 * Deja una dirección guardada en Roomia: copia los enlaces externos y sube las imágenes en base64.
 * Los videos y las que ya son de Roomia se devuelven tal cual.
 */
export async function ensureStoredImage(url: string, folder: string): Promise<string> {
  if (!url || typeof url !== 'string' || isStoredInRoomia(url) || isVideoLink(url)) return url;
  if (url.startsWith('data:image')) {
    const blob = await (await fetch(url)).blob();
    return uploadImageFile(new File([blob], 'foto', { type: blob.type || 'image/jpeg' }), folder);
  }
  if (/^https?:\/\//i.test(url)) return importImageFromUrl(url.replace(/^http:\/\//i, 'https://'), folder);
  return url;
}

/**
 * Antes de guardar un hotel, propiedad o habitación: pasa a Roomia todas sus fotos (imagenes, portada
 * y logo) que todavía sean enlaces externos o base64, como las que traen los formularios por defecto.
 * Si alguna no se puede copiar, se deja la original y se cuenta en `failed`.
 */
export async function storeImagesOf<T extends { imagenes?: string[]; logo?: string; portada?: string }>(
  item: T,
  folder: string
): Promise<{ item: T; failed: number }> {
  const cache = new Map<string, Promise<string>>();
  let failed = 0;
  const store = (url?: string): Promise<string | undefined> => {
    if (!url) return Promise.resolve(url);
    if (!cache.has(url)) {
      cache.set(url, ensureStoredImage(url, folder).catch(() => { failed++; return url; }));
    }
    return cache.get(url)!;
  };
  const imagenes = item.imagenes ? (await Promise.all(item.imagenes.map(store))) as string[] : item.imagenes;
  const [logo, portada] = await Promise.all([store(item.logo), store(item.portada)]);
  return {
    item: {
      ...item,
      ...(item.imagenes ? { imagenes } : {}),
      ...('logo' in item ? { logo } : {}),
      ...('portada' in item ? { portada } : {})
    },
    failed
  };
}

type WithImages = { imagenes?: string[]; logo?: string; portada?: string } | null | undefined;

/** Fotos de un hotel, propiedad o habitación que están en el almacenamiento de Roomia */
export const storedImagesOf = (item: WithImages): string[] =>
  item ? [...new Set([...(item.imagenes || []), item.logo, item.portada].filter((u): u is string => !!u && isStoredInRoomia(u)))] : [];

/** Fotos de Roomia que tenía la versión anterior y la nueva ya no usa */
export const unusedImages = (before: WithImages, after: WithImages): string[] => {
  const keep = new Set(storedImagesOf(after));
  return storedImagesOf(before).filter(u => !keep.has(u));
};

/** Borra del almacenamiento de Roomia las fotos que ya no usa nadie (un fallo solo se registra) */
export async function removeStoredImages(urls: string[]): Promise<void> {
  const prefix = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl.replace(/\/?$/, '/');
  const paths = [...new Set(urls.filter(isStoredInRoomia).map(u => decodeURIComponent(u.slice(prefix.length).split('?')[0])))];
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('No se pudieron borrar fotos sin usar:', error.message);
}

/** Recuadro neutro para cuando una foto no carga */
export const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 120'%3E%3Crect width='160' height='120' fill='%23f1f5f9'/%3E%3Cpath d='M58 78l14-16 10 11 8-9 14 14z' fill='%23cbd5e1'/%3E%3Ccircle cx='66' cy='50' r='7' fill='%23cbd5e1'/%3E%3C/svg%3E";

/** onError para <img>: cambia una foto rota por el recuadro neutro (una sola vez) */
export const onImageError = (e: { currentTarget: HTMLImageElement }) => {
  const img = e.currentTarget;
  if (img.dataset.fallback === '1') return;
  img.dataset.fallback = '1';
  img.src = IMAGE_PLACEHOLDER;
};
