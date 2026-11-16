// Función Edge `notify-reservation` (Supabase) · aviso por correo de una reserva pendiente.
//
//   POST /notify-reservation {reservationId, subject, html, text, dryRun?}
//
// Los destinatarios (admins del hotel, correo del establecimiento y correo del propietario)
// se calculan aquí con la clave de servicio: el correo del propietario está en la tabla
// privada hotel_owners y nunca llega al navegador del huésped.
//
// Exige sesión (verify_jwt = true). Solo puede pedir el aviso el huésped de la reserva o el
// personal de ese hotel, y cada reserva se avisa una sola vez (queda registrado en logs).
// `dryRun: true` no envía nada: devuelve cuántos destinatarios hay, con los correos enmascarados.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SEND_EMAIL_URL = Deno.env.get("ROOMIA_SEND_EMAIL_URL") ?? "https://www.roomiapms.site/api/send-email";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

const EMAIL_REGEX = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;
const MAX_SUBJECT = 250;
const MAX_HTML = 500_000;
const MAX_TEXT = 20_000;
const MAX_AGE_MS = 60 * 60 * 1000; // el huésped solo puede pedir el aviso en la primera hora
const FALLBACK_RECIPIENT = "soporte@roomia.com";
const STAFF_ROLES = ["hotel_admin", "recepcionista"];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

/** "dereck@gmail.com" -> "d***@gmail.com" */
function mask(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

const isValidEmail = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length <= 254 && EMAIL_REGEX.test(v.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  // Usuario que llama (la sesión de Supabase de la app)
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth?.user) return json(401, { error: "Sesión no válida" });
  const userId = auth.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo no válido" });
  }
  const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const html = typeof body.html === "string" ? body.html : "";
  const text = typeof body.text === "string" ? body.text : "";
  const dryRun = body.dryRun === true;
  if (!reservationId || !subject || subject.length > MAX_SUBJECT || html.length > MAX_HTML || text.length > MAX_TEXT) {
    return json(400, { error: "Datos del aviso incompletos o demasiado largos" });
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, hotelid, guestid, created_at")
    .eq("id", reservationId)
    .maybeSingle();
  if (!reservation) return json(404, { error: "Reserva no encontrada" });

  // Solo el huésped de la reserva o el personal de ese hotel
  const { data: caller } = await admin.from("users").select("rol, hotelid").eq("id", userId).maybeSingle();
  const role = caller?.rol ?? "cliente";
  const isGuest = reservation.guestid === userId;
  const isStaff = role === "super_admin" || (STAFF_ROLES.includes(role) && caller?.hotelid === reservation.hotelid);
  if (!isGuest && !isStaff) return json(403, { error: "No puedes avisar de esta reserva" });

  // Destinatarios
  const [{ data: admins }, { data: hotel }, { data: owner }] = await Promise.all([
    admin.from("users").select("email").eq("rol", "hotel_admin").eq("hotelid", reservation.hotelid),
    admin.from("hotels").select("contacto").eq("id", reservation.hotelid).maybeSingle(),
    admin.from("hotel_owners").select("email").eq("hotel_id", reservation.hotelid).maybeSingle(),
  ]);
  const candidates = [
    ...(admins ?? []).map((a: { email: string | null }) => a.email),
    (hotel?.contacto as Record<string, unknown> | null)?.email,
    owner?.email,
  ];
  const recipients = [...new Set(candidates.filter(isValidEmail).map((e) => e.trim().toLowerCase()))];
  if (recipients.length === 0) recipients.push(FALLBACK_RECIPIENT);

  if (dryRun) {
    return json(200, { dryRun: true, count: recipients.length, recipients: recipients.map(mask), ownerIncluded: isValidEmail(owner?.email) });
  }

  // Una sola vez por reserva, y el huésped solo durante la primera hora
  const marker = `[aviso-reserva:${reservation.id}]`;
  const { count: alreadySent } = await admin
    .from("logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "Aviso de reserva enviado")
    .like("detalles", `${marker}%`);
  if ((alreadySent ?? 0) > 0) return json(200, { sent: 0, skipped: "ya avisada" });
  const createdAt = reservation.created_at ? new Date(reservation.created_at).getTime() : 0;
  if (!isStaff && (!createdAt || Date.now() - createdAt > MAX_AGE_MS)) {
    return json(409, { error: "La reserva ya no admite avisos" });
  }

  let sent = 0;
  await Promise.all(recipients.map(async (to) => {
    try {
      const res = await fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html, text }),
      });
      if (res.ok) sent++;
      else console.error(`send-email ${res.status} para ${mask(to)}`);
    } catch (err) {
      console.error(`send-email sin conexión para ${mask(to)}:`, err instanceof Error ? err.message : err);
    }
  }));

  const now = new Date();
  await admin.from("logs").insert({
    id: `log-aviso-${reservation.id}-${now.getTime()}`,
    timestamp: now.toISOString(),
    user: "Sistema",
    role: "sistema",
    action: "Aviso de reserva enviado",
    detalles: `${marker} Aviso de reserva pendiente enviado a ${sent} de ${recipients.length} destinatarios.`,
  });

  return json(200, { sent, total: recipients.length });
});
