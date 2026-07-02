import React from 'react';
import { Hotel, Room, Reservation, User, RoomPriceVariation } from '../types';
import { Calendar, Check } from 'lucide-react';
import { RoomReservationCalendar } from './RoomReservationCalendar';

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
}

export default function ReceptionRegistroModule({
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
  handleCreatePresencialRes
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
            checkInDate={bookCheckIn}
            checkOutDate={bookCheckOut}
            setCheckInDate={setBookCheckIn}
            setCheckOutDate={setBookCheckOut}
            isAlquiler={receptionistHotel && (receptionistHotel.tipoEstablecimiento === 'casa' || receptionistHotel.tipoEstablecimiento === 'departamento') && receptionistHotel.finalidad === 'alquiler'}
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

          <form onSubmit={handleCreatePresencialRes} className="space-y-4 font-sans">
            {resSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-semibold animate-fade-in">
                {resSuccessMsg}
              </div>
            )}

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
              <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-bold text-neutral-500 block mb-1">Buscar Huésped Registrado *</label>
                <select
                  required={resType === 'existing'}
                  value={selectedGuestId}
                  onChange={(e) => setSelectedGuestId(e.target.value)}
                  className="w-full text-xs border border-neutral-250 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer text-neutral-800"
                >
                  <option value="">-- Elige un huésped registrado --</option>
                  {users.filter(u => u.rol === 'cliente').map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.apellido} ({u.documento} - {u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Booking Parameters */}
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
                {selectedRoom && reservations.filter(res => 
                  res.roomId === bookRoomId &&
                  res.estado !== 'cancelada' &&
                  res.estado !== 'finalizada'
                ).some(res => bookCheckIn < res.fechaSalida && bookCheckOut > res.fechaEntrada) && (
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
                              <span className="font-mono font-extrabold text-teal-800 text-[11px]">+${srv.precio}</span>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-[#344D67] border-[#344D67] text-white' : 'border-neutral-300 bg-white'}`}>
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                              </div>
                            </div>
                          </div>

                          {/* Multiplier Quantity Picker */}
                          {isChecked && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 pt-1 border-t border-teal-200/50 flex items-center justify-between gap-4"
                            >
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

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
                <span className="text-[9px] text-slate-400 font-medium block">Total Estimado ({nights} N):</span>
                <p className="text-[11px] text-[#6ECCAF] font-bold font-mono">
                  ${calculatedTotal} USD 
                  <span className="text-[8px] text-slate-400 font-sans block leading-none">
                    {isIvaAddedForSelectedRoom ? '(Impuestos inc 12%)' : '(IVA Incluido)'}
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

            <button
              type="submit"
              className="w-full bg-[#344D67] hover:bg-[#1E2E3E] text-[#6ECCAF] font-bold py-2.5 rounded-xl text-xs transition-all tracking-wide cursor-pointer shadow-md text-center active:scale-95"
            >
              Registrar Reserva Presencial 🛎️📝
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
