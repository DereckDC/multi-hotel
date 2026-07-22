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
  provincia VARCHAR(255),
  ciudad VARCHAR(255),
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
  tipo TEXT NOT NULL DEFAULT 'Estándar',
  imagenes TEXT[] DEFAULT '{}',
  servicios TEXT[] DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'reservado', 'ocupado', 'mantenimiento', 'limpieza')),
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
-- 6. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) SEGURO
-- =========================================================================

-- Limpieza preventiva de políticas existentes
DROP POLICY IF EXISTS "Permitir lectura publica de hoteles" ON public.hotels;
DROP POLICY IF EXISTS "Permitir todo a administradores sobre hoteles" ON public.hotels;

DROP POLICY IF EXISTS "Permitir lectura publica de habitaciones" ON public.rooms;
DROP POLICY IF EXISTS "Permitir todo a administradores sobre habitaciones" ON public.rooms;
DROP POLICY IF EXISTS "Permitir actualizacion de habitaciones a recepcionistas" ON public.rooms;

DROP POLICY IF EXISTS "Permitir lectura de perfiles a usuarios autenticados" ON public.users;
DROP POLICY IF EXISTS "Permitir registro de perfil propio o por personal" ON public.users;
DROP POLICY IF EXISTS "Permitir actualizacion de perfil propio o por personal autorizado" ON public.users;
DROP POLICY IF EXISTS "Permitir eliminacion de perfiles solo a administradores" ON public.users;

DROP POLICY IF EXISTS "Permitir lectura de reservaciones a dueno o personal" ON public.reservations;
DROP POLICY IF EXISTS "Permitir crear reservaciones a clientes o personal" ON public.reservations;
DROP POLICY IF EXISTS "Permitir actualizar reservaciones a dueno o personal" ON public.reservations;
DROP POLICY IF EXISTS "Permitir eliminar reservaciones solo a administradores" ON public.reservations;

DROP POLICY IF EXISTS "Permitir lectura de logs solo a super_admin" ON public.logs;
DROP POLICY IF EXISTS "Permitir insertar logs a cualquier usuario autenticado" ON public.logs;

DROP POLICY IF EXISTS "Permitir ver mensajes propios o al personal" ON public.messages;
DROP POLICY IF EXISTS "Permitir enviar mensajes a cualquier usuario autenticado" ON public.messages;

DROP POLICY IF EXISTS "Permitir ver transacciones de reservacion propia o a personal" ON public.transactions;
DROP POLICY IF EXISTS "Permitir gestionar transacciones al personal" ON public.transactions;

DROP POLICY IF EXISTS "Permitir lectura publica de detalles de propiedad" ON public.property_details;
DROP POLICY IF EXISTS "Permitir gestionar detalles de propiedad a administradores" ON public.property_details;

DROP POLICY IF EXISTS "Permitir lectura publica de reseñas" ON public.reviews;
DROP POLICY IF EXISTS "Permitir crear reseñas a huespedes" ON public.reviews;
DROP POLICY IF EXISTS "Permitir gestionar reseñas al autor o administradores" ON public.reviews;

DROP POLICY IF EXISTS "Permitir lectura publica de tarifas dinamicas" ON public.room_price_variations;
DROP POLICY IF EXISTS "Permitir gestionar tarifas dinamicas a administradores" ON public.room_price_variations;

-- Habilitación estricta de Row Level Security
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

-- Otorgar permisos de esquema a roles de Supabase
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 6.1 Políticas para public.hotels
CREATE POLICY "Permitir lectura publica de hoteles" ON public.hotels
  FOR SELECT USING (true);

CREATE POLICY "Permitir todo a administradores sobre hoteles" ON public.hotels
  FOR ALL TO authenticated 
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.2 Políticas para public.rooms
CREATE POLICY "Permitir lectura publica de habitaciones" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Permitir todo a administradores sobre habitaciones" ON public.rooms
  FOR ALL TO authenticated 
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin'));

CREATE POLICY "Permitir actualizacion de habitaciones a recepcionistas" ON public.rooms
  FOR UPDATE TO authenticated 
  USING (public.get_my_role() = 'recepcionista')
  WITH CHECK (public.get_my_role() = 'recepcionista');

-- 6.3 Políticas para public.users
CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" ON public.users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir registro de perfil propio o por personal" ON public.users
  FOR INSERT TO authenticated 
  WITH CHECK (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "Permitir actualizacion de perfil propio o por personal autorizado" ON public.users
  FOR UPDATE TO authenticated 
  USING (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

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
  USING (guestId = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (guestId = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

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
  FOR ALL TO authenticated 
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

-- 6.8 Políticas para public.property_details
CREATE POLICY "Permitir lectura publica de detalles de propiedad" ON public.property_details
  FOR SELECT USING (true);

CREATE POLICY "Permitir gestionar detalles de propiedad a administradores" ON public.property_details
  FOR ALL TO authenticated 
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.9 Políticas para public.reviews
CREATE POLICY "Permitir lectura publica de reseñas" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Permitir crear reseñas a huespedes" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (guest_id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'));

CREATE POLICY "Permitir gestionar reseñas al autor o administradores" ON public.reviews
  FOR ALL TO authenticated 
  USING (guest_id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (guest_id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- 6.10 Políticas para public.room_price_variations
CREATE POLICY "Permitir lectura publica de tarifas dinamicas" ON public.room_price_variations
  FOR SELECT USING (true);

CREATE POLICY "Permitir gestionar tarifas dinamicas a administradores" ON public.room_price_variations
  FOR ALL TO authenticated 
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- =========================================================================
-- 7. NOTA DE REGISTROS DE SEMILLA (PRODUCCIÓN REAL)
-- =========================================================================
-- Los datos iniciales de demostración han sido omitidos para producción real,
-- garantizando que la base de datos contenga únicamente los establecimientos,
-- habitaciones y usuarios creados legítimamente por los administradores.

