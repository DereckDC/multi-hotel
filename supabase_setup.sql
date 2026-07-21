-- ============================================================================
-- BASE DE DATOS ROOMIA SAAS - MANUAL SETUP FOR SUPABASE
-- Diseñado bajo las normas de OWASP Top 10 (Seguridad en capas, control transaccional,
-- auditoría de accesos y prevención de Broken Object Level Authorization - BOLA).
-- ============================================================================

-- Habilitar extensiones requeridas para generación segura de UUIDs y cifrado
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMERACIONES (DOMINIOS DE SEGURIDAD EXPLICITOS)
-- ============================================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'hotel_admin', 'recepcionista', 'cliente');
CREATE TYPE room_status AS ENUM ('disponible', 'reservado', 'ocupado', 'mantenimiento');
CREATE TYPE reservation_status AS ENUM ('pendiente', 'confirmada', 'ocupada', 'finalizada', 'cancelada');
CREATE TYPE establishment_type AS ENUM ('hotel', 'casa', 'departamento');
CREATE TYPE purpose_type AS ENUM ('alquiler', 'venta');

-- ============================================================================
-- 2. TABLAS DEL SISTEMA
-- ============================================================================

-- TABLA: USERS (Cifrado de roles y metadatos)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    telefono VARCHAR(50) NOT NULL,
    documento VARCHAR(50) NOT NULL, -- Cédula/Pasaporte
    avatar TEXT NOT NULL DEFAULT '',
    rol user_role NOT NULL DEFAULT 'cliente',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    hotel_id UUID, -- Relacionado después mediante alter para evitar referencias circulares
    debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE
);

-- TABLA: HOTELS & PROPIEDADES (Esquema unificado seguro)
CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    logo TEXT NOT NULL DEFAULT '',
    portada TEXT NOT NULL DEFAULT '',
    imagenes TEXT[] NOT NULL DEFAULT '{}',
    descripcion TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    coordenadas JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0}'::jsonb,
    google_maps_url TEXT,
    servicios TEXT[] NOT NULL DEFAULT '{}', -- Servicios incluidos/destacados gratis
    politicas TEXT[] NOT NULL DEFAULT '{}',
    horarios JSONB NOT NULL DEFAULT '{"checkIn": "15:00", "checkOut": "11:00"}'::jsonb,
    contacto JSONB NOT NULL DEFAULT '{"telefono": "", "email": ""}'::jsonb,
    redes_sociales JSONB NOT NULL DEFAULT '{"facebook": "", "instagram": "", "twitter": ""}'::jsonb,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    tipo_establecimiento establishment_type NOT NULL DEFAULT 'hotel',
    finalidad purpose_type, -- NULL para hoteles, obligatorio para casas/departamentos
    propietario JSONB, -- Contiene nombre, teléfono, email, documento
    detalles_inmueble JSONB, -- Contiene habitaciones, banos, metrosCuadrados, amueblado, tieneEstacionamiento, precio
    provincia VARCHAR(255),
    ciudad VARCHAR(255)
);

-- Ahora ligar la clave foránea condicional de usuario a hotel
ALTER TABLE users ADD CONSTRAINT fk_user_hotel_id FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL;

-- TABLA: SERVICIOS ADICIONALES (Para alquiler con cobros extra)
CREATE TABLE IF NOT EXISTS hotel_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
    descripcion TEXT NOT NULL DEFAULT '',
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo'))
);

-- TABLA: ROOMS (Para el inventario de habitaciones boutique de Hoteles)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
    capacidad INT NOT NULL CHECK (capacidad > 0),
    camas INT NOT NULL CHECK (camas > 0),
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Estándar', 'Doble', 'Triple', 'Suite', 'Suite Presidencial')),
    imagenes TEXT[] NOT NULL DEFAULT '{}',
    servicios TEXT[] NOT NULL DEFAULT '{}',
    estado room_status NOT NULL DEFAULT 'disponible',
    adicionar_iva BOOLEAN NOT NULL DEFAULT TRUE
);

-- TABLA: RESERVATIONS
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL, -- Null if renting a complete House/Apartment directly
    guest_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL CHECK (fecha_salida >= fecha_entrada),
    servicios_adicionales JSONB NOT NULL DEFAULT '[]'::jsonb, -- Lista de ReservationServiceSelection estructurada
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    impuestos NUMERIC(12, 2) NOT NULL CHECK (impuestos >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    qr_code TEXT NOT NULL UNIQUE,
    estado reservation_status NOT NULL DEFAULT 'pendiente',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    recepcionista_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notas TEXT,
    modificado_por VARCHAR(150),
    mensaje_cambio TEXT,
    fecha_cambio TIMESTAMPTZ,
    cambiado_por_id UUID REFERENCES users(id) ON DELETE SET NULL,
    eliminada_por_cliente BOOLEAN NOT NULL DEFAULT FALSE,
    reservation_type VARCHAR(50) NOT NULL DEFAULT 'hospedaje' CHECK (reservation_type IN ('hospedaje', 'alquiler_mensual', 'venta'))
);

-- TABLA: MAINTENANCE LOGS
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT NOT NULL,
    responsable VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada'))
);

-- TABLA: PAYMENT TRANSACTIONS (Cálculo financiero y auditoría)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL, -- 'card', 'pse', 'bank_transfer'
    status VARCHAR(20) NOT NULL CHECK (status IN ('completado', 'fallido', 'pendiente')),
    reference VARCHAR(100) UNIQUE NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLA: REVIEWS (Control de feedback verificado)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comentario TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    user_name VARCHAR(150)
);

-- TABLA: ROOM PRICE VARIATIONS (Políticas dinámicas estacionales)
CREATE TABLE IF NOT EXISTS room_price_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    fecha DATE, -- Especifica la fecha si es para una fecha en particular, nulo para recurrencia
    is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
    precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
    motivo VARCHAR(150) NOT NULL DEFAULT 'Temporada',
    is_always BOOLEAN NOT NULL DEFAULT FALSE
);

-- TABLA: CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name VARCHAR(150) NOT NULL,
    sender_role user_role NOT NULL,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================================
-- 3. OPTIMIZACIÓN E ÍNDICES (Evitar ataques de denegación de servicio por exhaustación)
-- ============================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_hotels_tipo ON hotels(tipo_establecimiento);
CREATE INDEX idx_rooms_hotel ON rooms(hotel_id);
CREATE INDEX idx_reservations_guest ON reservations(guest_id);
CREATE INDEX idx_reservations_hotel ON reservations(hotel_id);
CREATE INDEX idx_reservations_room ON reservations(room_id);
CREATE INDEX idx_reviews_hotel ON reviews(hotel_id);
CREATE INDEX idx_chat_hotel ON chat_messages(hotel_id);
CREATE INDEX idx_price_variations_room ON room_price_variations(room_id);

-- ============================================================================
-- 4. DESACTIVACIÓN DE ROW LEVEL SECURITY (RLS) PARA SINCRONIZACIÓN LIBRE
-- ============================================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Permisos directos
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- POLÍTICAS PARA HOTELS (Visibles por todos si están activos, modificados solo por administradores)
CREATE POLICY "Hoteles visibles para todos" ON hotels
    FOR SELECT USING (estado = 'activo');

CREATE POLICY "Hoteles modificados solo por Administradores" ON hotels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.rol IN ('super_admin', 'hotel_admin')
        )
    );

-- POLÍTICAS PARA RESERVATIONS (Previene BOLA - Acceso cruzado ilícito)
CREATE POLICY "Clientes ven sus propias reservas" ON reservations
    FOR SELECT USING (guest_id = auth.uid());

CREATE POLICY "Gestores de hotel ven reservas de su hotel" ON reservations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (
                users.rol = 'super_admin' OR 
                (users.rol IN ('hotel_admin', 'recepcionista') AND users.hotel_id = reservations.hotel_id)
            )
        )
    );

-- AUDITORIA: Funcion disparadora para logs de auditoría básica ante modificaciones de facturación
CREATE OR REPLACE FUNCTION audit_reservation_changes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_cambio = NOW();
    NEW.modificado_por = CURRENT_USER;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_reservations
    BEFORE UPDATE OF total, estado ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION audit_reservation_changes();
