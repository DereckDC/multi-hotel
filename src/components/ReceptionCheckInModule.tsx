import React, { useState } from 'react';
import { Reservation, Room, User } from '../types';
import { QrCode, Search, Camera, UserCheck, ShieldCheck, AlertTriangle, Check } from 'lucide-react';
import { Button, SelectPicker } from './ui';

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
        <div className="bg-neutral-900 text-neutral-100 rounded-2xl p-6 shadow-sm border border-neutral-800 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-xl" />
          
          <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-400 animate-pulse" />
              <h4 className="font-semibold text-sm">Escáner Sensor QR de Alta Fidelidad</h4>
            </div>
            <span className="text-micro font-mono text-neutral-500">EMULADOR SENSOR ÓPTICO</span>
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
                        <p className="text-micro text-neutral-500 mt-1">Calibrando sensor de matriz óptica...</p>
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
                        <p className="text-micro text-neutral-500 mt-1">Soporta auto-enfoque con calibración de contraste integrado.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Operations form column */}
            <div className="space-y-4">
              <div>
                <span className="text-micro font-bold text-neutral-500 uppercase tracking-wider block mb-1">Entrada Manual Alternativa</span>
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
                <Button
                  type="button"
                  onClick={handleManualSearch}
                  variant="accent" size="md"
                >
                  <Search className="w-3.5 h-3.5" />
                  Buscar
                </Button>
              </div>

              <div className="border-t border-neutral-800/60 pt-3 flex flex-col gap-2">
                {!useRealCamera ? (
                  <Button
                    onClick={startRealCamera}
                    variant="secondary" size="sm" fullWidth
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Escanear QR
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {cameras.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
                        <span className="text-micro font-mono text-neutral-500 uppercase ml-1">Lente:</span>
                        <SelectPicker label="Lente"
                          value={activeCamId}
                          onChange={(e) => switchCamera(e.target.value)}
                          className="flex-1 bg-transparent text-micro font-semibold text-neutral-300 focus:outline-none cursor-pointer"
                        >
                          {cameras.map(c => (
                            <option key={c.id} value={c.id}>{c.label || `Cámara ${c.id.substring(0, 5)}`}</option>
                          ))}
                        </SelectPicker>
                      </div>
                    )}
                    <Button
                      onClick={stopRealCamera}
                      variant="secondary" size="sm" fullWidth className="text-danger-700"
                    >
                      Apagar cámara
                    </Button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* ACTIVE SCANNED RESULT OPERATIONS DRAWER */}
        {scannedResult && (
          <div className="bg-white rounded-2xl p-6 border-2 border-teal-500/40 shadow-sm space-y-5 animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-teal-500 text-neutral-950 px-4 py-1 rounded-bl-2xl text-micro font-bold font-mono tracking-wider">
              ENFOQUE ACTIVO
            </div>
            
            {scanError && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 p-3 rounded-xl text-xs flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between gap-6 md:items-center border-b border-neutral-100 pb-4">
              <div className="flex gap-3.5 items-start">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 border border-teal-100 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-micro font-mono bg-neutral-100 px-1.5 py-0.5 rounded-lg text-neutral-500 uppercase font-bold">{scannedResult.id}</span>
                  <h4 className="font-bold text-neutral-900 text-sm mt-1">
                    Huésped: {users.find(u => u.id === scannedResult.guestId)?.nombre} {users.find(u => u.id === scannedResult.guestId)?.apellido}
                  </h4>
                  <p className="text-micro text-neutral-400 font-medium">Asignación: Cuarto {rooms.find(r => r.id === scannedResult.roomId)?.numero} • {rooms.find(r => r.id === scannedResult.roomId)?.nombre}</p>
                </div>
              </div>
              
              <div className="flex flex-col text-right">
                <span className="text-micro font-bold text-neutral-400 uppercase tracking-wider">ESTADO DE RESERVA</span>
                <span className={`text-xs font-bold uppercase mt-1 self-start md:self-end ${
                  scannedResult.estado === 'ocupada' ? 'text-info-600 bg-info-50 px-2 py-0.5 rounded-lg border border-info-100' :
                  scannedResult.estado === 'confirmada' ? 'text-success-700 bg-success-50 px-2 py-0.5 rounded-lg border border-success-100' :
                  scannedResult.estado === 'pendiente' ? 'text-warning-600 bg-warning-50 px-2 py-0.5 rounded-lg border border-warning-100' :
                  'text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-lg'
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs">
              <div>
                <span className="text-micro text-neutral-400 block font-bold uppercase tracking-wider">Fecha Check-In:</span>
                <span className="font-semibold text-neutral-800">{scannedResult.fechaEntrada}</span>
              </div>
              <div>
                <span className="text-micro text-neutral-400 block font-bold uppercase tracking-wider">Fecha Check-Out:</span>
                <span className="font-semibold text-neutral-800">{scannedResult.fechaSalida}</span>
              </div>
              <div>
                <span className="text-micro text-neutral-400 block font-bold uppercase tracking-wider">Total Transacción:</span>
                <span className="font-mono font-bold text-neutral-800">${scannedResult.total} USD</span>
              </div>
              <div>
                <span className="text-micro text-neutral-400 block font-bold uppercase tracking-wider">Servicios Extra:</span>
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
                scannedResult.montoPendiente !== undefined && scannedResult.montoPendiente > 0 ? (
                  <div className="w-full space-y-3">
                    <div className="bg-warning-50 border border-warning-200 text-warning-800 p-3 rounded-xl text-micro leading-relaxed">
                      ⚠️ **Estadía con Saldo Pendiente**: Esta reserva tiene un saldo pendiente de <strong>${scannedResult.montoPendiente.toFixed(2)} USD</strong>. Al procesar el ingreso, se asume que el cliente ha liquidado este monto.
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          // Complete payment & process entry
                          if (onUpdateReservationStatus) {
                            onUpdateReservationStatus(
                              scannedResult.id, 
                              'ocupada', 
                              activeUser.nombre, 
                              activeUser.rol, 
                              'Saldo pendiente liquidado en mostrador al realizar Check-In.',
                              scannedResult.total,
                              0
                            );
                          }
                          handleCheckIn(scannedResult.id);
                        }}
                        variant="success" size="md"
                      >
                        Pago completo
                      </Button>
                      
                      <Button
                        type="button"
                        onClick={() => {
                          if (onUpdateReservationStatus) {
                            onUpdateReservationStatus(scannedResult.id, 'cancelada', activeUser.nombre, activeUser.rol, 'Reserva cancelada en mostrador.');
                            onAddLog('Reserva Cancelada', `Reserva ${scannedResult.id} cancelada al check-in.`);
                            setScannedResult(null);
                          }
                        }}
                        variant="danger" size="sm"
                      >
                        Cancelar reserva
                      </Button>
                      
                      <Button
                        type="button"
                        onClick={() => setScannedResult(null)}
                        variant="secondary" size="md"
                      >
                        Cerrar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleCheckIn(scannedResult.id)}
                    variant="accent" size="md" className="flex-1"
                  >
                    <UserCheck className="w-4 h-4" />
                    Registrar entrada
                  </Button>
                )
              )}

              {scannedResult.estado === 'ocupada' && (
                <Button
                  onClick={() => handleCheckOut(scannedResult.id)}
                  variant="primary" size="md" className="flex-1"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Registrar salida
                </Button>
              )}

              {scannedResult.estado === 'pendiente' && (
                <div className="w-full space-y-3">
                  <div className="bg-warning-50 border border-warning-200 text-warning-800 p-3 rounded-xl text-micro leading-relaxed">
                    ⚠️ **Transacción en Estado Pendiente de Pago**: Elija una opción para registrar el pago inicial y pasar la reserva a estado <strong>Reservada</strong>.
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        if (onUpdateReservationStatus) {
                          onUpdateReservationStatus(
                            scannedResult.id, 
                            'confirmada', 
                            activeUser.nombre, 
                            activeUser.rol, 
                            'Pago Completo registrado en recepción.',
                            scannedResult.total,
                            0
                          );
                          onAddLog('Cobro Realizado', `Reserva ${scannedResult.id} cobrado el total de $${scannedResult.total} USD.`);
                          setScannedResult({ 
                            ...scannedResult, 
                            estado: 'confirmada',
                            montoPagado: scannedResult.total,
                            montoPendiente: 0
                          });
                        }
                      }}
                      variant="success" size="sm"
                    >
                      Pago completo
                    </Button>
                    
                    <Button
                      type="button"
                      onClick={() => {
                        if (onUpdateReservationStatus) {
                          const pagado = Number((scannedResult.total * 0.20).toFixed(2));
                          const pendiente = Number((scannedResult.total * 0.80).toFixed(2));
                          onUpdateReservationStatus(
                            scannedResult.id, 
                            'confirmada', 
                            activeUser.nombre, 
                            activeUser.rol, 
                            'Pago Parcial del 20% registrado en recepción.',
                            pagado,
                            pendiente
                          );
                          onAddLog('Cobro Realizado', `Reserva ${scannedResult.id} cobrado el 20% de garantía ($${pagado} USD).`);
                          setScannedResult({ 
                            ...scannedResult, 
                            estado: 'confirmada',
                            montoPagado: pagado,
                            montoPendiente: pendiente
                          });
                        }
                      }}
                      variant="primary" size="sm"
                    >
                      Pago del 20%
                    </Button>
                    
                    <Button
                      type="button"
                      onClick={() => {
                        if (onUpdateReservationStatus) {
                          onUpdateReservationStatus(scannedResult.id, 'cancelada', activeUser.nombre, activeUser.rol, 'Reserva cancelada por falta de pago.');
                          onAddLog('Reserva Cancelada', `Reserva ${scannedResult.id} cancelada en mostrador.`);
                          setScannedResult(null);
                        }
                      }}
                      variant="danger" size="sm"
                    >
                      Cancelar reserva
                    </Button>
                    
                    <Button
                      type="button"
                      onClick={() => setScannedResult(null)}
                      variant="secondary" size="sm"
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>
              )}

              {!(scannedResult.estado === 'pendiente' || (scannedResult.estado === 'confirmada' && scannedResult.montoPendiente !== undefined && scannedResult.montoPendiente > 0)) && (
                <Button
                  type="button"
                  onClick={() => setScannedResult(null)}
                  variant="secondary" size="md"
                >
                  Cerrar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Recent Reservations Board & Room Operative Status Grid */}
      <div className="space-y-8">
        
        {/* PLANILLA DE RESERVAS BOARD WITH FILTERS */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h4 className="text-base font-bold text-brand-navy1">Reservas del establecimiento</h4>
            <p className="text-micro text-neutral-400 mt-0.5">Filtros dinámicos por habitación y fecha</p>
          </div>

          {/* Filters Panel */}
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-micro">
            <div>
              <label className="text-micro font-bold text-neutral-500 block mb-1">Habitación:</label>
              <SelectPicker label="Habitación"
                value={filterRoomId}
                onChange={(e) => setFilterRoomId(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-micro focus:outline-none"
              >
                <option value="all">Todas</option>
                {hotelRooms.map(r => (
                  <option key={r.id} value={r.id}>N° {r.numero} ({r.nombre})</option>
                ))}
              </SelectPicker>
            </div>
            
            <div>
              <label className="text-micro font-bold text-neutral-500 block mb-1">Fecha:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-micro focus:outline-none"
              />
            </div>

            <div className="col-span-2 pt-1.5 flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setFilterRoomId('all');
                  setFilterDate(todayStr);
                }}
                variant="icon" className="flex-1"
              >
                Filtros por Defecto (Hoy)
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setFilterRoomId('all');
                  setFilterDate('');
                }}
                variant="secondary" size="sm"
              >
                Limpiar Fecha
              </Button>
            </div>
          </div>

          {/* Filtered Reservation List */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {filteredReservations.length === 0 ? (
              <div className="text-center py-6 text-neutral-400 text-xs">
                <p className="font-semibold">Sin reservaciones</p>
                <p className="text-micro mt-1">No hay reservas coincidentes con los filtros seleccionados.</p>
              </div>
            ) : (
              filteredReservations.map(res => {
                const guest = users.find(u => u.id === res.guestId);
                const room = rooms.find(r => r.id === res.roomId);

                return (
                  <div key={res.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-center hover:bg-neutral-100 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-micro font-bold text-neutral-800 uppercase">{res.id}</span>
                        <span className="text-micro font-mono text-neutral-400">Habit. {room?.numero}</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-700">{guest?.nombre} {guest?.apellido}</p>
                      <p className="text-micro text-neutral-400">Ingreso: {res.fechaEntrada} a {res.fechaSalida}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded-lg text-micro font-bold uppercase ${
                        res.estado === 'confirmada' ? 'bg-success-50 text-success-700 border border-success-100' :
                        res.estado === 'pendiente' ? 'bg-warning-50 text-warning-600 border border-warning-100' :
                        res.estado === 'ocupada' ? 'bg-info-50 text-info-700' :
                        res.estado === 'finalizada' ? 'bg-neutral-200 text-neutral-600' :
                        'bg-danger-50 text-danger-700'
                      }`}>
                        {res.estado === 'pendiente' ? 'P. Pago' :
                         res.estado === 'confirmada' ? 'Reserv.' :
                         res.estado === 'ocupada' ? 'Estadía' :
                         res.estado === 'finalizada' ? 'Fin' :
                         res.estado === 'cancelada' ? 'Canc.' : res.estado}
                      </span>
                      
                      <Button
                        onClick={() => handleSimulateScan(res.id)}
                        variant="icon"
                      >
                        Operar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ROOM STATE OPERATIVE GRID */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
            <h4 className="text-base font-bold text-brand-navy1">Estado de las habitaciones</h4>
            <span className="text-micro bg-neutral-100 text-neutral-600 font-mono font-bold px-1.5 py-0.5 rounded-lg">
              {hotelRooms.length} cuartos
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-micro text-neutral-500 leading-normal">
              Configure manualmente los estados de vaciado y desinfección higiénica.
            </p>

            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {hotelRooms.map(room => (
                <div key={room.id} className="p-2 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-center">
                  <div>
                    <span className="text-micro bg-white border border-neutral-200 text-neutral-600 px-1 py-0.5 rounded-lg font-mono font-bold">
                      N° {room.numero}
                    </span>
                    <h5 className="font-semibold text-neutral-800 text-micro mt-0.5 truncate max-w-[120px]">{room.nombre}</h5>
                  </div>

                  <SelectPicker label="Estado de la habitación" size="sm"
                    value={room.estado}
                    onChange={(e) => {
                      const nextStatus = e.target.value as any;
                      if (room.estado === 'ocupado' && nextStatus !== 'ocupado') {
                        setCheckoutWarningRoom(room);
                      } else {
                        onUpdateRoomStatus(room.id, nextStatus);
                      }
                    }}
                    className={`text-micro font-bold p-1 rounded-lg border focus:outline-none cursor-pointer uppercase ${
                      room.estado === 'disponible' ? 'bg-success-50 text-success-800 border-success-200' :
                      room.estado === 'reservado' ? 'bg-info-50 text-info-800 border-info-200' :
                      room.estado === 'ocupado' ? 'bg-warning-50 text-warning-800 border-warning-200' :
                      'bg-danger-50 text-danger-800 border-danger-200'
                    }`}
                  >
                    <option value="disponible">Disponible</option>
                    <option value="reservado">Reservado</option>
                    <option value="ocupado">Ocupado</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </SelectPicker>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
