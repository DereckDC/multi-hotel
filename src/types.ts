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
  contacto: {
    telefono: string;
    email: string;
    web?: string;
  };
  redesSociales: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  estado: 'activo' | 'inactivo';
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
}

export interface Reservation {
  id: string;
  hotelId: string;
  roomId: string;
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
  checkedInAt?: string;
  checkedOutAt?: string;
  recepcionistaId?: string;
  notas?: string;
  modificadoPor?: string; // Nombre y rol de quien modificó
  mensajeCambio?: string; // Mensaje explicativo para el cliente
  fechaCambio?: string;   // Fecha de modificación
  cambiadoPorId?: string; // ID del staff
  eliminadaPorCliente?: boolean; // Si el cliente eliminó la reserva de su historial
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

