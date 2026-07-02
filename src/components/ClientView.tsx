/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus, Review, RoomPriceVariation } from '../types';
import { motion, AnimatePresence } from 'motion/react';

import { MapPin, Calendar, Compass, List, CreditCard, ChevronRight, Sparkles, Filter, Check, Star, AlertCircle, Eye, Trash2, CalendarCheck, FileText, X, Building2, ShieldCheck, Lock, Home, Search, User as UserIcon } from 'lucide-react';
import QRView from './QRView';
import InvoicePDF from './InvoicePDF';
import { RoomImageGallery } from './RoomImageGallery';
import { HotelImageGallery } from './HotelImageGallery';
import { RoomReservationCalendar } from './RoomReservationCalendar';

export function getMapEmbedUrl(ubicacion: string, googleMapsUrl?: string): string {
  if (!ubicacion && !googleMapsUrl) return '';

  // 1. If we have a full iframe code block, extract the src URL
  if (googleMapsUrl && googleMapsUrl.includes('<iframe')) {
    const match = googleMapsUrl.match(/src="([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 2. If it is already a direct Google Maps Embed URL
  if (googleMapsUrl && (googleMapsUrl.includes('google.com/maps/embed') || googleMapsUrl.includes('google.com/maps/p/'))) {
    return googleMapsUrl;
  }

  // 3. Try to extract coordinates from Google Maps URL (e.g. @19.4273,-99.1676)
  if (googleMapsUrl) {
    const coordsMatch = googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch && coordsMatch[1] && coordsMatch[2]) {
      return `https://maps.google.com/maps?q=${coordsMatch[1]},${coordsMatch[2]}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
  }

  // 4. If we have a maps link like maps.app.goo.gl, prefer using physical address for embedded iframe compatibility
  if (googleMapsUrl && (googleMapsUrl.includes('maps.app.goo.gl') || googleMapsUrl.includes('goo.gl/maps') || googleMapsUrl.includes('maps.google.com'))) {
    if (ubicacion) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(ubicacion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(googleMapsUrl)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 5. Fallback to physical address query if it exists
  if (ubicacion) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(ubicacion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 6. Absolute fallback: use the URL itself as draft search query
  if (googleMapsUrl) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(googleMapsUrl)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  return '';
}

interface ClientViewProps {
  hotels: Hotel[];
  rooms: Room[];
  reservations: Reservation[];
  users?: User[];
  activeUser: User;
  onCreateReservation: (res: Reservation) => void;
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
  openHotelId
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
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentCardName, setPaymentCardName] = useState('');
  const [paymentCardNo, setPaymentCardNo] = useState('');
  const [paymentCardExpiry, setPaymentCardExpiry] = useState('');
  const [paymentCardCVV, setPaymentCardCVV] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pse' | 'bank_transfer'>('card');

  // Selected Hotel details
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);

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
  const [showOnlyAvailableRooms, setShowOnlyAvailableRooms] = useState<boolean>(false); // By default, show all rooms and browse, as requested by user
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('todos');

  // Detailed room list filters inside a hotel
  const [roomMaxPrice, setRoomMaxPrice] = useState<number>(1500);
  const [roomMaxPriceInput, setRoomMaxPriceInput] = useState<string>('1500');
  const [roomCapacity, setRoomCapacity] = useState<string>('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('');

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
    if (!baseDateStr) return '';
    const parts = baseDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month + monthsCount, day);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
        return getThreeMonthsLaterString(checkInDate);
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
    setSelectedServices([]);
    setServicePeopleCount({});
  }, [selectedHotelId]);

  // Limpiar fechas cuando cambia de hotel o de habitación elegida, o preestablecer para alquileres de 3 meses
  React.useEffect(() => {
    if (bookingRoom) {
      const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
      const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
      if (isAlquiler) {
        const today = getTodayString(0);
        setCheckInDate(today);
        setRentalMonths(3);
        setCheckOutDate(getDateAfterNMonths(today, 3));
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
      if (h.estado !== 'activo') return false;
      // Explora Hoteles should only return hotels
      if (h.tipoEstablecimiento !== 'hotel') return false;
      
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
      if (h.estado !== 'activo') return false;
      // Explora Propiedades should return casas & departamentos
      if (h.tipoEstablecimiento !== 'casa' && h.tipoEstablecimiento !== 'departamento') return false;
      
      if (propertyTypeFilter !== 'todos' && h.tipoEstablecimiento !== propertyTypeFilter) return false;
      
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
  });

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
    
    let sum = 0;
    selectedServices.forEach(srvId => {
      const srv = detailedServices.find(s => s.id === srvId);
      if (srv) {
        const count = servicePeopleCount[srvId] || 1;
        sum += srv.precio * count;
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
        const rentOneMonth = roomPrice;
        const garantia = roomPrice;
        const sub = rentOneMonth + garantia;
        const isIvaAdded = bookingRoom.adicionarIva !== false;
        const tax = isIvaAdded ? (rentOneMonth * 0.16) : 0;
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

    const sub = getBookingSubtotal(roomPrice) + getServicesTotal();
    const isIvaAdded = bookingRoom ? (bookingRoom.adicionarIva !== false) : true;
    const tax = isIvaAdded ? (sub * 0.16) : 0; // 16% VAT if added, otherwise 0 (included in the room rate)
    return {
      subtotal: sub,
      tax: tax,
      total: sub + tax,
      isAlquiler: false
    };
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRoom) return;

    // Direct guest intercept: prompt login/registration first before creating reservation
    if (activeUser.id === 'guest') {
      if (onTriggerBookingAuth) {
        onTriggerBookingAuth();
      } else if (onTriggerLogin) {
        onTriggerLogin();
      } else {
        setBookingError("Por favor, inicie sesión o regístrese para continuar con su reserva.");
      }
      return;
    }

    if (!checkInDate || !checkOutDate) {
      setBookingError("Por favor seleccione las fechas de check-in y check-out.");
      return;
    }

    // Validate that date selected is today or future
    const todayStr = getTodayString(0);
    if (checkInDate < todayStr) {
      setBookingError("La fecha de check-in no puede ser anterior al día de hoy. Por favor seleccione una fecha válida.");
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
      if (months < 2.9) {
        setBookingError("El período de alquiler para este inmueble debe ser de mínimo 3 meses.");
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
      setBookingError("La habitación ya está reservada u ocupada en las fechas seleccionadas. Por favor elija un rango de fechas diferente.");
      return;
    }

    setBookingError(null);

    const pricing = getBookingTotal(bookingRoom.precio);
    const resId = `RES-${Math.floor(10000 + Math.random() * 90000)}`;
    const qrCode = `ROOMIA-${resId}-${bookingRoom.hotelId}-${bookingRoom.id}`;

    const bookingHotel = hotels.find(h => h.id === bookingRoom.hotelId);
    const detailedList = bookingHotel?.serviciosDetallados || [];

    const mappedServices = selectedServices.map(srvId => {
      const srv = detailedList.find(s => s.id === srvId);
      if (srv) {
        const count = servicePeopleCount[srvId] || 1;
        const total = srv.precio * count;
        return `${srv.nombre} (${count} pers - $${total})`;
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

    // Registrar reservación como pendiente de pago
    onCreateReservation(newRes);

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

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResForPayment) return;

    if (paymentMethod === 'card') {
      if (!paymentCardName.trim()) {
        setPaymentError("Por favor ingrese el nombre del titular de la tarjeta.");
        return;
      }
      const cleanNo = paymentCardNo.replace(/\s+/g, '');
      if (cleanNo.length < 13 || cleanNo.length > 16) {
        setPaymentError("El número de tarjeta ingresado no es válido. Debe tener entre 13 y 16 dígitos.");
        return;
      }
      if (!paymentCardExpiry.includes('/')) {
        setPaymentError("Por favor especifique la fecha de expiración en formato MM/YY.");
        return;
      }
      if (paymentCardCVV.length < 3) {
        setPaymentError("El código CVV debe tener 3 o 4 dígitos de seguridad.");
        return;
      }
    }

    setPaymentError(null);
    setPaymentLoading(true);

    setTimeout(() => {
      try {
        const refId = `ADY-REF-${Math.floor(100000 + Math.random() * 899999)}`;
        const txObj = {
          id: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
          reservationId: selectedResForPayment.id,
          amount: selectedResForPayment.total,
          currency: 'USD',
          paymentMethod: paymentMethod === 'card' ? 'Visa/Mastercard' : paymentMethod === 'pse' ? 'PSE Pagos' : 'Transferencia Bancaria',
          status: 'completado' as const,
          reference: refId,
          fecha: new Date().toISOString()
        };

        // Update reservation to confirmed on payment success
        const confirmedRes: Reservation = {
          ...selectedResForPayment,
          estado: 'confirmada'
        };

        onCreateReservation(confirmedRes);

        if (onAddPaymentTransaction) {
          onAddPaymentTransaction(txObj);
        }

        setPaymentLoading(false);
        setPaymentSuccess(true);
        
        // Reset card details
        setPaymentCardName('');
        setPaymentCardNo('');
        setPaymentCardExpiry('');
        setPaymentCardCVV('');
      } catch (err: any) {
        setPaymentLoading(false);
        setPaymentError(err.message || "El procesamiento del pago reportó un error o rechazo de validación.");
      }
    }, 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-indigo-900 rounded-2xl p-5 md:py-6 md:px-8 text-white shadow-lg mb-6 relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
        
        <div className="relative">
          <h2 className="text-2xl md:text-3xl font-display font-semibold tracking-tight leading-tight">
            Descubre estadías extraordinarias
          </h2>
          <p className="text-teal-100/90 text-xs md:text-sm mt-1.5 leading-relaxed max-w-2xl">
            Disfrute de una suite de lujo seleccionada a mano, gestione sus reservas vigentes y obtenga sus pre-facturas electrónicas al instante.
          </p>
        </div>
      </div>

      {/* EXPLORE TABS */}
      {(activeTab === 'explore' || activeTab === 'properties') && (
        <div className="space-y-8">
          
          {selectedHotelId === null ? (
            // GRID OF HOTELS (Airbnb list style)
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-800">
                    {activeTab === 'explore' ? 'Catálogo de Hoteles Premium' : 'Catálogo de Propiedades Exclusivas'} ({activeTab === 'explore' ? filteredHotels.length : filteredProperties.length})
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {activeTab === 'explore' 
                      ? 'Seleccione un hotel boutique de primer nivel para explorar las habitaciones y suites disponibles.'
                      : 'Explore nuestra selecta colección de casas y departamentos en alquiler temporario o venta definitiva.'}
                  </p>
                </div>
                
                {/* Visual Filters bar */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                  {activeTab === 'properties' && (
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm animate-fade-in">
                      <Home className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="text-neutral-500 font-semibold">Tipo de Propiedad:</span>
                      <select
                        value={propertyTypeFilter}
                        onChange={(e) => setPropertyTypeFilter(e.target.value)}
                        className="border-none bg-transparent font-bold focus:ring-0 cursor-pointer text-teal-700"
                      >
                        <option value="todos">Todas las Propiedades</option>
                        <option value="casa">🏡 Casas</option>
                        <option value="departamento">🏢 Departamentos</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm">
                    <span className="text-neutral-500 font-semibold">Ordenar por:</span>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                      className="border-none bg-transparent font-bold focus:ring-0 cursor-pointer text-teal-700 text-xs"
                    >
                      <option value="asc">Precio: de menor a mayor ↗️</option>
                      <option value="desc">Precio: de mayor a menor ↘️</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm">
                    <span className="text-neutral-500 font-semibold">Número de camas:</span>
                    <select
                      value={bedsFilter}
                      onChange={(e) => setBedsFilter(e.target.value)}
                      className="border-none bg-transparent font-bold focus:ring-0 cursor-pointer text-teal-700 text-xs"
                    >
                      <option value="todos">Cualquiera</option>
                      <option value="1">1 Cama</option>
                      <option value="2">2 Camas</option>
                      <option value="3">3 Camas</option>
                      <option value="4">4 o más Camas</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeTab === 'explore' ? filteredHotels : filteredProperties)
                  .map(hotel => {
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
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        whileHover={{ y: -6, scale: 1.015, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08)" }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:border-teal-200 transition-colors group cursor-pointer"
                      >
                        <div className="relative h-48 overflow-hidden bg-neutral-100">
                          <img
                            src={hotel.portada}
                            alt={hotel.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                           {hotel.tipoEstablecimiento === 'hotel' ? (() => {
                             if (hotelReviews.length === 0) {
                               return (
                                 <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-extrabold text-neutral-800 uppercase tracking-widest flex items-center gap-1 shadow-sm font-sans border border-neutral-100">
                                   🏨 Hotel
                                 </div>
                               );
                             }
                             const avgRating = hotelReviews.reduce((sum, r) => sum + r.rating, 0) / hotelReviews.length;
                            return (
                              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-neutral-800 flex items-center gap-1 shadow-sm font-sans border border-neutral-100/80 animate-fade-in">
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: 5 }).map((_, idx) => (
                                    <Star 
                                      key={idx} 
                                      className={`w-3 h-3 ${
                                        idx < Math.round(avgRating) ? 'fill-current text-yellow-500' : 'text-neutral-200'
                                      }`} 
                                    />
                                  ))}
                                </div>
                                <span className="text-[10px] font-extrabold text-neutral-850 ml-1 font-mono">
                                  {avgRating.toFixed(1)}
                                </span>
                              </div>
                            );
                          })() : (
                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-neutral-800 uppercase tracking-widest flex items-center gap-1 shadow-sm font-sans border border-neutral-100">
                              {hotel.tipoEstablecimiento === 'casa' ? '🏡 Casa Completa' : '🏢 Departamento'}
                            </div>
                          )}
                        </div>

                        <div className="p-5">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <h4 className="font-semibold text-neutral-800 text-lg group-hover:text-teal-600 transition-colors font-sans">
                              {hotel.nombre}
                            </h4>
                            <span className="font-mono text-sm font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded shrink-0">
                              ${displayPrice.toLocaleString()} <span className="font-sans font-normal text-xs text-neutral-500">
                                {hotel.finalidad === 'venta' ? 'compra' : isPropiedad ? '/ mes' : '/ noche'}
                              </span>
                            </span>
                          </div>

                          {/* Stars Rating for Properties only (since hotels have it in the top badge instead of "Hotel Boutique") */}
                          {isPropiedad && isHotelOrAlquiler && hotelReviews.length > 0 && (() => {
                            const avgRating = hotelReviews.reduce((sum, r) => sum + r.rating, 0) / hotelReviews.length;
                            return (
                              <div className="flex items-center gap-1 mb-2.5 bg-yellow-500/5 border border-yellow-500/10 px-2 py-1 rounded-lg w-fit font-sans">
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: 5 }).map((_, idx) => (
                                    <Star 
                                      key={idx} 
                                      className={`w-3 h-3 ${
                                        idx < Math.round(avgRating) ? 'fill-current text-yellow-500' : 'text-neutral-200'
                                      }`} 
                                    />
                                  ))}
                                </div>
                                <span className="text-[10.5px] font-bold text-neutral-850 ml-1 font-mono">
                                  {avgRating.toFixed(1)}
                                </span>
                              </div>
                            );
                          })()}
                          
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate">{hotel.ubicacion.split(',')[1] || hotel.ubicacion}</span>
                          </div>
                          
                          <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed mb-3">
                            {hotel.descripcion}
                          </p>

                          {/* Specific specs of Houses and Apartments */}
                          {(hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento') && hotel.detallesInmueble && (
                            <div className="flex flex-wrap gap-2 text-[10.5px] bg-teal-50/50 border border-teal-100/50 p-2.5 rounded-xl mb-4 font-semibold text-teal-800">
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
                              <span key={i} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 text-[10px] rounded border border-neutral-100 font-medium">
                                {serv}
                              </span>
                            ))}
                            {hotel.servicios.length > 3 && (
                              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] rounded border border-neutral-200 font-mono font-medium">
                                +{hotel.servicios.length - 3}
                              </span>
                            )}
                          </div>

                          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-teal-600 font-semibold font-sans">
                            <span>{isPropiedad ? 'Ver detalles de propiedad' : 'Ver suites disponibles'}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          ) : bookingRoom !== null ? (
            // DEDICATED ROOM RESERVATION VIEW PAGE (replaces old popup modal)
            <div className="space-y-6 animate-fade-in text-neutral-850">
              <button
                onClick={() => setBookingRoom(null)}
                className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 transition-colors font-medium cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm active:scale-95 animate-fade-in"
              >
                ← Volver a las habitaciones de {activeHotel?.nombre}
              </button>

              {/* IMMERSIVE ROOM GALLERY AT THE TOP - MATCHES THE EXPERIENCE OF OPENING A HOTEL */}
              <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm space-y-4 animate-fade-in">
                <HotelImageGallery 
                  imagenes={bookingRoom.imagenes || []} 
                  portada={bookingRoom.imagenes?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop'} 
                  hotelNombre={bookingRoom.nombre} 
                />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                  <div>
                    <h3 className="font-extrabold text-neutral-850 text-xl font-display leading-tight">{bookingRoom.nombre}</h3>
                    <p className="text-xs text-neutral-500 font-medium mt-1">Suite N° {bookingRoom.numero} • Tipo: {bookingRoom.tipo} • Capacidad: {bookingRoom.capacidad} huéspedes • Camas: {bookingRoom.camas}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 p-2.5 px-4 rounded-xl text-left sm:text-right">
                    <span className="text-[10px] font-bold text-teal-800 block uppercase tracking-wider">Precio base por noche</span>
                    <span className="text-xl font-mono font-extrabold text-teal-700">${bookingRoom.precio} USD</span>
                  </div>
                </div>
                {bookingRoom.descripcion && (
                  <p className="text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3">
                    {bookingRoom.descripcion}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in duration-300">
                
                {/* Left side: Interactive room availability calendar (7 cols) */}
                <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="font-semibold text-neutral-800 text-lg flex items-center gap-2 font-display">
                      <Calendar className="w-5 h-5 text-teal-600" />
                      <span>Calendario de Disponibilidad: Suite {bookingRoom.numero}</span>
                    </h4>
                    <p className="text-xs text-neutral-450 mt-1">
                      Visualice las fechas reservadas (en rojo) para cuadrar su estancia en la habitación seleccionada.
                    </p>
                  </div>
                  <div className="overflow-hidden">
                    {(() => {
                      const bHotel = hotels.find(h => h.id === bookingRoom.hotelId);
                      const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
                      return (
                        <RoomReservationCalendar
                          hotels={hotels}
                          rooms={rooms}
                          reservations={reservations}
                          users={users}
                          activeUser={activeUser}
                          forceHotelId={bookingRoom.hotelId}
                          forceRoomId={bookingRoom.id}
                          roomPriceVariations={roomPriceVariations}
                          checkInDate={checkInDate}
                          checkOutDate={checkOutDate}
                          setCheckInDate={setCheckInDate}
                          setCheckOutDate={setCheckOutDate}
                          isAlquiler={!!isAlquiler}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Right side: Checkout form & summary (5 cols) */}
                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <div>
                    <h4 className="font-semibold text-neutral-800 text-xl font-display">Completar Reservación</h4>
                    <p className="text-xs text-neutral-450 mt-1">Defina las fechas de check-in / check-out, seleccione servicios premium y confirme su reserva.</p>
                  </div>

                  <form onSubmit={handleCreateBooking} className="space-y-5">
                    
                    {/* Selected room details block */}
                    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs flex gap-4 shadow-sm">
                      {bookingRoom.imagenes && bookingRoom.imagenes.length > 0 && (
                        <RoomImageGallery 
                          imagenes={bookingRoom.imagenes} 
                          roomNombre={bookingRoom.nombre} 
                          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200 shadow-sm group cursor-pointer"
                        />
                      )}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-neutral-800 text-sm leading-tight">{bookingRoom.nombre}</p>
                          <p className="text-neutral-500 mt-1 font-semibold text-[11px]">
                            Habitación {bookingRoom.numero} ({bookingRoom.tipo})
                          </p>
                          <p className="text-[10px] text-neutral-405 mt-0.5">
                            Capacidad: {bookingRoom.capacidad} personas • {bookingRoom.camas} {bookingRoom.camas > 1 ? 'camas' : 'cama'}
                          </p>
                        </div>
                        <div className="flex justify-between items-baseline mt-2 pt-1.5 border-t border-neutral-200/50">
                          <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Tarifa</span>
                          <p className="font-mono font-bold text-teal-800 text-sm">${bookingRoom.precio} USD <span className="font-sans font-normal text-[10px] text-neutral-500">/ noche</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Booking success notification banner */}
                    {bookingSuccess ? (
                      <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <h5 className="font-semibold text-sm">Reserva Procesada Magníficamente</h5>
                          <p className="text-xs text-emerald-600 mt-0.5">Se redireccionará a su expediente de mis reservaciones.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {bookingError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-pulse font-sans">
                            <span className="font-bold uppercase text-[10px] shrink-0 bg-rose-200 text-rose-900 rounded px-1.5 py-0.5 mt-0.5">Error</span>
                            <p className="font-medium leading-normal">{bookingError}</p>
                          </div>
                        )}

                        {/* Dates Pickers */}
                        {(() => {
                          const bHotel = bookingRoom ? hotels.find(h => h.id === bookingRoom.hotelId) : null;
                          const isAlquiler = bHotel && (bHotel.tipoEstablecimiento === 'casa' || bHotel.tipoEstablecimiento === 'departamento') && bHotel.finalidad === 'alquiler';
                          
                          if (isAlquiler) {
                            return (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="text-xs font-semibold text-neutral-500 block mb-1.5">Fecha de Inicio de Alquiler</label>
                                    <input
                                      type="date"
                                      required
                                      min={getTodayString(0)}
                                      value={checkInDate}
                                      onChange={(e) => {
                                        setCheckInDate(e.target.value);
                                        setBookingError(null);
                                      }}
                                      className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-neutral-500 block mb-1.5">Duración (Meses de Alquiler)</label>
                                    <select
                                      value={rentalMonths}
                                      onChange={(e) => {
                                        const num = parseInt(e.target.value, 10);
                                        setRentalMonths(num);
                                        setBookingError(null);
                                      }}
                                      className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer h-[34px] font-semibold"
                                    >
                                      <option value={3}>3 meses (Mínimo)</option>
                                      <option value={4}>4 meses</option>
                                      <option value={5}>5 meses</option>
                                      <option value={6}>6 meses (Semestral)</option>
                                      <option value={7}>7 meses</option>
                                      <option value={8}>8 meses</option>
                                      <option value={9}>9 meses</option>
                                      <option value={10}>10 meses</option>
                                      <option value={11}>11 meses</option>
                                      <option value={12}>12 meses (Anual)</option>
                                      <option value={18}>18 meses</option>
                                      <option value={24}>24 meses (2 Años)</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="text-[11px] text-teal-700 bg-teal-50/70 py-2 px-3.5 rounded-xl border border-teal-100 flex justify-between items-center font-semibold">
                                  <span>📅 Fecha de Finalización Calculada:</span>
                                  <strong className="font-mono text-neutral-800">{checkOutDate || 'Sin calcular'}</strong>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-2 gap-3.5">
                              <div>
                                <label className="text-xs font-semibold text-neutral-500 block mb-1.5">Check-In</label>
                                <input
                                  type="date"
                                  required
                                  min={getTodayString(0)}
                                  value={checkInDate}
                                  onChange={(e) => {
                                    setCheckInDate(e.target.value);
                                    setBookingError(null);
                                  }}
                                  className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-neutral-500 block mb-1.5">Check-Out</label>
                                <input
                                  type="date"
                                  required
                                  min={getMinCheckOutDate()}
                                  value={checkOutDate}
                                  onChange={(e) => {
                                    setCheckOutDate(e.target.value);
                                    setBookingError(null);
                                  }}
                                  className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Additional services checkout menu */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-500 block mb-1">Servicios Estancia Adicionales (Opcional):</label>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {(() => {
                              const bookingHotel = hotels.find(h => h.id === bookingRoom?.hotelId);
                              const availableServices = (bookingHotel?.serviciosDetallados && bookingHotel.serviciosDetallados.length > 0)
                                ? bookingHotel.serviciosDetallados.filter(s => s.estado === 'activo')
                                : ADDITIONAL_SERVICES.map(s => ({
                                    id: s.id,
                                    nombre: s.name,
                                    precio: s.price,
                                    descripcion: s.desc,
                                    estado: 'activo' as const
                                  }));

                              return availableServices.map(srv => {
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
                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-2 ${
                                      isChecked
                                        ? 'bg-teal-50/50 border-teal-300 shadow-sm'
                                        : 'bg-white hover:bg-neutral-50 border-neutral-200'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-4">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-neutral-800 flex items-center gap-1.5">
                                          {srv.emoji && <span className="text-sm shrink-0">{srv.emoji}</span>}
                                          <span>{srv.nombre}</span>
                                        </p>
                                        <p className="text-[10px] text-neutral-450 mt-0.5 leading-relaxed">{srv.descripcion}</p>
                                      </div>
                                      <div className="shrink-0 text-right flex items-center gap-2">
                                        <span className="font-mono font-bold text-teal-800">+${srv.precio} <span className="text-[9px] text-neutral-400 font-normal">/ pers</span></span>
                                        <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-teal-600 border-teal-600 text-white' : 'border-neutral-300 bg-white'}`}>
                                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Multiplier Quantity Picker for Selected Services */}
                                    {isChecked && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1 pt-2 border-t border-teal-200/50 flex items-center justify-between gap-4 animate-fade-in"
                                      >
                                        <span className="text-[10px] text-teal-700 font-bold">Seleccionar cantidad de personas para el servicio:</span>
                                        <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 border border-teal-200 rounded-lg">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cur = servicePeopleCount[srv.id] || 1;
                                              if (cur > 1) {
                                                setServicePeopleCount({ ...servicePeopleCount, [srv.id]: cur - 1 });
                                              }
                                            }}
                                            className="w-5 h-5 flex items-center justify-center rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold text-xs select-none cursor-pointer border border-neutral-250"
                                          >
                                            -
                                          </button>
                                          <span className="text-xs font-mono font-bold text-neutral-900 w-6 text-center">
                                            {servicePeopleCount[srv.id] || 1}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cur = servicePeopleCount[srv.id] || 1;
                                              setServicePeopleCount({ ...servicePeopleCount, [srv.id]: cur + 1 });
                                            }}
                                            className="w-5 h-5 flex items-center justify-center rounded bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs select-none cursor-pointer border border-teal-750"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Notas */}
                        <div>
                          <label className="text-xs font-semibold text-neutral-500 block mb-1">Peticiones o notas especiales (Opcional)</label>
                          <textarea
                            value={bookingNote}
                            onChange={(e) => setBookingNote(e.target.value)}
                            placeholder="Ej: Requiere sábanas hipoalergénicas, traslado con rampa, etc."
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none h-14 bg-white"
                          />
                        </div>

                        {/* AUTO COMPUTED PRICE BREAKDOWN PREVIEW */}
                        {(() => {
                          const billing = getBookingTotal(bookingRoom.precio);
                          if (billing.isAlquiler) {
                            return (
                              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2 text-xs text-neutral-600 font-sans">
                                <p className="font-bold text-amber-900 uppercase text-[10px] tracking-wider border-b border-amber-200 pb-1 mb-2">Desglose de Contrato de Alquiler</p>
                                <div className="flex justify-between">
                                  <span>Plazo del Alquiler:</span>
                                  <span className="font-semibold text-neutral-800">{getMonthsCount(checkInDate, checkOutDate).toFixed(1)} meses (mínimo 3)</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Valor Mensual de Renta:</span>
                                  <span className="font-mono font-semibold text-neutral-800">${billing.mensualidad} USD / mes</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Depósito de Garantía:</span>
                                  <span className="font-mono font-semibold text-amber-700">${billing.garantia} USD</span>
                                </div>
                                {billing.tax > 0 && (
                                  <div className="flex justify-between">
                                    <span>Impuestos (IVA 16% sobre renta):</span>
                                    <span className="font-mono text-neutral-500">${billing.tax.toFixed(2)} USD</span>
                                  </div>
                                )}
                                <div className="p-2 border border-amber-100 rounded-lg bg-white/70 text-[10px] text-amber-900 leading-normal">
                                  💡 <b>Política de Garantía:</b> Al iniciar el alquiler se liquida el primer mes de alquiler por adelantado más la garantía equivalente a una mensualidad reembolsable.
                                </div>
                                <div className="h-[1px] bg-amber-200/50 my-1.5" />
                                <div className="flex justify-between font-bold text-neutral-900 text-sm font-sans">
                                  <span>Primer Pago Inicial Total:</span>
                                  <span className="font-mono text-amber-900 text-base font-bold">${billing.total.toFixed(2)} USD</span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-100 space-y-1.5 text-xs text-neutral-600">
                              <p className="font-bold text-teal-900 uppercase text-[10px] tracking-wider border-b border-teal-100 pb-1 mb-2">Resumen de Pre-Factura Roomia SaaS</p>
                              <div className="flex justify-between">
                                <span>Noches de estadía:</span>
                                <span className="font-semibold">{getNightsCount()} {getNightsCount() > 1 ? 'noches' : 'noche'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Hospedaje ({bookingRoom.nombre}):</span>
                                <span className="font-mono">${getBookingSubtotal(bookingRoom.precio)} USD</span>
                              </div>
                              {bookingRoom && (() => {
                                const groupedVariations = getGroupedVariableNights(bookingRoom, checkInDate, checkOutDate);
                                if (groupedVariations.length > 0) {
                                  return (
                                    <div className="mt-1 pl-3 border-l-2 border-teal-205 space-y-1 text-[10px] text-neutral-500 bg-teal-50/50 p-2 rounded-xl">
                                      <p className="font-bold text-teal-800 text-[9px] uppercase tracking-wider">Variación Tarifaria por Fecha/Días:</p>
                                      {groupedVariations.map((group, idx) => (
                                        <div key={idx} className="flex justify-between font-mono">
                                          <span>• ({group.formattedDate}) <span className="bg-white px-1 py-0.5 rounded border border-neutral-100 text-[8px] font-sans font-medium text-teal-700">{group.motivo}</span></span>
                                          <span className="font-semibold text-teal-850">${group.precio} USD</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="mt-1 pl-3 border-l-2 border-neutral-300/60 bg-neutral-100/40 p-2 rounded-xl text-[10px] text-neutral-400 italic">
                                    Tarifa estándar uniforme sin variaciones en este período.
                                  </div>
                                );
                              })()}
                              {getServicesTotal() > 0 && (
                                <div className="flex justify-between">
                                  <span>Servicios Adicionales:</span>
                                  <span className="font-mono text-emerald-750">+${getServicesTotal()} USD</span>
                                </div>
                              )}
                              <div className="flex justify-between text-[11px]">
                                <span>Impuestos (IVA 16%):</span>
                                {bookingRoom.adicionarIva === false ? (
                                  <span className="font-sans font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 text-[9px]">
                                    IVA Incluido
                                  </span>
                                ) : (
                                  <span className="font-mono">${billing.tax.toFixed(2)} USD</span>
                                )}
                              </div>
                              <div className="h-[1px] bg-teal-100/50 my-1.5" />
                              <div className="flex justify-between font-bold text-neutral-900 text-sm">
                                <span>Total Estimado:</span>
                                <span className="font-mono text-teal-800">${billing.total.toFixed(2)} USD</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Submit buttons */}
                        <div className="pt-2 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setBookingRoom(null)}
                            className="w-1/2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer text-center"
                          >
                            Volver
                          </button>
                          <button
                            type="submit"
                            className="w-1/2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer text-center shadow-md hover:shadow-lg active:scale-95"
                          >
                            Confirmar Reserva
                          </button>
                        </div>
                      </>
                    )}

                  </form>
                </div>

              </div>
            </div>
          ) : (
            // HOTEL DETAIL PAGE & AVAILABLE ROOMS
            <div className="space-y-8 animate-fade-in" key={selectedHotelId || 'none'}>
              <button
                onClick={() => {
                  setSelectedHotelId(null);
                  if (onOpenHotelChange) onOpenHotelChange(null);
                }}
                className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 transition-colors font-medium cursor-pointer"
              >
                ← Volver al catálogo de hoteles
              </button>

              {/* Cover layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main description slider */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Interactive, animated Hotel Image Gallery & Carousel Suite */}
                  <HotelImageGallery 
                    imagenes={activeHotel?.imagenes || []} 
                    portada={activeHotel?.portada || ''} 
                    hotelNombre={activeHotel?.nombre || ''} 
                  />

                  {/* Aesthetic location and map badge */}
                  <div className="flex items-center gap-2 text-xs bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-neutral-600 font-medium shadow-sm">
                    <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Establecimiento ubicado en: {activeHotel?.ubicacion}</span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-neutral-800 text-base mb-2">Sobre este inolvidable espacio</h4>
                    <p className="text-sm text-neutral-500 leading-relaxed">{activeHotel?.descripcion}</p>
                  </div>

                  {/* Services & Utilities list */}
                  <div>
                    <h4 className="font-semibold text-neutral-800 text-sm mb-3 uppercase tracking-wider text-neutral-400">Servicios Incluidos (Gratis)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {activeHotel?.servicios.map((serv, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-xl border border-neutral-100 text-neutral-600 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          <span>{serv}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Info policies sidebar card */}
                <div className="space-y-6">
                  {/* PRECIO DESTACADO DE LA PROPIEDAD */}
                  {activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') && (
                    <div className="bg-gradient-to-br from-teal-50 to-emerald-50/30 border border-teal-100 rounded-2xl p-5 shadow-sm space-y-3.5 text-center">
                      <div>
                        {activeHotel.finalidad === 'venta' ? (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-100 text-amber-800 border-amber-200">
                            💰 EXCLUSIVA EN VENTA
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-teal-100 text-teal-800 border-teal-200">
                            🔑 EN ALQUILER MENSUAL
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-wider">
                          {activeHotel.finalidad === 'venta' ? 'PRECIO DE ADQUISICIÓN' : 'MENSUALIDAD BASE'}
                        </span>
                        <span className="font-mono font-black text-teal-900 text-3xl block mt-1">
                          ${(activeHotel.detallesInmueble?.precio || 0).toLocaleString()} USD
                        </span>
                        <span className="text-[10.5px] text-neutral-500 block mt-1 leading-normal">
                          {activeHotel.finalidad === 'venta' 
                            ? 'Sujeto a escritura pública y negociación directa' 
                            : 'Estadía mensual estándar (Contrato mín. 3 meses)'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h4 className="font-semibold text-neutral-800 text-base border-b border-neutral-100 pb-2">Información de Estadía</h4>
                    
                    <div className="space-y-3 text-xs text-neutral-600">
                      <div>
                        <span className="text-neutral-400 block font-medium uppercase tracking-wider mb-0.5">Contacto Reservas:</span>
                        <p className="font-semibold text-neutral-800">{activeHotel?.contacto.email}</p>
                        <p className="font-mono text-neutral-500 mt-0.5">{activeHotel?.contacto.telefono}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-50">
                        <div>
                          <span className="text-neutral-400 block font-medium">CHECK-IN:</span>
                          <span className="font-bold text-teal-700">{activeHotel?.horarios.checkIn} hrs</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block font-medium">CHECK-OUT:</span>
                          <span className="font-bold text-teal-700">{activeHotel?.horarios.checkOut} hrs</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-neutral-50">
                        <span className="text-neutral-400 block font-medium uppercase tracking-wider mb-2">Políticas Internas:</span>
                        {(!activeHotel?.politicas || activeHotel.politicas.length === 0) ? (
                          <p className="text-neutral-400 italic text-[11px]">No se especificaron políticas de permanencia.</p>
                        ) : (
                          <ul className="space-y-1.5 list-disc pl-4 text-neutral-500">
                            {activeHotel.politicas.map((pol, idx) => (
                              <li key={idx} className="leading-normal">{pol}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Property specs & Owner details card inside sidebar */}
                  {activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') && (
                    <div className="bg-gradient-to-br from-teal-50 to-emerald-50/40 border border-teal-100 rounded-2xl p-5 shadow-sm space-y-4">
                      <div>
                        <h4 className="font-bold text-teal-800 text-xs uppercase tracking-widest flex items-center gap-1.5 border-b border-teal-100/60 pb-1.5">
                          <span>🏡 Detalle del Inmueble</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-neutral-600 font-semibold">
                          <div className="bg-white/90 p-2 rounded-xl border border-teal-100/50">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Habitaciones</span>
                            <strong className="text-neutral-800 text-sm">{activeHotel.detallesInmueble?.habitaciones || 1}</strong>
                          </div>
                          <div className="bg-white/90 p-2 rounded-xl border border-teal-100/50">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Baños</span>
                            <strong className="text-neutral-800 text-sm">{activeHotel.detallesInmueble?.banos || 1}</strong>
                          </div>
                          <div className="bg-white/90 p-2 rounded-xl border border-teal-100/50">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold font-sans">Superficie</span>
                            <strong className="text-neutral-800 text-sm font-mono">{activeHotel.detallesInmueble?.metrosCuadrados || 40} m²</strong>
                          </div>
                          <div className="bg-white/90 p-2 rounded-xl border border-teal-100/50">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Garaje</span>
                            <strong className="text-neutral-800 text-[10.5px]">{activeHotel.detallesInmueble?.tieneEstacionamiento ? 'Sí, Incluido' : 'No cuenta'}</strong>
                          </div>
                          <div className="col-span-2 bg-white/90 p-2.5 rounded-xl border border-teal-100/50 flex justify-between items-center text-[10.5px]">
                            <span className="text-neutral-400 text-[9px] uppercase font-bold">Condición:</span>
                            <strong className="text-teal-700">{activeHotel.detallesInmueble?.amueblado !== false ? 'Totalmente Amoblado' : 'Sin amoblar'}</strong>
                          </div>
                        </div>
                      </div>

                      {activeHotel.finalidad !== 'venta' && (
                        <div className="border-t border-teal-100/70 pt-4">
                          <h4 className="font-bold text-teal-800 text-xs uppercase tracking-widest flex items-center gap-1.5 border-b border-teal-100/60 pb-1.5">
                            <span>👤 Propietario del Inmueble</span>
                          </h4>
                          {activeHotel.propietario ? (
                            <div className="space-y-2 mt-2.5 text-xs font-semibold">
                              <div>
                                <span className="text-neutral-400 block text-[9px] uppercase font-bold">Propietario:</span>
                                <span className="text-neutral-805 font-bold block">{activeHotel.propietario.nombre}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className={activeHotel.propietario.documento && activeHotel.propietario.documento.trim() !== '' ? "" : "col-span-2"}>
                                  <span className="text-neutral-400 block text-[9px] uppercase font-bold">Teléfono Móvil:</span>
                                  <a href={`tel:${activeHotel.propietario.telefono}`} className="text-teal-700 font-black hover:underline font-mono">{activeHotel.propietario.telefono}</a>
                                </div>
                                {activeHotel.propietario.documento && activeHotel.propietario.documento.trim() !== '' && (
                                  <div>
                                    <span className="text-neutral-400 block text-[9px] uppercase font-bold">Doc. Identidad:</span>
                                    <span className="text-neutral-600 font-mono text-[10.5px]">{activeHotel.propietario.documento}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="text-neutral-400 block text-[9px] uppercase font-bold">Correo de Contacto:</span>
                                <span className="text-neutral-805 font-medium block truncate select-all font-mono text-[10px] bg-white border border-teal-50 px-1.5 py-0.5 rounded">{activeHotel.propietario.email}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-neutral-400 text-xs mt-1 italic">Detalles de propietario no registrados.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mini simulated map embedding */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 shadow-inner space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                      <MapPin className="w-4 h-4 text-teal-600" />
                      <span>Ubicación Satelital Confirmada</span>
                    </div>
                    <div className="h-44 rounded-xl border border-neutral-200 overflow-hidden relative shadow-sm">
                      {(() => {
                        const embedSrc = getMapEmbedUrl(activeHotel?.ubicacion || '', activeHotel?.googleMapsUrl);
                        if (!embedSrc) {
                          return (
                            <div className="flex flex-col items-center justify-center p-4 h-full text-center bg-neutral-50 text-neutral-450">
                              <MapPin className="w-6 h-6 text-neutral-350 mb-1" />
                              <p className="text-[10px] font-sans">Sin ubicación configurada</p>
                            </div>
                          );
                        }

                        return (
                          <iframe
                            title={`Mapa de ${activeHotel?.nombre}`}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            src={embedSrc}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        );
                      })()}
                    </div>

                    {activeHotel?.googleMapsUrl && activeHotel.googleMapsUrl.startsWith('http') && (
                      <div className="mt-2 text-right">
                        <a
                          href={activeHotel.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-teal-650 hover:text-teal-700 font-semibold transition-colors"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Ver en Google Maps</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* LIST OF SUITES AVAILABLE IN THIS HOTEL */}
              {activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') ? (
                activeHotel.finalidad === 'venta' ? (
                  /* INFORMACIÓN FINAL DEL PROPIETARIO A CONTACTAR (SIN CALENDARIOS NI RESERVAS) */
                  <div className="space-y-6 pt-8 border-t border-neutral-200 animate-fade-in font-sans">
                    <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200 rounded-3xl shadow-sm text-center max-w-2xl mx-auto space-y-4">
                      <div className="mx-auto w-12 h-12 bg-amber-100/80 rounded-2xl flex items-center justify-center text-amber-700">
                        <UserIcon className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-neutral-850 text-lg font-display">Datos de Contacto del Propietario</h4>
                        <p className="text-xs text-neutral-500 max-w-md mx-auto">Para consultas de compra, agendar visitas guiadas o solicitar propuestas para esta exclusiva propiedad, póngase en contacto directo:</p>
                      </div>

                      {activeHotel.propietario ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mt-4 text-xs font-semibold">
                          <div className="p-3 bg-white border border-neutral-200/60 rounded-xl shadow-xs text-left">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Nombre Propietario</span>
                            <span className="text-neutral-805 text-sm font-bold block">{activeHotel.propietario.nombre}</span>
                          </div>
                          <div className="p-3 bg-white border border-neutral-200/60 rounded-xl shadow-xs text-left">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5 font-sans">WhatsApp / Llamar</span>
                            <a 
                              href={`https://wa.me/${activeHotel.propietario.telefono.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-teal-600 hover:text-teal-750 font-extrabold text-sm flex items-center gap-1 mt-0.5 font-mono cursor-pointer"
                            >
                              📞 {activeHotel.propietario.telefono}
                            </a>
                          </div>
                          {activeHotel.propietario.documento && activeHotel.propietario.documento.trim() !== '' && (
                            <div className="col-span-1 sm:col-span-2 p-3 bg-white border border-neutral-200/60 rounded-xl shadow-xs text-left">
                              <span className="text-neutral-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Doc. Identidad / Cédula</span>
                              <span className="text-neutral-805 text-xs font-mono font-bold block">{activeHotel.propietario.documento}</span>
                            </div>
                          )}
                          <div className="col-span-1 sm:col-span-2 p-3 bg-white border border-neutral-200/60 rounded-xl shadow-xs text-left truncate">
                            <span className="text-neutral-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Correo de Contacto</span>
                            <a 
                              href={`mailto:${activeHotel.propietario.email}`} 
                              className="text-teal-650 hover:text-teal-700 font-mono text-[11px] block truncate text-center select-all cursor-pointer"
                            >
                              {activeHotel.propietario.email}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-neutral-400 text-xs italic">La información de contacto no está disponible actualmente.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* COMPILACION DIRECTA PARA CASAS Y DEPARTAMENTOS COMPLETOS EN ALQUILER */
                  <div className="space-y-5 pt-6 border-t border-neutral-200 animate-fade-in font-sans">
                    <div>
                      <h4 className="font-bold text-neutral-850 text-xl font-display flex items-center gap-2">
                        <span>🏷️ Operación del Inmueble Completo</span>
                      </h4>
                      <p className="text-xs text-neutral-400 mt-0.5">La propiedad completa se ofrece en modalidad exclusiva de alquiler comercial residencial.</p>
                    </div>

                    <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/20 border border-teal-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-teal-100 text-teal-805 border-teal-200">
                            🔑 Alquiler Temporario / Mensual
                          </span>
                          <span className="px-3 py-1 bg-white text-neutral-600 rounded-full text-xs font-bold border border-neutral-200 uppercase font-mono shadow-sm">
                            {activeHotel.tipoEstablecimiento === 'casa' ? '🏡 Casa Completa' : '🏢 Departamento'}
                          </span>
                        </div>
                        <h5 className="font-bold text-neutral-800 text-lg leading-tight">{activeHotel.nombre}</h5>
                        <p className="text-xs text-neutral-500 leading-relaxed max-w-xl">{activeHotel.descripcion}</p>
                      </div>

                      <div className="w-full md:w-56 bg-white border border-teal-100/75 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-center text-center space-y-3 shrink-0">
                        <div>
                          <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-wider">VALOR DE ESTA UNIDAD</span>
                          <span className="font-mono font-extrabold text-teal-850 text-2xl">${activeHotel.detallesInmueble?.precio || 150} USD</span>
                          <span className="text-[10px] text-neutral-500 block">Valor mensual estimado (mín. 3 meses)</span>
                        </div>

                        <button
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
                              estado: 'disponible'
                            };
                            setBookingRoom(syntheticRoom);
                          }}
                          className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95"
                        >
                          Alquilar Propiedad Completa
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* LIST OF SUITES AVAILABLE IN THIS HOTEL (HOTELES TRADICIONALES EN SU CLASE) */
                <div className="space-y-4 pt-4 border-t border-neutral-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-semibold text-neutral-850 text-xl font-display">Habitaciones y Suites</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">Explore alojamientos disponibles y personalice su búsqueda con los filtros avanzados.</p>
                    </div>
                  </div>

                  {/* ADVANCED MULTIPLE FILTERS SECTION (Capacity, Prices, Room type) */}
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                    {/* Filter 1: Capacity (Cantidad de personas) */}
                    <div className="space-y-1.5 col-span-1">
                      <span className="text-neutral-500 block font-semibold uppercase tracking-wider text-[10px]">Cantidad de Personas</span>
                      <select
                        value={roomCapacity}
                        onChange={(e) => setRoomCapacity(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer h-[38px] shadow-sm font-semibold"
                      >
                        <option value="">Cualquier capacidad (Predeterminado)</option>
                        <option value="1-2">1-2 personas</option>
                        <option value="3-4">3-4 personas</option>
                        <option value="5-6">5-6 personas</option>
                      </select>
                    </div>

                    {/* Filter 2: Room Type */}
                    <div className="space-y-1.5 col-span-1">
                      <span className="text-neutral-500 block font-semibold uppercase tracking-wider text-[10px]">Tipo de Suite / Habitación</span>
                      <select
                        value={roomTypeFilter}
                        onChange={(e) => setRoomTypeFilter(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer h-[38px] shadow-sm font-semibold"
                      >
                        <option value="">Todos los tipos (Predeterminado)</option>
                        {Array.from(new Set(rooms.filter(r => r.hotelId === selectedHotelId).map(r => r.tipo))).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filter 3: Price Input & Search (Precios) */}
                    <div className="space-y-1.5 col-span-1">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">Precio Máximo por noche</span>
                        <span className="text-teal-700 font-mono font-bold text-[11px]">Actual: ${roomMaxPrice} USD</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs font-semibold">$</span>
                          <input
                            type="number"
                            placeholder="Ej. 300"
                            value={roomMaxPriceInput}
                            onChange={(e) => setRoomMaxPriceInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt(roomMaxPriceInput);
                                setRoomMaxPrice(isNaN(val) ? 999999 : val);
                              }
                            }}
                            className="w-full bg-white border border-neutral-200 rounded-xl py-2 pl-7 pr-3 focus:ring-1 focus:ring-teal-500 focus:outline-none h-[38px] shadow-sm font-semibold text-neutral-800"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const val = parseInt(roomMaxPriceInput);
                            setRoomMaxPrice(isNaN(val) ? 999999 : val);
                          }}
                          className="px-3.5 h-[38px] bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-1 shrink-0 text-xs cursor-pointer active:scale-95"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Buscar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {roomsInActiveHotel.length === 0 ? (
                      <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-200 text-center text-neutral-500 py-12">
                        <p className="text-sm font-medium">No se encontraron habitaciones para mostrar con el filtro seleccionado.</p>
                        {showOnlyAvailableRooms && (
                          <button
                            onClick={() => setShowOnlyAvailableRooms(false)}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-700 border border-neutral-300 rounded-lg text-xs hover:bg-neutral-50 font-semibold cursor-pointer"
                          >
                            Ver todas las habitaciones
                          </button>
                        )}
                      </div>
                    ) : (
                      roomsInActiveHotel.map(room => {
                        const isAvailable = room.estado === 'disponible';
                        const isBookable = room.estado !== 'mantenimiento';
                        return (
                          <motion.div
                            key={room.id}
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            whileHover={{ y: -3, scale: 1.005 }}
                            transition={{ duration: 0.3 }}
                            className={`bg-white rounded-2xl p-4 border transition-all flex flex-col md:flex-row gap-6 ${
                              isBookable
                                ? 'border-neutral-200 hover:shadow-md hover:border-teal-300'
                                : 'border-neutral-100 opacity-65'
                            }`}
                          >
                            {/* Animated Photo Gallery Thumbnail */}
                            <RoomImageGallery imagenes={room.imagenes} roomNombre={room.nombre} />

                            {/* Middle detail content */}
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-600 font-semibold uppercase tracking-wider font-mono border border-neutral-200">
                                    Habitación {room.numero}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-teal-50 text-teal-700 font-semibold uppercase tracking-wider border border-teal-100">
                                    {room.tipo}
                                  </span>
                                  {room.estado !== 'disponible' && (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                                      room.estado === 'mantenimiento' ? 'bg-red-50 text-red-700 border-red-200 font-bold' : 'bg-amber-50 text-amber-700 border-amber-200 font-medium'
                                    }`}>
                                      {room.estado}
                                    </span>
                                  )}
                                </div>

                                <h5 className="font-semibold text-neutral-800 text-base mb-1">{room.nombre}</h5>
                                <p className="text-xs text-neutral-500 leading-normal line-clamp-2 md:max-w-xl">{room.descripcion}</p>
                              </div>

                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {room.servicios.slice(0, 4).map((srv, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-neutral-50 text-neutral-600 text-[10px] rounded border border-neutral-100">
                                    {srv}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Pricing and reservation CTA button */}
                            <div className="w-full md:w-44 pt-4 md:pt-0 md:pl-6 border-t md:border-t-0 md:border-l border-neutral-100 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-3 shrink-0">
                              <div className="text-left md:text-right">
                                <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">PRECIO POR NOCHE</span>
                                <span className="font-mono font-bold text-neutral-900 text-lg">${room.precio} USD</span>
                                <span className="text-[10px] text-neutral-500 block">Capacidad: {room.capacidad} personas ({room.camas} {room.camas > 1 ? 'camas' : 'cama'})</span>
                              </div>

                              {isBookable ? (
                                <button
                                  onClick={() => setBookingRoom(room)}
                                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-xl transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                                >
                                  Reservar Ahora
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="px-4 py-2 bg-neutral-100 border border-neutral-200 text-neutral-450 font-medium text-xs rounded-xl transition-all cursor-not-allowed uppercase text-[9px] tracking-wider"
                                >
                                  Mantenimiento
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* SECCIÓN DE RESEÑAS Y OPINIONES DEL HOTEL */}
              {!(activeHotel && (activeHotel.tipoEstablecimiento === 'casa' || activeHotel.tipoEstablecimiento === 'departamento') && activeHotel.finalidad === 'venta') && (
                <div className="mt-12 pt-8 border-t border-neutral-250">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h4 className="font-semibold text-neutral-850 text-xl font-display flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-current" />
                        Opiniones de Huéspedes
                      </h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Valoraciones auténticas compartidas por clientes reales que completaron su estadía en este establecimiento.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-neutral-50 px-4 py-2.5 rounded-2xl border border-neutral-200">
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">PROMEDIO</span>
                        <span className="font-bold text-neutral-800 text-sm">
                          {reviews.filter(r => r.hotelId === selectedHotelId).length > 0 
                            ? (reviews.filter(r => r.hotelId === selectedHotelId).reduce((sum, r) => sum + r.rating, 0) / reviews.filter(r => r.hotelId === selectedHotelId).length).toFixed(1)
                            : '0.0'} / 5.0
                        </span>
                      </div>
                      <div className="h-8 w-[1px] bg-neutral-200" />
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">TOTAL OPINIONES</span>
                        <span className="font-mono font-bold text-teal-700 text-sm">{reviews.filter(r => r.hotelId === selectedHotelId).length} reseñas</span>
                      </div>
                    </div>
                  </div>

                  {reviews.filter(r => r.hotelId === selectedHotelId).length === 0 ? (
                    <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-200 text-center text-neutral-500 py-10">
                      <p className="text-xs font-semibold text-neutral-450 uppercase tracking-widest mb-1">Aún sin calificaciones</p>
                      <p className="text-xs text-neutral-400 max-w-sm mx-auto">Sé uno de los primeros en dejar tu opinión después de que finalice tu estadía en este hotel.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {reviews.filter(r => r.hotelId === selectedHotelId).map(rev => (
                        <div key={rev.id} className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-850 border border-teal-100 flex items-center justify-center font-bold text-xs uppercase shadow-sm font-sans">
                                  {rev.isAnonymous || rev.userName === 'Anónimo' ? 'AN' : (rev.userName ? rev.userName.slice(0, 2) : 'HU')}
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-neutral-800 block leading-tight">
                                    {rev.isAnonymous || rev.userName === 'Anónimo' ? 'Anónimo' : (rev.userName || 'Huésped del Hotel')}
                                  </span>
                                  <span className="text-[9px] text-neutral-400 font-mono italic">{rev.fecha}</span>
                                </div>
                              </div>
                              
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-3.5 h-3.5 ${
                                      i < rev.rating ? 'text-yellow-500 fill-current' : 'text-neutral-200'
                                    }`} 
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <p className="text-xs text-neutral-600 leading-relaxed italic bg-neutral-50/50 p-3 rounded-xl border border-neutral-100/70">
                              "{rev.comentario || 'Sin comentario escrito.'}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* RESERVATIONS TAB */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          {activeUser.id === 'guest' ? (
            <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-sm">
              <Lock className="w-12 h-12 text-teal-600 mb-3 animate-pulse" />
              <h4 className="font-semibold text-neutral-800 text-base">Acceso para Miembros de Roomia</h4>
              <p className="text-xs text-neutral-500 leading-normal max-w-xs mt-1.5">
                Por favor, inicie sesión o regístrese para poder consultar sus reservas, descargar pre-facturas y subir comprobantes de pago.
              </p>
              <button
                onClick={onTriggerLogin}
                className="mt-4 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                Iniciar Sesión / Registrarse 🔑
              </button>
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-xl font-semibold text-neutral-800">Mi Expediente de Huésped</h3>
                <p className="text-xs text-neutral-400">Administre su hospedaje, presente los comprobantes QR al recepcionista para el Check-In, y descargue su pre-factura en formato PDF.</p>
              </div>

              {myReservations.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
              <CalendarCheck className="w-12 h-12 text-neutral-300 mb-3" />
              <h4 className="font-semibold text-neutral-700 text-base">Sin reservaciones registradas</h4>
              <p className="text-xs text-neutral-500 leading-normal max-w-xs mt-1.5">
                Actualmente no cuenta con estadías o contratos de alquiler registrados en el sistema. ¡Explore nuestras opciones para realizar su primera reserva!
              </p>
              <button
                onClick={() => setActiveTab('explore')}
                className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Explorar alojamientos
              </button>
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
                        <span className="font-mono text-xs font-bold text-neutral-800 uppercase bg-white px-2 py-0.5 rounded border border-neutral-200">
                          Reserva {res.id}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium ml-2">Registrado: {res.fechaRegistro}</span>
                      </div>
                      
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        res.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        res.estado === 'pendiente' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        res.estado === 'ocupada' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        res.estado === 'finalizada' ? 'bg-neutral-100 text-neutral-600 border border-neutral-200' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {res.estado === 'pendiente' ? 'Reservación pendiente de pago' :
                         res.estado === 'confirmada' ? 'Reservada' :
                         res.estado === 'ocupada' ? 'Ocupada' :
                         res.estado === 'finalizada' ? 'Finalizada' :
                         res.estado === 'cancelada' ? 'Cancelada' : res.estado}
                      </span>
                    </div>

                    {/* Meta specifics */}
                    <div className="p-5 flex gap-4">
                      {/* Mini visual indicator or thumbnail logo */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100 self-start">
                        <img src={hotel?.logo} alt={hotel?.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-neutral-800 text-sm">{hotel?.nombre || 'Hotel Roomia'}</h4>
                        <p className="text-xs text-teal-700 font-medium">Habitación {room?.numero || 'S/N'} - {room?.nombre}</p>
                        
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 pt-1">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Del {res.fechaEntrada} al {res.fechaSalida}</span>
                        </div>

                        {res.serviciosAdicionales.length > 0 && (
                          <p className="text-[10px] text-neutral-400 leading-normal truncate">
                            Extras: {res.serviciosAdicionales.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {res.modificadoPor && (
                      <div className="mx-5 mb-5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5 font-bold text-[11px] mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                          <span>Modificado por: <span className="text-amber-800 font-extrabold">{res.modificadoPor}</span></span>
                          {res.fechaCambio && (
                            <span className="font-normal text-[10px] text-amber-600 ml-auto font-mono">
                              {new Date(res.fechaCambio).toLocaleDateString()} {new Date(res.fechaCambio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed italic bg-white/80 p-2 rounded-lg border border-amber-100/60 mt-1">
                          "{res.mensajeCambio || 'No se proporcionó un mensaje de justificación.'}"
                        </p>
                      </div>
                    )}

                    {/* Bottom active toolbar */}
                    <div className="p-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-medium uppercase tracking-wider">MONTO TOTAL NETO</span>
                        <span className="font-mono font-bold text-neutral-900">${res.total.toFixed(2)} USD</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewingRes(res)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-lg cursor-pointer transition-colors font-medium text-[11px]"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          <span>Pre-Factura / QR</span>
                        </button>

                        {res.estado === 'pendiente' && (
                          <button
                            onClick={() => {
                              setSelectedResForPayment(res);
                              setShowPaymentModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer transition-colors font-medium text-[11px] shadow"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Ver Instrucciones de Pago</span>
                          </button>
                        )}

                        {(res.estado === 'confirmada' || res.estado === 'pendiente') && (
                          confirmCancelId === res.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                              <button
                                onClick={() => setConfirmCancelId(null)}
                                className="px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                              >
                                Volver
                              </button>
                              <button
                                onClick={() => {
                                  onCancelReservation(res.id);
                                  setConfirmCancelId(null);
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-750 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                              >
                                Sí, Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmCancelId(res.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-red-50 text-red-600 rounded-lg cursor-pointer transition-colors text-[11px] font-medium"
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
                                className="px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-250 rounded-lg cursor-pointer"
                              >
                                Volver
                              </button>
                              <button
                                onClick={() => {
                                  onDeleteReservation(res.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-900 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                              >
                                Sí, Eliminar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(res.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-red-50 hover:text-red-700 text-neutral-500 rounded-lg cursor-pointer transition-colors text-[11px] font-medium"
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
                              <div className="flex items-center gap-1 bg-yellow-50 text-yellow-750 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-yellow-250">
                                <Star className="w-3.5 h-3.5 fill-current text-yellow-500" />
                                <span>Valorado ({rev?.rating} ★)</span>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() => {
                                setSelectedResForReview(res);
                                setReviewRating(5);
                                setReviewComentario('');
                                setIsAnonymousReview(false);
                                setShowReviewModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg cursor-pointer transition-colors font-semibold text-[11px] shadow-sm font-sans"
                            >
                              <Star className="w-3.5 h-3.5 fill-current text-white" />
                              <span>Valorar Estancia</span>
                            </button>
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-55">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-sm w-full max-h-[90vh] flex flex-col overflow-hidden text-neutral-800 animate-fade-in text-xs"
            >
              {/* Header */}
              <div className="bg-[#0f172a] text-white p-4 flex items-center justify-between border-b border-neutral-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-500 text-[#0f172a] font-extrabold text-[9px] px-1.5 py-0.5 rounded tracking-wide uppercase font-mono">
                    PENDIENTE DE PAGO
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Instrucciones de Pago</h4>
                    <p className="text-[9px] text-amber-400 font-mono">Reserva Retenida (24h)</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                  }}
                  className="p-1 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 uppercase tracking-wide text-[9px] block">CÓDIGO DE RESERVA</span>
                    <span className="font-mono font-bold text-slate-800">{selectedResForPayment.id}</span>
                  </div>
                  <div className="h-px bg-slate-200/50" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 uppercase tracking-wide text-[9px] block font-sans">VALOR TOTAL DE LA ESTADÍA</span>
                    <span className="font-mono font-bold text-neutral-800 text-sm">${selectedResForPayment.total.toFixed(2)} USD</span>
                  </div>
                  <div className="h-px bg-slate-200/50" />
                  <div className="flex justify-between items-center bg-teal-50/50 p-1.5 rounded-lg border border-teal-100">
                    <span className="text-teal-800 uppercase tracking-wide text-[9px] block font-semibold">SEÑAL DE RESERVA (20%)</span>
                    <span className="font-mono font-bold text-teal-600 text-sm">${(selectedResForPayment.total * 0.20).toFixed(2)} USD</span>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">⚠️ Importante: Límite de 24 Horas</p>
                      <p className="text-[11px] leading-relaxed text-amber-805">
                        Su reservación ha sido registrada y se encuentra en estado <strong>"Reservación pendiente de pago"</strong>. Dispone de un plazo de <strong>24 horas</strong> para tramitar el abono.
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-800 font-semibold mt-1 bg-white/70 p-2 rounded border border-amber-100">
                        <strong>Requisito mínimo:</strong> Se necesita pagar al menos el <strong>20% del valor de la estadía (${(selectedResForPayment.total * 0.20).toFixed(2)} USD)</strong> para que su reserva pase de estar en "Pendiente" a "Reservada" de forma confirmada. Obviamente, puede optar por abonar el valor total de <strong>${selectedResForPayment.total.toFixed(2)} USD</strong> o solo el 20% inicial para que quede reservado correctamente.
                      </p>
                      <p className="text-[10px] leading-relaxed text-amber-600 mt-1">
                        Si pasadas las 24 horas no se valida al menos este pago mínimo de garantía con la administración o recepción del hotel, la reservación se cancelará automáticamente.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pt-1">
                      <ShieldCheck className="w-4 h-4 text-teal-600" />
                      Pasos para tramitar su pago:
                    </h5>
                    <ul className="list-decimal pl-4.5 space-y-1.5 text-slate-600 leading-normal text-[11.5px]">
                      <li>
                        Póngase en contacto con el administrador o recepcionista correspondiente (mediante nuestro chat en vivo o del hostal).
                      </li>
                      <li>
                        Suministre su id de reserva <strong>{selectedResForPayment.id}</strong> para que ubiquen su transacción.
                      </li>
                      <li>
                        Efectúe el pago por el valor total de <strong>${selectedResForPayment.total.toFixed(2)} USD</strong> o abone el depósito del 20% de <strong>${(selectedResForPayment.total * 0.20).toFixed(2)} USD</strong> (en efectivo, depósito bancario o transferencia).
                      </li>
                      <li>
                        Al confirmarlo la administración, se actualizará su estado a <strong>"Reservada"</strong> (estado de reserva confirmada en el sistema) y se le enviará su correo de confirmación respectivo.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-3">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setActiveTab('reservations');
                    }}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer text-center shadow"
                  >
                    Entendido, ir a Mis Reservaciones
                  </button>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      const triggerSupportBtn = document.getElementById('support-chat-trigger-btn') || document.querySelector('[aria-label="support-chat"]') as HTMLElement;
                      if (triggerSupportBtn) {
                        triggerSupportBtn.click();
                      } else {
                        alert("Escríbanos por correo electrónico o mediante el panel del cliente para agilizar su pago.");
                      }
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <span>Contactar Administrador vía Chat</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ⭐ VALORACIÓN Y CALIFICACIÓN DE ESTANCIA COMPLETADA MODAL */}
      <AnimatePresence>
        {showReviewModal && selectedResForReview && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-55">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-150 overflow-hidden relative"
            >
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedResForReview(null);
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 bg-neutral-100/60 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-yellow-50 text-yellow-650 flex items-center justify-center border border-yellow-200 shadow-sm">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-base leading-tight">Valorar Estancia Completa</h3>
                    <p className="text-[11px] text-neutral-400">Reserva {selectedResForReview.id}</p>
                  </div>
                </div>

                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 text-xs text-neutral-600 mb-5 space-y-1">
                  <p className="font-extrabold text-neutral-800">Establecimiento:</p>
                  <p className="font-semibold text-teal-800">
                    {hotels.find(h => h.id === selectedResForReview.hotelId)?.nombre || 'Hotel Premium'}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    Estadía del {selectedResForReview.fechaEntrada} al {selectedResForReview.fechaSalida}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* STAR SELECTION */}
                  <div className="text-center space-y-1.5 bg-neutral-50/40 p-4 rounded-2xl border border-dashed border-neutral-200">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">¿Cómo calificaría su experiencia?</label>
                    <div className="flex justify-center gap-2 pt-1">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const starValue = i + 1;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setReviewRating(starValue)}
                            className="text-yellow-500 hover:scale-115 transition-transform cursor-pointer select-none"
                          >
                            <Star 
                              className={`w-8 h-8 ${
                                starValue <= reviewRating ? 'fill-current text-yellow-500' : 'text-neutral-350'
                              }`} 
                            />
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[11px] font-bold text-neutral-700 block mt-1">
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
                      <p className="text-[10px] text-neutral-400">Oculta su nombre real en la reseña pública</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAnonymousReview(!isAnonymousReview)}
                      className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all ${
                        isAnonymousReview ? 'bg-teal-600' : 'bg-neutral-350'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          isAnonymousReview ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* COMENTARIO */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-500 block">Escriba su reseña u opinión sincera (Obligatorio)</label>
                    <textarea
                      required
                      value={reviewComentario}
                      onChange={(e) => setReviewComentario(e.target.value)}
                      placeholder="Mencione la atención, comodidad, limpieza y servicios recibidos..."
                      className="w-full text-xs border border-neutral-150 rounded-2xl p-3 focus:ring-1 focus:ring-teal-500 focus:outline-none h-24 bg-white"
                    />
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    onClick={async () => {
                      if (!reviewComentario.trim()) {
                        alert("Por favor escriba una breve reseña de su estadía.");
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
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs transition-colors cursor-pointer text-center shadow-lg shadow-teal-600/10 hover:shadow-teal-600/20"
                  >
                    Enviar Valoración
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
