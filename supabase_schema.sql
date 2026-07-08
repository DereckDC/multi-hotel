-- ROOMIA SAAS - SUPABASE COMPLETE SCHEMA SETUP & SEED DATA
-- Copia y pega este script completo en el SQL Editor de tu consola de Supabase.
-- Advertencia: Esto recreará las tablas de forma limpia.

-- 0. Limpieza previa de tablas y políticas (opcional pero recomendado)
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.property_details CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.room_price_variations CASCADE;

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
  adicionar_iva BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Usuarios (Limpiada de contraseñas inseguras)
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
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE SET NULL,
  debecambiarpassword BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 8. Detalles complementarios de Propiedades (Casas & Departamentos)
CREATE TABLE public.property_details (
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

-- 9. Tabla de Reseñas y Valoraciones (reviews)
CREATE TABLE public.reviews (
  id TEXT PRIMARY KEY,
  reservation_id TEXT REFERENCES public.reservations(id) ON DELETE CASCADE,
  hotel_id TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  guest_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comentario TEXT,
  fecha TEXT, -- YYYY-MM-DD
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabla de Precios Variables por Fecha (room_price_variations)
CREATE TABLE public.room_price_variations (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  hotel_id TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  fecha TEXT, -- YYYY-MM-DD (puede ser nulo si es fin de semana recurrente)
  is_weekend BOOLEAN DEFAULT FALSE,
  precio NUMERIC NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
--             INSERT CÓDIGOS DE SEMILLADO (INITIAL SEED DATA)
-- =========================================================================

-- Inserción de Usuario Administrativo Único para Producción (Sin contraseñas en plano en BD pública)
INSERT INTO public.users (id, nombre, apellido, email, telefono, documento, avatar, rol, fechaRegistro, estado, hotelId) VALUES
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
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
--   HABILITACIÓN DE ROW LEVEL SECURITY (RLS) Y POLÍTICAS DE ACCESO SEGURAS (OWASP Top 10)
-- =========================================================================

-- Helper Función para auditar y validar roles mediante SECURITY DEFINER (previene recursividad de RLS)
CREATE OR REPLACE FUNCTION public.get_user_role(u_id TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT rol FROM public.users WHERE id = u_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitación General de RLS
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_price_variations ENABLE ROW LEVEL SECURITY;

-- 12.1 Políticas para Hotels (Lectura pública, Gestión restringida a Admins)
DROP POLICY IF EXISTS "Lectura publica hotels" ON public.hotels;
CREATE POLICY "Lectura publica hotels" ON public.hotels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Modificacion hotels staff" ON public.hotels;
CREATE POLICY "Modificacion hotels staff" ON public.hotels FOR ALL USING (
  public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin')
);

-- 12.2 Políticas para Rooms (Lectura pública, Gestión restringida a Staff de hotelería)
DROP POLICY IF EXISTS "Lectura publica rooms" ON public.rooms;
CREATE POLICY "Lectura publica rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Modificacion rooms staff" ON public.rooms;
CREATE POLICY "Modificacion rooms staff" ON public.rooms FOR ALL USING (
  public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

-- 12.3 Políticas para Users (Lectura propia/staff, registro propio, gestión sólo admin/staff)
DROP POLICY IF EXISTS "Acceso lectura usuarios" ON public.users;
CREATE POLICY "Acceso lectura usuarios" ON public.users FOR SELECT USING (
  auth.uid()::text = id OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

DROP POLICY IF EXISTS "Registro propio publico" ON public.users;
CREATE POLICY "Registro propio publico" ON public.users FOR INSERT WITH CHECK (
  auth.uid()::text = id 
  OR auth.uid() IS NULL 
  OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

DROP POLICY IF EXISTS "Actualización de perfil propio" ON public.users;
CREATE POLICY "Actualización de perfil propio" ON public.users FOR UPDATE USING (
  auth.uid()::text = id 
  OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

DROP POLICY IF EXISTS "Administración usuarios" ON public.users;
CREATE POLICY "Administración usuarios" ON public.users FOR DELETE USING (
  public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin')
);

-- 12.4 Políticas para Reservations (Huesped sobre lo propio, Staff completo)
DROP POLICY IF EXISTS "Lectura y Gestion Reservaciones" ON public.reservations;
CREATE POLICY "Lectura y Gestion Reservaciones" ON public.reservations FOR ALL USING (
  auth.uid()::text = guestId OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

-- 12.5 Políticas para Logs (Superadmins únicamente)
DROP POLICY IF EXISTS "Lectura Logs Superadmin" ON public.logs;
CREATE POLICY "Lectura Logs Superadmin" ON public.logs FOR ALL USING (
  public.get_user_role(auth.uid()::text) = 'super_admin'
);

-- 12.6 Políticas para Messages Chat (Propietario del chat o Staff)
DROP POLICY IF EXISTS "Mensajeria Chat" ON public.messages;
CREATE POLICY "Mensajeria Chat" ON public.messages FOR ALL USING (
  senderid = auth.uid()::text OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

-- 12.7 Políticas para Transactions (Huesped dueño de reserva o Staff de hotel)
DROP POLICY IF EXISTS "Transacciones Pagos" ON public.transactions;
CREATE POLICY "Transacciones Pagos" ON public.transactions FOR ALL USING (
  (SELECT guestId FROM public.reservations WHERE id = reservationid LIMIT 1) = auth.uid()::text
  OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

-- 12.8 Políticas para Property Details (Lectura pública, Gestión admins)
DROP POLICY IF EXISTS "Lectura property details" ON public.property_details;
CREATE POLICY "Lectura property details" ON public.property_details FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion property details" ON public.property_details;
CREATE POLICY "Gestion property details" ON public.property_details FOR ALL USING (
  public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin')
);

-- 12.9 Políticas para Reviews (Lectura pública, Inserción por cliente propietario)
DROP POLICY IF EXISTS "Lectura de reviews publica" ON public.reviews;
CREATE POLICY "Lectura de reviews publica" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion de reviews propia" ON public.reviews;
CREATE POLICY "Gestion de reviews propia" ON public.reviews FOR ALL USING (
  auth.uid()::text = guest_id OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin')
);

-- 12.10 Políticas para Room Price Variations (Lectura pública, Edición Staff)
DROP POLICY IF EXISTS "Lectura precio variable" ON public.room_price_variations;
CREATE POLICY "Lectura precio variable" ON public.room_price_variations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Edicion precio variable staff" ON public.room_price_variations;
CREATE POLICY "Edicion precio variable staff" ON public.room_price_variations FOR ALL USING (
  public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
);

-- 11. RUTINA DE LIMPIEZA AUTOMÁTICA DE DATOS EXPIRADOS (CHAT > 24H, AUDITORÍA > 30 DÍAS)
-- Esta rutina optimiza el almacenamiento purgando registros antiguos periódicamente de forma inteligente.
CREATE OR REPLACE FUNCTION public.limpiar_datos_expirados()
RETURNS void AS $$
BEGIN
  -- 11.1 Mensajes de chat: Eliminar por completo el live chat de los clientes tras 24 horas
  DELETE FROM public.messages
  WHERE (timestamp::timestamptz < (NOW() - INTERVAL '24 hours'))
     OR (created_at < (NOW() - INTERVAL '24 hours'));

  -- 11.2 Canal de auditoría: Eliminar registros de auditoría mayores a 1 mes automáticamente
  DELETE FROM public.logs
  WHERE (timestamp::timestamptz < (NOW() - INTERVAL '30 days'))
     OR (created_at < (NOW() - INTERVAL '30 days'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creación de índices con fines de rendimiento óptimo para consultas de purga recurrentes
CREATE INDEX IF NOT EXISTS idx_messages_cleanup ON public.messages((timestamp::timestamptz));
CREATE INDEX IF NOT EXISTS idx_logs_cleanup ON public.logs((timestamp::timestamptz));
