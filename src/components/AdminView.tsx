/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel, Room, User, Reservation, RoomStatus, UserRole, Review, RoomPriceVariation } from '../types';
import { RoomReservationCalendar } from './RoomReservationCalendar';
import { fetchPropertyDetails } from '../supabase';
import { compressImage } from '../store';
import InvoicePDF from './InvoicePDF';
import EmojiPicker from 'emoji-picker-react';
import { ECUADOR_PROVINCES, getProvincesList, getCitiesForProvince, getParroquiasForCity } from '../data/ecuador';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { Plus, Edit3, Trash2, Shield, Users, HotelIcon, List, LayoutDashboard, Calendar, DollarSign, Percent, TrendingUp, AlertCircle, MapPin, EyeOff, ClipboardList, ToggleLeft, ToggleRight, Check, X, Upload, Database, Sparkles, Copy, Key, Building, Home, Star, Wrench, ChevronDown } from 'lucide-react';

export function getMapEmbedUrl(ubicacion: string, googleMapsUrl?: string): string {
  const cleanUrl = googleMapsUrl ? googleMapsUrl.trim() : '';
  const cleanUbicacion = ubicacion ? ubicacion.trim() : '';

  if (!cleanUrl && !cleanUbicacion) return '';

  // 1. If googleMapsUrl was provided in the creation form, prioritize it directly
  if (cleanUrl) {
    // A. Full iframe snippet <iframe src="...">
    if (cleanUrl.includes('<iframe')) {
      const match = cleanUrl.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    // B. Direct Google Maps Embed URL
    if (cleanUrl.includes('google.com/maps/embed') || cleanUrl.includes('google.com/maps/p/')) {
      return cleanUrl;
    }

    // C. Coordinates inside the URL (e.g. @-0.18065,-78.46783 or ?q=-0.18065,-78.4678)
    const coordsMatch = cleanUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || cleanUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch && coordsMatch[1] && coordsMatch[2]) {
      return `https://maps.google.com/maps?q=${coordsMatch[1]},${coordsMatch[2]}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }

    // D. Any other Google Maps URL/shortlink (maps.app.goo.gl, goo.gl/maps, place link)
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleanUrl)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 2. Fallback to physical address query if no googleMapsUrl was uploaded
  if (cleanUbicacion) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleanUbicacion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  return '';
}

interface AdminViewProps {
  hotels: Hotel[];
  rooms: Room[];
  users: User[];
  reservations: Reservation[];
  logs: any[];
  activeUser: User;
  onSaveHotel: (hotel: Hotel) => void;
  onDeleteHotel: (hotelId: string) => void;
  onSaveRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
  onUpdateUserRole: (userId: string, role: UserRole) => void;
  onUpdateUserHotel: (userId: string, hotelId: string | undefined) => void;
  onUpdateUserHotels?: (userId: string, hotelIds: string[]) => void;
  onToggleUserStatus: (userId: string) => void;
  statistics: any;
  onUpdateRoomStatus?: (roomId: string, status: RoomStatus, staffName?: string, staffRole?: string, changeMessage?: string) => void;
  onUpdateReservationStatus?: (resId: string, status: any, staffName?: string, staffRole?: string, changeMessage?: string) => void;
  onSyncAllToSupabase?: () => Promise<{
    success: boolean;
    details: {
      hotels: { count: number; error?: string };
      rooms: { count: number; error?: string };
      users: { count: number; error?: string };
      reservations: { count: number; error?: string };
      logs: { count: number; error?: string };
    };
  }>;
  onChangeUserPassword?: (userId: string, newPass: string, changedByAdmin?: boolean) => Promise<{ success: boolean; error?: string }>;
  reviews?: Review[];
  roomPriceVariations?: RoomPriceVariation[];
  onSaveRoomPriceVariation?: (v: RoomPriceVariation) => void;
  onDeleteRoomPriceVariation?: (id: string) => void;
  adminTab?: 'dashboard' | 'hotels' | 'properties' | 'rooms' | 'users' | 'logs' | 'reservations' | 'refunds' | 'incidents';
  onAdminTabChange?: (tab: 'dashboard' | 'hotels' | 'properties' | 'rooms' | 'users' | 'logs' | 'reservations' | 'refunds' | 'incidents') => void;
}

export default function AdminView({
  hotels,
  rooms,
  users,
  reservations,
  logs,
  activeUser,
  onSaveHotel,
  onDeleteHotel,
  onSaveRoom,
  onDeleteRoom,
  onUpdateUserRole,
  onUpdateUserHotel,
  onUpdateUserHotels,
  onToggleUserStatus,
  statistics,
  onUpdateRoomStatus,
  onUpdateReservationStatus,
  onSyncAllToSupabase,
  onChangeUserPassword,
  reviews = [],
  roomPriceVariations = [],
  onSaveRoomPriceVariation,
  onDeleteRoomPriceVariation,
  adminTab: propAdminTab,
  onAdminTabChange
}: AdminViewProps) {
  // Navigation tabs within Admin: 'dashboard' | 'hotels' | 'rooms' | 'users' | 'logs' | 'reservations' | 'refunds' | 'incidents'
  const [localAdminTab, setLocalAdminTab] = useState<'dashboard' | 'hotels' | 'properties' | 'rooms' | 'users' | 'logs' | 'reservations' | 'refunds' | 'incidents'>('dashboard');
  const adminTab = propAdminTab !== undefined ? propAdminTab : localAdminTab;
  const setAdminTab = (tab: 'dashboard' | 'hotels' | 'properties' | 'rooms' | 'users' | 'logs' | 'reservations' | 'refunds' | 'incidents') => {
    if (onAdminTabChange) {
      onAdminTabChange(tab);
    } else {
      setLocalAdminTab(tab);
    }
  };
  const [superAdminSelectedHotelId, setSuperAdminSelectedHotelId] = useState<string>('all');
  const [frequentClientsTab, setFrequentClientsTab] = useState<'cards' | 'table'>('cards');

  // RBAC Access Control checking
  const isSuper = activeUser.rol === 'super_admin';
  const myHotelId = activeUser.hotelId || '';

  // Limit access vectors
  const allowedHotels = isSuper 
    ? hotels 
    : hotels.filter(h => h.id === myHotelId || (activeUser.hotelIds && activeUser.hotelIds.includes(h.id)));

  const allowedOnlyHotels = allowedHotels.filter(h => h.tipoEstablecimiento === 'hotel' || !h.tipoEstablecimiento);
  const allowedOnlyProperties = allowedHotels.filter(h => h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento');

  const allowedRooms = (isSuper || allowedHotels.length > 1)
    ? (superAdminSelectedHotelId === 'all' 
        ? (isSuper ? rooms : rooms.filter(r => allowedHotels.some(ah => ah.id === r.hotelId)))
        : rooms.filter(r => r.hotelId === superAdminSelectedHotelId))
    : rooms.filter(r => r.hotelId === myHotelId || (activeUser.hotelIds && activeUser.hotelIds.includes(r.hotelId)));

  const allowedReservations = isSuper 
    ? reservations 
    : reservations.filter(res => res.hotelId === myHotelId || (activeUser.hotelIds && activeUser.hotelIds.includes(res.hotelId)));

  const allowedUsers = isSuper
    ? users
    : users.filter(u => {
        if (u.id === activeUser.id) return true;
        if (u.hotelId === myHotelId || (activeUser.hotelIds && activeUser.hotelIds.includes(u.hotelId || ''))) return true;
        // Include guests with reservations in my hotels
        const isGuestOfMine = reservations.some(res => 
          (res.hotelId === myHotelId || (activeUser.hotelIds && activeUser.hotelIds.includes(res.hotelId))) 
          && res.guestId === u.id
        );
        return isGuestOfMine;
      });

  // Allowed logs for non super-admins are filtered to those mentioning their hotel name or room ID, or created by their receptionist
  const allowedLogs = isSuper
    ? logs
    : logs.filter(log => {
        const myHotelObj = hotels.find(h => h.id === myHotelId);
        const myHotelName = myHotelObj ? myHotelObj.nombre.toLowerCase() : '';
        const detailsLower = (log.detalles || '').toLowerCase();
        const userObj = users.find(u => `${u.nombre} ${u.apellido}` === log.user);
        
        return (
          log.user.includes(activeUser.nombre) ||
          detailsLower.includes(myHotelId.toLowerCase()) ||
          (myHotelName && detailsLower.includes(myHotelName)) ||
          (userObj && userObj.hotelId === myHotelId)
        );
      });

  // Filter dashboard by single hotel
  const [dashboardHotelFilter, setDashboardHotelFilter] = useState(
    (isSuper || allowedHotels.length > 1) ? '' : myHotelId
  );

  // States for date range filtering in administrative analytics
  const [dashboardStartDate, setDashboardStartDate] = useState("");
  const [dashboardEndDate, setDashboardEndDate] = useState("");

  // CRUD Hotel State
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [newGeneralServiceText, setNewGeneralServiceText] = useState("");
  const [newHotelPolicyText, setNewHotelPolicyText] = useState("");
  const [newPropertyPolicyText, setNewPropertyPolicyText] = useState("");
  const [newPropertyServiceText, setNewPropertyServiceText] = useState("");

  // CRUD Property State
  const [editingProperty, setEditingProperty] = useState<Hotel | null>(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState<{
    id: string;
    nombre: string;
    precio: number;
    descripcion: string;
    estado: 'activo' | 'inactivo';
    emoji: string;
  }>({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo', emoji: '' });

  const [showEmojiPickerHotel, setShowEmojiPickerHotel] = useState(false);
  const [showEmojiPickerProperty, setShowEmojiPickerProperty] = useState(false);

  const [generalServiceEmoji, setGeneralServiceEmoji] = useState('✨');
  const [showEmojiPickerGeneral, setShowEmojiPickerGeneral] = useState(false);

  const [hotelPolicyEmoji, setHotelPolicyEmoji] = useState('📋');
  const [showEmojiPickerPolicy, setShowEmojiPickerPolicy] = useState(false);

  const [propertyPolicyEmoji, setPropertyPolicyEmoji] = useState('📋');
  const [showEmojiPickerPropertyPolicy, setShowEmojiPickerPropertyPolicy] = useState(false);

  const [propertyServiceEmoji, setPropertyServiceEmoji] = useState('✨');
  const [showEmojiPickerPropertyService, setShowEmojiPickerPropertyService] = useState(false);

  // CRUD Room State
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);

  // Incident management states
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentRoomId, setIncidentRoomId] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentHotelFilter, setIncidentHotelFilter] = useState<string>('todos');

  // Variable pricing states
  const [selectedRoomForVariations, setSelectedRoomForVariations] = useState<Room | null>(null);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [newVarPrice, setNewVarPrice] = useState<number>(100);
  const [newVarDate, setNewVarDate] = useState<string>('');
  const [newVarDates, setNewVarDates] = useState<string[]>([]);
  const [newVarMotivo, setNewVarMotivo] = useState<string>('');
  const [newVarIsWeekend, setNewVarIsWeekend] = useState<boolean>(false);
  const [newVarIsAlways, setNewVarIsAlways] = useState<boolean>(false);
  const [activeUserDropdown, setActiveUserDropdown] = useState<string | null>(null);

  // Sandbox-safe Confirmation States
  const [confirmDeleteHotelId, setConfirmDeleteHotelId] = useState<string | null>(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);

  // Tracking states for room editing history
  const [originalRoomStatus, setOriginalRoomStatus] = useState<RoomStatus | null>(null);
  const [roomStatusChangeReason, setRoomStatusChangeReason] = useState("");

  // Reservations tab state
  const [searchResQuery, setSearchResQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [resHotelFilter, setResHotelFilter] = useState("todos");

  // Reservation edit state
  const [selectedResToEdit, setSelectedResToEdit] = useState<Reservation | null>(null);
  const [previewingRes, setPreviewingRes] = useState<Reservation | null>(null);
  const [showResStatusModal, setShowResStatusModal] = useState(false);
  const [newResStatus, setNewResStatus] = useState<any>(null);
  const [statusChangeMessage, setStatusChangeMessage] = useState("");

  // Refunds tab states
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedResForRefund, setSelectedResForRefund] = useState<Reservation | null>(null);
  const [simulatedRequestDate, setSimulatedRequestDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [refundNote, setRefundNote] = useState<string>('');
  const [refundSearch, setRefundSearch] = useState<string>('');
  const [refundHotelFilter, setRefundHotelFilter] = useState<string>('todos');



  // Supabase states for database administration and setup
  const [supabaseSyncLoading, setSupabaseSyncLoading] = useState(false);
  const [supabaseSyncResult, setSupabaseSyncResult] = useState<any | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [supabaseTabError, setSupabaseTabError] = useState("");



  // Calculate reservations for the "Reservas" tab
  const getFilteredReservations = () => {
    // 1. Filter by role boundary
    const baseReservations = isSuper 
      ? reservations 
      : reservations.filter(res => res.hotelId === myHotelId || (activeUser.hotelIds && activeUser.hotelIds.includes(res.hotelId)));

    // 2. Filter by search & dropdown parameters
    return baseReservations.filter(res => {
      // Filter by Hotel selector if (isSuper or allowedHotels.length > 1) and not 'todos'
      if ((isSuper || allowedHotels.length > 1) && resHotelFilter !== 'todos' && res.hotelId !== resHotelFilter) {
        return false;
      }

      // Filter by status dropdown
      if (statusFilter !== 'todos') {
        if (statusFilter === 'eliminadas') {
          if (!res.eliminadaPorCliente) return false;
        } else {
          if (res.estado !== statusFilter) return false;
        }
      }

      // Guest details text search matching
      if (searchResQuery) {
        const queryLower = searchResQuery.toLowerCase();
        const guestObj = users.find(u => u.id === res.guestId);
        const nameMatch = guestObj ? `${guestObj.nombre} ${guestObj.apellido}`.toLowerCase().includes(queryLower) : false;
        const emailMatch = guestObj?.email?.toLowerCase().includes(queryLower) || false;
        const docMatch = guestObj?.documento?.toLowerCase().includes(queryLower) || false;
        const idMatch = res.id.toLowerCase().includes(queryLower) || (res.qrCode && res.qrCode.toLowerCase().includes(queryLower));

        return nameMatch || emailMatch || docMatch || idMatch;
      }

      return true;
    });
  };

  const paginatedReservations = getFilteredReservations();

  // Stats recalculations based on localized filter, role boundary, and date range parameters
  const getFilteredStats = () => {
    // Standard hotel admin is strictly locked to their single hotel's stats unless they have multiple hotels linked
    const selectedFilterId = (isSuper || allowedHotels.length > 1) ? dashboardHotelFilter : myHotelId;

    // 1. Filter reservations by hotel selection
    const firstFilteredReservations = selectedFilterId
      ? reservations.filter(r => r.hotelId === selectedFilterId)
      : (isSuper ? reservations : reservations.filter(r => allowedHotels.some(ah => ah.id === r.hotelId)));

    // 2. Filter reservations by date range (fechaEntrada)
    const filteredReservations = firstFilteredReservations.filter(r => {
      if (dashboardStartDate && r.fechaEntrada < dashboardStartDate) {
        return false;
      }
      if (dashboardEndDate && r.fechaEntrada > dashboardEndDate) {
        return false;
      }
      return true;
    });

    // 3. Filter rooms by hotel selection for capacity/occupancy calculations
    const filteredRooms = selectedFilterId
      ? rooms.filter(r => r.hotelId === selectedFilterId)
      : (isSuper ? rooms : rooms.filter(r => allowedHotels.some(ah => ah.id === r.hotelId)));

    const totalIngresos = filteredReservations
      .filter(r => r.estado === 'ocupada' || r.estado === 'finalizada')
      .reduce((sum, r) => sum + r.total, 0);

    const habOcupadas = filteredRooms.filter(r => r.estado === 'ocupado').length;
    const habDisponibles = filteredRooms.filter(r => r.estado === 'disponible').length;
    const habMantenimiento = filteredRooms.filter(r => r.estado === 'mantenimiento').length;
    const habReservadas = filteredRooms.filter(r => r.estado === 'reservado').length;

    const ocupacionPorcentaje = filteredRooms.length > 0
      ? Math.round((habOcupadas / filteredRooms.length) * 100)
      : 0;

    // Build matching hotel breakdowns
    const targetHotelsForBreakdown = selectedFilterId
      ? hotels.filter(h => h.id === selectedFilterId)
      : (isSuper ? hotels : allowedHotels);

    const dynamicBreakdown = targetHotelsForBreakdown.map(hotel => {
      const hotelRevenue = filteredReservations
        .filter(r => r.hotelId === hotel.id && (r.estado === 'ocupada' || r.estado === 'finalizada'))
        .reduce((sum, r) => sum + r.total, 0);
      return {
        name: hotel.nombre,
        ingresos: parseFloat(hotelRevenue.toFixed(2))
      };
    });

    // Frequent clients matching reservations in my filtered list
    const clientReservationCounts: { [guestId: string]: number } = {};
    filteredReservations.forEach(r => {
      clientReservationCounts[r.guestId] = (clientReservationCounts[r.guestId] || 0) + 1;
    });

    const calculatedClientesFrecuentes = Object.entries(clientReservationCounts)
      .map(([guestId, count]) => {
        const u = users.find(usr => usr.id === guestId);
        return {
          id: guestId,
          nombre: u ? `${u.nombre} ${u.apellido}` : 'Huésped Anónimo',
          email: u ? u.email : '',
          avatar: u ? u.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          reservas: count
        };
      })
      .sort((a, b) => b.reservas - a.reservas)
      .slice(0, 3);

    return {
      totalIngresos,
      totalReservas: filteredReservations.length,
      completadas: filteredReservations.filter(r => r.estado === 'finalizada').length,
      activas: filteredReservations.filter(r => r.estado === 'ocupada' || r.estado === 'confirmada').length,
      canceladas: filteredReservations.filter(r => r.estado === 'cancelada').length,
      totalHabitacionesCount: filteredRooms.length,
      habOcupadas,
      habDisponibles,
      habMantenimiento,
      habReservadas,
      ocupacionPorcentaje,
      ingresosPorHotel: dynamicBreakdown,
      statusPie: [
        { name: 'Ocupadas', value: habOcupadas, color: '#f59e0b' },
        { name: 'Disponibles', value: habDisponibles, color: '#10b981' },
        { name: 'En Mantenimiento', value: habMantenimiento, color: '#ef4444' },
        { name: 'Reservadas', value: habReservadas, color: '#3b82f6' }
      ],
      clientesFrecuentes: calculatedClientesFrecuentes.length > 0 ? calculatedClientesFrecuentes : statistics.clientesFrecuentes.slice(0, 3)
    };
  };

  const currentStats = getFilteredStats();

  // Handle Hotel Save submit form
  const handleHotelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;

    // Ensure the hotel uses one of the 5 images for its brand logo and cover
    if (editingHotel.imagenes && editingHotel.imagenes.length > 0) {
      const isLogoInImgs = editingHotel.imagenes.includes(editingHotel.logo);
      if (!isLogoInImgs) {
        editingHotel.logo = editingHotel.imagenes[0];
        editingHotel.portada = editingHotel.imagenes[0];
      }
    }

    onSaveHotel(editingHotel);
    setShowHotelModal(false);
    setEditingHotel(null);
  };

  // Handle local image file upload and converting to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'hotel' | 'room' | 'property') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Para un rendimiento óptimo de carga, por favor elija un archivo menor a 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      if (rawDataUrl) {
        // Compress the image/video to a compact size
        const dataUrl = await compressImage(rawDataUrl, 1000, 1000, 0.75);
        if (target === 'hotel') {
          if (editingHotel) {
            const currentImgs = editingHotel.imagenes || [];
            if (currentImgs.length >= 15) {
              alert("Ya has alcanzado el límite de 15 fotos o videos.");
              return;
            }
            setEditingHotel({
              ...editingHotel,
              imagenes: [...currentImgs, dataUrl].slice(0, 15)
            });
          }
        } else if (target === 'property') {
          if (editingProperty) {
            const currentImgs = editingProperty.imagenes || [];
            if (currentImgs.length >= 15) {
              alert("Ya has alcanzado el límite de 15 fotos o videos.");
              return;
            }
            setEditingProperty({
              ...editingProperty,
              imagenes: [...currentImgs, dataUrl].slice(0, 15)
            });
          }
        } else {
          if (editingRoom) {
            const currentImgs = editingRoom.imagenes || [];
            if (currentImgs.length >= 15) {
              alert("Ya has alcanzado el límite de 15 de fotos u videos.");
              return;
            }
            setEditingRoom({
              ...editingRoom,
              imagenes: [...currentImgs, dataUrl].slice(0, 15)
            });
          }
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Room Save submit form
  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    const targetHotelId = editingRoom.hotelId || allowedOnlyHotels[0]?.id || hotels[0]?.id || '';
    if (!targetHotelId) {
      alert("Debes seleccionar o crear primero un hotel/establecimiento antes de agregar habitaciones.");
      return;
    }

    const roomToSave = {
      ...editingRoom,
      hotelId: targetHotelId
    };

    // If room status changed, call the dedicated hook to alert active guests and create logs
    if (originalRoomStatus && roomToSave.estado !== originalRoomStatus && onUpdateRoomStatus) {
      onUpdateRoomStatus(roomToSave.id, roomToSave.estado, activeUser.nombre, activeUser.rol, roomStatusChangeReason);
    }

    onSaveRoom(roomToSave);
    setShowRoomModal(false);
    setEditingRoom(null);
  };

  // Quick initiate creation of new hotel
  const startCreateHotel = () => {
    if (!isSuper) return; // Prevention
    setEditingHotel({
      id: `hotel-${Date.now()}`,
      nombre: '',
      logo: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=150',
      portada: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
      imagenes: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500'
      ],
      descripcion: '',
      ubicacion: '',
      coordenadas: { lat: 19.4273, lng: -99.1676 },
      googleMapsUrl: '',
      servicios: ['Wi-Fi de Alta Velocidad', 'Café Filtro', 'Piscina Común'],
      politicas: ['Check-in: A partir de las 15:00', 'Check-out: Hasta las 11:00'],
      horarios: { checkIn: '15:00', checkOut: '11:00' },
      contacto: { telefono: '', email: '' },
      redesSociales: {},
      estado: 'activo',
      tipoEstablecimiento: 'hotel',
      serviciosDetallados: [
        { id: 'breakfast', nombre: 'Desayuno Premium Orgánico', precio: 15, descripcion: 'Ingredientes de granja locales servidos a la habitación', estado: 'activo', emoji: '🍳' },
        { id: 'spa', nombre: 'Pase de Acceso Completo al Spa', precio: 25, descripcion: 'Masajes hidrotermales, sauna de vapor seco y toallas aromatizadas', estado: 'activo', emoji: '💆' },
        { id: 'airport', nombre: 'Traslado Terrestre Aeropuerto-Hotel', precio: 30, descripcion: 'Conductor bilingüe privado en sedán eléctrico de lujo', estado: 'activo', emoji: '🚕' },
        { id: 'wifi', nombre: 'Pase de Oficina WiFi 6E Ultrawide', precio: 10, descripcion: 'Canales ilimitados dedicados para streaming y co-working', estado: 'activo', emoji: '📶' }
      ],
      propietario: { nombre: '', telefono: '', email: '', documento: '' },
      detallesInmueble: { habitaciones: 1, banos: 1, metrosCuadrados: 40, amueblado: true, tieneEstacionamiento: false }
    });
    setShowHotelModal(true);
  };

  const startCreateProperty = () => {
    setNewServiceForm({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo' });
    setEditingProperty({
      id: `hotel-${Date.now()}`,
      nombre: '',
      logo: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=150',
      portada: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500',
      imagenes: [
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=500'
      ],
      descripcion: '',
      ubicacion: '',
      coordenadas: { lat: -1.8312, lng: -78.1834 },
      googleMapsUrl: '',
      servicios: ['Agua Caliente', 'Wifi Fibra Óptica', 'Estacionamiento Autónomo'],
      politicas: ['Cuidado e higiene obligatoria del espacio', 'No se permiten ruidos molestos'],
      horarios: { checkIn: '12:00', checkOut: '14:00' },
      contacto: { telefono: '', email: '' },
      redesSociales: {},
      estado: 'activo',
      tipoEstablecimiento: 'casa',
      finalidad: 'alquiler',
      serviciosDetallados: [],
      propietario: { nombre: '', telefono: '', email: '', documento: '' },
      detallesInmueble: { habitaciones: 0, banos: 0, metrosCuadrados: undefined, amueblado: false, tieneEstacionamiento: false }
    });
    setShowPropertyModal(true);
  };

  const handlePropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    if (editingProperty.detallesInmueble) {
      if (editingProperty.detallesInmueble.habitaciones === undefined || editingProperty.detallesInmueble.habitaciones === null || isNaN(editingProperty.detallesInmueble.habitaciones)) {
        alert("Por favor ingrese el número de habitaciones.");
        return;
      }
      if (editingProperty.detallesInmueble.banos === undefined || editingProperty.detallesInmueble.banos === null || isNaN(editingProperty.detallesInmueble.banos)) {
        alert("Por favor ingrese el número de baños.");
        return;
      }
      if (!editingProperty.detallesInmueble.metrosCuadrados || isNaN(editingProperty.detallesInmueble.metrosCuadrados)) {
        alert("Por favor ingrese la superficie en m².");
        return;
      }
    }

    if (!editingProperty.propietario?.nombre || !editingProperty.propietario?.telefono || !editingProperty.propietario?.email) {
      alert("Por favor complete los datos de contacto del propietario (Nombre, Teléfono y Email).");
      return;
    }

    if (!editingProperty.nombre) {
      alert("Por favor ingrese el nombre del inmueble o propiedad comercial.");
      return;
    }

    if (!editingProperty.ubicacion) {
      alert("Por favor ingrese la ubicación exacta de la propiedad.");
      return;
    }

    if (editingProperty.imagenes && editingProperty.imagenes.length > 0) {
      const isLogoInImgs = editingProperty.imagenes.includes(editingProperty.logo);
      if (!isLogoInImgs) {
        editingProperty.logo = editingProperty.imagenes[0];
        editingProperty.portada = editingProperty.imagenes[0];
      }
    }

    onSaveHotel(editingProperty);
    setShowPropertyModal(false);
    setEditingProperty(null);
  };

  // Quick initiate creation of new room
  const startCreateRoom = () => {
    setEditingRoom({
      id: `room-${Date.now()}`,
      hotelId: allowedOnlyHotels[0]?.id || hotels[0]?.id || '',
      numero: '',
      nombre: '',
      descripcion: '',
      precio: 150,
      capacidad: 2,
      camas: 1,
      tipo: 'Estándar',
      imagenes: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=500'],
      servicios: ['Ducha Lluvia', 'TV', 'Aire Acondicionado'],
      estado: 'disponible'
    });
    setOriginalRoomStatus(null);
    setRoomStatusChangeReason("");
    setShowRoomModal(true);
  };

  const getTabLabel = () => {
    switch (adminTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'hotels':
        return 'Hoteles';
      case 'properties':
        return 'Propiedades';
      case 'rooms':
        return 'Habitaciones';
      case 'users':
        return 'Usuarios';
      case 'logs':
        return 'Auditoría / Bitácora';
      case 'reservations':
        return 'Reservas';
      case 'refunds':
        return 'Reembolsos';
      case 'incidents':
        return 'Incidencias';
      default:
        return 'General';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* ADMIN CONTROL PANEL HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            <h3 className="text-xl font-bold text-neutral-800">Panel de Control - {getTabLabel()}</h3>
            {activeUser.rol === 'super_admin' ? (
              <span className="text-[10px] bg-red-50 text-red-800 font-bold border border-red-200 px-2 py-0.5 rounded uppercase ml-2">SUPER-ADMINISTRADOR</span>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-800 font-bold border border-amber-200 px-2 py-0.5 rounded uppercase ml-2">ADMIN-HOTEL</span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">Gestión unificada de múltiples establecimientos, control operativo, estadísticas y auditoría del sistema.</p>
        </div>
      </div>

      {/* MAIN ADMIN GRAPHICS DASHBOARD TAB */}
      {adminTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Dashboard top controls: Hotel localized filter & Date dynamic inputs */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
            <div>
              <h4 className="font-semibold text-lg text-neutral-800 font-display">Métricas Consolidadas</h4>
              <p className="text-[10px] text-neutral-450 mt-0.5">Análisis de rendimiento en base al establecimiento y intervalo de tiempo</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3.5">
              {/* Hotel Filter */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-neutral-250 text-xs text-neutral-500 shadow-sm">
                <span>Establecimiento:</span>
                <select
                  value={dashboardHotelFilter}
                  disabled={!(isSuper || allowedHotels.length > 1)}
                  onChange={(e) => setDashboardHotelFilter(e.target.value)}
                  className="font-bold border-none text-neutral-800 focus:outline-none focus:ring-0 cursor-pointer bg-transparent disabled:opacity-80"
                >
                  {(isSuper || allowedHotels.length > 1) && (
                    <option value="">{isSuper ? 'Todos los hoteles' : 'Todos mis establecimientos'}</option>
                  )}
                  {allowedHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter: Desde */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-neutral-250 text-xs text-neutral-500 shadow-sm">
                <span>Desde:</span>
                <input
                  type="date"
                  value={dashboardStartDate}
                  onChange={(e) => setDashboardStartDate(e.target.value)}
                  className="font-semibold text-neutral-800 focus:outline-none border-none p-0 cursor-pointer bg-transparent text-xs"
                />
              </div>

              {/* Date Filter: Hasta */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-neutral-250 text-xs text-neutral-500 shadow-sm">
                <span>Hasta:</span>
                <input
                  type="date"
                  value={dashboardEndDate}
                  onChange={(e) => setDashboardEndDate(e.target.value)}
                  className="font-semibold text-neutral-800 focus:outline-none border-none p-0 cursor-pointer bg-transparent text-xs"
                />
              </div>

              {/* Clean Button */}
              {(dashboardStartDate || dashboardEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setDashboardStartDate("");
                    setDashboardEndDate("");
                  }}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  Limpiar Fechas
                </button>
              )}
            </div>
          </div>

          {/* BENTO CORES BANNERS GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            <div className="bg-white border border-neutral-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">Ingresos Acumulados</span>
                <span className="font-mono text-xl md:text-2xl font-bold text-neutral-900">${currentStats.totalIngresos.toFixed(2)}</span>
                <span className="text-[9px] text-emerald-600 block flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +14.2% vs mes anterior
                </span>
              </div>
              <div className="w-10 h-10 bg-teal-50 text-teal-600 flex items-center justify-center rounded-xl border border-teal-100">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">Porcentaje Ocupacional</span>
                <span className="font-mono text-xl md:text-2xl font-bold text-neutral-900">{currentStats.ocupacionPorcentaje}%</span>
                <div className="w-full bg-neutral-100 h-1 rounded-full overflow-hidden mt-2">
                  <div className="bg-teal-600 h-full rounded-full" style={{ width: `${currentStats.ocupacionPorcentaje}%` }} />
                </div>
              </div>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-xl border border-emerald-100">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">Reservaciones Totales</span>
                <span className="font-mono text-xl md:text-2xl font-bold text-neutral-900">{currentStats.totalReservas}</span>
                <span className="text-[9px] text-neutral-400 block">Activas & Completadas</span>
              </div>
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-xl border border-indigo-100">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">Cancelaciones</span>
                <span className="font-mono text-xl md:text-2xl font-bold text-red-600">{currentStats.canceladas}</span>
                <span className="text-[9px] text-red-500 block">Tasa de cancelación: {currentStats.totalReservas > 0 ? Math.round((currentStats.canceladas / currentStats.totalReservas) * 100) : 0}%</span>
              </div>
              <div className="w-10 h-10 bg-red-50 text-red-600 flex items-center justify-center rounded-xl border border-red-100">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* RECHARTS PLOTS COMPREHENSION BLOCK */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Revenue breakdown chart by hotel */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm space-y-4">
              <div>
                <h5 className="font-semibold text-neutral-800 text-sm">Distribución de Ingresos por Establecimiento</h5>
                <p className="text-[10px] text-neutral-400">Rendimiento neto de facturación SaaS consolidada</p>
              </div>

              {/* Bar Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentStats.ingresosPorHotel}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: '#fafafa' }} formatter={(val) => [`$${val} USD`, 'Ingresos']} />
                    <Bar dataKey="ingresos" fill="#0d9488" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Room operational status pie diagram */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h5 className="font-semibold text-neutral-800 text-sm">Estado General de Habitaciones</h5>
                <p className="text-[10px] text-neutral-400">Uso y disponibilidad actual de la capacidad instalada</p>
              </div>

              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const isEmpty = currentStats.statusPie.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0) === 0;
                    const chartData = isEmpty
                      ? [{ name: 'Sin datos', value: 1, color: '#e5e7eb' }]
                      : currentStats.statusPie;
                    return (
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={isEmpty ? 0 : 5}
                          dataKey="value"
                        >
                          {chartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        {!isEmpty && <Tooltip formatter={(value) => [value, 'Cuentas']} />}
                      </PieChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>

              {/* Status indices markers */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {currentStats.statusPie.map((entry: any, index: number) => (
                  <div key={index} className="flex items-center gap-1.5 p-1 bg-neutral-50 rounded border border-neutral-100">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-neutral-500 font-medium truncate">{entry.name}: <span className="font-bold text-neutral-800">{entry.value}</span></span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* FREQUENT CLIENTELE BOARD */}
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-neutral-100 pb-4">
              <div>
                <h5 className="font-bold text-neutral-850 text-sm tracking-tight">Registro Histórico de Huéspedes Frecuentes</h5>
                <p className="text-[11px] text-neutral-400 mt-0.5">Historial de pernoctación de clientes VIP recurrentes.</p>
              </div>

              {/* Segmented control bar / Mini Navbar */}
              <div className="inline-flex p-1 bg-neutral-100 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFrequentClientsTab('cards')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    frequentClientsTab === 'cards' 
                      ? 'bg-white text-[#1E2E3E] shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  📇 Vista Tarjetas
                </button>
                <button
                  type="button"
                  onClick={() => setFrequentClientsTab('table')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    frequentClientsTab === 'table' 
                      ? 'bg-white text-[#1E2E3E] shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  📊 Tabla Desplazable
                </button>
              </div>
            </div>
            
            {/* View 1: Cards Layout */}
            {frequentClientsTab === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                {currentStats.clientesFrecuentes.map((cli: any, index: number) => (
                  <div key={index} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-150 flex flex-col justify-between space-y-3 hover:shadow-xs transition-all">
                    <div className="flex items-start gap-3">
                      <img src={cli.avatar} alt="Avatar guest" className="w-10 h-10 rounded-full border border-neutral-200 shrink-0 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-neutral-850 text-xs block truncate leading-normal">{cli.nombre}</p>
                        <p className="text-[10.5px] text-teal-700 font-mono block break-all leading-normal mt-0.5">{cli.email}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-neutral-150 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 font-medium font-sans">Reservaciones completadas:</span>
                        <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-755 font-black font-mono text-[10px]">
                          {cli.reservas} veces
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 font-medium font-sans">Estatus del Cliente:</span>
                        <span className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-sans">VIP Preferencial</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View 2: Table Layout */}
            {frequentClientsTab === 'table' && (
              <div className="overflow-x-auto w-full rounded-2xl border border-neutral-150 animate-fade-in bg-white">
                <table className="w-full min-w-[650px] text-left text-xs text-neutral-500 border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-150 bg-neutral-50/50 text-neutral-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Huésped</th>
                      <th className="py-3 px-4">E-mail de Contacto</th>
                      <th className="py-3 px-4 text-center">N° Reservaciones</th>
                      <th className="py-3 px-4 text-right pr-6">Preferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {currentStats.clientesFrecuentes.map((cli: any, index: number) => (
                      <tr key={index} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-neutral-850">
                          <div className="flex items-center gap-2.5">
                            <img src={cli.avatar} alt="Avatar guest" className="w-8 h-8 rounded-full border border-neutral-200 object-cover" />
                            <span className="whitespace-nowrap">{cli.nombre}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-600 whitespace-nowrap">{cli.email}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-bold font-mono text-[11px]">
                            {cli.reservas} veces
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap pr-6">
                          <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">VIP Preferencial</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* CRUD HOTEL MANAGEMENT */}
      {adminTab === 'hotels' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-neutral-50 p-4 rounded-2xl border border-neutral-100 font-sans flex-wrap gap-4">
            <div>
              <h4 className="font-semibold text-neutral-800 font-sans">Directorio de Hoteles Boutique ({allowedOnlyHotels.length})</h4>
              <p className="text-xs text-neutral-400">
                {isSuper 
                  ? 'Agregue, deshabilite o modifique las fichas de los hoteles afiliados en esta sección.'
                  : 'Modifique las especificaciones, servicios o información pública de su hotel.'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdminTab('rooms');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold shadow transition-all duration-200 hover:shadow-md cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4 text-brand-cyan" />
                <span>Gestionar Habitaciones</span>
              </button>

              {isSuper && (
                <button
                  onClick={startCreateHotel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition-transform cursor-pointer active:scale-95 animate-fade-in"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Hotel</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allowedOnlyHotels.map(h => (
              <div key={h.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-all">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    <img src={h.logo} alt="brand logo" className="w-12 h-12 object-cover rounded-xl border border-neutral-200 shrink-0" />
                    <div>
                      <h5 className="font-semibold text-neutral-800 text-base">{h.nombre}</h5>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md ${h.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                          {h.estado}
                        </span>
                        <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                          h.tipoEstablecimiento === 'casa' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          h.tipoEstablecimiento === 'departamento' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {h.tipoEstablecimiento === 'casa' ? '🏡 Casa' :
                           h.tipoEstablecimiento === 'departamento' ? '🏢 Departamento' :
                           '🏨 Hotel'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setEditingHotel({ ...h });
                        setShowHotelModal(true);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                      title="Editar Ficha del Establecimiento"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {isSuper && (
                      confirmDeleteHotelId === h.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                          <button
                            onClick={() => setConfirmDeleteHotelId(null)}
                            className="px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                          >
                            Volver
                          </button>
                          <button
                            onClick={() => {
                              onDeleteHotel(h.id);
                              setConfirmDeleteHotelId(null);
                            }}
                            className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded cursor-pointer"
                          >
                            Sí, Borrar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteHotelId(h.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Propiedad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                <p className="text-xs text-neutral-500 leading-normal line-clamp-3">{h.descripcion}</p>

                {/* Specifics of Houses and Apartments */}
                {(h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento') && h.detallesInmueble && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-[11px] font-medium text-neutral-600 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <span>🛏️ Habitaciones:</span> <strong className="text-neutral-800">{h.detallesInmueble.habitaciones}</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>🚿 Baños:</span> <strong className="text-neutral-800">{h.detallesInmueble.banos}</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>📐 Superficie:</span> <strong className="text-neutral-800">{h.detallesInmueble.metrosCuadrados || 'N/D'} m²</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>🛋️ Amueblado:</span> <strong className="text-neutral-800">{h.detallesInmueble.amueblado !== false ? 'Sí' : 'No'}</strong>
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-[10px] text-neutral-400 mt-1 pt-1 border-t border-dashed border-neutral-200">
                      <span>🚘 Estacionamiento:</span> <strong className="text-neutral-600 font-semibold">{h.detallesInmueble.tieneEstacionamiento ? 'Sí, privado' : 'No cuenta'}</strong>
                    </div>
                  </div>
                )}

                {/* Owner Information Card */}
                {(h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento') && h.propietario && (
                  <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-150 text-[10.5px] space-y-1.5">
                    <p className="font-bold text-teal-800 uppercase tracking-widest text-[9.5px]">👤 Información del Propietario</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-600 font-medium">
                      <div>
                        <span className="text-neutral-400 block text-[9px] uppercase">Propietario:</span>
                        <span className="text-neutral-800 font-semibold">{h.propietario.nombre}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px] uppercase">Teléfono Contacto:</span>
                        <a href={`tel:${h.propietario.telefono}`} className="text-teal-700 font-bold hover:underline font-mono">{h.propietario.telefono}</a>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-neutral-400 block text-[9px] uppercase">Correo de Contacto:</span>
                        <code className="text-neutral-700 bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-[10px] block truncate">{h.propietario.email}</code>
                      </div>
                      {h.propietario.documento && (
                        <div className="sm:col-span-2">
                          <span className="text-neutral-400 block text-[9px] uppercase">Documento Identidad:</span>
                          <span className="text-neutral-850 font-mono text-[10px]">{h.propietario.documento}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-500 pt-3 border-t border-neutral-100 items-center">
                  <div>
                    <span className="text-neutral-400 font-medium">Ubicación Física:</span>
                    <p className="truncate block font-semibold text-neutral-700 max-w-[130px]">{h.ubicacion}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400 font-medium">Configuración de Suites:</span>
                    <p className="font-semibold text-neutral-800">
                      {h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento' 
                        ? '1 Alquiler Completo'
                        : `${rooms.filter(r => r.hotelId === h.id).length} suites registradas`
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* CRUD PROPERTIES (RENTAL & SALE) SYSTEM */}
      {adminTab === 'properties' && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="flex justify-between items-center bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <div>
              <h4 className="font-semibold text-neutral-800">Directorio de Propiedades (Casas & Departamentos) ({allowedOnlyProperties.length})</h4>
              <p className="text-xs text-neutral-400">
                Gestione las propiedades registradas especificando si están destinadas para Alquiler o Ventas, con información de contacto del propietario.
              </p>
            </div>
            {isSuper && (
              <button
                onClick={startCreateProperty}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-white rounded-xl text-xs font-bold shadow transition-transform cursor-pointer active:scale-95 animate-fade-in"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Propiedad</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allowedOnlyProperties.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-neutral-200">
                <Building className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <h5 className="font-bold text-neutral-700">No hay propiedades registradas</h5>
                <p className="text-xs text-neutral-450 mt-1">Cree una nueva propiedad para publicarla en alquiler o venta.</p>
                {isSuper && (
                  <button
                    onClick={startCreateProperty}
                    className="mt-4 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl shadow cursor-pointer hover:bg-teal-700"
                  >
                    Crear Nueva Propiedad
                  </button>
                )}
              </div>
            ) : (
              allowedOnlyProperties.map(h => (
                <div key={h.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-all font-sans">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex gap-3">
                      <img src={h.logo} alt="brand logo" className="w-12 h-12 object-cover rounded-xl border border-neutral-200 shrink-0" />
                      <div>
                        <h5 className="font-semibold text-neutral-800 text-base flex items-center gap-2">
                          {h.nombre}
                        </h5>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md ${h.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {h.estado}
                          </span>
                          <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                            h.tipoEstablecimiento === 'casa' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {h.tipoEstablecimiento === 'casa' ? '🏡 Casa' : '🏢 Departamento'}
                          </span>
                          <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                            h.finalidad === 'venta' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-pink-100 text-pink-800 border-pink-300'
                          }`}>
                            {h.finalidad === 'venta' ? '🏷️ En Venta' : '🔑 En Alquiler'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions buttons */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setEditingProperty({ 
                            ...h, 
                            servicios: h.servicios || [],
                            serviciosDetallados: h.serviciosDetallados || [] 
                          });
                          setNewServiceForm({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo' });
                          setShowPropertyModal(true);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar Ficha de la Propiedad"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isSuper && (
                        confirmDeleteHotelId === h.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                            <button
                              onClick={() => setConfirmDeleteHotelId(null)}
                              className="px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                            >
                              Volver
                            </button>
                            <button
                              onClick={() => {
                                onDeleteHotel(h.id);
                                setConfirmDeleteHotelId(null);
                              }}
                              className="px-1.5 py-0.5 bg-red-650 text-white text-[9px] font-bold rounded cursor-pointer"
                            >
                              Sí, Borrar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteHotelId(h.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Propiedad"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 leading-normal line-clamp-3 font-sans">{h.descripcion}</p>

                  {/* Specifics of Houses and Apartments */}
                  {h.detallesInmueble && (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-[11px] font-medium text-neutral-600 grid grid-cols-2 gap-2 font-mono">
                      <div className="flex items-center gap-1">
                        <span>🛏️ Habitaciones:</span> <strong className="text-neutral-800 font-bold">{h.detallesInmueble.habitaciones}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🚿 Baños:</span> <strong className="text-neutral-800 font-bold">{h.detallesInmueble.banos}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>📐 Superficie:</span> <strong className="text-neutral-800 font-bold">{h.detallesInmueble.metrosCuadrados || 'N/D'} m²</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🛋️ Amueblado:</span> <strong className="text-neutral-800 font-bold">{h.detallesInmueble.amueblado !== false ? 'Sí' : 'No'}</strong>
                      </div>
                      <div className="col-span-2 flex items-center gap-1 text-[10px] text-neutral-400 mt-1 pt-1 border-t border-dashed border-neutral-200 font-sans">
                        <span>🚘 Estacionamiento:</span> <strong className="text-neutral-605 font-semibold">{h.detallesInmueble.tieneEstacionamiento ? 'Sí, privado' : 'No cuenta'}</strong>
                      </div>
                    </div>
                  )}

                  {/* Owner Information Card */}
                  {h.propietario && (
                    <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-150 text-[10.5px] space-y-1.5 font-sans">
                      <p className="font-bold text-teal-800 uppercase tracking-widest text-[9.5px]">👤 Información de Contacto / Propietario</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-600 font-medium">
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase">Propietario:</span>
                          <span className="text-neutral-800 font-semibold">{h.propietario.nombre}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase">Teléfono Contacto:</span>
                          <a href={`tel:${h.propietario.telefono}`} className="text-teal-700 font-bold hover:underline font-mono">{h.propietario.telefono}</a>
                        </div>
                        <div className="sm:col-span-2 font-mono">
                          <span className="text-neutral-400 block text-[9px] uppercase font-sans">Correo de Contacto:</span>
                          <code className="text-neutral-700 bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-[10px] block truncate">{h.propietario.email}</code>
                        </div>
                        {h.propietario.documento && (
                          <div className="sm:col-span-2">
                            <span className="text-neutral-400 block text-[9px] uppercase">Identificación (DNI/CI):</span>
                            <span className="text-neutral-850 font-mono text-[10px]">{h.propietario.documento}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-500 pt-3 border-t border-neutral-100 font-sans">
                    <div>
                      <span className="text-neutral-400 font-medium">Ubicación Física:</span>
                      <p className="truncate block font-semibold text-neutral-700">{h.ubicacion}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-medium font-sans">Finalidad Comercial:</span>
                      <p className="font-semibold text-teal-700 uppercase tracking-wide">
                        {h.finalidad === 'venta' ? 'Propiedad en Venta' : 'Alquiler Temporario'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CRUD INTERNAL ROOMS */}
      {adminTab === 'rooms' && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <div>
              <h4 className="font-semibold text-neutral-800">Catálogo Operativo de Habitaciones Centralizado ({allowedRooms.length})</h4>
              <p className="text-xs text-neutral-400">Ajuste estructuralmente capacidades, asignaciones de cama, nombres y precios de suites.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdminTab('incidents');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold shadow transition-all duration-200 hover:shadow-md cursor-pointer active:scale-95"
              >
                <Wrench className="w-4 h-4 text-teal-400" />
                <span>Gestionar Incidencias</span>
              </button>

              {(isSuper || activeUser.rol === 'hotel_admin') && (
                <button
                  type="button"
                  onClick={startCreateRoom}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition-all duration-200 hover:shadow-md cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Habitación</span>
                </button>
              )}
            </div>
          </div>

          {(isSuper || allowedHotels.length > 1) && (
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm border-l-4 border-l-teal-600">
              <div className="space-y-0.5" id="super-admin-hotel-select-panel">
                <span className="text-xs font-bold text-neutral-800 block">Filtro de Establecimiento</span>
                <p className="text-[10px] text-neutral-400">Seleccione un establecimiento para filtrar las habitaciones mostradas.</p>
              </div>
              <select
                id="super-admin-selected-hotel-dropdown"
                value={superAdminSelectedHotelId}
                onChange={(e) => setSuperAdminSelectedHotelId(e.target.value)}
                className="text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-3 focus:outline-none cursor-pointer w-full md:max-w-md transition-colors"
              >
                <option value="all">🏨 Mostrar todos {isSuper ? '' : 'mis'} los establecimientos ({isSuper ? rooms.length : rooms.filter(r => allowedHotels.some(ah => ah.id === r.hotelId)).length} habitaciones)</option>
                {allowedHotels.map(h => (
                  <option key={h.id} value={h.id}>
                    🏢 {h.nombre} ({rooms.filter(r => r.hotelId === h.id).length} habitaciones registradas)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3">
            {allowedRooms.map(room => {
              const h = allowedHotels.find(ht => ht.id === room.hotelId);
              return (
                <div key={room.id} className="bg-white rounded-xl p-4 border border-neutral-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition-all shadow-inner">
                  <div className="flex gap-4">
                    <img src={room.imagenes[0]} alt="Room thumbnail" className="w-14 h-14 object-cover rounded-lg border border-neutral-150 shrink-0 self-center" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded font-mono font-bold">Cuarto {room.numero}</span>
                        <span className="text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-semibold">{room.tipo}</span>
                        <span className="text-[10px] text-neutral-400 font-normal">Hotel: {h?.nombre || `Hotel Desconocido (${room.hotelId})`}</span>
                      </div>
                      <h5 className="font-bold text-neutral-800 text-sm mt-1">{room.nombre}</h5>
                      <p className="text-[10px] text-neutral-400">Capacidad: {room.capacidad} personas / Camas: {room.camas}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-left md:text-right">
                      <span className="text-[9px] text-neutral-400 block font-medium">PRECIO</span>
                      <span className="font-mono font-bold text-teal-700 text-sm">${room.precio} USD</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        room.estado === 'disponible' ? 'bg-emerald-50 text-emerald-700' :
                        room.estado === 'ocupado' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700 font-bold'
                      }`}>
                        {room.estado}
                      </span>

                      <button
                        onClick={() => {
                          setSelectedRoomForVariations(room);
                          setNewVarPrice(room.precio);
                          setNewVarDate('');
                          setNewVarMotivo('');
                          setNewVarIsWeekend(false);
                          setShowVariationsModal(true);
                        }}
                        className="flex items-center gap-1 p-1 px-2.5 bg-neutral-100 hover:bg-teal-50 hover:text-teal-700 text-neutral-600 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        <TrendingUp className="w-3 h-3 text-teal-600" />
                        <span>Precios Variables</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingRoom({ ...room });
                          setOriginalRoomStatus(room.estado);
                          setRoomStatusChangeReason("");
                          setShowRoomModal(true);
                        }}
                        className="p-1 px-1.5 hover:bg-neutral-100 rounded text-neutral-500 cursor-pointer text-xs"
                      >
                        Editar
                      </button>
                      {isSuper && (
                        confirmDeleteRoomId === room.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-100">
                            <button
                              onClick={() => setConfirmDeleteRoomId(null)}
                              className="px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                            >
                              Volver
                            </button>
                            <button
                              onClick={() => {
                                onDeleteRoom(room.id);
                                setConfirmDeleteRoomId(null);
                              }}
                              className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded cursor-pointer"
                            >
                              Sí, Borrar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteRoomId(room.id)}
                            className="p-1 px-1.5 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                          >
                            Borrar
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* USER MANAGEMENT & CHANGE ROLE CAPABILITIES */}
      {adminTab === 'users' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h4 className="font-semibold text-neutral-800">Administrador de Roles y Usuarios</h4>
            <p className="text-xs text-neutral-400">Visualice usuarios registrados y cambie el rol de cualquier usuario del sistema aplicando control de acceso de Zero-Trust.</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-500">
                <thead>
                  <tr className="border-b border-neutral-150 bg-neutral-50 text-neutral-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Cédula / Identificación</th>
                    <th className="py-3 px-4">Estado Cuenta</th>
                    <th className="py-3 px-4 text-center">Rol del Sistema</th>
                    <th className="py-3 px-4 text-left">Hotel Enlazado</th>
                    <th className="py-3 px-4 text-right">Acción Rol / Seguridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {allowedUsers.map(u => {
                    const isSelf = u.id === activeUser.id;
                    return (
                      <tr key={u.id} className={isSelf ? 'bg-neutral-50/50' : ''}>
                        <td className="py-3 px-4 font-semibold text-neutral-800 flex items-center gap-2">
                          <img src={u.avatar} alt="User profile" className="w-8 h-8 rounded-full border border-neutral-200 shrink-0" />
                          <div>
                            <span>{u.nombre} {u.apellido}</span>
                            {isSelf && <span className="text-[9px] bg-neutral-900 text-white font-normal ml-2 py-0.5 px-1.5 rounded uppercase">Usted</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-sans text-neutral-700">{u.email}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{u.telefono}</span>
                        </td>
                        <td className="py-3 px-4 font-mono">{u.documento}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => !isSelf && onToggleUserStatus(u.id)}
                            className={`flex items-center gap-1 font-semibold text-[10px] uppercase cursor-pointer ${
                              u.estado === 'activo' ? 'text-emerald-600' : 'text-neutral-400'
                            }`}
                          >
                            <span>{u.estado}</span>
                            {!isSelf && (u.estado === 'activo' ? <ToggleRight className="w-4 h-4 text-teal-600" /> : <ToggleLeft className="w-4 h-4 text-neutral-400" />)}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.rol === 'super_admin' ? 'bg-red-50 text-red-700 border border-red-100' :
                            u.rol === 'hotel_admin' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            u.rol === 'recepcionista' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {u.rol}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-left">
                          {u.rol === 'super_admin' ? (
                            <span className="text-[10px] text-neutral-400 italic">Todos / Global</span>
                          ) : !isSuper ? (
                            <div className="flex flex-wrap gap-1">
                              {hotels.filter(h => h.id === u.hotelId || (u.hotelIds && u.hotelIds.includes(h.id))).map(h => (
                                <span key={h.id} className="text-[9px] font-semibold text-neutral-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {h.nombre}
                                </span>
                              ))}
                              {(!u.hotelId && (!u.hotelIds || u.hotelIds.length === 0)) && (
                                <span className="text-[9px] text-neutral-400 italic">Ninguno / Libre</span>
                              )}
                            </div>
                          ) : (
                            <div className="relative inline-block text-left w-full max-w-[150px]">
                              <button
                                type="button"
                                onClick={() => setActiveUserDropdown(activeUserDropdown === u.id ? null : u.id)}
                                className="w-full flex items-center justify-between gap-1.5 bg-white border border-neutral-200 rounded text-[10px] font-semibold py-1 px-1.5 focus:outline-none cursor-pointer hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
                              >
                                <span className="truncate text-left max-w-[110px]">
                                  {(() => {
                                    const linked = hotels.filter(h => h.id === u.hotelId || (u.hotelIds && u.hotelIds.includes(h.id)));
                                    if (linked.length === 0) return 'Ninguno / Libre';
                                    if (linked.length === 1) return linked[0].nombre;
                                    return `${linked.length} Hoteles`;
                                  })()}
                                </span>
                                <svg 
                                  className="w-3 h-3 text-neutral-400 shrink-0" 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  viewBox="0 0 20 20" 
                                  fill="currentColor"
                                >
                                  <path 
                                    fillRule="evenodd" 
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" 
                                    clipRule="evenodd" 
                                  />
                                </svg>
                              </button>
                              
                              {activeUserDropdown === u.id && (
                                <>
                                  {/* Responsive Backdrop: backdrop-blur on mobile, transparent on desktop */}
                                  <div 
                                    className="fixed inset-0 md:absolute md:inset-0 z-30 bg-neutral-900/40 md:bg-transparent backdrop-blur-[2px] md:backdrop-blur-none cursor-pointer" 
                                    onClick={() => setActiveUserDropdown(null)}
                                  />
                                  
                                  {/* Modal / Popover container */}
                                  <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:translate-y-0 md:top-auto md:absolute md:right-0 md:left-0 mt-1 w-auto max-w-sm md:w-56 bg-white border border-neutral-200 rounded-xl md:rounded shadow-2xl md:shadow-lg z-40 p-4 md:p-2 space-y-3 md:space-y-1 max-h-[70vh] md:max-h-48 overflow-y-auto mx-auto md:mx-0">
                                    <div className="flex items-center justify-between px-1">
                                      <span className="text-xs md:text-[9px] text-neutral-800 md:text-neutral-400 font-bold uppercase">
                                        Vincular Hoteles
                                      </span>
                                      {/* Close icon ONLY on mobile */}
                                      <button 
                                        type="button"
                                        onClick={() => setActiveUserDropdown(null)}
                                        className="md:hidden p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full cursor-pointer"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <div className="h-[1px] bg-neutral-100 my-1" />

                                    <div className="space-y-1 max-h-[40vh] md:max-h-36 overflow-y-auto">
                                      {hotels.map(h => {
                                        const isChecked = u.hotelId === h.id || (u.hotelIds && u.hotelIds.includes(h.id));
                                        return (
                                          <label 
                                            key={h.id} 
                                            className="flex items-center gap-3 md:gap-2 px-3 py-2.5 md:px-2 md:py-1.5 hover:bg-neutral-50 rounded cursor-pointer text-[12px] md:text-[10px] font-semibold text-neutral-700 hover:text-neutral-900 transition-colors"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={!!isChecked}
                                              onChange={() => {
                                                let currentIds = u.hotelIds || [];
                                                if (u.hotelId && !currentIds.includes(u.hotelId)) {
                                                  currentIds = [u.hotelId, ...currentIds];
                                                }
                                                let nextIds: string[];
                                                if (isChecked) {
                                                  nextIds = currentIds.filter(id => id !== h.id);
                                                } else {
                                                  nextIds = [...currentIds, h.id];
                                                }
                                                if (onUpdateUserHotels) {
                                                  onUpdateUserHotels(u.id, nextIds);
                                                } else {
                                                  onUpdateUserHotel(u.id, nextIds[0] || undefined);
                                                }
                                              }}
                                              className="rounded border-neutral-300 text-teal-600 focus:ring-teal-500 w-4.5 h-4.5 md:w-3.5 md:h-3.5 cursor-pointer"
                                            />
                                            <span className="truncate" title={h.nombre}>{h.nombre}</span>
                                          </label>
                                        );
                                      })}
                                      {hotels.length === 0 && (
                                        <div className="text-[10px] md:text-[9px] text-neutral-400 italic p-1.5 text-center">No hay hoteles creados</div>
                                      )}
                                    </div>

                                    {/* Done button ONLY on mobile to close selection window */}
                                    <div className="md:hidden pt-2 border-t border-neutral-100">
                                      <button
                                        type="button"
                                        onClick={() => setActiveUserDropdown(null)}
                                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer text-center"
                                      >
                                        Aceptar
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={u.rol}
                              disabled={isSelf || (!isSuper && u.hotelId !== myHotelId)} // Restricted to same hotel or if self edit
                              onChange={(e) => onUpdateUserRole(u.id, e.target.value as UserRole)}
                              className="bg-white border border-neutral-200 rounded text-[10px] font-semibold py-1 px-1.5 focus:outline-none cursor-pointer disabled:bg-neutral-100 disabled:cursor-not-allowed"
                            >
                              {isSuper && <option value="super_admin">Super Admin</option>}
                              <option value="hotel_admin">Hotel Admin</option>
                              <option value="recepcionista">Recepcionista</option>
                              <option value="cliente">Cliente</option>
                            </select>


                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SYSTEM SECURITY & ACTIVITY TIMELINE LOGS */}
      {adminTab === 'logs' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* ⭐ PANEL DE OPINIONES Y VALORACIONES DE ESTANCIAS */}
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-neutral-800 flex items-center gap-2 font-display">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                Valoraciones y Opiniones de Estancias
              </h4>
              <p className="text-xs text-neutral-400">Reseñas y puntuaciones enviadas por huéspedes de forma automática al finalizar sus estadías.</p>
            </div>

            {reviews.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-3xl p-8 text-center text-neutral-500 text-xs">
                <Star className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="font-semibold text-neutral-400">Ninguna valoración enviada por huéspedes aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews
                  .filter((r: any) => activeUser.rol === 'super_admin' || r.hotelId === activeUser.hotelId)
                  .map((rev: any) => {
                    const hotel = hotels.find((h: any) => h.id === rev.hotelId);
                    return (
                      <div key={rev.id} className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-[9px] font-bold text-teal-850 bg-teal-50 border border-teal-150 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                {hotel?.nombre || 'Hotel'}
                              </span>
                              <h5 className="font-semibold text-neutral-800 text-xs mt-1.5 leading-none">{rev.userName || 'Cliente'}</h5>
                              <span className="text-[9px] text-neutral-400 font-mono italic">{rev.fecha}</span>
                            </div>

                            <div className="flex gap-0.5 shrink-0">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3 h-3 ${
                                    i < rev.rating ? 'text-yellow-500 fill-current' : 'text-neutral-200'
                                  }`} 
                                />
                              ))}
                            </div>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed italic bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-100/70">
                            "{rev.comentario || 'Sin comentario escrito.'}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {isSuper && (
            <>
              <div className="h-[1.5px] bg-neutral-150 my-8" />

              {/* HISTORIAL CRONOLÓGICO */}
              <div>
                <h4 className="font-semibold text-neutral-800">Canal de Auditoría en Vivo (Activity Logs)</h4>
                <p className="text-xs text-neutral-400">Supervisión en tiempo real de transacciones de bases de datos, inicio de sesión y validación de Check-Ins.</p>
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm max-h-96 overflow-y-auto space-y-3 font-mono text-xs mt-4">
                {allowedLogs.map((log: any) => (
                  <div key={log.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-neutral-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="text-[10px] uppercase font-bold text-teal-700 font-sans">{log.action}</span>
                        <span className="text-[9px] bg-white border border-neutral-200 rounded px-1 text-neutral-500 font-sans">{log.role}</span>
                      </div>
                      <p className="text-xs text-neutral-700 mt-1 font-sans">{log.detalles}</p>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-bold font-sans self-start sm:self-center">Operado por {log.user}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* CONTROL DE RESERVAS GENERAL TAB */}
      {adminTab === 'reservations' && (
        <div className="space-y-6 animate-fade-in text-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-base font-bold text-neutral-850">Control de Reservaciones General</h4>
              <p className="text-[11px] text-neutral-400">
                {isSuper 
                  ? "Visualización total de reservaciones registradas, activas, canceladas u ocultadas de historial por huéspedes." 
                  : "Visualización de las reservas asociadas a su hotel asignado."}
              </p>
            </div>
          </div>

          {/* Interactive room reservation calendar */}
          <div className="animate-fade-in duration-300">
            <RoomReservationCalendar
              hotels={hotels}
              rooms={rooms}
              reservations={reservations}
              users={users}
              activeUser={activeUser}
              onUpdateRoomStatus={onUpdateRoomStatus}
              roomPriceVariations={roomPriceVariations}
            />
          </div>

          {/* RESERVATIONS FILTERS BAR */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Buscar por Huésped o Código:</label>
              <input
                type="text"
                value={searchResQuery}
                onChange={(e) => setSearchResQuery(e.target.value)}
                placeholder="Nombre, email, documento o ID reserva..."
                className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Filtrar por Estado:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg bg-white focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="ocupada">Ocupada</option>
                <option value="finalizada">Finalizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="eliminadas">🗑️ Eliminadas del Historial por Cliente</option>
              </select>
            </div>

            {(isSuper || allowedHotels.length > 1) && (
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1 font-mono">Filtrar por Establecimiento:</label>
                <select
                  value={resHotelFilter}
                  onChange={(e) => setResHotelFilter(e.target.value)}
                  className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg bg-white focus:outline-none cursor-pointer font-semibold text-neutral-700"
                >
                  <option value="todos">{isSuper ? 'Todos los Hoteles' : 'Todos mis Establecimientos'}</option>
                  {allowedHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TABLE OF RESERVATIONS */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-155 text-neutral-500 font-bold uppercase text-[10px]">
                    <th className="p-4">ID Reserva</th>
                    <th className="p-4">Huésped / Datos</th>
                    <th className="p-4">Establecimiento & Suite</th>
                    <th className="p-4">Periodo de Estancia</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Historial de Cliente</th>
                    <th className="p-4 text-right">Controles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginatedReservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-neutral-400">
                        No se encontraron registros de reservación coincidentes con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedReservations.map(res => {
                      const guest = users.find(u => u.id === res.guestId);
                      const hotelInfo = hotels.find(h => h.id === res.hotelId);
                      const roomInfo = rooms.find(r => r.id === res.roomId);

                      return (
                        <tr key={res.id} className="hover:bg-neutral-50/40 transition-colors">
                          <td className="p-4">
                            <button
                              type="button"
                              onClick={() => setPreviewingRes(res)}
                              className="font-mono font-bold text-neutral-800 hover:text-brand-cyan cursor-pointer transition-colors text-left focus:outline-none focus:underline"
                              title="Ver prefactura / recibo de la reserva"
                            >
                              {res.id}
                            </button>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="font-semibold text-neutral-900 block">
                              {guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped Registrado'}
                            </span>
                            <span className="text-[10px] text-neutral-400 block font-mono">Email: {guest?.email || 'N/D'}</span>
                            <span className="text-[10px] text-neutral-400 block font-mono">Doc: {guest?.documento || 'N/D'}</span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="font-semibold text-neutral-800 block">{hotelInfo?.nombre || 'Establecimiento Roomia'}</span>
                            <span className="text-[11px] text-teal-700 font-medium block">Suite N° {roomInfo?.numero || 'S/N'} ({roomInfo?.nombre})</span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="block font-medium text-neutral-700">{res.fechaEntrada} ➜ {res.fechaSalida}</span>
                            <span className="block text-[10px] font-mono font-bold text-neutral-500 flex flex-col">
                              <span>Monto Total: ${res.total?.toFixed(2) || '0.00'} USD</span>
                              {res.montoPagado !== undefined && res.montoPagado > 0 && (
                                <span className="text-emerald-700 text-[9px]">Abonado: ${res.montoPagado.toFixed(2)} USD</span>
                              )}
                              {res.montoPendiente !== undefined && res.montoPendiente > 0 && (
                                <span className="text-red-600 text-[9px]">Pendiente: ${res.montoPendiente.toFixed(2)} USD</span>
                              )}
                              {res.checkedInAt && <span className="text-emerald-700 text-[9px]">Check-In: {res.checkedInAt}</span>}
                              {res.checkedOutAt && <span className="text-neutral-500 text-[9px]">Check-Out: {res.checkedOutAt}</span>}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="space-y-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase inline-block border ${
                                res.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                res.estado === 'pendiente' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                res.estado === 'ocupada' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                res.estado === 'finalizada' ? 'bg-neutral-100 text-neutral-600 border-neutral-200' :
                                'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                {res.estado}
                              </span>
                              {res.modificadoPor && (
                                <span className="block text-[9px] text-amber-700 font-medium truncate max-w-[150px]">
                                  ✎ {res.modificadoPor}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {res.eliminadaPorCliente ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-250 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                🗑️ Ocultada (Filtro Historial Guest)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-600 border border-neutral-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                👁️ Visible para Huésped
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedResToEdit(res);
                                setNewResStatus(res.estado);
                                setStatusChangeMessage(res.mensajeCambio || "");
                                setShowResStatusModal(true);
                              }}
                              className="px-2.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-[10.5px] font-bold transition-all cursor-pointer inline-block"
                            >
                              Cambiar Estado
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GESTIÓN DE REEMBOLSOS Y POLÍTICAS DE CANCELACIÓN TAB */}
      {adminTab === 'refunds' && (
        <div className="space-y-6 animate-fade-in text-xs font-sans">
          
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-base font-bold text-neutral-850">Gestión de Reembolsos y Cancelaciones</h4>
              <p className="text-[11px] text-neutral-400">
                Administre cancelaciones, compute los días de anticipación y determine la tasa de reembolso aplicable de acuerdo a las políticas del hotel.
              </p>
            </div>
          </div>

          {/* POLICIES CARDS */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Percent className="w-4 h-4 text-teal-600" />
              <h5 className="font-bold text-neutral-800 text-xs">Políticas de Cancelación Establecidas</h5>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[11px]">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                <span className="font-bold text-emerald-700 block">🟢 &gt;= 15 días de anticipación:</span>
                <span className="text-neutral-500 text-[10.5px]">Reembolso del <strong className="text-neutral-800 font-bold">100%</strong> de lo abonado. Cancelación temprana sin costo administrativo.</span>
              </div>
              
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                <span className="font-bold text-blue-700 block">🔵 7 a 14 días de anticipación:</span>
                <span className="text-neutral-500 text-[10.5px]">Reembolso del <strong className="text-neutral-800 font-bold">50%</strong> de lo abonado. Retención por bloqueo de habitación.</span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                <span className="font-bold text-amber-700 block">🟡 3 a 6 días de anticipación:</span>
                <span className="text-neutral-500 text-[10.5px]">Reembolso del <strong className="text-neutral-800 font-bold">20%</strong> de lo abonado. Penalidad moderada por cancelación corta.</span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                <span className="font-bold text-red-700 block">🔴 Menos de 3 días / No-Show:</span>
                <span className="text-neutral-500 text-[10.5px]">Reembolso del <strong className="text-neutral-800 font-bold">0%</strong>. No aplica devolución de dinero por cancelación tardía.</span>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex flex-col gap-2 text-amber-800 text-[11px] leading-relaxed">
              <div className="flex gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Regla de Pago Completo:</strong> El reembolso aplica únicamente cuando la reserva ha sido pagada en su totalidad (<strong className="font-bold">100% abonado</strong>) y posteriormente se cancela. Si la reserva solo se garantizó con un pago parcial (seña del <strong className="font-bold">20%</strong>), no se aplica devolución ni reembolso del dinero abonado.
                </div>
              </div>
              <div className="flex gap-2.5 border-t border-amber-200/50 pt-2 mt-1">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Regla Importante de Pago Pendiente:</strong> Si la reservación se encuentra en estado <strong className="font-bold uppercase">Pendiente de Pago</strong>, pasa únicamente a <strong className="font-bold uppercase">Cancelada</strong> y no aplica a ningún reembolso, ya que no se ha registrado abono ni pago al administrador.
                </div>
              </div>
            </div>
          </div>

          {/* FILTER BAR & LIST */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <h5 className="font-bold text-neutral-850 text-xs">Reservaciones Registradas para Gestión</h5>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Search input */}
                <input
                  type="text"
                  value={refundSearch}
                  onChange={(e) => setRefundSearch(e.target.value)}
                  placeholder="Buscar por huésped, ID de reserva..."
                  className="text-xs border border-neutral-250 px-3 py-2 rounded-xl focus:outline-none w-52"
                />

                {/* Hotel Filter */}
                {isSuper && (
                  <select
                    value={refundHotelFilter}
                    onChange={(e) => setRefundHotelFilter(e.target.value)}
                    className="text-xs border border-neutral-250 px-3 py-2 rounded-xl bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="todos">Todos los Hoteles</option>
                    {allowedHotels.map(h => (
                      <option key={h.id} value={h.id}>{h.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border border-neutral-150 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-[10.5px] font-bold text-neutral-500 uppercase border-b border-neutral-150">
                    <th className="p-3">Código / Huésped</th>
                    <th className="p-3">Establecimiento</th>
                    <th className="p-3">Fecha Reserva</th>
                    <th className="p-3">Estado Actual</th>
                    <th className="p-3">Monto Total</th>
                    <th className="p-3 text-center">Días de Anticipación</th>
                    <th className="p-3">Diagnóstico Reembolso</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {(() => {
                    const getDaysDiff = (checkInStr: string, requestStr: string) => {
                      if (!checkInStr || !requestStr) return 0;
                      const checkIn = new Date(checkInStr + 'T00:00:00');
                      const request = new Date(requestStr + 'T00:00:00');
                      const diffTime = checkIn.getTime() - request.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return diffDays;
                    };

                    const getRefundCategory = (res: Reservation, requestDate: string) => {
                      if (res.estado === 'pendiente') {
                        return {
                          percent: 0,
                          label: 'Sin pago - Solo Cancelación',
                          color: 'bg-amber-50 text-amber-800 border-amber-200',
                          applyRefund: false,
                          desc: 'No se registró ningún pago. Pasa directo a Cancelada sin reembolso.'
                        };
                      }

                      const montoAbonado = res.montoPagado !== undefined ? res.montoPagado : res.total;
                      const pagadoTotal = res.montoPendiente !== undefined ? (res.montoPendiente === 0) : (montoAbonado >= res.total);

                      if (!pagadoTotal) {
                        return {
                          percent: 0,
                          label: 'Sin Reembolso (Pago Parcial 20%)',
                          color: 'bg-red-50 text-red-800 border-red-200',
                          applyRefund: false,
                          desc: 'El reembolso solo aplica cuando una reserva se pagó el valor total.'
                        };
                      }
                      
                      const days = getDaysDiff(res.fechaEntrada, requestDate);
                      
                      if (days >= 15) {
                        return {
                          percent: 100,
                          label: 'Reembolso Completo (100%)',
                          color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                          applyRefund: true,
                          desc: '🟢 Reembolso del 100% de lo abonado. Cancelación temprana sin costo administrativo.'
                        };
                      } else if (days >= 7) {
                        return {
                          percent: 50,
                          label: 'Reembolso Parcial (50%)',
                          color: 'bg-blue-50 text-blue-800 border-blue-200',
                          applyRefund: true,
                          desc: '🔵 Reembolso del 50% de lo abonado. Retención por bloqueo de habitación.'
                        };
                      } else if (days >= 3) {
                        return {
                          percent: 20,
                          label: 'Reembolso Mínimo (20%)',
                          color: 'bg-amber-50 text-amber-800 border-amber-200',
                          applyRefund: true,
                          desc: '🟡 Reembolso del 20% de lo abonado. Penalidad moderada por cancelación corta.'
                        };
                      } else {
                        return {
                          percent: 0,
                          label: 'Penalización Completa (0%)',
                          color: 'bg-red-50 text-red-800 border-red-200',
                          applyRefund: true,
                          desc: '🔴 Reembolso del 0%. No aplica devolución de dinero por cancelación tardía.'
                        };
                      }
                    };

                    const filtered = allowedReservations.filter(res => {
                      // 1. Only show canceled reservations
                      if (res.estado !== 'cancelada') return false;

                      // 2. Must qualify for a refund (anticipation >= 3 days)
                      const days = getDaysDiff(res.fechaEntrada, simulatedRequestDate);
                      if (days < 3) return false;

                      // 3. Must have positive refund category
                      const diag = getRefundCategory(res, simulatedRequestDate);
                      if (!diag.applyRefund || diag.percent === 0) return false;

                      // Apply search filter
                      const guest = users.find(u => u.id === res.guestId);
                      const guestName = guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped';
                      const guestEmail = guest?.email || '';
                      const matchesSearch = res.id.toLowerCase().includes(refundSearch.toLowerCase()) ||
                        guestName.toLowerCase().includes(refundSearch.toLowerCase()) ||
                        guestEmail.toLowerCase().includes(refundSearch.toLowerCase());
                      
                      // Apply hotel filter
                      const matchesHotel = refundHotelFilter === 'todos' ? true : res.hotelId === refundHotelFilter;

                      return matchesSearch && matchesHotel;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-neutral-400 text-xs italic">
                            No se encontraron reservaciones canceladas con reembolsos pendientes por procesar.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map(res => {
                      const guest = users.find(u => u.id === res.guestId);
                      const guestName = guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped Particular';
                      const hotel = hotels.find(h => h.id === res.hotelId);
                      const roomObj = rooms.find(r => r.id === res.roomId);
                      
                      const daysAnticipacion = getDaysDiff(res.fechaEntrada, simulatedRequestDate);
                      const diag = getRefundCategory(res, simulatedRequestDate);
                      const montoAbonado = res.montoPagado !== undefined ? res.montoPagado : res.total;
                      const refundAmount = ((diag.percent * montoAbonado) / 100).toFixed(2);

                      return (
                        <tr key={res.id} className="hover:bg-neutral-50/50 transition-colors text-neutral-800">
                          <td className="p-3">
                            <span className="font-mono font-bold text-neutral-800 block text-[11px]">{res.id}</span>
                            <span className="text-neutral-400 text-[10px]">{guestName}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-neutral-700 block">{hotel?.nombre || 'Desconocido'}</span>
                            <span className="text-neutral-450 text-[10px]">Hab N° {roomObj?.numero || 'S/N'}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-semibold block">{res.fechaEntrada}</span>
                            <span className="text-[10px] text-neutral-400">al {res.fechaSalida}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 text-[9px] bg-red-50 text-red-700 border border-red-200 rounded font-bold uppercase">Cancelada</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-neutral-850 block">${res.total} USD</span>
                            {res.montoPagado !== undefined && (
                              <span className="text-[10px] text-emerald-700 block font-medium">Abonado: ${res.montoPagado} USD</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-mono font-bold text-xs ${daysAnticipacion < 3 ? 'text-red-600' : daysAnticipacion < 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {daysAnticipacion} {daysAnticipacion === 1 ? 'día' : 'días'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${diag.color} inline-block`}>
                                {diag.label}
                              </span>
                              <span className="text-[9.5px] text-neutral-500 block leading-tight">{diag.desc}</span>
                              <span className="text-[10.5px] text-teal-600 font-extrabold block">Reembolso calculado: ${refundAmount} USD ({diag.percent}%)</span>
                            </div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {(res.mensajeCambio || '').includes('REEMBOLSO_PAGADO') ? (
                              <span className="px-2.5 py-1 text-[9.5px] bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold">✓ DEVUELTO AL HUÉSPED</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Confirmar que se ha efectuado y enviado el reembolso de $${refundAmount} USD al huésped ${guestName}?`)) {
                                    if (onUpdateReservationStatus) {
                                      onUpdateReservationStatus(
                                        res.id,
                                        'cancelada',
                                        activeUser.nombre,
                                        activeUser.rol,
                                        `${res.mensajeCambio || ''} | REEMBOLSO_PAGADO`
                                      );
                                      alert("✅ Reembolso registrado con éxito en el historial de la reserva.");
                                    }
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-[#0E2A47] hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                              >
                                Pagar Reembolso
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ GESTIÓN DE INCIDENCIAS MÓDULO ADICIONAL DEL PANEL */}
      {adminTab === 'incidents' && (
        <div className="space-y-6 animate-fade-in font-sans">
          
          {/* Header of incidents tab */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
            <div>
              <h4 className="font-semibold text-neutral-800 text-lg font-display flex items-center gap-2">
                <Wrench className="w-5 h-5 text-teal-600 animate-pulse" />
                <span>Gestión de Incidencias Operativas</span>
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5">Reporte, seguimiento de mantenimiento y bitácora de novedades técnicas por habitación.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 font-medium whitespace-nowrap">Filtrar Establecimiento:</span>
              <select
                value={incidentHotelFilter}
                onChange={(e) => {
                  setIncidentHotelFilter(e.target.value);
                  setIncidentRoomId('');
                }}
                className="bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-xs font-semibold py-1.5 px-3 focus:outline-none cursor-pointer text-[#0E2A47] shadow-sm transition-colors"
              >
                <option value="todos" className="text-neutral-800 font-semibold">Todos los Establecimientos</option>
                {allowedHotels.map(h => (
                  <option key={h.id} value={h.id} className="text-neutral-800 font-semibold">
                    {h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento' ? '🏡' : '🏨'} {h.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Columna Izquierda: Reportar Nueva Incidencia (2/5 size) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
                <h5 className="font-bold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-ping"></span>
                  Reportar Nueva Novedad / Avería
                </h5>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Registre un daño técnico o avería operativa. Esto transicionará automáticamente el aposento a estado de <strong className="text-neutral-800 font-bold">Mantenimiento</strong> en los tableros del staff.
                </p>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Seleccionar Habitación Afectada:</label>
                    <select
                      value={incidentRoomId}
                      onChange={(e) => setIncidentRoomId(e.target.value)}
                      className="w-full text-xs border border-neutral-250 p-3 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer text-neutral-800 font-medium shadow-sm"
                    >
                      <option value="">-- Seleccione una Habitación --</option>
                      {allowedRooms
                        .filter(r => incidentHotelFilter === 'todos' || r.hotelId === incidentHotelFilter)
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            Habitación N° {r.numero} - {r.nombre} ({r.estado.toUpperCase()})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Descripción Detallada del Incidente:</label>
                    <textarea
                      rows={5}
                      value={incidentDesc}
                      onChange={(e) => setIncidentDesc(e.target.value)}
                      placeholder="Especifique el daño técnico. Ej: Fuga de agua en el baño principal, aire acondicionado inoperativo, cerradura electrónica descargada..."
                      className="w-full text-xs border border-neutral-250 p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder-neutral-400 bg-white text-neutral-800 font-sans shadow-sm"
                    ></textarea>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!incidentRoomId) {
                        alert("⚠️ Alerta: Por favor seleccione la habitación afectada.");
                        return;
                      }
                      if (!incidentDesc.trim()) {
                        alert("⚠️ Alerta: Por favor especifique los detalles o motivo de la incidencia.");
                        return;
                      }
                      const target = rooms.find(r => r.id === incidentRoomId);
                      if (!target) return;

                      if (onUpdateRoomStatus) {
                        onUpdateRoomStatus(incidentRoomId, 'mantenimiento', activeUser.nombre, activeUser.rol, incidentDesc);
                        alert(`✅ Incidencia reportada exitosamente. La habitación N° ${target.numero} ha sido colocada en Mantenimiento.`);
                        setIncidentDesc('');
                        setIncidentRoomId('');
                      }
                    }}
                    className="w-full py-3 bg-[#0E2A47] hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-all duration-200 cursor-pointer shadow active:scale-95 text-center uppercase tracking-wider"
                  >
                    Registrar en Bitácora de Mantenimiento
                  </button>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Historial/Bitácora de Incidencias (3/5 size) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                  <h5 className="font-bold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[#0E2A47]" />
                    <span>Bitácora Histórica de Incidencias</span>
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400 font-bold bg-neutral-100 px-2 py-0.5 rounded-md">
                    Total en Historial: {allowedLogs.filter(log => {
                      const detailsLower = (log.detalles || '').toLowerCase();
                      const actionLower = (log.action || '').toLowerCase();
                      const isIncident = actionLower.includes('incidencia') || detailsLower.includes('incidencia') || (detailsLower.includes('mantenimiento') && detailsLower.includes('habitación'));
                      if (!isIncident) return false;
                      
                      if (incidentHotelFilter !== 'todos') {
                        const roomMatch = rooms.find(r => 
                          log.detalles.includes(`N° ${r.numero}`) || 
                          log.detalles.includes(`N°${r.numero}`) || 
                          log.detalles.toLowerCase().includes(`habitación ${r.numero}`)
                        );
                        const selectedHotel = hotels.find(h => h.id === incidentHotelFilter);
                        const selectedHotelNameLower = selectedHotel ? selectedHotel.nombre.toLowerCase() : '';
                        const matchesHotel = (roomMatch && roomMatch.hotelId === incidentHotelFilter) ||
                                             (selectedHotelNameLower && detailsLower.includes(selectedHotelNameLower)) ||
                                             detailsLower.includes(incidentHotelFilter.toLowerCase());
                        if (!matchesHotel) return false;
                      }
                      return true;
                    }).length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[550px] pr-1">
                  {(() => {
                    const incidentsList = allowedLogs.filter(log => {
                      const detailsLower = (log.detalles || '').toLowerCase();
                      const actionLower = (log.action || '').toLowerCase();
                      const isIncident = (
                        actionLower.includes('incidencia') || 
                        detailsLower.includes('incidencia') || 
                        (detailsLower.includes('mantenimiento') && detailsLower.includes('habitación'))
                      );
                      if (!isIncident) return false;
                      
                      if (incidentHotelFilter !== 'todos') {
                        const roomMatch = rooms.find(r => 
                          log.detalles.includes(`N° ${r.numero}`) || 
                          log.detalles.includes(`N°${r.numero}`) || 
                          log.detalles.toLowerCase().includes(`habitación ${r.numero}`)
                        );
                        const selectedHotel = hotels.find(h => h.id === incidentHotelFilter);
                        const selectedHotelNameLower = selectedHotel ? selectedHotel.nombre.toLowerCase() : '';
                        const matchesHotel = (roomMatch && roomMatch.hotelId === incidentHotelFilter) ||
                                             (selectedHotelNameLower && detailsLower.includes(selectedHotelNameLower)) ||
                                             detailsLower.includes(incidentHotelFilter.toLowerCase());
                        if (!matchesHotel) return false;
                      }
                      return true;
                    });

                    if (incidentsList.length === 0) {
                      return (
                        <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                          <Wrench className="w-8 h-8 text-neutral-300 mx-auto mb-2.5" />
                          <p className="text-neutral-400 text-xs italic font-sans">No hay registros de incidencias para las habitaciones de este establecimiento.</p>
                        </div>
                      );
                    }

                    return incidentsList.map((log, idx) => {
                      const roomMatch = rooms.find(r => 
                        log.detalles.includes(`N° ${r.numero}`) || 
                        log.detalles.includes(`N°${r.numero}`) || 
                        log.detalles.toLowerCase().includes(`habitación ${r.numero}`)
                      );

                      const formattedDate = log.timestamp 
                        ? new Date(log.timestamp).toLocaleString('es-ES', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) 
                        : 'Fecha desconocida';

                      return (
                        <div key={log.id || idx} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-150 hover:bg-neutral-100/30 transition-all space-y-2.5">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {roomMatch ? (
                                  <span className="bg-[#0E2A47] text-white text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-md">
                                    Hab N° {roomMatch.numero} ({roomMatch.estado.toUpperCase()})
                                  </span>
                                ) : (
                                  <span className="bg-neutral-800 text-white text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-md">
                                    Habitación Operativa
                                  </span>
                                )}
                                <span className="text-[10px] text-neutral-400 font-mono">{formattedDate}</span>
                              </div>
                              <div className="text-[10px] text-neutral-450 font-sans">
                                Registrado por: <strong className="text-neutral-600 font-bold">{log.usuario}</strong> ({log.userRol ? log.userRol.replace('_', ' ').toUpperCase() : 'STAFF'})
                              </div>
                            </div>
                            
                            {roomMatch && (
                              <div className="text-right">
                                {roomMatch.estado === 'mantenimiento' ? (
                                  <div className="flex flex-col items-end gap-1.5">
                                    <span className="bg-red-50 text-red-700 border border-red-150 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                      🔴 Mantenimiento Activo
                                    </span>
                                    {onUpdateRoomStatus && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`¿Desea resolver la incidencia de la Habitación N° ${roomMatch.numero} y habilitarla de nuevo para reservas?`)) {
                                            onUpdateRoomStatus(roomMatch.id, 'disponible', activeUser.nombre, activeUser.rol, "Incidencia solucionada por administración y devuelta a servicio.");
                                            alert(`✅ Habitación N° ${roomMatch.numero} puesta como Disponible.`);
                                          }
                                        }}
                                        className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded-lg cursor-pointer transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                      >
                                        Marcar Solucionada
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    🟢 Solucionada / Disponible
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-neutral-700 font-medium leading-relaxed font-sans bg-white p-2.5 rounded-xl border border-neutral-100">
                            {log.detalles}
                          </p>

                          <div className="flex justify-between items-center text-[10px] text-neutral-450 border-t border-neutral-200/60 pt-2 font-sans">
                            <span>Acción Operativa: <strong className="text-neutral-600 font-bold">{log.action}</strong></span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}



      {/* PREVIEW ACTIVE PRE-FACTURA PDF MODAL */}
      {previewingRes && (
        <InvoicePDF
          reservation={previewingRes}
          hotel={hotels.find(h => h.id === previewingRes.hotelId)}
          room={rooms.find(r => r.id === previewingRes.roomId)}
          guest={users.find(u => u.id === previewingRes.guestId)}
          onClose={() => setPreviewingRes(null)}
        />
      )}



      {/* CRUD MODAL: ADD / EDIT HOTEL */}
      {showHotelModal && editingHotel && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-100 flex flex-col">
            
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-2xl">
              <h4 className="font-semibold text-neutral-850">Administrar Establecimiento / Propiedad</h4>
              <button onClick={() => setShowHotelModal(false)} className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleHotelSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Tipo de Establecimiento:</label>
                  <select
                    value="hotel"
                    disabled
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none bg-neutral-100 font-semibold cursor-not-allowed text-teal-700"
                  >
                    <option value="hotel">🏨 Hotel / Hostal (Múltiples habitaciones independientes)</option>
                  </select>
                </div>

                {/* INMUEBLE & PROPIETARIO FIELDS (if Casa/Departamento) */}
                {(editingHotel.tipoEstablecimiento === 'casa' || editingHotel.tipoEstablecimiento === 'departamento') && (
                  <div className="col-span-2 space-y-3 bg-teal-50/50 p-4 border border-teal-100/80 rounded-xl flex flex-col">
                    <h5 className="text-[11px] font-bold text-teal-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-teal-100 pb-1.5">
                      <span>🏡 Especificaciones del Inmueble</span>
                    </h5>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Habitaciones:</label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={editingHotel.detallesInmueble?.habitaciones || 1}
                          onChange={(e) => setEditingHotel({
                            ...editingHotel,
                            detallesInmueble: {
                              ...(editingHotel.detallesInmueble || { habitaciones: 1, banos: 1, metrosCuadrados: 40, amueblado: true, tieneEstacionamiento: false }),
                              habitaciones: parseInt(e.target.value) || 1
                            }
                          })}
                          className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Baños:</label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={editingHotel.detallesInmueble?.banos || 1}
                          onChange={(e) => setEditingHotel({
                            ...editingHotel,
                            detallesInmueble: {
                              ...(editingHotel.detallesInmueble || { habitaciones: 1, banos: 1, metrosCuadrados: 40, amueblado: true, tieneEstacionamiento: false }),
                              banos: parseInt(e.target.value) || 1
                            }
                          })}
                          className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Área (m²):</label>
                        <input
                          type="number"
                          min={1}
                          placeholder="Ej: 65"
                          value={editingHotel.detallesInmueble?.metrosCuadrados || ''}
                          onChange={(e) => setEditingHotel({
                            ...editingHotel,
                            detallesInmueble: {
                              ...(editingHotel.detallesInmueble || { habitaciones: 1, banos: 1, metrosCuadrados: 40, amueblado: true, tieneEstacionamiento: false }),
                              metrosCuadrados: parseInt(e.target.value) || undefined
                            }
                          })}
                          className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="flex flex-col justify-center space-y-1 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-medium text-neutral-600">
                          <input
                            type="checkbox"
                            checked={editingHotel.detallesInmueble?.amueblado !== false}
                            onChange={(e) => setEditingHotel({
                              ...editingHotel,
                              detallesInmueble: {
                                ...(editingHotel.detallesInmueble || { habitaciones: 1, banos: 1, metrosCuadrados: 40, amueblado: true, tieneEstacionamiento: false }),
                                amueblado: e.target.checked
                              }
                            })}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          <span>¿Está Amoblado?</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-medium text-neutral-600">
                          <input
                            type="checkbox"
                            checked={!!editingHotel.detallesInmueble?.tieneEstacionamiento}
                            onChange={(e) => setEditingHotel({
                              ...editingHotel,
                              detallesInmueble: {
                                ...(editingHotel.detallesInmueble || { habitaciones: 1, banos: 1, metrosCuadrados: 40, amueblado: true, tieneEstacionamiento: false }),
                                tieneEstacionamiento: e.target.checked
                              }
                            })}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          <span>¿Tiene Estacionamiento?</span>
                        </label>
                      </div>
                    </div>

                    <h5 className="text-[11px] font-bold text-teal-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-teal-100 pb-1.5 pt-2 mt-1">
                      <span>👤 Datos de Contacto de Propietario</span>
                    </h5>
                    
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Nombre Completo del Propietario:</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Lic. Carlos Mendoza"
                          value={editingHotel.propietario?.nombre || ''}
                          onChange={(e) => setEditingHotel({
                            ...editingHotel,
                            propietario: {
                              ...(editingHotel.propietario || { nombre: '', telefono: '', email: '', documento: '' }),
                              nombre: e.target.value
                            }
                          })}
                          className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Teléfono Propietario:</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: +34 600 112 233"
                            value={editingHotel.propietario?.telefono || ''}
                            onChange={(e) => setEditingHotel({
                              ...editingHotel,
                              propietario: {
                                ...(editingHotel.propietario || { nombre: '', telefono: '', email: '', documento: '' }),
                                telefono: e.target.value
                              }
                            })}
                            className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Correo Electrónico:</label>
                          <input
                            type="email"
                            required
                            placeholder="propietario@host.com"
                            value={editingHotel.propietario?.email || ''}
                            onChange={(e) => setEditingHotel({
                              ...editingHotel,
                              propietario: {
                                ...(editingHotel.propietario || { nombre: '', telefono: '', email: '', documento: '' }),
                                email: e.target.value
                              }
                            })}
                            className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>
                       <div>
                        <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Documento de Identidad (Cédula de Identidad, DNI o Pasaporte):</label>
                        <input
                          type="text"
                          placeholder="Ej: CI-093849120"
                          value={editingHotel.propietario?.documento || ''}
                          onChange={(e) => setEditingHotel({
                            ...editingHotel,
                            propietario: {
                              ...(editingHotel.propietario || { nombre: '', telefono: '', email: '', documento: '' }),
                              documento: e.target.value
                            }
                          })}
                          className="w-full text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Nombre Comercial de la Propiedad:</label>
                  <input
                    type="text" required
                    value={editingHotel.nombre}
                    onChange={(e) => setEditingHotel({ ...editingHotel, nombre: e.target.value })}
                    placeholder="Ej: Roomia Sunset Coast Resort / Casa de Campo"
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Descripción Pública:</label>
                  <textarea
                    required
                    value={editingHotel.descripcion}
                    onChange={(e) => setEditingHotel({ ...editingHotel, descripcion: e.target.value })}
                    placeholder="Descripción moderna tipo landing page de Booking..."
                    className="w-full h-18 text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 block">Ubicación Geográfica en Ecuador:</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                    <div>
                      <label className="text-[10px] font-bold text-teal-850 block mb-1">Provincia:</label>
                      <select
                        value={editingHotel.provincia || ''}
                        onChange={(e) => {
                          const newProv = e.target.value;
                          const defaultCity = getCitiesForProvince(newProv)[0] || '';
                          const defaultParroquia = getParroquiasForCity(newProv, defaultCity)[0] || '';
                          setEditingHotel({
                            ...editingHotel,
                            provincia: newProv,
                            ciudad: defaultCity,
                            parroquia: defaultParroquia,
                            ubicacion: editingHotel.ubicacion || (newProv ? `${defaultParroquia ? defaultParroquia + ', ' : ''}${defaultCity}, ${newProv}, Ecuador` : '')
                          });
                        }}
                        className="w-full text-xs border border-teal-200 bg-white p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium text-neutral-800"
                      >
                        <option value="">-- Seleccionar Provincia --</option>
                        {getProvincesList().map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-teal-850 block mb-1">Ciudad / Cantón:</label>
                      <select
                        value={editingHotel.ciudad || ''}
                        onChange={(e) => {
                          const newCity = e.target.value;
                          const defaultParroquia = getParroquiasForCity(editingHotel.provincia || '', newCity)[0] || '';
                          setEditingHotel({
                            ...editingHotel,
                            ciudad: newCity,
                            parroquia: defaultParroquia,
                            ubicacion: editingHotel.ubicacion || (editingHotel.provincia ? `${defaultParroquia ? defaultParroquia + ', ' : ''}${newCity}, ${editingHotel.provincia}, Ecuador` : '')
                          });
                        }}
                        disabled={!editingHotel.provincia}
                        className="w-full text-xs border border-teal-200 bg-white p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium text-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        <option value="">-- Seleccionar Ciudad --</option>
                        {getCitiesForProvince(editingHotel.provincia || '').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-teal-850 block mb-1">Parroquia:</label>
                      <select
                        value={editingHotel.parroquia || ''}
                        onChange={(e) => {
                          const newParroquia = e.target.value;
                          setEditingHotel({
                            ...editingHotel,
                            parroquia: newParroquia
                          });
                        }}
                        disabled={!editingHotel.ciudad}
                        className="w-full text-xs border border-teal-200 bg-white p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium text-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        <option value="">-- Seleccionar Parroquia --</option>
                        {getParroquiasForCity(editingHotel.provincia || '', editingHotel.ciudad || '').map(par => (
                          <option key={par} value={par}>{par}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 block">Ubicación Física (Dirección Exacta):</label>
                  <input
                    type="text" required
                    value={editingHotel.ubicacion}
                    onChange={(e) => setEditingHotel({ ...editingHotel, ubicacion: e.target.value })}
                    placeholder="Ej: Av. Amazonas N24-01 y Cordero, Quito, Ecuador"
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 block">Google Maps URL o Código de Inserción (iframe):</label>
                  <input
                    type="text"
                    value={editingHotel.googleMapsUrl || ''}
                    onChange={(e) => setEditingHotel({ ...editingHotel, googleMapsUrl: e.target.value })}
                    placeholder="Ej: https://maps.app.goo.gl/... o pega un código <iframe..."
                    className="w-full text-xs font-mono border border-neutral-250 p-2 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[9.5px] text-neutral-400 leading-normal">
                    Puedes pegar el enlace para compartir de la ubicación o el código HTML de inserción de Google Maps.
                  </p>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden mt-1.5 bg-neutral-50 h-44 relative shadow-sm">
                    {(() => {
                      const embedSrc = getMapEmbedUrl(editingHotel.ubicacion, editingHotel.googleMapsUrl);
                      if (!embedSrc) {
                        return (
                          <div className="flex flex-col items-center justify-center p-4 h-full text-center">
                            <MapPin className="w-7 h-7 text-neutral-300 mb-1" />
                            <p className="text-[10px] text-neutral-400 font-medium font-sans">Escribe una dirección o enlace de Google Maps para previsualizar el mapa</p>
                          </div>
                        );
                      }

                      return (
                        <iframe
                          title="Vista de Mapa"
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
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Teléfono:</label>
                  <input
                    type="text" required
                    value={editingHotel.contacto.telefono}
                    onChange={(e) => setEditingHotel({
                      ...editingHotel,
                      contacto: { ...editingHotel.contacto, telefono: e.target.value }
                    })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Correo Electrónico:</label>
                  <input
                    type="email" required
                    value={editingHotel.contacto.email}
                    onChange={(e) => setEditingHotel({
                      ...editingHotel,
                      contacto: { ...editingHotel.contacto, email: e.target.value }
                    })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Check-In hora:</label>
                  <input
                    type="text" defaultValue={editingHotel.horarios.checkIn}
                    onChange={(e) => setEditingHotel({
                      ...editingHotel,
                      horarios: { ...editingHotel.horarios, checkIn: e.target.value }
                    })}
                    className="w-full text-xs border border-neutral-255 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Check-Out hora:</label>
                  <input
                    type="text" defaultValue={editingHotel.horarios.checkOut}
                    onChange={(e) => setEditingHotel({
                      ...editingHotel,
                      horarios: { ...editingHotel.horarios, checkOut: e.target.value }
                    })}
                    className="w-full text-xs border border-neutral-255 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Estado de Operación:</label>
                  <select
                    value={editingHotel.estado}
                    onChange={(e) => setEditingHotel({ ...editingHotel, estado: e.target.value as 'activo' | 'inactivo' })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="activo">🟢 Activo / Disponible para Reserva</option>
                    <option value="inactivo">🛑 Inactivo (Ocultar temporalmente)</option>
                  </select>
                </div>

                {/* 15 COMPREHENSIVE HOTEL IMAGES SELECTOR SECTION */}
                <div className="col-span-2 space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 font-sans">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Imágenes y Videos del Hotel ({(editingHotel.imagenes || []).length}/15)</span>
                    <span className="text-[10px] text-neutral-400 font-medium">Hasta 15 fotos o videos (mediante enlace o archivo local)</span>
                  </div>
                  
                  {/* Grid of 15 slot containers */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                    {Array.from({ length: 15 }).map((_, idx) => {
                      const imgUrl = (editingHotel.imagenes || [])[idx];
                      const isVid = imgUrl ? (
                        imgUrl.toLowerCase().endsWith('.mp4') ||
                        imgUrl.toLowerCase().endsWith('.webm') ||
                        imgUrl.toLowerCase().endsWith('.mov') ||
                        imgUrl.includes('youtube.com') ||
                        imgUrl.includes('youtu.be') ||
                        imgUrl.includes('vimeo.com') ||
                        imgUrl.startsWith('data:video/')
                      ) : false;

                      return (
                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-neutral-250 bg-neutral-200 flex items-center justify-center group overflow-hidden shadow-sm">
                          {imgUrl ? (
                            <>
                              {isVid ? (
                                <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center text-white relative">
                                  <span className="text-lg">🎥</span>
                                  <span className="text-[7px] uppercase font-bold tracking-tight text-white/80">Video {idx + 1}</span>
                                </div>
                              ) : (
                                <img src={imgUrl} alt={`Hotel Foto ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              )}
                              <div className="absolute top-1 left-1 bg-neutral-900/85 text-white font-mono text-[8px] px-1 rounded">
                                {idx + 1}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextImgs = [...(editingHotel.imagenes || [])];
                                  nextImgs.splice(idx, 1);
                                  setEditingHotel({ ...editingHotel, imagenes: nextImgs });
                                }}
                                className="absolute inset-0 bg-red-650/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] font-bold"
                              >
                                Quitar
                              </button>
                            </>
                          ) : (
                            <div className="text-neutral-455 text-[8px] font-medium p-1 text-center leading-tight">
                              Vacío<br/>
                              <span className="text-neutral-400 text-[9px] font-mono font-bold">#{idx + 1}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Input link field if we have fewer than 15 images */}
                  {(!editingHotel.imagenes || editingHotel.imagenes.length < 15) && (
                    <div className="space-y-2 pt-1 font-sans">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="new-hotel-image-input"
                          placeholder="Pega enlace de foto o video del hotel (YouTube, Vimeo, mp4)..."
                          className="flex-1 text-[11px] border border-neutral-255 p-2 rounded-lg bg-white focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.currentTarget;
                              const val = input.value.trim();
                              if (val) {
                                const currentImgs = editingHotel.imagenes || [];
                                setEditingHotel({ ...editingHotel, imagenes: [...currentImgs, val].slice(0, 15) });
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new-hotel-image-input') as HTMLInputElement;
                            const val = input?.value?.trim();
                            if (val) {
                              const currentImgs = editingHotel.imagenes || [];
                              setEditingHotel({ ...editingHotel, imagenes: [...currentImgs, val].slice(0, 15) });
                              if (input) input.value = '';
                            }
                          }}
                          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-sm animate-fade-in"
                        >
                          Agregar Link
                        </button>
                      </div>

                      {/* Direct file upload from internal storage */}
                      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-dashed border-neutral-300">
                        <span className="text-[10px] font-bold text-neutral-500">¿Subir foto o video local? (Máx 15MB)</span>
                        <label className="flex items-center gap-1 py-1 px-2.5 bg-neutral-900 text-white hover:bg-teal-600 rounded-md text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                          <Upload className="w-3 h-3" />
                          <span>Elegir Archivo</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'hotel')}
                          />
                        </label>
                      </div>

                      {/* Suggestions list of pre-curated gorgeous unsplash hotel facades/pools */}
                      <div className="space-y-1.5 animate-fade-in">
                        <p className="text-[10px] text-neutral-400 font-bold block">Sugerencias estéticas de fachadas e instalaciones:</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: 'Fachada Moderna', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800' },
                            { label: 'Alberca Elegante', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800' },
                            { label: 'Lobby de Lujo', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800' },
                            { label: 'Spa de Ensueño', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800' },
                            { label: 'Video de Piscina', url: 'https://assets.mixkit.co/videos/preview/mixkit-swimming-pool-in-a-resort-40439-large.mp4' }
                          ].map((suggest, sIdx) => {
                            const alreadyHas = (editingHotel.imagenes || []).includes(suggest.url);
                            return (
                              <button
                                key={sIdx}
                                type="button"
                                disabled={alreadyHas}
                                onClick={() => {
                                  const currentImgs = editingHotel.imagenes || [];
                                  setEditingHotel({ ...editingHotel, imagenes: [...currentImgs, suggest.url].slice(0, 15) });
                                }}
                                className={`px-2 py-1 rounded text-[9px] font-semibold border transition-all cursor-pointer ${
                                  alreadyHas
                                    ? 'bg-neutral-100 text-neutral-350 border-neutral-200 cursor-not-allowed'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'
                                }`}
                              >
                                + {suggest.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Photo Brand Logo selector option to select one of the 15 images */}
                      {editingHotel.imagenes && editingHotel.imagenes.length > 0 && (
                        <div className="pt-2 border-t border-neutral-200/80 font-sans">
                          <label className="text-[10px] font-bold text-neutral-505 uppercase tracking-wide block mb-1">
                            Foto Logo de Marca & Portada (Selecciona una de las fotos):
                          </label>
                          <div className="flex gap-2 overflow-x-auto py-1">
                            {editingHotel.imagenes.map((img, idx) => {
                              const isLogo = editingHotel.logo === img;
                              const isThisVid = img.toLowerCase().endsWith('.mp4') || img.toLowerCase().endsWith('.webm') || img.includes('youtube.com') || img.includes('youtu.be') || img.includes('vimeo.com');
                              if (isThisVid) return null; // Can't be a logo/cover static brand image

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setEditingHotel({ ...editingHotel, logo: img, portada: img })}
                                  className={`relative shrink-0 w-16 aspect-video rounded-lg border-2 overflow-hidden transition-all duration-200 cursor-pointer ${
                                    isLogo 
                                      ? 'border-teal-600 ring-2 ring-teal-600/10' 
                                      : 'border-neutral-300 opacity-65 hover:opacity-100 hover:border-neutral-450'
                                  }`}
                                  title="Establecer como Logo de Marca y Portada"
                                >
                                  <img src={img} alt={`Opción ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  {isLogo && (
                                    <div className="absolute inset-0 bg-teal-600/15 flex items-center justify-center">
                                      <span className="text-[8px] bg-teal-600 text-white font-bold p-0.5 px-1 rounded-md shadow-sm">LOGO</span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9.5px] text-neutral-400 mt-1 leading-normal">
                            La foto seleccionada se utilizará como logo comercial y portada principal para los clientes.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* COMPREHENSIVE GENERAL FREE SERVICES SECTION */}
              <div className="col-span-2 space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2 font-sans text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Servicios Generales Incluidos (Gratis)
                  </span>
                  <span className="text-[9px] text-neutral-400 font-medium">Servicios estándar incluidos en cualquier estadía</span>
                </div>

                {/* Add Service Bar */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPickerGeneral(!showEmojiPickerGeneral)}
                        className="w-10 h-8 text-center text-sm border border-neutral-250 rounded-lg bg-white hover:bg-neutral-50 flex items-center justify-center cursor-pointer transition-colors"
                        title="Seleccionar Emoji"
                      >
                        <span className="text-base">{generalServiceEmoji}</span>
                      </button>
                      {showEmojiPickerGeneral && (
                        <div className="absolute z-50 left-0 top-9 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1 w-[290px]">
                          <div className="flex justify-between items-center mb-1 px-2 py-1 bg-neutral-50 rounded-t-lg">
                            <span className="text-[10px] font-bold text-neutral-600 font-sans">Elegir Emoji</span>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPickerGeneral(false)}
                              className="text-neutral-400 hover:text-neutral-600 text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              setGeneralServiceEmoji(emojiData.emoji);
                              setShowEmojiPickerGeneral(false);
                            }}
                            width={280}
                            height={320}
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                          />
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Ej:- Internet Wi-Fi de alta velocidad, Desayuno Buffet, Parqueadero"
                      value={newGeneralServiceText}
                      onChange={(e) => setNewGeneralServiceText(e.target.value)}
                      className="flex-1 text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500 h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newGeneralServiceText.trim()) {
                            const fullText = `${generalServiceEmoji} ${newGeneralServiceText.trim()}`;
                            const current = editingHotel.servicios || [];
                            if (!current.includes(fullText)) {
                              setEditingHotel({
                                ...editingHotel,
                                servicios: [...current, fullText]
                              });
                            }
                            setNewGeneralServiceText('');
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (newGeneralServiceText.trim()) {
                          const fullText = `${generalServiceEmoji} ${newGeneralServiceText.trim()}`;
                          const current = editingHotel.servicios || [];
                          if (!current.includes(fullText)) {
                            setEditingHotel({
                              ...editingHotel,
                              servicios: [...current, fullText]
                            });
                          }
                          setNewGeneralServiceText('');
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer h-8 w-full sm:w-auto"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Existing general services */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(!editingHotel.servicios || editingHotel.servicios.length === 0) ? (
                    <span className="text-[10px] text-neutral-400 italic">No hay servicios generales definidos. Todos los huéspedes tendrán servicios vacíos.</span>
                  ) : (
                    editingHotel.servicios.map((service, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 bg-white border border-neutral-200 text-neutral-700 font-semibold px-2 py-1 rounded-lg text-[10px] shadow-xs"
                      >
                        {service}
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editingHotel.servicios?.filter((_, idx) => idx !== index) || [];
                            setEditingHotel({
                              ...editingHotel,
                              servicios: filtered
                            });
                          }}
                          className="hover:text-red-500 text-neutral-400 font-bold ml-0.5 text-[9px] cursor-pointer"
                          title="Eliminar este servicio"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* DETAILED SERVICES SECTION */}
              <div className="col-span-2 space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-600" /> Servicios Exclusivos del Hotel
                  </span>
                  <span className="text-[9px] text-neutral-400 font-medium">Precios por persona, editables al reservar</span>
                </div>

                {/* Existing services list */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(!editingHotel.serviciosDetallados || editingHotel.serviciosDetallados.length === 0) ? (
                    <p className="text-[10px] text-neutral-400 text-center py-2 italic font-sans dark:text-neutral-500">No hay servicios específicos creados aún para este hotel.</p>
                  ) : (
                    editingHotel.serviciosDetallados.map((service, sIndex) => (
                      <div key={service.id || sIndex} className="p-2.5 rounded-lg bg-white border border-neutral-200 flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-neutral-800 flex items-center gap-1">
                              {service.emoji && <span className="text-sm shrink-0">{service.emoji}</span>}
                              <span>{service.nombre}</span>
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              service.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-neutral-150 text-neutral-500'
                            }`}>
                              {service.estado}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 mt-0.5 leading-snug line-clamp-2">{service.descripcion}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <span className="text-xs font-extrabold text-neutral-850 font-mono">${service.precio} <span className="text-[9px] text-neutral-400 font-normal">/ pers</span></span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setNewServiceForm({
                                  id: service.id,
                                  nombre: service.nombre,
                                  precio: service.precio,
                                  descripcion: service.descripcion,
                                  estado: service.estado,
                                  emoji: service.emoji || ''
                                });
                              }}
                              className="text-[9px] font-bold text-teal-600 hover:text-teal-700 cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const remains = (editingHotel.serviciosDetallados || []).filter((_, i) => i !== sIndex);
                                setEditingHotel({ ...editingHotel, serviciosDetallados: remains });
                              }}
                              className="text-[9px] font-bold text-red-550 hover:text-red-700 cursor-pointer"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add / Edit service sub-form */}
                <div className="p-3 bg-white border border-neutral-200 rounded-xl space-y-2.5">
                  <p className="text-[10.5px] font-bold text-neutral-700 flex items-center gap-1.5 align-middle">
                    {newServiceForm.id ? "✏️ Editar Servicio" : "➕ Agregar Nuevo Servicio"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-16 shrink-0 relative">
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Emoji</label>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPickerHotel(!showEmojiPickerHotel)}
                          className="w-full text-center text-sm border border-neutral-250 p-1 rounded-lg focus:outline-none bg-white hover:bg-neutral-50 flex items-center justify-center gap-1 cursor-pointer h-8 transition-colors"
                        >
                          <span className="text-base">{newServiceForm.emoji || '✨'}</span>
                          <span className="text-[8px] text-neutral-400 font-bold">▼</span>
                        </button>
                        {showEmojiPickerHotel && (
                          <div className="absolute z-50 left-0 top-11 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1 w-[290px]">
                            <div className="flex justify-between items-center mb-1 px-2 py-1 bg-neutral-50 rounded-t-lg">
                              <span className="text-[10px] font-bold text-neutral-600">Elegir Emoji</span>
                              <button
                                type="button"
                                onClick={() => setShowEmojiPickerHotel(false)}
                                className="text-neutral-400 hover:text-neutral-600 text-[11px] font-bold"
                              >
                                ✕
                              </button>
                            </div>
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                setNewServiceForm(prev => ({ ...prev, emoji: emojiData.emoji }));
                                setShowEmojiPickerHotel(false);
                              }}
                              width={280}
                              height={320}
                              previewConfig={{ showPreview: false }}
                              skinTonesDisabled
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Nombre del Servicio</label>
                        <input
                          type="text"
                          placeholder="Nombre. Ej: Desayuno Premium"
                          value={newServiceForm.nombre}
                          onChange={(e) => setNewServiceForm({ ...newServiceForm, nombre: e.target.value })}
                          className="w-full text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>



                    <div>
                      <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Precio Unitario ($)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Precio ($)"
                        value={newServiceForm.precio || ''}
                        onChange={(e) => setNewServiceForm({ ...newServiceForm, precio: parseFloat(e.target.value) || 0 })}
                        className="w-full text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Estado</label>
                      <select
                        value={newServiceForm.estado}
                        onChange={(e) => setNewServiceForm({ ...newServiceForm, estado: e.target.value as 'activo' | 'inactivo' })}
                        className="w-full text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none bg-white cursor-pointer"
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Descripción del Servicio</label>
                      <textarea
                        placeholder="Descripción del servicio y cobertura..."
                        value={newServiceForm.descripcion}
                        onChange={(e) => setNewServiceForm({ ...newServiceForm, descripcion: e.target.value })}
                        className="w-full h-11 text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none leading-tight"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    {newServiceForm.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewServiceForm({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo', emoji: '' });
                        }}
                        className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!newServiceForm.nombre.trim()) {
                          alert("Por favor ingrese el nombre del servicio.");
                          return;
                        }
                        if (newServiceForm.precio <= 0) {
                          alert("Por favor ingrese un precio mayor a $0.");
                          return;
                        }

                        const currentList = editingHotel.serviciosDetallados || [];
                        let nextList;
                        if (newServiceForm.id) {
                          // Edit mode
                          nextList = currentList.map(s => s.id === newServiceForm.id ? { ...newServiceForm } : s);
                        } else {
                          // Add mode
                          const newServiceObj = {
                            id: `srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            nombre: newServiceForm.nombre.trim(),
                            precio: newServiceForm.precio,
                            descripcion: newServiceForm.descripcion.trim(),
                            estado: newServiceForm.estado as 'activo' | 'inactivo',
                            emoji: newServiceForm.emoji.trim() || '✨'
                          };
                          nextList = [...currentList, newServiceObj];
                        }

                        setEditingHotel({ ...editingHotel, serviciosDetallados: nextList });
                        setNewServiceForm({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo', emoji: '' });
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer h-8 w-full sm:w-auto"
                    >
                      {newServiceForm.id ? "Actualizar" : "Agregar"}
                    </button>
                  </div>
                </div>
              </div>

              {/* POLÍTICAS INTERNAS DE ESTADÍA */}
              <div className="col-span-2 space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2 font-sans">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                    📋 Políticas Internas del Establecimiento ({(editingHotel.politicas || []).length})
                  </span>
                  <span className="text-[9px] text-neutral-400 font-medium">Políticas, normas de convivencia u horarios del establecimiento</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPickerPolicy(!showEmojiPickerPolicy)}
                        className="w-10 h-8 text-center text-sm border border-neutral-250 rounded-lg bg-white hover:bg-neutral-50 flex items-center justify-center cursor-pointer transition-colors"
                        title="Seleccionar Emoji"
                      >
                        <span className="text-base">{hotelPolicyEmoji}</span>
                      </button>
                      {showEmojiPickerPolicy && (
                        <div className="absolute z-50 left-0 top-9 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1 w-[290px]">
                          <div className="flex justify-between items-center mb-1 px-2 py-1 bg-neutral-50 rounded-t-lg">
                            <span className="text-[10px] font-bold text-neutral-600 font-sans">Elegir Emoji</span>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPickerPolicy(false)}
                              className="text-neutral-400 hover:text-neutral-600 text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              setHotelPolicyEmoji(emojiData.emoji);
                              setShowEmojiPickerPolicy(false);
                            }}
                            width={280}
                            height={320}
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                          />
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Ej: Prohibido fumar en interiores, Hora de silencio 22:00, Se aceptan mascotas pequeñas"
                      value={newHotelPolicyText}
                      onChange={(e) => setNewHotelPolicyText(e.target.value)}
                      className="flex-1 text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500 font-sans h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newHotelPolicyText.trim()) {
                            const fullText = `${hotelPolicyEmoji} ${newHotelPolicyText.trim()}`;
                            const current = editingHotel.politicas || [];
                            if (!current.includes(fullText)) {
                              setEditingHotel({
                                ...editingHotel,
                                politicas: [...current, fullText]
                              });
                            }
                            setNewHotelPolicyText('');
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (newHotelPolicyText.trim()) {
                          const fullText = `${hotelPolicyEmoji} ${newHotelPolicyText.trim()}`;
                          const current = editingHotel.politicas || [];
                          if (!current.includes(fullText)) {
                            setEditingHotel({
                              ...editingHotel,
                              politicas: [...current, fullText]
                            });
                          }
                          setNewHotelPolicyText('');
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer h-8 w-full sm:w-auto"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  {(!editingHotel.politicas || editingHotel.politicas.length === 0) ? (
                    <span className="text-[10px] text-neutral-400 italic">No hay políticas internas registradas.</span>
                  ) : (
                    editingHotel.politicas.map((pol, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-white border border-neutral-200 text-neutral-700 font-semibold px-2.5 py-1.5 rounded-lg text-[11px]"
                      >
                        <span className="truncate">{pol}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editingHotel.politicas?.filter((_, idx) => idx !== index) || [];
                            setEditingHotel({
                              ...editingHotel,
                              politicas: filtered
                            });
                          }}
                          className="text-red-500 hover:text-red-705 font-bold ml-2 text-[10px] cursor-pointer shrink-0"
                          title="Eliminar política"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button" onClick={() => setShowHotelModal(false)}
                  className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                >
                  Guardar Establecimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRUD MODAL: ADD / EDIT PROPERTY */}
      {showPropertyModal && editingProperty && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-100 flex flex-col">
            
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-2xl">
              <h4 className="font-semibold text-neutral-850">Administrar Propiedad (Casa / Departamento)</h4>
              <button 
                type="button"
                onClick={() => setShowPropertyModal(false)} 
                className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePropertySubmit} className="p-6 space-y-4">
              
              {/* FINALIDAD Y TIPO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Tipo de Propiedad:</label>
                  <select
                    value={editingProperty.tipoEstablecimiento || 'casa'}
                    onChange={(e) => setEditingProperty({
                      ...editingProperty,
                      tipoEstablecimiento: e.target.value as 'casa' | 'departamento'
                    })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none bg-white font-semibold cursor-pointer text-teal-700"
                  >
                    <option value="casa">🏡 Casa</option>
                    <option value="departamento">🏢 Departamento</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Finalidad Comercial:</label>
                  <select
                    value={editingProperty.finalidad || 'alquiler'}
                    onChange={(e) => setEditingProperty({
                      ...editingProperty,
                      finalidad: e.target.value as 'alquiler' | 'venta'
                    })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none bg-white font-semibold cursor-pointer text-amber-700"
                  >
                    <option value="alquiler">🔑 En Alquiler</option>
                    <option value="venta">🏷️ En Venta</option>
                  </select>
                </div>
              </div>

              {/* DATOS BASICOS */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Nombre Comercial de la Propiedad:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Penthouse sobre la Av. Amazonas / Villa del Valle"
                    value={editingProperty.nombre}
                    onChange={(e) => setEditingProperty({ ...editingProperty, nombre: e.target.value })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none font-semibold text-neutral-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Descripción Detallada:</label>
                  <textarea
                    required
                    placeholder="Describa la propiedad, distribución, comodidades y cercanía..."
                    value={editingProperty.descripcion}
                    onChange={(e) => setEditingProperty({ ...editingProperty, descripcion: e.target.value })}
                    className="w-full h-20 text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* DETALLES DE INMUEBLE (REQUERIDOS EN 0 AL EMPEZAR) */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                <h5 className="text-[10.5px] font-bold text-neutral-700 uppercase tracking-wider border-b border-neutral-200 pb-1.5 flex items-center gap-1">
                  <span>🏡 Especificaciones Técnicas (Requeridos)</span>
                </h5>

                <div className="grid grid-cols-3 gap-2.5 font-mono">
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-500 block mb-1 font-sans">Habitaciones:</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editingProperty.detallesInmueble?.habitaciones === 0 ? '' : (editingProperty.detallesInmueble?.habitaciones ?? '')}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setEditingProperty({
                          ...editingProperty,
                          detallesInmueble: {
                            ...(editingProperty.detallesInmueble || { habitaciones: 0, banos: 0 }),
                            habitaciones: isNaN(val) ? 0 : val
                          }
                        });
                      }}
                      className="w-full text-xs font-semibold text-center border border-neutral-250 p-1.5 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-500 block mb-1 font-sans">Baños Completos:</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editingProperty.detallesInmueble?.banos === 0 ? '' : (editingProperty.detallesInmueble?.banos ?? '')}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setEditingProperty({
                          ...editingProperty,
                          detallesInmueble: {
                            ...(editingProperty.detallesInmueble || { habitaciones: 0, banos: 0 }),
                            banos: isNaN(val) ? 0 : val
                          }
                        });
                      }}
                      className="w-full text-xs font-semibold text-center border border-neutral-250 p-1.5 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-500 block mb-1 font-sans">Superficie m²:</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="m²"
                      value={editingProperty.detallesInmueble?.metrosCuadrados || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setEditingProperty({
                          ...editingProperty,
                          detallesInmueble: {
                            ...(editingProperty.detallesInmueble || { habitaciones: 0, banos: 0 }),
                            metrosCuadrados: isNaN(val) ? undefined : val
                          }
                        });
                      }}
                      className="w-full text-xs font-semibold text-center border border-neutral-250 p-1.5 rounded-lg focus:outline-none text-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-500 block mb-1 font-sans">Precio Comercial de Propiedad (USD):</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1 text-neutral-450 font-bold text-xs">$</span>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Ej: 450 (alquiler) / 85000 (venta)"
                        value={editingProperty.detallesInmueble?.precio || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditingProperty({
                            ...editingProperty,
                            detallesInmueble: {
                              ...(editingProperty.detallesInmueble || { habitaciones: 0, banos: 0 }),
                              precio: isNaN(val) ? 0 : val
                            }
                          });
                        }}
                        className="w-full text-xs font-semibold pl-6 pr-3 py-1.5 border border-neutral-250 rounded-lg focus:outline-none text-neutral-800 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-650 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingProperty.detallesInmueble?.amueblado || false}
                      onChange={(e) => setEditingProperty({
                        ...editingProperty,
                        detallesInmueble: {
                          ...(editingProperty.detallesInmueble || { habitaciones: 0, banos: 0 }),
                          amueblado: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-teal-650 accent-teal-600 rounded cursor-pointer"
                    />
                    <span>¿Viene Amueblado?</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-650 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingProperty.detallesInmueble?.tieneEstacionamiento || false}
                      onChange={(e) => setEditingProperty({
                        ...editingProperty,
                        detallesInmueble: {
                          ...(editingProperty.detallesInmueble || { habitaciones: 0, banos: 0 }),
                          tieneEstacionamiento: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-teal-650 accent-teal-600 rounded cursor-pointer"
                    />
                    <span>Tiene Cochera / Estac.</span>
                  </label>
                </div>
              </div>

              {/* HISTORIAL Y DETALLES DEL PROPIETARIO */}
              <div className="bg-teal-50 border border-teal-150 rounded-xl p-4 space-y-3">
                <h5 className="text-[10.5px] font-bold text-teal-800 uppercase tracking-wider border-b border-teal-200 pb-1.5 flex items-center gap-1">
                  <span>👤 Datos de Contacto del Propietario</span>
                </h5>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[9.5px] font-bold text-teal-800 block mb-0.5">Nombre Completo del Propietario:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Lic. Carlos Mendoza"
                      value={editingProperty.propietario?.nombre || ''}
                      onChange={(e) => setEditingProperty({
                        ...editingProperty,
                        propietario: {
                          ...(editingProperty.propietario || { nombre: '', telefono: '', email: '' }),
                          nombre: e.target.value
                        }
                      })}
                      className="w-full text-xs border border-teal-200/80 p-2 rounded-lg bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-bold text-teal-800 block mb-0.5">WhatsApp / Celular:</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej: 099123456"
                      value={editingProperty.propietario?.telefono || ''}
                      onChange={(e) => setEditingProperty({
                        ...editingProperty,
                        propietario: {
                          ...(editingProperty.propietario || { nombre: '', telefono: '', email: '' }),
                          telefono: e.target.value
                        }
                      })}
                      className="w-full text-xs border border-teal-200/80 p-2 rounded-lg bg-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-bold text-teal-800 block mb-0.5">Identificación / C.I.:</label>
                    <input
                      type="text"
                      placeholder="Ej: 1712345678"
                      value={editingProperty.propietario?.documento || ''}
                      onChange={(e) => setEditingProperty({
                        ...editingProperty,
                        propietario: {
                          ...(editingProperty.propietario || { nombre: '', telefono: '', email: '' }),
                          documento: e.target.value
                        }
                      })}
                      className="w-full text-xs border border-teal-200/80 p-2 rounded-lg bg-white focus:outline-none font-mono"
                    />
                  </div>

                  <div className="col-span-2 font-mono">
                    <label className="text-[9.5px] font-bold text-teal-800 block mb-0.5 font-sans">Correo electrónico:</label>
                    <input
                      type="email"
                      required
                      placeholder="Ej: propietario@roomiasaas.com"
                      value={editingProperty.propietario?.email || ''}
                      onChange={(e) => setEditingProperty({
                        ...editingProperty,
                        propietario: {
                          ...(editingProperty.propietario || { nombre: '', telefono: '', email: '' }),
                          email: e.target.value
                        }
                      })}
                      className="w-full text-xs border border-teal-200/80 p-2 rounded-lg bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* GEOLOCALIZACION */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 block">Ubicación Geográfica en Ecuador:</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                    <div>
                      <label className="text-[10px] font-bold text-teal-850 block mb-1">Provincia:</label>
                      <select
                        value={editingProperty.provincia || ''}
                        onChange={(e) => {
                          const newProv = e.target.value;
                          const defaultCity = getCitiesForProvince(newProv)[0] || '';
                          const defaultParroquia = getParroquiasForCity(newProv, defaultCity)[0] || '';
                          setEditingProperty({
                            ...editingProperty,
                            provincia: newProv,
                            ciudad: defaultCity,
                            parroquia: defaultParroquia,
                            ubicacion: editingProperty.ubicacion || (newProv ? `${defaultParroquia ? defaultParroquia + ', ' : ''}${defaultCity}, ${newProv}, Ecuador` : '')
                          });
                        }}
                        className="w-full text-xs border border-teal-200 bg-white p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium text-neutral-800"
                      >
                        <option value="">-- Seleccionar Provincia --</option>
                        {getProvincesList().map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-teal-850 block mb-1">Ciudad / Cantón:</label>
                      <select
                        value={editingProperty.ciudad || ''}
                        onChange={(e) => {
                          const newCity = e.target.value;
                          const defaultParroquia = getParroquiasForCity(editingProperty.provincia || '', newCity)[0] || '';
                          setEditingProperty({
                            ...editingProperty,
                            ciudad: newCity,
                            parroquia: defaultParroquia,
                            ubicacion: editingProperty.ubicacion || (editingProperty.provincia ? `${defaultParroquia ? defaultParroquia + ', ' : ''}${newCity}, ${editingProperty.provincia}, Ecuador` : '')
                          });
                        }}
                        disabled={!editingProperty.provincia}
                        className="w-full text-xs border border-teal-200 bg-white p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium text-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        <option value="">-- Seleccionar Ciudad --</option>
                        {getCitiesForProvince(editingProperty.provincia || '').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-teal-850 block mb-1">Parroquia:</label>
                      <select
                        value={editingProperty.parroquia || ''}
                        onChange={(e) => {
                          const newParroquia = e.target.value;
                          setEditingProperty({
                            ...editingProperty,
                            parroquia: newParroquia
                          });
                        }}
                        disabled={!editingProperty.ciudad}
                        className="w-full text-xs border border-teal-200 bg-white p-2 rounded-lg focus:outline-none focus:border-teal-500 font-medium text-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        <option value="">-- Seleccionar Parroquia --</option>
                        {getParroquiasForCity(editingProperty.provincia || '', editingProperty.ciudad || '').map(par => (
                          <option key={par} value={par}>{par}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Dirección Exacta (Ubicación):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Calle 15 de Noviembre y Av. de los Granados, Quito, Ecuador"
                    value={editingProperty.ubicacion}
                    onChange={(e) => setEditingProperty({ ...editingProperty, ubicacion: e.target.value })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none font-semibold text-neutral-850"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Enlace de Google Maps (URL / Pin):</label>
                  <input
                    type="text"
                    placeholder="Ej: https://maps.google.com/... o enlace para compartir"
                    value={editingProperty.googleMapsUrl || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, googleMapsUrl: e.target.value })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none font-mono"
                  />
                  <div className="border border-neutral-200 rounded-xl overflow-hidden mt-1.5 bg-neutral-50 h-36 relative shadow-sm">
                    {(() => {
                      const embedSrc = getMapEmbedUrl(editingProperty.ubicacion, editingProperty.googleMapsUrl);
                      if (!embedSrc) {
                        return (
                          <div className="flex flex-col items-center justify-center p-3 h-full text-center">
                            <MapPin className="w-6 h-6 text-neutral-300 mb-1" />
                            <p className="text-[10px] text-neutral-400 font-medium font-sans">Escribe una dirección o enlace de Google Maps para previsualizar el mapa</p>
                          </div>
                        );
                      }

                      return (
                        <iframe
                          title="Vista de Mapa de la Propiedad"
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
                </div>
              </div>

              {/* 15 COMPREHENSIVE PROPERTY IMAGES SELECTOR SECTION */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3 font-sans">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Imágenes y Videos del Inmueble ({(editingProperty.imagenes || []).length}/15)</span>
                  <span className="text-[10px] text-neutral-400 font-medium font-semibold">Hasta 15 fotos o videos (mediante enlace o archivo local)</span>
                </div>

                {/* Grid of 15 slots */}
                <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {Array.from({ length: 15 }).map((_, idx) => {
                    const imgUrl = (editingProperty.imagenes || [])[idx];
                    const isVid = imgUrl ? (
                      imgUrl.toLowerCase().endsWith('.mp4') ||
                      imgUrl.toLowerCase().endsWith('.webm') ||
                      imgUrl.toLowerCase().endsWith('.mov') ||
                      imgUrl.includes('youtube.com') ||
                      imgUrl.includes('youtu.be') ||
                      imgUrl.includes('vimeo.com') ||
                      imgUrl.startsWith('data:video/')
                    ) : false;

                    return (
                      <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-neutral-250 bg-neutral-200 flex items-center justify-center group overflow-hidden shadow-sm">
                        {imgUrl ? (
                          <>
                            {isVid ? (
                              <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center text-white relative">
                                <span className="text-sm">🎥</span>
                                <span className="text-[7px] uppercase font-bold tracking-tight text-white/80">Video {idx + 1}</span>
                              </div>
                            ) : (
                              <img src={imgUrl} alt={`Inmueble Foto ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            )}
                            <div className="absolute top-1 left-1 bg-neutral-900/85 text-white font-mono text-[8px] px-1 rounded">
                              {idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextImgs = [...(editingProperty.imagenes || [])];
                                nextImgs.splice(idx, 1);
                                setEditingProperty({ ...editingProperty, imagenes: nextImgs });
                              }}
                              className="absolute inset-0 bg-red-650/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] font-bold"
                            >
                              Quitar
                            </button>
                          </>
                        ) : (
                          <div className="text-neutral-450 text-[8px] font-medium p-1 text-center leading-tight">
                            Vacío<br/>
                            <span className="text-neutral-400 text-[9px] font-mono">#{idx + 1}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Adding New URL link if space permits */}
                {(!editingProperty.imagenes || editingProperty.imagenes.length < 15) && (
                  <div className="space-y-2 pt-1 font-sans">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="new-property-image-input"
                        placeholder="Pega enlace de foto o video del inmueble (YouTube, Vimeo, mp4)..."
                        className="flex-1 text-[11px] border border-neutral-255 p-2 rounded-lg bg-white focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.currentTarget;
                            const val = input.value.trim();
                            if (val) {
                              const currentImgs = editingProperty.imagenes || [];
                              setEditingProperty({ ...editingProperty, imagenes: [...currentImgs, val].slice(0, 15) });
                              input.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('new-property-image-input') as HTMLInputElement;
                          const val = input?.value?.trim();
                          if (val) {
                            const currentImgs = editingProperty.imagenes || [];
                            setEditingProperty({ ...editingProperty, imagenes: [...currentImgs, val].slice(0, 15) });
                            if (input) input.value = '';
                          }
                        }}
                        className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-sm"
                      >
                        Agregar Link
                      </button>
                    </div>

                    {/* Local File upload element */}
                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-dashed border-neutral-300">
                      <span className="text-[10px] font-bold text-neutral-500">¿Subir foto o video local? (Máx 15MB)</span>
                      <label className="flex items-center gap-1 py-1 px-2.5 bg-neutral-900 text-white hover:bg-teal-600 rounded-md text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                        <Upload className="w-3 h-3" />
                        <span>Elegir Archivo</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'property')}
                        />
                      </label>
                    </div>

                    {/* Pre-curated Suggestions list */}
                    <div className="space-y-1.5 animate-fade-in">
                      <p className="text-[10px] text-neutral-450 font-bold block">Sugerencias estéticas de Inmuebles:</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'Casa de Lujo', url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800' },
                          { label: 'Depto Loft', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
                          { label: 'Living Room', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800' },
                          { label: 'Video Demo', url: 'https://assets.mixkit.co/videos/preview/mixkit-swimming-pool-in-a-resort-40439-large.mp4' }
                        ].map((suggest, sIdx) => {
                          const alreadyHas = (editingProperty.imagenes || []).includes(suggest.url);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              disabled={alreadyHas}
                              onClick={() => {
                                const currentImgs = editingProperty.imagenes || [];
                                setEditingProperty({ ...editingProperty, imagenes: [...currentImgs, suggest.url].slice(0, 15) });
                              }}
                              className={`px-2 py-1 rounded text-[9px] font-semibold border transition-all cursor-pointer ${
                                alreadyHas
                                  ? 'bg-neutral-100 text-neutral-350 border-neutral-200 cursor-not-allowed'
                                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'
                              }`}
                            >
                              + {suggest.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SERVICIOS INCLUIDOS (GRATIS) */}
              <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2 font-sans text-xs">
                <div className="flex flex-col border-b border-neutral-200 pb-1.5 mb-2">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                    🎁 Servicios Incluidos (Gratis) ({(editingProperty.servicios || []).length})
                  </span>
                  <span className="text-[9px] text-neutral-400 font-medium font-sans">Servicios y comodidades que ya vienen incluidos gratis en la propiedad</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPickerPropertyService(!showEmojiPickerPropertyService)}
                        className="w-10 h-8 text-center text-sm border border-neutral-250 rounded-lg bg-white hover:bg-neutral-50 flex items-center justify-center cursor-pointer transition-colors"
                        title="Seleccionar Emoji"
                      >
                        <span className="text-base">{propertyServiceEmoji}</span>
                      </button>
                      {showEmojiPickerPropertyService && (
                        <div className="absolute z-50 left-0 top-9 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1 w-[290px]">
                          <div className="flex justify-between items-center mb-1 px-2 py-1 bg-neutral-50 rounded-t-lg">
                            <span className="text-[10px] font-bold text-neutral-600 font-sans">Elegir Emoji</span>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPickerPropertyService(false)}
                              className="text-neutral-400 hover:text-neutral-600 text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              setPropertyServiceEmoji(emojiData.emoji);
                              setShowEmojiPickerPropertyService(false);
                            }}
                            width={280}
                            height={320}
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                          />
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Ej / Wifi Fibra Óptica, Agua Caliente, Aire Acondicionado, Estacionamiento Gratis"
                      value={newPropertyServiceText}
                      onChange={(e) => setNewPropertyServiceText(e.target.value)}
                      className="flex-1 text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500 font-sans font-semibold text-neutral-800 h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newPropertyServiceText.trim()) {
                            const fullText = `${propertyServiceEmoji} ${newPropertyServiceText.trim()}`;
                            const current = editingProperty.servicios || [];
                            if (!current.includes(fullText)) {
                              setEditingProperty({
                                ...editingProperty,
                                servicios: [...current, fullText]
                              });
                            }
                            setNewPropertyServiceText('');
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (newPropertyServiceText.trim()) {
                          const fullText = `${propertyServiceEmoji} ${newPropertyServiceText.trim()}`;
                          const current = editingProperty.servicios || [];
                          if (!current.includes(fullText)) {
                            setEditingProperty({
                              ...editingProperty,
                              servicios: [...current, fullText]
                            });
                          }
                          setNewPropertyServiceText('');
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer h-8 w-full sm:w-auto"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2 font-semibold">
                  {(!editingProperty.servicios || editingProperty.servicios.length === 0) ? (
                    <span className="text-[10px] text-neutral-400 italic">No hay servicios incluidos definidos aún.</span>
                  ) : (
                    editingProperty.servicios.map((service, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 bg-white border border-neutral-200 text-neutral-700 font-semibold px-2 py-1 rounded-lg text-[10px] shadow-xs"
                      >
                        {service}
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editingProperty.servicios?.filter((_, idx) => idx !== index) || [];
                            setEditingProperty({
                              ...editingProperty,
                              servicios: filtered
                            });
                          }}
                          className="text-red-500 hover:text-red-700 ml-1 font-bold font-mono focus:outline-none cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* POLÍTICAS INTERNAS DEL INMUEBLE */}
              <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2 font-sans text-xs">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                    📋 Políticas Internas de esta Propiedad ({(editingProperty.politicas || []).length})
                  </span>
                  <span className="text-[9px] text-neutral-400 font-medium font-sans">Normas de convivencia, políticas de cuidado o requisitos del propietario</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPickerPropertyPolicy(!showEmojiPickerPropertyPolicy)}
                        className="w-10 h-8 text-center text-sm border border-neutral-250 rounded-lg bg-white hover:bg-neutral-50 flex items-center justify-center cursor-pointer transition-colors"
                        title="Seleccionar Emoji"
                      >
                        <span className="text-base">{propertyPolicyEmoji}</span>
                      </button>
                      {showEmojiPickerPropertyPolicy && (
                        <div className="absolute z-50 left-0 top-9 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1 w-[290px]">
                          <div className="flex justify-between items-center mb-1 px-2 py-1 bg-neutral-50 rounded-t-lg">
                            <span className="text-[10px] font-bold text-neutral-600 font-sans">Elegir Emoji</span>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPickerPropertyPolicy(false)}
                              className="text-neutral-400 hover:text-neutral-600 text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              setPropertyPolicyEmoji(emojiData.emoji);
                              setShowEmojiPickerPropertyPolicy(false);
                            }}
                            width={280}
                            height={320}
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                          />
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Ej: Cuidado obligatorio del jardín, No se permiten fiestas, Se solicita identificación"
                      value={newPropertyPolicyText}
                      onChange={(e) => setNewPropertyPolicyText(e.target.value)}
                      className="flex-1 text-xs bg-white border border-neutral-250 p-1.5 rounded-lg focus:outline-none focus:border-teal-500 font-sans h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newPropertyPolicyText.trim()) {
                            const fullText = `${propertyPolicyEmoji} ${newPropertyPolicyText.trim()}`;
                            const current = editingProperty.politicas || [];
                            if (!current.includes(fullText)) {
                              setEditingProperty({
                                ...editingProperty,
                                politicas: [...current, fullText]
                              });
                            }
                            setNewPropertyPolicyText('');
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (newPropertyPolicyText.trim()) {
                          const fullText = `${propertyPolicyEmoji} ${newPropertyPolicyText.trim()}`;
                          const current = editingProperty.politicas || [];
                          if (!current.includes(fullText)) {
                            setEditingProperty({
                              ...editingProperty,
                              politicas: [...current, fullText]
                            });
                          }
                          setNewPropertyPolicyText('');
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer h-8 w-full sm:w-auto"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  {(!editingProperty.politicas || editingProperty.politicas.length === 0) ? (
                    <span className="text-[10px] text-neutral-400 italic font-sans">No hay políticas registradas para esta propiedad.</span>
                  ) : (
                    editingProperty.politicas.map((pol, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-white border border-neutral-200 text-neutral-700 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] font-sans"
                      >
                        <span className="truncate">{pol}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editingProperty.politicas?.filter((_, idx) => idx !== index) || [];
                            setEditingProperty({
                              ...editingProperty,
                              politicas: filtered
                            });
                          }}
                          className="text-red-500 hover:text-red-705 font-bold ml-2 text-[10px] cursor-pointer shrink-0"
                          title="Eliminar política"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SERVICIOS DETALLADOS PARA ALQUILER */}
              {editingProperty.finalidad !== 'venta' && (
                <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mt-2">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" /> Servicios Adicionales en Alquiler
                    </span>
                    <span className="text-[9px] text-neutral-400 font-medium">Precios por persona, editables en reserva</span>
                  </div>

                  {/* Existing services list */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(!editingProperty.serviciosDetallados || editingProperty.serviciosDetallados.length === 0) ? (
                      <p className="text-[10px] text-neutral-400 text-center py-2 italic font-sans dark:text-neutral-500">No hay servicios adicionales creados aún para esta propiedad.</p>
                    ) : (
                      editingProperty.serviciosDetallados.map((service, sIndex) => (
                        <div key={service.id || sIndex} className="p-2.5 rounded-lg bg-white border border-neutral-200 flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-neutral-800 flex items-center gap-1">
                                {service.emoji && <span className="text-sm shrink-0">{service.emoji}</span>}
                                <span>{service.nombre}</span>
                              </span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                service.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-neutral-150 text-neutral-500'
                              }`}>
                                {service.estado}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-0.5 leading-snug line-clamp-2">{service.descripcion}</p>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <span className="text-xs font-extrabold text-neutral-850 font-mono">${service.precio} <span className="text-[9px] text-neutral-400 font-normal">/ pers</span></span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewServiceForm({
                                    id: service.id,
                                    nombre: service.nombre,
                                    precio: service.precio,
                                    descripcion: service.descripcion,
                                    estado: service.estado,
                                    emoji: service.emoji || ''
                                  });
                                }}
                                className="text-[9px] font-bold text-teal-600 hover:text-teal-700 cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const remains = (editingProperty.serviciosDetallados || []).filter((_, i) => i !== sIndex);
                                  setEditingProperty({ ...editingProperty, serviciosDetallados: remains });
                                }}
                                className="text-[9px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add / Edit service sub-form */}
                  <div className="p-3 bg-white border border-neutral-200 rounded-xl space-y-2.5">
                    <p className="text-[10.5px] font-bold text-neutral-700 flex items-center gap-1.5 align-middle font-sans">
                      {newServiceForm.id ? "✏️ Editar Servicio Adicional" : "➕ Agregar Servicio Adicional"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-16 shrink-0 relative">
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Emoji</label>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPickerProperty(!showEmojiPickerProperty)}
                          className="w-full text-center text-sm border border-neutral-250 p-1 rounded-lg focus:outline-none bg-white hover:bg-neutral-50 flex items-center justify-center gap-1 cursor-pointer h-8 transition-colors"
                        >
                          <span className="text-base">{newServiceForm.emoji || '✨'}</span>
                          <span className="text-[8px] text-neutral-400 font-bold">▼</span>
                        </button>
                        {showEmojiPickerProperty && (
                          <div className="absolute z-50 left-0 top-11 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1 w-[290px]">
                            <div className="flex justify-between items-center mb-1 px-2 py-1 bg-neutral-50 rounded-t-lg">
                              <span className="text-[10px] font-bold text-neutral-600">Elegir Emoji</span>
                              <button
                                type="button"
                                onClick={() => setShowEmojiPickerProperty(false)}
                                className="text-neutral-400 hover:text-neutral-600 text-[11px] font-bold"
                              >
                                ✕
                              </button>
                            </div>
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                setNewServiceForm(prev => ({ ...prev, emoji: emojiData.emoji }));
                                setShowEmojiPickerProperty(false);
                              }}
                              width={280}
                              height={320}
                              previewConfig={{ showPreview: false }}
                              skinTonesDisabled
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Nombre del Servicio</label>
                        <input
                          type="text"
                          placeholder="Nombre. Ej: Desayuno americano, Transfer al aeropuerto"
                          value={newServiceForm.nombre}
                          onChange={(e) => setNewServiceForm({ ...newServiceForm, nombre: e.target.value })}
                          className="w-full text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>



                      <div>
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Precio Unitario ($)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Precio ($)"
                          value={newServiceForm.precio || ''}
                          onChange={(e) => setNewServiceForm({ ...newServiceForm, precio: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Estado</label>
                        <select
                          value={newServiceForm.estado}
                          onChange={(e) => setNewServiceForm({ ...newServiceForm, estado: e.target.value as 'activo' | 'inactivo' })}
                          className="w-full text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none bg-white cursor-pointer"
                        >
                          <option value="activo">Activo</option>
                          <option value="inactivo">Inactivo</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] text-neutral-450 block mb-0.5 font-bold uppercase">Descripción del Servicio</label>
                        <textarea
                          placeholder="Descripción del servicio..."
                          value={newServiceForm.descripcion}
                          onChange={(e) => setNewServiceForm({ ...newServiceForm, descripcion: e.target.value })}
                          className="w-full h-11 text-xs border border-neutral-250 p-1.5 rounded-lg focus:outline-none leading-tight"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      {newServiceForm.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewServiceForm({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo', emoji: '' });
                          }}
                          className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!newServiceForm.nombre.trim()) {
                            alert("Por favor ingrese el nombre del servicio.");
                            return;
                          }
                          if (newServiceForm.precio <= 0) {
                            alert("Por favor ingrese un precio mayor a $0.");
                            return;
                          }

                          const currentList = editingProperty.serviciosDetallados || [];
                          let nextList;
                          if (newServiceForm.id) {
                            // Edit mode
                            nextList = currentList.map(s => s.id === newServiceForm.id ? { ...newServiceForm } : s);
                          } else {
                            // Add mode
                            const newServiceObj = {
                              id: `srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                              nombre: newServiceForm.nombre.trim(),
                              precio: newServiceForm.precio,
                              descripcion: newServiceForm.descripcion.trim(),
                              estado: newServiceForm.estado as 'activo' | 'inactivo',
                              emoji: newServiceForm.emoji.trim() || '✨'
                            };
                            nextList = [...currentList, newServiceObj];
                          }

                          setEditingProperty({ ...editingProperty, serviciosDetallados: nextList });
                          setNewServiceForm({ id: '', nombre: '', precio: 0, descripcion: '', estado: 'activo', emoji: '' });
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer h-8 w-full sm:w-auto"
                      >
                        {newServiceForm.id ? "Actualizar" : "Agregar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ACCIONES */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPropertyModal(false)}
                  className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md animate-pulse"
                >
                  Publicar Propiedad
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CRUD MODAL: ADD / EDIT ROOM */}
      {showRoomModal && editingRoom && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-100 flex flex-col">
            
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-2xl">
              <h4 className="font-semibold text-neutral-850">Administrar Habitación</h4>
              <button onClick={() => setShowRoomModal(false)} className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoomSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Hotel Destinatario:</label>
                  <select
                    disabled={!(isSuper || activeUser.rol === 'hotel_admin') || allowedHotels.length <= 1}
                    value={editingRoom.hotelId}
                    onChange={(e) => setEditingRoom({ ...editingRoom, hotelId: e.target.value })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg bg-white disabled:bg-neutral-50 disabled:text-neutral-500 focus:outline-none cursor-pointer"
                  >
                    {!allowedOnlyHotels.some(h => h.id === editingRoom.hotelId) && (
                      <option value={editingRoom.hotelId}>
                        {hotels.find(h => h.id === editingRoom.hotelId)?.nombre || `Establecimiento (${editingRoom.hotelId})`}
                      </option>
                    )}
                    {allowedOnlyHotels.map(h => (
                       <option key={h.id} value={h.id}>{h.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Número de Suite / Cuarto:</label>
                  <input
                    type="text" required
                    value={editingRoom.numero}
                    onChange={(e) => setEditingRoom({ ...editingRoom, numero: e.target.value })}
                    placeholder="Ej: 304"
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Nivel Estructural (Tipo):</label>
                  <select
                    value={editingRoom.tipo}
                    onChange={(e) => setEditingRoom({ ...editingRoom, tipo: e.target.value as any })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="Estándar">Estándar</option>
                    <option value="Doble">Doble</option>
                    <option value="Triple">Triple</option>
                    <option value="Suite">Suite</option>
                    <option value="Suite Presidencial">Suite Presidencial</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Nombre Comercial:</label>
                  <input
                    type="text" required
                    value={editingRoom.nombre}
                    onChange={(e) => setEditingRoom({ ...editingRoom, nombre: e.target.value })}
                    placeholder="Ej: Deluxe Double King Panoramic"
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Descripción del Cuarto:</label>
                  <textarea
                    required
                    value={editingRoom.descripcion}
                    onChange={(e) => setEditingRoom({ ...editingRoom, descripcion: e.target.value })}
                    className="w-full h-16 text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Precio por noche ($ USD):</label>
                  <input
                    type="number" required
                    value={editingRoom.precio === 0 ? '' : editingRoom.precio}
                    onChange={(e) => setEditingRoom({ ...editingRoom, precio: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Capacidad (Personas):</label>
                  <input
                    type="number" required
                    value={editingRoom.capacidad === 0 ? '' : editingRoom.capacidad}
                    onChange={(e) => setEditingRoom({ ...editingRoom, capacidad: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Cantidad de camas:</label>
                  <input
                    type="number" required
                    value={editingRoom.camas === 0 ? '' : editingRoom.camas}
                    onChange={(e) => setEditingRoom({ ...editingRoom, camas: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Estado Operativo Inicial:</label>
                  <select
                    value={editingRoom.estado}
                    onChange={(e) => setEditingRoom({ ...editingRoom, estado: e.target.value as RoomStatus })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="disponible">Disponible</option>
                    <option value="reservado">Reservado</option>
                    <option value="ocupado">Ocupado</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-1.5 pl-0.5">
                  <label className="text-[10px] font-bold text-neutral-450 block uppercase tracking-wider mb-2">IVA de la Habitación:</label>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingRoom.adicionarIva !== false}
                      onChange={(e) => setEditingRoom({ ...editingRoom, adicionarIva: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-teal-600"></div>
                    <span className="ml-2 text-xs font-semibold text-neutral-700">
                      {editingRoom.adicionarIva !== false ? 'Sumar IVA al precio' : 'Precio ya incluye IVA'}
                    </span>
                  </label>
                </div>

                {/* Servicios y Comodidades Incluidas en la Habitación */}
                <div className="col-span-2 space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200 font-sans">
                    <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">
                      Servicios y Comodidades Incluidas en la Habitación ({(editingRoom.servicios || []).length})
                    </span>
                    <span className="text-[10px] text-neutral-400 font-medium">Ej: Ducha Lluvia, TV Smart, Aire Acondicionado</span>
                  </div>

                  {/* Input para añadir servicio personalizado */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Escribe una comodidad (Ej: Jacuzzi, Caja Fuerte, Minibar...)"
                      id="newRoomServiceInput"
                      className="flex-1 text-xs border border-neutral-250 p-2 rounded-lg bg-white focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.currentTarget.value || '').trim();
                          if (val) {
                            const current = editingRoom.servicios || [];
                            if (!current.includes(val)) {
                              setEditingRoom({ ...editingRoom, servicios: [...current, val] });
                            }
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('newRoomServiceInput') as HTMLInputElement;
                        if (input && input.value.trim()) {
                          const val = input.value.trim();
                          const current = editingRoom.servicios || [];
                          if (!current.includes(val)) {
                            setEditingRoom({ ...editingRoom, servicios: [...current, val] });
                          }
                          input.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  {/* Badges sugeridos de un clic */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-neutral-400 font-medium">Sugerencias rápidas:</span>
                    {['Ducha Lluvia', 'TV Smart', 'Aire Acondicionado', 'Wifi de Alta Velocidad', 'Jacuzzi', 'Caja Fuerte', 'Minibar', 'Vista a la Ciudad', 'Balcón Privado', 'Escritorio', 'Secador de Pelo'].map((sug) => {
                      const active = (editingRoom.servicios || []).includes(sug);
                      return (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            const current = editingRoom.servicios || [];
                            if (active) {
                              setEditingRoom({ ...editingRoom, servicios: current.filter(s => s !== sug) });
                            } else {
                              setEditingRoom({ ...editingRoom, servicios: [...current, sug] });
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            active
                              ? 'bg-teal-50 border-teal-300 text-teal-800 font-semibold'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}{sug}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tags actualmente agregados */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(!editingRoom.servicios || editingRoom.servicios.length === 0) ? (
                      <span className="text-[10px] text-neutral-400 italic">No hay servicios ni comodidades asignados a esta habitación.</span>
                    ) : (
                      editingRoom.servicios.map((service, index) => (
                        <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-neutral-250 rounded-md text-xs font-medium text-neutral-700 shadow-2xs">
                          <span>{service}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = (editingRoom.servicios || []).filter((_, idx) => idx !== index);
                              setEditingRoom({ ...editingRoom, servicios: filtered });
                            }}
                            className="text-neutral-400 hover:text-red-600 ml-1 font-bold cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200 font-sans">
                    <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Imágenes y Videos de la Habitación ({(editingRoom.imagenes || []).length}/15)</span>
                    <span className="text-[10px] text-neutral-400 font-medium">Hasta 15 fotos o videos (mediante enlace o archivo local)</span>
                  </div>
                  
                  {/* Grid of 15 slots containers */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                    {Array.from({ length: 15 }).map((_, idx) => {
                      const imgUrl = (editingRoom.imagenes || [])[idx];
                      const isVid = imgUrl ? (
                        imgUrl.toLowerCase().endsWith('.mp4') ||
                        imgUrl.toLowerCase().endsWith('.webm') ||
                        imgUrl.toLowerCase().endsWith('.mov') ||
                        imgUrl.includes('youtube.com') ||
                        imgUrl.includes('youtu.be') ||
                        imgUrl.includes('vimeo.com') ||
                        imgUrl.startsWith('data:video/')
                      ) : false;

                      return (
                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-neutral-250 bg-neutral-200 flex items-center justify-center group overflow-hidden shadow-sm">
                          {imgUrl ? (
                            <>
                              {isVid ? (
                                <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center text-white relative">
                                  <span className="text-sm">🎥</span>
                                  <span className="text-[7px] uppercase font-bold tracking-tight text-white/80">Video {idx + 1}</span>
                                </div>
                              ) : (
                                <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              )}
                              <div className="absolute top-1 left-1 bg-neutral-900/85 text-white font-mono text-[8px] px-1 rounded">
                                {idx + 1}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextImgs = [...(editingRoom.imagenes || [])];
                                  nextImgs.splice(idx, 1);
                                  setEditingRoom({ ...editingRoom, imagenes: nextImgs });
                                }}
                                className="absolute inset-0 bg-red-650/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] font-bold"
                              >
                                Quitar
                              </button>
                            </>
                          ) : (
                            <div className="text-neutral-450 text-[8px] font-medium p-1 text-center leading-tight">
                              Vacío<br/>
                              <span className="text-neutral-400 text-[9px] font-mono">#{idx + 1}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Input link field if we have fewer than 15 images */}
                  {(!editingRoom.imagenes || editingRoom.imagenes.length < 15) && (
                    <div className="space-y-2 pt-1 font-sans">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="new-room-image-input"
                          placeholder="Pega enlace de foto o video de la habitación (YouTube, Vimeo, mp4)..."
                          className="flex-1 text-[11px] border border-neutral-255 p-2 rounded-lg bg-white focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.currentTarget;
                              const val = input.value.trim();
                              if (val) {
                                const currentImgs = editingRoom.imagenes || [];
                                setEditingRoom({ ...editingRoom, imagenes: [...currentImgs, val].slice(0, 15) });
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new-room-image-input') as HTMLInputElement;
                            const val = input?.value?.trim();
                            if (val) {
                              const currentImgs = editingRoom.imagenes || [];
                              setEditingRoom({ ...editingRoom, imagenes: [...currentImgs, val].slice(0, 15) });
                              if (input) input.value = '';
                            }
                          }}
                          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-sm animate-fade-in"
                        >
                          Agregar Link
                        </button>
                      </div>

                      {/* Direct file upload from internal storage */}
                      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-dashed border-neutral-300">
                        <span className="text-[10px] font-bold text-neutral-500">¿Subir foto o video local? (Máx 15MB)</span>
                        <label className="flex items-center gap-1 py-1 px-2.5 bg-neutral-900 text-white hover:bg-teal-600 rounded-md text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                          <Upload className="w-3 h-3" />
                          <span>Elegir Archivo</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'room')}
                          />
                        </label>
                      </div>

                      {/* Suggestions list of pre-curated gorgeous unsplash bed/suite photos */}
                      <div className="space-y-1.5 animate-fade-in">
                        <p className="text-[10px] text-neutral-450 font-bold block">Sugerencias estéticas de Roomia (Click para añadir):</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: 'Cama King Lujo', url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800' },
                            { label: 'Suite Imperial', url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800' },
                            { label: 'Suite Vista Ciudad', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800' },
                            { label: 'Estudio Loft', url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800' },
                            { label: 'Salón de Suite', url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800' }
                          ].map((suggest, sIdx) => {
                            const alreadyHas = (editingRoom.imagenes || []).includes(suggest.url);
                            return (
                              <button
                                key={sIdx}
                                type="button"
                                disabled={alreadyHas}
                                onClick={() => {
                                  const currentImgs = editingRoom.imagenes || [];
                                  setEditingRoom({ ...editingRoom, imagenes: [...currentImgs, suggest.url].slice(0, 15) });
                                }}
                                className={`px-2 py-1 rounded text-[9px] font-semibold border transition-all cursor-pointer ${
                                  alreadyHas
                                    ? 'bg-neutral-100 text-neutral-350 border-neutral-200 cursor-not-allowed'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'
                                }`}
                              >
                                + {suggest.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {originalRoomStatus && editingRoom.estado !== originalRoomStatus && (
                  <div className="col-span-2 bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1.5 animate-fade-in text-xs">
                    <label className="text-[11px] font-bold text-amber-800 block">
                      ⚠️ Detallada Justificación para Huésped con Reserva Activa:
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Ej: Cambio imprevisto debido a avería técnica... Se reubicará al huésped..."
                      value={roomStatusChangeReason}
                      onChange={(e) => setRoomStatusChangeReason(e.target.value)}
                      className="w-full text-xs p-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}

              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button" onClick={() => setShowRoomModal(false)}
                  className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                >
                  Guardar Habitación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REST STATUS MODIFIER MODAL */}
      {showResStatusModal && selectedResToEdit && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in text-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-neutral-100 space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-150 pb-3 bg-neutral-50 px-4 py-3 -m-6 mb-2 rounded-t-2xl">
              <h4 className="font-bold text-neutral-850 text-xs">Modificar Estado de Reservación</h4>
              <button 
                onClick={() => setShowResStatusModal(false)} 
                className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 font-sans text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase block font-mono">ID RESERVACIÓN:</span>
                <span className="text-xs font-mono font-extrabold text-neutral-800">{selectedResToEdit.id}</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 block mb-1">Nuevo Estado Destinatario:</label>
                <select
                  value={newResStatus}
                  onChange={(e) => setNewResStatus(e.target.value as any)}
                  className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg bg-white focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="ocupada">Ocupada</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 block mb-1">
                  Mensaje explicativo de Justificación para el Cliente (Requerido):
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detalle de forma clara el motivo del cambio operativo. El huésped podrá visualizar este texto en tiempo real en su panel..."
                  value={statusChangeMessage}
                  onChange={(e) => setStatusChangeMessage(e.target.value)}
                  className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResStatusModal(false)}
                className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateReservationStatus) {
                    onUpdateReservationStatus(
                      selectedResToEdit.id,
                      newResStatus,
                      activeUser.nombre,
                      activeUser.rol,
                      statusChangeMessage
                    );
                    setShowResStatusModal(false);
                  }
                }}
                disabled={!statusChangeMessage.trim()}
                className="w-1/2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                Guardar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROCESAR CANCELACIÓN Y REEMBOLSO */}
      {showRefundModal && selectedResForRefund && (() => {
        const guest = users.find(u => u.id === selectedResForRefund.guestId);
        const guestName = guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped Particular';

        const getDaysDiff = (checkInStr: string, requestStr: string) => {
          if (!checkInStr || !requestStr) return 0;
          const checkIn = new Date(checkInStr + 'T00:00:00');
          const request = new Date(requestStr + 'T00:00:00');
          const diffTime = checkIn.getTime() - request.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays;
        };

        const getRefundCategory = (res: Reservation, requestDate: string) => {
          if (res.estado === 'pendiente') {
            return {
              percent: 0,
              label: 'Sin pago - Solo Cancelación',
              color: 'bg-amber-50 text-amber-800 border-amber-200',
              applyRefund: false,
              desc: 'No se registró ningún pago. Pasa directo a Cancelada sin reembolso.'
            };
          }

          const montoAbonado = res.montoPagado !== undefined ? res.montoPagado : res.total;
          const pagadoTotal = res.montoPendiente !== undefined ? (res.montoPendiente === 0) : (montoAbonado >= res.total);

          if (!pagadoTotal) {
            return {
              percent: 0,
              label: 'Sin Reembolso (Pago Parcial 20%)',
              color: 'bg-red-50 text-red-800 border-red-200',
              applyRefund: false,
              desc: 'No aplica reembolso. El reembolso solo aplica cuando una reserva se pagó el valor total.'
            };
          }
          
          const days = getDaysDiff(res.fechaEntrada, requestDate);
          
          if (days >= 15) {
            return {
              percent: 100,
              label: 'Reembolso Completo (100%)',
              color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              applyRefund: true,
              desc: '🟢 Reembolso del 100% de lo abonado. Cancelación temprana sin costo administrativo.'
            };
          } else if (days >= 7) {
            return {
              percent: 50,
              label: 'Reembolso Parcial (50%)',
              color: 'bg-blue-50 text-blue-800 border-blue-200',
              applyRefund: true,
              desc: '🔵 Reembolso del 50% de lo abonado. Retención por bloqueo de habitación.'
            };
          } else if (days >= 3) {
            return {
              percent: 20,
              label: 'Reembolso Mínimo (20%)',
              color: 'bg-amber-50 text-amber-800 border-amber-200',
              applyRefund: true,
              desc: '🟡 Reembolso del 20% de lo abonado. Penalidad moderada por cancelación corta.'
            };
          } else {
            return {
              percent: 0,
              label: 'Penalización Completa (0%)',
              color: 'bg-red-50 text-red-800 border-red-200',
              applyRefund: true,
              desc: '🔴 Reembolso del 0%. No aplica devolución de dinero por cancelación tardía.'
            };
          }
        };

        const diag = getRefundCategory(selectedResForRefund, simulatedRequestDate);
        const days = getDaysDiff(selectedResForRefund.fechaEntrada, simulatedRequestDate);
        const montoAbonado = selectedResForRefund.montoPagado !== undefined ? selectedResForRefund.montoPagado : selectedResForRefund.total;
        const refundAmount = ((diag.percent * montoAbonado) / 100).toFixed(2);
        
        return (
          <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in text-xs">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-neutral-100 space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-150 pb-3 bg-neutral-50 px-4 py-3 -m-6 mb-2 rounded-t-2xl">
                <h4 className="font-bold text-neutral-850 text-xs">Procesar Cancelación & Reembolso</h4>
                <button 
                  onClick={() => setShowRefundModal(false)} 
                  className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block font-mono">Reserva:</span>
                  <span className="text-xs font-mono font-extrabold text-neutral-800">{selectedResForRefund.id} ({guestName})</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 text-[11px]">
                  <div>
                    <span className="text-neutral-450 block">Entrada:</span>
                    <strong className="text-neutral-700 font-bold">{selectedResForRefund.fechaEntrada}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-450 block">Monto Total Reserva:</span>
                    <strong className="text-neutral-700 font-bold">${selectedResForRefund.total} USD</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 text-[11px]">
                  <div>
                    <span className="text-neutral-450 block">Monto Abonado:</span>
                    <strong className="text-emerald-700 font-bold">${montoAbonado} USD</strong>
                  </div>
                  <div>
                    <span className="text-neutral-450 block">Saldo Pendiente:</span>
                    <strong className="text-red-600 font-bold">${selectedResForRefund.montoPendiente !== undefined ? selectedResForRefund.montoPendiente : 0} USD</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 text-[11px]">
                  <div>
                    <span className="text-neutral-450 block">Fecha Solicitud:</span>
                    <strong className="text-neutral-700 font-bold">{simulatedRequestDate}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-450 block">Días de Anticipación:</span>
                    <strong className="text-neutral-700 font-bold">{days} {days === 1 ? 'día' : 'días'}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl border space-y-1 bg-neutral-50">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block font-mono">Diagnóstico del Reembolso:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${diag.color} inline-block`}>
                    {diag.label}
                  </span>
                  <p className="text-[10.5px] text-neutral-600 font-sans mt-1">
                    {diag.desc}
                  </p>
                  {selectedResForRefund.estado !== 'pendiente' && diag.percent > 0 && (
                    <div className="text-[11px] font-bold text-neutral-850 pt-1 border-t border-neutral-200 mt-2 flex justify-between">
                      <span>Monto a Reembolsar:</span>
                      <span className="text-teal-600 font-extrabold">${refundAmount} USD ({diag.percent}%)</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-500 block mb-1">
                    Nota o Justificación interna de cancelación (Requerido):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Escriba aquí los detalles del reembolso o por qué se solicita la cancelación..."
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-800"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateReservationStatus) {
                      let calcMessage = "";
                      if (selectedResForRefund.estado === 'pendiente') {
                        calcMessage = `Cancelación directa sin cobro (Reserva estaba Pendiente de Pago). Nota: ${refundNote}`;
                      } else {
                        const pagadoTotal = selectedResForRefund.montoPendiente !== undefined ? (selectedResForRefund.montoPendiente === 0) : (montoAbonado >= selectedResForRefund.total);
                        if (!pagadoTotal) {
                          calcMessage = `Cancelación con pago parcial (20% seña). No aplica reembolso. Nota: ${refundNote}`;
                        } else {
                          calcMessage = `Cancelación con ${days} días de anticipación. Reembolso calculado del ${diag.percent}% ($${refundAmount} USD) sobre lo abonado ($${montoAbonado} USD). Nota: ${refundNote}`;
                        }
                      }
                      onUpdateReservationStatus(
                        selectedResForRefund.id,
                        'cancelada',
                        activeUser.nombre,
                        activeUser.rol,
                        calcMessage
                      );
                      alert("✅ Cancelación y diagnóstico de reembolso procesado con éxito.");
                      setShowRefundModal(false);
                      setSelectedResForRefund(null);
                    }
                  }}
                  disabled={!refundNote.trim()}
                  className="w-1/2 px-4 py-2 bg-[#0E2A47] hover:bg-[#1a3d60] text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  Confirmar Procesamiento
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📈 GESTIÓN DE TARIFAS Y VARIACIONES DE PRECIOS MODAL */}
      {showVariationsModal && selectedRoomForVariations && (
        <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in text-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-150 flex flex-col">
            
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-2xl">
              <div>
                <h4 className="font-bold text-neutral-850 text-sm flex items-center gap-1.5 pt-1.5">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  Precios Variables por Fechas y Fines de Semana
                </h4>
                <p className="text-[11px] text-neutral-400">Habitación #{selectedRoomForVariations.numero} - {selectedRoomForVariations.nombre}</p>
              </div>
              <button 
                onClick={() => {
                  setShowVariationsModal(false);
                  setSelectedRoomForVariations(null);
                }} 
                className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* RESUMEN PRECIO BASE */}
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-wider font-sans">TARIFA ESTÁNDAR BASE</span>
                  <span className="text-xs text-neutral-600 italic">Precio base establecido por la administración de la suite</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg font-bold text-teal-850">${selectedRoomForVariations.precio} USD</span>
                  <span className="text-[9px] text-neutral-400 block font-mono">por noche</span>
                </div>
              </div>

              {/* LIST OF CURRENT VARIATIONS */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-neutral-700 block">Reglas de Variación de Tarifas Activas:</span>
                
                {roomPriceVariations.filter(v => v.roomId === selectedRoomForVariations.id).length === 0 ? (
                  <div className="bg-yellow-50/50 rounded-xl p-4 text-center border border-dashed border-yellow-250 text-neutral-500 text-[11px] italic">
                    Sin tarifas variables configuradas. La habitación cobrará siempre la tarifa base estándar (${selectedRoomForVariations.precio} USD).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {roomPriceVariations
                      .filter(v => v.roomId === selectedRoomForVariations.id)
                      .map(variation => (
                        <div key={variation.id} className="bg-white p-3 rounded-xl border border-neutral-200 flex justify-between items-center gap-3 hover:bg-neutral-50 shrink-0">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {variation.isWeekend ? (
                                <span className="bg-purple-50 text-purple-750 border border-purple-150 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono">
                                  Fines de Semana (Sáb/Dom/Vie)
                                </span>
                              ) : (
                                <span className="bg-blue-50 text-blue-750 border border-blue-150 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono flex items-center gap-1">
                                  <span>{variation.fecha}</span>
                                  {variation.isAlways && (
                                    <span className="bg-teal-100 text-teal-800 px-1 py-0.2 rounded-full text-[7.5px] font-extrabold uppercase">🔁 Anual</span>
                                  )}
                                </span>
                              )}
                              <span className="text-xs font-mono font-bold text-neutral-850">${variation.precio} USD</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5 italic">"Motivo: {variation.motivo || 'Variación por fecha especial'}"</p>
                          </div>

                          <button
                            onClick={() => {
                              if (onDeleteRoomPriceVariation) {
                                onDeleteRoomPriceVariation(variation.id);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* FORM TO ADD NEW VARIATION RATE */}
              <div className="bg-neutral-50/70 p-4 rounded-xl border border-dashed border-neutral-250 space-y-3.5">
                <span className="text-xs font-bold text-neutral-850 flex items-center gap-1">
                  <Plus className="w-4 h-4 text-teal-600" />
                  Agregar Nueva Tarifa de Variación
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Tipo de Regla:</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-neutral-700">
                        <input
                          type="radio"
                          name="ruleType"
                          checked={!newVarIsWeekend}
                          onChange={() => setNewVarIsWeekend(false)}
                          className="accent-teal-600"
                        />
                        <span>Fecha Específica (Holidays/Festivos)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-neutral-700">
                        <input
                          type="radio"
                          name="ruleType"
                          checked={newVarIsWeekend}
                          onChange={() => setNewVarIsWeekend(true)}
                          className="accent-teal-600"
                        />
                        <span>Fin de Semana</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Precio Por Noche (USD):</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={newVarPrice}
                      onChange={(e) => setNewVarPrice(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full border border-neutral-250 bg-white p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-neutral-800 font-mono font-extrabold"
                    />
                  </div>

                  {!newVarIsWeekend ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Añadir Fecha de la Regla:</label>
                        <input
                          type="date"
                          value={newVarDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewVarDate(val);
                            if (val && !newVarDates.includes(val)) {
                              setNewVarDates(prev => [...prev, val].sort());
                              setNewVarDate(''); // Clear so they can select another date seamlessly
                            }
                          }}
                          className="w-full border border-neutral-250 bg-white p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs font-mono text-neutral-800 cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1 text-neutral-400">Fecha de Aplicación:</label>
                      <input
                        type="text"
                        disabled
                        value="Fin de Semana (Vie, Sáb, Dom)"
                        className="w-full border border-neutral-100 bg-neutral-100/50 p-2 rounded-lg text-xs text-neutral-450 italic cursor-not-allowed font-medium"
                      />
                    </div>
                  )}

                  {!newVarIsWeekend && (
                    <div className="col-span-2 flex items-center justify-between bg-teal-50/40 p-2.5 rounded-lg border border-teal-100">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-teal-900 block font-sans">Repetir Anualmente ("Siempre")</span>
                        <span className="text-[9px] text-neutral-450 block font-medium">Si se marca, aplica todos los años para el mismo día y mes (ej. Navidad, Carnavales).</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newVarIsAlways}
                          onChange={(e) => setNewVarIsAlways(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-teal-600"></div>
                        <span className="ml-2 text-[10px] font-bold text-neutral-700">
                          {newVarIsAlways ? 'Siempre' : 'Solo una vez'}
                        </span>
                      </label>
                    </div>
                  )}

                  {!newVarIsWeekend && (
                    <div className="col-span-2 space-y-1 bg-neutral-100/45 p-2 rounded-lg border border-neutral-200/60">
                      <label className="text-[9px] font-extrabold text-neutral-500 uppercase tracking-wider block">
                        Días Seleccionados ({newVarDates.length}):
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {newVarDates.length === 0 ? (
                          <span className="text-[10px] text-neutral-400 italic">Por favor, seleccione uno o varios días arriba.</span>
                        ) : (
                          newVarDates.map(date => (
                            <span key={date} className="bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded border border-teal-200 text-[10px] flex items-center gap-1">
                              {date}
                              <button
                                type="button"
                                onClick={() => setNewVarDates(prev => prev.filter(d => d !== date))}
                                className="text-teal-500 hover:text-teal-800 font-bold ml-1 cursor-pointer text-xs focus:outline-none"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Motivo / Temporada Especial:</label>
                    <input
                      type="text"
                      required
                      placeholder={newVarIsWeekend ? "Ej: Recargo por fin de semana" : "Ej: Temporada alta Navidad"}
                      value={newVarMotivo}
                      onChange={(e) => setNewVarMotivo(e.target.value)}
                      className="w-full border border-neutral-250 bg-white p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-neutral-800"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!newVarPrice || newVarPrice <= 0) {
                      alert("⚠️ Alerta: El precio especial es requerido y debe ser mayor a 0.");
                      return;
                    }
                    if (!newVarIsWeekend && newVarDates.length === 0) {
                      alert("⚠️ Alerta: La fecha de aplicación es requerida. Por favor, seleccione al menos un día en el selector.");
                      return;
                    }
                    if (!newVarMotivo.trim()) {
                      alert("⚠️ Alerta: El motivo o temporada especial es requerido.");
                      return;
                    }

                    if (onSaveRoomPriceVariation && selectedRoomForVariations) {
                      if (newVarIsWeekend) {
                        const newVar: RoomPriceVariation = {
                          id: `VAR-WKEN-${selectedRoomForVariations.id}`,
                          roomId: selectedRoomForVariations.id,
                          hotelId: selectedRoomForVariations.hotelId,
                          fecha: undefined,
                          isWeekend: true,
                          precio: newVarPrice,
                          motivo: newVarMotivo
                        };
                        onSaveRoomPriceVariation(newVar);
                      } else {
                        newVarDates.forEach(date => {
                          const newVar: RoomPriceVariation = {
                            id: `VAR-DATE-${selectedRoomForVariations.id}-${date}`,
                            roomId: selectedRoomForVariations.id,
                            hotelId: selectedRoomForVariations.hotelId,
                            fecha: date,
                            isWeekend: false,
                            precio: newVarPrice,
                            motivo: newVarMotivo,
                            isAlways: newVarIsAlways
                          };
                          onSaveRoomPriceVariation(newVar);
                        });
                      }
                      
                      // Refresh inputs safely
                      setNewVarDate('');
                      setNewVarDates([]);
                      setNewVarMotivo('');
                      setNewVarIsAlways(false);
                    }
                  }}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[11px] block transition-colors cursor-pointer text-center md:font-extrabold uppercase tracking-wide"
                >
                  Establecer Precio Variable
                </button>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex bg-neutral-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  setShowVariationsModal(false);
                  setSelectedRoomForVariations(null);
                }}
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white font-bold rounded-xl text-xs cursor-pointer text-center transition-colors shadow"
              >
                Cerrar Panel de Tarifas
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
