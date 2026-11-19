/**
 * Fuente de la marca (Montserrat) para los documentos PDF.
 *
 * jsPDF solo trae helvetica, times y courier. Para que la factura tenga la misma letra que la app y
 * los correos se incrusta Montserrat (archivos TTF en /fonts). Se descarga una sola vez, al generar
 * el primer documento; si falla (sin internet y sin copia local), el PDF usa helvetica y sigue
 * saliendo bien.
 */
import type { jsPDF } from 'jspdf';

export const BRAND_FONT = 'Montserrat';
const FALLBACK_FONT = 'helvetica';

const FILES: Array<{ style: 'normal' | 'bold'; url: string; file: string }> = [
  { style: 'normal', url: '/fonts/Montserrat-Regular.ttf', file: 'Montserrat-Regular.ttf' },
  { style: 'bold', url: '/fonts/Montserrat-Bold.ttf', file: 'Montserrat-Bold.ttf' }
];

let cache: Promise<Array<{ style: 'normal' | 'bold'; file: string; data: string }> | null> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function download() {
  return Promise.all(
    FILES.map(async f => {
      const response = await fetch(f.url);
      if (!response.ok) throw new Error(`fuente ${f.file}`);
      return { style: f.style, file: f.file, data: toBase64(await response.arrayBuffer()) };
    })
  ).catch(() => null);
}

/**
 * Registra Montserrat en el documento y devuelve el nombre de la fuente que se debe usar
 * ('Montserrat', o 'helvetica' si no se pudo cargar).
 */
export async function useBrandFont(doc: jsPDF): Promise<string> {
  if (!cache) cache = download();
  const fonts = await cache;
  if (!fonts) {
    cache = null; // reintentar en el próximo documento
    return FALLBACK_FONT;
  }
  for (const f of fonts) {
    doc.addFileToVFS(f.file, f.data);
    doc.addFont(f.file, BRAND_FONT, f.style);
  }
  return BRAND_FONT;
}
