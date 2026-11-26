/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus, ReservationStatus, RoomPriceVariation, ExternalBlock } from '../types';
import { Coffee, AlertTriangle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ActivityLog } from '../store';
import { fullPropertyRoomId } from '../utils/availability';
import { addMonths, formatRentalMonths, getRentalMinMonths, isRentalProperty, rentalPricing } from '../utils/rental';
import ReceptionCheckInModule from './ReceptionCheckInModule';
import ReceptionRegistroModule from './ReceptionRegistroModule';
import ReceptionIncidenciasModule from './ReceptionIncidenciasModule';
import { notify } from '../utils/notify';
import { Button, Modal, SelectPicker, Badge } from './ui';
import { addIva, splitIncludedIva } from '../utils/tax';

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
  onCreateReservation?: (newRes: Reservation) => void | Promise<boolean | void>;
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
  externalBlocks?: ExternalBlock[];
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
  logs = [],
  externalBlocks = []
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

        // Por defecto se usa la cámara trasera; un lente concreto solo cuando el usuario lo elige
        let currentCamSelection: any = targetCameraId || { facingMode: "environment" };
        if (targetCameraId) {
          setActiveCamId(targetCameraId);
        } else {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              setCameras(devices);
              const back = devices.find(d => /back|rear|trasera|environment|posterior/i.test(d.label || ''));
              setActiveCamId((back || devices[devices.length - 1]).id);
            }
          } catch (camErr) {
            console.warn("No se pudieron listar las cámaras; se usa la trasera por defecto:", camErr);
          }
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
  const [bookRoomIdRaw, setBookRoomId] = useState('');
  const [bookCheckIn, setBookCheckIn] = useState('');
  const [bookCheckOutRaw, setBookCheckOut] = useState('');
  const [bookNotas, setBookNotas] = useState('');

  // Alquiler de inmueble completo: solo se elige la fecha de inicio y el plazo en meses.
  // La unidad es la propiedad entera y la fecha de fin se calcula sola.
  const isRental = isRentalProperty(receptionistHotel);
  const rentalMinMonths = getRentalMinMonths(receptionistHotel);
  const [rentalMonths, setRentalMonths] = useState(rentalMinMonths);
  React.useEffect(() => {
    setRentalMonths(rentalMinMonths);
  }, [targetHotelId, rentalMinMonths]);

  const bookRoomId = isRental && receptionistHotel ? fullPropertyRoomId(receptionistHotel.id) : bookRoomIdRaw;
  const bookCheckOut = isRental ? addMonths(bookCheckIn, Math.max(rentalMonths, rentalMinMonths)) : bookCheckOutRaw;

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

  const rentalIvaAdded = receptionistHotel?.detallesInmueble?.adicionarIva !== undefined
    ? receptionistHotel.detallesInmueble.adicionarIva !== false
    : receptionistHotel?.adicionarIva !== false;
  const selectedRoom: Room | undefined = isRental && receptionistHotel
    ? {
        id: bookRoomId,
        hotelId: receptionistHotel.id,
        numero: 'Full',
        nombre: receptionistHotel.nombre,
        descripcion: receptionistHotel.descripcion,
        precio: receptionistHotel.detallesInmueble?.precio || 0,
        capacidad: (receptionistHotel.detallesInmueble?.habitaciones || 1) * 2,
        camas: receptionistHotel.detallesInmueble?.habitaciones || 1,
        tipo: 'Suite',
        imagenes: receptionistHotel.imagenes || [],
        servicios: receptionistHotel.servicios || [],
        estado: 'disponible',
        adicionarIva: rentalIvaAdded
      }
    : rooms.find(r => r.id === bookRoomId);

  let nights = 1;
  if (bookCheckIn && bookCheckOut) {
    const diff = new Date(bookCheckOut).getTime() - new Date(bookCheckIn).getTime();
    nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (nights <= 0) nights = 1;
  }

  const getWalkInServicesTotal = () => {
    if (!receptionistHotel) return 0;
    const detailedServices = receptionistHotel.serviciosDetallados || [];
    let sum = 0;
    walkInSelectedServices.forEach(srvId => {
      const srv = detailedServices.find(s => s.id === srvId);
      if (srv) {
        const count = walkInServicePeopleCount[srvId] || 1;
        const isPerDay = srv.tipoCobro === 'por_dia';
        sum += isPerDay ? srv.precio * count * nights : srv.precio * count;
      }
    });
    return sum;
  };

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
  const rawRoomSubtotal = selectedRoom ? getBookingSubtotal(selectedRoom) : 0;
  const servicesSubtotal = getWalkInServicesTotal();

  let calculatedSubtotal = 0;
  let calculatedImpuestos = 0;
  let calculatedTotal = 0;

  if (!isIvaAddedForSelectedRoom) {
    const { base: roomSubtotalExcludingIva, iva: roomIva } = splitIncludedIva(rawRoomSubtotal);
    calculatedSubtotal = parseFloat((roomSubtotalExcludingIva + servicesSubtotal).toFixed(2));
    calculatedImpuestos = parseFloat(roomIva.toFixed(2));
    calculatedTotal = parseFloat((rawRoomSubtotal + servicesSubtotal).toFixed(2));
  } else {
    calculatedSubtotal = parseFloat((rawRoomSubtotal + servicesSubtotal).toFixed(2));
    calculatedImpuestos = addIva(calculatedSubtotal).iva;
    calculatedTotal = parseFloat((calculatedSubtotal + calculatedImpuestos).toFixed(2));
  }

  // Alquiler: al inicio se cobra la primera mensualidad + depósito de garantía (igual que en el portal)
  const rentalBilling = isRental && selectedRoom ? rentalPricing(selectedRoom.precio, rentalIvaAdded) : null;
  if (rentalBilling) {
    calculatedSubtotal = parseFloat(rentalBilling.subtotal.toFixed(2));
    calculatedImpuestos = parseFloat(rentalBilling.tax.toFixed(2));
    calculatedTotal = parseFloat(rentalBilling.total.toFixed(2));
  }

  const handleCreatePresencialRes = async (e: React.FormEvent) => {
    e.preventDefault();
    setResSuccessMsg('');

    if (!bookRoomId) {
      notify.warning('Selecciona una habitación.');
      return;
    }

    if (!receptionistHotel) {
      notify.error('Tu usuario no está vinculado a un establecimiento válido.');
      return;
    }

    if (isRental) {
      if (!bookCheckIn) {
        notify.warning('Selecciona la fecha de inicio del alquiler.');
        return;
      }
      if (rentalMonths < rentalMinMonths) {
        notify.warning(`El plazo mínimo de alquiler de esta propiedad es de ${formatRentalMonths(rentalMinMonths)}.`);
        return;
      }
      if (!selectedRoom || !selectedRoom.precio) {
        notify.warning('Esta propiedad no tiene un precio mensual definido. Edítala y agrega el precio antes de alquilarla.');
        return;
      }
    }

    if (!bookCheckIn || !bookCheckOut) {
      notify.warning('Selecciona las fechas de check-in y check-out.');
      return;
    }

    const dObj = new Date();
    const year = dObj.getFullYear();
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const day = String(dObj.getDate()).padStart(2, '0');
    const localTodayStr = `${year}-${month}-${day}`;

    if (bookCheckIn < localTodayStr) {
      notify.warning('La fecha de entrada no puede ser del pasado. Elige hoy o una fecha posterior.');
      return;
    }

    if (bookCheckOut <= bookCheckIn) {
      notify.warning('La fecha de salida debe ser posterior a la de entrada (mínimo 1 noche).');
      return;
    }

    const activeReservations = reservations.filter(res =>
      (isRental ? res.hotelId === receptionistHotel.id : res.roomId === bookRoomId) &&
      res.estado !== 'cancelada' &&
      res.estado !== 'finalizada'
    );

    const hasOverlap = activeReservations.some(res => 
      bookCheckIn < res.fechaSalida && bookCheckOut > res.fechaEntrada
    );

    if (hasOverlap) {
      notify.error(isRental
        ? 'La propiedad ya está alquilada o reservada dentro de ese período. Elige otra fecha de inicio o un plazo distinto.'
        : 'La habitación ya está reservada u ocupada en las fechas seleccionadas.');
      return;
    }

    // Fechas bloqueadas por Airbnb/Booking (calendario externo). La salida es exclusiva.
    const externalBlock = externalBlocks.find(b => b.roomId === bookRoomId && bookCheckIn < b.fechaFin && bookCheckOut > b.fechaInicio);
    if (externalBlock) {
      const platformName = externalBlock.platform === 'airbnb' ? 'Airbnb' : externalBlock.platform === 'booking' ? 'Booking.com' : 'otro calendario externo';
      notify.error(`Esas fechas están bloqueadas por ${platformName} (${externalBlock.fechaInicio} a ${externalBlock.fechaFin}).`);
      return;
    }

    let targetGuestId = '';

    if (resType === 'new') {
      if (!walkInNombre || !walkInApellido || !walkInEmail || !walkInTelefono || !walkInDocumento) {
        notify.warning('Completa todos los datos del huésped nuevo.');
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
        notify.warning('Selecciona un huésped de la lista.');
        return;
      }
      targetGuestId = selectedGuestId;
    }

    const generatedResId = 'RES-' + Math.floor(10000 + Math.random() * 90000);

    const detailedList = receptionistHotel.serviciosDetallados || [];
    const mappedServices = (isRental ? [] : walkInSelectedServices).map(srvId => {
      const srv = detailedList.find(s => s.id === srvId);
      if (srv) {
        const count = walkInServicePeopleCount[srvId] || 1;
        const isPerDay = srv.tipoCobro === 'por_dia';
        const total = isPerDay ? srv.precio * count * nights : srv.precio * count;
        const detailStr = isPerDay ? `${count} pers x ${nights} ${nights === 1 ? 'día' : 'días'}` : `${count} pers`;
        return `${srv.nombre} (${detailStr} - $${total.toFixed(2)})`;
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
      notas: isRental
        ? `Alquiler por ${formatRentalMonths(rentalMonths)} registrado presencialmente.${bookNotas.trim() ? ' ' + bookNotas.trim() : ''}`
        : (bookNotas.trim() || 'Reserva ingresada presencialmente por Taquilla de recepción.'),
      recepcionistaId: activeUser.id
    };

    if (onCreateReservation) {
      const created = await onCreateReservation(newRes);
      if (created === false) {
        notify.error('La habitación ya no está disponible en las fechas seleccionadas. Elige otro rango de fechas.');
        return;
      }

      if (bookStatus === 'ocupada' && !isRental) {
        onUpdateRoomStatus(bookRoomId, 'ocupado');
      }

      if (isRental) {
        setResSuccessMsg(`¡Alquiler ${generatedResId} registrado de forma exitosa! (${formatRentalMonths(rentalMonths)}, del ${bookCheckIn} al ${bookCheckOut})`);
        onAddLog('Reserva Presencial', `Se registró el alquiler presencial N° ${generatedResId} de la Propiedad "${receptionistHotel.nombre}" por ${formatRentalMonths(rentalMonths)}`);
        setBookCheckIn('');
        setRentalMonths(rentalMinMonths);
      } else {
        setResSuccessMsg(`¡Reserva presencial ${generatedResId} creada de forma exitosa!`);
        onAddLog('Reserva Presencial', `Se registró la reserva presencial N° ${generatedResId} para la Habitación ${selectedRoom?.numero}`);
      }

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
      notify.error('No pudimos guardar la reserva. Revisa tu conexión e inténtalo de nuevo.');
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
      notify.success('Check-in registrado. La habitación ahora está ocupada.');
    } else {
      notify.warning(res.msg);
    }
  };

  // Process Check-Out
  const handleCheckOut = (resId: string) => {
    const res = onPerformCheckOut(resId, activeUser.id);
    if (res.success) {
      setScannedResult(null);
      setScannedResId(null);
      notify.success('Check-out completado. La habitación pasó a mantenimiento.');
    } else {
      notify.warning(res.msg);
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
    if (!incidentText.trim()) return;
    const isPropertyHotel = receptionistHotel?.tipoEstablecimiento === 'casa' || receptionistHotel?.tipoEstablecimiento === 'departamento';

    if (isPropertyHotel) {
      // Las propiedades se alquilan completas: la incidencia se registra para toda la propiedad
      onAddLog('Incidencia Registrada', `Propiedad "${receptionistHotel.nombre}": ${incidentText.trim()}`);
    } else {
      if (!incidentRoomId) return;
      const target = rooms.find(r => r.id === incidentRoomId);
      if (!target) return;
      onUpdateRoomStatus(incidentRoomId, 'mantenimiento');
      onAddLog('Incidencia Registrada', `Habitación N° ${target.numero} puesta en mantenimiento por "${incidentText}"`);
    }

    setIncidentSubmitted(true);
    setIncidentText('');
    setTimeout(() => {
      setIncidentSubmitted(false);
      setIncidentRoomId('');
    }, 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8" id="reception-view-layout">
      
      {/* Encabezado de recepción: mismo formato que el panel de administración */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-bold text-brand-navy1">{getTabLabel()}</h3>
            <Badge tone="success">Recepción</Badge>
          </div>
          <p className="text-sm text-neutral-500">Atiende {activeUser.nombre} {activeUser.apellido} en {receptionistHotel?.nombre}</p>
        </div>
        {activeUser.rol === 'super_admin' && (
          <SelectPicker label="Establecimiento" showLabel className="w-full sm:w-72"
            value={selectedHotelFilter}
            onChange={(e) => setSelectedHotelFilter(e.target.value)}
          >
            {hotels.map(h => (
              <option key={h.id} value={h.id}>
                {h.nombre} ({h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento' ? 'Propiedad' : 'Hotel'})
              </option>
            ))}
          </SelectPicker>
        )}
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
          externalBlocks={externalBlocks}
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
          isRental={isRental}
          rentalMonths={rentalMonths}
          setRentalMonths={setRentalMonths}
          rentalMinMonths={rentalMinMonths}
          rentalBilling={rentalBilling}
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
        <Modal
          open
          onClose={() => setCheckoutWarningRoom(null)}
          size="md"
          title="Check-out pendiente"
          subtitle="Antes de cambiar el estado de la habitación"
          footer={
            <Button type="button" onClick={() => setCheckoutWarningRoom(null)} variant="primary" size="md" className="w-full">
              Entendido
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-warning-50 p-2.5">
                <AlertTriangle className="h-6 w-6 text-warning-600" />
              </div>
              <p className="text-sm font-semibold text-neutral-900">Esta habitación está ocupada</p>
            </div>
            <p className="text-sm leading-relaxed text-neutral-600">
              La habitación <strong className="text-neutral-900">N° {checkoutWarningRoom.numero}</strong> ({checkoutWarningRoom.nombre}) está registrada como <strong className="text-neutral-900">ocupada</strong>.
              Para cambiar su estado primero debes procesar el <strong className="text-neutral-900">check-out</strong> del huésped desde recepción: así se liquidan los saldos pendientes y se emite la factura.
            </p>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-normal text-neutral-600">
              Ve a la sección de Check-In, busca al huésped y procesa su check-out.
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
