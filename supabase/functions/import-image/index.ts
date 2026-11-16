// Función Edge `import-image` (Supabase) · copia imágenes al almacenamiento propio de Roomia.
//
//   POST {action: "import", url, folder}   Descarga la imagen del enlace (o la decodifica si es
//                                          data:image) y la guarda en el bucket "establecimientos".
//                                          Devuelve {url} con la dirección de Roomia.
//   POST {action: "migrate"}               Solo super_admin. Mueve al bucket todas las imágenes de
//                                          hotels (imagenes, portada, logo) y rooms (imagenes) que
//                                          sean enlaces externos o base64. Solo reemplaza las que se
//                                          copiaron bien.
//
// Exige sesión de personal (verify_jwt = true + rol). Protección SSRF: solo https, sin IP privadas
// (comprobado por DNS en cada redirección), máx. 3 redirecciones, 10 s y 5 MB, y el tipo se
// comprueba por los bytes.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  BUCKET,
  MAX_IMAGE_BYTES,
  decodeDataUrl,
  extensionFor,
  isOwnStorageUrl,
  isPrivateIp,
  isVideoLink,
  sniffImageType,
  validateFolder,
  validateImageUrl,
} from "./imageRules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const STAFF_ROLES = ["super_admin", "hotel_admin", "recepcionista"];
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; RoomiaPMS-Images/1.0; +https://www.roomiapms.site)";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

class ImportError extends Error {}

const COPY_FAILED = "No se pudo copiar la imagen de ese sitio. Descárgala y súbela desde tu dispositivo.";

async function assertPublicHost(hostname: string): Promise<void> {
  if (typeof Deno.resolveDns !== "function") return;
  const [a, aaaa] = await Promise.allSettled([Deno.resolveDns(hostname, "A"), Deno.resolveDns(hostname, "AAAA")]);
  const ips: string[] = [];
  if (a.status === "fulfilled") ips.push(...a.value);
  if (aaaa.status === "fulfilled") ips.push(...aaaa.value);
  if (ips.length === 0) throw new ImportError("No se encontró el sitio de la imagen.");
  if (ips.some(isPrivateIp)) throw new ImportError("La dirección de la imagen no está permitida.");
}

/** Descarga segura de una imagen pública */
async function downloadImage(rawUrl: string): Promise<Uint8Array> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = validateImageUrl(current);
    if (!check.ok) throw new ImportError(check.error);
    await assertPublicHost(check.url.hostname);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(check.url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/png,image/webp;q=0.9" },
      });
    } catch {
      clearTimeout(timer);
      throw new ImportError(COPY_FAILED);
    }

    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const next = res.headers.get("location");
      if (!next) throw new ImportError(COPY_FAILED);
      current = new URL(next, check.url).toString();
      continue;
    }
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      throw new ImportError(COPY_FAILED);
    }
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_IMAGE_BYTES) {
      clearTimeout(timer);
      throw new ImportError("La imagen pesa más de 5 MB. Súbela desde tu dispositivo y Roomia la reducirá.");
    }

    // Lectura con tope de tamaño
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new ImportError("La imagen pesa más de 5 MB. Súbela desde tu dispositivo y Roomia la reducirá.");
        }
        chunks.push(value);
      }
    } catch (e) {
      if (e instanceof ImportError) throw e;
      throw new ImportError(COPY_FAILED);
    } finally {
      clearTimeout(timer);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
    return bytes;
  }
  throw new ImportError(COPY_FAILED);
}

/** Copia una imagen (enlace o data:image) al bucket y devuelve su dirección pública */
async function storeImage(source: string, folder: string): Promise<string> {
  if (isOwnStorageUrl(source, SUPABASE_URL)) return source;
  const bytes = source.startsWith("data:") ? decodeDataUrl(source) : await downloadImage(source);
  if (!bytes) throw new ImportError("La imagen no es válida.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImportError("La imagen pesa más de 5 MB.");
  const type = sniffImageType(bytes);
  if (!type) throw new ImportError("El enlace no es una imagen JPG, PNG o WebP.");

  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(type)}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new ImportError(`No se pudo guardar la imagen: ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Mueve al bucket las imágenes externas o en base64 de hoteles y habitaciones */
async function migrateAll() {
  const summary = { movidas: 0, yaPropias: 0, fallidas: [] as Array<{ registro: string; origen: string; error: string }> };
  const move = async (value: string | null, folder: string, registro: string): Promise<string | null> => {
    if (!value || typeof value !== "string") return value;
    if (isOwnStorageUrl(value, SUPABASE_URL)) { summary.yaPropias++; return value; }
    if (!/^https?:\/\//i.test(value) && !value.startsWith("data:image")) return value;
    if (isVideoLink(value)) return value; // los videos se quedan como enlace
    try {
      const url = await storeImage(value.replace(/^http:\/\//i, "https://"), folder);
      summary.movidas++;
      return url;
    } catch (e) {
      summary.fallidas.push({ registro, origen: value.startsWith("data:") ? "data:image (base64)" : value.slice(0, 120), error: (e as Error).message });
      return value; // si no se pudo copiar, se deja la original
    }
  };

  const { data: hotels } = await admin.from("hotels").select("id, nombre, imagenes, portada, logo");
  for (const h of hotels ?? []) {
    const folder = `hotels/${String(h.id).replace(/[^A-Za-z0-9_-]/g, "")}`;
    const imagenes: string[] = [];
    for (const img of (h.imagenes ?? []) as string[]) imagenes.push((await move(img, folder, h.nombre)) as string);
    const portada = await move(h.portada, folder, `${h.nombre} (portada)`);
    const logo = await move(h.logo, folder, `${h.nombre} (logo)`);
    const changed = JSON.stringify(imagenes) !== JSON.stringify(h.imagenes ?? []) || portada !== h.portada || logo !== h.logo;
    if (changed) await admin.from("hotels").update({ imagenes, portada, logo }).eq("id", h.id);
  }

  const { data: rooms } = await admin.from("rooms").select("id, nombre, imagenes");
  for (const r of rooms ?? []) {
    const folder = `rooms/${String(r.id).replace(/[^A-Za-z0-9_-]/g, "")}`;
    const imagenes: string[] = [];
    for (const img of (r.imagenes ?? []) as string[]) imagenes.push((await move(img, folder, r.nombre)) as string);
    if (JSON.stringify(imagenes) !== JSON.stringify(r.imagenes ?? [])) await admin.from("rooms").update({ imagenes }).eq("id", r.id);
  }
  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth?.user) return json(401, { error: "Sesión no válida" });
  const { data: caller } = await admin.from("users").select("rol").eq("id", auth.user.id).maybeSingle();
  const role = caller?.rol ?? "cliente";
  if (!STAFF_ROLES.includes(role)) return json(403, { error: "Solo el personal puede subir imágenes" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo no válido" });
  }

  try {
    if (body.action === "migrate") {
      if (role !== "super_admin") return json(403, { error: "Solo el superadministrador puede migrar imágenes" });
      return json(200, await migrateAll());
    }

    const folder = validateFolder(body.folder);
    if (!folder) return json(400, { error: "Carpeta de destino no válida" });
    const source = typeof body.url === "string" ? body.url.trim() : "";
    if (!source) return json(400, { error: "Falta la dirección de la imagen" });
    if (source.startsWith("data:")) return json(400, { error: "Las imágenes del dispositivo se suben directamente" });
    if (isVideoLink(source)) return json(200, { url: source });
    return json(200, { url: await storeImage(source, folder) });
  } catch (e) {
    if (e instanceof ImportError) return json(422, { error: e.message });
    console.error("import-image:", (e as Error)?.message || e);
    return json(500, { error: "No se pudo procesar la imagen." });
  }
});
