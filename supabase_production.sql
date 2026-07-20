-- =========================================================================
--             ROOMIA PMS - MASTER PRODUCTION SETUP SCRIPT
-- =========================================================================
-- Versión: 2.0 (Listo para Producción Real, Seguro y Completo)
-- Compatibilidad: Supabase Postgres v15+
-- Directrices de Seguridad: OWASP Top 10, Row Level Security (RLS) Estricto,
-- Sincronización Automática de Auth y Sanitización de Datos.
-- =========================================================================

-- 0. LIMPIEZA PREVIA DE TABLAS Y FUNCIONES (Para una instalación limpia)
-- Nota: En producción real, ejecute esto solo para restauraciones completas.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(TEXT) CASCADE;
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
  coordenadas JSONB DEFAULT '{"lat": -0.1807, "lng": -78.4678}'::jsonb, -- { "lat": Float, "lng": Float } (Por defecto Quito, EC)
  googleMapsUrl TEXT,
  servicios TEXT[] DEFAULT '{}',
  politicas TEXT[] DEFAULT '{}',
  horarios JSONB DEFAULT '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb,
  contacto JSONB DEFAULT '{"telefono": "", "email": "", "web": ""}'::jsonb,
  redesSociales JSONB DEFAULT '{"facebook": "", "instagram": "", "twitter": ""}'::jsonb,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'mantenimiento')),
  tipoEstablecimiento TEXT DEFAULT 'hotel' CHECK (tipoEstablecimiento IN ('hotel', 'propiedad')), -- 'hotel' para hoteles grandes, 'propiedad' para casas/apartamentos individuales
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
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupado', 'mantenimiento', 'limpieza', 'reservado')),
  adicionar_iva BOOLEAN NOT NULL DEFAULT TRUE, -- Aplica IVA al subtotal de la reserva
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Tabla de Usuarios (Sincronizada con auth.users de Supabase)
CREATE TABLE public.users (
  id TEXT PRIMARY KEY, -- Mapeado al UUID de auth.users como TEXT para flexibilidad
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT,
  documento TEXT, -- Cédula, RUC, o Pasaporte
  avatar TEXT,
  rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('super_admin', 'hotel_admin', 'recepcionista', 'cliente')),
  fechaRegistro TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  hotelId TEXT REFERENCES public.hotels(id) ON DELETE SET NULL, -- Si es staff (hotel_admin, recepcionista), pertenece a este hotel
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
  impuestos NUMERIC NOT NULL DEFAULT 0 CHECK (impuestos >= 0), -- Representa el IVA u otros cargos calculados
  total NUMERIC NOT NULL CHECK (total >= 0),
  noches INTEGER NOT NULL DEFAULT 1 CHECK (noches > 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'ocupada', 'finalizada', 'cancelada')),
  qrCode TEXT, -- Enlace o Base64 del código QR de check-in rápido
  checkedInAt TEXT, -- Timestamp o fecha del check-in
  checkedOutAt TEXT, -- Timestamp o fecha del check-out
  recepcionistaId TEXT REFERENCES public.users(id) ON DELETE SET NULL, -- Quién realizó el check-in/out
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
  reference TEXT NOT NULL UNIQUE, -- Referencia única de transacción bancaria/pasarela
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


-- =========================================================================
-- 3. POLÍTICAS DE ACCESO SEGURO (ROW LEVEL SECURITY - RLS)
-- =========================================================================

-- Función ayudante "get_user_role" configurada como SECURITY DEFINER para evitar la recursión infinita de políticas RLS
CREATE OR REPLACE FUNCTION public.get_user_role(u_id TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT rol FROM public.users WHERE id = u_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitación Global de Row Level Security (RLS) en todas las tablas
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

-- 3.1 Políticas para public.hotels
CREATE POLICY "Lectura publica de hoteles" ON public.hotels 
  FOR SELECT USING (true);

CREATE POLICY "Modificacion de hoteles solo para administradores" ON public.hotels 
  FOR ALL USING (public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin'));

-- 3.2 Políticas para public.rooms
CREATE POLICY "Lectura publica de habitaciones" ON public.rooms 
  FOR SELECT USING (true);

CREATE POLICY "Gestion de habitaciones para administradores y personal" ON public.rooms 
  FOR ALL USING (public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista'));

-- 3.3 Políticas para public.users (Perfiles)
CREATE POLICY "Lectura de perfil propio o por personal del hotel" ON public.users 
  FOR SELECT USING (
    auth.uid()::text = id 
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "Insercion de perfil propio (Auto-registro publico)" ON public.users 
  FOR INSERT WITH CHECK (
    auth.uid()::text = id 
    OR auth.uid() IS NULL 
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "Actualizacion de perfil propio o administrativo" ON public.users 
  FOR UPDATE USING (
    auth.uid()::text = id 
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "Eliminacion de perfiles restringida a super_admin y hotel_admin" ON public.users 
  FOR DELETE USING (public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin'));

-- 3.4 Políticas para public.reservations
CREATE POLICY "Lectura y Gestion de Reservaciones por Huesped Propietario o Staff" ON public.reservations 
  FOR ALL USING (
    auth.uid()::text = guestId 
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

-- 3.5 Políticas para public.logs (Auditoría segura, solo Super Administradores)
CREATE POLICY "Acceso exclusivo de logs para Super_Admin" ON public.logs 
  FOR ALL USING (public.get_user_role(auth.uid()::text) = 'super_admin');

-- 3.6 Políticas para public.messages (Chat)
CREATE POLICY "Mensajeria segura propia o con personal de soporte" ON public.messages 
  FOR ALL USING (
    senderid = auth.uid()::text 
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

-- 3.7 Políticas para public.transactions
CREATE POLICY "Transacciones visibles para Huesped titular o personal" ON public.transactions 
  FOR ALL USING (
    (SELECT guestId FROM public.reservations WHERE id = reservationid LIMIT 1) = auth.uid()::text
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

-- 3.8 Políticas para public.property_details
CREATE POLICY "Lectura publica de detalles de propiedad" ON public.property_details 
  FOR SELECT USING (true);

CREATE POLICY "Gestion de detalles de propiedad para administradores" ON public.property_details 
  FOR ALL USING (public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin'));

-- 3.9 Políticas para public.reviews
CREATE POLICY "Lectura publica de reviews" ON public.reviews 
  FOR SELECT USING (true);

CREATE POLICY "Gestion de reviews por el autor o administradores" ON public.reviews 
  FOR ALL USING (
    auth.uid()::text = guest_id 
    OR public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin')
  );

-- 3.10 Políticas para public.room_price_variations
CREATE POLICY "Lectura publica de tarifas variables" ON public.room_price_variations 
  FOR SELECT USING (true);

CREATE POLICY "Gestion de tarifas variables para administradores y recepcion" ON public.room_price_variations 
  FOR ALL USING (public.get_user_role(auth.uid()::text) IN ('super_admin', 'hotel_admin', 'recepcionista'));


-- =========================================================================
-- 4. TRÍGGER DE CREACIÓN AUTOMÁTICA DE PERFIL (auth.users -> public.users)
-- =========================================================================
-- Sincroniza automáticamente los registros creados a través de Supabase Auth
-- con nuestra tabla pública de perfiles, conservando la consistencia e integridad.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- 5. RUTINA DE AUTOLIMPIEZA INTELIGENTE DE LOGS Y CHATS EXPIRADOS
-- =========================================================================
-- Optimiza el almacenamiento del ecosistema SaaS purgando el historial de chats de soporte
-- de más de 24 horas y los logs de auditoría general que superen los 30 días.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 6. SEMILLADO DE DATOS (INITIAL SEED DATA)
-- =========================================================================

-- 6.1 Super Administrador Principal para Soporte
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

-- 6.2 Hoteles y Propiedades de Demostración Inicial
INSERT INTO public.hotels (id, nombre, logo, portada, imagenes, descripcion, ubicacion, coordenadas, googleMapsUrl, servicios, politicas, horarios, contacto, redesSociales, estado, tipoEstablecimiento) VALUES
(
  'hotel-quito',
  'Roomia Plaza Hotel',
  'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800'
  ],
  'Elegante hotel corporativo y familiar en el centro financiero y cultural de Quito, Ecuador. Ofrece una experiencia premium de hospitalidad y descanso.',
  'Av. de los Shyris N34-12 y Naciones Unidas, Quito, Ecuador',
  '{"lat": -0.1807, "lng": -78.4678}'::jsonb,
  'https://maps.google.com/?q=-0.1807,-78.4678',
  ARRAY['WiFi de alta velocidad gratis', 'Gimnasio equipado', 'Restaurante Gourmet', 'Estacionamiento cubierto gratuito', 'Centro de Negocios'],
  ARRAY['No se permiten mascotas', 'Check-in obligatorio con documento oficial', 'Cancelaciones gratuitas con 24 horas de anticipación'],
  '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb,
  '{"telefono": "+593 2-2999-999", "email": "quito@roomia-pms.com", "web": "www.roomia-pms.com"}'::jsonb,
  '{"facebook": "roomia.quito", "instagram": "roomia.quito", "twitter": "roomia_quito"}'::jsonb,
  'activo',
  'hotel'
),
(
  'propiedad-manta',
  'Manta Beachfront Luxury House',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&auto=format&fit=crop&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'
  ],
  'Hermosa casa vacacional con salida directa al mar en la playa más exclusiva de Manta. Diseñada para hospedar a familias enteras y grupos que buscan total privacidad.',
  'Vía Barbasquillo, Manta, Ecuador',
  '{"lat": -0.9525, "lng": -80.7423}'::jsonb,
  'https://maps.google.com/?q=-0.9525,-80.7423',
  ARRAY['Piscina privada', 'Acceso directo a playa', 'Zona de barbacoa (BBQ)', 'Aire acondicionado central', 'Estacionamiento privado para 3 autos'],
  ARRAY['Se permiten mascotas previa notificación', 'No se permiten eventos ruidosos después de las 22:00', 'Depósito de seguridad obligatorio'],
  '{"checkIn": "14:00", "checkOut": "11:00"}'::jsonb,
  '{"telefono": "+593 5-2666-888", "email": "manta.house@roomia-pms.com", "web": "www.roomia-pms.com"}'::jsonb,
  '{"facebook": "roomia.manta", "instagram": "roomia.manta", "twitter": "roomia_manta"}'::jsonb,
  'activo',
  'propiedad'
)
ON CONFLICT (id) DO NOTHING;

-- 6.3 Habitaciones y Unidades Iniciales
INSERT INTO public.rooms (id, hotelId, numero, nombre, precio, capacidad, camas, tipo, imagenes, servicios, estado, adicionar_iva) VALUES
(
  'room-101',
  'hotel-quito',
  '101',
  'Habitación King Superior',
  85.00,
  2,
  1,
  'Estándar',
  ARRAY['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800'],
  ARRAY['Cama King Size', 'Smart TV 55"', 'Escritorio de trabajo', 'Cafetera cápsulas', 'Caja fuerte'],
  'disponible',
  TRUE
),
(
  'room-202',
  'hotel-quito',
  '202',
  'Doble Twin Ejecutiva',
  110.00,
  4,
  2,
  'Doble',
  ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'],
  ARRAY['Dos camas Queen', 'Smart TV 55"', 'Frigobar surtido', 'Escritorio ejecutivo', 'Vista a la ciudad'],
  'disponible',
  TRUE
),
(
  'room-suite-executive',
  'hotel-quito',
  '501',
  'Suite Presidencial Roomia',
  250.00,
  2,
  1,
  'Suite Presidencial',
  ARRAY['https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800'],
  ARRAY['Cama King Imperial', 'Jacuzzi privado', 'Sala de estar integrada', 'Bar premium', 'Sistema de sonido Bose'],
  'disponible',
  TRUE
),
-- Propiedad de Manta: Una unidad que representa la casa entera
(
  'room-propiedad-entera',
  'propiedad-manta',
  'UNICA',
  'Villa Manta Beach Completa',
  350.00,
  8,
  5,
  'Suite',
  ARRAY['https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800'],
  ARRAY['5 Dormitorios', 'Piscina infinity', 'Acceso directo a playa', 'Cancha de volleyball', 'Servicio de mayordomo opcional'],
  'disponible',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 6.4 Detalles Extra de Propiedades para Casas & Departamentos
INSERT INTO public.property_details (id, hotel_id, property_type, listing_type, bedrooms, bathrooms, square_meters, furnished, parking, owner_name, owner_phone, owner_email, owner_document, price) VALUES
(
  'prop-detail-manta',
  'propiedad-manta',
  'casa',
  'alquiler',
  5,
  6,
  420.50,
  TRUE,
  TRUE,
  'Andrés Mendoza',
  '+593 99-888-7777',
  'andres.mendoza@propietario.com',
  '1308493721',
  350.00
)
ON CONFLICT (id) DO NOTHING;
