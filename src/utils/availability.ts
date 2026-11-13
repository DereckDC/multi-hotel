/**
 * Reglas de disponibilidad por noches. Todas las fechas son "YYYY-MM-DD".
 *
 * La fecha de salida es EXCLUSIVA: una reserva del 10 al 15 ocupa las noches 10, 11, 12, 13 y 14,
 * y el día 15 queda libre para que entre otro huésped. Es la misma regla de iCal, de la validación
 * de reservas y del trigger de la base de datos.
 */

/** ¿Se solapan dos estancias [aInicio, aFin) y [bInicio, bFin)? */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Suma (o resta) días a una fecha "YYYY-MM-DD" sin problemas de zona horaria. */
export function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export interface StayRange {
  fechaEntrada: string;
  fechaSalida: string;
}

/** Conjunto de NOCHES ocupadas por las estancias dadas (el día de salida no cuenta). */
export function occupiedNights(stays: StayRange[]): Set<string> {
  const nights = new Set<string>();
  for (const s of stays) {
    if (!s.fechaEntrada || !s.fechaSalida || s.fechaSalida <= s.fechaEntrada) continue;
    let cur = s.fechaEntrada;
    // Tope de seguridad: ningún bloqueo útil supera tres años
    for (let i = 0; i < 1100 && cur < s.fechaSalida; i++) {
      nights.add(cur);
      cur = shiftDate(cur, 1);
    }
  }
  return nights;
}

/** ¿Está libre cada noche de [checkIn, checkOut)? */
export function isRangeFree(nights: Set<string>, checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut || checkOut <= checkIn) return false;
  let cur = checkIn;
  for (let i = 0; i < 1100 && cur < checkOut; i++) {
    if (nights.has(cur)) return false;
    cur = shiftDate(cur, 1);
  }
  return true;
}
