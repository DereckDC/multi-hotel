import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Clock, 
  Building2, 
  Sparkles, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Phone, 
  Mail, 
  FileText, 
  Check, 
  Users, 
  BedDouble, 
  TrendingUp, 
  Sparkle
} from 'lucide-react';
import { Hotel, Room, Reservation, User as StoreUser, RoomStatus } from '../types';

interface RoomReservationCalendarProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  users: StoreUser[]; // Need this to resolve client names
  activeUser: StoreUser;
  onUpdateRoomStatus?: (roomId: string, status: RoomStatus) => void;
  forceHotelId?: string;
  forceRoomId?: string;
}

export function RoomReservationCalendar({
  hotels,
  rooms,
  reservations,
  users,
  activeUser,
  onUpdateRoomStatus,
  forceHotelId,
  forceRoomId
}: RoomReservationCalendarProps) {
  // 1. STATE VARIABLES
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  });

  // Filter selections
  const [selectedHotelId, setSelectedHotelId] = useState<string>(() => {
    if (forceHotelId) return forceHotelId;
    // If user is a receptionist or assigned to a hotel, default to that
    if (activeUser.hotelId) return activeUser.hotelId;
    return hotels[0]?.id || '';
  });

  const hotelRooms = useMemo(() => {
    return rooms.filter(r => r.hotelId === selectedHotelId);
  }, [rooms, selectedHotelId]);

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

  // Months localized name list
  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // 2. LOGICAL CALCULATIONS FOR THE CALENDAR GRID
  const calendarDays = useMemo(() => {
    // First day of currentMonth
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // Convert JS Sunday-first day index to Monday-first
    // JS Sunday = 0, Monday = 1 ... Saturday = 6
    // target list: Mon=0, Tue=1, ... Sun=6
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    // Last day of currentMonth
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Last day of previous month
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const daysList: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Fill previous month trailing days
    for (let i = offset - 1; i >= 0; i--) {
      const prevDay = totalDaysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const mm = String(prevMonth + 1).padStart(2, '0');
      const dd = String(prevDay).padStart(2, '0');
      daysList.push({
        day: prevDay,
        isCurrentMonth: false,
        dateStr: `${prevYear}-${mm}-${dd}`
      });
    }

    // Fill current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      daysList.push({
        day: d,
        isCurrentMonth: true,
        dateStr: `${currentYear}-${mm}-${dd}`
      });
    }

    // Fill next month leading days to complete grid multiplier of 7 (usually 35 or 42 slots)
    const remainingSlots = (7 - (daysList.length % 7)) % 7;
    for (let n = 1; n <= remainingSlots + (daysList.length <= 35 ? 7 : 0); n++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const mm = String(nextMonth + 1).padStart(2, '0');
      const dd = String(n).padStart(2, '0');
      daysList.push({
        day: n,
        isCurrentMonth: false,
        dateStr: `${nextYear}-${mm}-${dd}`
      });
    }

    return daysList;
  }, [currentYear, currentMonth]);

  // Navigate Months
  const handlePrevMonth = () => {
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

  // Helper: Find reservations for a specific date and filters
  const getReservationsForDate = (dateStr: string) => {
    return reservations.filter(res => {
      // Exclude cancelled bookings for calendar availability checking
      if (res.estado === 'cancelada') return false;

      // Filter by hotel
      if (res.hotelId !== selectedHotelId) return false;

      // Filter by room if specific room is selected
      if (selectedRoomId !== 'all' && res.roomId !== selectedRoomId) return false;

      // Check date overlaps/touches (inclusive range)
      return dateStr >= res.fechaEntrada && dateStr <= res.fechaSalida;
    });
  };

  // Helper: Check-in arrivals and Check-out departures for a specific date
  // This is highly useful for receptionist scheduling logic
  const getArrivalsAndDepartures = (dateStr: string) => {
    const dayArrivals = reservations.filter(r => r.hotelId === selectedHotelId && r.fechaEntrada === dateStr && r.estado !== 'cancelada');
    const dayDepartures = reservations.filter(r => r.hotelId === selectedHotelId && r.fechaSalida === dateStr && r.estado !== 'cancelada');
    return { dayArrivals, dayDepartures };
  };

  // 3. STAT GENERATIONS FOR DETAILED ROLES
  const selectedDayReservations = useMemo(() => {
    return getReservationsForDate(selectedDateStr);
  }, [selectedDateStr, reservations, selectedHotelId, selectedRoomId]);

  const visibleReservations = useMemo(() => {
    if (activeUser.rol === 'cliente') {
      return selectedDayReservations.filter(res => res.guestId === activeUser.id);
    }
    return selectedDayReservations;
  }, [selectedDayReservations, activeUser]);

  const monthStats = useMemo(() => {
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let occupiedSlotsCount = 0;
    
    // Count days in month with at least one active reservation for the filtered setting
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${mm}-${dd}`;
      const dayRes = getReservationsForDate(dateStr);
      if (dayRes.length > 0) occupiedSlotsCount++;
    }

    const occupancyRate = Math.round((occupiedSlotsCount / totalDaysInMonth) * 100);
    return {
      ocupacionPorcentaje: occupancyRate,
      diasOcupados: occupiedSlotsCount,
      diasLibres: totalDaysInMonth - occupiedSlotsCount
    };
  }, [currentYear, currentMonth, reservations, selectedHotelId, selectedRoomId]);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm overflow-hidden font-sans">
      
      {/* 4. INTEGRATED CALENDAR HEADER WITH BRIEFING BAR */}
      <div className="bg-neutral-900 text-white p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 text-[9px] text-teal-400 font-bold uppercase tracking-wider border border-teal-500/20">
              <Sparkles className="w-3 h-3" />
              <span>Control e Inspección Roomia</span>
            </span>
            <h3 className="text-lg md:text-xl font-display font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-teal-400" />
              <span>Calendario de Disponibilidad y Reservas</span>
            </h3>
            <p className="text-xs text-neutral-400 font-medium font-sans">
              Visualice, audite y gestione reservas en tiempo real.
            </p>
          </div>

          {/* Month Navigator controllers */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-neutral-800 p-1 rounded-xl border border-neutral-700">
            <button
              onClick={handlePrevMonth}
              type="button"
              className="p-1.5 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white cursor-pointer transition-colors"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-3 uppercase tracking-wider min-w-[110px] text-center select-none text-neutral-200 font-mono">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              type="button"
              className="p-1.5 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white cursor-pointer transition-colors"
              title="Mes Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5. MULTI-ROLE COHESIVE FILTER BOX */}
        {!(forceHotelId || forceRoomId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-neutral-850 p-3.5 rounded-xl border border-neutral-800">
            
            {/* Hotel Filter selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Building2 className="w-3 h-3 text-teal-400" />
                <span>Establecimiento</span>
              </label>
              <select
                disabled={!!activeUser.hotelId} // Force user to their assigned hotel if receptionist/admin
                value={selectedHotelId}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                className="w-full text-xs bg-neutral-900 border border-neutral-750 text-white p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer text-ellipsis font-medium"
              >
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.nombre} ({h.ubicacion})</option>
                ))}
              </select>
            </div>

            {/* Room Filter Selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Filter className="w-3 h-3 text-teal-400" />
                <span>Filtrar por Habitación</span>
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full text-xs bg-neutral-900 border border-neutral-750 text-white p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer font-medium"
              >
                <option value="all">Todas las habitaciones juntas</option>
                {hotelRooms.map(r => (
                  <option key={r.id} value={r.id}>N° {r.numero} - {r.nombre} ({r.tipo})</option>
                ))}
              </select>
            </div>

          </div>
        )}
      </div>

      {/* 6. MAIN CALENDAR GRID & DETAIL CARD */}
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Calendar Elements Grid (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Grid Headers representing Day numbers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider py-1 font-mono">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Day Tiles Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, index) => {
              const dayRes = getReservationsForDate(cell.dateStr);
              const { dayArrivals, dayDepartures } = getArrivalsAndDepartures(cell.dateStr);
              const isSelected = selectedDateStr === cell.dateStr;
              const hasActiveReservations = dayRes.length > 0;
              
              // Dynamic coloration classes
              let bgClass = 'bg-white text-neutral-800 hover:bg-neutral-50 border-neutral-200';
              let borderClass = 'border';
              let textStatusColor = '';

              if (!cell.isCurrentMonth) {
                bgClass = 'bg-neutral-50 text-neutral-400 opacity-40 border-neutral-100 hover:bg-neutral-100';
              }

              // Overriding styling if we have reservations on this date
              if (hasActiveReservations) {
                // If specific room selected, color code cleanly
                if (selectedRoomId !== 'all') {
                  const status = dayRes[0].estado;
                  if (status === 'ocupada') {
                    bgClass = 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100/70 font-semibold';
                  } else if (status === 'confirmada' || status === 'pendiente') {
                    bgClass = 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70 font-semibold';
                  } else {
                    bgClass = 'bg-neutral-100 text-neutral-700 border-neutral-250 hover:bg-neutral-150';
                  }
                } else {
                  // General view - indicator badges logic
                  bgClass = 'bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100/60 font-semibold';
                }
              }

              // Highlight selected date border glowingly
              if (isSelected) {
                borderClass = 'border-[2px] border-teal-500 ring-2 ring-teal-500/10 scale-105 z-10';
              }

              // Simple indicator triggers for the receptionist/admin view
              const showArrivalDot = dayArrivals.length > 0;
              const showDepartureDot = dayDepartures.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  type="button"
                  className={`relative p-2.5 rounded-xl flex flex-col justify-between items-center aspect-square text-xs transition-all duration-200 shadow-sm cursor-pointer ${bgClass} ${borderClass}`}
                >
                  <span className="font-mono font-bold text-xs">{cell.day}</span>

                  {/* Little custom notification pills/indicators overlay inside the calendar box */}
                  <div className="flex gap-1 justify-center items-center w-full mt-1 shrink-0 h-2.5">
                    {/* Specific room is selected visual indicators */}
                    {selectedRoomId !== 'all' && hasActiveReservations && (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        dayRes[0].estado === 'ocupada' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                    )}

                    {/* General multi-colored tags inside the cell representing counts */}
                    {selectedRoomId === 'all' && dayRes.length > 0 && (
                      <span className="text-[8px] font-mono font-bold bg-indigo-600 text-white min-w-4 px-1 rounded-md text-center scale-95 uppercase leading-[1.25]">
                        {dayRes.length}
                      </span>
                    )}

                    {/* Check In / Out Dots for Staff alerts */}
                    {(activeUser.rol === 'recepcionista' || activeUser.rol === 'super_admin' || activeUser.rol === 'hotel_admin') && (
                      <>
                        {showArrivalDot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${dayArrivals.length} Llegadas de Clientes`} />
                        )}
                        {showDepartureDot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" title={`${dayDepartures.length} Salidas (Check-Outs)`} />
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 7. LEGEND & HIGHLIGHTED ADVISORIES */}
          <div className="flex flex-wrap items-center justify-around gap-3 pt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-150 text-[10px] font-bold text-neutral-500 tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white border border-neutral-200 inline-block" />
              <span>Disponible</span>
            </div>
            {selectedRoomId !== 'all' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />
                  <span>Reservado (Pendiente/Confirmado)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />
                  <span>Ocupado (En Estancia)</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-50/70 border border-indigo-200 inline-block" />
                <span>Habitaciones Reservadas</span>
              </div>
            )}
            
            {/* Show receptionist explicit key codes */}
            {(activeUser.rol === 'recepcionista' || activeUser.rol === 'super_admin' || activeUser.rol === 'hotel_admin') && (
              <div className="flex items-center gap-2 border-l border-neutral-300 pl-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Llegada</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  <span>Salida</span>
                </div>
              </div>
            )}
          </div>

          {/* Monthly percentage occupancy heatmap metrics for admin/receptionist */}
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-150 p-4 rounded-xl flex items-center justify-between dark:from-neutral-900/10">
            <div className="space-y-1">
              <h5 className="font-bold text-neutral-800 text-xs flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <span>Ocupación Estimada del Mes ({MONTHS[currentMonth]})</span>
              </h5>
              <p className="text-[10px] text-neutral-500 font-medium">Calculando promedio de días ocupados sobre capacidad de la vista actual</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-mono font-bold text-teal-700">{monthStats.ocupacionPorcentaje}%</span>
              <span className="text-[9px] text-neutral-400 block font-semibold">{monthStats.diasOcupados} Días Reservados</span>
            </div>
          </div>

        </div>

        {/* Right Side: Reservation Information Sheet & Inspection panel */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Day overview Card Header */}
          <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 space-y-3.5">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  Bitácora: {selectedDateStr}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono font-bold bg-neutral-200/60 px-2 py-0.5 rounded">
                Día {selectedDateStr.split('-')[2]}
              </span>
            </div>

            {/* General state panel for current room details */}
            {selectedRoomId !== 'all' && (
              (() => {
                const roomSelected = rooms.find(r => r.id === selectedRoomId);
                const isCurrentlyReserved = selectedDayReservations.length > 0;
                return (
                  <div className="bg-white p-3 rounded-xl border border-neutral-200 flex gap-3 items-center">
                    <div className="p-2 bg-neutral-100 rounded-lg shrink-0">
                      <BedDouble className="w-5 h-5 text-neutral-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-neutral-800 truncate">
                        N° {roomSelected?.numero} - {roomSelected?.nombre}
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-semibold truncate">
                        {roomSelected?.tipo} • Capacidad: {roomSelected?.capacidad} huéspedes
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isCurrentlyReserved 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {isCurrentlyReserved ? 'Ocupada' : 'Disponible'}
                    </span>
                  </div>
                );
              })()
            )}

            {/* List of bookings/reservations touchable on the selected day */}
            <h5 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
              {(() => {
                if (selectedDayReservations.length === 0) {
                  return 'Sin reservaciones registradas para hoy';
                }
                if (activeUser.rol === 'cliente') {
                  return visibleReservations.length > 0 ? 'Su Reservación' : 'Estado de Ocupación';
                }
                return `Reservas Concurrentes (${selectedDayReservations.length})`;
              })()}
            </h5>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {selectedDayReservations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-emerald-50/50 border border-emerald-150 rounded-xl text-center space-y-1.5"
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="text-xs font-bold text-emerald-900 font-sans">
                      Día 100% Libre
                    </p>
                    <p className="text-[10px] text-emerald-700 font-sans max-w-xs mx-auto leading-normal">
                      {activeUser.rol === 'cliente' 
                        ? '¡Sensacional! Esta espléndida fecha está totalmente disponible para tu hospedaje boutique.'
                        : 'No hay huéspedes registrados en este rango de fecha para los filtros activos.'
                      }
                    </p>
                  </motion.div>
                ) : activeUser.rol === 'cliente' && visibleReservations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-amber-50/50 border border-amber-150 rounded-xl text-center space-y-1.5"
                  >
                    <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                    <p className="text-xs font-bold text-amber-950 font-sans">
                      Fecha Reservada / Ocupada
                    </p>
                    <p className="text-[10px] text-amber-700 font-sans max-w-xs mx-auto leading-normal">
                      Esta fecha ya se encuentra reservada u ocupada por otro huésped. Por políticas de privacidad de la plataforma, los detalles del hospedaje de terceros están protegidos.
                    </p>
                  </motion.div>
                ) : (
                  visibleReservations.map((res) => {
                    const client = users.find(u => u.id === res.guestId);
                    const roomInfo = rooms.find(r => r.id === res.roomId);
                    const durationInDays = Math.ceil(
                      (new Date(res.fechaSalida).getTime() - new Date(res.fechaEntrada).getTime()) / (1000 * 3600 * 24)
                    );

                    return (
                      <motion.div
                        key={res.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-4 bg-white rounded-xl border border-neutral-210 shadow-sm relative space-y-3 hover:shadow-md transition-shadow"
                      >
                        {/* Header metadata tag of reservation block */}
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[9px] font-mono font-bold bg-neutral-900 text-white px-2 py-0.5 rounded tracking-wide uppercase">
                            Código: {res.id.slice(0, 8)}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            res.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            res.estado === 'ocupada' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                            res.estado === 'pendiente' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            'bg-neutral-50 text-neutral-600 border-neutral-200'
                          }`}>
                            {res.estado}
                          </span>
                        </div>

                        {/* Room indicator reference */}
                        {selectedRoomId === 'all' && roomInfo && (
                          <div className="text-[11px] font-bold text-neutral-700 bg-neutral-50 px-2 py-1 rounded border border-neutral-200 flex items-center justify-between">
                            <span>Habitación {roomInfo.numero} - {roomInfo.nombre}</span>
                            <span className="text-[10px] text-teal-600 font-medium">{roomInfo.tipo}</span>
                          </div>
                        )}

                        {/* Guest names and basic data */}
                        <div className="space-y-1.5 text-xs text-neutral-600 font-sans">
                          <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                            <User className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{client ? `${client.nombre} ${client.apellido}` : 'Huésped Boutique'}</span>
                            <span className="text-[9px] text-neutral-400 font-normal">({client?.rol === 'cliente' ? 'Cliente' : 'Usuario'})</span>
                          </div>

                          <div className="flex items-center gap-1.5 font-medium leading-none text-[11px] text-neutral-500 font-mono">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Estadía de {durationInDays} Noches</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                            <div>
                              <span className="text-neutral-400 block text-[8px] uppercase tracking-wider font-bold">Llegada / Check-In</span>
                              <span className="text-emerald-700 font-mono">{res.fechaEntrada}</span>
                            </div>
                            <div>
                              <span className="text-neutral-400 block text-[8px] uppercase tracking-wider font-bold">Salida / Check-Out</span>
                              <span className="text-red-650 font-mono">{res.fechaSalida}</span>
                            </div>
                          </div>
                        </div>

                        {/* Conditional content based on ROLE */}
                        {/* 1. RECEPTIONIST VIEW - showing client notes, email/phone to contact them */}
                        {(activeUser.rol === 'recepcionista' || activeUser.rol === 'super_admin' || activeUser.rol === 'hotel_admin') && (
                          <div className="pt-2 border-t border-neutral-150 space-y-2">
                            <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500">
                              {client?.telefono && (
                                <a href={`tel:${client.telefono}`} className="flex items-center gap-1 hover:text-teal-600 bg-neutral-100 hover:bg-teal-50 px-2 py-1 rounded transition-colors">
                                  <Phone className="w-3 h-3 text-neutral-400" />
                                  <span>{client.telefono}</span>
                                </a>
                              )}
                              {client?.email && (
                                <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-teal-600 bg-neutral-100 hover:bg-teal-50 px-2 py-1 rounded transition-colors whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">
                                  <Mail className="w-3 h-3 text-neutral-400" />
                                  <span>{client.email}</span>
                                </a>
                              )}
                            </div>
                            {res.notas && (
                              <div className="bg-amber-50/55 p-2 rounded border border-amber-100 text-[10px] text-amber-900 leading-normal font-sans italic flex gap-1 items-start">
                                <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>"{res.notas}"</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. CLIENT VIEW - showing clean greeting & reassurance */}
                        {activeUser.rol === 'cliente' && (
                          <div className="pt-1.5 border-t border-neutral-150 text-[10px] text-teal-700 font-semibold flex items-center gap-1">
                            <Sparkle className="w-3 h-3 text-teal-500 shrink-0" />
                            <span>Código Seguro • Tu habitación te espera con amenidades de cortesía.</span>
                          </div>
                        )}

                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Special alert notification on the bottom */}
            {activeUser.rol === 'recepcionista' && (
              (() => {
                const today = new Date();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const formattedToday = `${today.getFullYear()}-${mm}-${dd}`;
                const { dayArrivals, dayDepartures } = getArrivalsAndDepartures(formattedToday);

                if (dayArrivals.length > 0 || dayDepartures.length > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1.5 text-[11px] text-amber-900 leading-normal">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Notificación de Operaciones Hoy</span>
                      </div>
                      <p className="font-sans">
                        Tienes registró de <strong className="text-neutral-800">{dayArrivals.length} llegadas</strong> y <strong className="text-neutral-800">{dayDepartures.length} salidas</strong> previstas para el día de hoy ({formattedToday}). Asegúrese de tener listos los kits de llaves y amenidades.
                      </p>
                    </div>
                  );
                }
                return null;
              })()
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
