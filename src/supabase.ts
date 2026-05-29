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

-- Habilitar acceso de lectura público y escritura libre para desarrollo
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a anon en hotels" ON public.hotels FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Permitir todo a anon en rooms" ON public.rooms FOR ALL USING (true) WITH CHECK (true);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a anon en users" ON public.users FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Permitir todo a anon en reservations" ON public.reservations FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Permitir todo a anon en logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);


-- =========================================================================
--             INSERT CÓDIGOS DE SEMILLADO (INITIAL SEED DATA)
-- =========================================================================

-- Inserción de Hoteles Semilla
INSERT INTO public.hotels (id, nombre, logo, portada, imagenes, descripcion, ubicacion, coordenadas, googleMapsUrl, servicios, politicas, horarios, contacto, redesSociales, estado) VALUES
(
  'hotel-1',
  'Roomia Majestic Palace',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80'
  ],
  'Ubicado en el corazón de la zona colonial, Roomia Majestic Palace combina el lujo clásico europeo con un servicio boutique exclusivo. Disfrute de nuestra emblemática piscina infinita de borde de cristal, restaurante galardonado con estrella Michelin y tratamientos de spa personalizados de última generación.',
  'Paseo de la Reforma 450, Ciudad de México, México',
  '{"lat": 19.4273, "lng": -99.1676}'::jsonb,
  'https://maps.google.com/maps?q=Paseo+de+la+Reforma+450,+Ciudad+de+M%C3%A9xico',
  ARRAY['Piscina Infinita', 'Restaurante Gourmet', 'Servicio de Concierge 24/7', 'Spa de Lujo', 'Gimnasio Equipado', 'Estacionamiento Premium Valet', 'Wi-Fi de Alta Velocidad', 'Café Filtro'],
  ARRAY['Check-in: A partir de las 15:00', 'Check-out: Hasta las 12:00', 'Política de cancelación gratuita hasta 24 horas antes del arribo.', 'No se admiten mascotas.', 'Establecimiento 100% libre de humo.'],
  '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb,
  '{"telefono": "+52 55 5000 4000", "email": "reservaciones@roomiamajestic.com", "web": "www.roomiamajesticpalace.com"}'::jsonb,
  '{"facebook": "facebook.com/roomiamajestic", "instagram": "instagram.com/roomiamajestic"}'::jsonb,
  'activo'
),
(
  'hotel-2',
  'Plaza Nómada Urban Oasis',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&auto=format&fit=crop&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80'
  ],
  'Diseñado para profesionales modernos, viajeros creativos y almas nómadas. Un santuario urbano rodeado de vegetación tropical sumergido en el pulmón financiero. Conectividad WiFi 6E ultra rápida, salas de co-working creativas, terrazas ajardinadas con bar de autor y desayunos locales orgánicos.',
  'Calle de Serrano 84, Barrio de Salamanca, Madrid, España',
  '{"lat": 40.4320, "lng": -3.6872}'::jsonb,
  'https://maps.google.com/maps?q=Calle+de+Serrano+84,+Madrid,+Espa%aV%b1a',
  ARRAY['Co-working Space', 'Piscina Climatizada', 'Terrazas Jardín', 'Café de Especialidad', 'Bar de Cócteles de Autor', 'Pet Friendly', 'Bicicletas Gratuitas'],
  ARRAY['Check-in: A partir de las 14:00', 'Check-out: Hasta las 11:00', 'Se admiten mascotas con cargo adicional.', 'Desayuno incluido en reservas directas.', 'Establecimiento amigable con el medio ambiente.'],
  '{"checkIn": "14:00", "checkOut": "11:00"}'::jsonb,
  '{"telefono": "+34 91 700 800", "email": "host@plazanomada.com", "web": "www.plazanomada.com"}'::jsonb,
  '{"instagram": "instagram.com/plazanomadahotels", "twitter": "twitter.com/plazanomada"}'::jsonb,
  'activo'
),
(
  'hotel-3',
  'Eco-Cabin Wildwood Shore',
  'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&auto=format&fit=crop&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504643971488-5a2aa684be43?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80'
  ],
  'Privacidad absoluta a orillas del majestuoso lago glaciar. Cabañas ecológicas de madera noble y ventanales panorámicos de triple panel que ofrecen vistas espectaculares de las montañas boscosas. Calefacción geotérmica, jacuzzis exteriores de uso privado y muelle exclusivo con kayaks.',
  'Ruta Costera Km 14, Bariloche, Patagonia, Argentina',
  '{"lat": -41.1335, "lng": -71.3103}'::jsonb,
  'https://maps.google.com/maps?q=Ruta+Costera+Km+14,+Bariloche,+Argentina',
  ARRAY['Muelle Privado', 'Jacuzzi Exterior Autónomo', 'Kayaks & Paddle Boards', 'Chimenea de Leña', 'Estación de Carga EV', 'Eco-Tours Auto-guiados', 'Desayuno de Campo en Puerta'],
  ARRAY['Check-in: A partir de las 16:00', 'Check-out: Hasta las 10:00', 'Depósito reembolsable de garantía requerido al check-in.', 'Sustentabilidad garantizada: energía solar e hídrica propia.', 'Apto para niños mayores de 12 años.'],
  '{"checkIn": "16:00", "checkOut": "10:00"}'::jsonb,
  '{"telefono": "+54 294 456 789", "email": "explore@wildwoodshores.com", "web": "www.wildwoodshores.com"}'::jsonb,
  '{"facebook": "facebook.com/wildwoodshores", "instagram": "instagram.com/wildwoodpatagonia"}'::jsonb,
  'activo'
)
ON CONFLICT (id) DO NOTHING;


-- Inserción de Habitaciones Semilla (Rooms)
INSERT INTO public.rooms (id, hotelId, numero, nombre, descripcion, precio, capacidad, camas, tipo, imagenes, servicios, estado) VALUES
-- Habitaciones Hotel 1
(
  'room-101',
  'hotel-1',
  '101',
  'Deluxe Suite Imperial',
  'Hermosa habitación con sábanas de algodón egipcio de 600 hilos, baño de mármol de Carrara italiano, ducha de efecto lluvia, minibar gourmet y balcón privado al Paseo de la Reforma.',
  250,
  2,
  1,
  'Suite',
  ARRAY[
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Cama King-Size', 'Baño de Mármol', 'Balcón Central', 'Minibar Premium', 'Cafetera Nespresso', 'Smart TV 65"'],
  'disponible'
),
(
  'room-102',
  'hotel-1',
  '102',
  'Gran Suite Familiar Presidencial',
  'El pináculo del espacio y confort. Consta de dos dormitorios amplios en suite, salón comedor para 6 comensales, cocina de mayordomo y el más alto nivel de automatización residencial mediante tablets integradas.',
  480,
  5,
  3,
  'Suite Presidencial',
  ARRAY[
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['2 Dormitorios', 'Salón Comedor', 'Smart Automation', 'Vistas de 180 Grados', 'Bañera de Hidromasaje', 'Mayordomo Asignado'],
  'ocupado'
),
(
  'room-103',
  'hotel-1',
  '103',
  'Clásica Superior Doble',
  'Cómoda habitación de estilo neoclásico con espléndidos armarios empotrados, mesa de escritorio ejecutiva de caoba y dos hermosas camas dobles ideales para viajes de negocios o exploración familiar.',
  180,
  4,
  2,
  'Doble',
  ARRAY[
    'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Dos Camas Queen', 'Mesa de Trabajo', 'Aire Acondicionado Inteligente', 'Caja Fuerte', 'Ducha de Alta Presión'],
  'disponible'
),
(
  'room-104',
  'hotel-1',
  '104',
  'Boutique Individual Estándar',
  'Optimización perfecta del espacio sin escatimar confort. Una reconfortante cama nido de plaza y media, detalles arquitectónicos artesanales locales, y la luz cálida de la mañana ideal para relajarse.',
  120,
  1,
  1,
  'Estándar',
  ARRAY['https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&auto=format&fit=crop&q=80'],
  ARRAY['Cama Matrimonial Individual', 'Ducha Lluvia', 'Espacio Funcional', 'Cafetera In-room'],
  'mantenimiento'
),

-- Habitaciones Hotel 2
(
  'room-201',
  'hotel-2',
  '201',
  'Nómada Premium Studio',
  'Estudio de estilo industrial chic con techos altos de hormigón a la vista. Zona de oficina dedicada con escritorio ergonómico Steelcase, pizarra de cristal magnética y cafetera drip de goteo japonesa.',
  150,
  2,
  1,
  'Suite',
  ARRAY[
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Escritorio Ergonómico', 'Silla de Oficina Ejecutiva', 'Monitor Ultrawide 34"', 'Pizarra de Cristal', 'Wi-Fi 6E Premium'],
  'disponible'
),
(
  'room-202',
  'hotel-2',
  '202',
  'Estándar Coworking Doble',
  'Diseñada para equipos o duplas creativas. Dispone de dos camas individuales premium, escritorios modulares desplazables independientes y cargadores de USB e inalámbricos de última velocidad integrados.',
  130,
  2,
  2,
  'Doble',
  ARRAY['https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&auto=format&fit=crop&q=80'],
  ARRAY['Camas Ajustables', 'Conectividad Multipunto', 'Baño Compartimentado', 'Puerta Insonorizada'],
  'reservado'
),
(
  'room-203',
  'hotel-2',
  '203',
  'Urban Suite Loft',
  'Un loft de dos niveles con sala de estar de diseño escandinavo en la planta baja y el dormitorio principal en el altillo. Paredes de ladrillo visto original y grandes ventanales con vistas panorámicas al skyline de Madrid.',
  210,
  3,
  2,
  'Suite',
  ARRAY[
    'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Diseño en Dos Niveles', 'Sofá Cama Premium', 'Barra de Bar Privada', 'Altavoz Bluetooth Marshall', 'Vistas Panorámicas de la Ciudad'],
  'disponible'
),

-- Habitaciones Hotel 3
(
  'room-301',
  'hotel-3',
  'A-1',
  'Refugio Glaciar Prime',
  'Espectacular cabaña al borde del lago. Techo de doble altura con vigas de ciprés rústico, estufa de leña de hierro fundido noruega y un jacuzzi privado exterior climatizado en el muelle de madera.',
  210,
  2,
  1,
  'Suite',
  ARRAY[
    'https://images.unsplash.com/photo-1611891487122-2075b9624428?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1549294413-26f195afcbdb?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Hogar a Leña', 'Muelle Privado', 'Jacuzzi sobre el Lago', 'Cama King Patagónica', 'Cafetería de Especialidad Molida'],
  'disponible'
),
(
  'room-302',
  'hotel-3',
  'B-2',
  'Cabaña Familiar Wildwood',
  'Espacio optimizado para disfrutar de la naturaleza en familia. Dos dormitorios cerrados, amplio living con cocina integrada rústica totalmente equipada con vajilla hecha a mano por artesanos locales.',
  260,
  6,
  4,
  'Suite',
  ARRAY[
    'https://images.unsplash.com/photo-1504643971488-5a2aa684be43?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Cocina Completa Rustica', 'Deck con Parrilla', '2 Dormitorios', 'Amplia Mesa de Comedor', 'Kayaks Incluidos'],
  'disponible'
)
ON CONFLICT (id) DO NOTHING;


-- Inserción de Usuarios Administrativos Semilla (Users)
INSERT INTO public.users (id, nombre, apellido, email, telefono, documento, avatar, rol, fechaRegistro, estado, password, hotelId) VALUES
(
  'user-superadmin',
  'Gonzalo',
  'Rodríguez',
  'destructordereck@gmail.com',
  '+54 11 9876 5432',
  'DNI-35492109',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=facearea&facepad=2&q=80',
  'super_admin',
  '2026-04-10',
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
    contacto: hotel.contacto || {},
    redessociales: hotel.redesSociales || {},
    estado: hotel.estado || 'activo'
  };
}

export function mapHotelFromDb(db: any): Hotel {
  if (!db) return db;
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
    contacto: db.contacto || {},
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
  return {
    id: user.id,
    nombre: user.nombre || 'Usuario',
    apellido: user.apellido || 'Roomia',
    email: user.email,
    telefono: user.telefono || '',
    documento: user.documento || '',
    avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: user.rol || 'cliente',
    fecharegistro: user.fechaRegistro || new Date().toISOString().split('T')[0],
    estado: user.estado || 'activo',
    password: user.password || '',
    hotelid: user.hotelId || null
  };
}

export function mapUserFromDb(db: any): User {
  if (!db) return db;
  return {
    id: db.id,
    nombre: db.nombre || 'Usuario',
    apellido: db.apellido || 'Roomia',
    email: db.email || '',
    telefono: db.telefono || '',
    documento: db.documento || '',
    avatar: db.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: db.rol || 'cliente',
    fechaRegistro: db.fecharegistro !== undefined ? db.fecharegistro : (db.fechaRegistro || new Date().toISOString().split('T')[0]),
    estado: db.estado || 'activo',
    password: db.password || '',
    hotelId: db.hotelid !== undefined ? db.hotelid : db.hotelId
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
    const { error } = await supabase
      .from('users')
      .upsert(mapUserToDb(user));

    if (error) {
      console.warn('Supabase syncUser error:', error);
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
