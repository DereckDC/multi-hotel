/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel, Room, User, Reservation, RoomStatus, UserRole } from '../types';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { Plus, Edit3, Trash2, Shield, Users, HotelIcon, List, LayoutDashboard, Calendar, DollarSign, Percent, TrendingUp, AlertCircle, MapPin, EyeOff, ClipboardList, ToggleLeft, ToggleRight, Check, X } from 'lucide-react';

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
  onToggleUserStatus: (userId: string) => void;
  statistics: any;
  onUpdateRoomStatus?: (roomId: string, status: RoomStatus, staffName?: string, staffRole?: string, changeMessage?: string) => void;
  onUpdateReservationStatus?: (resId: string, status: any, staffName?: string, staffRole?: string, changeMessage?: string) => void;
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
  onToggleUserStatus,
  statistics,
  onUpdateRoomStatus,
  onUpdateReservationStatus
}: AdminViewProps) {
  // Navigation tabs within Admin: 'dashboard' | 'hotels' | 'rooms' | 'users' | 'logs' | 'reservations'
  const [adminTab, setAdminTab] = useState<'dashboard' | 'hotels' | 'rooms' | 'users' | 'logs' | 'reservations'>('dashboard');

  // RBAC Access Control checking
  const isSuper = activeUser.rol === 'super_admin';
  const myHotelId = activeUser.hotelId || '';

  // Limit access vectors
  const allowedHotels = isSuper 
    ? hotels 
    : hotels.filter(h => h.id === myHotelId);

  const allowedRooms = isSuper 
    ? rooms 
    : rooms.filter(r => r.hotelId === myHotelId);

  const allowedReservations = isSuper 
    ? reservations 
    : reservations.filter(res => res.hotelId === myHotelId);

  const allowedUsers = isSuper
    ? users
    : users.filter(u => {
        if (u.id === activeUser.id) return true;
        if (u.hotelId === myHotelId) return true;
        // Include guests with reservations in my hotel
        const isGuestOfMine = reservations.some(res => res.hotelId === myHotelId && res.guestId === u.id);
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
    isSuper ? '' : myHotelId
  );

  // CRUD Hotel State
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [showHotelModal, setShowHotelModal] = useState(false);

  // CRUD Room State
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);

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
  const [showResStatusModal, setShowResStatusModal] = useState(false);
  const [newResStatus, setNewResStatus] = useState<any>(null);
  const [statusChangeMessage, setStatusChangeMessage] = useState("");

  // Calculate reservations for the "Reservas" tab
  const getFilteredReservations = () => {
    // 1. Filter by role boundary
    const baseReservations = isSuper 
      ? reservations 
      : reservations.filter(res => res.hotelId === myHotelId);

    // 2. Filter by search & dropdown parameters
    return baseReservations.filter(res => {
      // Filter by Hotel selector if isSuper and not 'todos'
      if (isSuper && resHotelFilter !== 'todos' && res.hotelId !== resHotelFilter) {
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

  // Stats recalculations based on localized filter and role boundary
  const getFilteredStats = () => {
    // Standard hotel admin is strictly locked to their single hotel's stats
    const selectedFilterId = isSuper ? dashboardHotelFilter : myHotelId;

    if (!selectedFilterId) {
      // Super admin can see absolute consolidated stats of every hotel
      return statistics;
    }

    const filteredReservations = reservations.filter(r => r.hotelId === selectedFilterId);
    const filteredRooms = rooms.filter(r => r.hotelId === selectedFilterId);

    const totalIngresos = filteredReservations
      .filter(r => r.estado !== 'cancelada')
      .reduce((sum, r) => sum + r.total, 0);

    const habOcupadas = filteredRooms.filter(r => r.estado === 'ocupado').length;
    const habDisponibles = filteredRooms.filter(r => r.estado === 'disponible').length;
    const habMantenimiento = filteredRooms.filter(r => r.estado === 'mantenimiento').length;
    const habReservadas = filteredRooms.filter(r => r.estado === 'reservado').length;

    const ocupacionPorcentaje = filteredRooms.length > 0
      ? Math.round((habOcupadas / filteredRooms.length) * 100)
      : 0;

    // Distributing breakdown
    const filteredBreakdown = statistics.ingresosPorHotel.filter((item: any) => {
      const parentH = hotels.find(h => h.id === selectedFilterId);
      return parentH && item.name === parentH.nombre;
    });

    // Frequent clients matching reservations in my hotel
    const guestsInMyHotel = statistics.clientesFrecuentes.filter((client: any) =>
      reservations.some(res => res.hotelId === selectedFilterId && res.guestId === client.id)
    );

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
      ingresosPorHotel: filteredBreakdown,
      statusPie: [
        { name: 'Ocupadas', value: habOcupadas, color: '#f59e0b' },
        { name: 'Disponibles', value: habDisponibles, color: '#10b981' },
        { name: 'En Mantenimiento', value: habMantenimiento, color: '#ef4444' },
        { name: 'Reservadas', value: habReservadas, color: '#3b82f6' }
      ],
      clientesFrecuentes: guestsInMyHotel.length > 0 ? guestsInMyHotel : statistics.clientesFrecuentes.slice(0, 3)
    };
  };

  const currentStats = getFilteredStats();

  // Handle Hotel Save submit form
  const handleHotelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;
    onSaveHotel(editingHotel);
    setShowHotelModal(false);
    setEditingHotel(null);
  };

  // Handle Room Save submit form
  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    
    // If room status changed, call the dedicated hook to alert active guests and create logs
    if (originalRoomStatus && editingRoom.estado !== originalRoomStatus && onUpdateRoomStatus) {
      onUpdateRoomStatus(editingRoom.id, editingRoom.estado, activeUser.nombre, activeUser.rol, roomStatusChangeReason);
    }

    onSaveRoom(editingRoom);
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
      estado: 'activo'
    });
    setShowHotelModal(true);
  };

  // Quick initiate creation of new room
  const startCreateRoom = () => {
    setEditingRoom({
      id: `room-${Date.now()}`,
      hotelId: allowedHotels[0]?.id || '',
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* ADMIN CONTROL PANEL HEADER & TABS NAVIGATION */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            <h3 className="text-xl font-bold text-neutral-800">Panel de Control General</h3>
            {activeUser.rol === 'super_admin' ? (
              <span className="text-[10px] bg-red-50 text-red-800 font-bold border border-red-200 px-2 py-0.5 rounded uppercase uppercase ml-2">SUPER-ADMINISTRADOR</span>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-800 font-bold border border-amber-200 px-2 py-0.5 rounded uppercase uppercase ml-2">ADMIN-HOTEL</span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">Gestión unificada de múltiples establecimientos, control operativo, estadísticas y auditoría del sistema.</p>
        </div>

        {/* TABS SELECTORS */}
        <div className="flex flex-wrap gap-1.5 border border-neutral-100 p-1 rounded-xl bg-neutral-50/50">
          <button
            onClick={() => setAdminTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              adminTab === 'dashboard' ? 'bg-neutral-900 text-white shadow' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setAdminTab('hotels')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              adminTab === 'hotels' ? 'bg-neutral-900 text-white shadow' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <HotelIcon className="w-4 h-4" />
            <span>Hoteles</span>
          </button>
          <button
            onClick={() => setAdminTab('rooms')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              adminTab === 'rooms' ? 'bg-neutral-900 text-white shadow' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Habitaciones</span>
          </button>
          <button
            onClick={() => setAdminTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              adminTab === 'users' ? 'bg-neutral-900 text-white shadow' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios (RBAC)</span>
          </button>
          <button
            onClick={() => setAdminTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              adminTab === 'logs' ? 'bg-neutral-900 text-white shadow' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>AuditoríaLogs</span>
          </button>
          <button
            onClick={() => setAdminTab('reservations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              adminTab === 'reservations' ? 'bg-neutral-900 text-white shadow' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Reservas</span>
          </button>
        </div>
      </div>

      {/* MAIN ADMIN GRAPHICS DASHBOARD TAB */}
      {adminTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Dashboard top controls: Hotel localized filter */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h4 className="font-semibold text-lg text-neutral-800">Métricas Consolidadas en Tiempo Real</h4>
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-neutral-250 text-xs text-neutral-500">
              <span>Filtrar análisis por Establecimiento:</span>
              <select
                value={dashboardHotelFilter}
                disabled={!isSuper}
                onChange={(e) => setDashboardHotelFilter(e.target.value)}
                className="font-bold border-none text-neutral-800 focus:outline-none focus:ring-0 cursor-pointer bg-transparent disabled:opacity-80"
              >
                {isSuper && <option value="">Todos los hoteles</option>}
                {allowedHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.nombre}</option>
                ))}
              </select>
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
                <span className="font-mono text-xl md:text-2xl font-bold text-neutral-900">{currentStats.ocupacionActual || currentStats.ocupacionPorcentaje}%</span>
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
                  <PieChart>
                    <Pie
                      data={currentStats.statusPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {currentStats.statusPie.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Cuentas']} />
                  </PieChart>
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
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm">
            <h5 className="font-semibold text-neutral-800 text-sm mb-4">Registro Histórico de Huéspedes Frecuentes</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-500">
                <thead>
                  <tr className="border-b border-neutral-150 pb-2 text-neutral-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5">Huésped</th>
                    <th className="py-2.5">E-mail</th>
                    <th className="py-2.5 text-center">N° Reservaciones</th>
                    <th className="py-2.5 text-right">Preferencia Devolución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {currentStats.clientesFrecuentes.map((cli: any, index: number) => (
                    <tr key={index}>
                      <td className="py-3 font-semibold text-neutral-850 flex items-center gap-2">
                        <img src={cli.avatar} alt="Avatar guest" className="w-8 h-8 rounded-full border border-neutral-200" />
                        <span>{cli.nombre}</span>
                      </td>
                      <td className="py-3 font-mono">{cli.email}</td>
                      <td className="py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-bold font-mono">
                          {cli.reservas} veces
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">VIP Preferencial</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* CRUD HOTEL MANAGEMENT */}
      {adminTab === 'hotels' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-neutral-50 p-4 rounded-2xl border border-neutral-100 font-sans">
            <div>
              <h4 className="font-semibold text-neutral-800">Directorio de Hoteles Disponibles ({allowedHotels.length})</h4>
              <p className="text-xs text-neutral-400">
                {isSuper 
                  ? 'Agregue, deshabilite o modifique las credenciales públicas de cada establecimiento.'
                  : 'Modifique las credenciales o información de contacto de su hotel enlazado.'
                }
              </p>
            </div>
            {isSuper && (
              <button
                onClick={startCreateHotel}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition-transform cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Hotel</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allowedHotels.map(h => (
              <div key={h.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    <img src={h.logo} alt="brand logo" className="w-12 h-12 object-cover rounded-xl border border-neutral-200 shrink-0" />
                    <div>
                      <h5 className="font-semibold text-neutral-800 text-base">{h.nombre}</h5>
                      <span className={`inline-block text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${h.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {h.estado}
                      </span>
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
                      title="Editar Ficha del Hotel"
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
                          title="Eliminar Hotel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                <p className="text-xs text-neutral-500 leading-normal line-clamp-3">{h.descripcion}</p>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-500 pt-3 border-t border-neutral-100">
                  <div>
                    <span className="text-neutral-400 font-medium">Ubicación:</span>
                    <p className="truncate block font-semibold">{h.ubicacion}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400 font-medium">Habitaciones:</span>
                    <p className="font-semibold text-neutral-800">{rooms.filter(r => r.hotelId === h.id).length} suites configuradas</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* CRUD INTERNAL ROOMS */}
      {adminTab === 'rooms' && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="flex justify-between items-center bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <div>
              <h4 className="font-semibold text-neutral-800">Catálogo Operativo de Habitaciones Centralizado ({allowedRooms.length})</h4>
              <p className="text-xs text-neutral-400">Ajuste estructuralmente capacidades, asignaciones de cama, nombres y precios de suites.</p>
            </div>
            <button
              onClick={startCreateRoom}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition-transform cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Habitación</span>
            </button>
          </div>

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
                        <span className="text-[10px] text-neutral-400 font-normal">Hotel: {h?.nombre || 'hotel'}</span>
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
                          setEditingRoom({ ...room });
                          setOriginalRoomStatus(room.estado);
                          setRoomStatusChangeReason("");
                          setShowRoomModal(true);
                        }}
                        className="p-1 px-1.5 hover:bg-neutral-100 rounded text-neutral-500 cursor-pointer"
                      >
                        Editar
                      </button>
                      {confirmDeleteRoomId === room.id ? (
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
                    <th className="py-3 px-4 text-right">Acción Rol</th>
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
                          ) : (
                            <select
                              value={u.hotelId || ''}
                              onChange={(e) => onUpdateUserHotel(u.id, e.target.value || undefined)}
                              className="bg-white border border-neutral-200 rounded text-[10px] font-semibold py-1 px-1.5 focus:outline-none cursor-pointer"
                            >
                              <option value="">Ninguno / Libre</option>
                              {hotels.map(h => (
                                <option key={h.id} value={h.id}>{h.nombre}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <select
                            value={u.rol}
                            disabled={isSelf} // Self prevention to avoid self lockout!
                            onChange={(e) => onUpdateUserRole(u.id, e.target.value as UserRole)}
                            className="bg-white border border-neutral-200 rounded text-[10px] font-semibold py-1 px-1.5 focus:outline-none cursor-pointer disabled:bg-neutral-100 disabled:cursor-not-allowed"
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="hotel_admin">Hotel Admin</option>
                            <option value="recepcionista">Recepcionista</option>
                            <option value="cliente">Cliente</option>
                          </select>
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
          <div>
            <h4 className="font-semibold text-neutral-800">Canal de Auditoría en Vivo (Activity Logs)</h4>
            <p className="text-xs text-neutral-400">Supervisión en tiempo real de transacciones de bases de datos, inicio de sesión y validación de Check-Ins.</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm max-h-96 overflow-y-auto space-y-3 font-mono text-xs">
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

            {isSuper && (
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1 font-mono">Filtrar por Hotel Destino:</label>
                <select
                  value={resHotelFilter}
                  onChange={(e) => setResHotelFilter(e.target.value)}
                  className="w-full text-xs border border-neutral-250 p-2.5 rounded-lg bg-white focus:outline-none cursor-pointer"
                >
                  <option value="todos">Todos los Hoteles</option>
                  {hotels.map(h => (
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
                          <td className="p-4 font-mono font-bold text-neutral-800">
                            {res.id}
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="font-semibold text-neutral-900 block">
                              {guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped Registrado'}
                            </span>
                            <span className="text-[10px] text-neutral-400 block font-mono">Email: {guest?.email || 'N/D'}</span>
                            <span className="text-[10px] text-neutral-400 block font-mono">Doc: {guest?.documento || 'N/D'}</span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="font-semibold text-neutral-800 block">{hotelInfo?.nombre || 'Establecimiento Aura'}</span>
                            <span className="text-[11px] text-teal-700 font-medium block">Suite N° {roomInfo?.numero || 'S/N'} ({roomInfo?.nombre})</span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="block font-medium text-neutral-700">{res.fechaEntrada} ➜ {res.fechaSalida}</span>
                            <span className="block text-[10px] font-mono font-bold text-neutral-500 flex flex-col">
                              <span>Monto: ${res.total?.toFixed(2) || '0.00'} USD</span>
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


      {/* CRUD MODAL: ADD / EDIT HOTEL */}
      {showHotelModal && editingHotel && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-100 flex flex-col">
            
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-2xl">
              <h4 className="font-semibold text-neutral-850">Administrar Ficha del Hotel</h4>
              <button onClick={() => setShowHotelModal(false)} className="p-1 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleHotelSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Nombre Comercial del Hotel:</label>
                  <input
                    type="text" required
                    value={editingHotel.nombre}
                    onChange={(e) => setEditingHotel({ ...editingHotel, nombre: e.target.value })}
                    placeholder="Ej: Aura Sunset Coast Resort"
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
                  <label className="text-[11px] font-semibold text-neutral-500 block">Ubicación Física (Dirección):</label>
                  <input
                    type="text" required
                    value={editingHotel.ubicacion}
                    onChange={(e) => setEditingHotel({ ...editingHotel, ubicacion: e.target.value })}
                    placeholder="Ej: Calle de Hortaleza 22, Madrid, España"
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
                    <option value="activo">Activo (Visible en Landing Page)</option>
                    <option value="inactivo">Inactivo / Cerrado Temporalmente</option>
                  </select>
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
                    value={editingRoom.hotelId}
                    onChange={(e) => setEditingRoom({ ...editingRoom, hotelId: e.target.value })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg bg-white focus:outline-none cursor-pointer"
                  >
                    {allowedHotels.map(h => (
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
                    value={editingRoom.precio}
                    onChange={(e) => setEditingRoom({ ...editingRoom, precio: parseInt(e.target.value) })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Capacidad (Personas):</label>
                  <input
                    type="number" required
                    value={editingRoom.capacidad}
                    onChange={(e) => setEditingRoom({ ...editingRoom, capacidad: parseInt(e.target.value) })}
                    className="w-full text-xs border border-neutral-250 p-2 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Cantidad de camas:</label>
                  <input
                    type="number" required
                    value={editingRoom.camas}
                    onChange={(e) => setEditingRoom({ ...editingRoom, camas: parseInt(e.target.value) })}
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

    </div>
  );
}
