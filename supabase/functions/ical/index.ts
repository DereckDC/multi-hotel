// Función Edge `ical` (Supabase) · sincronización de calendarios iCal con Airbnb/Booking.
//
//   GET  /ical/<token>.ics   Calendario que Roomia PUBLICA para una plataforma (sin datos personales).
//                            Público por diseño: el token (256 bits) es la credencial.
//   POST /ical {action:"sync", feed_id}   Sincroniza una conexión. Exige sesión de super_admin o del
//                                         hotel_admin de ese hotel.
//   POST /ical {action:"sync_all"}        Lo llama pg_cron cada 15 min con la cabecera x-cron-secret.
//
// Despliegue: verify_jwt = false (el calendario debe poder leerlo Airbnb/Booking sin sesión);
// cada ruta valida su propia credencial. Nunca se registran ni se devuelven las URL de importación.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildIcs,
  DEFAULT_TZ,
  dateInTz,
  isPrivateIp,
  parseIcal,
  validateImportUrl,
} from "./ical.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const USER_AGENT = "RoomiaPMS-iCal/1.0 (+https://www.roomiapms.site)";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MANUAL_SYNC_MIN_INTERVAL_MS = 20_000;
const SYNC_ALL_BUDGET_MS = 110_000;
const SYNC_ALL_CONCURRENCY = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey, x-cron-secret",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

class FeedError extends Error {}

interface Feed {
  id: string;
  hotel_id: string;
  room_id: string | null;
  platform: string;
  import_url: string | null;
  etag: string | null;
  last_modified: string | null;
  last_attempt_at: string | null;
  consecutive_failures: number;
}

const FEED_COLS =
  "id,hotel_id,room_id,platform,import_url,etag,last_modified,last_attempt_at,consecutive_failures";

// -----------------------------------------------------------------------------
// Exportación: calendario que Roomia publica para Airbnb/Booking
// -----------------------------------------------------------------------------
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleExport(req: Request, token: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return notFound();

  const { data, error } = await admin.rpc("ical_export_data", { p_token: token });
  if (error) {
    console.error("ical_export_data", error.code);
    return json(500, { error: "Calendario no disponible" });
  }
  if (!data) return notFound();

  const body = buildIcs(`Roomia - ${data.name}`, data.events);
  // La huella no incluye DTSTAMP (cambia en cada petición): solo nombre y eventos
  const etag = `"${(await sha256Hex(JSON.stringify([data.name, data.events]))).slice(0, 32)}"`;

  const headers: Record<string, string> = {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'inline; filename="roomia.ics"',
    "Cache-Control": "no-cache",
    ETag: etag,
    ...CORS,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
}

// -----------------------------------------------------------------------------
// Importación: lectura segura del calendario de la plataforma
// -----------------------------------------------------------------------------
async function assertPublicHost(hostname: string): Promise<void> {
  if (typeof Deno.resolveDns !== "function") return;
  const [a, aaaa] = await Promise.allSettled([
    Deno.resolveDns(hostname, "A"),
    Deno.resolveDns(hostname, "AAAA"),
  ]);
  const ips: string[] = [];
  if (a.status === "fulfilled") ips.push(...a.value);
  if (aaaa.status === "fulfilled") ips.push(...aaaa.value);

  if (ips.length === 0) {
    const reason = (a as PromiseRejectedResult).reason ?? (aaaa as PromiseRejectedResult).reason;
    const name = String(reason?.name ?? "");
    // Si el entorno no permite consultar DNS, la validación de dominio por plataforma sigue vigente
    if (name === "PermissionDenied" || name === "NotCapable" || name === "NotSupported") return;
    throw new FeedError("No se pudo resolver el dominio del calendario.");
  }
  if (ips.some(isPrivateIp)) {
    throw new FeedError("La dirección del calendario apunta a una red no permitida.");
  }
}

function httpMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "La plataforma rechazó el enlace (acceso denegado). Genera un enlace nuevo en la plataforma.";
  }
  if (status === 404 || status === 410) {
    return "El enlace del calendario ya no existe. Copia el enlace actual desde la plataforma.";
  }
  if (status === 429) return "La plataforma limitó las solicitudes. Se reintentará automáticamente.";
  if (status >= 500) return `La plataforma no está disponible ahora (HTTP ${status}).`;
  return `La plataforma respondió con un error (HTTP ${status}).`;
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FeedError("El calendario es demasiado grande para sincronizarse.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(all);
}

interface Fetched {
  text: string | null;
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
}

async function fetchCalendar(feed: Feed): Promise<Fetched> {
  const first = validateImportUrl(feed.import_url ?? "", feed.platform);
  if (!first.ok) throw new FeedError(first.error);
  let url = first.url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        "User-Agent": USER_AGENT,
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
      };
      if (hop === 0 && feed.etag) headers["If-None-Match"] = feed.etag;
      if (hop === 0 && feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

      let res: Response;
      try {
        res = await fetch(url, { headers, redirect: "manual", signal: ctrl.signal });
      } catch (e) {
        throw new FeedError(
          (e as Error)?.name === "AbortError"
            ? "La plataforma tardó demasiado en responder."
            : "No se pudo conectar con la plataforma.",
        );
      }

      if (res.status === 304) {
        await res.body?.cancel();
        return { text: null, etag: feed.etag, lastModified: feed.last_modified, notModified: true };
      }
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new FeedError("La plataforma redirigió sin indicar la nueva dirección.");
        const next = validateImportUrl(new URL(location, url).toString(), feed.platform);
        if (!next.ok) throw new FeedError("La plataforma redirigió a una dirección no permitida.");
        url = next.url;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new FeedError(httpMessage(res.status));
      }

      const text = await readLimited(res);
      return {
        text,
        etag: res.headers.get("etag"),
        lastModified: res.headers.get("last-modified"),
        notModified: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FeedError("La dirección del calendario redirige demasiadas veces.");
}

async function syncFeed(feed: Feed): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  try {
    if (!feed.import_url) throw new FeedError("No hay enlace de importación configurado.");
    const got = await fetchCalendar(feed);

    if (got.notModified) {
      const { data, error } = await admin.rpc("ical_apply_sync", {
        p_feed_id: feed.id,
        p_events: null,
        p_etag: feed.etag,
        p_last_modified: feed.last_modified,
        p_not_modified: true,
      });
      if (error) throw new FeedError("No se pudo registrar la sincronización.");
      return { ...(data ?? {}), ok: true };
    }

    const parsed = parseIcal(got.text ?? "", { today: dateInTz(DEFAULT_TZ) });
    if (!parsed.valid) {
      throw new FeedError(
        "El enlace no devolvió un calendario iCal válido. Verifica que sea el enlace de exportación del calendario.",
      );
    }
    if (parsed.truncated) throw new FeedError("El calendario tiene demasiados eventos para sincronizarse.");

    const { data, error } = await admin.rpc("ical_apply_sync", {
      p_feed_id: feed.id,
      p_events: parsed.events.map((e) => ({ uid: e.uid, start: e.start, stop: e.stop, summary: e.summary })),
      p_etag: got.etag,
      p_last_modified: got.lastModified,
      p_not_modified: false,
    });
    if (error) {
      console.error("ical_apply_sync", error.code, error.message);
      throw new FeedError("No se pudo guardar el calendario importado.");
    }
    return { ...(data ?? {}), ok: true, stats: parsed.stats };
  } catch (e) {
    const message = e instanceof FeedError ? e.message : "Error inesperado al sincronizar.";
    if (!(e instanceof FeedError)) console.error("syncFeed", feed.id, (e as Error)?.name);
    await admin.rpc("ical_record_failure", { p_feed_id: feed.id, p_error: message });
    return { ok: false, error: message };
  }
}

// -----------------------------------------------------------------------------
// Rutas POST
// -----------------------------------------------------------------------------
async function handleSyncAll(): Promise<Response> {
  const started = Date.now();
  const { data: feeds, error } = await admin
    .from("ical_feeds")
    .select(FEED_COLS)
    .not("import_url", "is", null)
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) {
    console.error("sync_all select", error.code);
    return json(500, { error: "No se pudieron leer las conexiones" });
  }

  const now = Date.now();
  const due = ((feeds ?? []) as Feed[]).filter((f) => {
    const last = f.last_attempt_at ? Date.parse(f.last_attempt_at) : 0;
    // Con fallos seguidos se espacian los reintentos para no martillar a la plataforma
    const minMinutes = f.consecutive_failures >= 20 ? 720 : f.consecutive_failures >= 5 ? 120 : 10;
    return now - last >= minMinutes * 60_000;
  });

  const stats = { due: due.length, ok: 0, errors: 0, skipped: 0 };
  let index = 0;
  const worker = async () => {
    while (index < due.length) {
      if (Date.now() - started > SYNC_ALL_BUDGET_MS) return;
      const feed = due[index++];
      const result = await syncFeed(feed);
      if (result.ok) stats.ok++;
      else stats.errors++;
    }
  };
  await Promise.all(Array.from({ length: SYNC_ALL_CONCURRENCY }, worker));
  stats.skipped = Math.max(0, due.length - stats.ok - stats.errors);

  console.log("sync_all", JSON.stringify(stats));
  return json(200, { ok: true, ...stats });
}

async function handleSyncOne(req: Request, feedId: string): Promise<Response> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(feedId)) {
    return json(400, { error: "Conexión no válida" });
  }
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json(401, { error: "Inicia sesión para sincronizar" });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json(401, { error: "Sesión no válida" });

  const { data: profile } = await admin
    .from("users")
    .select("rol,hotelid,estado")
    .eq("id", userData.user.id)
    .maybeSingle();
  const { data: feed } = await admin.from("ical_feeds").select(FEED_COLS).eq("id", feedId).maybeSingle();
  if (!feed) return json(404, { error: "Conexión no encontrada" });

  const allowed = !!profile && profile.estado !== "inactivo" &&
    (profile.rol === "super_admin" || (profile.rol === "hotel_admin" && profile.hotelid === feed.hotel_id));
  if (!allowed) return json(403, { error: "No tienes permiso para sincronizar este calendario" });

  if (feed.last_attempt_at && Date.now() - Date.parse(feed.last_attempt_at) < MANUAL_SYNC_MIN_INTERVAL_MS) {
    return json(429, { error: "Espera unos segundos antes de volver a sincronizar." });
  }

  return json(200, await syncFeed(feed as Feed));
}

// -----------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Servicio mal configurado" });

  try {
    const url = new URL(req.url);

    if (req.method === "GET" || req.method === "HEAD") {
      const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
      const token = url.searchParams.get("token") ?? last.replace(/\.ics$/i, "");
      return await handleExport(req, token);
    }

    if (req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 4096) return json(413, { error: "Solicitud demasiado grande" });
      let body: { action?: string; feed_id?: string } = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return json(400, { error: "JSON no válido" });
      }

      if (body.action === "sync_all") {
        const secret = req.headers.get("x-cron-secret");
        const { data: ok } = await admin.rpc("ical_check_cron_secret", { p_secret: secret });
        if (ok !== true) return json(401, { error: "No autorizado" });
        return await handleSyncAll();
      }
      if (body.action === "sync" && typeof body.feed_id === "string") {
        return await handleSyncOne(req, body.feed_id);
      }
      return json(400, { error: "Acción no válida" });
    }

    return json(405, { error: "Método no permitido" });
  } catch (e) {
    console.error("ical unhandled", (e as Error)?.name, (e as Error)?.message);
    return json(500, { error: "Error interno" });
  }
});
