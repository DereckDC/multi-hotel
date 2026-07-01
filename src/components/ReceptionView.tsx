/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus, ReservationStatus, RoomPriceVariation } from '../types';
import { Coffee, AlertTriangle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ActivityLog } from '../store';
import ReceptionCheckInModule from './ReceptionCheckInModule';
import ReceptionRegistroModule from './ReceptionRegistroModule';
import ReceptionIncidenciasModule from './ReceptionIncidenciasModule';

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
  onUpdateReservationStatus?: (
    resId: string,
    status: ReservationStatus,
    staffName?: string,
    staffRole?: string,
    mensajeCambio?: string
  ) => void;
  roomPriceVariations?: RoomPriceVariation[];
  activeTab?: 'checkin' | 'registro' | 'incidencias';
  logs?: ActivityLog[];
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
  onRegisterUser,
  onUpdateReservationStatus,
  roomPriceVariations = [],
  activeTab = 'checkin',
  logs = []
}: ReceptionViewProps) {
  const getTabLabel = () => {
    switch (activeTab) {
      case 'checkin':
        return 'Check-In / QR';
      case 'registro':
        return 'Registro / Walk-In';
      case 'incidencias':
        return 'Incidencias';
      default:
        return 'General';
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotelFilter, setSelectedHotelFilter] = useState(() => {
    // Pre-select assigned hotel, otherwise let super admin choose
    return activeUser.hotelId || (hotels[0]?.id || '');
  });

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
  const startRealCamera = async (cameraId?: any) => {
    const targetCameraId = (typeof cameraId === 'string' && cameraId) ? cameraId : undefined;
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

    // Explicitly request camera permissions from the browser/webview OS layer.
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (permErr: any) {
      console.warn("Explicit permission request caught error or denied:", permErr);
      if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError' || String(permErr).includes('denied')) {
        setScanError("Acceso a la cámara denegado. Por favor, concede permisos de cámara en la configuración de la app o de tu dispositivo para poder realizar la lectura QR.");
        setUseRealCamera(false);
        return;
      }
    }

    setTimeout(async () => {
      try {
        const scannerElement = document.getElementById('qr-camera-element');
        if (!scannerElement) {
          throw new Error("Contenedor de cámara no encontrado");
        }

        const html5QrCode = new Html5Qrcode("qr-camera-element");
        html5QrCodeRef.current = html5QrCode;

        // Fetch cameras using Html5Qrcode
        let currentCamSelection: any = targetCameraId || activeCamId;
        if (!currentCamSelection) {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              setCameras(devices);
              currentCamSelection = devices[0].id;
              setActiveCamId(currentCamSelection);
            } else {
              currentCamSelection = { facingMode: "environment" };
            }
          } catch (camErr) {
            console.warn("Listing cameras failed. Using high-compatibility constraints fallback:", camErr);
            currentCamSelection = { facingMode: "environment" };
          }
        } else if (targetCameraId) {
          setActiveCamId(targetCameraId);
        }

        await html5QrCode.start(
          currentCamSelection,
          {
            fps: 20
          },
          (decodedText) => {
            console.log("Real QR code scanned successfully:", decodedText);
            completeScan(decodedText);
            stopRealCamera();
          },
          () => {} // silent frame reject errors
        );
      } catch (err: any) {
        console.error("Error starting camera qr scanner:", err);
        setScanError(`No se pudo arrancar la cámara: ${err.message || String(err)}.`);
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

  // Resolve target hotel ID based on role permissions
  const targetHotelId = activeUser.rol === 'super_admin' 
    ? (selectedHotelFilter || (activeUser.hotelId || (hotels[0]?.id || '')))
    : (activeUser.hotelId || (hotels[0]?.id || ''));

  // Auto-assign active hotel state based on resolved target ID
  const receptionistHotel = hotels.find(h => h.id === targetHotelId) || hotels[0];

  const hotelRooms = rooms.filter(r => r.hotelId === targetHotelId);

  const hotelIncidents = React.useMemo(() => {
    return logs.filter(log => {
      const actionLower = log.action.toLowerCase();
      const detailsLower = log.detalles.toLowerCase();
      
      const isIncident = actionLower.includes('incidencia') || 
                         detailsLower.includes('incidencia') || 
                         (detailsLower.includes('mantenimiento') && detailsLower.includes('habitación'));
      
      if (!isIncident) return false;
      
      const matchesRoom = rooms.some(r => {
        if (r.hotelId !== targetHotelId) return false;
        return detailsLower.includes(`habitación n° ${r.numero}`) || 
               detailsLower.includes(`habitación ${r.numero}`) || 
               detailsLower.includes(`habit. ${r.numero}`) || 
               detailsLower.includes(r.id.toLowerCase());
      });
      
      return matchesRoom || detailsLower.includes(targetHotelId.toLowerCase()) || (receptionistHotel && detailsLower.includes(receptionistHotel.nombre.toLowerCase()));
    });
  }, [logs, rooms, targetHotelId, receptionistHotel]);

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
  const [bookCheckIn, setBookCheckIn] = useState('');
  const [bookCheckOut, setBookCheckOut] = useState('');
  const [bookNotas, setBookNotas] = useState('');

  // Limpiar fechas de check-in / check-out cuando cambie de habitación o de hotel
  React.useEffect(() => {
    setBookCheckIn('');
    setBookCheckOut('');
  }, [bookRoomId, targetHotelId]);

  const [bookStatus, setBookStatus] = useState<'confirmada' | 'ocupada'>('confirmada');
  const [resSuccessMsg, setResSuccessMsg] = useState('');

  // Walk-in extra services selection
  const [walkInSelectedServices, setWalkInSelectedServices] = useState<string[]>([]);
  const [walkInServicePeopleCount, setWalkInServicePeopleCount] = useState<Record<string, number>>({});

  const getWalkInServicesTotal = () => {
    if (!receptionistHotel) return 0;
    const detailedServices = receptionistHotel.serviciosDetallados || [];
    let sum = 0;
    walkInSelectedServices.forEach(srvId => {
      const srv = detailedServices.find(s => s.id === srvId);
      if (srv) {
        const count = walkInServicePeopleCount[srvId] || 1;
        sum += srv.precio * count;
      }
    });
    return sum;
  };

  const selectedRoom = rooms.find(r => r.id === bookRoomId);
  
  let nights = 1;
  if (bookCheckIn && bookCheckOut) {
    const diff = new Date(bookCheckOut).getTime() - new Date(bookCheckIn).getTime();
    nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (nights <= 0) nights = 1;
  }

  const getRoomPriceForDate = (room: Room, dateStr: string) => {
    const exactMatch = roomPriceVariations.find(v => {
      if (v.roomId !== room.id) return false;
      if (v.isWeekend) return false;
      if (!v.fecha) return false;
      if (v.fecha === dateStr) return true;
      if (v.isAlways && v.fecha.substring(5) === dateStr.substring(5)) return true;
      return false;
    });

    if (exactMatch) {
      return { precio: exactMatch.precio, motivo: exactMatch.motivo || 'Fecha Especial', isVariable: true };
    }
    
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay(); // 5: Friday, 6: Saturday
    if (day === 5 || day === 6) {
      const wkMatch = roomPriceVariations.find(v => v.roomId === room.id && v.isWeekend);
      if (wkMatch) {
        return { precio: wkMatch.precio, motivo: wkMatch.motivo || 'Tarifa de Fin de Semana', isVariable: true };
      }
    }
    
    return { precio: room.precio, motivo: 'Tarifa Estándar', isVariable: false };
  };

  const getBookingNightsBreakdown = (room: Room, checkIn: string, checkOut: string) => {
    if (!room || !checkIn || !checkOut) return [];
    
    const nightsBreakdown: { date: string; precio: number; motivo: string; isVariable?: boolean }[] = [];
    const start = new Date(checkIn + 'T12:00:00');
    const end = new Date(checkOut + 'T12:00:00');
    
    const current = new Date(start);
    while (current < end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const { precio, motivo, isVariable } = getRoomPriceForDate(room, dateStr);
      nightsBreakdown.push({ date: dateStr, precio, motivo, isVariable });
      
      current.setDate(current.getDate() + 1);
    }
    
    if (nightsBreakdown.length === 0) {
      nightsBreakdown.push({ date: checkIn, precio: room.precio, motivo: 'Tarifa Estándar', isVariable: false });
    }
    
    return nightsBreakdown;
  };

  const getBookingSubtotal = (room: Room) => {
    if (room && bookCheckIn && bookCheckOut) {
      const breakdown = getBookingNightsBreakdown(room, bookCheckIn, bookCheckOut);
      return breakdown.reduce((sum, n) => sum + n.precio, 0);
    }
    return (room ? room.precio : 0) * nights;
  };

  const isIvaAddedForSelectedRoom = selectedRoom ? (selectedRoom.adicionarIva !== false) : true;
  const calculatedSubtotal = (selectedRoom ? getBookingSubtotal(selectedRoom) : 0) + getWalkInServicesTotal();
  const calculatedImpuestos = isIvaAddedForSelectedRoom ? parseFloat((calculatedSubtotal * 0.12).toFixed(2)) : 0;
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

    if (!bookCheckIn || !bookCheckOut) {
      alert('Por favor selecciona las fechas de check-in y check-out.');
      return;
    }

    const dObj = new Date();
    const year = dObj.getFullYear();
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const day = String(dObj.getDate()).padStart(2, '0');
    const localTodayStr = `${year}-${month}-${day}`;

    if (bookCheckIn < localTodayStr) {
      alert('La fecha de entrada no puede ser del pasado. Debe ser hoy o una fecha posterior.');
      return;
    }

    if (bookCheckOut <= bookCheckIn) {
      alert('La fecha de salida debe ser estrictamente posterior a la de entrada (mínimo 1 noche).');
      return;
    }

    const activeReservations = reservations.filter(res => 
      res.roomId === bookRoomId &&
      res.estado !== 'cancelada' &&
      res.estado !== 'finalizada'
    );

    const hasOverlap = activeReservations.some(res => 
      bookCheckIn < res.fechaSalida && bookCheckOut > res.fechaEntrada
    );

    if (hasOverlap) {
      alert('❌ Error: La habitación ya está reservada u ocupada en las fechas seleccionadas.');
      return;
    }

    let targetGuestId = '';

    if (resType === 'new') {
      if (!walkInNombre || !walkInApellido || !walkInEmail || !walkInTelefono || !walkInDocumento) {
        alert('Por favor completa todos los campos del huésped nuevo.');
        return;
      }

      const matchedUser = users.find(u => u.email.toLowerCase() === walkInEmail.toLowerCase());
      if (matchedUser) {
        targetGuestId = matchedUser.id;
      } else {
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

    const generatedResId = 'RES-' + Math.floor(10000 + Math.random() * 90000);

    const detailedList = receptionistHotel.serviciosDetallados || [];
    const mappedServices = walkInSelectedServices.map(srvId => {
      const srv = detailedList.find(s => s.id === srvId);
      if (srv) {
        const count = walkInServicePeopleCount[srvId] || 1;
        const total = srv.precio * count;
        return `${srv.nombre} (${count} pers - $${total})`;
      }
      return srvId;
    });

    const newRes = {
      id: generatedResId,
      hotelId: receptionistHotel.id,
      roomId: bookRoomId,
      guestId: targetGuestId,
      fechaEntrada: bookCheckIn,
      fechaSalida: bookCheckOut,
      serviciosAdicionales: mappedServices,
      subtotal: calculatedSubtotal,
      impuestos: calculatedImpuestos,
      total: calculatedTotal,
      qrCode: 'PRESENTIAL-' + Date.now(),
      estado: bookStatus,
      fechaRegistro: new Date().toISOString().split('T')[0],
      notas: bookNotas.trim() || 'Reserva ingresada presencialmente por Taquilla de recepción.',
      recepcionistaId: activeUser.id
    };

    if (onCreateReservation) {
      await onCreateReservation(newRes);
      
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
      setWalkInSelectedServices([]);
      setWalkInServicePeopleCount({});
    } else {
      alert('Error en la integración de la base de datos al guardar la reserva.');
    }
  };

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
      if (activeUser.rol === 'recepcionista' && targetRes.hotelId !== activeUser.hotelId) {
        setScanError('no se encuentra la reservacion');
        setScannedResult(null);
        return;
      }
      setScannedResult(targetRes);
      onAddLog('Lectura QR', `Lectura QR de reserva "${targetRes.id}" exitoso.`);
    } else {
      setScanError('no se encuentra la reservacion');
    }
  };

  // Process Check-In
  const handleCheckIn = (resId: string) => {
    const res = onPerformCheckIn(resId, activeUser.id);
    if (res.success) {
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
  const handleManualSearch = () => {
    if (!searchQuery) return;
    const cleanQuery = searchQuery.trim().toUpperCase();
    
    const res = reservations.find(r => r.id.toUpperCase() === cleanQuery || r.qrCode.toUpperCase() === cleanQuery);
    if (res) {
      if (activeUser.rol === 'recepcionista' && res.hotelId !== activeUser.hotelId) {
        setScanError('no se encuentra la reservacion');
        setScannedResult(null);
        return;
      }
      setScannedResult(res);
      setScanError(null);
    } else {
      setScanError('no se encuentra la reservacion');
      setScannedResult(null);
    }
  };

  // Submit Room Incident
  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentRoomId || !incidentText) return;
    const target = rooms.find(r => r.id === incidentRoomId);
    if (!target) return;

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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8" id="reception-view-layout">
      
      {/* RECEPTION BANNER */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 flex items-center justify-center rounded-2xl border border-teal-100 shrink-0">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-teal-600 tracking-wider">MÓDULO DE RECEPCIÓN</span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <h3 className="text-xl font-bold text-neutral-800">Mostrador - {getTabLabel()}</h3>
              {activeUser.rol === 'super_admin' && (
                <select
                  value={selectedHotelFilter}
                  onChange={(e) => setSelectedHotelFilter(e.target.value)}
                  className="sm:ml-2 border border-neutral-250 text-[11px] font-bold py-1 px-2 rounded-lg focus:outline-none bg-neutral-50 shadow-sm cursor-pointer text-teal-700 hover:border-teal-500 transition-colors"
                >
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nombre} ({h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento' ? 'Propiedad' : 'Hotel'})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-neutral-400">Atendido por {activeUser.nombre} {activeUser.apellido} en {receptionistHotel?.nombre}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-100 uppercase">Operativo</span>
        </div>
      </div>

      {/* RENDER ACTIVE MODULES CONDITIONALLY */}
      {activeTab === 'checkin' && (
        <ReceptionCheckInModule
          rooms={rooms}
          reservations={reservations}
          users={users}
          targetHotelId={targetHotelId}
          receptionistHotel={receptionistHotel}
          hotelRooms={hotelRooms}
          isScanning={isScanning}
          scanProgress={scanProgress}
          scannedResult={scannedResult}
          scanError={scanError}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          useRealCamera={useRealCamera}
          cameras={cameras}
          activeCamId={activeCamId}
          handleManualSearch={handleManualSearch}
          handleSimulateScan={handleSimulateScan}
          startRealCamera={startRealCamera}
          stopRealCamera={stopRealCamera}
          switchCamera={startRealCamera}
          handleCheckIn={handleCheckIn}
          handleCheckOut={handleCheckOut}
          onUpdateReservationStatus={onUpdateReservationStatus}
          onAddLog={onAddLog}
          activeUser={activeUser}
          onUpdateRoomStatus={onUpdateRoomStatus}
          setCheckoutWarningRoom={setCheckoutWarningRoom}
          setScannedResult={setScannedResult}
        />
      )}

      {activeTab === 'registro' && (
        <ReceptionRegistroModule
          hotels={hotels}
          rooms={rooms}
          reservations={reservations}
          users={users}
          activeUser={activeUser}
          targetHotelId={targetHotelId}
          receptionistHotel={receptionistHotel}
          roomPriceVariations={roomPriceVariations}
          onUpdateRoomStatus={onUpdateRoomStatus}
          resType={resType}
          setResType={setResType}
          walkInNombre={walkInNombre}
          setWalkInNombre={setWalkInNombre}
          walkInApellido={walkInApellido}
          setWalkInApellido={setWalkInApellido}
          walkInEmail={walkInEmail}
          setWalkInEmail={setWalkInEmail}
          walkInTelefono={walkInTelefono}
          setWalkInTelefono={setWalkInTelefono}
          walkInDocumento={walkInDocumento}
          setWalkInDocumento={setWalkInDocumento}
          selectedGuestId={selectedGuestId}
          setSelectedGuestId={setSelectedGuestId}
          bookRoomId={bookRoomId}
          setBookRoomId={setBookRoomId}
          bookCheckIn={bookCheckIn}
          setBookCheckIn={setBookCheckIn}
          bookCheckOut={bookCheckOut}
          setBookCheckOut={setBookCheckOut}
          walkInSelectedServices={walkInSelectedServices}
          setWalkInSelectedServices={setWalkInSelectedServices}
          walkInServicePeopleCount={walkInServicePeopleCount}
          setWalkInServicePeopleCount={setWalkInServicePeopleCount}
          bookStatus={bookStatus}
          setBookStatus={setBookStatus}
          bookNotas={bookNotas}
          setBookNotas={setBookNotas}
          nights={nights}
          calculatedTotal={calculatedTotal}
          isIvaAddedForSelectedRoom={isIvaAddedForSelectedRoom}
          selectedRoom={selectedRoom}
          resSuccessMsg={resSuccessMsg}
          handleCreatePresencialRes={handleCreatePresencialRes}
        />
      )}

      {activeTab === 'incidencias' && (
        <ReceptionIncidenciasModule
          rooms={rooms}
          receptionistHotel={receptionistHotel}
          incidentRoomId={incidentRoomId}
          setIncidentRoomId={setIncidentRoomId}
          incidentText={incidentText}
          setIncidentText={setIncidentText}
          incidentSubmitted={incidentSubmitted}
          handleReportIncident={handleReportIncident}
          hotelIncidents={hotelIncidents}
        />
      )}

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
              💡 Por favor, diríjase a la sección de Check-In para buscar al huésped y procesar la facturación de Check-Out.
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
