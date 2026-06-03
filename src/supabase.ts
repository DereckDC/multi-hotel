/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Hotel, Room, User, Reservation } from './types';
import { ActivityLog } from './store';

// Hardcoded fallback credentials as explicitly provided by the user for perfect immediate out-of-the-box operation
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://zsncctegjwzqssjzobtn.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzbmNjdGVnand6cXNzanpvYnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDgzNzcsImV4cCI6MjA5NTQ4NDM3N30.QXdAjhRb73clYVQdgfjf3PxLkb3Z4GuSxxzic-y21ZI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * SQL Schema script to create the necessary tables in the Supabase SQL Editor.
 * This is displayed in the UI to guide the user in setting up their Supabase database.
 */
export const SUPABASE_SQL_SCHEMA = `-- ROOMIA SAAS - SUPABASE COMPLETE SCHEMA SETUP & SEED DATA
-- Copia y pega este script completo en el SQL Editor de tu consola de Supabase.
-- Advertencia: Esto recreará las tablas de forma limpia.

-- 0. Limpieza previa de tablas (opcional pero recomendado para reconfiguraciones)
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;

-- 1. Tabla de Hoteles
CREATE TABLE public.hotels (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  logo TEXT,
  portada TEXT,
  imagenes TEXT[], -- Array de URLs de imágenes
  descripcion TEXT,
  ubicacion TEXT,
  coordenadas JSONB, -- { "lat": Float, "lng": Float }
  googleMapsUrl TEXT,
  servicios TEXT[],
  politicas TEXT[],
  horarios JSONB DEFAULT '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb,
  contacto JSONB, -- { "telefono": TEXT, "email": TEXT, "web": TEXT }
  redesSociales JSONB, -- { "facebook": TEXT, "instagram": TEXT, "twitter": TEXT }
  estado TEXT DEFAULT 'activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS y definir políticas generales para producción segura
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en hotels" ON public.hotels;
CREATE POLICY "Permitir todo a public en hotels" ON public.hotels FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabla de Habitaciones
CREATE TABLE public.rooms (
  id TEXT PRIMARY KEY,
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC NOT NULL,
  capacidad INTEGER NOT NULL,
  camas INTEGER NOT NULL DEFAULT 1,
  tipo TEXT NOT NULL, -- 'Estándar' | 'Doble' | 'Triple' | 'Suite' | 'Suite Presidencial'
  imagenes TEXT[],
  servicios TEXT[],
  estado TEXT NOT NULL DEFAULT 'disponible',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en rooms" ON public.rooms;
CREATE POLICY "Permitir todo a public en rooms" ON public.rooms FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabla de Usuarios
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT,
  documento TEXT, -- cédula/pasaporte
  avatar TEXT,
  rol TEXT NOT NULL DEFAULT 'cliente', -- 'super_admin' | 'hotel_admin' | 'recepcionista' | 'cliente'
  fechaRegistro TEXT,
  estado TEXT NOT NULL DEFAULT 'activo',
  password TEXT,
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE SET NULL,
  debecambiarpassword BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en users" ON public.users;
CREATE POLICY "Permitir todo a public en users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 4. Tabla de Reservaciones
CREATE TABLE public.reservations (
  id TEXT PRIMARY KEY,
  roomId TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  guestId TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  fechaEntrada TEXT NOT NULL, -- YYYY-MM-DD
  fechaSalida TEXT NOT NULL, -- YYYY-MM-DD
  serviciosAdicionales TEXT[],
  subtotal NUMERIC NOT NULL DEFAULT 0,
  impuestos NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  noches INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'confirmada', -- 'pendiente' | 'confirmada' | 'ocupada' | 'finalizada' | 'cancelada'
  qrCode TEXT,
  checkedInAt TEXT,
  checkedOutAt TEXT,
  recepcionistaId TEXT,
  notes TEXT,
  modificadoPor TEXT,
  mensajeCambio TEXT,
  fechaCambio TEXT,
  cambiadoPorId TEXT,
  eliminadaPorCliente BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en reservations" ON public.reservations;
CREATE POLICY "Permitir todo a public en reservations" ON public.reservations FOR ALL USING (true) WITH CHECK (true);

-- 5. Tabla de Bitácoras de Auditoría (Logs)
CREATE TABLE public.logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  "user" TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  detalles TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en logs" ON public.logs;
CREATE POLICY "Permitir todo a public en logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);


-- =========================================================================
--             INSERT CÓDIGOS DE SEMILLADO (INITIAL SEED DATA)
-- =========================================================================

-- Inserción de Usuario Administrativo Único para Producción
INSERT INTO public.users (id, nombre, apellido, email, telefono, documento, avatar, rol, fechaRegistro, estado, password, hotelId) VALUES
(
  'user-superadmin',
  'Dereck',
  'Cisneros',
  'destructordereck@gmail.com',
  '0998596597',
  '2450397340',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  'super_admin',
  '2026-06-03',
  'activo',
  '2450397340',
  NULL
)
ON CONFLICT (id) DO NOTHING;
`;

/**
 * Uploads/Syncs a single hotel to Supabase
 */
export function mapHotelToDb(hotel: Hotel): any {
  const contactoDb = {
    ...(hotel.contacto || {}),
    serviciosExtra: hotel.serviciosDetallados || []
  };
  return {
    id: hotel.id,
    nombre: hotel.nombre,
    logo: hotel.logo || null,
    portada: hotel.portada || null,
    imagenes: hotel.imagenes || [],
    descripcion: hotel.descripcion || '',
    ubicacion: hotel.ubicacion || '',
    coordenadas: hotel.coordenadas || { lat: 19.4273, lng: -99.1676 },
    googlemapsurl: hotel.googleMapsUrl || null,
    servicios: hotel.servicios || [],
    politicas: hotel.politicas || [],
    horarios: hotel.horarios || { checkIn: "15:00", checkOut: "12:00" },
    contacto: contactoDb,
    redessociales: hotel.redesSociales || {},
    estado: hotel.estado || 'activo'
  };
}

export function mapHotelFromDb(db: any): Hotel {
  if (!db) return db;
  const contacto = db.contacto || {};
  const serviciosDetallados = contacto.serviciosExtra || [];
  return {
    id: db.id,
    nombre: db.nombre,
    logo: db.logo || '',
    portada: db.portada || '',
    imagenes: db.imagenes || [],
    descripcion: db.descripcion || '',
    ubicacion: db.ubicacion || '',
    coordenadas: db.coordenadas || { lat: 19.4273, lng: -99.1676 },
    googleMapsUrl: db.googlemapsurl !== undefined ? db.googlemapsurl : (db.googleMapsUrl || ''),
    servicios: db.servicios || [],
    politicas: db.politicas || [],
    horarios: db.horarios || { checkIn: '15:00', checkOut: '12:00' },
    contacto: contacto,
    serviciosDetallados: serviciosDetallados,
    redesSociales: db.redessociales !== undefined ? db.redessociales : (db.redesSociales || {}),
    estado: db.estado || 'activo'
  };
}

export function mapRoomToDb(room: Room): any {
  return {
    id: room.id,
    hotelid: room.hotelId,
    numero: room.numero,
    nombre: room.nombre,
    tipo: room.tipo,
    precio: room.precio,
    capacidad: room.capacidad,
    camas: room.camas,
    estado: room.estado,
    imagenes: room.imagenes || [],
    descripcion: room.descripcion || '',
    servicios: room.servicios || []
  };
}

export function mapRoomFromDb(db: any): Room {
  if (!db) return db;
  return {
    id: db.id,
    hotelId: db.hotelid !== undefined ? db.hotelid : (db.hotelId || ''),
    numero: db.numero || '',
    nombre: db.nombre || '',
    tipo: db.tipo || 'Estándar',
    precio: Number(db.precio || 0),
    capacidad: Number(db.capacidad || 1),
    camas: Number(db.camas || 1),
    estado: db.estado || 'disponible',
    imagenes: db.imagenes || [],
    descripcion: db.descripcion || '',
    servicios: db.servicios || db.amenidades || []
  };
}

export function mapUserToDb(user: User): any {
  const isSuperAdminEmail = user.email && user.email.trim().toLowerCase() === 'destructordereck@gmail.com';
  return {
    id: user.id,
    nombre: user.nombre || 'Usuario',
    apellido: user.apellido || 'Roomia',
    email: user.email,
    telefono: user.telefono || '',
    documento: user.documento || '',
    avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: isSuperAdminEmail ? 'super_admin' : (user.rol || 'cliente'),
    fecharegistro: user.fechaRegistro || new Date().toISOString().split('T')[0],
    estado: user.estado || 'activo',
    password: isSuperAdminEmail ? '2450397340' : (user.password || ''),
    hotelid: user.hotelId || null,
    debecambiarpassword: user.debeCambiarPassword !== undefined ? user.debeCambiarPassword : false
  };
}

export function mapUserFromDb(db: any): User {
  if (!db) return db;
  const isSuperAdminEmail = db.email && db.email.trim().toLowerCase() === 'destructordereck@gmail.com';
  return {
    id: db.id,
    nombre: db.nombre || 'Usuario',
    apellido: db.apellido || 'Roomia',
    email: db.email || '',
    telefono: db.telefono || '',
    documento: db.documento || '',
    avatar: db.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: isSuperAdminEmail ? 'super_admin' : (db.rol || 'cliente'),
    fechaRegistro: db.fecharegistro !== undefined ? db.fecharegistro : (db.fechaRegistro || new Date().toISOString().split('T')[0]),
    estado: db.estado || 'activo',
    password: isSuperAdminEmail ? '2450397340' : (db.password || ''),
    hotelId: db.hotelid !== undefined ? db.hotelid : db.hotelId,
    debeCambiarPassword: db.debecambiarpassword !== undefined ? db.debecambiarpassword : false
  };
}

export function mapReservationToDb(res: Reservation): any {
  const entrada = new Date(res.fechaEntrada);
  const salida = new Date(res.fechaSalida);
  const diffTime = Math.abs(salida.getTime() - entrada.getTime());
  const nochesCalc = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  return {
    id: res.id,
    roomid: res.roomId,
    hotelid: res.hotelId,
    guestid: res.guestId,
    fechaentrada: res.fechaEntrada,
    fechasalida: res.fechaSalida,
    noches: (res as any).noches || nochesCalc,
    total: res.total,
    estado: res.estado,
    qrcode: res.qrCode || '',
    checkedinat: res.checkedInAt || null,
    checkedoutat: res.checkedOutAt || null,
    recepcionistaid: res.recepcionistaId || null,
    modificadopor: res.modificadoPor || null,
    mensajecambio: res.mensajeCambio || null,
    fechacambio: res.fechaCambio || null,
    eliminadaporcliente: res.eliminadaPorCliente === undefined ? false : res.eliminadaPorCliente,
    serviciosadicionales: res.serviciosAdicionales || [],
    subtotal: res.subtotal || 0,
    impuestos: res.impuestos || 0,
    notes: res.notas || '',
    cambiadoporid: res.cambiadoPorId || null
  };
}

export function mapReservationFromDb(db: any): Reservation {
  if (!db) return db;
  return {
    id: db.id,
    roomId: db.roomid !== undefined ? db.roomid : (db.roomId || ''),
    hotelId: db.hotelid !== undefined ? db.hotelid : (db.hotelId || ''),
    guestId: db.guestid !== undefined ? db.guestid : (db.guestId || ''),
    fechaEntrada: db.fechaentrada !== undefined ? db.fechaentrada : (db.fechaEntrada || ''),
    fechaSalida: db.fechasalida !== undefined ? db.fechasalida : (db.fechaSalida || ''),
    noches: Number(db.noches || 1),
    total: Number(db.total || 0),
    estado: db.estado || 'pendiente',
    qrCode: db.qrcode !== undefined ? db.qrcode : (db.qrCode || ''),
    checkedInAt: db.checkedinat !== undefined ? db.checkedinat : (db.checkedInAt || undefined),
    checkedOutAt: db.checkedoutat !== undefined ? db.checkedoutat : (db.checkedOutAt || undefined),
    recepcionistaId: db.recepcionistaid !== undefined ? db.recepcionistaid : (db.recepcionistaId || undefined),
    modificadoPor: db.modificadopor !== undefined ? db.modificadopor : (db.modificadoPor || undefined),
    mensajeCambio: db.mensajecambio !== undefined ? db.mensajecambio : (db.mensajeCambio || undefined),
    fechaCambio: db.fechacambio !== undefined ? db.fechacambio : (db.fechaCambio || undefined),
    eliminadaPorCliente: db.eliminadaporcliente !== undefined ? db.eliminadaporcliente : (db.eliminadaPorCliente || false),
    serviciosAdicionales: db.serviciosadicionales || db.serviciosAdicionales || [],
    subtotal: Number(db.subtotal || 0),
    impuestos: Number(db.impuestos || 0),
    notas: db.notes || db.notas || '',
    cambiadoPorId: db.cambiadoporid !== undefined ? db.cambiadoporid : (db.cambiadoPorId || undefined),
    fechaRegistro: db.fecharegistro !== undefined ? db.fecharegistro : (db.fechaRegistro || new Date().toISOString().split('T')[0])
  } as any;
}

export async function syncHotelToSupabase(hotel: Hotel): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('hotels')
      .upsert(mapHotelToDb(hotel));

    if (error) {
      console.warn('Supabase syncHotel error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single room to Supabase
 */
export async function syncRoomToSupabase(room: Room): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('rooms')
      .upsert(mapRoomToDb(room));

    if (error) {
      console.warn('Supabase syncRoom error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single user to Supabase
 */
export async function syncUserToSupabase(user: User): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = mapUserToDb(user);
    const { error } = await supabase
      .from('users')
      .upsert(payload);

    if (error) {
      console.warn('Supabase syncUser error:', error);
      
      // If error is code 42703 (undefined_column) or mentions column/debecambiarpassword
      if (error.code === '42703' || error.message?.includes('debecambiarpassword') || error.message?.includes('column')) {
        console.log('Retrying user sync without optional column "debecambiarpassword" to prevent Postgres schema errors...');
        delete payload.debecambiarpassword;
        
        const { error: retryErr } = await supabase
          .from('users')
          .upsert(payload);
          
        if (retryErr) {
          console.warn('Retry syncUser also failed:', retryErr);
          return { success: false, error: retryErr.message };
        }
        return { success: true };
      }
      
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single reservation to Supabase
 */
export async function syncReservationToSupabase(res: Reservation): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reservations')
      .upsert(mapReservationToDb(res));

    if (error) {
      console.warn('Supabase syncReservation error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single audit log to Supabase
 */
export async function syncLogToSupabase(log: ActivityLog): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('logs')
      .upsert({
        id: log.id,
        timestamp: log.timestamp,
        user: log.user,
        role: log.role,
        action: log.action,
        detalles: log.detalles
      });

    if (error) {
      console.warn('Supabase syncLog error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Deletes a row in Supabase
 */
export async function deleteRowFromSupabase(table: 'hotels' | 'rooms' | 'users' | 'reservations' | 'logs', id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.warn(`Supabase delete from ${table} error:`, error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}
