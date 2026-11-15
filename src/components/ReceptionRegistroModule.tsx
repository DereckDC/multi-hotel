import React from 'react';
import { Hotel, Room, Reservation, User, RoomPriceVariation, ExternalBlock } from '../types';
import { Calendar, Check, Search, CheckCircle2, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { RoomReservationCalendar } from './RoomReservationCalendar';
import { StepIndicator, useFormStepper } from './FormStepper';
import { formatRentalMonths, isPropertyHotel, rentalDurationOptions } from '../utils/rental';

interface ReceptionRegistroModuleProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  users: User[];
  activeUser: User;
  targetHotelId: string;
  receptionistHotel: any;
  roomPriceVariations: RoomPriceVariation[];
  onUpdateRoomStatus: (roomId: string, status: any) => void;
  externalBlocks?: ExternalBlock[];

  // Form states
  resType: 'new' | 'existing';
  setResType: (val: 'new' | 'existing') => void;
  walkInNombre: string;
  setWalkInNombre: (val: string) => void;
  walkInApellido: string;
  setWalkInApellido: (val: string) => void;
  walkInEmail: string;
  setWalkInEmail: (val: string) => void;
  walkInTelefono: string;
  setWalkInTelefono: (val: string) => void;
  walkInDocumento: string;
  setWalkInDocumento: (val: string) => void;
  selectedGuestId: string;
  setSelectedGuestId: (val: string) => void;
  
  // Booking states
  bookRoomId: string;
  setBookRoomId: (val: string) => void;
  bookCheckIn: string;
  setBookCheckIn: (val: string) => void;
  bookCheckOut: string;
  setBookCheckOut: (val: string) => void;
  walkInSelectedServices: string[];
  setWalkInSelectedServices: React.Dispatch<React.SetStateAction<string[]>>;
  walkInServicePeopleCount: { [serviceId: string]: number };
  setWalkInServicePeopleCount: React.Dispatch<React.SetStateAction<{ [serviceId: string]: number }>>;
  bookStatus: 'confirmada' | 'ocupada';
  setBookStatus: (val: 'confirmada' | 'ocupada') => void;
  bookNotas: string;
  setBookNotas: (val: string) => void;
  
  // Calculated / Helper vars
  nights: number;
  calculatedTotal: number;
  isIvaAddedForSelectedRoom: boolean;
  selectedRoom: Room | undefined;
  resSuccessMsg: string | null;
  handleCreatePresencialRes: (e: React.FormEvent) => void;

  // Alquiler de inmueble completo (casa / departamento)
  isRental?: boolean;
  rentalMonths?: number;
  setRentalMonths?: (val: number) => void;
  rentalMinMonths?: number;
  rentalBilling?: { mensualidad: number; garantia: number; subtotal: number; tax: number; total: number } | null;
}

export default function ReceptionRegistroModule({
  externalBlocks = [],
  hotels,
  rooms,
  reservations,
  users,
  activeUser,
  targetHotelId,
  receptionistHotel,
  roomPriceVariations,
  onUpdateRoomStatus,
  resType,
  setResType,
  walkInNombre,
  setWalkInNombre,
  walkInApellido,
  setWalkInApellido,
  walkInEmail,
  setWalkInEmail,
  walkInTelefono,
  setWalkInTelefono,
  walkInDocumento,
  setWalkInDocumento,
  selectedGuestId,
  setSelectedGuestId,
  bookRoomId,
  setBookRoomId,
  bookCheckIn,
  setBookCheckIn,
  bookCheckOut,
  setBookCheckOut,
  walkInSelectedServices,
  setWalkInSelectedServices,
  walkInServicePeopleCount,
  setWalkInServicePeopleCount,
  bookStatus,
  setBookStatus,
  bookNotas,
  setBookNotas,
  nights,
  calculatedTotal,
  isIvaAddedForSelectedRoom,
  selectedRoom,
  resSuccessMsg,
  handleCreatePresencialRes,
  isRental = false,
  rentalMonths = 3,
  setRentalMonths = () => {},
  rentalMinMonths = 3,
  rentalBilling = null
}: ReceptionRegistroModuleProps) {
  // Date helpers for walk-in to prevent past dates and force minimum 1 night
  const getLocalTodayString = () => {
    const dObj = new Date();
    const year = dObj.getFullYear();
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const day = String(dObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getNextDayString = (dateStr: string) => {
    if (!dateStr) return '';
    const dObj = new Date(dateStr + 'T12:00:00');
    dObj.setDate(dObj.getDate() + 1);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const dVal = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${dVal}`;
  };

  // Huéspedes con al menos una reserva en este establecimiento: siempre visibles en la lista
  const hotelGuests = React.useMemo(() => {
    const ids = new Set(
      reservations
        .filter(r => r.hotelId === targetHotelId && r.guestId && r.guestId !== '__ocupado__')
        .map(r => r.guestId)
    );
    return users
      .filter(u => u.rol === 'cliente' && ids.has(u.id))
      .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es'));
  }, [reservations, users, targetHotelId]);

  // Búsqueda exacta por cédula entre todos los clientes registrados
  const [docQuery, setDocQuery] = React.useState('');
  const [docSearched, setDocSearched] = React.useState(false);
  const normalizeDoc = (v: string) => (v || '').replace(/[\s.-]/g, '').toUpperCase();
  const docMatch = React.useMemo(() => {
    const q = normalizeDoc(docQuery);
    if (!q) return undefined;
    return users.find(u => u.rol === 'cliente' && normalizeDoc(u.documento || '') === q);
  }, [docQuery, users]);
  const searchByDocument = () => {
    if (!docQuery.trim()) return;
    setDocSearched(true);
    if (docMatch) setSelectedGuestId(docMatch.id);
  };

  // Al cambiar de establecimiento se limpia una selección que ya no aplica
  React.useEffect(() => {
    setDocQuery('');
    setDocSearched(false);
    if (selectedGuestId && !hotelGuests.some(g => g.id === selectedGuestId)) setSelectedGuestId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetHotelId]);

  // Formulario en 3 pasos
  const stepper = useFormStepper(3);
  const walkInSteps = [{ label: 'Huésped' }, { label: isRental ? 'Alquiler' : 'Estadía' }, { label: 'Confirmación' }];
  React.useEffect(() => { stepper.reset(); }, [targetHotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (resSuccessMsg) stepper.reset(); }, [resSuccessMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSaleProperty = isPropertyHotel(receptionistHotel) && !isRental;

  const selectedGuest = users.find(u => u.id === selectedGuestId);
  const guestSummary = resType === 'new'
    ? `${walkInNombre} ${walkInApellido}`.trim()
    : (selectedGuest ? `${selectedGuest.nombre} ${selectedGuest.apellido}` : '');

  // Choque con otra reserva activa: en alquiler cuenta cualquier reserva de la propiedad
  const hasDateConflict = !!bookCheckIn && !!bookCheckOut && reservations.some(res =>
    (isRental ? res.hotelId === targetHotelId : (!!bookRoomId && res.roomId === bookRoomId)) &&
    res.estado !== 'cancelada' && res.estado !== 'finalizada' &&
    bookCheckIn < res.fechaSalida && bookCheckOut > res.fechaEntrada
  );

  const localTodayStr = getLocalTodayString();
  const minCheckOutDate = bookCheckIn ? getNextDayString(bookCheckIn) : getNextDayString(localTodayStr);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in duration-300" id="reception-registro-module">
      
      {/* LEFT: Availability & Reservations Calendar (Col span 2) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm">
          <div className="border-b border-neutral-100 pb-3 mb-4">
            <h4 className="font-bold text-neutral-800 text-base">Calendario de Disponibilidad y Reservas</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Haga click directamente en el tablero para seleccionar fechas o un número de habitación y auto-completar el formulario walk-in.
            </p>
          </div>

          <RoomReservationCalendar
            hotels={hotels.filter(h => h.id === targetHotelId)}
            rooms={rooms.filter(r => r.hotelId === targetHotelId)}
            reservations={reservations.filter(r => r.hotelId === targetHotelId)}
            users={users}
            activeUser={activeUser}
            onUpdateRoomStatus={onUpdateRoomStatus}
            roomPriceVariations={roomPriceVariations}
            externalBlocks={externalBlocks.filter(b => b.hotelId === targetHotelId)}
            checkInDate={bookCheckIn}
            checkOutDate={bookCheckOut}
            setCheckInDate={setBookCheckIn}
            setCheckOutDate={setBookCheckOut}
            isAlquiler={isRental}
            forceRoomId={bookRoomId || undefined}
          />
        </div>
      </div>

      {/* RIGHT: Walk-In Presencial Form (Col span 1) */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <h4 className="font-semibold text-neutral-900 text-base">Reserva Presencial Walk-In</h4>
            </div>
            <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
              Taquilla 🛎️
            </span>
          </div>

          {isSaleProperty ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <p className="font-bold mb-1">Esta propiedad está publicada en venta.</p>
              <p>Las propiedades en venta no admiten reservas ni alquileres. Para registrar un alquiler, cambia su finalidad a "En Alquiler" desde Propiedades.</p>
            </div>
          ) : (
          <>
          <div className="-mx-6 -mt-2">
            <StepIndicator steps={walkInSteps} current={stepper.step} onGo={stepper.goTo} />
          </div>

          <form ref={stepper.formRef} noValidate onSubmit={stepper.wrapSubmit(handleCreatePresencialRes)} className="space-y-4 font-sans">
            {resSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-semibold animate-fade-in">
                {resSuccessMsg}
              </div>
            )}

            {/* PASO 1: HUÉSPED */}
            <div data-step={1} className={stepper.step === 1 ? 'space-y-4' : 'hidden'}>
            {/* Guest Selection Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-1 rounded-xl border border-neutral-150">
              <button
                type="button"
                onClick={() => setResType('new')}
                className={`py-1.5 text-center text-xs font-semibold rounded-lg transition-all ${
                  resType === 'new' 
                    ? 'bg-[#344D67] text-[#6ECCAF] shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Huésped Nuevo
              </button>
              <button
                type="button"
                onClick={() => setResType('existing')}
                className={`py-1.5 text-center text-xs font-semibold rounded-lg transition-all ${
                  resType === 'existing' 
                    ? 'bg-[#344D67] text-[#6ECCAF] shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Buscar Registrado
              </button>
            </div>

            {/* Guest details section */}
            {resType === 'new' ? (
              <div className="space-y-3.5 p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Datos del Cliente</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 block mb-1">Nombre *</label>
                    <input
                      type="text"
                      required={resType === 'new'}
                      value={walkInNombre}
                      onChange={(e) => setWalkInNombre(e.target.value)}
                      placeholder="Juan"
                      className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 block mb-1">Apellido *</label>
                    <input
                      type="text"
                      required={resType === 'new'}
                      value={walkInApellido}
                      onChange={(e) => setWalkInApellido(e.target.value)}
                      placeholder="Castro"
                      className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required={resType === 'new'}
                    value={walkInEmail}
                    onChange={(e) => setWalkInEmail(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 block mb-1">Teléfono Móvil *</label>
                    <input
                      type="text"
                      required={resType === 'new'}
                      value={walkInTelefono}
                      onChange={(e) => setWalkInTelefono(e.target.value)}
                      placeholder="+593..."
                      className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 block mb-1">Cédula / Pasaporte *</label>
                    <input
                      type="text"
                      required={resType === 'new'}
                      value={walkInDocumento}
                      onChange={(e) => setWalkInDocumento(e.target.value)}
                      placeholder="09..."
                      className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                {/* Búsqueda por cédula entre todos los clientes registrados */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Buscar por cédula / pasaporte</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={docQuery}
                      onChange={(e) => { setDocQuery(e.target.value); setDocSearched(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchByDocument(); } }}
                      placeholder="Ej: 0912345678"
                      className="flex-1 min-w-0 text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={searchByDocument}
                      className="px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" /> Buscar
                    </button>
                  </div>
                  {docSearched && docMatch && (
                    <p className="mt-1.5 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Huésped encontrado: {docMatch.nombre} {docMatch.apellido}
                    </p>
                  )}
                  {docSearched && !docMatch && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-2">
                      <p>No hay ningún cliente registrado con esa cédula.</p>
                      <button
                        type="button"
                        onClick={() => { setWalkInDocumento(docQuery.trim()); setResType('new'); setDocSearched(false); }}
                        className="px-2.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                      >
                        Registrar nuevo huésped
                      </button>
                    </div>
                  )}
                </div>

                {/* Huéspedes que ya reservaron en este establecimiento (solo nombres) */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Huésped seleccionado *</label>
                  <select
                    required={resType === 'existing'}
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer text-neutral-800"
                  >
                    <option value="">-- Elige un huésped de este establecimiento --</option>
                    {docMatch && docSearched && !hotelGuests.some(g => g.id === docMatch.id) && (
                      <option value={docMatch.id}>{docMatch.nombre} {docMatch.apellido}</option>
                    )}
                    {hotelGuests.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                    ))}
                  </select>
                  {hotelGuests.length === 0 && (
                    <p className="mt-1.5 text-[10px] text-neutral-400">
                      Aún no hay huéspedes con reservas en este establecimiento. Búscalo por cédula o registra uno nuevo.
                    </p>
                  )}
                </div>
              </div>
            )}

            </div>

            {/* PASO 2: ESTADÍA O ALQUILER */}
            <div data-step={2} className={stepper.step === 2 ? 'space-y-4' : 'hidden'}>
            {isRental ? (
              <div className="space-y-3 p-3.5 bg-indigo-50/30 rounded-2xl border border-indigo-100/40">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Alquiler de la propiedad</p>

                <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-neutral-200">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-800 truncate">{receptionistHotel?.nombre}</p>
                    <p className="text-[10px] text-neutral-500">
                      {receptionistHotel?.tipoEstablecimiento === 'casa' ? 'Casa completa' : 'Departamento completo'} · ${selectedRoom?.precio || 0}/mes · mínimo {formatRentalMonths(rentalMinMonths)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Fecha de inicio del alquiler *</label>
                  <input
                    type="date"
                    required
                    min={localTodayStr}
                    value={bookCheckIn}
                    onChange={(e) => setBookCheckIn(e.target.value)}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">También puedes tocar el día en el calendario.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Tiempo de alquiler *</label>
                  <select
                    required
                    value={rentalMonths}
                    onChange={(e) => setRentalMonths(parseInt(e.target.value, 10))}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer font-semibold"
                  >
                    {rentalDurationOptions(rentalMinMonths).map(o => (
                      <option key={o.months} value={o.months}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] text-teal-800 bg-teal-50/70 p-2.5 rounded-xl border border-teal-100 flex justify-between items-center gap-2 font-semibold">
                  <span>Finaliza el:</span>
                  <strong className="font-mono text-neutral-900">{bookCheckIn ? bookCheckOut : 'Elige la fecha de inicio'}</strong>
                </div>

                {hasDateConflict && (
                  <p className="text-[10px] font-bold text-red-650 flex items-center gap-1 bg-red-50 p-1.5 rounded border border-red-100">
                    <span>❌ Conflicto de fechas:</span>
                    <span>la propiedad ya está alquilada o reservada dentro de ese período.</span>
                  </p>
                )}
              </div>
            ) : (
            <div className="space-y-3 p-3.5 bg-indigo-50/30 rounded-2xl border border-indigo-100/40">
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Habitación & Estadía</p>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 block mb-1">Seleccionar Habitación *</label>
                <select
                  required
                  value={bookRoomId}
                  onChange={(e) => setBookRoomId(e.target.value)}
                  className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="">-- Elija Habitación disponible --</option>
                  {rooms
                    .filter(r => r.hotelId === receptionistHotel?.id)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        Hab. {r.numero} - {r.nombre} ({r.estado.toUpperCase()} - ${r.precio}/Noche)
                      </option>
                    ))}
                </select>
                {hasDateConflict && (
                  <p className="text-[10px] font-bold text-red-650 mt-1 flex items-center gap-1 bg-red-50 p-1.5 rounded border border-red-100">
                    <span>❌ Conflicto de Fechas:</span>
                    <span>El aposento está ocupado o reservado en este rango.</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Fecha Entrada *</label>
                  <input
                    type="date"
                    required
                    min={localTodayStr}
                    value={bookCheckIn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBookCheckIn(val);
                      // Enforce minimum 1 night constraint: if checkout is empty or less than/equal to the new checkin
                      if (!bookCheckOut || bookCheckOut <= val) {
                        setBookCheckOut(getNextDayString(val));
                      }
                    }}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Fecha Salida *</label>
                  <input
                    type="date"
                    required
                    min={minCheckOutDate}
                    value={bookCheckOut}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (bookCheckIn && val <= bookCheckIn) {
                        setBookCheckOut(getNextDayString(bookCheckIn));
                      } else {
                        setBookCheckOut(val);
                      }
                    }}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>
            </div>
            )}
            </div>

            {/* PASO 3: SERVICIOS Y CONFIRMACIÓN */}
            <div data-step={3} className={stepper.step === 3 ? 'space-y-4' : 'hidden'}>
            {isRental ? (
              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-1.5 text-[11px] text-neutral-700">
                <p className="font-bold text-amber-900 uppercase text-[10px] tracking-wider border-b border-amber-200 pb-1 mb-1.5">Resumen del contrato de alquiler</p>
                <div className="flex justify-between gap-2"><span>Huésped:</span><span className="font-semibold text-neutral-800 text-right">{guestSummary || '—'}</span></div>
                <div className="flex justify-between gap-2"><span>Plazo:</span><span className="font-semibold text-neutral-800">{formatRentalMonths(rentalMonths)}</span></div>
                <div className="flex justify-between gap-2"><span>Período:</span><span className="font-mono font-semibold text-neutral-800">{bookCheckIn || '—'} → {bookCheckIn ? bookCheckOut : '—'}</span></div>
                <div className="flex justify-between gap-2"><span>Mensualidad:</span><span className="font-mono font-semibold text-neutral-800">${(rentalBilling?.mensualidad || 0).toFixed(2)} / mes</span></div>
                <div className="flex justify-between gap-2"><span>Depósito de garantía (reembolsable):</span><span className="font-mono font-semibold text-amber-700">${(rentalBilling?.garantia || 0).toFixed(2)}</span></div>
                <div className="flex justify-between gap-2"><span>IVA 16% {isIvaAddedForSelectedRoom ? '' : '(incluido)'}:</span><span className="font-mono font-semibold text-neutral-800">${(rentalBilling?.tax || 0).toFixed(2)}</span></div>
                <p className="text-[10px] text-neutral-500 pt-1">Al inicio se cobra la primera mensualidad más el depósito de garantía.</p>
              </div>
            ) : (
            <div className="space-y-3 p-3.5 bg-indigo-50/30 rounded-2xl border border-indigo-100/40">
              <div className="text-[11px] text-neutral-600 bg-white rounded-xl border border-neutral-200 p-2.5 space-y-0.5">
                <div className="flex justify-between gap-2"><span>Huésped:</span><span className="font-semibold text-neutral-800 text-right">{guestSummary || '—'}</span></div>
                <div className="flex justify-between gap-2"><span>Habitación:</span><span className="font-semibold text-neutral-800 text-right">{selectedRoom ? `Hab. ${selectedRoom.numero} - ${selectedRoom.nombre}` : '—'}</span></div>
                <div className="flex justify-between gap-2"><span>Fechas:</span><span className="font-mono font-semibold text-neutral-800">{bookCheckIn || '—'} → {bookCheckOut || '—'}</span></div>
              </div>

              {/* WALK-IN SERVICES SELECTOR */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold text-neutral-500 block">Servicios del Establecimiento (Opcional):</label>
                {(!receptionistHotel || !receptionistHotel.serviciosDetallados || receptionistHotel.serviciosDetallados.filter((s: any) => s.estado === 'activo').length === 0) ? (
                  <p className="text-[10px] text-neutral-400 italic">No hay servicios específicos creados.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {receptionistHotel.serviciosDetallados.filter((s: any) => s.estado === 'activo').map((srv: any) => {
                      const isChecked = walkInSelectedServices.includes(srv.id);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => {
                            setWalkInSelectedServices(prev => {
                              const exists = prev.includes(srv.id);
                              if (exists) {
                                return prev.filter(id => id !== srv.id);
                              } else {
                                setWalkInServicePeopleCount(prevCounts => ({
                                  ...prevCounts,
                                  [srv.id]: 1
                                }));
                                return [...prev, srv.id];
                              }
                            });
                          }}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-1.5 ${
                            isChecked
                              ? 'bg-teal-50/40 border-teal-300 shadow-sm'
                              : 'bg-white hover:bg-neutral-50 border-neutral-200'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-neutral-800 text-[10.5px] flex items-center gap-1">
                                {srv.emoji && <span className="text-sm shrink-0">{srv.emoji}</span>}
                                <span>{srv.nombre}</span>
                              </p>
                              <p className="text-[9.5px] text-neutral-400 leading-tight">{srv.descripcion}</p>
                            </div>
                            <div className="shrink-0 text-right flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-teal-800 text-[11px]">+${srv.precio} <span className="text-[8.5px] text-neutral-400 font-normal">/ pers {srv.tipoCobro === 'por_dia' ? '/ día' : '/ estadía'}</span></span>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-[#344D67] border-[#344D67] text-white' : 'border-neutral-300 bg-white'}`}>
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                              </div>
                            </div>
                          </div>

                          {/* Multiplier Quantity Picker */}
                          {isChecked && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 pt-1 border-t border-teal-200/50 flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[9px] text-teal-700 font-semibold">¿Cuántas personas?</span>
                                <div className="flex items-center gap-1 shrink-0 bg-white px-1.5 py-0.5 border border-teal-200 rounded">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = walkInServicePeopleCount[srv.id] || 1;
                                      if (cur > 1) {
                                        setWalkInServicePeopleCount({ ...walkInServicePeopleCount, [srv.id]: cur - 1 });
                                      }
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[10px] cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="text-[10px] font-mono font-bold text-neutral-900 w-5 text-center">
                                    {walkInServicePeopleCount[srv.id] || 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = walkInServicePeopleCount[srv.id] || 1;
                                      setWalkInServicePeopleCount({ ...walkInServicePeopleCount, [srv.id]: cur + 1 });
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="text-[9px] text-teal-800 font-mono text-right bg-teal-50/70 py-0.5 px-1.5 rounded border border-teal-200/50">
                                Subtotal: ${srv.precio} × {walkInServicePeopleCount[srv.id] || 1} pers {srv.tipoCobro === 'por_dia' ? `× ${Math.max(1, nights)} ${nights === 1 ? 'día' : 'días'}` : '(cobro único)'} = <span className="font-bold text-teal-900">${(srv.precio * (walkInServicePeopleCount[srv.id] || 1) * (srv.tipoCobro === 'por_dia' ? Math.max(1, nights) : 1)).toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 block mb-1">Estado Reserva</label>
                <select
                  value={bookStatus}
                  onChange={(e) => setBookStatus(e.target.value as 'confirmada' | 'ocupada')}
                  className="w-full text-xs border border-neutral-250 rounded-lg p-1.5 bg-white cursor-pointer text-neutral-800"
                >
                  <option value="confirmada">Confirmada</option>
                  <option value="ocupada">Ingreso Inmediato (Check-In)</option>
                </select>
              </div>
              
              <div className="bg-slate-900 rounded-xl p-2.5 text-right text-white space-y-0.5 shadow-inner">
                <span className="text-[9px] text-slate-400 font-medium block">{isRental ? 'Total a pagar al inicio:' : `Total Estimado (${nights} N):`}</span>
                <p className="text-[11px] text-[#6ECCAF] font-bold font-mono">
                  ${calculatedTotal} USD 
                  <span className="text-[8px] text-slate-400 font-sans block leading-none">
                    {isIvaAddedForSelectedRoom ? '(Impuestos inc 16%)' : '(IVA Incluido)'}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 block mb-1">Notas Internas:</label>
              <textarea
                placeholder="Instrucciones especiales..."
                value={bookNotas}
                onChange={(e) => setBookNotas(e.target.value)}
                className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none h-12"
              />
            </div>

            </div>

            {/* Navegación entre pasos */}
            <div className="flex gap-2.5 pt-1">
              {stepper.step > 1 && (
                <button
                  type="button"
                  onClick={stepper.back}
                  className="w-1/3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
              )}
              {stepper.step < 3 ? (
                <button
                  key="walkin-next"
                  type="button"
                  onClick={stepper.next}
                  className="flex-1 bg-[#344D67] hover:bg-[#1E2E3E] text-[#6ECCAF] font-bold py-2.5 rounded-xl text-xs transition-all tracking-wide cursor-pointer shadow-md flex items-center justify-center gap-1 active:scale-95"
                >
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                // Clave distinta para que React no convierta el botón "Siguiente" en "submit" durante el clic
                <button
                  key="walkin-submit"
                  type="submit"
                  className="flex-1 bg-[#344D67] hover:bg-[#1E2E3E] text-[#6ECCAF] font-bold py-2.5 rounded-xl text-xs transition-all tracking-wide cursor-pointer shadow-md text-center active:scale-95"
                >
                  {isRental ? 'Registrar Alquiler 🔑' : 'Registrar Reserva Presencial 🛎️📝'}
                </button>
              )}
            </div>
          </form>
          </>
          )}
        </div>
      </div>

    </div>
  );
}
