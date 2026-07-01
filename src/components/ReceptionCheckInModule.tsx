import React, { useState } from 'react';
import { Reservation, Room, User } from '../types';
import { QrCode, Search, Camera, UserCheck, ShieldCheck, AlertTriangle, Check } from 'lucide-react';

interface ReceptionCheckInModuleProps {
  rooms: Room[];
  reservations: Reservation[];
  users: User[];
  targetHotelId: string;
  receptionistHotel: any;
  hotelRooms: Room[];
  
  // Scanning state
  isScanning: boolean;
  scanProgress: number;
  scannedResult: Reservation | null;
  scanError: string | null;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  useRealCamera: boolean;
  cameras: any[];
  activeCamId: string;
  
  // Handlers
  handleManualSearch: () => void;
  handleSimulateScan: (resId?: string) => void;
  startRealCamera: () => void;
  stopRealCamera: () => void;
  switchCamera: (camId: string) => void;
  handleCheckIn: (resId: string) => void;
  handleCheckOut: (resId: string) => void;
  onUpdateReservationStatus?: any;
  onAddLog: (action: string, details: string) => void;
  activeUser: User;
  onUpdateRoomStatus: (roomId: string, status: any) => void;
  setCheckoutWarningRoom: (room: Room) => void;
  setScannedResult: (res: Reservation | null) => void;
}

export default function ReceptionCheckInModule({
  rooms,
  reservations,
  users,
  targetHotelId,
  receptionistHotel,
  hotelRooms,
  isScanning,
  scanProgress,
  scannedResult,
  scanError,
  searchQuery,
  setSearchQuery,
  useRealCamera,
  cameras,
  activeCamId,
  handleManualSearch,
  handleSimulateScan,
  startRealCamera,
  stopRealCamera,
  switchCamera,
  handleCheckIn,
  handleCheckOut,
  onUpdateReservationStatus,
  onAddLog,
  activeUser,
  onUpdateRoomStatus,
  setCheckoutWarningRoom,
  setScannedResult
}: ReceptionCheckInModuleProps) {
  // Local filters for reservation history list
  const todayStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [filterRoomId, setFilterRoomId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>(todayStr);

  const filteredReservations = React.useMemo(() => {
    return reservations
      .filter(r => r.hotelId === targetHotelId)
      .filter(res => {
        const matchesRoom = filterRoomId === 'all' || res.roomId === filterRoomId;
        let matchesDate = true;
        if (filterDate) {
          matchesDate = res.fechaEntrada <= filterDate && res.fechaSalida >= filterDate;
        }
        return matchesRoom && matchesDate;
      });
  }, [reservations, targetHotelId, filterRoomId, filterDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in duration-300" id="reception-check-in-module">
      
      {/* LEFT COLUMN: QR SCANNING INTERACTIVE LAB & TODAY BOARD */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* QR SCANNER EMULATOR LAB */}
        <div className="bg-neutral-900 text-neutral-100 rounded-3xl p-6 shadow-md border border-neutral-800 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-xl" />
          
          <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-400 animate-pulse" />
              <h4 className="font-semibold text-sm">Escáner Sensor QR de Alta Fidelidad</h4>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">EMULADOR SENSOR ÓPTICO</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            
            {/* Visual Screen of simulated scanner */}
            <div className={`bg-neutral-950 border border-neutral-800 rounded-2xl h-56 relative overflow-hidden flex flex-col items-center justify-center ${useRealCamera ? 'p-0' : 'p-4'}`}>
              
              {useRealCamera ? (
                <div id="qr-camera-element" className="w-full h-full object-cover"></div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-radial-gradient from-teal-500/10 via-transparent to-transparent pointer-events-none" />
                  {isScanning ? (
                    <div className="flex flex-col items-center gap-4 text-center z-10">
                      <div className="relative w-16 h-16">
                        <svg className="w-full h-full animate-spin text-teal-500" viewBox="0 0 50 50">
                          <circle className="opacity-25" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <QrCode className="w-6 h-6 text-teal-400 absolute inset-0 m-auto" />
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold tracking-wide text-teal-400">ANALIZANDO CÓDIGO QR</p>
                        <p className="text-[10px] text-neutral-500 mt-1">Calibrando sensor de matriz óptica...</p>
                      </div>
                      <div className="w-40 bg-neutral-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-teal-400 h-full transition-all duration-150" style={{ width: `${scanProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center z-10 p-4">
                      <div className="w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center text-neutral-500">
                        <QrCode className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-neutral-300">Posicione el ticket o carné QR del huésped</p>
                        <p className="text-[10px] text-neutral-500 mt-1">Soporta auto-enfoque con calibración de contraste integrado.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Operations form column */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Entrada Manual Alternativa</span>
                <p className="text-xs text-neutral-400 leading-relaxed">Si el sensor presenta dificultades para enfocar, digite manualmente el código alfanumérico de reservación:</p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: RES-XYZ789"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-teal-400 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={handleManualSearch}
                  className="bg-teal-500 hover:bg-teal-400 text-neutral-950 font-bold px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  Buscar
                </button>
              </div>

              <div className="border-t border-neutral-800/60 pt-3 flex flex-col gap-2">
                {!useRealCamera ? (
                  <button
                    type="button"
                    onClick={startRealCamera}
                    className="w-full h-9 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 font-semibold rounded-xl text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-neutral-400" />
                    Usar Cámara Real de Dispositivo
                  </button>
                ) : (
                  <div className="space-y-2">
                    {cameras.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-lg border border-neutral-850">
                        <span className="text-[9px] font-mono text-neutral-500 uppercase ml-1">Lente:</span>
                        <select
                          value={activeCamId}
                          onChange={(e) => switchCamera(e.target.value)}
                          className="flex-1 bg-transparent text-[10px] font-semibold text-neutral-300 focus:outline-none cursor-pointer"
                        >
                          {cameras.map(c => (
                            <option key={c.id} value={c.id}>{c.label || `Cámara ${c.id.substring(0, 5)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={stopRealCamera}
                      className="w-full h-9 bg-red-900/10 hover:bg-red-900/20 text-red-400 border border-red-900/20 font-semibold rounded-xl text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Apagar Cámara
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* ACTIVE SCANNED RESULT OPERATIONS DRAWER */}
        {scannedResult && (
          <div className="bg-white rounded-3xl p-6 border-2 border-teal-500/40 shadow-md space-y-5 animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-teal-500 text-neutral-950 px-4 py-1 rounded-bl-2xl text-[10px] font-bold font-mono tracking-wider">
              ENFOQUE ACTIVO
            </div>
            
            {scanError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between gap-6 md:items-center border-b border-neutral-100 pb-4">
              <div className="flex gap-3.5 items-start">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 border border-teal-100 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500 uppercase font-bold">{scannedResult.id}</span>
                  <h4 className="font-bold text-neutral-900 text-sm mt-1">
                    Huésped: {users.find(u => u.id === scannedResult.guestId)?.nombre} {users.find(u => u.id === scannedResult.guestId)?.apellido}
                  </h4>
                  <p className="text-[11px] text-neutral-400 font-medium">Asignación: Cuarto {rooms.find(r => r.id === scannedResult.roomId)?.numero} • {rooms.find(r => r.id === scannedResult.roomId)?.nombre}</p>
                </div>
              </div>
              
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">ESTADO DE RESERVA</span>
                <span className={`text-xs font-bold uppercase mt-1 self-start md:self-end ${
                  scannedResult.estado === 'ocupada' ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100' :
                  scannedResult.estado === 'confirmada' ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' :
                  scannedResult.estado === 'pendiente' ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100' :
                  'text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded'
                }`}>
                  {scannedResult.estado === 'pendiente' ? 'Pendiente Pago' :
                   scannedResult.estado === 'confirmada' ? 'Por Ingresar' :
                   scannedResult.estado === 'ocupada' ? 'En Estadía' :
                   scannedResult.estado === 'finalizada' ? 'Finalizada' :
                   scannedResult.estado === 'cancelada' ? 'Cancelada' : scannedResult.estado}
                </span>
              </div>
            </div>

            {/* Reservation Detail Rows */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 text-xs">
              <div>
                <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">Fecha Check-In:</span>
                <span className="font-semibold text-neutral-800">{scannedResult.fechaEntrada}</span>
              </div>
              <div>
                <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">Fecha Check-Out:</span>
                <span className="font-semibold text-neutral-800">{scannedResult.fechaSalida}</span>
              </div>
              <div>
                <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">Total Transacción:</span>
                <span className="font-mono font-bold text-neutral-800">${scannedResult.total} USD</span>
              </div>
              <div>
                <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">Servicios Extra:</span>
                <span className="font-semibold text-neutral-800 block truncate">
                  {scannedResult.serviciosAdicionales && scannedResult.serviciosAdicionales.length > 0 
                    ? `${scannedResult.serviciosAdicionales.length} contratados` 
                    : 'Ninguno'}
                </span>
              </div>
            </div>

            {/* Dynamic Operator Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {scannedResult.estado === 'confirmada' && (
                <button
                  type="button"
                  onClick={() => handleCheckIn(scannedResult.id)}
                  className="flex-1 bg-teal-500 hover:bg-teal-400 text-neutral-950 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/10 active:scale-95 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Procesar Entrada (Check-In) 🛎️
                </button>
              )}

              {scannedResult.estado === 'ocupada' && (
                <button
                  type="button"
                  onClick={() => handleCheckOut(scannedResult.id)}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Procesar Salida (Check-Out) y Vaciar 🚪
                </button>
              )}

              {scannedResult.estado === 'pendiente' && (
                <div className="w-full space-y-3">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px] leading-relaxed">
                    ⚠️ **Transacción en Estado Pendiente de Pago**: Para permitir el ingreso formal al aposento, debe registrarse el pago de garantía presencial o conciliar la pasarela.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateReservationStatus) {
                          onUpdateReservationStatus(scannedResult.id, 'confirmada', activeUser.nombre, activeUser.rol, 'Pago presencial conciliado en mostrador.');
                          onAddLog('Cobro Realizado', `Reserva ${scannedResult.id} cobrada en efectivo/tarjeta por recepcionista.`);
                          setScannedResult({ ...scannedResult, estado: 'confirmada' });
                        }
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer text-center"
                    >
                      💸 Conciliar Pago Completo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateReservationStatus) {
                          onUpdateReservationStatus(scannedResult.id, 'cancelada', activeUser.nombre, activeUser.rol, 'Reserva cancelada por falta de pago.');
                          onAddLog('Reserva Cancelada', `Reserva ${scannedResult.id} cancelada en mostrador.`);
                          setScannedResult(null);
                        }
                      }}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-lg text-xs transition-colors cursor-pointer text-center"
                    >
                      Cancelar Reserva
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setScannedResult(null)}
                className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-semibold rounded-xl text-xs transition-all text-center cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Recent Reservations Board & Room Operative Status Grid */}
      <div className="space-y-8">
        
        {/* PLANILLA DE RESERVAS BOARD WITH FILTERS */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h4 className="font-semibold text-neutral-800 text-base">Planilla de Reservas del Establecimiento</h4>
            <p className="text-[10px] text-neutral-400 mt-0.5">Filtros dinámicos por habitación y fecha</p>
          </div>

          {/* Filters Panel */}
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-neutral-50 rounded-xl border border-neutral-150 text-[11px]">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 block mb-1">Habitación:</label>
              <select
                value={filterRoomId}
                onChange={(e) => setFilterRoomId(e.target.value)}
                className="w-full bg-white border border-neutral-250 rounded-lg p-1 text-[11px] focus:outline-none"
              >
                <option value="all">Todas</option>
                {hotelRooms.map(r => (
                  <option key={r.id} value={r.id}>N° {r.numero} ({r.nombre})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-neutral-500 block mb-1">Fecha:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-white border border-neutral-250 rounded-lg p-1 text-[11px] focus:outline-none"
              />
            </div>

            <div className="col-span-2 pt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilterRoomId('all');
                  setFilterDate(todayStr);
                }}
                className="flex-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100/50 p-1 rounded-md transition-colors text-center"
              >
                Filtros por Defecto (Hoy)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterRoomId('all');
                  setFilterDate('');
                }}
                className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 bg-white border border-neutral-250 py-1 px-2 rounded-md transition-colors text-center"
              >
                Limpiar Fecha
              </button>
            </div>
          </div>

          {/* Filtered Reservation List */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {filteredReservations.length === 0 ? (
              <div className="text-center py-6 text-neutral-400 text-xs">
                <p className="font-semibold">Sin reservaciones</p>
                <p className="text-[10px] mt-1">No hay reservas coincidentes con los filtros seleccionados.</p>
              </div>
            ) : (
              filteredReservations.map(res => {
                const guest = users.find(u => u.id === res.guestId);
                const room = rooms.find(r => r.id === res.roomId);

                return (
                  <div key={res.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-center hover:bg-neutral-100 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-neutral-800 uppercase">{res.id}</span>
                        <span className="text-[9px] font-mono text-neutral-400">Habit. {room?.numero}</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-750">{guest?.nombre} {guest?.apellido}</p>
                      <p className="text-[9px] text-neutral-450">Ingreso: {res.fechaEntrada} a {res.fechaSalida}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                        res.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        res.estado === 'pendiente' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        res.estado === 'ocupada' ? 'bg-blue-50 text-blue-700' :
                        res.estado === 'finalizada' ? 'bg-neutral-200 text-neutral-600' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {res.estado === 'pendiente' ? 'P. Pago' :
                         res.estado === 'confirmada' ? 'Reserv.' :
                         res.estado === 'ocupada' ? 'Estadía' :
                         res.estado === 'finalizada' ? 'Fin' :
                         res.estado === 'cancelada' ? 'Canc.' : res.estado}
                      </span>
                      
                      <button
                        onClick={() => handleSimulateScan(res.id)}
                        className="p-1 bg-white border border-neutral-200 hover:bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700 transition-colors cursor-pointer"
                      >
                        Operar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ROOM STATE OPERATIVE GRID */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
            <h4 className="font-semibold text-neutral-900 text-sm">Operario de Habitaciones</h4>
            <span className="text-[9px] bg-neutral-100 text-neutral-600 font-mono font-bold px-1.5 py-0.5 rounded">
              {hotelRooms.length} cuartos
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] text-neutral-500 leading-normal">
              Configure manualmente los estados de vaciado y desinfección higiénica.
            </p>

            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {hotelRooms.map(room => (
                <div key={room.id} className="p-2 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] bg-white border border-neutral-200 text-neutral-600 px-1 py-0.5 rounded font-mono font-bold">
                      N° {room.numero}
                    </span>
                    <h5 className="font-semibold text-neutral-800 text-[11px] mt-0.5 truncate max-w-[120px]">{room.nombre}</h5>
                  </div>

                  <select
                    value={room.estado}
                    onChange={(e) => {
                      const nextStatus = e.target.value as any;
                      if (room.estado === 'ocupado' && nextStatus !== 'ocupado') {
                        setCheckoutWarningRoom(room);
                      } else {
                        onUpdateRoomStatus(room.id, nextStatus);
                      }
                    }}
                    className={`text-[9px] font-bold p-1 rounded border focus:outline-none cursor-pointer uppercase ${
                      room.estado === 'disponible' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      room.estado === 'reservado' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                      room.estado === 'ocupado' ? 'bg-amber-50 text-amber-850 border-amber-200' :
                      'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    <option value="disponible">Disponible</option>
                    <option value="reservado">Reservado</option>
                    <option value="ocupado">Ocupado</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
