// Función Edge `payphone` (Supabase) · cobro de reservas con la Cajita de Pagos de Payphone.
//
//   POST {action: "prepare", reservationId, kind}   Con sesión del huésped. Calcula el monto en el
//        servidor a partir de la reserva guardada y crea el pago (status "creado"). Devuelve {paymentId}.
//   POST {action: "prepare_plan", kind, planId, billing, sri?}  Con sesión del anfitrión (admin de hotel).
//        Cobra su plan (kind "plan") o la puesta en marcha (kind "puesta_en_marcha"). El monto lo
//        calcula el servidor con los precios de _shared/plans.ts y las unidades que tiene registradas;
//        con sri: true suma el módulo de facturación electrónica del SRI por cada propiedad.
//   POST {action: "box", paymentId}                 Sin sesión (el APK abre la página de pago en el
//        navegador del teléfono). Devuelve los datos para dibujar la Cajita. El id del pago es un
//        UUID aleatorio; el token de la Cajita es público por diseño de Payphone (va en la página).
//   POST {action: "confirm", id, clientTransactionId} Sin sesión. Confirma con Payphone (antes de
//        5 min o Payphone revierte el cobro), valida monto e identificador y aplica el pago a la
//        reserva en una sola operación (función SQL aplicar_pago_reserva). Idempotente.
//
// Secretos: PAYPHONE_TOKEN, PAYPHONE_STORE_ID. Se despliega con verify_jwt = false.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  PAYMENT_KINDS,
  type PaymentKind,
  checkConfirmation,
  makeClientTransactionId,
  minimumReservationTotal,
  paymentAmounts,
  readPaymentInfo,
  sumsUp,
  toCents,
} from "./paymentRules.ts";
import { BRAND, type BrandEmail, emailSubject, renderBrandEmail, renderBrandText } from "../_shared/brandEmail.ts";
import { BILLINGS, type Billing, findPlan, planCharge } from "../_shared/plans.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAYPHONE_TOKEN = Deno.env.get("PAYPHONE_TOKEN") ?? "";
const PAYPHONE_STORE_ID = Deno.env.get("PAYPHONE_STORE_ID") ?? "";
const CONFIRM_URL = "https://paymentbox.payphonetodoesposible.com/api/confirm";
const SEND_EMAIL_URL = Deno.env.get("ROOMIA_SEND_EMAIL_URL") ?? "https://www.roomiapms.site/api/send-email";
const BOX_VALID_MS = 10 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

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

const KIND_LABEL: Record<string, string> = {
  reserva_abono: "Abono del 20% de la reserva",
  reserva_total: "Pago total de la reserva",
  reserva_saldo: "Saldo pendiente de la reserva",
  plan: "Plan de Roomia PMS",
  puesta_en_marcha: "Puesta en marcha (pago único)",
};

const PLAN_KINDS = ["plan", "puesta_en_marcha"];
const isPlanKind = (kind: string) => PLAN_KINDS.includes(kind);

/** "Plan Roomia 3 · mensual" a partir del detalle guardado en el pago */
function planLabel(kind: string, details: Record<string, unknown> | null): string {
  if (kind === "puesta_en_marcha") return KIND_LABEL.puesta_en_marcha;
  const plan = findPlan(String(details?.planId ?? ""));
  if (!plan) return KIND_LABEL.plan;
  const props = Number(details?.sriProps ?? 1);
  const sri = details?.sri === true ? ` + facturación SRI${props > 1 ? ` (${props} propiedades)` : ""}` : "";
  return `Plan ${plan.name} · ${details?.billing === "anual" ? "anual" : "mensual"}${sri}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Reservation = {
  id: string;
  hotelid: string;
  roomid: string;
  guestid: string;
  estado: string;
  total: number;
  impuestos: number;
  noches: number;
  notes: string | null;
  fechaentrada: string;
  fechasalida: string;
};

async function loadReservation(id: string): Promise<Reservation | null> {
  const { data } = await admin
    .from("reservations")
    .select("id, hotelid, roomid, guestid, estado, total, impuestos, noches, notes, fechaentrada, fechasalida")
    .eq("id", id)
    .maybeSingle();
  return data ? { ...data, total: Number(data.total), impuestos: Number(data.impuestos), noches: Number(data.noches) } : null;
}

const forPayment = (r: Reservation) => ({
  estado: r.estado,
  total: r.total,
  impuestos: r.impuestos,
  montoPagado: readPaymentInfo(r.notes).montoPagado ?? 0,
});

// ---------------------------------------------------------------- prepare
async function prepare(req: Request, body: Record<string, unknown>): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json(401, { error: "Inicia sesión para pagar tu reserva." });

  const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
  const kind = body.kind as PaymentKind;
  if (!reservationId || !PAYMENT_KINDS.includes(kind)) return json(400, { error: "Datos del pago incompletos." });

  const r = await loadReservation(reservationId);
  if (!r) return json(404, { error: "No encontramos la reserva." });
  if (r.guestid !== auth.user.id) return json(403, { error: "Solo el huésped de la reserva puede pagarla en línea." });

  const amounts = paymentAmounts(forPayment(r), kind);
  if ("error" in amounts) return json(409, { error: amounts.error });
  if (!sumsUp(amounts)) return json(500, { error: "No se pudo calcular el monto del pago." });

  // El total lo calculó el navegador al reservar: se comprueba contra la tarifa de la habitación
  const [{ data: room }, { data: variations }, { data: hotel }] = await Promise.all([
    admin.from("rooms").select("precio").eq("id", r.roomid).maybeSingle(),
    admin.from("room_price_variations").select("precio").eq("room_id", r.roomid),
    admin.from("hotels").select("tipoestablecimiento, contacto").eq("id", r.hotelid).maybeSingle(),
  ]);
  if (!room) return json(409, { error: "La habitación de esta reserva ya no existe." });
  const isRental = ["casa", "departamento"].includes(String(hotel?.tipoestablecimiento ?? "")) &&
    (hotel?.contacto as Record<string, unknown> | null)?.finalidad === "alquiler";
  const minimum = minimumReservationTotal({
    roomPrice: Number(room.precio),
    variationPrices: (variations ?? []).map((v: { precio: number }) => Number(v.precio)),
    noches: r.noches,
    isRental,
  });
  if (toCents(r.total) < toCents(minimum)) {
    return json(409, { error: "El total de la reserva no coincide con la tarifa de la habitación. Comunícate con el establecimiento." });
  }

  const clientTransactionId = makeClientTransactionId(r.id, crypto.randomUUID());
  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      kind,
      reservation_id: r.id,
      hotel_id: r.hotelid,
      payer_id: auth.user.id,
      amount_cents: amounts.amount,
      amount_with_tax: amounts.amountWithTax,
      amount_without_tax: amounts.amountWithoutTax,
      tax_cents: amounts.tax,
      client_transaction_id: clientTransactionId,
    })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("payphone prepare:", error?.message);
    return json(500, { error: "No se pudo iniciar el pago. Inténtalo de nuevo." });
  }
  return json(200, { paymentId: payment.id, amount: amounts.amount });
}

// ---------------------------------------------------------------- prepare_plan
async function preparePlan(req: Request, body: Record<string, unknown>): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json(401, { error: "Inicia sesión para pagar tu plan." });

  const kind = String(body.kind ?? "");
  const plan = findPlan(String(body.planId ?? ""));
  const billing = String(body.billing ?? "") as Billing;
  const sri = kind === "plan" && body.sri === true;
  if (!isPlanKind(kind) || !plan || !BILLINGS.includes(billing)) return json(400, { error: "Elige un plan y la forma de pago." });

  const { data: user } = await admin.from("users").select("id, rol, hotelid").eq("id", auth.user.id).maybeSingle();
  if (user?.rol !== "hotel_admin") return json(403, { error: "Solo los administradores de hotel pagan un plan." });

  const { data: sub } = await admin.from("subscriptions").select("id, setup_paid, status").eq("owner_id", user.id).maybeSingle();
  if (sub?.status === "cancelada") return json(409, { error: "Tu plan está cancelado. Escríbenos para reactivarlo." });
  if (kind === "puesta_en_marcha" && sub?.setup_paid) return json(409, { error: "La puesta en marcha ya está pagada." });

  // Unidades registradas: habitaciones del establecimiento (una casa o departamento completo cuenta como 1)
  let units = 0;
  if (user.hotelid) {
    const [{ count }, { data: hotel }] = await Promise.all([
      admin.from("rooms").select("id", { count: "exact", head: true }).eq("hotelid", user.hotelid),
      admin.from("hotels").select("tipoestablecimiento").eq("id", user.hotelid).maybeSingle(),
    ]);
    units = ["casa", "departamento"].includes(String(hotel?.tipoestablecimiento ?? "")) ? 1 : (count ?? 0);
  }

  // El módulo SRI se cobra por propiedad (hotel, casa o departamento) del anfitrión. Hoy cada
  // anfitrión tiene una sola propiedad (users.hotelid); si tiene varias, contarlas aquí.
  const sriProps = sri && user.hotelid ? 1 : 0;
  if (sri && !sriProps) return json(400, { error: "Registra tu propiedad antes de agregar la facturación electrónica." });
  const amount = toCents(planCharge(kind as "plan" | "puesta_en_marcha", plan, units, billing, sriProps));
  if (amount <= 0) return json(500, { error: "No se pudo calcular el monto del plan." });

  const clientTransactionId = makeClientTransactionId(kind === "plan" ? "PLAN" : "SETUP", crypto.randomUUID());
  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      kind,
      subscription_id: sub?.id ?? null,
      hotel_id: user.hotelid ?? null,
      payer_id: auth.user.id,
      amount_cents: amount,
      amount_with_tax: 0,
      amount_without_tax: amount,
      tax_cents: 0,
      client_transaction_id: clientTransactionId,
      details: { planId: plan.id, billing, units, sri, sriProps },
    })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("payphone prepare_plan:", error?.message);
    return json(500, { error: "No se pudo iniciar el pago. Inténtalo de nuevo." });
  }
  return json(200, { paymentId: payment.id, amount });
}

// ---------------------------------------------------------------- box
async function box(body: Record<string, unknown>): Promise<Response> {
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  if (!UUID_RE.test(paymentId)) return json(400, { error: "Enlace de pago no válido." });

  const { data: p } = await admin
    .from("payments")
    .select("id, kind, reservation_id, hotel_id, amount_cents, amount_with_tax, amount_without_tax, tax_cents, currency, client_transaction_id, status, created_at, details")
    .eq("id", paymentId)
    .maybeSingle();
  if (!p) return json(404, { error: "No encontramos este pago." });

  const [{ data: hotel }, r] = await Promise.all([
    admin.from("hotels").select("nombre").eq("id", p.hotel_id).maybeSingle(),
    p.reservation_id ? loadReservation(p.reservation_id) : Promise.resolve(null),
  ]);
  const { data: room } = r ? await admin.from("rooms").select("nombre").eq("id", r.roomid).maybeSingle() : { data: null };
  const forPlan = isPlanKind(p.kind);
  const summary = {
    kind: p.kind,
    kindLabel: forPlan ? planLabel(p.kind, p.details) : (KIND_LABEL[p.kind] ?? "Pago"),
    amount: p.amount_cents,
    reservationId: p.reservation_id,
    hotel: forPlan ? "Roomia PMS" : (hotel?.nombre ?? ""),
    room: room?.nombre ?? "",
    fechaEntrada: r?.fechaentrada ?? "",
    fechaSalida: r?.fechasalida ?? "",
  };

  const expiresAt = new Date(p.created_at).getTime() + BOX_VALID_MS;
  if (p.status !== "creado") return json(200, { status: p.status, summary });
  if (Date.now() > expiresAt) return json(200, { status: "expirado", summary });
  if (!PAYPHONE_TOKEN || !PAYPHONE_STORE_ID) {
    return json(503, { error: "Los pagos en línea todavía no están activos. Paga en el establecimiento o por transferencia.", summary });
  }

  return json(200, {
    status: "creado",
    summary,
    expiresAt: new Date(expiresAt).toISOString(),
    box: {
      token: PAYPHONE_TOKEN,
      storeId: PAYPHONE_STORE_ID,
      clientTransactionId: p.client_transaction_id,
      amount: p.amount_cents,
      amountWithoutTax: p.amount_without_tax,
      amountWithTax: p.amount_with_tax,
      tax: p.tax_cents,
      service: 0,
      tip: 0,
      currency: p.currency,
      reference: (forPlan ? `${planLabel(p.kind, p.details)} · Roomia PMS` : `Reserva ${p.reservation_id ?? ""} · ${hotel?.nombre ?? "Roomia"}`).slice(0, 100),
    },
  });
}

// ---------------------------------------------------------------- confirm
async function sendPaymentEmails(paymentId: string) {
  try {
    const { data: p } = await admin
      .from("payments")
      .select("kind, amount_cents, reservation_id, hotel_id, payer_id, card_brand, last_digits")
      .eq("id", paymentId)
      .maybeSingle();
    if (!p) return;
    const [r, { data: guest }, { data: admins }, { data: hotel }] = await Promise.all([
      loadReservation(p.reservation_id),
      admin.from("users").select("nombre, email").eq("id", p.payer_id).maybeSingle(),
      admin.from("users").select("email").eq("rol", "hotel_admin").eq("hotelid", p.hotel_id),
      admin.from("hotels").select("nombre, contacto").eq("id", p.hotel_id).maybeSingle(),
    ]);
    if (!r) return;
    const info = readPaymentInfo(r.notes);
    const pendiente = Number(info.montoPendiente ?? 0);
    const pagado = Number(info.montoPagado ?? 0);
    const contacto = (hotel?.contacto ?? {}) as Record<string, unknown>;
    const { data: room } = await admin.from("rooms").select("numero, nombre").eq("id", r.roomid).maybeSingle();
    const card = [p.card_brand, p.last_digits ? `****${p.last_digits}` : ""].filter(Boolean).join(" ");
    const money = (n: number) => `$${n.toFixed(2)} USD`;

    const base = (forGuest: boolean): BrandEmail => ({
      preheader: `${forGuest ? "Recibimos tu pago" : "Pago en línea recibido"} de ${usd(p.amount_cents)} para la reserva ${r.id}.`,
      eyebrow: "Comprobante de pago",
      title: forGuest ? "¡Recibimos tu pago!" : "Pago en línea recibido",
      greeting: forGuest ? `Hola, ${guest?.nombre ?? ""}`.trim() : `Hola, equipo de ${hotel?.nombre ?? "tu establecimiento"}`,
      paragraphs: [
        forGuest
          ? `Tu pago para **${hotel?.nombre ?? "tu reserva"}** fue aprobado${pendiente > 0 ? ". Tu reserva está confirmada; el saldo puedes pagarlo desde \"Mis reservas\" o en el establecimiento." : " y tu reserva está totalmente pagada."}`
          : `**${guest?.nombre ?? "El huésped"}** pagó en línea con Payphone. La reserva se actualizó automáticamente en Roomia.`,
      ],
      status: {
        label: "Estado de la reserva",
        value: pendiente > 0 ? "Confirmada · saldo pendiente" : "Confirmada y pagada",
        tone: "success",
        reference: `Código ${r.id}`,
      },
      sections: [
        {
          title: "Detalle del pago",
          rows: [
            ["Concepto", KIND_LABEL[p.kind] ?? "Pago"],
            ["Medio de pago", card ? `Payphone · ${card}` : "Payphone"],
            ["Fecha", new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })],
          ],
        },
        {
          title: "Estadía",
          rows: [
            ["Establecimiento", hotel?.nombre],
            ["Habitación", room ? `${room.numero ? `${room.numero} · ` : ""}${room.nombre}` : undefined],
            ["Entrada", r.fechaentrada],
            ["Salida", r.fechasalida],
          ],
        },
      ],
      amounts: {
        title: "Resumen",
        rows: [
          ["Pagado ahora", money(p.amount_cents / 100)],
          ["Total pagado de la reserva", money(pagado)],
          ["Total de la reserva", money(r.total)],
        ],
        total: ["Saldo pendiente", money(pendiente)],
      },
      cta: forGuest
        ? { label: pendiente > 0 ? "Ver mi reserva" : "Ver mis reservas", url: `${BRAND.site}/?seccion=mis-reservas` }
        : { label: "Abrir el panel de reservas", url: BRAND.site },
      contact: forGuest
        ? [contacto.telefono, contacto.email].filter(Boolean).length
          ? `${hotel?.nombre ?? "El establecimiento"}: ${[contacto.telefono, contacto.email].filter(Boolean).join(" · ")}`
          : undefined
        : undefined,
    });

    const send = (to: string, subject: string, email: BrandEmail) =>
      fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html: renderBrandEmail(email), text: renderBrandText(email) }),
      }).catch(() => null);

    const jobs: Promise<unknown>[] = [];
    if (guest?.email && EMAIL_RE.test(guest.email)) {
      jobs.push(send(guest.email, emailSubject("Comprobante de pago", r.id, hotel?.nombre), base(true)));
    }
    const staff = [...(admins ?? []).map((a: { email: string | null }) => a.email), contacto.email]
      .filter((e): e is string => typeof e === "string" && EMAIL_RE.test(e.trim()))
      .map((e) => e.trim().toLowerCase());
    for (const to of new Set(staff)) {
      jobs.push(send(to, emailSubject("Pago en línea recibido", r.id, hotel?.nombre), base(false)));
    }
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("payphone emails:", (e as Error)?.message);
  }
}

async function sendPlanEmail(paymentId: string) {
  try {
    const { data: p } = await admin
      .from("payments")
      .select("kind, amount_cents, payer_id, card_brand, last_digits, details, subscription_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!p) return;
    const [{ data: host }, { data: sub }] = await Promise.all([
      admin.from("users").select("nombre, email").eq("id", p.payer_id).maybeSingle(),
      admin.from("subscriptions").select("current_period_end").eq("owner_id", p.payer_id).maybeSingle(),
    ]);
    if (!host?.email || !EMAIL_RE.test(host.email)) return;
    const card = [p.card_brand, p.last_digits ? `****${p.last_digits}` : ""].filter(Boolean).join(" ");
    const until = sub?.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "long" })
      : undefined;
    const email: BrandEmail = {
      preheader: `Recibimos tu pago de ${usd(p.amount_cents)} de Roomia PMS.`,
      eyebrow: "Comprobante de pago",
      title: "¡Recibimos tu pago!",
      greeting: `Hola, ${host.nombre ?? ""}`.trim(),
      paragraphs: [
        p.kind === "plan"
          ? `Tu plan quedó al día${until ? ` hasta el **${until}**` : ""}. Gracias por confiar en Roomia PMS.`
          : "Recibimos el pago de la puesta en marcha. Nuestro equipo te contactará para cargar tus unidades y capacitar a tu personal.",
      ],
      status: { label: "Estado del plan", value: "Al día", tone: "success" },
      sections: [
        {
          title: "Detalle del pago",
          rows: [
            ["Concepto", planLabel(p.kind, p.details)],
            ["Medio de pago", card ? `Payphone · ${card}` : "Payphone"],
            ["Fecha", new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })],
          ],
        },
      ],
      amounts: { title: "Resumen", rows: [], total: ["Pagado", `${usd(p.amount_cents)} USD`] },
      cta: { label: "Ver mi plan", url: `${BRAND.site}/?seccion=mi-plan` },
    };
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: host.email,
        subject: emailSubject("Comprobante de pago", undefined, "Roomia PMS"),
        html: renderBrandEmail(email),
        text: renderBrandText(email),
      }),
    }).catch(() => null);
  } catch (e) {
    console.error("payphone plan email:", (e as Error)?.message);
  }
}

async function confirm(body: Record<string, unknown>): Promise<Response> {
  const payphoneId = String(body.id ?? "").trim();
  const clientTransactionId = typeof body.clientTransactionId === "string" ? body.clientTransactionId.trim() : "";
  if (!/^\d{1,20}$/.test(payphoneId) || !clientTransactionId || clientTransactionId.length > 50) {
    return json(400, { error: "Datos de confirmación no válidos." });
  }

  const { data: p } = await admin
    .from("payments")
    .select("id, kind, reservation_id, amount_cents, status, status_detail")
    .eq("client_transaction_id", clientTransactionId)
    .maybeSingle();
  if (!p) return json(404, { error: "No encontramos este pago." });

  const result = (status: string, extra: Record<string, unknown> = {}) =>
    json(200, { status, paymentId: p.id, reservationId: p.reservation_id, amount: p.amount_cents, kind: p.kind, ...extra });

  const forPlan = isPlanKind(p.kind);
  if (p.status === "aprobado") {
    // Confirmación repetida (recargar la página): se devuelve el estado actual sin tocar nada
    if (forPlan) return result("aprobado", { kind: p.kind });
    const r = p.reservation_id ? await loadReservation(p.reservation_id) : null;
    const info = readPaymentInfo(r?.notes);
    return result("aprobado", { montoPagado: info.montoPagado, montoPendiente: info.montoPendiente });
  }
  if (p.status === "cancelado" || p.status === "error") return result(p.status, { detail: p.status_detail });

  // Se reserva el pago para que dos confirmaciones a la vez no lo apliquen dos veces
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "procesando" })
    .eq("id", p.id)
    .in("status", ["creado", "expirado"])
    .select("id");
  if (!claimed?.length) return result("procesando");

  const setStatus = (status: string, detail: string | null, extra: Record<string, unknown> = {}) =>
    admin.from("payments").update({ status, status_detail: detail, payphone_transaction_id: payphoneId, ...extra }).eq("id", p.id);

  // Si la reserva ya no admite este cobro, no se confirma: Payphone lo revierte solo en 5 minutos
  // (los pagos de plan no dependen de una reserva: su monto se fijó en el servidor al prepararlos)
  const r = !forPlan && p.reservation_id ? await loadReservation(p.reservation_id) : null;
  const expected = forPlan
    ? { amount: p.amount_cents }
    : r ? paymentAmounts(forPayment(r), p.kind as PaymentKind) : { error: "sin reserva" };
  if ((!forPlan && !r) || "error" in expected || expected.amount !== p.amount_cents) {
    const detail = "La reserva cambió o fue cancelada antes de confirmar el pago. Payphone revierte el cobro automáticamente.";
    await setStatus("cancelado", detail);
    return result("cancelado", { detail });
  }

  if (!PAYPHONE_TOKEN) {
    await admin.from("payments").update({ status: "creado" }).eq("id", p.id);
    return json(503, { error: "Los pagos en línea todavía no están activos." });
  }

  let pp: Record<string, unknown>;
  try {
    const res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYPHONE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(payphoneId), clientTxId: clientTransactionId }),
    });
    pp = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("payphone confirm http", res.status, JSON.stringify(pp).slice(0, 300));
      await admin.from("payments").update({ status: "creado" }).eq("id", p.id);
      return json(502, { error: "Payphone no respondió la confirmación. Vuelve a intentarlo en unos segundos." });
    }
  } catch (e) {
    console.error("payphone confirm red:", (e as Error)?.message);
    await admin.from("payments").update({ status: "creado" }).eq("id", p.id);
    return json(502, { error: "No pudimos comunicarnos con Payphone. Vuelve a intentarlo en unos segundos." });
  }

  const verdict = checkConfirmation(
    { clientTransactionId, amountCents: p.amount_cents },
    {
      statusCode: Number(pp.statusCode),
      transactionStatus: pp.transactionStatus as string | undefined,
      clientTransactionId: pp.clientTransactionId as string | undefined,
      amount: Number(pp.amount),
    },
  );

  if (verdict === "cancelado") {
    const detail = String(pp.message ?? "El pago no fue aprobado.");
    await setStatus("cancelado", detail);
    return result("cancelado", { detail });
  }
  if (verdict === "no_coincide") {
    const detail = `Payphone confirmó ${usd(Number(pp.amount) || 0)} y se esperaban ${usd(p.amount_cents)}. Revisar y devolver.`;
    console.error("payphone confirm no coincide:", p.id, detail);
    await setStatus("error", detail);
    return result("error", { detail: "El pago no coincide con la reserva. El establecimiento lo revisará y te contactará." });
  }

  if (forPlan) {
    const { error: planError } = await admin.rpc("aplicar_pago_plan", {
      p_payment_id: p.id,
      p_payphone_id: String(pp.transactionId ?? payphoneId),
      p_card_brand: String(pp.cardBrand ?? ""),
      p_last_digits: String(pp.lastDigits ?? ""),
      p_authorization_code: String(pp.authorizationCode ?? ""),
    });
    if (planError) {
      console.error("aplicar_pago_plan:", planError.message);
      await setStatus("error", `Cobro confirmado en Payphone pero no se pudo aplicar al plan: ${planError.message}`);
      return result("error", { kind: p.kind, detail: "Recibimos tu pago, pero no pudimos actualizar tu plan. Lo revisaremos y te escribiremos." });
    }
    await sendPlanEmail(p.id);
    return result("aprobado", { kind: p.kind });
  }

  const { data: applied, error } = await admin.rpc("aplicar_pago_reserva", {
    p_payment_id: p.id,
    p_payphone_id: String(pp.transactionId ?? payphoneId),
    p_card_brand: String(pp.cardBrand ?? ""),
    p_last_digits: String(pp.lastDigits ?? ""),
    p_authorization_code: String(pp.authorizationCode ?? ""),
  });
  if (error) {
    // El cobro ya está confirmado en Payphone: queda en "error" para revisarlo a mano
    console.error("aplicar_pago_reserva:", error.message);
    await setStatus("error", `Cobro confirmado en Payphone pero no se pudo aplicar a la reserva: ${error.message}`);
    return result("error", { detail: "Recibimos tu pago, pero no pudimos actualizar la reserva. El establecimiento lo revisará." });
  }

  await sendPaymentEmails(p.id);
  return result("aprobado", { montoPagado: applied?.montoPagado, montoPendiente: applied?.montoPendiente });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo no válido" });
  }

  try {
    if (body.action === "prepare") return await prepare(req, body);
    if (body.action === "prepare_plan") return await preparePlan(req, body);
    if (body.action === "box") return await box(body);
    if (body.action === "confirm") return await confirm(body);
    return json(400, { error: "Acción no válida" });
  } catch (e) {
    console.error("payphone:", (e as Error)?.message || e);
    return json(500, { error: "No se pudo procesar el pago." });
  }
});
