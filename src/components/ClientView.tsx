/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel, Room, Reservation, User, RoomStatus } from '../types';

import { MapPin, Calendar, Compass, List, CreditCard, ChevronRight, Sparkles, Filter, Check, Star, AlertCircle, Eye, Trash2, CalendarCheck, FileText, X } from 'lucide-react';
import QRView from './QRView';
import InvoicePDF from './InvoicePDF';

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
  activeUser: User;
  onCreateReservation: (res: Reservation) => void;
  onCancelReservation: (resId: string) => void;
  onDeleteReservation?: (resId: string) => void;
}

const ADDITIONAL_SERVICES = [
  { id: 'breakfast', name: 'Desayuno Premium Orgánico', price: 15, desc: 'Ingredientes de granja locales servidos a la habitación' },
  { id: 'spa', name: 'Pase de Acceso Completo al Spa', price: 25, desc: 'Masajes hidrotermales, sauna de vapor seco y toallas aromatizadas' },
  { id: 'airport', name: 'Traslado Terrestre Aeropuerto-Hotel', price: 30, desc: 'Conductor bilingüe privado en sedán eléctrico de lujo' },
  { id: 'wifi', name: 'Pase de Oficina WiFi 6E Ultrawide', price: 10, desc: 'Canales ilimitados dedicados para streaming y co-working' }
];

export default function ClientView({
  hotels,
  rooms,
  reservations,
  activeUser,
  onCreateReservation,
  onCancelReservation,
  onDeleteReservation
}: ClientViewProps) {
  // Navigation Tabs: 'explore' | 'reservations'
  const [activeTab, setActiveTab] = useState<'explore' | 'reservations'>('explore');

  // Selected Hotel details
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  
  // Advanced Filter state
  const [selectedService, setSelectedService] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number>(500);
  const [showOnlyAvailableRooms, setShowOnlyAvailableRooms] = useState<boolean>(true); // By default, show available rooms first or filterable

  // Booking Flow modal state
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [checkInDate, setCheckInDate] = useState<string>('2026-05-25');
  const [checkOutDate, setCheckOutDate] = useState<string>('2026-05-28');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [bookingNote, setBookingNote] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Active Invoice preview modal state
  const [previewingRes, setPreviewingRes] = useState<Reservation | null>(null);

  // Inline Confirmers for reservations actions
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Helper getters
  const activeHotel = hotels.find(h => h.id === selectedHotelId);
  const filteredHotels = hotels.filter(h => h.estado === 'activo');
  const roomsInActiveHotel = rooms.filter(r => 
    r.hotelId === selectedHotelId &&
    (!showOnlyAvailableRooms || r.estado === 'disponible')
  );

  const myReservations = reservations.filter(r => r.guestId === activeUser.id && !r.eliminadaPorCliente);

  // Calculate booking cost
  const getNightsCount = () => {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = end.getTime() - start.getTime();
    if (isNaN(diff) || diff <= 0) return 1;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getBookingSubtotal = (roomPrice: number) => {
    return roomPrice * getNightsCount();
  };

  const getServicesTotal = () => {
    return selectedServices.length * 15; // static $15 per selected service for simplicity
  };

  const getBookingTotal = (roomPrice: number) => {
    const sub = getBookingSubtotal(roomPrice) + getServicesTotal();
    const tax = sub * 0.16; // 16% VAT
    return {
      subtotal: sub,
      tax: tax,
      total: sub + tax
    };
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRoom) return;

    const pricing = getBookingTotal(bookingRoom.precio);
    const resId = `RES-${Math.floor(10000 + Math.random() * 90000)}`;
    const qrCode = `AURA-${resId}-${bookingRoom.hotelId}-${bookingRoom.id}`;

    const newRes: Reservation = {
      id: resId,
      hotelId: bookingRoom.hotelId,
      roomId: bookingRoom.id,
      guestId: activeUser.id,
      fechaEntrada: checkInDate,
      fechaSalida: checkOutDate,
      serviciosAdicionales: selectedServices.map(id => ADDITIONAL_SERVICES.find(s => s.id === id)?.name || id),
      subtotal: pricing.subtotal,
      impuestos: pricing.tax,
      total: pricing.total,
      qrCode: qrCode,
      estado: 'confirmada', // Client reservations are auto-confirmed for easy simulation flow!
      fechaRegistro: new Date().toISOString().split('T')[0],
      notas: bookingNote
    };

    onCreateReservation(newRes);
    setBookingSuccess(true);
    setTimeout(() => {
      setBookingSuccess(false);
      setBookingRoom(null);
      setSelectedServices([]);
      setBookingNote('');
      setActiveTab('reservations');
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-indigo-900 rounded-3xl p-6 md:p-10 text-white shadow-xl mb-8 relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
        
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-400/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reserva de Hoteles Premium</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight leading-tight">
            Descubre estadías extraordinarias
          </h2>
          <p className="text-teal-100/90 max-w-xl text-sm md:text-base mt-2">
            Disfrute de una suite de lujo seleccionada a mano, gestione sus reservas vigentes y obtenga sus pre-facturas electrónicas al instante.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 print:hidden">
            <button
              onClick={() => { setActiveTab('explore'); setSelectedHotelId(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'explore'
                  ? 'bg-white text-teal-950 font-semibold shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Explorar Hoteles</span>
            </button>
            <button
              onClick={() => setActiveTab('reservations')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'reservations'
                  ? 'bg-white text-teal-950 font-semibold shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Mis Reservaciones ({myReservations.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* EXPLORE TABS */}
      {activeTab === 'explore' && (
        <div className="space-y-8">
          
          {selectedHotelId === null ? (
            // GRID OF HOTELS (Airbnb list style)
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-800">Catálogo de Destinos ({filteredHotels.length})</h3>
                  <p className="text-xs text-neutral-400">Todos los alojamientos se ajustan a las directrices sanitarias y de mantenimiento modernas de Aura</p>
                </div>
                
                {/* Visual Filters bar */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-neutral-200">
                    <Filter className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-neutral-500">Filtrar por Servicio:</span>
                    <select
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="border-none bg-transparent font-semibold focus:ring-0 cursor-pointer"
                    >
                      <option value="">Cualquiera</option>
                      <option value="Piscina Infinita">Piscina</option>
                      <option value="Spa de Lujo">Spa & Wellness</option>
                      <option value="Co-working Space">Co-working</option>
                      <option value="Jacuzzi">Jacuzzi lago</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-neutral-200">
                    <span className="text-neutral-500">Precio Máximo:</span>
                    <input
                      type="range"
                      min="100"
                      max="500"
                      step="50"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                      className="w-20 accent-teal-600 focus:outline-none cursor-pointer"
                    />
                    <span className="font-mono font-semibold">${maxPrice} USD</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHotels
                  .filter(h => selectedService === '' || h.servicios.includes(selectedService))
                  .map(hotel => {
                    // Quick lowest room price simulation
                    const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);
                    const minPrice = hotelRooms.length > 0
                      ? Math.min(...hotelRooms.map(r => r.precio))
                      : 150;

                    return (
                      <div
                        key={hotel.id}
                        onClick={() => setSelectedHotelId(hotel.id)}
                        className="bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg transition-all group cursor-pointer duration-300"
                      >
                        <div className="relative h-48 overflow-hidden bg-neutral-100">
                          <img
                            src={hotel.portada}
                            alt={hotel.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-neutral-800 uppercase tracking-widest flex items-center gap-1 shadow-sm">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>Boutique</span>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <h4 className="font-semibold text-neutral-800 text-lg group-hover:text-teal-600 transition-colors">
                              {hotel.nombre}
                            </h4>
                            <span className="font-mono text-sm font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                              ${minPrice}+ <span className="font-normal text-xs text-teal-600">/noche</span>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate">{hotel.ubicacion.split(',')[1] || hotel.ubicacion}</span>
                          </div>
                          
                          <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                            {hotel.descripcion}
                          </p>

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

                          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-teal-600 font-semibold">
                            <span>Ver suites disponibles</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            // HOTEL DETAIL PAGE & AVAILABLE ROOMS
            <div className="space-y-8 animate-fade-in">
              <button
                onClick={() => setSelectedHotelId(null)}
                className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 transition-colors font-medium cursor-pointer"
              >
                ← Volver al catálogo de hoteles
              </button>

              {/* Cover layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main description slider */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-2xl overflow-hidden h-80 bg-neutral-100 relative shadow-sm border border-neutral-100">
                    <img
                      src={activeHotel?.portada}
                      alt={activeHotel?.nombre}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/65 to-transparent flex items-end p-6">
                      <div>
                        <h3 className="text-2xl md:text-3xl font-display font-semibold text-white tracking-tight">{activeHotel?.nombre}</h3>
                        <div className="flex items-center gap-1.5 text-neutral-200 text-xs mt-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{activeHotel?.ubicacion}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Image gallery carousel */}
                  <div className="grid grid-cols-4 gap-3">
                    {activeHotel?.imagenes.map((img, i) => (
                      <div key={i} className="h-16 md:h-24 rounded-xl overflow-hidden bg-neutral-200 border border-neutral-100 hover:scale-105 transition-transform duration-300">
                        <img src={img} alt="Hotel gallery" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-semibold text-neutral-800 text-base mb-2">Sobre este inolvidable espacio</h4>
                    <p className="text-sm text-neutral-500 leading-relaxed">{activeHotel?.descripcion}</p>
                  </div>

                  {/* Services & Utilities list */}
                  <div>
                    <h4 className="font-semibold text-neutral-800 text-sm mb-3 uppercase tracking-wider text-neutral-400">Servicios Destacados</h4>
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
                        <ul className="space-y-1.5 list-disc pl-4 text-neutral-500">
                          {activeHotel?.politicas.slice(0, 3).map((pol, idx) => (
                            <li key={idx} className="leading-normal">{pol}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

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
              <div className="space-y-4 pt-4 border-t border-neutral-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h4 className="font-semibold text-neutral-850 text-xl font-display">Habitaciones y Suites</h4>
                  
                  {/* Selector Filter options */}
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="text-neutral-400 font-medium">Filtrar:</span>
                    <button
                      type="button"
                      onClick={() => setShowOnlyAvailableRooms(true)}
                      className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                        showOnlyAvailableRooms
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Disponibles ({rooms.filter(r => r.hotelId === selectedHotelId && r.estado === 'disponible').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOnlyAvailableRooms(false)}
                      className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                        !showOnlyAvailableRooms
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Todas ({rooms.filter(r => r.hotelId === selectedHotelId).length})
                    </button>
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
                    return (
                      <div
                        key={room.id}
                        className={`bg-white rounded-2xl p-4 border transition-all flex flex-col md:flex-row gap-6 ${
                          isAvailable
                            ? 'border-neutral-200 hover:shadow-md'
                            : 'border-neutral-100 opacity-65'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-full md:w-56 h-36 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100">
                          <img
                            src={room.imagenes[0] || 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=300'}
                            alt={room.nombre}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

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
                              {!isAvailable && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 font-semibold uppercase tracking-wider border border-amber-200">
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

                          {isAvailable ? (
                            <button
                              onClick={() => setBookingRoom(room)}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-xl transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                            >
                              Reservar Ahora
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-4 py-2 bg-neutral-100 border border-neutral-200 text-neutral-400 font-medium text-xs rounded-xl transition-all cursor-not-allowed"
                            >
                              No Disponible
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* RESERVATIONS TAB */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-neutral-800">Mi Expediente de Huésped</h3>
            <p className="text-xs text-neutral-400">Administre su hospedaje, presente los comprobantes QR al recepcionista para el Check-In, y descargue su pre-factura en formato PDF.</p>
          </div>

          {myReservations.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
              <CalendarCheck className="w-12 h-12 text-neutral-300 mb-3" />
              <h4 className="font-semibold text-neutral-700 text-base">Sin reservaciones registradas</h4>
              <p className="text-xs text-neutral-500 leading-normal max-w-xs mt-1.5">
                Aun no tienes ninguna estadía reservada con tu cuenta destructordereck@gmail.com en el sistema.
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
                        res.estado === 'pendiente' ? 'bg-amber-50 text-amber-500 border border-amber-100' :
                        res.estado === 'ocupada' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        res.estado === 'finalizada' ? 'bg-neutral-100 text-neutral-600 border border-neutral-200' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {res.estado}
                      </span>
                    </div>

                    {/* Meta specifics */}
                    <div className="p-5 flex gap-4">
                      {/* Mini visual indicator or thumbnail logo */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100 self-start">
                        <img src={hotel?.logo} alt={hotel?.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-neutral-800 text-sm">{hotel?.nombre || 'Hotel Aura'}</h4>
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
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FLOW MODAL: CONSTRUCT TRANSACTION RESERVATION */}
      {bookingRoom && activeHotel && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-100 flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-2xl">
              <div>
                <h4 className="font-semibold text-neutral-800 text-base">Crear Nueva Reservación</h4>
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mt-0.5">{activeHotel.nombre}</p>
              </div>
              <button
                onClick={() => setBookingRoom(null)}
                className="p-1 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleCreateBooking} className="p-6 space-y-5">
              
              {/* Alert Booking status banner */}
              {bookingSuccess ? (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                  <Check className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h5 className="font-semibold text-sm">Reserva Procesada Magníficamente</h5>
                    <p className="text-xs text-emerald-600 mt-0.5">Se redireccionará a su expediente de mis reservaciones.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected room quick banner */}
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-xs flex justify-between">
                    <div>
                      <p className="font-bold text-neutral-800">{bookingRoom.nombre}</p>
                      <p className="text-neutral-500 mt-0.5">Habitación {bookingRoom.numero} ({bookingRoom.tipo})</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-teal-800">${bookingRoom.precio} USD</p>
                      <p className="text-neutral-400 text-[10px] font-medium">por noche</p>
                    </div>
                  </div>

                  {/* Dates Pickers */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 block mb-1.5">Fecha Entrada (Check-In)</label>
                      <input
                        type="date"
                        required
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 block mb-1.5">Fecha Salida (Check-Out)</label>
                      <input
                        type="date"
                        required
                        value={checkOutDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Additional services checkout menu */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-500 block mb-1">Servicios Adicionales (Opcional):</label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {ADDITIONAL_SERVICES.map(srv => {
                        const isChecked = selectedServices.includes(srv.id);
                        return (
                          <div
                            key={srv.id}
                            onClick={() => {
                              setSelectedServices(prev =>
                                isChecked ? prev.filter(id => id !== srv.id) : [...prev, srv.id]
                              );
                            }}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors flex justify-between items-center ${
                              isChecked
                                ? 'bg-teal-50/50 border-teal-300'
                                : 'bg-white hover:bg-neutral-50 border-neutral-200'
                            }`}
                          >
                            <div className="pr-4">
                              <p className="font-semibold text-neutral-800">{srv.name}</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">{srv.desc}</p>
                            </div>
                            <div className="shrink-0 text-right flex items-center gap-2">
                              <span className="font-mono font-bold text-teal-800">+${srv.price}</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-teal-600 border-teal-600 text-white' : 'border-neutral-300'}`}>
                                {isChecked && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="text-xs font-semibold text-neutral-500 block mb-1">Notas especiales o solicitudes (Opcional)</label>
                    <textarea
                      value={bookingNote}
                      onChange={(e) => setBookingNote(e.target.value)}
                      placeholder="Ej: Requiere sábanas hipoalergénicas, traslado con rampa para silla de ruedas, etc."
                      className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none h-14"
                    />
                  </div>

                  {/* AUTO COMPUTED PRICE BREAKDOWN PREVIEW */}
                  <div className="p-4 bg-teal-50/40 rounded-xl border border-teal-100 space-y-1.5 text-xs text-neutral-600">
                    <p className="font-bold text-teal-850 uppercase text-[10px] tracking-wider border-b border-teal-100 pb-1 mb-2">Desglose de Montos de Pre-Factura</p>
                    <div className="flex justify-between">
                      <span>Noches de estadía:</span>
                      <span className="font-semibold">{getNightsCount()} {getNightsCount() > 1 ? 'noches' : 'noche'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hospedaje de Suite:</span>
                      <span className="font-mono">${getBookingSubtotal(bookingRoom.precio)} USD</span>
                    </div>
                    {getServicesTotal() > 0 && (
                      <div className="flex justify-between">
                        <span>Servicios Adicionales:</span>
                        <span className="font-mono text-emerald-700">+${getServicesTotal()} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11px]">
                      <span>Impuestos (IVA 16%):</span>
                      <span className="font-mono">${getBookingTotal(bookingRoom.precio).tax.toFixed(2)} USD</span>
                    </div>
                    <div className="h-[1px] bg-teal-100/50 my-1.5" />
                    <div className="flex justify-between font-bold text-neutral-900 text-sm">
                      <span>Total Estimado:</span>
                      <span className="font-mono text-teal-800">${getBookingTotal(bookingRoom.precio).total.toFixed(2)} USD</span>
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBookingRoom(null)}
                      className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer text-center shadow-md active:scale-95"
                    >
                      Confirmar Reserva
                    </button>
                  </div>
                </>
              )}

            </form>
          </div>
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

    </div>
  );
}
