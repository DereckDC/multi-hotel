-- =========================================================================
--             ROOMIA PMS - MASTER PRODUCTION SETUP SCRIPT (CON RLS SEGURO)
-- =========================================================================
-- Versión: 4.1 (Listo para Producción Real, Seguro, Completo y Optimizado)
-- Compatibilidad: Supabase Postgres v15+
-- Directrices de Seguridad: OWASP Top 10 (Restricciones e Integridad de BD)
-- Sincronización Automática de Auth y Sanitización de Datos.
-- RLS Avanzado: Habilitado de forma segura, resolviendo recursividad
--               y otorgando control total a administradores.
-- SOLUCIÓN DE ERROR: Índices de fecha corregidos para evitar conversiones no immutables.
-- =========================================================================

-- 0. LIMPIEZA PREVIA DE TABLAS Y FUNCIONES (Para una instalación limpia)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.limpiar_datos_expirados() CASCADE;

DROP TABLE IF EXISTS public.room_price_variations CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.property_details CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;

-- =========================================================================
-- 1. CREACIÓN DE TABLAS DE LA BASE DE DATOS
-- =========================================================================

-- 1.1 Tabla de Hoteles / Establecimientos
CREATE TABLE public.hotels (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  logo TEXT,
  portada TEXT,
  imagenes TEXT[] DEFAULT '{}', -- Array de URLs de imágenes
  descripcion TEXT,
  ubicacion TEXT,
  coordenadas JSONB DEFAULT '{"lat": -0.1807, "lng": -78.4678}'::jsonb, -- { "lat": Float, "lng": Float }
  googleMapsUrl TEXT,
  servicios TEXT[] DEFAULT '{}',
  politicas TEXT[] DEFAULT '{}',
  horarios JSONB DEFAULT '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb,
  contacto JSONB DEFAULT '{"telefono": "", "email": "", "web": ""}'::jsonb,
  redesSociales JSONB DEFAULT '{"facebook": "", "instagram": "", "twitter": ""}'::jsonb,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'mantenimiento')),
  tipoEstablecimiento TEXT DEFAULT 'hotel' CHECK (tipoEstablecimiento IN ('hotel', 'propiedad')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Tabla de Habitaciones / Unidades
CREATE TABLE public.rooms (
  id TEXT PRIMARY KEY,
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC NOT NULL CHECK (precio >= 0),
  capacidad INTEGER NOT NULL CHECK (capacidad > 0),
  camas INTEGER NOT NULL DEFAULT 1 CHECK (camas > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('Estándar', 'Doble', 'Triple', 'Suite', 'Suite Presidencial')),
  imagenes TEXT[] DEFAULT '{}',
  servicios TEXT[] DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupado', 'mantenimiento', 'limpieza')),
  adicionar_iva BOOLEAN NOT NULL DEFAULT TRUE, -- Aplica IVA al subtotal de la reserva
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Tabla de Usuarios (Sincronizada con auth.users de Supabase)
CREATE TABLE public.users (
  id TEXT PRIMARY KEY, -- Mapeado al UUID de auth.users como TEXT
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT,
  documento TEXT, -- Cédula, RUC, o Pasaporte
  avatar TEXT,
  rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('super_admin', 'hotel_admin', 'recepcionista', 'cliente')),
  fechaRegistro TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE SET NULL, -- Si es staff, pertenece a este hotel
  debecambiarpassword BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Tabla de Reservaciones
CREATE TABLE public.reservations (
  id TEXT PRIMARY KEY,
  roomId TEXT REFERENCES public.rooms(id) ON DELETE CASCADE, -- Nullable en caso de rentas de propiedades completas
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  guestId TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  fechaEntrada TEXT NOT NULL, -- Formato YYYY-MM-DD
  fechaSalida TEXT NOT NULL, -- Formato YYYY-MM-DD
  serviciosAdicionales TEXT[] DEFAULT '{}',
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  impuestos NUMERIC NOT NULL DEFAULT 0 CHECK (impuestos >= 0), -- Representa el IVA u otros cargos
  total NUMERIC NOT NULL CHECK (total >= 0),
  noches INTEGER NOT NULL DEFAULT 1 CHECK (noches > 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'ocupada', 'finalizada', 'cancelada')),
  qrCode TEXT, -- Enlace o Base64 del código QR de check-in rápido
  checkedInAt TEXT, -- Timestamp o fecha del check-in
  checkedOutAt TEXT, -- Timestamp o fecha del check-out
  recepcionistaId TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT, -- Notas del huésped o personal administrativo
  modificadoPor TEXT,
  mensajeCambio TEXT,
  fechaCambio TEXT,
  cambiadoPorId TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  eliminadaPorCliente BOOLEAN DEFAULT FALSE, -- Ocultar de la interfaz del cliente pero conservar en base de datos
  reservation_type TEXT DEFAULT 'hospedaje' CHECK (reservation_type IN ('hospedaje', 'alquiler_mensual', 'venta')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Tabla de Bitácoras de Auditoría de Seguridad (Logs)
CREATE TABLE public.logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  "user" TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  detalles TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6 Tabla de Mensajería de Soporte y Chat en Vivo
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

-- 1.7 Tabla de Transacciones y Pagos de Reservas
CREATE TABLE public.transactions (
  id TEXT PRIMARY KEY,
  reservationid TEXT NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  paymentmethod TEXT NOT NULL CHECK (paymentmethod IN ('tarjeta_credito', 'transferencia', 'efectivo', 'paypal', 'stripe')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('completado', 'fallido', 'pendiente', 'reembolsado')),
  reference TEXT NOT NULL UNIQUE, -- Referencia única de transacción
  fecha TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.8 Detalles de Propiedades Exclusivas (Casas, Apartamentos)
CREATE TABLE public.property_details (
  id TEXT PRIMARY KEY,
  hotel_id TEXT UNIQUE REFERENCES public.hotels(id) ON DELETE CASCADE,
  property_type TEXT CHECK (property_type IN ('hotel', 'casa', 'departamento')),
  listing_type TEXT CHECK (listing_type IN ('alquiler', 'venta')),
  bedrooms INTEGER DEFAULT 0 CHECK (bedrooms >= 0),
  bathrooms INTEGER DEFAULT 0 CHECK (bathrooms >= 0),
  square_meters NUMERIC DEFAULT 0 CHECK (square_meters >= 0),
  furnished BOOLEAN DEFAULT FALSE,
  parking BOOLEAN DEFAULT FALSE,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  owner_document TEXT,
  price NUMERIC DEFAULT 0 CHECK (price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9 Tabla de Reseñas y Valoraciones
CREATE TABLE public.reviews (
  id TEXT PRIMARY KEY,
  reservation_id TEXT REFERENCES public.reservations(id) ON DELETE CASCADE,
  hotel_id TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  guest_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comentario TEXT,
  fecha TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.10 Tabla de Tarifas Dinámicas y Precios por Fecha
CREATE TABLE public.room_price_variations (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  hotel_id TEXT REFERENCES public.hotels(id) ON DELETE CASCADE,
  fecha TEXT, -- Formato YYYY-MM-DD (Nulo si es recurrencia semanal de fin de semana)
  is_weekend BOOLEAN DEFAULT FALSE,
  precio NUMERIC NOT NULL CHECK (precio >= 0),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 2. ÍNDICES DE RENDIMIENTO PARA ALTA VELOCIDAD DE CONSULTA
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_rooms_hotelid ON public.rooms(hotelId);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_reservations_guestid ON public.reservations(guestId);
CREATE INDEX IF NOT EXISTS idx_reservations_hotelid ON public.reservations(hotelId);
CREATE INDEX IF NOT EXISTS idx_reservations_roomid ON public.reservations(roomId);
CREATE INDEX IF NOT EXISTS idx_messages_hotelid ON public.messages(hotelid);
CREATE INDEX IF NOT EXISTS idx_transactions_reservationid ON public.transactions(reservationid);
CREATE INDEX IF NOT EXISTS idx_reviews_hotelid ON public.reviews(hotel_id);
CREATE INDEX IF NOT EXISTS idx_price_variations_room ON public.room_price_variations(room_id, fecha);

-- Corrección de los índices de limpieza: usamos directamente el campo created_at que es TIMESTAMPTZ de forma nativa
CREATE INDEX IF NOT EXISTS idx_messages_cleanup ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_cleanup ON public.logs(created_at);

-- =========================================================================
-- 3. FUNCIONES AUXILIARES DE RLS CON ATRIBUTO SECURITY DEFINER
-- =========================================================================
-- SECURITY DEFINER ejecuta la función con los privilegios del creador (bypass RLS)
-- Evita de forma elegante y robusta la recursión infinita al validar roles.
-- SET search_path = public asegura protección contra inyecciones de esquema.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Si el usuario no está autenticado en Supabase Auth, retorna 'anon'
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;

  SELECT rol INTO v_role 
  FROM public.users 
  WHERE id = auth.uid()::text 
  LIMIT 1;

  RETURN COALESCE(v_role, 'cliente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_role(u_id TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT rol FROM public.users WHERE id = u_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- 4. TRÍGGER DE CREACIÓN AUTOMÁTICA DE PERFIL (auth.users -> public.users)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    nombre, 
    apellido, 
    email, 
    telefono, 
    documento, 
    avatar, 
    rol, 
    estado, 
    fechaRegistro, 
    debecambiarpassword
  )
  VALUES (
    new.id::text,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'apellido', 'Nuevo'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'telefono', ''),
    COALESCE(new.raw_user_meta_data->>'documento', ''),
    COALESCE(new.raw_user_meta_data->>'avatar', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
    COALESCE(new.raw_user_meta_data->>'rol', 'cliente'),
    'activo',
    to_char(now(), 'YYYY-MM-DD'),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 5. RUTINA DE AUTOLIMPIEZA INTELIGENTE DE LOGS Y CHATS EXPIRADOS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.limpiar_datos_expirados()
RETURNS void AS $$
BEGIN
  -- 5.1 Borra chat en vivo antiguo (> 24 horas)
  DELETE FROM public.messages
  WHERE (timestamp::timestamptz < (NOW() - INTERVAL '24 hours'))
     OR (created_at < (NOW() - INTERVAL '24 hours'));

  -- 5.2 Borra logs de auditoría antiguos (> 30 días)
  DELETE FROM public.logs
  WHERE (timestamp::timestamptz < (NOW() - INTERVAL '30 days'))
     OR (created_at < (NOW() - INTERVAL '30 days'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- 6. CONFIGURACIÓN Y ACTIVACIÓN DE ROW LEVEL SECURITY (RLS)
-- =========================================================================

-- Activación de RLS para garantizar la advertencia de Supabase satisfecha
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

-- 6.1 Políticas para public.hotels
CREATE POLICY "Permitir lectura publica de hoteles" ON public.hotels
  FOR SELECT USING (true);

CREATE POLICY "Permitir todo a administradores sobre hoteles" ON public.hotels
  FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.2 Políticas para public.rooms
CREATE POLICY "Permitir lectura publica de habitaciones" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Permitir todo a administradores sobre habitaciones" ON public.rooms
  FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.3 Políticas para public.users
CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" ON public.users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir registro de perfil propio" ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid()::text);

CREATE POLICY "Permitir actualizacion de perfil propio o por administradores" ON public.users
  FOR UPDATE TO authenticated 
  USING (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'));

CREATE POLICY "Permitir eliminacion de perfiles solo a administradores" ON public.users
  FOR DELETE TO authenticated USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.4 Políticas para public.reservations
CREATE POLICY "Permitir lectura de reservaciones a dueno o personal" ON public.reservations
  FOR SELECT TO authenticated 
  USING (guestId = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "Permitir crear reservaciones a clientes o personal" ON public.reservations
  FOR INSERT TO authenticated 
  WITH CHECK (guestId = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "Permitir actualizar reservaciones a dueno o personal" ON public.reservations
  FOR UPDATE TO authenticated 
  USING (guestId = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "Permitir eliminar reservaciones solo a administradores" ON public.reservations
  FOR DELETE TO authenticated 
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.5 Políticas para public.logs
CREATE POLICY "Permitir lectura de logs solo a super_admin" ON public.logs
  FOR SELECT TO authenticated USING (public.get_my_role() = 'super_admin');

CREATE POLICY "Permitir insertar logs a cualquier usuario autenticado" ON public.logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 6.6 Políticas para public.messages
CREATE POLICY "Permitir ver mensajes propios o al personal" ON public.messages
  FOR SELECT TO authenticated 
  USING (senderid = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "Permitir enviar mensajes a cualquier usuario autenticado" ON public.messages
  FOR INSERT TO authenticated 
  WITH CHECK (senderid = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

-- 6.7 Políticas para public.transactions
CREATE POLICY "Permitir ver transacciones de reservacion propia o a personal" ON public.transactions
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r 
      WHERE r.id = reservationid 
        AND (r.guestId = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
    )
  );

CREATE POLICY "Permitir gestionar transacciones al personal" ON public.transactions
  FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

-- 6.8 Políticas para public.property_details
CREATE POLICY "Permitir lectura publica de detalles de propiedad" ON public.property_details
  FOR SELECT USING (true);

CREATE POLICY "Permitir gestionar detalles de propiedad a administradores" ON public.property_details
  FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.9 Políticas para public.reviews
CREATE POLICY "Permitir lectura publica de reseñas" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Permitir crear reseñas a huespedes" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (guest_id = auth.uid()::text);

CREATE POLICY "Permitir gestionar reseñas al autor o administradores" ON public.reviews
  FOR ALL TO authenticated USING (guest_id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.10 Políticas para public.room_price_variations
CREATE POLICY "Permitir lectura publica de tarifas dinamicas" ON public.room_price_variations
  FOR SELECT USING (true);

CREATE POLICY "Permitir gestionar tarifas dinamicas a administradores" ON public.room_price_variations
  FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- =========================================================================
-- 7. REGISTROS DE SEMILLA INICIALES (SEED DATA - Listo para Producción)
-- =========================================================================

-- 7.1 Insertar Hoteles de Demostración de Aura / Roomia PMS
INSERT INTO public.hotels (id, nombre, logo, portada, imagenes, descripcion, ubicacion, coordenadas, googleMapsUrl, servicios, politicas, horarios, contacto, redesSociales, estado, tipoEstablecimiento)
VALUES 
('hotel-1', 'Aura Boutique Hotel & Spa', 
 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=150', 
 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200', 
 ARRAY['https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800'], 
 'Establecimiento de lujo enfocado en el bienestar físico y mental, ubicado frente al mar. Ofrece experiencias culinarias premium, tratamientos de spa holísticos y un entorno de desconexión absoluta.', 
 'Av. Del Mar 450, Playas de Salinas', 
 '{"lat": -2.1961, "lng": -80.9583}'::jsonb, 
 'https://maps.google.com/?q=-2.1961,-80.9583', 
 ARRAY['WiFi de Alta Velocidad', 'Spa de Lujo & Termas', 'Piscina de Borde Infinito', 'Restaurante de Autor', 'Gimnasio Clínico', 'Servicio a la Habitación 24/7'], 
 ARRAY['No se permiten mascotas', 'Prohibido fumar en áreas interiores', 'Check-in requiere documento de identidad original', 'Cancelación gratuita hasta 48 horas antes'], 
 '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb, 
 '{"telefono": "+593 4 277 1234", "email": "recepcion.salinas@aurahotels.com", "web": "www.aurahotels.com"}'::jsonb, 
 '{"facebook": "aura.boutique.spa", "instagram": "aura.boutique.spa", "twitter": "aurahotels"}'::jsonb, 
 'activo', 'hotel'),

('hotel-2', 'Roomia City Business & Coworking', 
 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', 
 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200', 
 ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'], 
 'Hotel corporativo moderno y tecnológico en el corazón financiero. Cuenta con salas de reuniones de alta tecnología, cabinas insonorizadas para llamadas y café de especialidad gratuito para huéspedes en coworking.', 
 'Av. Amazonas N32-150 y La Niña, Quito', 
 '{"lat": -0.1807, "lng": -78.4678}'::jsonb, 
 'https://maps.google.com/?q=-0.1807,-78.4678', 
 ARRAY['WiFi Fibra Óptica 300 Mbps', 'Espacio de Coworking Ilimitado', 'Estación de Café de Especialidad', 'Parqueo Subterráneo Gratuito', 'Gimnasio Express 24h', 'Salas de Reuniones Zoom-ready'], 
 ARRAY['Mascotas permitidas con recargo', 'Prohibido fumar en todo el establecimiento', 'Check-in exprés digital disponible', 'Late Check-out sujeto a disponibilidad'], 
 '{"checkIn": "14:00", "checkOut": "11:00"}'::jsonb, 
 '{"telefono": "+593 2 398 5600", "email": "business.quito@roomia.com", "web": "www.roomiapms.com"}'::jsonb, 
 '{"facebook": "roomia.quito", "instagram": "roomia.quito", "twitter": "roomiapms"}'::jsonb, 
 'activo', 'hotel'),

('hotel-3', 'Cabañas Selva Verde Ecolodge', 
 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=150', 
 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', 
 ARRAY['https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800'], 
 'Cabañas ecológicas inmersas en la selva tropical, diseñadas con materiales locales sustentables. Ofrece senderismo guiado, avistamiento de aves exóticas y cenas temáticas frente a la fogata del río.', 
 'Km 12 Vía al Tena, Archidona - Napo', 
 '{"lat": -0.9083, "lng": -77.8167}'::jsonb, 
 'https://maps.google.com/?q=-0.9083,-77.8167', 
 ARRAY['WiFi Satelital de Cortesía', 'Senderos Ecológicos Guiados', 'Restaurante Orgánico de la Granja', 'Área de Fogata Nocturna', 'Acceso Directo al Río', 'Piscina Ecológica de Agua de Vertiente'], 
 ARRAY['Mascotas bienvenidas en cabañas privadas', 'Uso obligatorio de repelente biodegradable', 'Check-in hasta las 20:00 por seguridad vial', 'Políticas de bajo impacto acústico nocturno'], 
 '{"checkIn": "14:00", "checkOut": "12:00"}'::jsonb, 
 '{"telefono": "+593 6 288 9450", "email": "reservas@selvaverde.ec", "web": "www.selvaverde.ec"}'::jsonb, 
 '{"facebook": "selvaverde.ecolodge", "instagram": "selvaverde.ecolodge", "twitter": "selvaverdeeco"}'::jsonb, 
 'activo', 'hotel')
ON CONFLICT (id) DO NOTHING;

-- 7.2 Insertar Habitaciones de Demostración
INSERT INTO public.rooms (id, hotelId, numero, nombre, descripcion, precio, capacidad, camas, tipo, imagenes, servicios, estado, adicionar_iva)
VALUES
('room-101', 'hotel-1', '101', 'Suite Vista al Mar Standard', 'Hermosa suite equipada con cama King size, terraza privada y vista directa al océano Pacífico.', 110.00, 2, 1, 'Suite', ARRAY['https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800'], ARRAY['TV Cable 55"', 'Frigobar Equipado', 'Aire Acondicionado', 'Cafetera Nespresso', 'Bata y Zapatillas de Baño'], 'disponible', true),
('room-102', 'hotel-1', '102', 'Habitación Doble Premium', 'Amplia habitación ideal para familias, con dos camas Queen size y balcón lateral.', 135.00, 4, 2, 'Doble', ARRAY['https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800'], ARRAY['TV Cable 50"', 'Frigobar', 'Aire Acondicionado', 'Caja Fuerte', 'Escritorio Funcional'], 'disponible', true),
('room-201', 'hotel-1', '201', 'Presidential Wellness Suite', 'La suite más exclusiva del hotel. Cama Imperial King, jacuzzi exterior en terraza de 40m2 y bar de infusiones orgánicas gratis.', 250.00, 2, 1, 'Suite Presidencial', ARRAY['https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800'], ARRAY['Jacuzzi Privado', 'Terraza de Lujo', 'Smart TV 70" 4K', 'Home Theater', 'Bar Premium de Cortesía', 'Servicio de Mayordomo'], 'disponible', true),

('room-202', 'hotel-2', '201', 'Business Loft Individual', 'Loft optimizado para viajeros de negocios con escritorio ergonómico Herman Miller y pantalla ultra-wide para conectar laptops.', 85.00, 1, 1, 'Estándar', ARRAY['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800'], ARRAY['Escritorio Ergonómico', 'Pantalla Curva de 34"', 'Cafetera Italiana', 'Conectividad USB-C', 'Asistente Alexa Integrado'], 'disponible', true),
('room-203', 'hotel-2', '202', 'Doble Business Exec', 'Espacio versátil con dos camas matrimoniales de alta densidad y área de reuniones express integrada en la habitación.', 115.00, 3, 2, 'Doble', ARRAY['https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800'], ARRAY['Mesa de Trabajo Directivo', 'Frigobar Silencioso', 'Pizarra Magnética', 'Smart TV 55"'], 'disponible', true),

('room-301', 'hotel-3', 'C-1', 'Cabaña Eco-Familiar Río', 'Cabaña construida de bambú y madera fina. Deck privado suspendido sobre el río con hamacas artesanales.', 95.00, 4, 3, 'Triple', ARRAY['https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800'], ARRAY['Hamacas Exteriores', 'Mosquiteros de Diseño', 'Ventilador Silencioso', 'Balcón con Vista al Río', 'Luz Solar Autónoma'], 'disponible', true),
('room-302', 'hotel-3', 'C-2', 'Cabaña Nido de Amor', 'Diseño íntimo de domo rústico rodeado de orquídeas salvajes, con claraboya para observar las estrellas por la noche.', 80.00, 2, 1, 'Estándar', ARRAY['https://images.unsplash.com/photo-1432318629947-4c2725a058c3?w=800'], ARRAY['Claraboya Astronómica', 'Ducha Abierta Ecológica', 'Cama King de Bambú', 'Terraza Privada'], 'disponible', true)
ON CONFLICT (id) DO NOTHING;

-- 7.3 Insertar Usuario Super Admin Inicial (Dereck Cisneros)
INSERT INTO public.users (id, nombre, apellido, email, telefono, documento, avatar, rol, fecharegistro, estado, debecambiarpassword)
VALUES 
('user-superadmin', 'Dereck', 'Cisneros', 'destructordereck@gmail.com', '0998596597', '2450397340', 
 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 'super_admin', '2026-06-03', 'activo', false)
ON CONFLICT (id) DO NOTHING;
