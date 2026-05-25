/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus } from '../types';
import { QrCode, Search, Check, ShieldAlert, Sparkles, AlertTriangle, Calendar, UserCheck, ShieldCheck, Hammer, HelpCircle, Loader, Coffee } from 'lucide-react';

interface ReceptionViewProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  activeUser: User;
  onPerformCheckIn: (resId: string, receptionistId: string) => { success: boolean; msg: string };
  onPerformCheckOut: (resId: string, receptionistId: string) => { success: boolean; msg: string };
  onUpdateRoomStatus: (roomId: string, status: RoomStatus) => void;
  users: User[];
  onAddLog: (action: string, details: string) => void;
}

export default function ReceptionView({
  hotels,
  rooms,
  reservations,
  activeUser,
  onPerformCheckIn,
  onPerformCheckOut,
  onUpdateRoomStatus,
  users,
  onAddLog
}: ReceptionViewProps) {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotelFilter, setSelectedHotelFilter] = useState('');

  // Scanning simulation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedResId, setScannedResId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<Reservation | null>(null);

  // Incidences report
  const [incidentRoomId, setIncidentRoomId] = useState('');
  const [incidentText, setIncidentText] = useState('');
  const [incidentSubmitted, setIncidentSubmitted] = useState(false);

  // Auto-assign first hotel state if receptionist has one
  const receptionistHotel = hotels.find(h => h.id === activeUser.hotelId) || hotels[0];

  // Helper lists
  const pendingCheckIns = reservations.filter(r => r.estado === 'confirmada' || r.estado === 'pendiente');
  const activeOcupations = reservations.filter(r => r.estado === 'ocupada');
  const hotelRooms = selectedHotelFilter 
    ? rooms.filter(r => r.hotelId === selectedHotelFilter) 
    : rooms.filter(r => r.hotelId === receptionistHotel?.id);

  // Simulate scanning QR Code
  const handleSimulateScan = (resId: string) => {
    setIsScanning(true);
    setScanProgress(0);
    setScanError(null);
    setScannedResult(null);
    setScannedResId(resId);

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          completeScan(resId);
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  };

  const completeScan = (resId: string) => {
    setIsScanning(false);
    const targetRes = reservations.find(r => r.id === resId || r.qrCode === resId);
    if (targetRes) {
      setScannedResult(targetRes);
      // Log event
      onAddLog('Lectura QR', `Lectura QR de reserva "${targetRes.id}" exitoso. Información extraída.`);
    } else {
      setScanError('Código QR no coincide con ninguna reservación activa en la base de datos.');
    }
  };

  // Process Check-In
  const handleCheckIn = (resId: string) => {
    const res = onPerformCheckIn(resId, activeUser.id);
    if (res.success) {
      // Clear result
      setScannedResult(null);
      setScannedResId(null);
      alert('¡Check-In Procesado con éxito! La habitación ahora cuenta con estado OCUPADO.');
    } else {
      alert(res.msg);
    }
  };

  // Process Check-Out
  const handleCheckOut = (resId: string) => {
    const res = onPerformCheckOut(resId, activeUser.id);
    if (res.success) {
      setScannedResult(null);
      setScannedResId(null);
      alert('¡Check-Out completado! La habitación pasó a estado MANTENIMIENTO.');
    } else {
      alert(res.msg);
    }
  };

  // Manual code check-in lookup
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    const cleanQuery = searchQuery.trim().toUpperCase();
    
    // Look up by reservation id or QR content
    const res = reservations.find(r => r.id.toUpperCase() === cleanQuery || r.qrCode.toUpperCase() === cleanQuery);
    if (res) {
      setScannedResult(res);
      setScanError(null);
    } else {
      setScanError(`No se encontró ninguna reserva para el código "${cleanQuery}"`);
      setScannedResult(null);
    }
  };

  // Submit Room Incident
  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentRoomId || !incidentText) return;
    const target = rooms.find(r => r.id === incidentRoomId);
    if (!target) return;

    // Send status to maintenance
    onUpdateRoomStatus(incidentRoomId, 'mantenimiento');
    onAddLog('Incidencia Registrada', `Habitación N° ${target.numero} puesta en mantenimiento por "${incidentText}"`);

    setIncidentSubmitted(true);
    setIncidentText('');
    setTimeout(() => {
      setIncidentSubmitted(false);
      setIncidentRoomId('');
    }, 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* LEFT COLUMN: QR SCANNING INTERACTIVE LAB & TODAY BOARD */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* RECEPTION BANNER */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-50 text-teal-600 flex items-center justify-center rounded-2xl border border-teal-100 shrink-0">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-600 tracking-wider">MÓDULO DE RECEPCIÓN</span>
              <h3 className="text-xl font-bold text-neutral-800">Mostrador - {receptionistHotel?.nombre}</h3>
              <p className="text-xs text-neutral-400">Atendido por {activeUser.nombre} {activeUser.apellido}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 block font-semibold font-mono">USUARIO ID: {activeUser.id}</span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-100 uppercase uppercase">Operativo</span>
          </div>
        </div>

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
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl h-56 relative overflow-hidden flex flex-col items-center justify-center p-4">
              
              {isScanning ? (
                // Scanning screen
                <div className="text-center space-y-3 w-full">
                  <div className="w-full h-1 bg-teal-500/10 rounded overflow-hidden relative">
                    <div className="h-full bg-teal-400 transition-all duration-200" style={{ width: `${scanProgress}%` }} />
                  </div>
                  <div className="absolute inset-0 scanner-line opacity-40 z-10 pointers-events-none" />
                  <Loader className="w-10 h-10 text-teal-400 animate-spin mx-auto" />
                  <p className="text-xs font-mono text-teal-300">Descifrando haz óptico QR... {scanProgress}%</p>
                </div>
              ) : scannedResult ? (
                // Match scanned screen
                <div className="text-center space-y-2.5 animate-fade-in w-full text-xs">
                  <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="font-bold text-neutral-200 font-mono text-sm">ID: {scannedResult.id}</p>
                  <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest bg-emerald-950/40 border border-emerald-900/30 py-0.5 rounded px-2 inline-block">
                    Código de Reserva Auténtico
                  </p>
                  <div className="text-neutral-400 text-[10px] space-y-0.5">
                    <p>Cliente: {users.find(u => u.id === scannedResult.guestId)?.nombre} {users.find(u => u.id === scannedResult.guestId)?.apellido}</p>
                    <p>Entrada: {scannedResult.fechaEntrada} / Salida: {scannedResult.fechaExit || scannedResult.fechaSalida}</p>
                  </div>
                </div>
              ) : scanError ? (
                // Scanned error screen
                <div className="text-center space-y-2.5 animate-fade-in p-4 text-xs">
                  <AlertTriangle className="w-10 h-10 text-red-500 mx-auto animate-bounce" />
                  <p className="font-semibold text-red-400">Error de Validación</p>
                  <p className="text-[10px] text-neutral-500 leading-normal">{scanError}</p>
                  <button
                    onClick={() => setScanError(null)}
                    className="px-2.5 py-1 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                // Default IDLE scanner screen
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 border-2 border-dashed border-neutral-700 rounded-xl flex items-center justify-center text-neutral-600 mx-auto">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Sensor listo para leer códigos del Huésped</p>
                    <p className="text-[10px] text-neutral-600 mt-1">Busque manualmente o presione un QR rápido de prueba abajo</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions / Manual input logic */}
            <div className="space-y-4">
              <form onSubmit={handleManualSearch} className="space-y-2">
                <label className="text-xs font-semibold text-neutral-400 block">Búsqueda Manual (ID o QR):</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ej: RES-73829"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-lg py-2 pl-3 pr-8 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                    />
                    <Search className="w-3.5 h-3.5 text-neutral-600 absolute top-2.5 right-2.5" />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-neutral-950 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Buscar
                  </button>
                </div>
              </form>

              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Reservas en Espera (QR Demostración)</span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {reservations
                    .filter(r => r.hotelId === receptionistHotel?.id && r.estado !== 'cancelada')
                    .map(r => {
                      const guest = users.find(u => u.id === r.guestId);
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleSimulateScan(r.id)}
                          className="w-full text-left p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-750 transition-colors cursor-pointer text-[11px] flex justify-between items-center text-neutral-300 font-mono"
                        >
                          <span className="truncate max-w-[120px] font-bold">{guest?.nombre} ({r.id})</span>
                          <span className="text-[10px] capitalize bg-neutral-900 px-1 py-0.5 rounded text-teal-400">{r.estado}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

          </div>

          {/* ACTIVE SCANNED RESULT OPERATIONS DRAWER */}
          {scannedResult && (
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl animate-fade-in space-y-4">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <h5 className="text-teal-400 font-bold font-mono text-sm">RESERVA {scannedResult.id}</h5>
                  <p className="text-xs text-neutral-400">Huésped: {users.find(u => u.id === scannedResult.guestId)?.nombre} {users.find(u => u.id === scannedResult.guestId)?.apellido}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 block font-normal">MONTO PRE-PAGADO</span>
                  <span className="font-mono font-bold text-white text-base">${scannedResult.total.toFixed(2)} USD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-neutral-300 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                <div>
                  <p className="text-neutral-500 font-medium font-mono text-[10px]">CHECK-IN PLANIFICADO</p>
                  <p className="font-semibold text-neutral-200 mt-0.5">{scannedResult.fechaEntrada}</p>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium font-mono text-[10px]">CHECK-OUT PLANIFICADO</p>
                  <p className="font-semibold text-neutral-200 mt-0.5">{scannedResult.fechaSalida}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {(scannedResult.estado === 'confirmada' || scannedResult.estado === 'pendiente') && (
                  <button
                    onClick={() => handleCheckIn(scannedResult.id)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar Check-In</span>
                  </button>
                )}
                {scannedResult.estado === 'ocupada' && (
                  <button
                    onClick={() => handleCheckOut(scannedResult.id)}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-md"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Confirmar Check-Out</span>
                  </button>
                )}
                <button
                  onClick={() => { setScannedResult(null); setScannedResId(null); }}
                  className="px-4 py-2 border border-neutral-700 hover:bg-neutral-800 text-neutral-400 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RECENT RESERVATIONS BOARD */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
            <h4 className="font-semibold text-neutral-800 text-base">Planilla de Reservas del Establecimiento</h4>
            <span className="text-xs bg-neutral-100 px-2 py-0.5 rounded text-neutral-600 font-mono">{reservations.filter(r => r.hotelId === receptionistHotel?.id).length} en total</span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {reservations
              .filter(r => r.hotelId === receptionistHotel?.id)
              .map(res => {
                const guest = users.find(u => u.id === res.guestId);
                const room = rooms.find(r => r.id === res.roomId);

                return (
                  <div key={res.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-center hover:bg-neutral-100 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-800 uppercase">{res.id}</span>
                        <span className="text-[10px] font-mono text-neutral-400">Habit. {room?.numero}</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-750">{guest?.nombre} {guest?.apellido}</p>
                      <p className="text-[10px] text-neutral-400">Ingreso: {res.fechaEntrada} a {res.fechaSalida}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        res.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-700' :
                        res.estado === 'ocupada' ? 'bg-blue-50 text-blue-700' :
                        res.estado === 'finalizada' ? 'bg-neutral-200 text-neutral-600' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {res.estado}
                      </span>
                      
                      <button
                        onClick={() => handleSimulateScan(res.id)}
                        className="p-1 px-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 rounded text-[11px] font-semibold text-neutral-700 transition-colors cursor-pointer"
                      >
                        Operar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: OPERATIVE CLINIC & INCIDENCES */}
      <div className="space-y-8">
        
        {/* ROOM STATE OPERATIVE GRID */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
            <h4 className="font-semibold text-neutral-900 text-base">Operario de Habitaciones</h4>
            <select
              value={selectedHotelFilter}
              onChange={(e) => setSelectedHotelFilter(e.target.value)}
              className="border border-neutral-200 text-[11px] font-semibold p-1 rounded-md focus:outline-none"
            >
              <option value="">Mi Hotel</option>
              {hotels.map(h => (
                <option key={h.id} value={h.id}>{h.nombre.replace('Aura ', '')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3.5">
            <p className="text-xs text-neutral-500 leading-normal">
              Como recepcionista o personal autorizado, configure manualmente los estados intermedios de vaciado y desinfección higiénica.
            </p>

            <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
              {hotelRooms.map(room => {
                return (
                  <div key={room.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] bg-white border border-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          N° {room.numero}
                        </span>
                        <h5 className="font-semibold text-neutral-800 text-xs mt-1 block truncate max-w-[150px]">{room.nombre}</h5>
                      </div>

                      {/* State switch selector pills */}
                      <select
                        value={room.estado}
                        onChange={(e) => onUpdateRoomStatus(room.id, e.target.value as RoomStatus)}
                        className={`text-[10px] font-bold p-1 rounded-lg border focus:outline-none cursor-pointer uppercase ${
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

                    <div className="flex justify-between items-center text-[10px] text-neutral-400">
                      <span>Capacidad: {room.capacidad} personas</span>
                      <span className="font-mono font-medium">${room.precio} USD</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* INCIDENCES REGISTER */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-neutral-900 text-base">Registrar Incidencia</h4>
          </div>

          <form onSubmit={handleReportIncident} className="space-y-4">
            {incidentSubmitted && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-medium">
                Incidencia guardada con éxito. Habitación colocada en Mantenimiento.
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-neutral-500 block mb-1">Seleccionar Habitación:</label>
              <select
                required
                value={incidentRoomId}
                onChange={(e) => setIncidentRoomId(e.target.value)}
                className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">Elegir número de cuarto...</option>
                {rooms.filter(r => r.hotelId === receptionistHotel?.id).map(r => (
                  <option key={r.id} value={r.id}>Cuarto {r.numero} ({r.nombre})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500 block mb-1">Descripción del desperfecto:</label>
              <textarea
                required
                placeholder="Ej: Fuga de agua en el lavabo del baño, persiana principal atascada, etc."
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none h-20"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-neutral-900 text-white font-bold py-2 rounded-xl text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Reportar Incidencia
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
