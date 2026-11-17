// Reglas de cobro de reservas con la Cajita de Payphone (sin dependencias: se usan en la función
// Edge `payphone` y en las pruebas de la app).
//
// Payphone trabaja en centavos y exige que
//   amount = amountWithoutTax + amountWithTax + tax + service + tip
// Los montos SIEMPRE salen de la reserva guardada, nunca de lo que envíe el navegador.

export type PaymentKind = "reserva_abono" | "reserva_total" | "reserva_saldo";

export const PAYMENT_KINDS: PaymentKind[] = ["reserva_abono", "reserva_total", "reserva_saldo"];

/** Porcentaje del abono para separar la reserva */
export const ABONO_RATE = 0.2;

/** Payphone no admite cobros menores a 1 USD en la Cajita */
export const MIN_PAYMENT_CENTS = 100;

export const toCents = (usd: number): number => Math.round(Number(usd || 0) * 100);

export interface ReservationForPayment {
  estado: string;
  total: number;
  impuestos: number;
  montoPagado?: number | null;
}

export interface PaymentAmounts {
  amount: number;
  amountWithTax: number;
  amountWithoutTax: number;
  tax: number;
}

/** Lee el abono guardado en notes: [PAYMENT_INFO:{"montoPagado":..,"montoPendiente":..}] */
export function readPaymentInfo(notes: string | null | undefined): { montoPagado?: number; montoPendiente?: number } {
  const m = String(notes ?? "").match(/\[PAYMENT_INFO:(.*?)\]/);
  if (!m) return {};
  try {
    const p = JSON.parse(m[1]);
    return {
      montoPagado: Number.isFinite(Number(p.montoPagado)) ? Number(p.montoPagado) : undefined,
      montoPendiente: Number.isFinite(Number(p.montoPendiente)) ? Number(p.montoPendiente) : undefined,
    };
  } catch {
    return {};
  }
}

/** Qué cobros admite la reserva en su estado actual */
export function allowedKinds(r: ReservationForPayment): PaymentKind[] {
  const totalC = toCents(r.total);
  const paidC = toCents(r.montoPagado ?? 0);
  if (totalC <= 0) return [];
  if (r.estado === "pendiente" && paidC === 0) return ["reserva_abono", "reserva_total"];
  if ((r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "ocupada") && paidC > 0 && paidC < totalC) {
    return ["reserva_saldo"];
  }
  return [];
}

/**
 * Monto a cobrar (en centavos) con el desglose que pide Payphone. El IVA se reparte en proporción
 * al de la reserva; todo lo que no es IVA se declara como base gravada (o no gravada si la reserva
 * no tiene IVA). Así la suma siempre cuadra exactamente.
 */
export function paymentAmounts(r: ReservationForPayment, kind: PaymentKind): PaymentAmounts | { error: string } {
  if (!allowedKinds(r).includes(kind)) return { error: "Esta reserva no admite ese pago en su estado actual." };
  const totalC = toCents(r.total);
  const taxTotalC = Math.min(Math.max(toCents(r.impuestos), 0), totalC);
  const paidC = toCents(r.montoPagado ?? 0);

  let amount = 0;
  if (kind === "reserva_total") amount = totalC;
  else if (kind === "reserva_abono") amount = Math.round(totalC * ABONO_RATE);
  else amount = totalC - paidC;

  if (amount < MIN_PAYMENT_CENTS) return { error: "El monto a pagar es menor a 1 USD." };

  const tax = totalC > 0 ? Math.round((amount * taxTotalC) / totalC) : 0;
  const base = amount - tax;
  return tax > 0
    ? { amount, amountWithTax: base, amountWithoutTax: 0, tax }
    : { amount, amountWithTax: 0, amountWithoutTax: base, tax: 0 };
}

export const sumsUp = (a: PaymentAmounts): boolean =>
  a.amount === a.amountWithTax + a.amountWithoutTax + a.tax && a.amount > 0;

/** Pagado y pendiente (USD) después de aprobar un cobro */
export function afterPayment(totalUsd: number, paidUsd: number, amountCents: number) {
  const totalC = toCents(totalUsd);
  const paidC = Math.min(totalC, toCents(paidUsd) + amountCents);
  return { montoPagado: paidC / 100, montoPendiente: (totalC - paidC) / 100 };
}

/**
 * Tope inferior del total de la reserva según la tarifa de la habitación, para no cobrar una
 * reserva cuyo total fue manipulado al crearla. Las tarifas variables pueden ser más bajas que la
 * base, así que se usa la menor de todas por noche; el IVA y los servicios solo suman.
 * En alquiler el total incluye al menos un mes.
 */
export function minimumReservationTotal(opts: {
  roomPrice: number;
  variationPrices: number[];
  noches: number;
  isRental: boolean;
}): number {
  const prices = [opts.roomPrice, ...opts.variationPrices].map(Number).filter((p) => Number.isFinite(p) && p >= 0);
  const minNight = prices.length ? Math.min(...prices) : 0;
  if (opts.isRental) return Math.max(0, Number(opts.roomPrice) || 0);
  return minNight * Math.max(1, Math.floor(Number(opts.noches) || 1));
}

/** clientTransactionId para Payphone: único y de máx. 50 caracteres */
export function makeClientTransactionId(reservationId: string, random: string): string {
  const res = String(reservationId).replace(/[^A-Za-z0-9-]/g, "").slice(0, 30);
  return `RM-${res}-${random.replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}`.slice(0, 50);
}

/** ¿La respuesta de confirmación de Payphone corresponde al cobro esperado y fue aprobada? */
export function checkConfirmation(
  expected: { clientTransactionId: string; amountCents: number },
  res: { statusCode?: number; transactionStatus?: string; clientTransactionId?: string; amount?: number },
): "aprobado" | "cancelado" | "no_coincide" {
  if (res.clientTransactionId !== expected.clientTransactionId) return "no_coincide";
  if (res.statusCode === 3 && String(res.transactionStatus ?? "Approved").toLowerCase() === "approved") {
    return Number(res.amount) === expected.amountCents ? "aprobado" : "no_coincide";
  }
  return "cancelado";
}
