import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  FileText,
  BedDouble,
  TrendingUp,
  Sparkle
} from 'lucide-react';
import { Hotel, Room, Reservation, User as StoreUser, RoomStatus, RoomPriceVariation, ExternalBlock } from '../types';
import { occupiedNights, isRangeFree } from '../utils/availability';

const PLATFORM_NAMES: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com', otro: 'Otro calendario' };

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DAYS_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

interface RoomReservationCalendarProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  users: StoreUser[]; // Need this to resolve client names
  activeUser: StoreUser;
  onUpdateRoomStatus?: (roomId: string, status: RoomStatus) => void;
  forceHotelId?: string;
  forceRoomId?: string;
  roomPriceVariations?: RoomPriceVariation[];

  // Optional date selection props
  checkInDate?: string;
  checkOutDate?: string;
  setCheckInDate?: (date: string) => void;
  setCheckOutDate?: (date: string) => void;
  isAlquiler?: boolean;

  // Fechas bloqueadas por Airbnb/Booking (solo las recibe el personal)
  externalBlocks?: ExternalBlock[];
}

const toYmd = (y: number, m0: number, d: number) =>
  `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function RoomReservationCalendar({
  hotels,
  rooms,
  reservations,
  users,
  activeUser,
  forceHotelId,
  forceRoomId,
  roomPriceVariations = [],
  checkInDate,
  checkOutDate,
  setCheckInDate,
  setCheckOutDate,
  isAlquiler = false,
  externalBlocks = []
}: RoomReservationCalendarProps) {
  const todayStr = useMemo(() => {
    const t = new Date();
    return toYmd(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  // 1. STATE VARIABLES
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Filter selections
  const [selectedHotelId, setSelectedHotelId] = useState<string>(() => {
    if (forceHotelId) return forceHotelId;
    if (activeUser.hotelId) return activeUser.hotelId;
    return hotels[0]?.id || '';
  });

  const hotelRooms = useMemo(() => rooms.filter(r => r.hotelId === selectedHotelId), [rooms, selectedHotelId]);

  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => {
    if (forceRoomId) return forceRoomId;
    return hotelRooms[0]?.id || 'all';
  });

  // Keep selection synced when hotel changes
  React.useEffect(() => {
    if (forceRoomId) {
      setSelectedRoomId(forceRoomId);
      return;
    }
    const currentRooms = rooms.filter(r => r.hotelId === selectedHotelId);
    if (selectedRoomId !== 'all' && !currentRooms.some(r => r.id === selectedRoomId)) {
      setSelectedRoomId('all');
    }
  }, [selectedHotelId, rooms, selectedRoomId, forceRoomId]);

  // Keep selectedHotelId synced with activeUser and activeUser.hotelId when activeUser changes
  React.useEffect(() => {
    if (forceHotelId) {
      setSelectedHotelId(forceHotelId);
    } else if (activeUser?.hotelId) {
      setSelectedHotelId(activeUser.hotelId);
    } else {
      if (!selectedHotelId || !hotels.some(h => h.id === selectedHotelId)) {
        setSelectedHotelId(hotels[0]?.id || '');
      }
    }
  }, [activeUser, hotels, selectedHotelId, forceHotelId]);

  const selectedRoomObj = selectedRoomId !== 'all' ? rooms.find(r => r.id === selectedRoomId) : undefined;
  const isStaff = activeUser.rol !== 'cliente';

  // 2. DISPONIBILIDAD (misma regla de noches que el calendario del huésped: el día de salida queda libre)
  const isActive = (res: Reservation) => res.estado !== 'cancelada' && res.estado !== 'finalizada';

  const matchesFilter = (hotelId: string, roomId: string | null | undefined) =>
    hotelId === selectedHotelId && (selectedRoomId === 'all' || roomId === selectedRoomId);

  // Noches ocupadas de la unidad elegida, para validar la selección de fechas
  const selectionNights = useMemo(() => {
    if (selectedRoomId === 'all') return null;
    const stays = [
      ...reservations.filter(r => isActive(r) && r.roomId === selectedRoomId),
      ...externalBlocks
        .filter(b => b.roomId === selectedRoomId)
        .map(b => ({ fechaEntrada: b.fechaInicio, fechaSalida: b.fechaFin }))
    ];
    return occupiedNights(stays as Array<{ fechaEntrada: string; fechaSalida: string }>);
  }, [reservations, externalBlocks, selectedRoomId]);

  const nightsFor = (dateStr: string) => ({
    stays: reservations.filter(r => isActive(r) && matchesFilter(r.hotelId, r.roomId) && dateStr >= r.fechaEntrada && dateStr < r.fechaSalida),
    blocks: externalBlocks.filter(b => matchesFilter(b.hotelId, b.roomId) && dateStr >= b.fechaInicio && dateStr < b.fechaFin)
  });

  // Reservas que tocan el día (llegadas, estadías y salidas) para el detalle
  const touchingDate = (dateStr: string) =>
    reservations.filter(r =>
      r.estado !== 'cancelada' && matchesFilter(r.hotelId, r.roomId) &&
      dateStr >= r.fechaEntrada && dateStr <= r.fechaSalida
    );

  const arrivalsAndDepartures = (dateStr: string) => ({
    arrivals: reservations.filter(r => r.hotelId === selectedHotelId && r.fechaEntrada === dateStr && r.estado !== 'cancelada'),
    departures: reservations.filter(r => r.hotelId === selectedHotelId && r.fechaSalida === dateStr && r.estado !== 'cancelada')
  });

  // 3. CALENDAR GRID (domingo primero, igual que el del huésped)
  const calendarDays = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1).getDay();
    const inMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const total = Math.ceil((first + inMonth) / 7) * 7;
    const cells: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(currentYear, currentMonth, 1 - first + i);
      cells.push({
        day: d.getDate(),
        dateStr: toYmd(d.getFullYear(), d.getMonth(), d.getDate()),
        isCurrentMonth: d.getMonth() === currentMonth
      });
    }
    return cells;
  }, [currentYear, currentMonth]);

  const canGoPrev = currentYear > new Date().getFullYear() || (currentYear === new Date().getFullYear() && currentMonth > new Date().getMonth());

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const goToToday = () => {
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth());
    setSelectedDateStr(todayStr);
  };

  // 4. SELECCIÓN DE FECHAS (recepción / walk-in)
  const isNightTaken = (dateStr: string) => !!selectionNights && selectionNights.has(dateStr);

  const isCheckoutCandidate = (dateStr: string) =>
    !isAlquiler && !!checkInDate && !checkOutDate && dateStr > checkInDate &&
    !!selectionNights && isRangeFree(selectionNights, checkInDate, dateStr);

  const handleDateClick = (dateStr: string) => {
    if (dateStr < todayStr) return;
    setSelectedDateStr(dateStr);
    if (!setCheckInDate) return;

    const taken = isNightTaken(dateStr);
    // Una noche ocupada solo puede elegirse como día de salida de una estancia que termina ese día
    if (taken && !isCheckoutCandidate(dateStr)) return;
    const startNewStay = () => {
      if (taken) return;
      setCheckInDate(dateStr);
      if (setCheckOutDate) setCheckOutDate('');
    };

    if (isAlquiler) {
      setCheckInDate(dateStr);
      return;
    }

    if (!checkInDate || (checkInDate && checkOutDate)) {
      startNewStay();
    } else if (dateStr > checkInDate) {
      if (!selectionNights || isRangeFree(selectionNights, checkInDate, dateStr)) {
        if (setCheckOutDate) setCheckOutDate(dateStr);
      } else {
        startNewStay();
      }
    } else {
      startNewStay();
    }
  };

  // 5. ESTADÍSTICAS DEL MES (solo administradores)
  const monthStats = useMemo(() => {
    const total = new Date(currentYear, currentMonth + 1, 0).getDate();
    let busy = 0;
    for (let d = 1; d <= total; d++) {
      const dateStr = toYmd(currentYear, currentMonth, d);
      const { stays, blocks } = nightsFor(dateStr);
      if (stays.length > 0 || blocks.length > 0) busy++;
    }
    return { pct: Math.round((busy / total) * 100), busy, free: total - busy };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth, reservations, externalBlocks, selectedHotelId, selectedRoomId]);

  const getPriceForDate = (room: Room, dateStr: string) => {
    const exact = roomPriceVariations.find(v => {
      if (v.roomId !== room.id || v.isWeekend || !v.fecha) return false;
      if (v.fecha === dateStr) return true;
      return !!v.isAlways && v.fecha.substring(5) === dateStr.substring(5);
    });
    if (exact) return { precio: exact.precio, variable: true };
    const day = new Date(dateStr + 'T12:00:00').getDay();
    if (day === 5 || day === 6) {
      const weekend = roomPriceVariations.find(v => v.roomId === room.id && v.isWeekend);
      if (weekend) return { precio: weekend.precio, variable: true };
    }
    return { precio: room.precio, variable: false };
  };

  // 6. DETALLE DEL DÍA
  const dayTouching = touchingDate(selectedDateStr);
  const dayBlocks = nightsFor(selectedDateStr).blocks;
  const visibleReservations = isStaff ? dayTouching : dayTouching.filter(res => res.guestId === activeUser.id);
  const isRoomBusyThatNight = nightsFor(selectedDateStr).stays.length > 0 || dayBlocks.length > 0;

  return (
    <div className="w-full flex flex-col lg:flex-row gap-4 items-start font-sans">
      {/* ===================== CALENDARIO ===================== */}
      <div className="w-full lg:w-[390px] shrink-0 bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
        {/* Filtros compactos */}
        {!(forceHotelId || forceRoomId) && (
          <div className="grid grid-cols-2 gap-2 px-3 py-2.5 bg-neutral-50/80 border-b border-neutral-200">
            <label className="space-y-0.5 min-w-0">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Establecimiento</span>
              <select
                disabled={!!activeUser.hotelId}
                value={selectedHotelId}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                className="w-full text-[11px] bg-white border border-neutral-200 text-neutral-800 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer font-medium text-ellipsis disabled:opacity-80"
              >
                {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </select>
            </label>
            <label className="space-y-0.5 min-w-0">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Habitación</span>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full text-[11px] bg-white border border-neutral-200 text-neutral-800 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer font-medium text-ellipsis"
              >
                <option value="all">Todas juntas</option>
                {hotelRooms.map(r => <option key={r.id} value={r.id}>N° {r.numero} · {r.nombre}</option>)}
              </select>
            </label>
          </div>
        )}

        {/* Encabezado del mes */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/80 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-bold text-neutral-800">
              {MONTH_NAMES[currentMonth]} <span className="font-mono text-teal-700">{currentYear}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToToday}
              className="px-2 py-1 mr-1 rounded-lg text-[10px] font-bold text-teal-700 hover:bg-teal-50 cursor-pointer"
            >
              Hoy
            </button>
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
              title={canGoPrev ? 'Mes anterior' : 'Meses pasados bloqueados'}
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

        {/* Días de la semana */}
        <div className="grid grid-cols-7 text-center border-b border-neutral-100 bg-neutral-50/40 py-1.5">
          {DAYS_SHORT.map((d, idx) => (
            <span key={d} className={`text-[11px] font-bold font-mono ${idx === 0 || idx === 6 ? 'text-amber-700' : 'text-neutral-500'}`}>
              {d}
            </span>
          ))}
        </div>

        {/* Cuadrícula */}
        <div className="grid grid-cols-7 gap-1 p-2 sm:p-2.5">
          {calendarDays.map(cell => {
            const isPast = cell.dateStr < todayStr;
            const { stays, blocks } = nightsFor(cell.dateStr);
            const inHouse = stays.some(r => r.estado === 'ocupada');
            const reserved = stays.length > 0;
            const blocked = blocks.length > 0;
            const conflict = blocks.some(b => b.conflict);
            const { arrivals, departures } = arrivalsAndDepartures(cell.dateStr);

            const isCheckIn = checkInDate === cell.dateStr;
            const isCheckOut = checkOutDate === cell.dateStr;
            const inRange = !!checkInDate && !!checkOutDate && cell.dateStr > checkInDate && cell.dateStr < checkOutDate;
            const inHoverRange = !!checkInDate && !checkOutDate && !!hoverDate && cell.dateStr > checkInDate && cell.dateStr <= hoverDate;
            const isSelectedDay = selectedDateStr === cell.dateStr;

            const taken = isNightTaken(cell.dateStr);
            const selectableCheckout = taken && (isCheckoutCandidate(cell.dateStr) || isCheckOut);
            const lockedForSelection = !!setCheckInDate && taken && !selectableCheckout;

            // Mismos colores que el calendario del huésped; ámbar = reservada, rosa = ocupada, violeta = otra plataforma
            let style = 'bg-white text-neutral-800 hover:bg-teal-50/60 hover:border-teal-300 border-neutral-200/70';
            if (!cell.isCurrentMonth) {
              style = 'bg-neutral-50/60 text-neutral-400 border-transparent opacity-60';
            } else if (conflict) {
              style = 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100/70 font-semibold';
            } else if (inHouse) {
              style = 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70 font-semibold';
            } else if (reserved) {
              style = 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70 font-semibold';
            } else if (blocked) {
              style = 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100/70 font-semibold';
            }
            if (isPast) {
              style = 'bg-neutral-100/60 text-neutral-400 border-transparent cursor-not-allowed opacity-40';
            } else if (isCheckIn || isCheckOut) {
              style = 'bg-teal-700 text-white font-bold border-teal-700 shadow-sm scale-[1.02] z-10';
            } else if (inRange || inHoverRange) {
              style = 'bg-teal-50/90 text-teal-900 border-teal-200 font-semibold';
            }

            const price = selectedRoomObj && !isPast && cell.isCurrentMonth && !reserved && !blocked
              ? getPriceForDate(selectedRoomObj, cell.dateStr)
              : null;

            const label = `Día ${cell.day}${conflict ? ' (Conflicto con una reserva de Roomia)' : blocked ? ' (Bloqueado por otra plataforma)' : inHouse ? ' (Ocupado)' : reserved ? ' (Reservado)' : ''}`;

            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled={isPast || lockedForSelection}
                onClick={() => handleDateClick(cell.dateStr)}
                onMouseEnter={() => !isPast && setHoverDate(cell.dateStr)}
                onMouseLeave={() => setHoverDate(null)}
                aria-label={label}
                title={isPast ? 'Fecha pasada' : cell.dateStr}
                className={`relative h-10 sm:h-11 rounded-xl flex flex-col items-center justify-center border transition-all text-xs select-none ${
                  isPast || lockedForSelection ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${style} ${isSelectedDay && !isPast && !isCheckIn && !isCheckOut ? 'ring-2 ring-teal-500/70' : ''}`}
              >
                <span className={`text-xs font-semibold leading-none ${isCheckIn || isCheckOut ? 'text-white' : ''}`}>{cell.day}</span>

                {price && (
                  <span className={`text-[9px] font-mono leading-tight mt-0.5 ${price.variable ? 'text-teal-700 font-bold' : 'text-neutral-400'}`}>
                    ${price.precio}
                  </span>
                )}
                {!price && selectedRoomId === 'all' && stays.length > 1 && !isPast && (
                  <span className="text-[9px] font-mono font-bold leading-tight mt-0.5 text-amber-700">×{stays.length}</span>
                )}

                {/* Llegadas, salidas y bloqueos externos (solo personal) */}
                {isStaff && !isPast && (arrivals.length > 0 || departures.length > 0 || blocked) && (
                  <span className="absolute bottom-0.5 flex gap-0.5">
                    {arrivals.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${arrivals.length} llegada(s)`} />}
                    {departures.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-red-400" title={`${departures.length} salida(s)`} />}
                    {blocked && (
                      <i
                        className={`w-1.5 h-1.5 rounded-full ${conflict ? 'bg-red-600' : 'bg-violet-500'}`}
                        title={`Bloqueado por ${[...new Set(blocks.map(b => PLATFORM_NAMES[b.platform] || b.platform))].join(', ')}${conflict ? ' (conflicto con una reserva de Roomia)' : ''}`}
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2 bg-neutral-50 border-t border-neutral-100 text-[10px] text-neutral-600 font-medium">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-300" /><span>Disponible</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300" /><span>Reservada</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /><span>Ocupada</span></div>
          {externalBlocks.length > 0 && (
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" /><span>Airbnb / Booking</span></div>
          )}
          {setCheckInDate && (
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-700" /><span>Seleccionado</span></div>
          )}
          {selectedRoomObj && (
            <div className="flex items-center gap-1 text-teal-700 font-bold"><TrendingUp className="w-3 h-3" /><span>Tarifa en USD</span></div>
          )}
          {isStaff && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Llegada</span>
              <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Salida</span>
            </div>
          )}
        </div>

        {(activeUser.rol === 'super_admin' || activeUser.rol === 'hotel_admin') && (
          <div className="px-3 py-2.5 border-t border-neutral-100 bg-white flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-teal-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[10.5px] font-semibold text-neutral-600">
                <span>Ocupación del mes ({MONTH_NAMES[currentMonth]})</span>
                <span className="font-mono text-teal-700">{monthStats.pct}%</span>
              </div>
              <div className="w-full bg-neutral-100 h-1 rounded-full overflow-hidden mt-1">
                <div className="bg-teal-600 h-full rounded-full" style={{ width: `${monthStats.pct}%` }} />
              </div>
              <span className="text-[9.5px] text-neutral-400">{monthStats.busy} días con ocupación · {monthStats.free} libres</span>
            </div>
          </div>
        )}
      </div>

      {/* ===================== DETALLE DEL DÍA ===================== */}
      <div className="flex-1 min-w-0 w-full space-y-3">
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-4 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Bitácora: {selectedDateStr}</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono font-bold bg-neutral-100 px-2 py-0.5 rounded">
              {selectedDateStr === todayStr ? 'Hoy' : `Día ${selectedDateStr.split('-')[2]}`}
            </span>
          </div>

          {selectedRoomObj && (
            <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 flex gap-2.5 items-center">
              <div className="p-1.5 bg-white rounded-lg shrink-0 border border-neutral-100"><BedDouble className="w-4 h-4 text-neutral-600" /></div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-neutral-800 truncate">N° {selectedRoomObj.numero} · {selectedRoomObj.nombre}</h4>
                <p className="text-[10px] text-neutral-400 font-semibold truncate">{selectedRoomObj.tipo} · {selectedRoomObj.capacidad} huéspedes</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                isRoomBusyThatNight ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {isRoomBusyThatNight ? 'Ocupada' : 'Disponible'}
              </span>
            </div>
          )}

          {/* Bloqueos de Airbnb / Booking */}
          {isStaff && dayBlocks.map(b => {
            const blockRoom = rooms.find(r => r.id === b.roomId);
            return (
              <div key={b.id} className={`p-3 rounded-xl border text-xs space-y-1.5 ${b.conflict ? 'bg-red-50 border-red-200' : 'bg-violet-50/70 border-violet-200'}`}>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-600 text-white">{PLATFORM_NAMES[b.platform] || b.platform}</span>
                  {b.conflict && <span className="text-[9px] font-bold uppercase text-red-700">⚠ Conflicto con una reserva de Roomia</span>}
                </div>
                {blockRoom && selectedRoomId === 'all' && (
                  <p className="text-[11px] font-bold text-neutral-700">Habitación {blockRoom.numero} · {blockRoom.nombre}</p>
                )}
                <p className="font-mono text-[11px] text-neutral-600">
                  {b.fechaInicio} → {b.fechaFin} <span className="text-neutral-400 font-sans">(calendario externo)</span>
                </p>
              </div>
            );
          })}

          <h5 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">
            {dayTouching.length === 0
              ? 'Sin reservaciones para este día'
              : !isStaff
                ? (visibleReservations.length > 0 ? 'Su reservación' : 'Estado de ocupación')
                : `Reservas del día (${dayTouching.length})`}
          </h5>

          {dayTouching.length === 0 && dayBlocks.length === 0 ? (
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center space-y-1">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-emerald-900">Día 100% libre</p>
              <p className="text-[10px] text-emerald-700 max-w-xs mx-auto leading-normal">
                {isStaff ? 'No hay huéspedes registrados para este día con los filtros activos.' : 'Esta fecha está totalmente disponible para tu hospedaje.'}
              </p>
            </div>
          ) : !isStaff && visibleReservations.length === 0 && dayTouching.length > 0 ? (
            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-center space-y-1">
              <AlertCircle className="w-7 h-7 text-amber-600 mx-auto" />
              <p className="text-xs font-bold text-amber-950">Fecha reservada u ocupada</p>
              <p className="text-[10px] text-amber-700 max-w-xs mx-auto leading-normal">
                Por privacidad, los detalles del hospedaje de terceros están protegidos.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleReservations.map(res => {
                const client = users.find(u => u.id === res.guestId);
                const roomInfo = rooms.find(r => r.id === res.roomId);
                const nights = Math.max(1, Math.round((new Date(res.fechaSalida).getTime() - new Date(res.fechaEntrada).getTime()) / 86400000));
                return (
                  <div key={res.id} className="p-3 bg-white rounded-xl border border-neutral-200 shadow-xs space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] font-mono font-bold bg-neutral-900 text-white px-2 py-0.5 rounded uppercase">Código: {res.id.slice(0, 8)}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        res.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : res.estado === 'ocupada' ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : res.estado === 'pendiente' ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                      }`}>{res.estado}</span>
                    </div>

                    {selectedRoomId === 'all' && roomInfo && (
                      <div className="text-[11px] font-bold text-neutral-700 bg-neutral-50 px-2 py-1 rounded border border-neutral-200 flex items-center justify-between gap-2">
                        <span className="truncate">Habitación {roomInfo.numero} · {roomInfo.nombre}</span>
                        <span className="text-[10px] text-teal-600 font-medium shrink-0">{roomInfo.tipo}</span>
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs text-neutral-600">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                        <User className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="truncate">{client ? `${client.nombre} ${client.apellido}` : 'Huésped'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Estadía de {nights} {nights === 1 ? 'noche' : 'noches'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                        <div>
                          <span className="text-neutral-400 block text-[8px] uppercase tracking-wider font-bold">Llegada</span>
                          <span className="text-emerald-700 font-mono">{res.fechaEntrada}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[8px] uppercase tracking-wider font-bold">Salida</span>
                          <span className="text-red-600 font-mono">{res.fechaSalida}</span>
                        </div>
                      </div>
                    </div>

                    {isStaff && (
                      <div className="pt-2 border-t border-neutral-100 space-y-2">
                        <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
                          {client?.telefono && (
                            <a href={`tel:${client.telefono}`} className="flex items-center gap-1 hover:text-teal-600 bg-neutral-100 hover:bg-teal-50 px-2 py-1 rounded transition-colors">
                              <Phone className="w-3 h-3 text-neutral-400" /><span>{client.telefono}</span>
                            </a>
                          )}
                          {client?.email && (
                            <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-teal-600 bg-neutral-100 hover:bg-teal-50 px-2 py-1 rounded transition-colors overflow-hidden max-w-full">
                              <Mail className="w-3 h-3 text-neutral-400 shrink-0" /><span className="truncate">{client.email}</span>
                            </a>
                          )}
                        </div>
                        {res.notas && (
                          <div className="bg-amber-50/60 p-2 rounded border border-amber-100 text-[10px] text-amber-900 leading-normal italic flex gap-1 items-start">
                            <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>"{res.notas}"</span>
                          </div>
                        )}
                      </div>
                    )}

                    {!isStaff && (
                      <div className="pt-1.5 border-t border-neutral-100 text-[10px] text-teal-700 font-semibold flex items-center gap-1">
                        <Sparkle className="w-3 h-3 text-teal-500 shrink-0" />
                        <span>Código seguro · Tu habitación te espera con amenidades de cortesía.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aviso de operaciones del día (recepción) */}
        {activeUser.rol === 'recepcionista' && (() => {
          const { arrivals, departures } = arrivalsAndDepartures(todayStr);
          if (arrivals.length === 0 && departures.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1 text-[11px] text-amber-900 leading-normal">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Operaciones de hoy</span>
              </div>
              <p>
                <strong className="text-neutral-800">{arrivals.length} llegadas</strong> y <strong className="text-neutral-800">{departures.length} salidas</strong> previstas para hoy ({todayStr}).
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
