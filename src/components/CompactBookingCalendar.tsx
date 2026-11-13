import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, AlertCircle } from 'lucide-react';
import { Reservation, Room, RoomPriceVariation } from '../types';
import { occupiedNights, isRangeFree } from '../utils/availability';

interface CompactBookingCalendarProps {
  room: Room;
  reservations: Reservation[];
  checkInDate: string;
  checkOutDate: string;
  onSelectRange: (checkIn: string, checkOut: string) => void;
  roomPriceVariations?: RoomPriceVariation[];
  isAlquiler?: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export function CompactBookingCalendar({
  room,
  reservations,
  checkInDate,
  checkOutDate,
  onSelectRange,
  roomPriceVariations = [],
  isAlquiler = false
}: CompactBookingCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  }, [today]);

  // Current viewed month & year
  const [viewYear, setViewYear] = useState(() => {
    if (checkInDate) {
      const parts = checkInDate.split('-');
      if (parts.length === 3) return parseInt(parts[0], 10);
    }
    return today.getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (checkInDate) {
      const parts = checkInDate.split('-');
      if (parts.length === 3) return parseInt(parts[1], 10) - 1;
    }
    return today.getMonth();
  });

  // Hover state for range selection feedback
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Month navigation
  const canGoPrev = useMemo(() => {
    return viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  }, [viewYear, viewMonth, today]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // NOCHES ocupadas de esta habitación (incluye las reservas de otros huéspedes y los bloqueos de
  // Airbnb/Booking, que llegan como rangos anónimos). El día de salida queda libre: es la misma
  // regla que usa la validación de la reserva y la base de datos.
  const occupiedDatesSet = useMemo(
    () => occupiedNights(reservations.filter(res =>
      res.roomId === room.id && res.estado !== 'cancelada' && res.estado !== 'finalizada'
    )),
    [reservations, room.id]
  );

  // El día de salida de otra reserva no se puede elegir como llegada, pero sí como salida
  // de una estancia que termina ese día, siempre que las noches intermedias estén libres.
  const isCheckoutCandidate = (dateStr: string) =>
    !isAlquiler && !!checkInDate && !checkOutDate && dateStr > checkInDate && isRangeFree(occupiedDatesSet, checkInDate, dateStr);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isPast: boolean;
      isOccupied: boolean;
    }> = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 12 : viewMonth;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isPast: dateStr < todayStr,
        isOccupied: occupiedDatesSet.has(dateStr)
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isPast: dateStr < todayStr,
        isOccupied: occupiedDatesSet.has(dateStr)
      });
    }

    // Next month padding to complete 35 or 42 cells
    const remaining = 35 - (days.length % 35);
    if (remaining < 35 && remaining > 0) {
      for (let d = 1; d <= remaining; d++) {
        const nextM = viewMonth === 11 ? 1 : viewMonth + 2;
        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({
          dayNumber: d,
          dateStr,
          isCurrentMonth: false,
          isPast: dateStr < todayStr,
          isOccupied: occupiedDatesSet.has(dateStr)
        });
      }
    }

    return days;
  }, [viewYear, viewMonth, todayStr, occupiedDatesSet]);

  // Handle cell click
  const handleDayClick = (dateStr: string, isPast: boolean, isOccupied: boolean) => {
    if (isPast) return;
    if (isOccupied && !isCheckoutCandidate(dateStr)) return;

    // Una noche ocupada no puede ser el inicio de una estancia
    const startNewStay = () => {
      if (!isOccupied) onSelectRange(dateStr, '');
    };

    if (isAlquiler) {
      startNewStay();
      return;
    }

    if (!checkInDate || (checkInDate && checkOutDate)) {
      // First click: sets Check-In
      startNewStay();
    } else if (dateStr > checkInDate) {
      // Second click: sets Check-Out si todas las noches de la estancia están libres
      if (isRangeFree(occupiedDatesSet, checkInDate, dateStr)) {
        onSelectRange(checkInDate, dateStr);
      } else {
        // Hay una noche ocupada en medio: se reinicia con el día elegido como nueva llegada
        startNewStay();
      }
    } else {
      // Clicked date is earlier than check-in -> set as new check-in
      startNewStay();
    }
  };

  // Price for a date helper
  const getPriceForDate = (dateStr: string) => {
    if (!roomPriceVariations || roomPriceVariations.length === 0) return room.precio;
    const exactMatch = roomPriceVariations.find(v => {
      if (v.roomId !== room.id) return false;
      if (v.isWeekend) return false;
      if (!v.fecha) return false;
      if (v.fecha === dateStr) return true;
      if (v.isAlways && v.fecha.substring(5) === dateStr.substring(5)) return true;
      return false;
    });

    if (exactMatch) {
      return exactMatch.precio;
    }

    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay(); // 5: Friday, 6: Saturday
    if (day === 5 || day === 6) {
      const wkMatch = roomPriceVariations.find(v => v.roomId === room.id && v.isWeekend);
      if (wkMatch) {
        return wkMatch.precio;
      }
    }

    return room.precio;
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
      {/* Compact Month Navigation Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/80 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-bold text-neutral-800">
            {MONTH_NAMES[viewMonth]} <span className="font-mono text-teal-700">{viewYear}</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className={`p-1.5 rounded-lg border transition-all ${
              canGoPrev
                ? 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 cursor-pointer shadow-xs'
                : 'border-neutral-100 bg-neutral-100 text-neutral-300 cursor-not-allowed opacity-50'
            }`}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 cursor-pointer shadow-xs transition-all"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 text-center border-b border-neutral-100 bg-neutral-50/40 py-1.5">
        {DAYS_SHORT.map((d, idx) => (
          <span
            key={d}
            className={`text-[11px] font-bold font-mono ${
              idx === 0 || idx === 6 ? 'text-amber-700' : 'text-neutral-500'
            }`}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 p-2 sm:p-3">
        {calendarDays.map((cell) => {
          const isCheckIn = checkInDate === cell.dateStr;
          const isCheckOut = checkOutDate === cell.dateStr;
          const isSelectedRange =
            checkInDate &&
            checkOutDate &&
            cell.dateStr > checkInDate &&
            cell.dateStr < checkOutDate;

          const isHoverRange =
            checkInDate &&
            !checkOutDate &&
            hoverDate &&
            cell.dateStr > checkInDate &&
            cell.dateStr <= hoverDate &&
            !cell.isOccupied;

          // Noche ocupada que sí se puede elegir como día de salida (o ya está elegida como tal)
          const selectableCheckout = cell.isOccupied && (isCheckoutCandidate(cell.dateStr) || cell.dateStr === checkOutDate);
          const isBlockedCell = cell.isPast || (cell.isOccupied && !selectableCheckout);

          let cellStyle = 'bg-white text-neutral-800 hover:bg-teal-50/60 hover:border-teal-300 border-neutral-200/70';

          if (!cell.isCurrentMonth) {
            cellStyle = 'bg-neutral-50/60 text-neutral-400 border-transparent opacity-60';
          }

          if (cell.isOccupied && !selectableCheckout) {
            cellStyle = 'bg-rose-50 text-rose-700 border-rose-200 opacity-80 cursor-not-allowed line-through';
          } else if (cell.isPast) {
            cellStyle = 'bg-neutral-100/60 text-neutral-350 border-transparent cursor-not-allowed opacity-40';
          } else if (isCheckIn || isCheckOut) {
            cellStyle = 'bg-teal-700 text-white font-bold border-teal-700 shadow-sm scale-[1.02] z-10';
          } else if (isSelectedRange || isHoverRange) {
            cellStyle = 'bg-teal-50/90 text-teal-900 border-teal-200 font-semibold';
          }

          const dayPrice = getPriceForDate(cell.dateStr);

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={isBlockedCell}
              onClick={() => handleDayClick(cell.dateStr, cell.isPast, cell.isOccupied)}
              onMouseEnter={() => !isBlockedCell && !cell.isOccupied && setHoverDate(cell.dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              className={`relative h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center border transition-all text-xs select-none ${
                isBlockedCell ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${cellStyle}`}
              aria-label={`Día ${cell.dayNumber} ${cell.isOccupied ? (selectableCheckout ? '(Ocupado, disponible como día de salida)' : '(Ocupado)') : ''}`}
            >
              <span className={`text-xs font-semibold leading-none ${isCheckIn || isCheckOut ? 'text-white' : ''}`}>
                {cell.dayNumber}
              </span>

              {/* Price badge or indicator */}
              {!cell.isPast && !cell.isOccupied && cell.isCurrentMonth && (
                <span
                  className={`text-[9px] font-mono leading-tight mt-0.5 ${
                    isCheckIn || isCheckOut
                      ? 'text-teal-100'
                      : dayPrice !== room.precio
                      ? 'text-teal-700 font-bold'
                      : 'text-neutral-400'
                  }`}
                >
                  ${dayPrice}
                </span>
              )}

              {/* Occupied badge */}
              {cell.isOccupied && cell.isCurrentMonth && !cell.isPast && (
                <span className="text-[8px] font-bold text-rose-600 leading-none scale-90">
                  Ocupado
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Calendar Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-50 border-t border-neutral-100 text-[10px] text-neutral-600 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-300" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
          <span>Seleccionado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span>Ocupado</span>
        </div>
        <div className="flex items-center gap-1 text-teal-700 font-bold">
          <Check className="w-3 h-3 text-teal-600" />
          <span>Tarifa en USD</span>
        </div>
      </div>
    </div>
  );
}
