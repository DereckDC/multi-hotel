/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Hotel, Room, User, Reservation, ChatMessage, PaymentTransaction, Review, RoomPriceVariation } from './types';
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
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;

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
  roomId TEXT REFERENCES public.rooms(id) ON DELETE CASCADE, -- Nullable para alquiler de casas/departamentos enteros
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
  reservation_type TEXT CHECK (reservation_type IN ('hospedaje', 'alquiler_mensual', 'venta')) DEFAULT 'hospedaje',
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


-- 6. Tabla de Mensajes de Chat (messages)
CREATE TABLE public.messages (
  id TEXT PRIMARY KEY,
  senderid TEXT NOT NULL,
  sendername TEXT NOT NULL,
  senderrole TEXT NOT NULL,
  hotelid TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en messages" ON public.messages;
CREATE POLICY "Permitir todo a public en messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);


-- 7. Tabla de Transacciones de Pago (transactions)
CREATE TABLE public.transactions (
  id TEXT PRIMARY KEY,
  reservationid TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paymentmethod TEXT NOT NULL,
  status TEXT NOT NULL, -- 'completado' | 'fallido' | 'pendiente'
  reference TEXT NOT NULL,
  fecha TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en transactions" ON public.transactions;
CREATE POLICY "Permitir todo a public en transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);


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

-- 8. Detalles complementarios de Propiedades (Casas & Departamentos)
-- Esta tabla almacena de forma estructurada y relacional los detalles de un inmueble 1:1 con hotels
CREATE TABLE IF NOT EXISTS public.property_details (
  id TEXT PRIMARY KEY,
  hotel_id TEXT UNIQUE REFERENCES public.hotels(id) ON DELETE CASCADE,
  property_type TEXT CHECK (property_type IN ('hotel', 'casa', 'departamento')),
  listing_type TEXT CHECK (listing_type IN ('alquiler', 'venta')),
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  square_meters NUMERIC DEFAULT 0,
  furnished BOOLEAN DEFAULT FALSE,
  parking BOOLEAN DEFAULT FALSE,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  owner_document TEXT,
  price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS y políticas seguras para la tabla complementaria de propiedades
ALTER TABLE public.property_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en property_details" ON public.property_details;
CREATE POLICY "Permitir todo a public en property_details" ON public.property_details FOR ALL USING (true) WITH CHECK (true);


-- 9. Tabla de Reseñas y Valoraciones (reviews)
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  reservation_id TEXT REFERENCES public.reservations(id) ON DELETE CASCADE,
  hotel_id TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  guest_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comentario TEXT,
  fecha TEXT, -- YYYY-MM-DD
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en reviews" ON public.reviews;
CREATE POLICY "Permitir todo a public en reviews" ON public.reviews FOR ALL USING (true) WITH CHECK (true);


-- 10. Tabla de Precios Variables por Fecha (room_price_variations)
CREATE TABLE IF NOT EXISTS public.room_price_variations (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  hotel_id TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  fecha TEXT, -- YYYY-MM-DD (puede ser nulo si es fin de semana recurrente)
  is_weekend BOOLEAN DEFAULT FALSE,
  precio NUMERIC NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.room_price_variations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a public en room_price_variations" ON public.room_price_variations;
CREATE POLICY "Permitir todo a public en room_price_variations" ON public.room_price_variations FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Uploads/Syncs a single hotel to Supabase
 */
export function mapHotelToDb(hotel: Hotel): any {
  const contactoDb = {
    ...(hotel.contacto || {}),
    serviciosExtra: hotel.serviciosDetallados || [],
    tipoEstablecimiento: hotel.tipoEstablecimiento || 'hotel',
    finalidad: hotel.finalidad || null,
    propietario: hotel.propietario || null,
    detallesInmueble: hotel.detallesInmueble || null
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
  const tipoEstablecimiento = contacto.tipoEstablecimiento || db.tipoEstablecimiento || 'hotel';
  const finalidad = contacto.finalidad || db.finalidad || null;
  const propietario = contacto.propietario || db.propietario || null;
  const detallesInmueble = contacto.detallesInmueble || db.detallesInmueble || null;
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
    redesSociales: db.redessociales !== undefined ? db.redesSociales : (db.redesSociales || {}),
    estado: db.estado || 'activo',
    tipoEstablecimiento: tipoEstablecimiento,
    finalidad: finalidad,
    propietario: propietario,
    detallesInmueble: detallesInmueble
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
    roomid: res.roomId || null, // Nullable para estadías completas de casas/departamentos
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
    cambiadoporid: res.cambiadoPorId || null,
    reservation_type: res.reservationType || 'hospedaje'
  };
}

export function mapReservationFromDb(db: any): Reservation {
  if (!db) return db;
  return {
    id: db.id,
    roomId: db.roomid !== undefined ? db.roomid : (db.roomId || null),
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
    fechaRegistro: db.fecharegistro !== undefined ? db.fecharegistro : (db.fechaRegistro || new Date().toISOString().split('T')[0]),
    reservationType: db.reservation_type || 'hospedaje'
  } as any;
}


/**
 * Sincroniza los detalles estructurados complementarios de una propiedad (casa/departamento)
 * en la tabla property_details de Supabase
 */
export async function syncPropertyDetailsToSupabase(hotel: Hotel): Promise<{ success: boolean; error?: string }> {
  try {
    if (!hotel.tipoEstablecimiento || hotel.tipoEstablecimiento === 'hotel') {
      return { success: true }; // No requiere property_details relacionales
    }

    const payload = {
      id: `pd_${hotel.id}`,
      hotel_id: hotel.id,
      property_type: hotel.tipoEstablecimiento,
      listing_type: hotel.finalidad || 'alquiler',
      bedrooms: hotel.detallesInmueble?.habitaciones || 0,
      bathrooms: hotel.detallesInmueble?.banos || 0,
      square_meters: hotel.detallesInmueble?.metrosCuadrados || 0,
      furnished: !!hotel.detallesInmueble?.amueblado,
      parking: !!hotel.detallesInmueble?.tieneEstacionamiento,
      owner_name: hotel.propietario?.nombre || null,
      owner_phone: hotel.propietario?.telefono || null,
      owner_email: hotel.propietario?.email || null,
      owner_document: hotel.propietario?.documento || null,
      price: hotel.detallesInmueble?.precio || 0
    };

    const { error } = await supabase
      .from('property_details')
      .upsert(payload);

    if (error) {
      console.warn('Supabase syncPropertyDetailsToSupabase error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
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
export async function deleteRowFromSupabase(table: 'hotels' | 'rooms' | 'users' | 'reservations' | 'logs' | 'messages' | 'transactions', id: string): Promise<{ success: boolean; error?: string }> {
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

export function mapChatMessageToDb(msg: ChatMessage): any {
  return {
    id: msg.id,
    senderid: msg.senderId,
    sendername: msg.senderName,
    senderrole: msg.senderRole,
    hotelid: msg.hotelId,
    text: msg.text,
    timestamp: msg.timestamp,
    read: msg.read
  };
}

export function mapChatMessageFromDb(db: any): ChatMessage {
  if (!db) return db;
  return {
    id: db.id,
    senderId: db.senderid !== undefined ? db.senderid : (db.senderId || ''),
    senderName: db.sendername !== undefined ? db.sendername : (db.senderName || ''),
    senderRole: db.senderrole !== undefined ? db.senderrole : (db.senderRole || 'cliente'),
    hotelId: db.hotelid !== undefined ? db.hotelid : (db.hotelId || ''),
    text: db.text || '',
    timestamp: db.timestamp || '',
    read: db.read !== undefined ? db.read : false
  };
}

export function mapPaymentTransactionToDb(tx: PaymentTransaction): any {
  return {
    id: tx.id,
    reservationid: tx.reservationId,
    amount: tx.amount,
    currency: tx.currency,
    paymentmethod: tx.paymentMethod,
    status: tx.status,
    reference: tx.reference,
    fecha: tx.fecha
  };
}

export function mapPaymentTransactionFromDb(db: any): PaymentTransaction {
  if (!db) return db;
  return {
    id: db.id,
    reservationId: db.reservationid !== undefined ? db.reservationid : (db.reservationId || ''),
    amount: Number(db.amount || 0),
    currency: db.currency || 'USD',
    paymentMethod: db.paymentmethod !== undefined ? db.paymentmethod : (db.paymentMethod || ''),
    status: db.status || 'completado',
    reference: db.reference || '',
    fecha: db.fecha || ''
  };
}

export async function syncChatMessageToSupabase(msg: ChatMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('messages')
      .upsert(mapChatMessageToDb(msg));
    if (error) {
      console.warn('Supabase syncChatMessage error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function syncPaymentTransactionToSupabase(tx: PaymentTransaction): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('transactions')
      .upsert(mapPaymentTransactionToDb(tx));
    if (error) {
      console.warn('Supabase syncPaymentTransaction error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Recupera todos los registros de la tabla property_details para auditoría y diagnóstico sin mutar la BD actual
 */
export async function fetchPropertyDetails(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('property_details')
      .select('*');
    if (error) {
      // Retornar error de forma controlada (p. ej. si la tabla no existe aún)
      return { success: false, error: error.message };
    }
    return { success: true, data: data };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Maps a local Review structure to its Database payload equivalent
 */
export function mapReviewToDb(review: Review): any {
  return {
    id: review.id,
    reservation_id: review.reservationId,
    hotel_id: review.hotelId,
    guest_id: review.guestId,
    rating: review.rating,
    comentario: review.comentario,
    fecha: review.fecha
  };
}

/**
 * Maps a Database review row to its application Review structure
 */
export function mapReviewFromDb(db: any): Review {
  if (!db) return db;
  return {
    id: db.id,
    reservationId: db.reservation_id !== undefined ? db.reservation_id : (db.reservationId || ''),
    hotelId: db.hotel_id !== undefined ? db.hotel_id : (db.hotelId || ''),
    guestId: db.guest_id !== undefined ? db.guest_id : (db.guestId || ''),
    rating: Number(db.rating || 0),
    comentario: db.comentario || '',
    fecha: db.fecha || ''
  };
}

/**
 * Uploads/Syncs a single Review to the Supabase database
 */
export async function syncReviewToSupabase(review: Review): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reviews')
      .upsert(mapReviewToDb(review));

    if (error) {
      console.warn('Supabase syncReview error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Maps a local RoomPriceVariation structure to its Database payload equivalent
 */
export function mapRoomPriceVariationToDb(v: RoomPriceVariation): any {
  return {
    id: v.id,
    room_id: v.roomId,
    hotel_id: v.hotelId,
    fecha: v.fecha || null,
    is_weekend: v.isWeekend,
    precio: v.precio,
    motivo: v.motivo || ''
  };
}

/**
 * Maps a Database row to its application RoomPriceVariation structure
 */
export function mapRoomPriceVariationFromDb(db: any): RoomPriceVariation {
  if (!db) return db;
  return {
    id: db.id,
    roomId: db.room_id !== undefined ? db.room_id : (db.roomId || ''),
    hotelId: db.hotel_id !== undefined ? db.hotel_id : (db.hotelId || ''),
    fecha: db.fecha || null,
    isWeekend: db.is_weekend !== undefined ? db.is_weekend : (db.isWeekend || false),
    precio: Number(db.precio || 0),
    motivo: db.motivo || ''
  };
}

/**
 * Syncs/Upserts a single RoomPriceVariation to Supabase
 */
export async function syncRoomPriceVariationToSupabase(v: RoomPriceVariation): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('room_price_variations')
      .upsert(mapRoomPriceVariationToDb(v));

    if (error) {
      console.warn('Supabase syncRoomPriceVariation error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Deletes a single RoomPriceVariation from Supabase
 */
export async function deleteRoomPriceVariationFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('room_price_variations')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase deleteRoomPriceVariation error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

