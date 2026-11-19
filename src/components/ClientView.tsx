/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus, Review, RoomPriceVariation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getProvincesList, getCitiesForProvince, getParroquiasForCity } from '../data/ecuador';

import { MapPin, Calendar, Compass, List, CreditCard, ChevronRight, Filter, Check, ArrowUpDown, BedDouble, Users as UsersIcon, Tag, MessageCircle, DollarSign, Star, AlertCircle, Eye, Trash2, CalendarCheck, FileText, X, Building2, ShieldCheck, Lock, Home, Search, User as UserIcon, Loader2, ArrowRight, ArrowLeft, CheckCircle2, ChevronLeft, Info } from 'lucide-react';
import QRView from './QRView';
import InvoicePDF from './InvoicePDF';
import { RoomImageGallery } from './RoomImageGallery';
import { HotelImageGallery } from './HotelImageGallery';
import { RoomReservationCalendar } from './RoomReservationCalendar';
import { CompactBookingCalendar } from './CompactBookingCalendar';
import { Pager, totalPagesOf } from './Pager';
import { onImageError } from '../utils/images';
import { addMonths, formatRentalMonths, getRentalMinMonths, rentalDurationOptions } from '../utils/rental';
import { supabase } from '../supabase';
import { isNativeApp } from '../utils/platform';
import { notify } from '../utils/notify';
import { formatYmd } from '../utils/invoiceData';
import { Button, HeaderBackButton, Modal, OptionPicker } from './ui';

type OnlinePaymentKind = 'reserva_abono' | 'reserva_total' | 'reserva_saldo';

/** Reserva en curso de un invitado, guardada mientras inicia sesión */
const BOOKING_DRAFT_KEY = 'roomia_reserva_en_curso';
const BOOKING_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
type BookingDraft = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  rentalMonths?: number;
  services?: string[];
  counts?: Record<string, number>;
  note?: string;
  savedAt: number;
};

/** Cobros en línea que admite la reserva (la función `payphone` vuelve a comprobarlo en el servidor) */
const onlinePaymentOptions = (res: Reservation): { kind: OnlinePaymentKind; label: string; amount: number }[] => {
  const pagado = res.montoPagado ?? 0;
  if (res.total <= 0) return [];
  if (res.estado === 'pendiente' && pagado <= 0) {
    return [
      { kind: 'reserva_abono', label: 'Pagar abono 20%', amount: Math.round(res.total * 20) / 100 },
      { kind: 'reserva_total', label: 'Pagar total', amount: res.total }
    ];
  }
  const saldo = res.montoPendiente ?? Math.max(0, res.total - pagado);
  if (['pendiente', 'confirmada', 'ocupada'].includes(res.estado) && pagado > 0 && saldo > 0) {
    return [{ kind: 'reserva_saldo', label: 'Pagar saldo', amount: saldo }];
  }
  return [];
};

export function getMapEmbedUrl(ubicacion: string, googleMapsUrl?: string): string {
  const cleanUrl = googleMapsUrl ? googleMapsUrl.trim() : '';
  const cleanUbicacion = ubicacion ? ubicacion.trim() : '';

  if (!cleanUrl && !cleanUbicacion) return '';

  // 1. Full iframe snippet <iframe src="...">
  if (cleanUrl.includes('<iframe')) {
    const match = cleanUrl.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 2. Direct Google Maps Embed URL
  if (cleanUrl.includes('google.com/maps/embed')) {
    return cleanUrl;
  }

  // 3. Extract coordinates inside any URL (e.g. @-0.18065,-78.46783 or ?q=-0.18065,-78.4678)
  const coordsMatch = cleanUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || cleanUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordsMatch && coordsMatch[1] && coordsMatch[2]) {
    return `https://maps.google.com/maps?q=${coordsMatch[1]},${coordsMatch[2]}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 4. Extract place title from place URL (e.g. /maps/place/Hotel+Hilton+Quito/...)
  const placeMatch = cleanUrl.match(/\/maps\/place\/([^/@?]+)/);
  if (placeMatch && placeMatch[1]) {
    const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 5. If cleanUbicacion is a physical address, prefer it for embed search query
  if (cleanUbicacion) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleanUbicacion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 6. Fallback if cleanUrl is plain text query
  if (cleanUrl && !cleanUrl.startsWith('http')) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleanUrl)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(cleanUbicacion || 'Quito, Ecuador')}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

function calculateTimeLeft(reservation: Reservation) {
  let createdMs: number;
  if (reservation.fechaRegistroTimestamp) {
    createdMs = new Date(reservation.fechaRegistroTimestamp).getTime();
  } else {
    createdMs = new Date(reservation.fechaRegistro + 'T00:00:00').getTime();
  }

  const expireMs = createdMs + 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const diffMs = expireMs - nowMs;

  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  return { hours, minutes, seconds, isExpired: false };
}

export function ReservationCountdown({ reservation }: { reservation: Reservation }) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(reservation));

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(reservation));
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation]);

  if (reservation.estado !== 'pendiente') return null;

  if (timeLeft.isExpired) {
    return (
      <div className="mx-4 mt-3 p-2.5 bg-danger-50 border border-danger-200 rounded-xl text-danger-800 text-micro font-semibold flex items-center gap-2 animate-pulse">
        <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
        <span>Tiempo límite de pago expirado (24h). La reservación se liberará automáticamente.</span>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="mx-4 mt-3 p-2.5 bg-warning-50/90 border border-warning-200/90 rounded-xl text-warning-900 text-micro font-semibold flex items-center justify-between gap-2 shadow-2xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-warning-500 animate-ping shrink-0" />
        <span className="truncate">Plazo de 24h para reportar pago:</span>
      </div>
      <span className="font-mono font-extrabold text-warning-900 text-xs bg-white px-2 py-0.5 rounded-lg border border-warning-200/80 shrink-0">
        {pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
      </span>
    </div>
  );
}

interface ClientViewProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  users?: User[];
  activeUser: User;
  onCreateReservation: (res: Reservation) => void | Promise<boolean | void>;
  onCancelReservation: (resId: string) => void;
  onDeleteReservation?: (resId: string) => void;
  transactions?: any[];
  onAddPaymentTransaction?: (tx: any) => void;
  onOpenHotelChange?: (hotelId: string | null) => void;
  reviews?: Review[];
  onSubmitReview?: (review: Review) => void;
  roomPriceVariations?: RoomPriceVariation[];
  onTriggerLogin?: () => void;
  onTriggerBookingAuth?: () => void;
  activeTab?: 'explore' | 'properties' | 'reservations';
  onActiveTabChange?: (tab: 'explore' | 'properties' | 'reservations') => void;
  openHotelId?: string | null;
  onRefreshCatalog?: () => Promise<boolean>;
  isLoading?: boolean;
}

const ADDITIONAL_SERVICES = [
  { id: 'breakfast', name: 'Desayuno Premium Orgánico', price: 15, desc: 'Ingredientes de granja locales servidos a la habitación', emoji: '🍳' },
  { id: 'spa', name: 'Pase de Acceso Completo al Spa', price: 25, desc: 'Masajes hidrotermales, sauna de vapor seco y toallas aromatizadas', emoji: '💆' },
  { id: 'airport', name: 'Traslado Terrestre Aeropuerto-Hotel', price: 30, desc: 'Conductor bilingüe privado en sedán eléctrico de lujo', emoji: '🚕' },
  { id: 'wifi', name: 'Pase de Oficina WiFi 6E Ultrawide', price: 10, desc: 'Canales ilimitados dedicados para streaming y co-working', emoji: '📶' }
];

export default function ClientView({
  hotels,
  rooms,
  reservations,
  users = [],
  activeUser,
  onCreateReservation,
  onCancelReservation,
  onDeleteReservation,
  transactions = [],
  onAddPaymentTransaction,
  onOpenHotelChange,
  reviews = [],
  onSubmitReview,
  roomPriceVariations = [],
  onTriggerLogin,
  onTriggerBookingAuth,
  activeTab: propActiveTab,
  onActiveTabChange,
  openHotelId,
  isLoading = false
}: ClientViewProps) {
  // Navigation Tabs: 'explore' | 'properties' | 'reservations'
  const [localActiveTab, setLocalActiveTab] = useState<'explore' | 'properties' | 'reservations'>('explore');
  const activeTabValue = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTabValue = (tab: 'explore' | 'properties' | 'reservations') => {
    if (onActiveTabChange) {
      onActiveTabChange(tab);
    } else {
      setLocalActiveTab(tab);
    }
  };
  const activeTab = activeTabValue;
  const setActiveTab = setActiveTabValue;

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedResForPayment, setSelectedResForPayment] = useState<Reservation | null>(null);

  // Selected Hotel details
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [roomPage, setRoomPage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);

  // Sync internal selectedHotelId with prop from parent
  React.useEffect(() => {
    if (openHotelId !== undefined) {
      setSelectedHotelId(openHotelId);
    }
  }, [openHotelId]);

  // Reset filters when changing/opening a hotel
  React.useEffect(() => {
    setRoomMaxPrice(1500);
    setRoomMaxPriceInput('1500');
    setRoomCapacity('');
    setRoomTypeFilter('');
  }, [selectedHotelId]);
  
  // Advanced Filter state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [bedsFilter, setBedsFilter] = useState<string>('todos');
  const [provinciaFilter, setProvinciaFilter] = useState<string>('todas');
  const [ciudadFilter, setCiudadFilter] = useState<string>('todas');
  const [parroquiaFilter, setParroquiaFilter] = useState<string>('todas');
  const [showOnlyAvailableRooms, setShowOnlyAvailableRooms] = useState<boolean>(false); // By default, show all rooms and browse, as requested by user
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('todos');

  // Detailed room list filters inside a hotel
  const [roomMaxPrice, setRoomMaxPrice] = useState<number>(1500);
  const [roomMaxPriceInput, setRoomMaxPriceInput] = useState<string>('1500');
  const [roomCapacity, setRoomCapacity] = useState<string>('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('');
  const [roomSortOrder, setRoomSortOrder] = useState<'asc' | 'desc' | ''>('');

  // States for review system
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedResForReview, setSelectedResForReview] = useState<Reservation | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComentario, setReviewComentario] = useState<string>('');
  const [isAnonymousReview, setIsAnonymousReview] = useState(false);

  // Date Helpers for today & minimum check-out date calculations
  const getTodayString = (offsetDays = 0) => {
    const date = new Date();
    if (offsetDays !== 0) {
      date.setDate(date.getDate() + offsetDays);
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getThreeMonthsLaterString = (baseDateStr: string) => {
    if (!baseDateStr) return '';
    const parts = baseDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month + 3, day);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDateAfterNMonths = (baseDateStr: string, monthsCount: number) => {
    return addMonths(baseDateStr, monthsCount);
  };

  // Pago en línea con la Cajita de Payphone: el servidor calcula el monto y crea el pago,
  // y se abre la página /pago/<id>. En el APK se abre en el navegador del teléfono (la Cajita
  // no funciona dentro de la app); se usa el dominio sin www para que Android no la devuelva a la app.
  const [onlinePayBusy, setOnlinePayBusy] = useState<string | null>(null);
  const [onlinePayError, setOnlinePayError] = useState<{ resId: string; message: string } | null>(null);

  const startOnlinePayment = async (res: Reservation, kind: OnlinePaymentKind) => {
    if (onlinePayBusy) return;
    setOnlinePayBusy(`${res.id}:${kind}`);
    setOnlinePayError(null);
    try {
      const { data, error } = await supabase.functions.invoke('payphone', {
        body: { action: 'prepare', reservationId: res.id, kind }
      });
      let paymentId: string | undefined = data?.paymentId;
      let message: string | undefined = data?.error;
      if (!paymentId && error && 'context' in error) {
        try { message = (await (error as any).context.json())?.error; } catch { /* sin cuerpo */ }
      }
      if (!paymentId) throw new Error(message || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
      const path = `/pago/${paymentId}`;
      if (isNativeApp()) {
        window.open(`https://roomiapms.site${path}`, '_blank');
      } else {
        window.location.assign(path);
      }
    } catch (err: any) {
      setOnlinePayError({ resId: res.id, message: err?.message || 'No se pudo iniciar el pago.' });
    } finally {
      setOnlinePayBusy(null);
    }
  };

  const renderOnlinePayButtons = (res: Reservation, size: 'sm' | 'lg') => {
    const options = onlinePaymentOptions(res);
    if (options.length === 0) return null;
    return (
      <div className={size === 'lg' ? 'space-y-2' : 'flex flex-wrap gap-2'}>
        {options.map(opt => {
          const busy = onlinePayBusy === `${res.id}:${opt.kind}`;
          return (
            <Button
              key={opt.kind}
              type="button"
              variant="primary"
              size={size === 'lg' ? 'md' : 'sm'}
              fullWidth={size === 'lg'}
              loading={busy}
              disabled={!!onlinePayBusy}
              onClick={() => startOnlinePayment(res, opt.kind)}
              leftIcon={busy ? undefined : <CreditCard className="w-3.5 h-3.5" />}
            >
              <span>{opt.label} (${opt.amount.toFixed(2)})</span>
            </Button>
          );
        })}
        {onlinePayError?.resId === res.id && (
          <p className="w-full text-micro text-danger-600 font-medium">{onlinePayError.message}</p>
        )}
      </div>
    );
  };

  const getMonthsCount = (d1: string, d2: string) => {
    if (!d1 || !d2) return 0;
    const start = new Date(d1 + 'T00:00:00');
    const end = new Date(d2 + 'T00:00:00');
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const dayDiff = end.getDate() - start.getDate();
    if (dayDiff > 0) {
      months += dayDiff / 30.44;
    } else if (dayDiff < 0) {
      months += dayDiff / 30.44;
    }
    return Math.max(0, months);
  };

  const getMinCheckOutDate = () => {
    if (!checkInDate) return getTodayString(1);

    if (bookingRoom) {
      const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
      const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
      if (isAlquiler) {
        return addMonths(checkInDate, getRentalMinMonths(bHotel));
      }
    }

    const parts = checkInDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const nextDay = new Date(year, month, day + 1);
    const yyyy = nextDay.getFullYear();
    const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDay.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Booking Flow modal state
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [checkOutDate, setCheckOutDate] = useState<string>('');
  const [rentalMonths, setRentalMonths] = useState<number>(3);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicePeopleCount, setServicePeopleCount] = useState<Record<string, number>>({});
  const [bookingNote, setBookingNote] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Reset booking Flow modal state and select options when chosen hotel/property changes to prevent leaking prior states
  React.useEffect(() => {
    setBookingRoom(null);
    setBookingStep(1);
    setSelectedServices([]);
    setServicePeopleCount({});
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedHotelId]);

  // Scroll a la parte superior cuando se selecciona/abre una habitación para consultar o reservar
  React.useEffect(() => {
    if (bookingRoom) {
      setBookingStep(1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [bookingRoom]);

  // Limpiar fechas cuando cambia de hotel o de habitación elegida, o preestablecer para alquileres de 3 meses
  React.useEffect(() => {
    if (bookingRoom) {
      const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
      const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
      if (isAlquiler) {
        const today = getTodayString(0);
        const minMonths = getRentalMinMonths(bHotel);
        setCheckInDate(today);
        setRentalMonths(minMonths);
        setCheckOutDate(addMonths(today, minMonths));
      } else {
        setCheckInDate('');
        setCheckOutDate('');
      }
    } else {
      setCheckInDate('');
      setCheckOutDate('');
    }
    setBookingError(null);
  }, [bookingRoom, selectedHotelId]);

  // Retomar la reserva que un invitado dejó a medias para iniciar sesión (la página se recarga).
  // Va en etapas porque al cambiar de hotel y de habitación los efectos de arriba limpian el formulario.
  const bookingDraftRef = React.useRef<BookingDraft & { hotelId: string; stage: 'hotel' | 'room' } | null>(null);

  React.useEffect(() => {
    if (activeUser.id === 'guest') return;
    if (!bookingDraftRef.current) {
      let draft: BookingDraft | null = null;
      try { draft = JSON.parse(sessionStorage.getItem(BOOKING_DRAFT_KEY) || 'null'); } catch { draft = null; }
      if (!draft) return;
      if (!draft.roomId || Date.now() - Number(draft.savedAt || 0) > BOOKING_DRAFT_MAX_AGE_MS) {
        try { sessionStorage.removeItem(BOOKING_DRAFT_KEY); } catch { /* nada */ }
        return;
      }
      const room = rooms.find(r => r.id === draft!.roomId);
      if (!room) return; // las habitaciones aún se están cargando: se reintenta cuando lleguen
      try { sessionStorage.removeItem(BOOKING_DRAFT_KEY); } catch { /* nada */ }
      bookingDraftRef.current = { ...draft, hotelId: room.hotelId, stage: 'hotel' };
    }
    const d = bookingDraftRef.current;
    if (d.stage !== 'hotel') return;
    if (selectedHotelId !== d.hotelId) {
      setSelectedHotelId(d.hotelId);
      return;
    }
    const room = rooms.find(r => r.id === d.roomId);
    if (!room) { bookingDraftRef.current = null; return; }
    d.stage = 'room';
    setActiveTab('explore');
    setBookingRoom(room);
  }, [activeUser.id, rooms, selectedHotelId]);

  React.useEffect(() => {
    const d = bookingDraftRef.current;
    if (!d || d.stage !== 'room' || bookingRoom?.id !== d.roomId) return;
    bookingDraftRef.current = null;
    if (d.rentalMonths) setRentalMonths(d.rentalMonths);
    setCheckInDate(d.checkIn || '');
    setCheckOutDate(d.checkOut || '');
    setSelectedServices(d.services || []);
    setServicePeopleCount(d.counts || {});
    setBookingNote(d.note || '');
    setBookingStep(d.checkIn && d.checkOut ? 3 : 1);
  }, [bookingRoom]);

  // Sincronizar automáticamente fechaSalida cuando cambien fechaEntrada o rentalMonths
  React.useEffect(() => {
    if (bookingRoom) {
      const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
      const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
      if (isAlquiler && checkInDate) {
        setCheckOutDate(getDateAfterNMonths(checkInDate, rentalMonths));
      }
    }
  }, [checkInDate, rentalMonths, bookingRoom, hotels]);

  // Active Invoice preview modal state
  const [previewingRes, setPreviewingRes] = useState<Reservation | null>(null);

  // Inline Confirmers for reservations actions
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Helper getters
  const activeHotel = hotels.find(h => h.id === selectedHotelId);

  const getEstablishmentPrice = (h: Hotel) => {
    const isPropiedad = h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento';
    if (isPropiedad && h.detallesInmueble?.precio) {
      return h.detallesInmueble.precio;
    }
    const hotelRooms = rooms.filter(r => r.hotelId === h.id);
    return hotelRooms.length > 0 ? Math.min(...hotelRooms.map(r => r.precio)) : 150;
  };

  const filteredHotels = hotels
    .filter(h => {
      if (h.estado && h.estado !== 'activo') return false;
      // Explora Hoteles should only return hotels (defaulting to hotel if not specified)
      const type = h.tipoEstablecimiento || 'hotel';
      if (type !== 'hotel') return false;
      
      // Location filter (Provincia)
      if (provinciaFilter !== 'todas') {
        const prov = h.provincia || '';
        const matchProv = prov.toLowerCase() === provinciaFilter.toLowerCase() || h.ubicacion.toLowerCase().includes(provinciaFilter.toLowerCase());
        if (!matchProv) return false;
      }

      // Location filter (Ciudad)
      if (ciudadFilter !== 'todas') {
        const city = h.ciudad || '';
        const matchCity = city.toLowerCase() === ciudadFilter.toLowerCase() || h.ubicacion.toLowerCase().includes(ciudadFilter.toLowerCase());
        if (!matchCity) return false;
      }

      // Location filter (Parroquia)
      if (parroquiaFilter !== 'todas') {
        const par = h.parroquia || h.contacto?.parroquia || '';
        const matchPar = par.toLowerCase() === parroquiaFilter.toLowerCase() || h.ubicacion.toLowerCase().includes(parroquiaFilter.toLowerCase());
        if (!matchPar) return false;
      }

      // Beds filter
      if (bedsFilter !== 'todos') {
        const targetBeds = parseInt(bedsFilter, 10);
        const hotelRooms = rooms.filter(r => r.hotelId === h.id);
        if (bedsFilter === '4') {
          const hasMatchingRoom = hotelRooms.some(r => r.camas >= 4);
          if (!hasMatchingRoom) return false;
        } else {
          const hasMatchingRoom = hotelRooms.some(r => r.camas === targetBeds);
          if (!hasMatchingRoom) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const priceA = getEstablishmentPrice(a);
      const priceB = getEstablishmentPrice(b);
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });

  const filteredProperties = hotels
    .filter(h => {
      if (h.estado && h.estado !== 'activo') return false;
      // Explora Propiedades should return casas & departamentos
      if (h.tipoEstablecimiento !== 'casa' && h.tipoEstablecimiento !== 'departamento') return false;
      
      if (propertyTypeFilter !== 'todos' && h.tipoEstablecimiento !== propertyTypeFilter) return false;
      
      // Location filter (Provincia)
      if (provinciaFilter !== 'todas') {
        const prov = h.provincia || '';
        const matchProv = prov.toLowerCase() === provinciaFilter.toLowerCase() || h.ubicacion.toLowerCase().includes(provinciaFilter.toLowerCase());
        if (!matchProv) return false;
      }

      // Location filter (Ciudad)
      if (ciudadFilter !== 'todas') {
        const city = h.ciudad || '';
        const matchCity = city.toLowerCase() === ciudadFilter.toLowerCase() || h.ubicacion.toLowerCase().includes(ciudadFilter.toLowerCase());
        if (!matchCity) return false;
      }

      // Location filter (Parroquia)
      if (parroquiaFilter !== 'todas') {
        const par = h.parroquia || h.contacto?.parroquia || '';
        const matchPar = par.toLowerCase() === parroquiaFilter.toLowerCase() || h.ubicacion.toLowerCase().includes(parroquiaFilter.toLowerCase());
        if (!matchPar) return false;
      }

      // Beds filter
      if (bedsFilter !== 'todos') {
        const targetBeds = parseInt(bedsFilter, 10);
        const bedsCount = h.detallesInmueble?.habitaciones || 1;
        if (bedsFilter === '4') {
          if (bedsCount < 4) return false;
        } else {
          if (bedsCount !== targetBeds) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const priceA = getEstablishmentPrice(a);
      const priceB = getEstablishmentPrice(b);
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });
  const roomsInActiveHotel = rooms.filter(r => {
    if (r.hotelId !== selectedHotelId) return false;
    if (showOnlyAvailableRooms && r.estado === 'mantenimiento') return false;
    if (r.precio > roomMaxPrice) return false;
    if (roomCapacity !== '') {
      if (roomCapacity === '1-2') {
        if (r.capacidad < 1 || r.capacidad > 2) return false;
      } else if (roomCapacity === '3-4') {
        if (r.capacidad < 3 || r.capacidad > 4) return false;
      } else if (roomCapacity === '5-6') {
        if (r.capacidad < 5 || r.capacidad > 6) return false;
      }
    }
    if (roomTypeFilter !== '' && r.tipo !== roomTypeFilter) return false;
    return true;
  })
  .sort((a, b) => {
    if (roomSortOrder === 'asc') {
      const priceDiff = a.precio - b.precio;
      if (priceDiff !== 0) return priceDiff;
      return (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true, sensitivity: 'base' });
    }
    if (roomSortOrder === 'desc') {
      const priceDiff = b.precio - a.precio;
      if (priceDiff !== 0) return priceDiff;
      return (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true, sensitivity: 'base' });
    }
    // Predeterminado: Orden numérico de habitación (ej: 1, 2, 10, 101...)
    return (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  // Paginación: habitaciones de 4 en 4 y catálogo de 9 en 9 (3 filas de 3)
  const ROOMS_PER_PAGE = 4;
  const CATALOG_PER_PAGE = 9;
  const catalogList = activeTab === 'explore' ? filteredHotels : filteredProperties;
  const safeRoomPage = Math.min(roomPage, totalPagesOf(roomsInActiveHotel.length, ROOMS_PER_PAGE));
  const safeCatalogPage = Math.min(catalogPage, totalPagesOf(catalogList.length, CATALOG_PER_PAGE));
  const pagedRooms = roomsInActiveHotel.slice((safeRoomPage - 1) * ROOMS_PER_PAGE, safeRoomPage * ROOMS_PER_PAGE);
  React.useEffect(() => { setRoomPage(1); }, [selectedHotelId, showOnlyAvailableRooms, roomMaxPrice, roomCapacity, roomTypeFilter, roomSortOrder]);
  React.useEffect(() => { setCatalogPage(1); }, [activeTab, catalogList.length]);

  const myReservations = reservations.filter(r => r.guestId === activeUser.id && !r.eliminadaPorCliente);

  // Calculate booking cost
  const getNightsCount = () => {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = end.getTime() - start.getTime();
    if (isNaN(diff) || diff <= 0) return 1;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getRoomPriceForDate = (room: Room, dateStr: string) => {
    // Check if there is an exact date match in variations or an annual re-occurring one ("Always" - matching MM-DD)
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
    
    // Check if weekend rate applies (Friday and Saturday nights)
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
    
    const nights: { date: string; precio: number; motivo: string; isVariable?: boolean }[] = [];
    const start = new Date(checkIn + 'T12:00:00');
    const end = new Date(checkOut + 'T12:00:00');
    
    const current = new Date(start);
    while (current < end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const { precio, motivo, isVariable } = getRoomPriceForDate(room, dateStr);
      nights.push({ date: dateStr, precio, motivo, isVariable });
      
      current.setDate(current.getDate() + 1);
    }
    
    if (nights.length === 0) {
      nights.push({ date: checkIn, precio: room.precio, motivo: 'Tarifa Estándar', isVariable: false });
    }
    
    return nights;
  };

  const getGroupedVariableNights = (room: Room, checkIn: string, checkOut: string) => {
    const rawNights = getBookingNightsBreakdown(room, checkIn, checkOut);
    // Only display days that have variable prices (isVariable is true or custom price !== base price)
    const variableNights = rawNights.filter(n => n.isVariable || n.precio !== room.precio);
    if (variableNights.length === 0) return [];

    const groups: {
      dates: string[];
      precio: number;
      motivo: string;
    }[] = [];

    variableNights.forEach(n => {
      if (groups.length === 0) {
        groups.push({ dates: [n.date], precio: n.precio, motivo: n.motivo });
      } else {
        const lastGroup = groups[groups.length - 1];
        const lastDateStr = lastGroup.dates[lastGroup.dates.length - 1];
        const lastDate = new Date(lastDateStr + 'T12:00:00');
        const currDate = new Date(n.date + 'T12:00:00');
        const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (lastGroup.precio === n.precio && lastGroup.motivo === n.motivo && diffDays === 1) {
          lastGroup.dates.push(n.date);
        } else {
          groups.push({ dates: [n.date], precio: n.precio, motivo: n.motivo });
        }
      }
    });

    return groups.map(g => {
      if (g.dates.length === 1) {
        const [y, m, d] = g.dates[0].split('-');
        return {
          formattedDate: `${d}/${m}/${y}`,
          precio: g.precio,
          motivo: g.motivo
        };
      } else {
        const first = g.dates[0].split('-');
        const last = g.dates[g.dates.length - 1].split('-');
        let label = '';
        if (first[0] === last[0] && first[1] === last[1]) {
          label = `${first[2]} - ${last[2]}/${first[1]}/${first[0]}`;
        } else {
          label = `${first[2]}/${first[1]}/${first[0]} - ${last[2]}/${last[1]}/${last[0]}`;
        }
        return {
          formattedDate: label,
          precio: g.precio,
          motivo: g.motivo
        };
      }
    });
  };

  const getBookingSubtotal = (roomPrice: number) => {
    if (bookingRoom) {
      const breakdown = getBookingNightsBreakdown(bookingRoom, checkInDate, checkOutDate);
      return breakdown.reduce((sum, n) => sum + n.precio, 0);
    }
    return roomPrice * getNightsCount();
  };

  const getServicesTotal = () => {
    if (!bookingRoom) return 0;
    const bookingHotel = hotels.find(h => h.id === bookingRoom.hotelId);
    const detailedServices = bookingHotel?.serviciosDetallados || [];
    const nNights = Math.max(1, getNightsCount());
    
    let sum = 0;
    selectedServices.forEach(srvId => {
      const srv = detailedServices.find(s => s.id === srvId);
      if (srv) {
        const count = servicePeopleCount[srvId] || 1;
        const isPerDay = srv.tipoCobro === 'por_dia';
        sum += isPerDay ? srv.precio * count * nNights : srv.precio * count;
      } else {
        const fallback = ADDITIONAL_SERVICES.find(s => s.id === srvId);
        if (fallback) {
          const count = servicePeopleCount[srvId] || 1;
          sum += fallback.price * count;
        }
      }
    });
    return sum;
  };

  const getBookingTotal = (roomPrice: number) => {
    if (bookingRoom) {
      const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
      const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
      if (isAlquiler) {
        const isIvaAdded = bHotel.detallesInmueble?.adicionarIva !== undefined 
          ? bHotel.detallesInmueble.adicionarIva !== false 
          : (bHotel.adicionarIva !== undefined 
              ? bHotel.adicionarIva !== false 
              : bookingRoom.adicionarIva !== false);
        if (!isIvaAdded) {
          const rentIva = roomPrice * 0.16;
          const rentExcludingIva = roomPrice - rentIva;
          const garantia = roomPrice;
          return {
            subtotal: rentExcludingIva + garantia,
            tax: rentIva,
            total: roomPrice + garantia,
            isAlquiler: true,
            garantia: garantia,
            mensualidad: roomPrice
          };
        } else {
          const rentOneMonth = roomPrice;
          const garantia = roomPrice;
          const sub = rentOneMonth + garantia;
          const tax = rentOneMonth * 0.16;
          return {
            subtotal: sub,
            tax: tax,
            total: sub + tax,
            isAlquiler: true,
            garantia: garantia,
            mensualidad: rentOneMonth
          };
        }
      }
    }

    const rawSub = getBookingSubtotal(roomPrice);
    const servicesSub = getServicesTotal();
    const bHotelForRoom = bookingRoom ? hotels.find(h => h.id === bookingRoom.hotelId) : null;
    const isIvaAdded = bookingRoom 
      ? (bookingRoom.adicionarIva !== undefined 
          ? bookingRoom.adicionarIva !== false 
          : (bHotelForRoom?.detallesInmueble?.adicionarIva !== undefined 
              ? bHotelForRoom.detallesInmueble.adicionarIva !== false 
              : (bHotelForRoom?.adicionarIva !== false))) 
      : true;

    if (!isIvaAdded) {
      const roomIva = rawSub * 0.16;
      const roomSubtotalExcludingIva = rawSub - roomIva;
      return {
        subtotal: roomSubtotalExcludingIva + servicesSub,
        tax: roomIva,
        total: rawSub + servicesSub,
        isAlquiler: false
      };
    } else {
      const sub = rawSub + servicesSub;
      const tax = sub * 0.16;
      return {
        subtotal: sub,
        tax: tax,
        total: sub + tax,
        isAlquiler: false
      };
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRoom) return;

    // Direct guest intercept: prompt login/registration first before creating reservation
    if (activeUser.id === 'guest') {
      // Al iniciar sesión la página se recarga: se guarda la reserva en curso para retomarla
      try {
        sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({
          roomId: bookingRoom.id,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          rentalMonths,
          services: selectedServices,
          counts: servicePeopleCount,
          note: bookingNote,
          savedAt: Date.now()
        }));
      } catch { /* sin almacenamiento: se reserva de nuevo */ }
      if (onTriggerBookingAuth) {
        onTriggerBookingAuth();
      } else if (onTriggerLogin) {
        onTriggerLogin();
      } else {
        setBookingError("Inicia sesión o regístrate para continuar con tu reserva.");
      }
      return;
    }

    if (!checkInDate || !checkOutDate) {
      setBookingError("Selecciona las fechas de check-in y check-out.");
      return;
    }

    // Validate that date selected is today or future
    const todayStr = getTodayString(0);
    if (checkInDate < todayStr) {
      setBookingError("La fecha de check-in no puede ser anterior al día de hoy. Selecciona una fecha válida.");
      return;
    }

    if (checkOutDate <= checkInDate) {
      setBookingError("La fecha de check-out debe ser posterior a la fecha de entrada.");
      return;
    }

    // Alquiler 3-months limit validation
    const bHotelForVal = hotels.find(h => h.id === bookingRoom.hotelId);
    const isAlquilerForVal = bHotelForVal && (bHotelForVal.tipoEstablecimiento === 'casa' || bHotelForVal.tipoEstablecimiento === 'departamento') && bHotelForVal.finalidad === 'alquiler';
    if (isAlquilerForVal) {
      const months = getMonthsCount(checkInDate, checkOutDate);
      const minMonths = getRentalMinMonths(bHotelForVal);
      if (months < minMonths - 0.1) {
        setBookingError(`El período de alquiler para este inmueble debe ser de mínimo ${formatRentalMonths(minMonths)}.`);
        return;
      }
    }

    // CHECK DATE OVERLAP:
    const activeReservations = reservations.filter(res => 
      res.roomId === bookingRoom.id &&
      res.estado !== 'cancelada' &&
      res.estado !== 'finalizada'
    );

    const hasOverlap = activeReservations.some(res => 
      checkInDate < res.fechaSalida && checkOutDate > res.fechaEntrada
    );

    if (hasOverlap) {
      setBookingError("La habitación ya está reservada u ocupada en las fechas seleccionadas. Elige un rango de fechas diferente.");
      return;
    }

    setBookingError(null);

    const pricing = getBookingTotal(bookingRoom.precio);
    const resId = `RES-${Math.floor(10000 + Math.random() * 90000)}`;
    const qrCode = `ROOMIA-${resId}-${bookingRoom.hotelId}-${bookingRoom.id}`;

    const bookingHotel = hotels.find(h => h.id === bookingRoom.hotelId);
    const detailedList = bookingHotel?.serviciosDetallados || [];

    const nNights = Math.max(1, getNightsCount());
    const mappedServices = selectedServices.map(srvId => {
      const srv = detailedList.find(s => s.id === srvId);
      if (srv) {
        const count = servicePeopleCount[srvId] || 1;
        const isPerDay = srv.tipoCobro === 'por_dia';
        const total = isPerDay ? srv.precio * count * nNights : srv.precio * count;
        const cobroDetail = isPerDay ? `${count} pers x ${nNights} ${nNights === 1 ? 'día' : 'días'}` : `${count} pers`;
        return `${srv.nombre} (${cobroDetail} - $${total.toFixed(2)})`;
      }
      const fallback = ADDITIONAL_SERVICES.find(s => s.id === srvId);
      if (fallback) {
        const count = servicePeopleCount[srvId] || 1;
        const total = fallback.price * count;
        return `${fallback.name} (${count} pers - $${total})`;
      }
      return srvId;
    });

    const newRes: Reservation = {
      id: resId,
      hotelId: bookingRoom.hotelId,
      roomId: bookingRoom.id,
      guestId: activeUser.id,
      fechaEntrada: checkInDate,
      fechaSalida: checkOutDate,
      serviciosAdicionales: mappedServices,
      subtotal: pricing.subtotal,
      impuestos: pricing.tax,
      total: pricing.total,
      qrCode: qrCode,
      estado: 'pendiente', 
      fechaRegistro: todayStr,
      fechaRegistroTimestamp: new Date().toISOString(),
      notas: bookingNote
    };

    // Registrar reservación como pendiente de pago.
    // La base de datos tiene la última palabra: si alguien reservó esas fechas un
    // instante antes, devuelve false y no se continúa al pago.
    const created = await onCreateReservation(newRes);
    if (created === false) {
      setBookingError("La habitación ya no está disponible en las fechas seleccionadas. Elige un rango de fechas diferente.");
      return;
    }

    // Abrir ventana con instrucciones de pago
    setSelectedResForPayment(newRes);
    setShowPaymentModal(true);

    // Reiniciar estados del formulario de checkout
    setBookingRoom(null);
    setSelectedServices([]);
    setServicePeopleCount({});
    setBookingNote('');
    setBookingError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* Portada del catálogo: solo en la lista de hoteles o de propiedades */}
      {bookingRoom === null && selectedHotelId === null && (activeTab === 'explore' || activeTab === 'properties') && (
        <div className="bg-gradient-to-r from-brand-navy1 to-brand-navy2 rounded-2xl p-5 md:py-6 md:px-8 text-white shadow-xl mb-6 relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
          
          <div className="relative">
            <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight leading-tight">
              Descubre estadías extraordinarias
            </h1>
            <p className="text-white/85 text-sm mt-1.5 leading-relaxed max-w-2xl">
              Reserva directo con el establecimiento, gestiona tus reservas y descarga tus pre-facturas al instante.
            </p>
          </div>
        </div>
      )}

      {/* EXPLORE TABS */}
      {(activeTab === 'explore' || activeTab === 'properties') && (
        <div className="space-y-8">
          
          {selectedHotelId === null ? (
            // GRID OF HOTELS (Airbnb list style)
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-800 flex items-center gap-2.5">
                    <span>
                      {activeTab === 'explore' ? 'Catálogo de Hoteles Premium' : 'Catálogo de Propiedades Exclusivas'}{' '}
                      ({(activeTab === 'explore' ? filteredHotels.length : filteredProperties.length) || (isLoading ? 2 : 0)})
                    </span>
                    {isLoading && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-micro font-semibold bg-teal-50 text-teal-700 border border-teal-200 animate-pulse">
                        <Loader2 className="w-3 h-3 text-teal-600 animate-spin" />
                        <span>Sincronizando...</span>
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-600 font-medium mt-1">
                    {activeTab === 'explore' 
                      ? 'Elige un hotel boutique de primer nivel para explorar las habitaciones y suites disponibles.'
                      : 'Explore nuestra selecta colección de casas y departamentos en alquiler temporario o venta definitiva.'}
                  </p>
                </div>
                
                {/* Filtros del catálogo: todos del mismo tamaño (hoja inferior en el teléfono, lista en escritorio) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <OptionPicker
                    label="Provincia"
                    icon={MapPin}
                    value={provinciaFilter}
                    emptyValue="todas"
                    placeholder="Seleccionar provincia"
                    options={[{ value: 'todas', label: 'Todas las provincias' }, ...getProvincesList().map(p => ({ value: p, label: p }))]}
                    onChange={(v) => {
                      setProvinciaFilter(v);
                      setCiudadFilter('todas');
                      setParroquiaFilter('todas');
                    }}
                  />

                  {provinciaFilter !== 'todas' && (
                    <OptionPicker
                      label="Ciudad"
                      icon={MapPin}
                      value={ciudadFilter}
                      emptyValue="todas"
                      placeholder="Seleccionar ciudad"
                      options={[{ value: 'todas', label: 'Todas las ciudades' }, ...getCitiesForProvince(provinciaFilter).map(c => ({ value: c, label: c }))]}
                      onChange={(v) => {
                        setCiudadFilter(v);
                        setParroquiaFilter('todas');
                      }}
                    />
                  )}

                  {provinciaFilter !== 'todas' && ciudadFilter !== 'todas' && (
                    <OptionPicker
                      label="Parroquia"
                      icon={MapPin}
                      value={parroquiaFilter}
                      emptyValue="todas"
                      placeholder="Seleccionar parroquia"
                      options={[{ value: 'todas', label: 'Todas las parroquias' }, ...getParroquiasForCity(provinciaFilter, ciudadFilter).map(par => ({ value: par, label: par }))]}
                      onChange={setParroquiaFilter}
                    />
                  )}

                  {activeTab === 'properties' && (
                    <OptionPicker
                      label="Tipo de propiedad"
                      icon={Home}
                      value={propertyTypeFilter}
                      emptyValue="todos"
                      placeholder="Seleccionar tipo de propiedad"
                      options={[
                        { value: 'todos', label: 'Casas y departamentos' },
                        { value: 'casa', label: 'Casas' },
                        { value: 'departamento', label: 'Departamentos' }
                      ]}
                      onChange={setPropertyTypeFilter}
                    />
                  )}

                  <OptionPicker
                    label="Ordenar por precio"
                    icon={ArrowUpDown}
                    value={sortOrder}
                    options={[
                      { value: 'asc', label: 'De menor a mayor precio' },
                      { value: 'desc', label: 'De mayor a menor precio' }
                    ]}
                    onChange={(v) => setSortOrder(v as 'asc' | 'desc')}
                  />

                  <OptionPicker
                    label="Camas"
                    icon={BedDouble}
                    value={bedsFilter}
                    emptyValue="todos"
                    placeholder="Seleccionar número de camas"
                    options={[
                      { value: 'todos', label: 'Cualquier número de camas' },
                      { value: '1', label: '1 cama' },
                      { value: '2', label: '2 camas' },
                      { value: '3', label: '3 camas' },
                      { value: '4', label: '4 camas o más' }
                    ]}
                    onChange={setBedsFilter}
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-6">
                  {/* Discreet Catalog Loading Bar with Spinner */}
                  <div className="flex items-center gap-3.5 p-4 bg-gradient-to-r from-teal-50/90 via-info-50/70 to-teal-50/90 border border-teal-200/80 rounded-2xl shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-teal-600/10 border border-teal-600/20 flex items-center justify-center shrink-0">
                      <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800">
                        {activeTab === 'explore' ? 'Cargando hoteles...' : 'Actualizando catálogo...'}
                      </p>
                      <p className="text-micro text-neutral-500">
                        {activeTab === 'explore'
                          ? 'Recuperando alojamientos, suites disponibles y tarifas...'
                          : 'Recuperando propiedades exclusivas disponibles...'}
                      </p>
                    </div>
                  </div>

                  {/* Skeletons Grid matching exactly the 3 columns layout with reserved min-height to eliminate CLS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[520px]">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div
                        key={i}
                        className="bg-white rounded-2xl overflow-hidden border border-neutral-200/90 shadow-sm animate-pulse"
                      >
                        {/* Photo skeleton with badge */}
                        <div className="relative w-full h-52 sm:h-56 bg-neutral-200/90 overflow-hidden">
                          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full h-5 w-24" />
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full w-8 h-8" />
                        </div>

                        <div className="p-5 space-y-3.5">
                          <div className="flex justify-between items-start gap-4">
                            <div className="h-5 w-3/5 bg-neutral-200 rounded-lg" />
                            <div className="h-6 w-20 bg-teal-100 rounded-lg" />
                          </div>

                          {/* Rating stars skeleton */}
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(s => (
                                <div key={s} className="w-3 h-3 rounded-full bg-warning-200/80" />
                              ))}
                            </div>
                            <div className="h-3.5 w-6 bg-neutral-200 rounded-lg ml-1" />
                          </div>

                          {/* Location skeleton */}
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-neutral-200 shrink-0" />
                            <div className="h-3.5 w-1/2 bg-neutral-200 rounded-lg" />
                          </div>

                          {/* Description line skeleton */}
                          <div className="space-y-1.5 pt-1">
                            <div className="h-3 w-full bg-neutral-100 rounded-lg" />
                            <div className="h-3 w-4/5 bg-neutral-100 rounded-lg" />
                          </div>

                          {/* Amenities tag pills */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <div className="h-5 w-16 bg-neutral-100 rounded-lg" />
                            <div className="h-5 w-16 bg-neutral-100 rounded-lg" />
                            <div className="h-5 w-12 bg-neutral-100 rounded-lg" />
                          </div>

                          {/* Bottom CTA bar */}
                          <div className="pt-3.5 border-t border-neutral-100 flex items-center justify-between">
                            <div className="h-4 w-28 bg-teal-100/70 rounded-lg" />
                            <div className="w-4 h-4 bg-neutral-200 rounded-full" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (activeTab === 'explore' ? filteredHotels : filteredProperties).length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-neutral-200 text-center text-neutral-600 shadow-sm min-h-[300px] flex flex-col justify-center items-center">
                  <p className="text-base font-semibold text-neutral-800">No se encontraron alojamientos para los filtros seleccionados.</p>
                  <p className="text-xs text-neutral-600 font-medium mt-1.5">Prueba cambiando la provincia o los filtros de búsqueda.</p>
                </div>
              ) : (
                <>
                <div id="catalogo-listado" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 scroll-mt-24">
                  {catalogList.slice((safeCatalogPage - 1) * CATALOG_PER_PAGE, safeCatalogPage * CATALOG_PER_PAGE)
                    .map((hotel, hotelIdx) => {
                      // Quick lowest room price/property price calculation
                      const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);
                      const isPropiedad = hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento';
                      const displayPrice = isPropiedad && hotel.detallesInmueble?.precio
                        ? hotel.detallesInmueble.precio
                        : (hotelRooms.length > 0 ? Math.min(...hotelRooms.map(r => r.precio)) : 150);
                      const hotelReviews = reviews.filter(r => r.hotelId === hotel.id);
                      const isHotelOrAlquiler = !isPropiedad || hotel.finalidad === 'alquiler';

                      return (
                        <motion.div
                          key={hotel.id}
                          onClick={() => {
                            setSelectedHotelId(hotel.id);
                            if (onOpenHotelChange) onOpenHotelChange(hotel.id);
                          }}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          whileHover={{ y: -6, scale: 1.015, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08)" }}
                          className="bg-white rounded-2xl overflow-hidden border border-neutral-200 hover:border-teal-500 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 flex flex-col"
                          tabIndex={0}
                          role="button"
                          aria-label={`Ver detalles del alojamiento ${hotel.nombre}`}
                        >
                          <div className="relative w-full h-52 sm:h-56 overflow-hidden bg-neutral-100 shrink-0">
                            <img
                              src={hotel.portada}
                              onError={onImageError}
                              alt={`Fotografía exterior de ${hotel.nombre}`}
                              loading={hotelIdx === 0 ? "eager" : "lazy"}
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                            {hotel.tipoEstablecimiento === 'hotel' ? (() => {
                              if (hotelReviews.length === 0) {
                                return (
                                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-micro font-extrabold text-neutral-800 uppercase tracking-widest flex items-center gap-1 shadow-sm border border-neutral-100">
                                    🏨 Hotel
                                  </div>
                                );
                              }
                              const avgRating = hotelReviews.reduce((sum, r) => sum + r.rating, 0) / hotelReviews.length;
                              return (
                                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-micro font-bold text-neutral-800 flex items-center gap-1 shadow-sm border border-neutral-100/80 animate-fade-in">
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                      <Star 
                                        key={idx} 
                                        className={`w-3 h-3 ${
                                          idx < Math.round(avgRating) ? 'fill-current text-warning-500' : 'text-neutral-200'
                                        }`} 
                                      />
                                    ))}
                                  </div>
                                  <span className="text-micro font-extrabold text-neutral-800 ml-1 font-mono">
                                    {avgRating.toFixed(1)}
                                  </span>
                                </div>
                              );
                            })() : (
                              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-micro font-bold text-neutral-800 uppercase tracking-widest flex items-center gap-1 shadow-sm border border-neutral-100">
                                {hotel.tipoEstablecimiento === 'casa' ? '🏡 Casa Completa' : '🏢 Departamento'}
                              </div>
                            )}
                          </div>

                          <div className="p-5">
                            <div className="flex justify-between items-start gap-4 mb-2">
                              <h4 className="font-semibold text-neutral-800 text-lg group-hover:text-teal-600 transition-colors ">
                                {hotel.nombre}
                              </h4>
                              <span className="font-mono text-sm font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg shrink-0">
                                ${displayPrice.toLocaleString()} <span className="font-normal text-xs text-neutral-600">
                                  {hotel.finalidad === 'venta' ? 'compra' : isPropiedad ? '/ mes' : '/ noche'}
                                </span>
                              </span>
                            </div>

                            {/* Stars Rating for Properties only (since hotels have it in the top badge instead of "Hotel Boutique") */}
                            {isPropiedad && isHotelOrAlquiler && hotelReviews.length > 0 && (() => {
                              const avgRating = hotelReviews.reduce((sum, r) => sum + r.rating, 0) / hotelReviews.length;
                              return (
                                <div className="flex items-center gap-1 mb-2.5 bg-warning-500/5 border border-warning-500/10 px-2 py-1 rounded-lg w-fit ">
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                      <Star 
                                        key={idx} 
                                        className={`w-3 h-3 ${
                                          idx < Math.round(avgRating) ? 'fill-current text-warning-500' : 'text-neutral-200'
                                        }`} 
                                      />
                                    ))}
                                  </div>
                                  <span className="text-micro font-bold text-neutral-800 ml-1 font-mono">
                                    {avgRating.toFixed(1)}
                                  </span>
                                </div>
                              );
                            })()}
                            
                            <div className="flex items-center gap-1.5 text-xs text-neutral-600 mb-3">
                              <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                              <span className="truncate">
                                {hotel.parroquia 
                                  ? `${hotel.parroquia}, ${hotel.ciudad || ''}`
                                  : (hotel.ubicacion.split(',')[1] || hotel.ubicacion)}
                              </span>
                            </div>
                            
                            <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed mb-3">
                              {hotel.descripcion}
                            </p>

                            {/* Specific specs of Houses and Apartments */}
                            {(hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento') && hotel.detallesInmueble && (
                              <div className="flex flex-wrap gap-2 text-micro bg-teal-50/50 border border-teal-100/50 p-2.5 rounded-xl mb-4 font-semibold text-teal-800">
                                <span className="flex items-center gap-0.5">🛏️ {hotel.detallesInmueble.habitaciones} Hab</span>
                                <span className="text-teal-200">•</span>
                                <span className="flex items-center gap-0.5">🚿 {hotel.detallesInmueble.banos} Baños</span>
                                <span className="text-teal-200">•</span>
                                <span className="flex items-center gap-0.5 font-mono">{hotel.detallesInmueble.metrosCuadrados || '40'} m²</span>
                                <span className="text-teal-200">•</span>
                                <span>🛋️ {hotel.detallesInmueble.amueblado !== false ? 'Amoblado' : 'S/A'}</span>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-1 mb-4">
                              {hotel.servicios.slice(0, 3).map((serv, i) => (
                                <span key={i} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 text-micro rounded-lg border border-neutral-100 font-medium">
                                  {serv}
                                </span>
                              ))}
                              {hotel.servicios.length > 3 && (
                                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-micro rounded-lg border border-neutral-200 font-mono font-medium">
                                  +{hotel.servicios.length - 3}
                                </span>
                              )}
                            </div>

                            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-teal-600 font-semibold ">
                              <span>{isPropiedad ? 'Ver detalles de propiedad' : 'Ver suites disponibles'}</span>
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
                <Pager page={safeCatalogPage} pageSize={CATALOG_PER_PAGE} total={catalogList.length} onChange={setCatalogPage} scrollToId="catalogo-listado" noun="alojamientos" />
                </>
              )}
            </div>
          ) : bookingRoom !== null ? (
            // DYNAMIC 3-STEP RESERVATION FLOW (Eliminates excessive vertical scrolling)
            <div className="space-y-5 animate-fade-in text-neutral-800 max-w-4xl mx-auto">
              <HeaderBackButton
                onClick={() => {
                  setBookingRoom(null);
                  setBookingStep(1);
                }}
              />

              {/* Galería de imágenes de la habitación en la parte superior (estilo interactivo de hotel) */}
              <HotelImageGallery 
                imagenes={bookingRoom.imagenes && bookingRoom.imagenes.length > 0 ? bookingRoom.imagenes : (activeHotel?.imagenes || [])} 
                portada={bookingRoom.imagenes?.[0] || activeHotel?.portada || ''} 
                hotelNombre={`${bookingRoom.nombre} • Habitación #${bookingRoom.numero}`} 
                badgeTitle={`Habitación ${bookingRoom.tipo}`}
              />

              {/* Compact Room Overview Header */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-neutral-900 text-base sm:text-lg leading-tight">
                      {bookingRoom.nombre}
                    </h3>
                    <p className="text-xs text-neutral-600 mt-1">
                      N° {bookingRoom.numero} · {bookingRoom.tipo} · {bookingRoom.capacidad} pers · {bookingRoom.camas} {bookingRoom.camas > 1 ? 'camas' : 'cama'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block font-mono text-lg font-extrabold leading-tight text-brand-navy1">${bookingRoom.precio}</span>
                    <span className="block text-xs text-neutral-600">USD / noche</span>
                  </div>
                </div>
                {bookingRoom.descripcion && (
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    {bookingRoom.descripcion}
                  </p>
                )}
              </div>

              {/* Wizard Steps Navigator */}
              <div className="bg-white p-2 rounded-2xl border border-neutral-200 shadow-xs">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingStep(1)}
                    className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                      bookingStep === 1
                        ? 'bg-teal-700 text-white shadow-xs'
                        : checkInDate && checkOutDate
                        ? 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                        : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    {checkInDate && checkOutDate && bookingStep > 1 ? (
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 stroke-[3]" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-micro shrink-0">1</span>
                    )}
                    <span className="truncate">Fechas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (checkInDate && checkOutDate) {
                        setBookingError(null);
                        setBookingStep(2);
                      }
                    }}
                    disabled={!checkInDate || !checkOutDate}
                    className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                      bookingStep === 2
                        ? 'bg-teal-700 text-white shadow-xs cursor-pointer'
                        : checkInDate && checkOutDate
                        ? 'bg-teal-50 text-teal-800 hover:bg-teal-100 cursor-pointer'
                        : 'bg-neutral-50 text-neutral-300 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-micro shrink-0">2</span>
                    <span className="truncate">Servicios</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (checkInDate && checkOutDate) {
                        setBookingError(null);
                        setBookingStep(3);
                      }
                    }}
                    disabled={!checkInDate || !checkOutDate}
                    className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                      bookingStep === 3
                        ? 'bg-teal-700 text-white shadow-xs cursor-pointer'
                        : checkInDate && checkOutDate
                        ? 'bg-teal-50 text-teal-800 hover:bg-teal-100 cursor-pointer'
                        : 'bg-neutral-50 text-neutral-300 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-micro shrink-0">3</span>
                    <span className="truncate">Resumen</span>
                  </button>
                </div>
              </div>

              {/* Error Notification Banner */}
              {bookingError && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-danger-800 text-xs flex items-start gap-2.5 animate-pulse ">
                  <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                  <p className="font-medium leading-normal">{bookingError}</p>
                </div>
              )}

              {/* STEP 1: FECHAS Y ESTANCIA */}
              {bookingStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  {(() => {
                    const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
                    const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';

                    if (isAlquiler) {
                      return (
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                          <div className="border-b border-neutral-100 pb-3">
                            <h4 className="font-bold text-neutral-800 text-base flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-teal-600" />
                              <span>Contrato de Alquiler Residencial</span>
                            </h4>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Seleccione la fecha de inicio y el plazo del alquiler (mínimo {formatRentalMonths(getRentalMinMonths(bHotel))}, definido por el propietario).
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-neutral-600 block mb-1.5">Fecha de Inicio de Alquiler</label>
                              <input
                                type="date"
                                required
                                min={getTodayString(0)}
                                value={checkInDate}
                                onChange={(e) => {
                                  const newIn = e.target.value;
                                  setCheckInDate(newIn);
                                  setCheckOutDate(getDateAfterNMonths(newIn, rentalMonths));
                                  setBookingError(null);
                                }}
                                className="w-full text-xs border border-neutral-200 rounded-xl p-2.5 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer shadow-xs"
                              />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-neutral-600 block mb-1.5">Tiempo de alquiler</span>
                              <OptionPicker
                                label="Plazo"
                                icon={Calendar}
                                value={String(rentalMonths)}
                                options={rentalDurationOptions(getRentalMinMonths(bHotel)).map(o => ({ value: String(o.months), label: o.label }))}
                                onChange={(v) => {
                                  const num = parseInt(v, 10);
                                  setRentalMonths(num);
                                  if (checkInDate) {
                                    setCheckOutDate(getDateAfterNMonths(checkInDate, num));
                                  }
                                  setBookingError(null);
                                }}
                              />
                            </div>
                          </div>

                          <div className="text-xs text-teal-800 bg-teal-50/70 p-3 rounded-xl border border-teal-100 flex justify-between items-center font-semibold">
                            <span>Fecha de Finalización Calculada:</span>
                            <strong className="font-mono text-neutral-900">{checkOutDate || 'Selecciona la fecha de inicio'}</strong>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Compact Calendar Panel */}
                        <div className="lg:col-span-7 space-y-3">
                          <CompactBookingCalendar
                            room={bookingRoom}
                            reservations={reservations}
                            checkInDate={checkInDate}
                            checkOutDate={checkOutDate}
                            onSelectRange={(inD, outD) => {
                              setCheckInDate(inD);
                              setCheckOutDate(outD);
                              setBookingError(null);
                            }}
                            roomPriceVariations={roomPriceVariations}
                            isAlquiler={false}
                          />
                        </div>

                        {/* Dates Selection & Duration Card */}
                        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                          <div className="border-b border-neutral-100 pb-2.5">
                            <h4 className="font-bold text-neutral-800 text-sm flex items-center gap-1.5">
                              <CalendarCheck className="w-4 h-4 text-teal-600" />
                              <span>Estancia Seleccionada</span>
                            </h4>
                            <p className="text-micro text-neutral-400 mt-0.5">
                              Toca el calendario: 1° fecha de llegada, 2° fecha de salida.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div className={`p-3 rounded-xl border transition-all ${checkInDate ? 'bg-teal-50/50 border-teal-200' : 'bg-neutral-50 border-neutral-200'}`}>
                              <span className="text-micro font-bold text-neutral-400 block uppercase tracking-wider">Llegada (Check-in)</span>
                              <strong className={`font-mono text-xs block mt-1 ${checkInDate ? 'text-teal-800' : 'text-neutral-400 italic'}`}>
                                {checkInDate || 'Pendiente'}
                              </strong>
                            </div>

                            <div className={`p-3 rounded-xl border transition-all ${checkOutDate ? 'bg-teal-50/50 border-teal-200' : 'bg-neutral-50 border-neutral-200'}`}>
                              <span className="text-micro font-bold text-neutral-400 block uppercase tracking-wider">Salida (Check-out)</span>
                              <strong className={`font-mono text-xs block mt-1 ${checkOutDate ? 'text-teal-800' : 'text-neutral-400 italic'}`}>
                                {checkOutDate || 'Pendiente'}
                              </strong>
                            </div>
                          </div>

                          {/* Fallback Manual Pickers */}
                          <div className="pt-2 border-t border-neutral-100">
                            <span className="text-micro text-neutral-400 font-semibold block mb-1.5">O elige las fechas manualmente:</span>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                min={getTodayString(0)}
                                value={checkInDate}
                                onChange={(e) => {
                                  setCheckInDate(e.target.value);
                                  setBookingError(null);
                                }}
                                className="w-full text-xs border border-neutral-200 rounded-lg p-2 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                              />
                              <input
                                type="date"
                                min={getMinCheckOutDate()}
                                value={checkOutDate}
                                onChange={(e) => {
                                  setCheckOutDate(e.target.value);
                                  setBookingError(null);
                                }}
                                className="w-full text-xs border border-neutral-200 rounded-lg p-2 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                              />
                            </div>
                          </div>

                          {/* Nights and Subtotal preview */}
                          {checkInDate && checkOutDate && checkOutDate > checkInDate && (
                            <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl space-y-1 text-xs">
                              <div className="flex justify-between items-center text-teal-900">
                                <span className="font-semibold">Noches de hospedaje:</span>
                                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-teal-200">{getNightsCount()} {getNightsCount() === 1 ? 'noche' : 'noches'}</span>
                              </div>
                              <div className="flex justify-between items-center text-teal-800 pt-1 border-t border-teal-100/70">
                                <span>Subtotal hospedaje:</span>
                                <span className="font-mono font-bold text-sm text-teal-900">${getBookingSubtotal(bookingRoom.precio).toFixed(2)} USD</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 1 Actions */}
                  <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs flex justify-between items-center">
                    <Button
                      type="button"
                      onClick={() => {
                        setBookingRoom(null);
                        setBookingStep(1);
                      }}
                      variant="secondary" size="md"
                    >
                      Cancelar
                    </Button>

                    <button
                      type="button"
                      disabled={!checkInDate || !checkOutDate || checkOutDate <= checkInDate}
                      onClick={() => {
                        if (!checkInDate || !checkOutDate) {
                          setBookingError("Selecciona las fechas de check-in y check-out.");
                          return;
                        }
                        if (checkOutDate <= checkInDate) {
                          setBookingError("La fecha de check-out debe ser posterior a la fecha de check-in.");
                          return;
                        }
                        setBookingError(null);
                        setBookingStep(2);
                      }}
                      className={`px-5 py-2.5 font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-xs ${
                        !checkInDate || !checkOutDate || checkOutDate <= checkInDate
                          ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                          : 'bg-teal-700 hover:bg-teal-800 text-white cursor-pointer active:scale-95 shadow-teal-700/20 shadow-sm'
                      }`}
                    >
                      <span>Continuar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: SERVICIOS ADICIONALES */}
              {bookingStep === 2 && (
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-5 animate-fade-in">
                  <div>
                    <h4 className="font-bold text-neutral-800 text-base">
                      Servicios adicionales
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Personaliza tu experiencia con desayunos, traslados o paquetes de relax.
                    </p>
                  </div>

                  {(() => {
                    const bookingHotel = hotels.find(h => h.id === bookingRoom?.hotelId);
                    const availableServices = (bookingHotel?.serviciosDetallados && bookingHotel.serviciosDetallados.length > 0)
                      ? bookingHotel.serviciosDetallados.filter(s => s.estado === 'activo')
                      : ADDITIONAL_SERVICES.map(s => ({
                          id: s.id,
                          nombre: s.name,
                          descripcion: s.desc,
                          precio: s.price,
                          tipoCobro: 'por_estadia' as const,
                          estado: 'activo' as const,
                          emoji: s.emoji
                        }));

                    return (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availableServices.map(srv => {
                            const isChecked = selectedServices.includes(srv.id);
                            return (
                              <div
                                key={srv.id}
                                onClick={() => {
                                  setSelectedServices(prev => {
                                    const exists = prev.includes(srv.id);
                                    if (exists) {
                                      return prev.filter(id => id !== srv.id);
                                    } else {
                                      setServicePeopleCount(prevCounts => ({
                                        ...prevCounts,
                                        [srv.id]: 1
                                      }));
                                      return [...prev, srv.id];
                                    }
                                  });
                                }}
                                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                                  isChecked
                                    ? 'bg-teal-50/60 border-teal-300 shadow-xs ring-1 ring-teal-400/40'
                                    : 'bg-white hover:bg-neutral-50 border-neutral-200'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                                      {srv.emoji && <span className="text-base shrink-0">{srv.emoji}</span>}
                                      <span className="truncate">{srv.nombre}</span>
                                    </p>
                                    <p className="text-micro text-neutral-500 mt-0.5 leading-relaxed line-clamp-2">{srv.descripcion}</p>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-teal-700 border-teal-700 text-white' : 'border-neutral-300 bg-white'}`}>
                                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                                  <span className="font-mono font-bold text-teal-800 text-xs">
                                    +${srv.precio} <span className="text-micro text-neutral-400 font-normal">/ pers {srv.tipoCobro === 'por_dia' ? '/ día' : ''}</span>
                                  </span>

                                  {isChecked && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-0.5 border border-teal-200 rounded-lg shadow-2xs"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const cur = servicePeopleCount[srv.id] || 1;
                                          if (cur > 1) {
                                            setServicePeopleCount({ ...servicePeopleCount, [srv.id]: cur - 1 });
                                          }
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold text-xs cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs font-mono font-bold text-neutral-900 w-5 text-center">
                                        {servicePeopleCount[srv.id] || 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const cur = servicePeopleCount[srv.id] || 1;
                                          setServicePeopleCount({ ...servicePeopleCount, [srv.id]: cur + 1 });
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {getServicesTotal() > 0 && (
                          <div className="p-2.5 bg-teal-50 border border-teal-100 rounded-xl text-xs text-teal-900 flex justify-between items-center font-semibold">
                            <span>Subtotal de Servicios Adicionales:</span>
                            <span className="font-mono font-bold text-sm text-teal-800">+${getServicesTotal().toFixed(2)} USD</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Notas y peticiones especiales */}
                  <div className="pt-2 border-t border-neutral-100">
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Peticiones o notas especiales (Opcional)</label>
                    <textarea
                      value={bookingNote}
                      onChange={(e) => setBookingNote(e.target.value)}
                      placeholder="Ej: Llegada estimada a las 18:00, requerimos cuna para bebé o sábanas hipoalergénicas..."
                      className="w-full text-xs border border-neutral-200 rounded-xl p-2.5 focus:ring-1 focus:ring-teal-500 focus:outline-none h-16 bg-neutral-50/50 focus:bg-white resize-none shadow-xs"
                    />
                  </div>

                  {/* Step 2 Actions */}
                  <div className="pt-2 flex justify-between items-center border-t border-neutral-100">
                    <Button
                      type="button"
                      onClick={() => setBookingStep(1)}
                      variant="secondary" size="md"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Fechas</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => {
                        setBookingError(null);
                        setBookingStep(3);
                      }}
                      variant="primary" size="md"
                    >
                      <span>Continuar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIRMACIÓN Y PRE-FACTURA */}
              {bookingStep === 3 && (
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-5 animate-fade-in">
                  <div>
                    <h4 className="font-bold text-neutral-800 text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <span>Resumen de tu reserva</span>
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Revisa los detalles de tu reserva antes de confirmar y pagar.
                    </p>
                  </div>

                  {bookingSuccess ? (
                    <div className="bg-success-50 border border-success-300 text-success-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                      <Check className="w-5 h-5 text-success-600 shrink-0" />
                      <div>
                        <h5 className="font-semibold text-sm">Reserva registrada</h5>
                        <p className="text-xs text-success-700 mt-0.5">Te llevamos a "Mis reservas".</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateBooking} className="space-y-4">
                      {/* Resumen: estadía, detalle del pago y abono mínimo */}
                      {(() => {
                        const billing = getBookingTotal(bookingRoom.precio);
                        const nights = getNightsCount();
                        const servicesTotal = getServicesTotal();
                        const ivaIncluded = bookingRoom.adicionarIva === false;
                        const deposit = Math.round(billing.total * 20) / 100;
                        const row = (label: string, value: React.ReactNode, strong = false) => (
                          <div className="flex items-start justify-between gap-4 py-2">
                            <dt className="text-sm text-neutral-600">{label}</dt>
                            <dd className={`text-right text-sm ${strong ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-800'}`}>{value}</dd>
                          </div>
                        );
                        return (
                          <div className="space-y-4">
                            <section className="rounded-2xl border border-neutral-200 p-4">
                              <h5 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-navy1">Tu estadía</h5>
                              <dl className="divide-y divide-neutral-100">
                                {row(billing.isAlquiler ? 'Inmueble' : 'Habitación', `${bookingRoom.nombre} · N° ${bookingRoom.numero}`)}
                                {row(billing.isAlquiler ? 'Inicio' : 'Entrada', <>{formatYmd(checkInDate)}{activeHotel?.horarios?.checkIn && !billing.isAlquiler ? <span className="block text-xs font-medium text-neutral-500">desde las {activeHotel.horarios.checkIn}</span> : null}</>)}
                                {row(billing.isAlquiler ? 'Fin' : 'Salida', <>{formatYmd(checkOutDate)}{activeHotel?.horarios?.checkOut && !billing.isAlquiler ? <span className="block text-xs font-medium text-neutral-500">hasta las {activeHotel.horarios.checkOut}</span> : null}</>)}
                                {billing.isAlquiler
                                  ? row('Plazo', formatRentalMonths(rentalMonths))
                                  : row('Estancia', `${nights} ${nights === 1 ? 'noche' : 'noches'}`)}
                                {selectedServices.length > 0 && row('Servicios adicionales', `${selectedServices.length} ${selectedServices.length === 1 ? 'servicio' : 'servicios'}`)}
                              </dl>
                            </section>

                            <section className="rounded-2xl border border-neutral-200 p-4">
                              <h5 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-navy1">Detalle del pago</h5>
                              <dl className="divide-y divide-neutral-100">
                                {billing.isAlquiler ? (
                                  <>
                                    {row('Renta mensual', `$${billing.mensualidad.toFixed(2)}`)}
                                    {row('Garantía (reembolsable)', `$${billing.garantia.toFixed(2)}`)}
                                  </>
                                ) : (
                                  <>
                                    {row(`Hospedaje (${nights} ${nights === 1 ? 'noche' : 'noches'})`, `$${getBookingSubtotal(bookingRoom.precio).toFixed(2)}`)}
                                    {servicesTotal > 0 && row('Servicios adicionales', `$${servicesTotal.toFixed(2)}`)}
                                  </>
                                )}
                                {billing.tax > 0 && row(ivaIncluded ? 'IVA (incluido en el precio)' : 'IVA', `$${billing.tax.toFixed(2)}`)}
                              </dl>
                              <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-3">
                                <span className="text-sm font-bold text-neutral-900">{billing.isAlquiler ? 'Primer pago' : 'Total'}</span>
                                <span className="font-mono text-xl font-extrabold text-brand-navy1">${billing.total.toFixed(2)} USD</span>
                              </div>
                            </section>

                            <div className="flex items-start gap-3 rounded-2xl border border-info-200 bg-info-50 p-4">
                              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-700" />
                              <p className="text-sm text-neutral-700">
                                Para confirmar tu reserva paga al menos el <strong className="text-neutral-900">20% (${deposit.toFixed(2)} USD)</strong> en las próximas 24 horas, en línea o en el establecimiento. También puedes pagar el total.
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {bookingNote && (
                        <div className="rounded-2xl border border-neutral-200 p-4">
                          <h5 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-navy1">Tus notas</h5>
                          <p className="text-sm italic text-neutral-700">"{bookingNote}"</p>
                        </div>
                      )}

                      {/* Guest prompt indicator */}
                      {activeUser.id === 'guest' && (
                        <div className="p-3 bg-info-50 border border-info-200 rounded-xl text-info-900 text-xs flex items-center gap-2">
                          <Info className="w-4 h-4 text-info-600 shrink-0" />
                          <span>Al confirmar, se abrirá la ventana para iniciar sesión o crear tu cuenta de huésped.</span>
                        </div>
                      )}

                      {/* Step 3 Actions */}
                      <div className="pt-2 flex justify-between items-center border-t border-neutral-100">
                        <Button
                          type="button"
                          onClick={() => setBookingStep(2)}
                          variant="secondary" size="md"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Servicios</span>
                        </Button>

                        <Button
                          type="submit"
                          variant="primary" size="md"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Reservar</span>
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            // HOTEL DETAIL PAGE & AVAILABLE ROOMS (mismo formato que la ficha de habitación: una columna centrada)
            <div className="space-y-5 animate-fade-in max-w-4xl mx-auto" key={selectedHotelId || 'none'}>
              <HeaderBackButton
                onClick={() => {
                  setSelectedHotelId(null);
                  if (onOpenHotelChange) onOpenHotelChange(null);
                }}
              />

              <HotelImageGallery
                imagenes={activeHotel?.imagenes || []}
                portada={activeHotel?.portada || ''}
                hotelNombre={activeHotel?.nombre || ''}
                isPageTitle
              />

              {/* Información de estadía y mapa, justo debajo de la galería */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-3">
                  <h4 className="font-bold text-brand-navy1 text-sm">Información de estadía</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-neutral-50 p-2.5">
                      <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Check-in</span>
                      <span className="block text-sm font-bold text-brand-navy1">{activeHotel?.horarios.checkIn} hrs</span>
                    </div>
                    <div className="rounded-xl bg-neutral-50 p-2.5">
                      <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Check-out</span>
                      <span className="block text-sm font-bold text-brand-navy1">{activeHotel?.horarios.checkOut} hrs</span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Contacto de reservas</span>
                    {activeHotel?.contacto.email && (
                      <a href={`mailto:${activeHotel.contacto.email}`} className="block truncate text-sm font-semibold text-brand-navy1 hover:underline">{activeHotel.contacto.email}</a>
                    )}
                    {activeHotel?.contacto.telefono && (
                      <a href={`tel:${activeHotel.contacto.telefono}`} className="block text-sm text-neutral-500 hover:underline">{activeHotel.contacto.telefono}</a>
                    )}
                  </div>
                  {activeHotel?.politicas && activeHotel.politicas.length > 0 && (
                    <div>
                      <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500 mb-1">Políticas</span>
                      <ul className="space-y-1 list-disc pl-4 text-sm text-brand-navy1">
                        {activeHotel.politicas.map((pol, idx) => (
                          <li key={idx}>{pol}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-brand-navy1 text-sm">Ubicación</h4>
                    {activeHotel?.googleMapsUrl && activeHotel.googleMapsUrl.startsWith('http') && (
                      <a
                        href={activeHotel.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-info-600 hover:underline"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Abrir en Maps</span>
                      </a>
                    )}
                  </div>
                  <div className="min-h-44 flex-1 rounded-xl border border-neutral-200 overflow-hidden relative">
                    {(() => {
                      const embedSrc = getMapEmbedUrl(activeHotel?.ubicacion || '', activeHotel?.googleMapsUrl);
                      if (!embedSrc) {
                        return (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-neutral-50 text-neutral-500">
                            <MapPin className="w-6 h-6 mb-1" />
                            <p className="text-xs text-center">Sin ubicación configurada</p>
                          </div>
                        );
                      }
                      return (
                        <iframe
                          title={`Mapa de ${activeHotel?.nombre}`}
                          className="absolute inset-0 h-full w-full"
                          style={{ border: 0 }}
                          src={embedSrc}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Descripción y servicios incluidos */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="font-bold text-brand-navy1 text-sm">Sobre este lugar</h4>
                {activeHotel?.descripcion && (
                  <p className="text-sm text-neutral-700 leading-relaxed">{activeHotel.descripcion}</p>
                )}
                {activeHotel && activeHotel.servicios.length > 0 && (
                  <div>
                    <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500 mb-2">Servicios incluidos</span>
                    <div className="flex flex-wrap gap-2">
                      {activeHotel.servicios.map((serv, i) => (
                        <span key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-brand-navy1">
                          {serv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Precio y detalle del inmueble (casas y departamentos) */}
              {activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-brand-navy1 text-sm">Detalle del inmueble</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {activeHotel.finalidad === 'venta'
                          ? 'En venta · sujeto a escritura pública y negociación directa'
                          : `En alquiler mensual · contrato mínimo de ${formatRentalMonths(getRentalMinMonths(activeHotel))}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block font-mono text-lg font-extrabold leading-tight text-brand-navy1">${(activeHotel.detallesInmueble?.precio || 0).toLocaleString()}</span>
                      <span className="block text-xs text-neutral-500">{activeHotel.finalidad === 'venta' ? 'USD' : 'USD / mes'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: 'Habitaciones', value: String(activeHotel.detallesInmueble?.habitaciones || 1) },
                      { label: 'Baños', value: String(activeHotel.detallesInmueble?.banos || 1) },
                      { label: 'Superficie', value: `${activeHotel.detallesInmueble?.metrosCuadrados || 40} m²` },
                      { label: 'Garaje', value: activeHotel.detallesInmueble?.tieneEstacionamiento ? 'Incluido' : 'No' },
                      { label: 'Condición', value: activeHotel.detallesInmueble?.amueblado !== false ? 'Amoblado' : 'Sin amoblar' }
                    ].map(spec => (
                      <div key={spec.label} className="rounded-xl bg-neutral-50 p-2.5 last:col-span-2 sm:last:col-span-1">
                        <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">{spec.label}</span>
                        <span className="block text-sm font-bold text-brand-navy1">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                  {activeHotel.finalidad !== 'venta' && activeHotel.propietario && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 p-2.5">
                      <div>
                        <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Propietario</span>
                        <span className="block text-sm font-bold text-brand-navy1">{activeHotel.propietario.nombre}</span>
                      </div>
                      {/* Solo datos públicos del propietario: correo y cédula son privados */}
                      {activeHotel.propietario.telefono && (
                        <a href={`tel:${activeHotel.propietario.telefono}`} className="text-sm font-semibold text-brand-navy1 hover:underline">{activeHotel.propietario.telefono}</a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* LIST OF SUITES AVAILABLE IN THIS HOTEL */}
              {activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') ? (
                activeHotel.finalidad === 'venta' ? (
                  /* Propiedad en venta: solo el contacto del propietario (sin calendario ni reservas) */
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in">
                    <div>
                      <h4 className="font-bold text-brand-navy1 text-sm">Contacto del propietario</h4>
                      <p className="text-sm text-neutral-500 mt-0.5">Para consultas de compra, visitas o propuestas, comunícate directamente con el propietario.</p>
                    </div>
                    {activeHotel.propietario ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 p-3">
                        <div>
                          <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Propietario</span>
                          <span className="block text-sm font-bold text-brand-navy1">{activeHotel.propietario.nombre}</span>
                        </div>
                        {/* Correo y cédula del propietario son privados: no se muestran al público */}
                        {activeHotel.propietario.telefono && (
                          <Button
                            onClick={() => {
                              const url = `https://wa.me/${activeHotel.propietario.telefono.replace(/[^0-9]/g, '')}`;
                              window.open(url, (window as any).Capacitor ? '_system' : '_blank', 'noopener,noreferrer');
                            }}
                            variant="primary" size="md"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500">La información de contacto no está disponible por ahora.</p>
                    )}
                  </div>
                ) : (
                  /* Casa o departamento completo en alquiler */
                  (() => {
                    const isIvaAdded = activeHotel.detallesInmueble?.adicionarIva !== undefined
                      ? activeHotel.detallesInmueble.adicionarIva !== false
                      : (activeHotel.adicionarIva !== false);
                    return (
                      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                        <div className="min-w-0">
                          <h4 className="font-bold text-brand-navy1 text-sm">
                            Alquila {activeHotel.tipoEstablecimiento === 'casa' ? 'la casa completa' : 'el departamento completo'}
                          </h4>
                          <p className="text-sm text-neutral-500 mt-0.5">
                            ${activeHotel.detallesInmueble?.precio || 150} USD al mes · mínimo {formatRentalMonths(getRentalMinMonths(activeHotel))} · {isIvaAdded ? 'más 16% de IVA' : 'IVA incluido'}
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            const syntheticRoom: Room = {
                              id: `room-full-${activeHotel.id}`,
                              hotelId: activeHotel.id,
                              nombre: activeHotel.nombre,
                              numero: 'Full',
                              tipo: activeHotel.tipoEstablecimiento === 'casa' ? 'Suite Presidencial' : 'Suite',
                              precio: activeHotel.detallesInmueble?.precio || 150,
                              capacidad: (activeHotel.detallesInmueble?.habitaciones || 2) * 2,
                              camas: activeHotel.detallesInmueble?.habitaciones || 2,
                              descripcion: activeHotel.descripcion,
                              imagenes: activeHotel.imagenes,
                              servicios: activeHotel.servicios,
                              estado: 'disponible',
                              adicionarIva: isIvaAdded
                            };
                            setBookingRoom(syntheticRoom);
                          }}
                          variant="primary" size="md" className="shrink-0"
                        >
                          <span>Alquilar</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })()
                )
              ) : (
                /* LIST OF SUITES AVAILABLE IN THIS HOTEL (HOTELES TRADICIONALES EN SU CLASE) */
                <div className="space-y-4 pt-2">
                  <div>
                    <h4 className="font-semibold text-brand-navy1 text-xl font-display">Habitaciones</h4>
                    <p className="text-sm text-neutral-500 mt-0.5">Elige tu habitación y filtra por precio, capacidad o tipo.</p>
                  </div>

                  {/* Filtros de habitaciones: mismo formato que los del catálogo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <OptionPicker
                      label="Ordenar por precio"
                      icon={ArrowUpDown}
                      value={roomSortOrder}
                      emptyValue=""
                      placeholder="Por número de habitación"
                      options={[
                        { value: '', label: 'Por número de habitación' },
                        { value: 'asc', label: 'De menor a mayor precio' },
                        { value: 'desc', label: 'De mayor a menor precio' }
                      ]}
                      onChange={(v) => setRoomSortOrder(v as 'asc' | 'desc' | '')}
                    />

                    <OptionPicker
                      label="Personas"
                      icon={UsersIcon}
                      value={roomCapacity}
                      emptyValue=""
                      placeholder="Seleccionar número de personas"
                      options={[
                        { value: '', label: 'Cualquier número de personas' },
                        { value: '1-2', label: '1 a 2 personas' },
                        { value: '3-4', label: '3 a 4 personas' },
                        { value: '5-6', label: '5 a 6 personas' }
                      ]}
                      onChange={setRoomCapacity}
                    />

                    <OptionPicker
                      label="Tipo de habitación"
                      icon={Tag}
                      value={roomTypeFilter}
                      emptyValue=""
                      placeholder="Seleccionar tipo de habitación"
                      options={[
                        { value: '', label: 'Todos los tipos' },
                        ...Array.from(new Set(rooms.filter(r => r.hotelId === selectedHotelId).map(r => r.tipo))).map(type => ({ value: type, label: type }))
                      ]}
                      onChange={setRoomTypeFilter}
                    />

                    {/* Precio máximo: mismo tamaño y textos que los selectores */}
                    <form
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 shadow-sm focus-within:border-brand-cyan"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = parseInt(roomMaxPriceInput);
                        setRoomMaxPrice(isNaN(val) ? 999999 : val);
                      }}
                    >
                      <DollarSign className="h-4 w-4 shrink-0 text-neutral-500" />
                      <label className="min-w-0 flex-1">
                        <span className="block text-micro font-semibold uppercase tracking-wider text-neutral-500">Precio máximo por noche</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="Escribir precio máximo"
                          value={roomMaxPriceInput}
                          onChange={(e) => setRoomMaxPriceInput(e.target.value)}
                          className="block w-full bg-transparent text-sm font-semibold text-brand-navy1 placeholder:text-brand-navy1 focus:outline-none"
                        />
                      </label>
                      <Button type="submit" variant="primary" size="sm" className="shrink-0">
                        <Search className="w-3.5 h-3.5" />
                        <span>Buscar</span>
                      </Button>
                    </form>
                  </div>

                  <div id="habitaciones-listado" className="space-y-4 scroll-mt-24">
                    {isLoading ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2.5 p-3.5 bg-gradient-to-r from-teal-50/90 via-info-50/70 to-teal-50/90 border border-teal-200/80 rounded-2xl text-xs text-teal-800 shadow-sm">
                          <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0" />
                          <span className="font-semibold">Cargando habitaciones y disponibilidad...</span>
                        </div>
                        <div className="space-y-4">
                          {[1, 2, 3].map(item => (
                            <div key={item} className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-sm flex flex-col md:flex-row gap-6 animate-pulse">
                              <div className="w-full md:w-56 h-36 bg-neutral-200 rounded-xl shrink-0" />
                              <div className="flex-1 space-y-3">
                                <div className="flex gap-2">
                                  <div className="h-5 w-24 bg-neutral-200 rounded-full" />
                                  <div className="h-5 w-20 bg-teal-100 rounded-full" />
                                </div>
                                <div className="h-6 w-1/2 bg-neutral-200 rounded-lg" />
                                <div className="h-3 w-3/4 bg-neutral-100 rounded-lg" />
                                <div className="flex gap-2 pt-2">
                                  <div className="h-4 w-16 bg-neutral-100 rounded-lg" />
                                  <div className="h-4 w-16 bg-neutral-100 rounded-lg" />
                                </div>
                              </div>
                              <div className="flex md:flex-col justify-between items-end shrink-0 pt-2 md:pt-0">
                                <div className="h-6 w-24 bg-teal-100 rounded-lg" />
                                <div className="h-9 w-28 bg-teal-200/70 rounded-xl" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : roomsInActiveHotel.length === 0 ? (
                      <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-200 text-center text-neutral-500 py-12">
                        <p className="text-sm font-medium">No se encontraron habitaciones para mostrar con el filtro seleccionado.</p>
                        {showOnlyAvailableRooms && (
                          <Button
                            onClick={() => setShowOnlyAvailableRooms(false)}
                            variant="secondary" size="sm" className="mt-3"
                          >
                            Ver todas las habitaciones
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {pagedRooms.map(room => {
                        const isAvailable = room.estado === 'disponible';
                        const isBookable = room.estado !== 'mantenimiento';
                        return (
                          <motion.div
                            key={room.id}
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            whileHover={isBookable ? { y: -3, scale: 1.005 } : {}}
                            transition={{ duration: 0.3 }}
                            onClick={() => {
                              if (isBookable) {
                                setBookingRoom(room);
                              }
                            }}
                            className={`bg-white rounded-2xl p-4 border transition-all flex flex-col md:flex-row gap-6 ${
                              isBookable
                                ? 'border-neutral-200 hover:shadow-sm hover:border-teal-400 cursor-pointer group'
                                : 'border-neutral-100 opacity-65 cursor-not-allowed'
                            }`}
                          >
                            {/* Animated Photo Gallery Thumbnail */}
                            <RoomImageGallery imagenes={room.imagenes} roomNombre={room.nombre} disableLightbox={true} />

                            {/* Middle detail content */}
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <span className="px-2.5 py-0.5 rounded-full text-micro bg-neutral-100 text-neutral-600 font-semibold uppercase tracking-wider font-mono border border-neutral-200">
                                    Habitación {room.numero}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-micro bg-teal-50 text-teal-700 font-semibold uppercase tracking-wider border border-teal-100">
                                    {room.tipo}
                                  </span>
                                  {room.estado !== 'disponible' && (
                                    <span className={`px-2.5 py-0.5 rounded-full text-micro font-semibold uppercase tracking-wider border ${
                                      room.estado === 'mantenimiento' ? 'bg-danger-50 text-danger-700 border-danger-200 font-bold' : 'bg-warning-50 text-warning-700 border-warning-200 font-medium'
                                    }`}>
                                      {room.estado}
                                    </span>
                                  )}
                                </div>

                                <h5 className="font-semibold text-neutral-800 group-hover:text-teal-700 transition-colors text-base mb-1">{room.nombre}</h5>
                                <p className="text-xs text-neutral-500 leading-normal line-clamp-2 md:max-w-xl">{room.descripcion}</p>
                              </div>

                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {room.servicios.slice(0, 4).map((srv, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-neutral-50 text-neutral-600 text-micro rounded-lg border border-neutral-100">
                                    {srv}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Pricing and reservation CTA button */}
                            <div className="w-full md:w-44 pt-4 md:pt-0 md:pl-6 border-t md:border-t-0 md:border-l border-neutral-100 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-3 shrink-0">
                              <div className="text-left md:text-right">
                                <span className="text-micro text-neutral-400 block font-semibold uppercase tracking-wider">PRECIO POR NOCHE</span>
                                <span className="font-mono font-bold text-neutral-900 text-lg">${room.precio} USD</span>
                                <span className="text-micro text-neutral-500 block">Capacidad: {room.capacidad} personas ({room.camas} {room.camas > 1 ? 'camas' : 'cama'})</span>
                              </div>

                              {isBookable ? (
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBookingRoom(room);
                                  }}
                                  variant="primary" size="md"
                                >
                                  <span>Reservar</span>
                                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </Button>
                              ) : (
                                <button
                                  disabled
                                  className="px-4 py-2 bg-neutral-100 border border-neutral-200 text-neutral-400 font-medium text-xs rounded-xl transition-all cursor-not-allowed uppercase text-micro tracking-wider"
                                >
                                  Mantenimiento
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                        <Pager page={safeRoomPage} pageSize={ROOMS_PER_PAGE} total={roomsInActiveHotel.length} onChange={setRoomPage} scrollToId="habitaciones-listado" noun="habitaciones" />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Opiniones de huéspedes (hoteles y propiedades en alquiler) */}
              {!(activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') && activeHotel.finalidad === 'venta') && (() => {
                const hotelReviews = reviews.filter(r => r.hotelId === selectedHotelId);
                const total = hotelReviews.length;
                const average = total > 0 ? hotelReviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
                const isAnon = (r: typeof hotelReviews[number]) => r.isAnonymous || r.userName === 'Anónimo';
                const stars = (rating: number, size: string) => (
                  <div className="flex gap-0.5" aria-label={`${rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`${size} ${i < Math.round(rating) ? 'text-warning-500 fill-current' : 'text-neutral-200'}`} />
                    ))}
                  </div>
                );
                return (
                  <section className="space-y-4 pt-2">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-brand-navy1 text-xl font-display">Opiniones de huéspedes</h4>
                        <p className="text-sm text-neutral-500 mt-0.5">Calificaciones de personas que ya se hospedaron aquí.</p>
                      </div>
                      {total > 0 && (
                        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 shadow-sm">
                          <span className="font-mono text-2xl font-extrabold leading-none text-brand-navy1">{average.toFixed(1)}</span>
                          <div>
                            {stars(average, 'w-3.5 h-3.5')}
                            <span className="block text-xs text-neutral-500 mt-0.5">{total} {total === 1 ? 'opinión' : 'opiniones'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {total === 0 ? (
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
                        <Star className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
                        <p className="text-sm font-semibold text-brand-navy1 text-center">Todavía no hay opiniones</p>
                        <p className="text-sm text-neutral-500 mt-0.5 text-center">Después de tu estadía podrás dejar la tuya.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {hotelReviews.map(rev => (
                          <article key={rev.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm space-y-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy1 text-xs font-bold uppercase text-white">
                                  {isAnon(rev) ? 'AN' : (rev.userName ? rev.userName.slice(0, 2) : 'HU')}
                                </div>
                                <div className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-brand-navy1">
                                    {isAnon(rev) ? 'Anónimo' : (rev.userName || 'Huésped')}
                                  </span>
                                  <span className="block text-xs text-neutral-500">{rev.fecha}</span>
                                </div>
                              </div>
                              {stars(rev.rating, 'w-3.5 h-3.5')}
                            </div>
                            <p className="text-sm text-neutral-700 leading-relaxed">
                              {rev.comentario || 'Sin comentario.'}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })()}
            </div>
          )}

        </div>
      )}

      {/* RESERVATIONS TAB */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          {activeUser.id === 'guest' ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-sm">
              <Lock className="w-12 h-12 text-teal-600 mb-3 animate-pulse" />
              <h4 className="font-semibold text-neutral-800 text-base">Acceso para Miembros de Roomia</h4>
              <p className="text-xs text-neutral-500 leading-normal max-w-xs mt-1.5">
                Inicia sesión o regístrate para consultar tus reservas, descargar pre-facturas y subir comprobantes de pago.
              </p>
              <Button
                onClick={onTriggerLogin}
                variant="primary" size="md" className="mt-4"
              >
                Iniciar sesión / Registrarse
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-xl font-semibold text-neutral-800">Mi Expediente de Huésped</h3>
                <p className="text-xs text-neutral-400">Administra tus reservas, muestra el código QR en recepción para el check-in y descarga tu pre-factura en PDF.</p>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 p-3.5 bg-gradient-to-r from-teal-50/90 via-info-50/70 to-teal-50/90 border border-teal-200/80 rounded-2xl text-xs text-teal-800 shadow-sm">
                    <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0" />
                    <span className="font-semibold">Cargando reservaciones y expedientes...</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2].map(item => (
                      <div key={item} className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-sm space-y-4 animate-pulse">
                        <div className="flex justify-between items-center">
                          <div className="h-5 w-32 bg-neutral-200 rounded-lg" />
                          <div className="h-6 w-20 bg-teal-100 rounded-full" />
                        </div>
                        <div className="h-4 w-48 bg-neutral-200 rounded-lg" />
                        <div className="h-12 w-full bg-neutral-100 rounded-xl" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : myReservations.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
              <CalendarCheck className="w-12 h-12 text-neutral-300 mb-3" />
              <h4 className="font-semibold text-neutral-700 text-base">Sin reservaciones registradas</h4>
              <p className="text-xs text-neutral-500 leading-normal max-w-xs mt-1.5">
                Actualmente no cuenta con estadías o contratos de alquiler registrados en el sistema. ¡Explore nuestras opciones para realizar su primera reserva!
              </p>
              <Button
                onClick={() => setActiveTab('explore')}
                variant="primary" size="md" className="mt-4"
              >
                Explorar alojamientos
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {myReservations.map(res => {
                const hotel = hotels.find(h => h.id === res.hotelId);
                const room = rooms.find(r => r.id === res.roomId);

                return (
                  <div key={res.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm flex flex-col justify-between">
                    
                    {/* Header bar within reservation item */}
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                      <div>
                        <span className="font-mono text-xs font-bold text-neutral-800 uppercase bg-white px-2 py-0.5 rounded-lg border border-neutral-200">
                          Reserva {res.id}
                        </span>
                        <span className="text-micro text-neutral-400 font-medium ml-2">Registrado: {res.fechaRegistro}</span>
                      </div>
                      
                      <span className={`px-2.5 py-0.5 rounded-full text-micro font-semibold uppercase ${
                        res.estado === 'confirmada' ? 'bg-success-50 text-success-700 border border-success-100' :
                        res.estado === 'pendiente' ? 'bg-warning-50 text-warning-600 border border-warning-100' :
                        res.estado === 'ocupada' ? 'bg-info-50 text-info-700 border border-info-100' :
                        res.estado === 'finalizada' ? 'bg-neutral-100 text-neutral-600 border border-neutral-200' :
                        'bg-danger-50 text-danger-700 border border-danger-100'
                      }`}>
                        {res.estado === 'pendiente' ? 'Reservación pendiente de pago' :
                         res.estado === 'confirmada' ? 'Reservada' :
                         res.estado === 'ocupada' ? 'Ocupada' :
                         res.estado === 'finalizada' ? 'Finalizada' :
                         res.estado === 'cancelada' ? 'Cancelada' : res.estado}
                      </span>
                    </div>

                    {/* Live 24-hour countdown for pending payment */}
                    <ReservationCountdown reservation={res} />

                    {/* Meta specifics */}
                    <div className="p-5 flex gap-4">
                      {/* Mini visual indicator or thumbnail logo */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100 self-start">
                        <img src={hotel?.logo} alt={hotel?.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-neutral-800 text-sm">{hotel?.nombre || 'Hotel Roomia'}</h4>
                        <p className="text-xs text-teal-700 font-medium">Habitación {room?.numero || 'S/N'} - {room?.nombre}</p>
                        
                        <div className="flex items-center gap-1.5 text-micro text-neutral-500 pt-1">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Del {res.fechaEntrada} al {res.fechaSalida}</span>
                        </div>

                        {res.serviciosAdicionales.length > 0 && (
                          <p className="text-micro text-neutral-400 leading-normal truncate">
                            Extras: {res.serviciosAdicionales.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {res.modificadoPor && (
                      <div className="mx-5 mb-5 p-3 rounded-xl bg-warning-50/70 border border-warning-200 text-warning-900 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5 font-bold text-micro mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse shrink-0" />
                          <span>Modificado por: <span className="text-warning-800 font-extrabold">{res.modificadoPor}</span></span>
                          {res.fechaCambio && (
                            <span className="font-normal text-micro text-warning-600 ml-auto font-mono">
                              {new Date(res.fechaCambio).toLocaleDateString()} {new Date(res.fechaCambio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                        <p className="text-micro leading-relaxed italic bg-white/80 p-2 rounded-lg border border-warning-100/60 mt-1">
                          "{res.mensajeCambio || 'No se proporcionó un mensaje de justificación.'}"
                        </p>
                      </div>
                    )}

                    {/* Bottom active toolbar */}
                    <div className="p-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-micro text-neutral-400 block font-medium uppercase tracking-wider">MONTO TOTAL NETO</span>
                        <span className="font-mono font-bold text-neutral-900">${res.total.toFixed(2)} USD</span>
                        {res.montoPagado !== undefined && res.montoPagado > 0 && res.montoPendiente !== undefined && res.montoPendiente > 0 && (
                          <div className="flex gap-2 text-micro mt-0.5 font-medium">
                            <span className="text-success-700">Abonado (20%): ${res.montoPagado.toFixed(2)}</span>
                            <span className="text-warning-700 font-bold">Pendiente (80%): ${res.montoPendiente.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setPreviewingRes(res)}
                          variant="secondary" size="sm"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          <span>Pre-Factura / QR</span>
                        </Button>

                        {(res.estado === 'pendiente' || (res.estado === 'confirmada' && res.montoPendiente !== undefined && res.montoPendiente > 0)) && (
                          <>
                            {renderOnlinePayButtons(res, 'sm')}
                            <Button
                              onClick={() => {
                                setSelectedResForPayment(res);
                                setShowPaymentModal(true);
                              }}
                              variant="secondary"
                              size="sm"
                              leftIcon={<FileText className="w-3.5 h-3.5" />}
                            >
                              <span>Instrucciones de pago</span>
                            </Button>
                          </>
                        )}

                        {(res.estado === 'confirmada' || res.estado === 'pendiente') && (
                          confirmCancelId === res.id ? (
                            <div className="flex items-center gap-1 bg-danger-50 p-1 rounded-xl border border-danger-200">
                              <button
                                onClick={() => setConfirmCancelId(null)}
                                className="px-2 py-1 text-micro font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                              >
                                Volver
                              </button>
                              <Button
                                onClick={() => {
                                  onCancelReservation(res.id);
                                  setConfirmCancelId(null);
                                }}
                                variant="danger" size="sm"
                              >
                                Sí, Cancelar
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmCancelId(res.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-danger-50 text-danger-600 rounded-lg cursor-pointer transition-colors text-micro font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Cancelar</span>
                            </button>
                          )
                        )}

                        {(res.estado === 'finalizada' || res.estado === 'cancelada') && onDeleteReservation && (
                          confirmDeleteId === res.id ? (
                            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-micro font-semibold text-neutral-600 hover:bg-neutral-200 rounded-lg cursor-pointer"
                              >
                                Volver
                              </button>
                              <Button
                                onClick={() => {
                                  onDeleteReservation(res.id);
                                  setConfirmDeleteId(null);
                                }}
                                variant="primary" size="sm"
                              >
                                Sí, Eliminar
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(res.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-danger-50 hover:text-danger-700 text-neutral-500 rounded-lg cursor-pointer transition-colors text-micro font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar del Historial</span>
                            </button>
                          )
                        )}

                        {res.estado === 'finalizada' && (() => {
                          const hasReviewed = reviews?.some(r => r.reservationId === res.id);
                          if (hasReviewed) {
                            const rev = reviews?.find(r => r.reservationId === res.id);
                            return (
                              <div className="flex items-center gap-1 bg-warning-50 text-warning-700 px-2.5 py-1.5 rounded-lg text-micro font-bold border border-warning-200">
                                <Star className="w-3.5 h-3.5 fill-current text-warning-500" />
                                <span>Valorado ({rev?.rating} ★)</span>
                              </div>
                            );
                          }
                          return (
                            <Button
                              onClick={() => {
                                setSelectedResForReview(res);
                                setReviewRating(5);
                                setReviewComentario('');
                                setIsAnonymousReview(false);
                                setShowReviewModal(true);
                              }}
                              variant="secondary" size="sm"
                            >
                              <Star className="w-3.5 h-3.5 fill-current text-warning-500" />
                              <span>Valorar estancia</span>
                            </Button>
                          );
                        })()}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  )}

      {/* PREVIEW ACTIVE PRE-FACTURA PDF MODAL */}
      {previewingRes && (
        <InvoicePDF
          reservation={previewingRes}
          hotel={hotels.find(h => h.id === previewingRes.hotelId)}
          room={rooms.find(r => r.id === previewingRes.roomId)}
          guest={activeUser}
          onClose={() => setPreviewingRes(null)}
        />
      )}

      {/* 💳 SECURE CHECKOUT MODAL OVERLAY */}
      <AnimatePresence>
        {showPaymentModal && selectedResForPayment && (
          <Modal
            open
            onClose={() => setShowPaymentModal(false)}
            size="md"
            title="Instrucciones de pago"
            subtitle="Tu reserva queda retenida por 24 horas, pendiente de pago"
            bodyClassName="p-0"
          >

          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 uppercase tracking-wide text-micro block">CÓDIGO DE RESERVA</span>
                <span className="font-mono font-bold text-neutral-800">{selectedResForPayment.id}</span>
              </div>
              <div className="h-px bg-neutral-200/50" />
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 uppercase tracking-wide text-micro block ">VALOR TOTAL DE LA ESTADÍA</span>
                <span className="font-mono font-bold text-neutral-800 text-sm">${selectedResForPayment.total.toFixed(2)} USD</span>
              </div>
              <div className="h-px bg-neutral-200/50" />
              <div className="flex justify-between items-center bg-teal-50/50 p-1.5 rounded-lg border border-teal-100">
                <span className="text-teal-800 uppercase tracking-wide text-micro block font-semibold">SEÑAL DE RESERVA (20%)</span>
                <span className="font-mono font-bold text-teal-600 text-sm">${(selectedResForPayment.total * 0.20).toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between items-center bg-neutral-100/70 p-1.5 rounded-lg text-neutral-600">
                <span className="uppercase tracking-wide text-micro block font-semibold">SALDO RESTANTE AL CHECK-IN (80%)</span>
                <span className="font-mono font-medium text-xs">${(selectedResForPayment.total * 0.80).toFixed(2)} USD</span>
              </div>
            </div>

            {/* PAYPHONE DIRECT PAYMENT CARD */}
            <div className="p-4 bg-gradient-to-br from-info-50 to-neutral-50 rounded-2xl border border-info-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-brand-navy1 text-white rounded-lg text-xs font-bold">Payphone</span>
                  <h5 className="font-bold text-neutral-900 text-xs">Pago Directo en Línea</h5>
                </div>
                <span className="text-micro font-semibold text-info-700 bg-info-100 px-2 py-0.5 rounded-full">Recomendado</span>
              </div>

              <p className="text-micro text-neutral-600 leading-relaxed">
                Paga con tarjeta de crédito o débito, o con tu cuenta Payphone. Tu reserva se confirma
                al instante y recibes el comprobante por correo.
              </p>

              <div className="bg-white/90 p-3 rounded-xl border border-info-100 space-y-2 text-micro text-neutral-700">
                {renderOnlinePayButtons(selectedResForPayment, 'lg') ?? (
                  <p className="text-neutral-600">Esta reserva no tiene pagos en línea pendientes.</p>
                )}
                {isNativeApp() && (
                  <p className="text-micro text-neutral-500 leading-normal">
                    El pago se abre en el navegador de tu teléfono. Al terminar, toca "Ver mis reservas" para volver a Roomia.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-warning-50 rounded-xl border border-warning-200 text-warning-900 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Importante: tienes 24 horas para pagar</p>
                  <p className="text-micro leading-relaxed text-warning-800">
                    Tu reserva quedó registrada como <strong>"Pendiente de pago"</strong>. Tienes <strong>24 horas</strong> para pagar el abono.
                  </p>
                  <p className="text-micro leading-relaxed text-warning-800 font-semibold mt-1 bg-white/70 p-2 rounded-lg border border-warning-100">
                    <strong>Requisito mínimo:</strong> paga al menos el <strong>20% de la estadía (${(selectedResForPayment.total * 0.20).toFixed(2)} USD)</strong> para que tu reserva pase de "Pendiente" a "Reservada". También puedes pagar el total de <strong>${selectedResForPayment.total.toFixed(2)} USD</strong>.
                  </p>
                  <p className="text-micro leading-relaxed text-warning-600 mt-1">
                    Si pasadas las 24 horas no se registra al menos ese pago mínimo, la reserva se cancela automáticamente.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-neutral-900 text-xs flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Otros métodos de pago (Transferencia / Depósito / Efectivo):
                </h5>
                <ul className="list-decimal pl-4.5 space-y-1.5 text-neutral-600 leading-normal text-micro">
                  <li>
                    Póngase en contacto con el administrador o recepcionista correspondiente (mediante nuestro chat en vivo o del hostal).
                  </li>
                  <li>
                    Suministre su id de reserva <strong>{selectedResForPayment.id}</strong> para que ubiquen su transacción.
                  </li>
                  <li>
                    Efectúe el pago por el valor total de <strong>${selectedResForPayment.total.toFixed(2)} USD</strong> o abone el depósito del 20% de <strong>${(selectedResForPayment.total * 0.20).toFixed(2)} USD</strong> (en Payphone, efectivo, depósito bancario o transferencia).
                  </li>
                  <li>
                    Cuando el establecimiento lo confirme, tu reserva pasará a <strong>"Reservada"</strong> y recibirás un correo de confirmación.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3">
              <Button
                onClick={() => {
                  setShowPaymentModal(false);
                  setActiveTab('reservations');
                }}
                variant="primary" size="md" className="w-full"
              >
                Entendido, ir a Mis Reservaciones
              </Button>
              <Button
                onClick={() => {
                  setShowPaymentModal(false);
                  const triggerSupportBtn = document.getElementById('support-chat-trigger-btn') || document.querySelector('[aria-label="support-chat"]') as HTMLElement;
                  if (triggerSupportBtn) {
                    triggerSupportBtn.click();
                  } else {
                    notify.info('Escríbenos por correo o desde el chat de soporte para agilizar tu pago.');
                  }
                }}
                variant="secondary" size="md" className="w-full"
              >
                <span>Contactar Administrador vía Chat</span>
              </Button>
            </div>
          </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ⭐ VALORACIÓN Y CALIFICACIÓN DE ESTANCIA COMPLETADA MODAL */}
      <AnimatePresence>
        {showReviewModal && selectedResForReview && (
          <Modal
            open
            onClose={() => {
              setShowReviewModal(false);
              setSelectedResForReview(null);
            }}
            size="md"
            bodyClassName="p-0"
            title="Valorar estancia"
            subtitle={`Reserva ${selectedResForReview.id}`}
          >
          <div className="p-6">
            <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 text-xs text-neutral-600 mb-5 space-y-1">
              <p className="font-extrabold text-neutral-800">Establecimiento:</p>
              <p className="font-semibold text-teal-800">
                {hotels.find(h => h.id === selectedResForReview.hotelId)?.nombre || 'Hotel Premium'}
              </p>
              <p className="text-micro text-neutral-400">
                Estadía del {selectedResForReview.fechaEntrada} al {selectedResForReview.fechaSalida}
              </p>
            </div>

            <div className="space-y-4">
              {/* STAR SELECTION */}
              <div className="text-center space-y-1.5 bg-neutral-50/40 p-4 rounded-2xl border border-dashed border-neutral-200">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">¿Cómo calificarías tu experiencia?</label>
                <div className="flex justify-center gap-2 pt-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const starValue = i + 1;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReviewRating(starValue)}
                        className="text-warning-500 hover:scale-115 transition-transform cursor-pointer select-none"
                      >
                        <Star 
                          className={`w-8 h-8 ${
                            starValue <= reviewRating ? 'fill-current text-warning-500' : 'text-neutral-300'
                          }`} 
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-micro font-bold text-neutral-700 block mt-1">
                  {reviewRating === 5 ? '¡Excelente servicio! 🤩' :
                   reviewRating === 4 ? 'Muy buena estadía 😊' :
                   reviewRating === 3 ? 'Aceptable 😐' :
                   reviewRating === 2 ? 'Deficiente o mejorable 😕' : 'Inaceptable o mala experiencia 😞'}
                </span>
              </div>

              {/* PUBLICAR COMO ANÓNIMO */}
              <div className="flex items-center justify-between bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-neutral-700 block">Publicar de forma anónima</label>
                  <p className="text-micro text-neutral-400">Oculta su nombre real en la reseña pública</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnonymousReview(!isAnonymousReview)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all ${
                    isAnonymousReview ? 'bg-teal-600' : 'bg-neutral-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                      isAnonymousReview ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* COMENTARIO */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 block">Escribe tu opinión sincera (obligatorio)</label>
                <textarea
                  required
                  value={reviewComentario}
                  onChange={(e) => setReviewComentario(e.target.value)}
                  placeholder="Mencione la atención, comodidad, limpieza y servicios recibidos..."
                  className="w-full text-xs border border-neutral-100 rounded-2xl p-3 focus:ring-1 focus:ring-teal-500 focus:outline-none h-24 bg-white"
                />
              </div>

              {/* SUBMIT BUTTON */}
              <Button
                onClick={async () => {
                  if (!reviewComentario.trim()) {
                    notify.warning('Escribe una breve reseña de tu estadía.');
                    return;
                  }
                  if (!onSubmitReview) return;
                  
                  const newReview: Review = {
                    id: `REV-${Math.floor(100000 + Math.random() * 900000)}`,
                    reservationId: selectedResForReview.id,
                    hotelId: selectedResForReview.hotelId,
                    guestId: activeUser.id,
                    userName: isAnonymousReview ? 'Anónimo' : (activeUser.nombre || activeUser.email),
                    rating: reviewRating,
                    comentario: reviewComentario,
                    fecha: new Date().toISOString().split('T')[0],
                    isAnonymous: isAnonymousReview
                  };

                  await onSubmitReview(newReview);
                  setShowReviewModal(false);
                  setSelectedResForReview(null);
                }}
                variant="primary" size="md" className="w-full"
              >
                Enviar Valoración
              </Button>
            </div>
          </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
