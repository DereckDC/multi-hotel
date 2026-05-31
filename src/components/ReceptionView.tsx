/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus } from '../types';
import { QrCode, Search, Check, ShieldAlert, Sparkles, AlertTriangle, Calendar, UserCheck, ShieldCheck, Hammer, HelpCircle, Loader, Coffee } from 'lucide-react';
import { RoomReservationCalendar } from './RoomReservationCalendar';
import { Html5Qrcode } from 'html5-qrcode';

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
  onCreateReservation?: (newRes: Reservation) => void;
  onRegisterUser?: (newUser: User) => Promise<any> | void;
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
  onAddLog,
  onCreateReservation,
  onRegisterUser
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

  // Real QR Camera Scanner state
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [activeCamId, setActiveCamId] = useState<string>('');
  const [cameras, setCameras] = useState<any[]>([]);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Stop current active scanner
  const stopRealCamera = async () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (err) {
          console.warn("Failed to stop camera scan:", err);
        }
      }
      html5QrCodeRef.current = null;
    }
    setUseRealCamera(false);
  };

  // Start real camera scanner
  const startRealCamera = async (cameraId?: string) => {
    setScanError(null);
    setScannedResult(null);
    setUseRealCamera(true);
    setIsScanning(false);
    
    // Stop any running camera
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {}
    }

    setTimeout(async () => {
      try {
        const scannerElement = document.getElementById('qr-camera-element');
        if (!scannerElement) {
          throw new Error("Contenedor de cámara no encontrado");
        }

        const html5QrCode = new Html5Qrcode("qr-camera-element");
        html5QrCodeRef.current = html5QrCode;

        // Fetch cameras if not loaded
        let currentCamId = cameraId || activeCamId;
        if (!currentCamId) {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            currentCamId = devices[0].id;
            setActiveCamId(currentCamId);
          } else {
            throw new Error("No se detectaron cámaras en el dispositivo ni permisos de cámara concedidos.");
          }
        }

        await html5QrCode.start(
          currentCamId,
          {
            fps: 15,
            qrbox: (width, height) => {
              const exactSize = Math.min(width, height) * 0.7;
              return { width: exactSize, height: exactSize };
            }
          },
          (decodedText) => {
            console.log("Real QR code scanned successfully:", decodedText);
            // Handle scanned code
            completeScan(decodedText);
            // Stop and disable camera view on success
            stopRealCamera();
          },
          () => {} // silent frame reject errors
        );
      } catch (err: any) {
        console.error("Error starting camera qr scanner:", err);
        setScanError(`No se pudo arrancar la cámara: ${err.message || String(err)}. Si estás en un iframe-sandbox central, por favor abre la aplicación en una pestaña nueva del navegador usando el botón Salir de Iframe de la esquina superior derecha para conceder permisos a la cámara correctamente.`);
        setUseRealCamera(false);
      }
    }, 150);
  };

  // Cleanup camera scanning on unmount
  React.useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(err => console.warn(err));
        }
      }
    };
  }, []);

  // Incidences report
  const [incidentRoomId, setIncidentRoomId] = useState('');
  const [incidentText, setIncidentText] = useState('');
  const [incidentSubmitted, setIncidentSubmitted] = useState(false);

  // Warning state for manual occupied chamber modification
  const [checkoutWarningRoom, setCheckoutWarningRoom] = useState<Room | null>(null);

  // Auto-assign first hotel state if receptionist has one
  const receptionistHotel = hotels.find(h => h.id === activeUser.hotelId) || hotels[0];

  // Presencial reservation states
  const [resType, setResType] = useState<'new' | 'existing'>('new');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  
  // New Guest walk-in details
  const [walkInNombre, setWalkInNombre] = useState('');
  const [walkInApellido, setWalkInApellido] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [walkInTelefono, setWalkInTelefono] = useState('');
  const [walkInDocumento, setWalkInDocumento] = useState('');

  // Booking details
  const [bookRoomId, setBookRoomId] = useState('');
  const [bookCheckIn, setBookCheckIn] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookCheckOut, setBookCheckOut] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookNotas, setBookNotas] = useState('');
  const [bookStatus, setBookStatus] = useState<'confirmada' | 'ocupada'>('confirmada');
  const [resSuccessMsg, setResSuccessMsg] = useState('');

  const selectedRoom = rooms.find(r => r.id === bookRoomId);
  const roomPrice = selectedRoom ? selectedRoom.precio : 0;
  
  let nights = 1;
  if (bookCheckIn && bookCheckOut) {
    const diff = new Date(bookCheckOut).getTime() - new Date(bookCheckIn).getTime();
    nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (nights <= 0) nights = 1;
  }

  const calculatedSubtotal = roomPrice * nights;
  const calculatedImpuestos = parseFloat((calculatedSubtotal * 0.12).toFixed(2));
  const calculatedTotal = parseFloat((calculatedSubtotal + calculatedImpuestos).toFixed(2));

  const handleCreatePresencialRes = async (e: React.FormEvent) => {
    e.preventDefault();
    setResSuccessMsg('');

    if (!bookRoomId) {
      alert('Por favor selecciona una habitación.');
      return;
    }

    if (!receptionistHotel) {
      alert('Error: Debe estar enlazado a un hotel válido.');
      return;
    }

    let targetGuestId = '';

    if (resType === 'new') {
      if (!walkInNombre || !walkInApellido || !walkInEmail || !walkInTelefono || !walkInDocumento) {
        alert('Por favor completa todos los campos del huésped nuevo.');
        return;
      }

      // Check if email already exists in system to prevent duplicate
      const matchedUser = users.find(u => u.email.toLowerCase() === walkInEmail.toLowerCase());
      if (matchedUser) {
        targetGuestId = matchedUser.id;
      } else {
        // Create new user in the system
        const generatedId = 'usr-' + Date.now();
        const genPassword = 'RoomiaPass' + Math.floor(1000 + Math.random() * 9000);
        const newUser = {
          id: generatedId,
          nombre: walkInNombre.trim(),
          apellido: walkInApellido.trim(),
          email: walkInEmail.trim().toLowerCase(),
          telefono: walkInTelefono.trim(),
          documento: walkInDocumento.trim(),
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=facearea&facepad=2&q=80',
          rol: 'cliente' as const,
          fechaRegistro: new Date().toISOString().split('T')[0],
          estado: 'activo' as const,
          password: genPassword
        };

        if (onRegisterUser) {
          await onRegisterUser(newUser);
        }
        targetGuestId = generatedId;
      }
    } else {
      if (!selectedGuestId) {
        alert('Por favor selecciona un huésped existente de la lista.');
        return;
      }
      targetGuestId = selectedGuestId;
    }

    // Now construct the reservation
    const generatedResId = 'RES-' + Math.floor(10000 + Math.random() * 90000);

    const newRes = {
      id: generatedResId,
      hotelId: receptionistHotel.id,
      roomId: bookRoomId,
      guestId: targetGuestId,
      fechaEntrada: bookCheckIn,
      fechaSalida: bookCheckOut,
      serviciosAdicionales: [],
      subtotal: calculatedSubtotal,
      impuestos: calculatedImpuestos,
      total: calculatedTotal,
      qrCode: 'PRESENTIAL-' + Date.now(),
      estado: bookStatus, // confirmada or ocupada
      fechaRegistro: new Date().toISOString().split('T')[0],
      notas: bookNotas.trim() || 'Reserva ingresada presencialmente por Taquilla de recepción.',
      recepcionistaId: activeUser.id
    };

    if (onCreateReservation) {
      await onCreateReservation(newRes);
      
      // If bookStatus is immediately 'ocupada' (instant checkin), trigger checkout/checkin logic or status update
      if (bookStatus === 'ocupada') {
        onUpdateRoomStatus(bookRoomId, 'ocupado');
      }

      setResSuccessMsg(`¡Reserva presencial ${generatedResId} creada de forma exitosa!`);
      onAddLog('Reserva Presencial', `Se registró la reserva presencial N° ${generatedResId} para la Habitación ${selectedRoom?.numero}`);
      
      // Reset walk-in form
      setWalkInNombre('');
      setWalkInApellido('');
      setWalkInEmail('');
      setWalkInTelefono('');
      setWalkInDocumento('');
      setBookRoomId('');
      setBookNotas('');
      setSelectedGuestId('');
    } else {
      alert('Error en la integración de la base de datos al guardar la reserva.');
    }
  };

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
            <div className={`bg-neutral-950 border border-neutral-800 rounded-2xl h-56 relative overflow-hidden flex flex-col items-center justify-center ${useRealCamera ? 'p-0' : 'p-4'}`}>
              
              {useRealCamera ? (
                // Real Live camera reader
                <div className="w-full h-full p-0 relative flex flex-col justify-end bg-black">
                  <div id="qr-camera-element" className="w-full h-full object-cover" />
                  
                  {/* Camera overlays & controls */}
                  <div className="absolute top-2 left-2 text-[8px] bg-red-600 text-white font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse z-15">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>LENTE ACTIVO (CAPACITOR/WEB)</span>
                  </div>
                  
                  {cameras.length > 1 && (
                    <div className="absolute top-2 right-2 flex gap-1 z-15">
                      <select 
                        value={activeCamId}
                        onChange={(e) => {
                          setActiveCamId(e.target.value);
                          startRealCamera(e.target.value);
                        }}
                        className="bg-neutral-900/90 hover:bg-neutral-800 text-[9px] text-white font-semibold font-mono rounded border border-neutral-750 px-1 py-0.5 focus:outline-none"
                      >
                        {cameras.map((c, idx) => (
                          <option key={c.id} value={c.id}>Cámara {idx + 1}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button 
                    onClick={stopRealCamera}
                    type="button"
                    className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-neutral-900 hover:bg-neutral-850 text-red-400 text-[9px] font-bold tracking-wider px-3 py-1.5 rounded-lg border border-neutral-800 focus:outline-none transition-all duration-150 z-20 cursor-pointer flex items-center gap-1 shadow-md uppercase"
                  >
                    <span>Cerrar Cámara ✖</span>
                  </button>
                </div>
              ) : isScanning ? (
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
                    type="button"
                    className="px-2.5 py-1 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                // Default IDLE scanner screen
                <div className="text-center space-y-3 p-4">
                  <div className="w-16 h-16 border-2 border-dashed border-neutral-700 rounded-xl flex items-center justify-center text-neutral-600 mx-auto">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 font-bold">¡Lente sensor listo!</p>
                    <p className="text-[9px] text-neutral-600 mt-1">Busque manual, use demostración o active cámara:</p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => startRealCamera()}
                      type="button"
                      className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-450 text-neutral-950 font-extrabold text-[10px] rounded-lg shadow-md uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto border border-teal-400"
                    >
                      <span>📸 Iniciar Cámara Real</span>
                    </button>
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

              <button
                type="button"
                onClick={() => startRealCamera()}
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 hover:text-white text-neutral-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-750"
              >
                📸 Escanear QR con Cámara
              </button>

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

        {/* INTERACTIVE CALENDAR: arrivals & availability tracking */}
        <div className="animate-fade-in duration-300">
          <RoomReservationCalendar
            hotels={hotels}
            rooms={rooms}
            reservations={reservations}
            users={users}
            activeUser={activeUser}
            onUpdateRoomStatus={onUpdateRoomStatus}
          />
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
                <option key={h.id} value={h.id}>{h.nombre.replace('Aura ', '').replace('Roomia ', '')}</option>
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
                        onChange={(e) => {
                          const nextStatus = e.target.value as RoomStatus;
                          if (room.estado === 'ocupado' && nextStatus !== 'ocupado') {
                            setCheckoutWarningRoom(room);
                          } else {
                            onUpdateRoomStatus(room.id, nextStatus);
                          }
                        }}
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

        {/* MODULO REGISTRO PRESENCIAL (WALK-IN) */}
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

            {/* New Guest Field Set */}
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
                    <label className="text-[10px] font-bold text-neutral-500 block mb-1">Cédula / Documentado *</label>
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
                {selectedRoom && selectedRoom.estado !== 'disponible' && (
                  <p className="text-[10px] font-semibold text-amber-600 mt-1">
                    ⚠️ Advertencia: El aposento no figura como Disponible.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Fecha Entrada *</label>
                  <input
                    type="date"
                    required
                    value={bookCheckIn}
                    onChange={(e) => setBookCheckIn(e.target.value)}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Fecha Salida *</label>
                  <input
                    type="date"
                    required
                    value={bookCheckOut}
                    onChange={(e) => setBookCheckOut(e.target.value)}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">Estado Reserva</label>
                  <select
                    value={bookStatus}
                    onChange={(e) => setBookStatus(e.target.value as 'confirmada' | 'ocupada')}
                    className="w-full text-xs border border-neutral-250 rounded-lg p-1.5 focus:ring-1 focus:ring-teal-500 bg-white cursor-pointer text-neutral-800"
                  >
                    <option value="confirmada">Confirmada</option>
                    <option value="ocupada">Ingreso Inmediato (Check-In)</option>
                  </select>
                </div>
                <div className="bg-slate-900 rounded-xl p-2.5 text-right text-white space-y-0.5 shadow-inner">
                  <span className="text-[9px] text-slate-400 font-medium block">Total Estimado ({nights} N):</span>
                  <p className="text-[11px] text-[#6ECCAF] font-bold font-mono">${calculatedTotal} USD <span className="text-[8px] text-slate-400 font-sans block leading-none">(Impuestos inc)</span></p>
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

            <button
              type="submit"
              className="w-full bg-[#344D67] hover:bg-[#1E2E3E] text-[#6ECCAF] font-bold py-2.5 rounded-xl text-xs transition-all tracking-wide cursor-pointer shadow-md select-none text-center active:scale-95"
            >
              Registrar Reserva Presencial 🛎️📝
            </button>
          </form>
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

      {/* CHECK-OUT MANDATORY WARNING MODAL */}
      {checkoutWarningRoom && (
        <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-neutral-100 p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-neutral-900 text-sm">Operación Restringida: Check-Out</h4>
                <p className="text-[10px] text-neutral-400 font-medium">Procedimiento de Auditoría Requerido</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed font-sans">
              La habitación <strong className="text-neutral-800">N° {checkoutWarningRoom.numero}</strong> correspondiente a <strong className="text-neutral-800">"{checkoutWarningRoom.nombre}"</strong> actualmente se encuentra registrada bajo el estado <strong className="text-[10px] bg-amber-50 text-amber-850 px-1.5 py-0.5 rounded font-bold uppercase border border-amber-200">Ocupado</strong>.
            </p>
            
            <p className="text-xs text-neutral-600 leading-relaxed font-sans">
              Para cambiar el estado de este aposento, las normas hoteleras requieren obligatoriamente que se procese su <strong className="text-neutral-800">Check-Out</strong> formal desde la taquilla de recepción para liquidar saldos pendientes, timbrar facturación y transicionar higiénicamente a mantenimiento.
            </p>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[10px] text-zinc-650 leading-normal font-mono">
              💡 Por favor, diríjase a la columna de la izquierda para buscar al huésped y procesar la facturación de Check-Out.
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setCheckoutWarningRoom(null)}
                className="w-full px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm text-center transition-colors"
              >
                Entendido, regresar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
