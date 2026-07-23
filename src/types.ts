/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'super_admin' | 'hotel_admin' | 'recepcionista' | 'cliente';

export type RoomStatus = 'disponible' | 'reservado' | 'ocupado' | 'mantenimiento';

export type ReservationStatus = 'pendiente' | 'confirmada' | 'ocupada' | 'finalizada' | 'cancelada';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documento: string; // cédula/pasaporte
  avatar: string;
  rol: UserRole;
  fechaRegistro: string;
  estado: 'activo' | 'inactivo';
  hotelId?: string; // If hotel_admin or receptionist is assigned to a specific hotel
  hotelIds?: string[]; // Multiple hotels for hotel_admin
  password?: string; // Optional classic login password
  debeCambiarPassword?: boolean;
}

export interface Hotel {
  id: string;
  nombre: string;
  logo: string;
  portada: string;
  imagenes: string[];
  descripcion: string;
  ubicacion: string;
  coordenadas: {
    lat: number;
    lng: number;
  };
  googleMapsUrl?: string;
  servicios: string[];
  politicas: string[];
  horarios: {
    checkIn: string;
    checkOut: string;
  };
  provincia?: string;
  ciudad?: string;
  parroquia?: string;
  contacto: {
    telefono: string;
    email: string;
    web?: string;
    provincia?: string;
    ciudad?: string;
    parroquia?: string;
  };
  redesSociales: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  estado: 'activo' | 'inactivo';
  serviciosDetallados?: HotelService[];
  tipoEstablecimiento?: 'hotel' | 'casa' | 'departamento';
  finalidad?: 'alquiler' | 'venta';
  propietario?: {
    nombre: string;
    telefono: string;
    email: string;
    documento?: string;
  };
  detallesInmueble?: {
    habitaciones: number;
    banos: number;
    metrosCuadrados?: number;
    amueblado?: boolean;
    tieneEstacionamiento?: boolean;
    precio?: number; // Precio mensual de alquiler o valor de venta
  };
}

export interface HotelService {
  id: string;
  nombre: string;
  precio: number;
  descripcion: string;
  estado: 'activo' | 'inactivo';
  emoji?: string;
  tipoCobro?: 'por_estadia' | 'por_dia';
}

export interface ReservationServiceSelection {
  id: string;
  nombre: string;
  precio: number;
  personas: number;
  total: number;
}

export interface Room {
  id: string;
  hotelId: string;
  numero: string;
  nombre: string;
  descripcion: string;
  precio: number;
  capacidad: number;
  camas: number;
  tipo: 'Estándar' | 'Doble' | 'Triple' | 'Suite' | 'Suite Presidencial';
  imagenes: string[];
  servicios: string[];
  estado: RoomStatus;
  adicionarIva?: boolean; // If false, the price already includes IVA and no extra tax is added
}

export interface Reservation {
  id: string;
  hotelId: string;
  roomId?: string | null;
  guestId: string;
  fechaEntrada: string; // YYYY-MM-DD
  fechaSalida: string; // YYYY-MM-DD
  serviciosAdicionales: string[];
  subtotal: number;
  impuestos: number;
  total: number;
  qrCode: string; // QR content identifier or simulated hash
  estado: ReservationStatus;
  fechaRegistro: string;
  fechaRegistroTimestamp?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  recepcionistaId?: string;
  notas?: string;
  modificadoPor?: string; // Nombre y rol de quien modificó
  mensajeCambio?: string; // Mensaje explicativo para el cliente
  fechaCambio?: string;   // Fecha de modificación
  cambiadoPorId?: string; // ID del staff
  eliminadaPorCliente?: boolean; // Si el cliente eliminó la reserva de su historial
  reservationType?: 'hospedaje' | 'alquiler_mensual' | 'venta';
  montoPagado?: number;
  montoPendiente?: number;
}

export interface MaintenanceLog {
  id: string;
  roomId: string;
  hotelId: string;
  fechaCreacion: string;
  descripcion: string;
  responsable: string;
  estado: 'pendiente' | 'completada';
}

export interface SystemStats {
  hotelStats: {
    [hotelId: string]: {
      ingresosTotales: number;
      reservasActivas: number;
      ocupacionActual: number; // percentage
    };
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  hotelId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface PaymentTransaction {
  id: string;
  reservationId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'completado' | 'fallido' | 'pendiente';
  reference: string;
  fecha: string;
}

export interface Review {
  id: string;
  reservationId: string;
  hotelId: string;
  guestId: string;
  rating: number; // 1-5
  comentario: string;
  fecha: string; // YYYY-MM-DD
  userName?: string;
  isAnonymous?: boolean;
}

export interface RoomPriceVariation {
  id: string;
  roomId: string;
  hotelId?: string;
  fecha?: string | null; // YYYY-MM-DD if date-specific, otherwise null
  isWeekend: boolean;    // true if applies to weekends (Fri & Sat nights)
  precio: number;
  motivo?: string;       // e.g. "Fin de semana", "Navidad", "Temporada Alta"
  isAlways?: boolean;    // recurrent every year (ignoring the year of the date)
}



