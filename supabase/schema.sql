-- =============================================================================
--  ROOMIA PMS — ESQUEMA COMPLETO DE BASE DE DATOS (archivo único)
-- =============================================================================
--
--  Este es el ÚNICO archivo SQL del proyecto. Crea desde cero todo lo que la
--  aplicación necesita en un proyecto nuevo de Supabase:
--
--    1. Extensiones
--    2. Tablas (con sus restricciones e índices)
--    3. Claves foráneas
--    4. Funciones
--    5. Triggers (disparadores), incluidos los de auth.users
--    6. Seguridad por filas (RLS) y políticas
--    7. Permisos (GRANT / REVOKE)
--    8. Tiempo real (Realtime)
--    9. Almacenamiento de imágenes (Storage)
--   10. Secretos (Vault) y tareas programadas (pg_cron)
--   11. Registro del superadministrador
--
--  NO contiene datos: ni hoteles, ni habitaciones, ni usuarios de ejemplo.
--
--  CÓMO USARLO EN UNA BASE NUEVA
--  -----------------------------
--   a) Crea el proyecto en Supabase.
--   b) Busca y reemplaza en este archivo  TU-PROYECTO  por la referencia del
--      proyecto nuevo (la parte de https://xxxx.supabase.co). Aparece 2 veces:
--      en la función sri_disparar_pendientes() y en la tarea roomia-ical-sync.
--   c) Pega el archivo completo en el SQL Editor de Supabase y ejecútalo.
--      Se puede volver a ejecutar sin romper nada (usa IF NOT EXISTS,
--      CREATE OR REPLACE y DROP ... IF EXISTS).
--   d) Sigue la sección 11 para crear el superadministrador.
--   e) Despliega las Edge Functions (payphone, sri, ical, notify-reservation,
--      import-image) y configura sus secretos:
--        PAYPHONE_TOKEN, PAYPHONE_STORE_ID, ROOMIA_SEND_EMAIL_URL
--      (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo).
--   f) En Vercel / .env pon VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
--      (la clave "publishable" del proyecto nuevo).
--
--  REGLA DE MANTENIMIENTO
--  ----------------------
--  Toda corrección o cambio en la base de datos (tabla, columna, función,
--  política, trigger, permiso, cron…) se aplica en producción Y se refleja
--  aquí mismo, en la sección que corresponde. No se crean archivos SQL nuevos.
--
--  Convenciones del proyecto:
--   - Los id de hoteles, habitaciones, reservas y usuarios son TEXT (el id del
--     usuario es el uuid de auth.users convertido a texto).
--   - Las fechas de reservas se guardan como texto 'AAAA-MM-DD'.
--   - Roles de usuario: super_admin, hotel_admin, recepcionista, cliente.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONES
-- =============================================================================
-- pgcrypto / uuid-ossp: generación de uuid y bytes aleatorios.
-- pg_net: llamadas HTTP desde la base (cron → Edge Functions).
-- pg_cron: tareas programadas.
-- supabase_vault: secretos cifrados (tokens internos y firmas .p12 del SRI).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;


-- =============================================================================
-- 2. TABLAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 hotels — establecimientos (hoteles, casas, departamentos).
--     owner_id: anfitrión (hotel_admin) dueño de la propiedad. Un anfitrión
--     puede tener varias propiedades según su plan (ver limite_propiedades).
--     contacto->'tipoEstablecimiento' distingue hotel / casa / departamento.
-- -----------------------------------------------------------------------------
create table if not exists public.hotels (
  id                  text primary key,
  nombre              text not null,
  logo                text,
  portada             text,
  imagenes            text[] default '{}'::text[],
  descripcion         text,
  ubicacion           text,
  coordenadas         jsonb default '{"lat": -0.1807, "lng": -78.4678}'::jsonb,
  googlemapsurl       text,
  servicios           text[] default '{}'::text[],
  politicas           text[] default '{}'::text[],
  horarios            jsonb default '{"checkIn": "15:00", "checkOut": "12:00"}'::jsonb,
  contacto            jsonb default '{"web": "", "email": "", "telefono": ""}'::jsonb,
  redessociales       jsonb default '{"twitter": "", "facebook": "", "instagram": ""}'::jsonb,
  estado              text default 'activo' check (estado in ('activo', 'inactivo', 'mantenimiento')),
  tipoestablecimiento text default 'hotel' check (tipoestablecimiento in ('hotel', 'propiedad')),
  provincia           varchar(255),
  ciudad              varchar(255),
  parroquia           text,
  owner_id            text,
  created_at          timestamptz default now()
);
create index if not exists hotels_owner_idx on public.hotels (owner_id);

-- -----------------------------------------------------------------------------
-- 2.2 users — perfil de cada usuario. Se crea solo al registrarse en
--     Supabase Auth (trigger on_auth_user_created → handle_new_user).
--     hotelid: hotel asignado al personal (recepcionista / admin).
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id                  text primary key,
  nombre              text not null,
  apellido            text not null,
  email               text not null unique,
  telefono            text,
  documento           text,
  avatar              text,
  rol                 text not null default 'cliente'
                        check (rol in ('super_admin', 'hotel_admin', 'recepcionista', 'cliente')),
  fecharegistro       text not null default to_char(now(), 'YYYY-MM-DD'),
  estado              text not null default 'activo' check (estado in ('activo', 'inactivo', 'suspendido')),
  hotelid             text,
  debecambiarpassword boolean default false,
  created_at          timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 2.3 hotel_owners — datos privados del propietario (correo, documento).
--     Se separan de hotels.contacto, que es de lectura pública
--     (trigger hotels_separar_propietario).
-- -----------------------------------------------------------------------------
create table if not exists public.hotel_owners (
  hotel_id   text primary key,
  nombre     text,
  telefono   text,
  email      text,
  documento  text,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2.4 property_details — ficha de casas / departamentos (alquiler o venta).
--     owner_email y owner_document se vacían siempre (datos privados).
-- -----------------------------------------------------------------------------
create table if not exists public.property_details (
  id             text primary key,
  hotel_id       text unique,
  property_type  text check (property_type in ('hotel', 'casa', 'departamento')),
  listing_type   text check (listing_type in ('alquiler', 'venta')),
  bedrooms       integer default 0 check (bedrooms >= 0),
  bathrooms      integer default 0 check (bathrooms >= 0),
  square_meters  numeric default 0 check (square_meters >= 0),
  furnished      boolean default false,
  parking        boolean default false,
  owner_name     text,
  owner_phone    text,
  owner_email    text,
  owner_document text,
  price          numeric default 0 check (price >= 0),
  created_at     timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 2.5 rooms — habitaciones / unidades de cada hotel.
--     adicionar_iva: si el precio se muestra sin IVA y se le suma al cobrar.
-- -----------------------------------------------------------------------------
create table if not exists public.rooms (
  id            text primary key,
  hotelid       text,
  numero        text not null,
  nombre        text not null,
  descripcion   text,
  precio        numeric not null check (precio >= 0),
  capacidad     integer not null check (capacidad > 0),
  camas         integer not null default 1 check (camas > 0),
  tipo          text not null default 'Estándar',
  imagenes      text[] default '{}'::text[],
  servicios     text[] default '{}'::text[],
  estado        text not null default 'disponible'
                  check (estado in ('disponible', 'reservado', 'ocupado', 'mantenimiento', 'limpieza')),
  adicionar_iva boolean not null default true,
  created_at    timestamptz default now()
);
create index if not exists idx_rooms_hotelid on public.rooms (hotelid);

-- -----------------------------------------------------------------------------
-- 2.6 room_price_variations — precios especiales por fecha o fin de semana.
-- -----------------------------------------------------------------------------
create table if not exists public.room_price_variations (
  id         text primary key,
  room_id    text,
  hotel_id   text,
  fecha      text,
  is_weekend boolean default false,
  precio     numeric not null check (precio >= 0),
  motivo     text,
  created_at timestamptz default now()
);
create index if not exists idx_price_variations_room on public.room_price_variations (room_id, fecha);

-- -----------------------------------------------------------------------------
-- 2.7 reservations — reservas. roomid nulo = inmueble completo (casa/depto).
--     notes guarda el estado del pago en la marca [PAYMENT_INFO:{...}].
--     Triggers: evitan solapes, protegen el pago, sincronizan el estado de la
--     habitación y generan la factura SRI al finalizar.
-- -----------------------------------------------------------------------------
create table if not exists public.reservations (
  id                   text primary key,
  roomid               text,
  hotelid              text,
  guestid              text,
  fechaentrada         text not null,
  fechasalida          text not null,
  serviciosadicionales text[] default '{}'::text[],
  subtotal             numeric not null default 0 check (subtotal >= 0),
  impuestos            numeric not null default 0 check (impuestos >= 0),
  total                numeric not null check (total >= 0),
  noches               integer not null default 1 check (noches > 0),
  estado               text not null default 'pendiente'
                         check (estado in ('pendiente', 'confirmada', 'ocupada', 'finalizada', 'cancelada')),
  qrcode               text,
  checkedinat          text,
  checkedoutat         text,
  recepcionistaid      text,
  notes                text,
  modificadopor        text,
  mensajecambio        text,
  fechacambio          text,
  cambiadoporid        text,
  eliminadaporcliente  boolean default false,
  reservation_type     text default 'hospedaje'
                         check (reservation_type in ('hospedaje', 'alquiler_mensual', 'venta')),
  created_at           timestamptz default now()
);
create index if not exists idx_reservations_guestid on public.reservations (guestid);
create index if not exists idx_reservations_hotelid on public.reservations (hotelid);
create index if not exists idx_reservations_roomid  on public.reservations (roomid);

-- -----------------------------------------------------------------------------
-- 2.8 transactions — cobros registrados de cada reserva (efectivo, tarjeta…).
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id            text primary key,
  reservationid text not null,
  amount        numeric not null check (amount > 0),
  currency      text not null default 'USD',
  paymentmethod text not null,
  status        text not null default 'pendiente'
                  check (status in ('completado', 'fallido', 'pendiente', 'reembolsado')),
  reference     text not null unique,
  fecha         text not null,
  created_at    timestamptz default now()
);
create index if not exists idx_transactions_reservationid on public.transactions (reservationid);

-- -----------------------------------------------------------------------------
-- 2.9 reviews — reseñas de huéspedes.
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id             text primary key,
  reservation_id text,
  hotel_id       text,
  guest_id       text,
  rating         integer not null check (rating >= 1 and rating <= 5),
  comentario     text,
  fecha          text not null default to_char(now(), 'YYYY-MM-DD'),
  user_name      text,
  created_at     timestamptz default now()
);
create index if not exists idx_reviews_hotelid on public.reviews (hotel_id);

-- -----------------------------------------------------------------------------
-- 2.10 messages — chat de soporte en vivo (se borra a las 24 h).
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id          text primary key,
  senderid    text not null,
  sendername  text not null,
  senderrole  text not null,
  hotelid     text not null,
  text        text not null,
  "timestamp" text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);
create index if not exists idx_messages_cleanup on public.messages (created_at);
create index if not exists idx_messages_hotelid on public.messages (hotelid);

-- -----------------------------------------------------------------------------
-- 2.11 logs — bitácora de auditoría (se borra a los 30 días).
-- -----------------------------------------------------------------------------
create table if not exists public.logs (
  id          text primary key,
  "timestamp" text not null,
  "user"      text not null,
  role        text not null,
  action      text not null,
  detalles    text,
  created_at  timestamptz default now()
);
create index if not exists idx_logs_cleanup on public.logs (created_at);

-- -----------------------------------------------------------------------------
-- 2.12 subscriptions — plan de cada anfitrión (uno por usuario hotel_admin).
--     plan_id: roomia-1 / roomia-3 / roomia-5 (= propiedades permitidas).
--     sri_hasta: fecha hasta la que está pagado el módulo de facturación SRI.
--     El estado efectivo (al día, vencida, suspendida) lo calcula estado_plan().
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           text not null unique,
  plan_id            text not null default 'roomia-1' check (plan_id in ('roomia-1', 'roomia-3', 'roomia-5')),
  billing            text not null default 'mensual' check (billing in ('mensual', 'anual')),
  status             text not null default 'prueba' check (status in ('prueba', 'activa', 'suspendida', 'cancelada')),
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  grace_days         integer not null default 7 check (grace_days >= 0 and grace_days <= 60),
  setup_paid         boolean not null default false,
  sri_modulo         boolean not null default false,
  sri_hasta          timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2.13 payments — pagos en línea (Payphone) y manuales de reservas y planes.
--     Los montos van en centavos. Solo las Edge Functions (service_role)
--     escriben aquí; los usuarios solo leen sus pagos.
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                      uuid primary key default gen_random_uuid(),
  kind                    text not null
                            check (kind in ('reserva_abono', 'reserva_total', 'reserva_saldo', 'plan', 'puesta_en_marcha')),
  reservation_id          text,
  hotel_id                text,
  subscription_id         uuid,
  payer_id                uuid not null,
  amount_cents            integer not null check (amount_cents > 0),
  amount_with_tax         integer not null default 0,
  amount_without_tax      integer not null default 0,
  tax_cents               integer not null default 0,
  currency                text not null default 'USD',
  client_transaction_id   text not null unique,
  payphone_transaction_id text,
  status                  text not null default 'creado'
                            check (status in ('creado', 'procesando', 'aprobado', 'cancelado', 'expirado', 'error')),
  status_detail           text,
  card_brand              text,
  last_digits             text,
  authorization_code      text,
  method                  text not null default 'payphone'
                            check (method in ('payphone', 'transferencia', 'efectivo', 'otro')),
  recorded_by             text,
  details                 jsonb,
  created_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  constraint payments_suma_cuadra check (amount_cents = amount_with_tax + amount_without_tax + tax_cents)
);
create index if not exists payments_payer_idx        on public.payments (payer_id);
create index if not exists payments_reservation_idx  on public.payments (reservation_id);
create index if not exists payments_subscription_idx on public.payments (subscription_id);
create index if not exists payments_pendientes_idx   on public.payments (status, created_at)
  where status in ('creado', 'procesando');

-- -----------------------------------------------------------------------------
-- 2.14 ical_feeds — conexiones de calendario con Airbnb / Booking.
--     import_url: calendario externo que se importa.
--     export_token: token secreto de la URL que exporta el calendario Roomia.
-- -----------------------------------------------------------------------------
create table if not exists public.ical_feeds (
  id                   uuid primary key default gen_random_uuid(),
  hotel_id             text not null,
  room_id              text,
  platform             text not null check (platform in ('airbnb', 'booking', 'otro')),
  import_url           text,
  export_token         text not null
                         default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  etag                 text,
  last_modified        text,
  last_attempt_at      timestamptz,
  last_synced_at       timestamptz,
  last_export_at       timestamptz,
  last_status          text not null default 'pendiente' check (last_status in ('pendiente', 'ok', 'error')),
  last_error           text,
  last_event_count     integer not null default 0,
  consecutive_failures integer not null default 0,
  created_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint ical_feeds_export_token_uk unique (export_token),
  constraint ical_feeds_export_token_len check (length(export_token) >= 32)
);
create index if not exists ical_feeds_hotel_idx on public.ical_feeds (hotel_id);
-- Una sola conexión por unidad y plataforma (room_id nulo = inmueble completo).
create unique index if not exists ical_feeds_unit_platform_uk
  on public.ical_feeds (hotel_id, coalesce(room_id, ''), platform);

-- -----------------------------------------------------------------------------
-- 2.15 external_blocks — fechas ocupadas importadas de Airbnb / Booking.
--     conflict = true si choca con una reserva de Roomia.
-- -----------------------------------------------------------------------------
create table if not exists public.external_blocks (
  id           uuid primary key default gen_random_uuid(),
  feed_id      uuid not null,
  hotel_id     text not null,
  room_id      text,
  platform     text not null,
  uid          text not null,
  fecha_inicio text not null check (fecha_inicio ~ '^\d{4}-\d{2}-\d{2}$'),
  fecha_fin    text not null check (fecha_fin ~ '^\d{4}-\d{2}-\d{2}$'),
  summary      text,
  conflict     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint external_blocks_dates_ck check (fecha_fin > fecha_inicio),
  constraint external_blocks_feed_uid_uk unique (feed_id, uid)
);
create index if not exists external_blocks_unit_idx on public.external_blocks (hotel_id, room_id, fecha_inicio);

-- -----------------------------------------------------------------------------
-- 2.16 sri_emisores — datos tributarios de cada establecimiento para la
--     facturación electrónica del SRI (Ecuador). Uno por hotel.
--     ambiente: '1' pruebas, '2' producción. Los secuenciales avanzan solos.
-- -----------------------------------------------------------------------------
create table if not exists public.sri_emisores (
  hotel_id               text primary key,
  activo                 boolean not null default false,
  ruc                    text not null check (ruc ~ '^\d{10}(00[1-9]|0[1-9]\d|[1-9]\d\d)$'),
  razon_social           text not null check (length(btrim(razon_social)) between 1 and 300),
  nombre_comercial       text check (nombre_comercial is null or length(nombre_comercial) <= 300),
  dir_matriz             text not null check (length(btrim(dir_matriz)) between 1 and 300),
  dir_establecimiento    text check (dir_establecimiento is null or length(dir_establecimiento) <= 300),
  estab                  text not null default '001' check (estab ~ '^\d{3}$' and estab <> '000'),
  pto_emi                text not null default '001' check (pto_emi ~ '^\d{3}$' and pto_emi <> '000'),
  obligado_contabilidad  boolean not null default false,
  contribuyente_especial text check (contribuyente_especial is null or contribuyente_especial ~ '^[0-9A-Za-z]{3,13}$'),
  agente_retencion       text check (agente_retencion is null or agente_retencion ~ '^[1-9]\d{0,7}$'),
  regimen                text not null default 'general'
                           check (regimen in ('general', 'rimpe_emprendedor', 'rimpe_negocio_popular')),
  ambiente               text not null default '1' check (ambiente in ('1', '2')),
  codigo_iva             text not null default '4' check (codigo_iva in ('0', '2', '3', '4', '5', '6', '7', '10')),
  forma_pago             text not null default '19',
  correo_copia           text check (correo_copia is null or length(correo_copia) <= 254),
  secuencial_pruebas     bigint not null default 1 check (secuencial_pruebas between 1 and 999999999),
  secuencial_produccion  bigint not null default 1 check (secuencial_produccion between 1 and 999999999),
  cert_titular           text,
  cert_emisor            text,
  cert_valido_hasta      timestamptz,
  cert_subido_at         timestamptz,
  cert_ruc_ok            boolean,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2.17 sri_firmas — referencia a la firma electrónica (.p12) y su clave,
--     guardadas cifradas en Vault. Nadie fuera del servidor puede leerla.
-- -----------------------------------------------------------------------------
create table if not exists public.sri_firmas (
  hotel_id           text primary key,
  p12_secret_id      uuid not null,
  password_secret_id uuid not null,
  updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2.18 sri_comprobantes — facturas electrónicas emitidas y su cola de envío
--     al SRI (reintentos con proximo_intento / bloqueado_hasta).
-- -----------------------------------------------------------------------------
create table if not exists public.sri_comprobantes (
  id                  uuid primary key default gen_random_uuid(),
  hotel_id            text not null,
  reservation_id      text,
  origen              text not null default 'manual' check (origen in ('automatica', 'manual')),
  ambiente            text not null check (ambiente in ('1', '2')),
  ruc                 text not null,
  estab               text not null,
  pto_emi             text not null,
  secuencial          bigint not null check (secuencial between 1 and 999999999),
  clave_acceso        text not null unique check (clave_acceso ~ '^\d{49}$'),
  fecha_emision       date not null,
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente', 'procesando', 'recibida', 'autorizado', 'devuelta',
                                          'no_autorizado', 'error', 'anulado')),
  recibido            boolean not null default false,
  comprador           jsonb,
  items               jsonb,
  forma_pago          text,
  subtotal            numeric(12,2),
  iva                 numeric(12,2),
  total               numeric(12,2),
  xml_firmado         text,
  xml_autorizado      text,
  numero_autorizacion text,
  fecha_autorizacion  timestamptz,
  mensajes            jsonb not null default '[]'::jsonb,
  intentos            integer not null default 0,
  proximo_intento     timestamptz not null default now(),
  bloqueado_hasta     timestamptz,
  correo_estado       text not null default 'pendiente'
                        check (correo_estado in ('pendiente', 'enviado', 'sin_correo', 'sin_configurar', 'error')),
  correo_enviado_at   timestamptz,
  anulacion_portal    boolean not null default false,
  emitido_por         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint sri_comprobantes_numero_unico unique (ruc, ambiente, estab, pto_emi, secuencial)
);
create index if not exists sri_comprobantes_hotel_idx   on public.sri_comprobantes (hotel_id, created_at desc);
create index if not exists sri_comprobantes_reserva_idx on public.sri_comprobantes (reservation_id);
create index if not exists sri_comprobantes_cola_idx    on public.sri_comprobantes (estado, proximo_intento)
  where estado in ('pendiente', 'error', 'recibida');
-- Una sola factura vigente por reserva y ambiente.
create unique index if not exists sri_comprobantes_una_por_reserva
  on public.sri_comprobantes (reservation_id, ambiente)
  where reservation_id is not null and estado <> 'anulado';


-- =============================================================================
-- 3. CLAVES FORÁNEAS
-- =============================================================================
-- Van aparte porque hotels y users se referencian entre sí. La función
-- auxiliar ignora las que ya existen, para poder re-ejecutar el archivo.
create or replace function pg_temp.agregar_fk(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when duplicate_object or duplicate_table then null;
end $$;

select pg_temp.agregar_fk(x) from (values
  ('alter table public.hotels add constraint hotels_owner_id_fkey foreign key (owner_id) references public.users(id) on delete set null'),
  ('alter table public.users add constraint users_hotelid_fkey foreign key (hotelid) references public.hotels(id) on delete set null'),
  ('alter table public.hotel_owners add constraint hotel_owners_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade deferrable initially deferred'),
  ('alter table public.property_details add constraint property_details_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade'),
  ('alter table public.rooms add constraint rooms_hotelid_fkey foreign key (hotelid) references public.hotels(id) on delete cascade'),
  ('alter table public.room_price_variations add constraint room_price_variations_room_id_fkey foreign key (room_id) references public.rooms(id) on delete cascade'),
  ('alter table public.room_price_variations add constraint room_price_variations_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade'),
  ('alter table public.reservations add constraint reservations_roomid_fkey foreign key (roomid) references public.rooms(id) on delete cascade'),
  ('alter table public.reservations add constraint reservations_hotelid_fkey foreign key (hotelid) references public.hotels(id) on delete cascade'),
  ('alter table public.reservations add constraint reservations_guestid_fkey foreign key (guestid) references public.users(id) on delete cascade'),
  ('alter table public.reservations add constraint reservations_recepcionistaid_fkey foreign key (recepcionistaid) references public.users(id) on delete set null'),
  ('alter table public.reservations add constraint reservations_cambiadoporid_fkey foreign key (cambiadoporid) references public.users(id) on delete set null'),
  ('alter table public.transactions add constraint transactions_reservationid_fkey foreign key (reservationid) references public.reservations(id) on delete cascade'),
  ('alter table public.reviews add constraint reviews_reservation_id_fkey foreign key (reservation_id) references public.reservations(id) on delete cascade'),
  ('alter table public.reviews add constraint reviews_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade'),
  ('alter table public.reviews add constraint reviews_guest_id_fkey foreign key (guest_id) references public.users(id) on delete cascade'),
  ('alter table public.subscriptions add constraint subscriptions_owner_id_fkey foreign key (owner_id) references public.users(id) on delete cascade'),
  ('alter table public.payments add constraint payments_reservation_id_fkey foreign key (reservation_id) references public.reservations(id) on delete set null'),
  ('alter table public.payments add constraint payments_subscription_id_fkey foreign key (subscription_id) references public.subscriptions(id) on delete set null'),
  ('alter table public.ical_feeds add constraint ical_feeds_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade'),
  ('alter table public.ical_feeds add constraint ical_feeds_room_id_fkey foreign key (room_id) references public.rooms(id) on delete cascade'),
  ('alter table public.external_blocks add constraint external_blocks_feed_id_fkey foreign key (feed_id) references public.ical_feeds(id) on delete cascade'),
  ('alter table public.external_blocks add constraint external_blocks_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade'),
  ('alter table public.sri_emisores add constraint sri_emisores_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade'),
  ('alter table public.sri_firmas add constraint sri_firmas_hotel_id_fkey foreign key (hotel_id) references public.sri_emisores(hotel_id) on delete cascade'),
  ('alter table public.sri_comprobantes add constraint sri_comprobantes_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete restrict'),
  ('alter table public.sri_comprobantes add constraint sri_comprobantes_reservation_id_fkey foreign key (reservation_id) references public.reservations(id) on delete set null'),
  ('alter table public.sri_comprobantes add constraint sri_comprobantes_emitido_por_fkey foreign key (emitido_por) references public.users(id) on delete set null')
) as t(x);


-- =============================================================================
-- 4. FUNCIONES
-- =============================================================================
-- Casi todas son SECURITY DEFINER con search_path fijo: se ejecutan con
-- permisos del dueño para que las políticas RLS no entren en bucle y para
-- que el usuario no pueda alterar su comportamiento.
-- Se desactiva la validación de cuerpos para poder crearlas en cualquier orden.
set check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- 4.1 Roles y pertenencia a hoteles (los usan las políticas RLS)
-- -----------------------------------------------------------------------------

-- Rol del usuario que hace la petición ('anon' si no inició sesión).
create or replace function public.get_my_role()
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'anon';
  end if;
  select rol into v_role from public.users where id = auth.uid()::text limit 1;
  return coalesce(v_role, 'cliente');
end;
$function$;

-- Variante usada por el trigger anti-escalada de privilegios.
create or replace function public.get_auth_user_role()
returns text language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select rol from public.users where id = auth.uid()::text limit 1), 'anon');
$function$;

-- Rol de cualquier usuario por id (solo servidor).
create or replace function public.get_user_role(u_id text)
returns text language plpgsql security definer set search_path to 'public' as $function$
begin
  return (select rol from public.users where id = u_id limit 1);
end;
$function$;

-- Hotel asignado al usuario actual.
create or replace function public.get_my_hotel()
returns text language sql stable security definer set search_path to 'public' as $function$
  select u.hotelid from public.users u where u.id = auth.uid()::text limit 1;
$function$;

-- Hoteles que gestiona el usuario actual: los que posee (owner_id) más el
-- asignado en users.hotelid (personal).
create or replace function public.mis_hoteles()
returns setof text language sql stable security definer set search_path to 'public' as $function$
  select h.id from public.hotels h where h.owner_id = auth.uid()::text
  union
  select u.hotelid from public.users u where u.id = auth.uid()::text and u.hotelid is not null
$function$;

-- Anfitriones (dueños) de un hotel: owner_id y los hotel_admin asignados.
create or replace function public.duenos_del_hotel(p_hotel_id text)
returns setof text language sql stable security definer set search_path to 'public' as $function$
  select h.owner_id from public.hotels h where h.id = p_hotel_id and h.owner_id is not null
  union
  select u.id from public.users u where u.rol = 'hotel_admin' and u.hotelid = p_hotel_id
$function$;

-- ¿Un usuario dado gestiona este hotel?
create or replace function public.usuario_gestiona_hotel(p_user_id text, p_hotel_id text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.hotels h where h.id = p_hotel_id and h.owner_id = p_user_id)
      or exists (select 1 from public.users u where u.id = p_user_id and u.hotelid = p_hotel_id)
$function$;

-- ¿El usuario actual es superadmin o personal de este hotel?
create or replace function public.es_personal_del_hotel(p_hotel_id text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select public.get_my_role() = 'super_admin'
      or (public.get_my_role() in ('hotel_admin', 'recepcionista') and p_hotel_id in (select public.mis_hoteles()))
$function$;

-- ¿La petición viene del personal o del servidor (service_role / sin JWT)?
create or replace function public.es_personal_o_servidor()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select
    coalesce(auth.jwt() ->> 'role', '') in ('', 'service_role')
    or public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']);
$function$;

-- ¿Ya existe una cuenta con ese correo? (registro y recuperación).
create or replace function public.is_email_registered(p_email text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.users u where lower(u.email) = lower(trim(p_email)));
$function$;

-- -----------------------------------------------------------------------------
-- 4.2 Usuarios y Supabase Auth
-- -----------------------------------------------------------------------------

-- Crea el perfil en public.users cuando alguien se registra en Auth.
-- Todos nacen como 'cliente'; el superadmin cambia el rol después.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.users (
    id, nombre, apellido, email, telefono, documento, avatar,
    rol, estado, fecharegistro, debecambiarpassword
  )
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'apellido', 'Nuevo'),
    new.email,
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce(new.raw_user_meta_data->>'documento', ''),
    coalesce(new.raw_user_meta_data->>'avatar', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
    'cliente',
    'activo',
    to_char(now(), 'YYYY-MM-DD'),
    false
  )
  on conflict (id) do update set
    nombre = excluded.nombre,
    apellido = excluded.apellido,
    email = excluded.email;
  return new;
end;
$function$;

-- Si el correo cambia en Auth, se copia al perfil.
create or replace function public.sync_profile_email_from_auth()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.email is not null and new.email is distinct from old.email then
    begin
      update public.users set email = new.email
      where id = new.id::text and email is distinct from new.email;
    exception when unique_violation then
      null;
    end;
  end if;
  return new;
end;
$function$;

-- El correo del perfil no se edita a mano: siempre manda el de Auth.
create or replace function public.users_keep_auth_email()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_auth_email text;
begin
  if new.email is distinct from old.email then
    select a.email into v_auth_email from auth.users a where a.id::text = new.id limit 1;
    if v_auth_email is not null then
      new.email := v_auth_email;
    end if;
  end if;
  return new;
end;
$function$;

-- Solo el superadmin (o el servidor) puede cambiar rol y hotelid de un usuario.
-- Por eso, para crear el superadmin (sección 11) se usa "set local role service_role".
create or replace function public.prevent_user_privilege_escalation()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  executor_role text;
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  executor_role := public.get_auth_user_role();
  if executor_role != 'super_admin' then
    if old.rol is distinct from new.rol then
      new.rol := old.rol;
    end if;
    if old.hotelid is distinct from new.hotelid then
      new.hotelid := old.hotelid;
    end if;
  end if;
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.3 Hoteles y propiedades
-- -----------------------------------------------------------------------------

-- Propiedades que permite el plan del anfitrión (1, 3 o 5; sin plan = 1).
create or replace function public.limite_propiedades(p_owner_id text)
returns integer language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select case s.plan_id when 'roomia-5' then 5 when 'roomia-3' then 3 else 1 end
      from public.subscriptions s where s.owner_id = p_owner_id
  ), 1)
$function$;

-- Al crear un hotel, el dueño es quien lo crea (salvo superadmin/servidor) y no
-- puede pasar el límite de su plan. Error: PLAN_LIMITE_PROPIEDADES.
create or replace function public.hotels_dueno_y_limite()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_rol text := public.get_my_role();
  v_servidor boolean := coalesce(current_setting('role', true), '') = 'service_role' or auth.uid() is null;
begin
  if not v_servidor and v_rol is distinct from 'super_admin' then
    if tg_op = 'INSERT' then
      new.owner_id := auth.uid()::text;
    elsif new.owner_id is distinct from old.owner_id then
      new.owner_id := old.owner_id;
    end if;
  end if;

  if new.owner_id is not null and v_rol is distinct from 'super_admin' and not v_servidor
     and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
    if (select count(*) from public.hotels h where h.owner_id = new.owner_id and h.id <> new.id)
       >= public.limite_propiedades(new.owner_id) then
      raise exception 'PLAN_LIMITE_PROPIEDADES: tu plan permite % %. Cambia de plan en "Mi plan" para agregar más.',
        public.limite_propiedades(new.owner_id),
        case when public.limite_propiedades(new.owner_id) = 1 then 'propiedad' else 'propiedades' end
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

-- Mueve correo y documento del propietario a hotel_owners (privado) y deja en
-- hotels.contacto solo nombre y teléfono (públicos).
create or replace function public.hotels_separar_propietario()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  p jsonb;
  v_nombre text;
  v_tel text;
  v_email text;
  v_doc text;
begin
  p := new.contacto -> 'propietario';
  if p is null or jsonb_typeof(p) <> 'object' then
    return new;
  end if;

  v_nombre := nullif(btrim(p ->> 'nombre'), '');
  v_tel := nullif(btrim(p ->> 'telefono'), '');
  v_email := nullif(btrim(p ->> 'email'), '');
  v_doc := nullif(btrim(p ->> 'documento'), '');

  if coalesce(v_nombre, v_tel, v_email, v_doc) is not null then
    insert into public.hotel_owners (hotel_id, nombre, telefono, email, documento)
    values (new.id, v_nombre, v_tel, v_email, v_doc)
    on conflict (hotel_id) do update set
      nombre = coalesce(excluded.nombre, public.hotel_owners.nombre),
      telefono = coalesce(excluded.telefono, public.hotel_owners.telefono),
      email = coalesce(excluded.email, public.hotel_owners.email),
      documento = coalesce(excluded.documento, public.hotel_owners.documento),
      updated_at = now();
  end if;

  new.contacto := jsonb_set(
    new.contacto,
    '{propietario}',
    jsonb_build_object('nombre', coalesce(p ->> 'nombre', ''), 'telefono', coalesce(p ->> 'telefono', ''))
  );
  return new;
end;
$function$;

-- property_details es de lectura pública: nunca guarda correo ni documento.
create or replace function public.property_details_sin_datos_privados()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  new.owner_email := null;
  new.owner_document := null;
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.4 Planes de anfitriones (suscripciones)
-- -----------------------------------------------------------------------------

-- Estado efectivo del plan: sin_plan, prueba, activa, vencida (en días de
-- gracia), suspendida o cancelada.
create or replace function public.estado_plan(s public.subscriptions)
returns text language sql stable set search_path to 'public' as $function$
  select case
    when s.id is null then 'sin_plan'
    when s.status in ('cancelada', 'suspendida') then s.status
    when coalesce(s.current_period_end, s.trial_ends_at) is null then 'sin_plan'
    when now() <= coalesce(s.current_period_end, s.trial_ends_at) then s.status
    when now() <= coalesce(s.current_period_end, s.trial_ends_at) + make_interval(days => greatest(s.grace_days, 0)) then 'vencida'
    else 'suspendida'
  end
$function$;

-- ¿El hotel recibe reservas nuevas? No, si su anfitrión está suspendido o cancelado.
create or replace function public.hotel_admite_reservas(p_hotel_id text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select not exists (
    select 1 from public.subscriptions s
     where s.owner_id in (select public.duenos_del_hotel(p_hotel_id))
       and public.estado_plan(s) in ('suspendida', 'cancelada')
  )
$function$;

-- Lista de hoteles que no reciben reservas (el catálogo los muestra "No disponible").
create or replace function public.hoteles_sin_reservas()
returns setof text language sql stable security definer set search_path to 'public' as $function$
  select h.id from public.hotels h where not public.hotel_admite_reservas(h.id)
$function$;

-- Aplica un cobro de plan aprobado: extiende el periodo un mes o un año,
-- activa el módulo SRI (sri_hasta) y marca la puesta en marcha si se pagó.
create or replace function public._aplicar_cobro_plan(pay public.payments)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  sub public.subscriptions%rowtype;
  v_plan text := coalesce(pay.details ->> 'planId', 'roomia-1');
  v_billing text := coalesce(pay.details ->> 'billing', 'mensual');
  v_sri boolean := coalesce((pay.details ->> 'sri')::boolean, false);
  v_setup boolean := coalesce((pay.details ->> 'setup')::boolean, false);
  v_base timestamptz;
  v_fin timestamptz;
begin
  select * into sub from public.subscriptions where owner_id = pay.payer_id::text for update;
  if not found then
    insert into public.subscriptions (owner_id, plan_id, billing, status)
    values (pay.payer_id::text, v_plan, v_billing, 'activa')
    returning * into sub;
  end if;

  if pay.kind = 'puesta_en_marcha' then
    update public.subscriptions set setup_paid = true where id = sub.id;
  else
    v_base := greatest(now(), coalesce(sub.current_period_end, now()));
    v_fin := v_base + case when v_billing = 'anual' then interval '1 year' else interval '1 month' end;
    update public.subscriptions set
      plan_id = v_plan,
      billing = v_billing,
      sri_modulo = v_sri,
      sri_hasta = case when v_sri then v_fin else sri_hasta end,
      setup_paid = setup_paid or v_setup,
      status = case when status = 'cancelada' then 'cancelada' else 'activa' end,
      current_period_end = v_fin
    where id = sub.id;
  end if;

  update public.payments set subscription_id = sub.id where id = pay.id;
  select * into sub from public.subscriptions where id = sub.id;
  return jsonb_build_object('subscriptionId', sub.id, 'currentPeriodEnd', sub.current_period_end,
    'setupPaid', sub.setup_paid, 'sriModulo', sub.sri_modulo, 'sriHasta', sub.sri_hasta);
end;
$function$;

-- Confirma un pago de plan hecho con Payphone (lo llama la Edge Function payphone).
create or replace function public.aplicar_pago_plan(
  p_payment_id uuid, p_payphone_id text, p_card_brand text, p_last_digits text, p_authorization_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  pay public.payments%rowtype;
  result jsonb;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'pago no encontrado';
  end if;
  if pay.kind not in ('plan', 'puesta_en_marcha') then
    raise exception 'el pago no es de un plan';
  end if;
  if pay.status = 'aprobado' then
    return jsonb_build_object('yaAplicado', true);
  end if;

  result := public._aplicar_cobro_plan(pay);
  update public.payments set
    status = 'aprobado',
    status_detail = null,
    payphone_transaction_id = nullif(p_payphone_id, ''),
    card_brand = nullif(p_card_brand, ''),
    last_digits = nullif(p_last_digits, ''),
    authorization_code = nullif(p_authorization_code, ''),
    confirmed_at = now()
  where id = pay.id;
  return result;
end;
$function$;

-- Pago manual de plan (transferencia, efectivo) registrado por el superadmin.
create or replace function public.registrar_pago_plan_manual(
  p_owner_id text, p_kind text, p_plan_id text, p_billing text, p_amount numeric,
  p_method text, p_note text, p_sri boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  pay public.payments%rowtype;
  v_cents integer := round(coalesce(p_amount, 0) * 100);
  result jsonb;
begin
  if public.get_my_role() <> 'super_admin' then
    raise exception 'Solo el superadministrador registra pagos manuales.';
  end if;
  if p_kind not in ('plan', 'puesta_en_marcha') then
    raise exception 'Tipo de pago no válido.';
  end if;
  if p_plan_id not in ('roomia-1', 'roomia-3', 'roomia-5') or p_billing not in ('mensual', 'anual') then
    raise exception 'Plan no válido.';
  end if;
  if v_cents <= 0 then
    raise exception 'El monto debe ser mayor a cero.';
  end if;
  if p_method not in ('transferencia', 'efectivo', 'otro') then
    raise exception 'Medio de pago no válido.';
  end if;
  if not exists (select 1 from public.users where id = p_owner_id and rol = 'hotel_admin') then
    raise exception 'El usuario no es administrador de hotel.';
  end if;

  insert into public.payments (
    kind, payer_id, amount_cents, amount_without_tax, client_transaction_id,
    status, status_detail, method, recorded_by, details, confirmed_at
  ) values (
    p_kind, p_owner_id::uuid, v_cents, v_cents, 'MAN-' || replace(gen_random_uuid()::text, '-', ''),
    'aprobado', nullif(btrim(coalesce(p_note, '')), ''), p_method, auth.uid()::text,
    jsonb_build_object('planId', p_plan_id, 'billing', p_billing, 'manual', true, 'sri', p_kind = 'plan' and coalesce(p_sri, false)), now()
  ) returning * into pay;

  result := public._aplicar_cobro_plan(pay);
  return result || jsonb_build_object('paymentId', pay.id);
end;
$function$;

-- Mantiene updated_at de subscriptions.
create or replace function public.subscriptions_tocar_fecha()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.5 Reservas
-- -----------------------------------------------------------------------------

-- Fechas ocupadas (reservas activas + bloqueos de Airbnb/Booking) para el
-- calendario público, sin exponer datos de los huéspedes.
create or replace function public.get_busy_ranges()
returns table(room_id text, hotel_id text, fecha_entrada text, fecha_salida text)
language sql stable security definer set search_path to 'public' as $function$
  select r.roomid, r.hotelid, r.fechaentrada, r.fechasalida
    from public.reservations r
   where r.estado in ('pendiente', 'confirmada', 'ocupada')
     and r.fechasalida >= to_char(now() - interval '1 day', 'YYYY-MM-DD')
     and (auth.uid() is null or r.guestid is distinct from auth.uid()::text)
  union all
  select b.room_id, b.hotel_id, b.fecha_inicio, b.fecha_fin
    from public.external_blocks b
   where b.fecha_fin >= to_char(now() - interval '1 day', 'YYYY-MM-DD');
$function$;

-- Impide dos reservas activas en la misma unidad y fechas, y reservar sobre
-- fechas bloqueadas por un calendario externo. Errores: RESERVA_SOLAPADA /
-- RESERVA_BLOQUEADA.
create or replace function public.reservations_prevent_overlap()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_unit text;
  v_check_blocks boolean;
begin
  if new.estado in ('cancelada', 'finalizada') then
    return new;
  end if;

  v_unit := coalesce(new.roomid, 'full:' || new.hotelid);
  if v_unit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_unit, 0));

  if exists (
    select 1 from public.reservations r
     where coalesce(r.roomid, 'full:' || r.hotelid) = v_unit
       and r.id <> new.id
       and r.estado not in ('cancelada', 'finalizada')
       and new.fechaentrada collate "C" < r.fechasalida collate "C"
       and new.fechasalida collate "C" > r.fechaentrada collate "C"
  ) then
    raise exception 'RESERVA_SOLAPADA: la habitación ya está reservada en esas fechas'
      using errcode = '23P01';
  end if;

  v_check_blocks := tg_op = 'INSERT'
    or old.estado in ('cancelada', 'finalizada')
    or old.roomid is distinct from new.roomid
    or old.hotelid is distinct from new.hotelid
    or old.fechaentrada is distinct from new.fechaentrada
    or old.fechasalida is distinct from new.fechasalida;

  if v_check_blocks and exists (
    select 1 from public.external_blocks b
     where coalesce(b.room_id, 'full:' || b.hotel_id) = v_unit
       and new.fechaentrada collate "C" < b.fecha_fin collate "C"
       and new.fechasalida collate "C" > b.fecha_inicio collate "C"
  ) then
    raise exception 'RESERVA_BLOQUEADA: esas fechas están bloqueadas por un calendario externo'
      using errcode = '23P01';
  end if;

  return new;
end;
$function$;

-- Un huésped no puede marcar su reserva como pagada/confirmada ni cambiar
-- montos o fechas: solo crearla en 'pendiente' o cancelarla.
create or replace function public.reservas_proteger_pago()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if public.es_personal_o_servidor() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.guestid := auth.uid()::text;
    new.notes := btrim(regexp_replace(coalesce(new.notes, ''), '\s*\[PAYMENT_INFO:.*?\]', '', 'g'));
    new.checkedinat := null;
    new.checkedoutat := null;
    new.recepcionistaid := null;
    return new;
  end if;

  if new.estado is distinct from old.estado
     and not (new.estado = 'cancelada' and old.estado in ('pendiente', 'confirmada')) then
    new.estado := old.estado;
  end if;
  new.guestid := old.guestid;
  new.hotelid := old.hotelid;
  new.roomid := old.roomid;
  new.fechaentrada := old.fechaentrada;
  new.fechasalida := old.fechasalida;
  new.noches := old.noches;
  new.subtotal := old.subtotal;
  new.impuestos := old.impuestos;
  new.total := old.total;
  new.serviciosadicionales := old.serviciosadicionales;
  new.notes := old.notes;
  new.qrcode := old.qrcode;
  new.checkedinat := old.checkedinat;
  new.checkedoutat := old.checkedoutat;
  new.recepcionistaid := old.recepcionistaid;
  new.reservation_type := old.reservation_type;
  return new;
end;
$function$;

-- Los clientes no pueden reservar en hoteles cuyo anfitrión está suspendido.
create or replace function public.reservas_bloqueo_por_plan()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if public.get_my_role() in ('cliente', 'anon') and not public.hotel_admite_reservas(new.hotelid) then
    raise exception 'Este establecimiento no está recibiendo reservas en este momento.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

-- Cambia el estado de la habitación (reservado / disponible) según la reserva.
create or replace function public.reservations_sync_room_status()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.roomid is null then
    return new;
  end if;

  if new.estado in ('pendiente', 'confirmada')
     and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    update public.rooms set estado = 'reservado'
    where id = new.roomid and estado = 'disponible';
  end if;

  if tg_op = 'UPDATE' and new.estado = 'cancelada' and old.estado is distinct from 'cancelada' then
    update public.rooms set estado = 'disponible'
    where id = new.roomid
      and estado = 'reservado'
      and not exists (
        select 1 from public.reservations r
        where r.roomid = new.roomid
          and r.id <> new.id
          and r.estado in ('pendiente', 'confirmada', 'ocupada')
      );
  end if;

  return new;
end;
$function$;

-- Confirma un pago de reserva hecho con Payphone: actualiza [PAYMENT_INFO],
-- confirma la reserva, registra la transacción y la bitácora.
create or replace function public.aplicar_pago_reserva(
  p_payment_id uuid, p_payphone_id text, p_card_brand text, p_last_digits text, p_authorization_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  pay public.payments%rowtype;
  res public.reservations%rowtype;
  info jsonb;
  pagado numeric;
  pendiente numeric;
  limpio text;
  ahora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'pago no encontrado';
  end if;
  if pay.status = 'aprobado' then
    return jsonb_build_object('yaAplicado', true, 'reservationId', pay.reservation_id);
  end if;

  select * into res from public.reservations where id = pay.reservation_id for update;
  if not found then
    raise exception 'reserva no encontrada';
  end if;

  begin
    info := (regexp_match(coalesce(res.notes, ''), '\[PAYMENT_INFO:(.*?)\]'))[1]::jsonb;
  exception when others then
    info := null;
  end;
  pagado := coalesce((info ->> 'montoPagado')::numeric, 0);
  pagado := least(res.total, round(pagado + pay.amount_cents / 100.0, 2));
  pendiente := round(res.total - pagado, 2);
  limpio := btrim(regexp_replace(coalesce(res.notes, ''), '\s*\[PAYMENT_INFO:.*?\]', '', 'g'));

  update public.reservations set
    estado = case when estado = 'pendiente' then 'confirmada' else estado end,
    notes = limpio || case when limpio = '' then '' else ' ' end
            || '[PAYMENT_INFO:' || jsonb_build_object('montoPagado', pagado, 'montoPendiente', pendiente)::text || ']',
    modificadopor = 'Payphone',
    mensajecambio = 'Pago en línea recibido: $' || to_char(pay.amount_cents / 100.0, 'FM999999990.00'),
    fechacambio = ahora
  where id = res.id;

  insert into public.transactions (id, reservationid, amount, currency, paymentmethod, status, reference, fecha)
  values (
    'TX-' || pay.client_transaction_id,
    res.id,
    pay.amount_cents / 100.0,
    pay.currency,
    'Payphone' || coalesce(' · ' || nullif(p_card_brand, ''), '') || coalesce(' ****' || nullif(p_last_digits, ''), ''),
    'completado',
    'Payphone ' || coalesce(nullif(p_payphone_id, ''), pay.client_transaction_id)
      || coalesce(' · Aut. ' || nullif(p_authorization_code, ''), ''),
    ahora
  )
  on conflict do nothing;

  insert into public.logs (id, timestamp, "user", role, action, detalles)
  values (
    'log-pago-' || pay.id,
    ahora,
    'Payphone',
    'sistema',
    'Pago en línea aprobado',
    'Reserva ' || res.id || ': $' || to_char(pay.amount_cents / 100.0, 'FM999999990.00')
      || ' (' || pay.kind || '). Pagado $' || pagado || ', pendiente $' || pendiente || '.'
  )
  on conflict (id) do nothing;

  update public.payments set
    status = 'aprobado',
    status_detail = null,
    payphone_transaction_id = p_payphone_id,
    card_brand = nullif(p_card_brand, ''),
    last_digits = nullif(p_last_digits, ''),
    authorization_code = nullif(p_authorization_code, ''),
    confirmed_at = now()
  where id = pay.id;

  return jsonb_build_object('yaAplicado', false, 'reservationId', res.id, 'montoPagado', pagado, 'montoPendiente', pendiente);
end;
$function$;

-- Limpieza: chat de más de 24 h y bitácora de más de 30 días.
create or replace function public.limpiar_datos_expirados()
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  delete from public.messages
  where (timestamp::timestamptz < (now() - interval '24 hours'))
     or (created_at < (now() - interval '24 hours'));

  delete from public.logs
  where (timestamp::timestamptz < (now() - interval '30 days'))
     or (created_at < (now() - interval '30 days'));
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.6 Calendarios iCal (Airbnb / Booking)
-- -----------------------------------------------------------------------------

-- Valida cada conexión: unidad correcta, URL https de Airbnb/Booking, y que el
-- cliente no pueda tocar los campos de estado de la sincronización.
create or replace function public.ical_feeds_validate()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_type text;
  v_room_hotel text;
  v_hostport text;
  v_host text;
  v_is_client boolean := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  ) in ('authenticated', 'anon');
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.hotel_id is distinct from old.hotel_id
       or new.room_id is distinct from old.room_id
       or new.platform is distinct from old.platform then
      raise exception 'ICAL_UNIDAD_INVALIDA: no se puede cambiar la unidad ni la plataforma de una conexión'
        using errcode = '22023';
    end if;
  end if;

  if new.room_id is null then
    select h.contacto->>'tipoEstablecimiento' into v_type from public.hotels h where h.id = new.hotel_id;
    if v_type is null or v_type not in ('casa', 'departamento') then
      raise exception 'ICAL_UNIDAD_INVALIDA: solo las casas y departamentos se conectan como inmueble completo'
        using errcode = '22023';
    end if;
  else
    select r.hotelid into v_room_hotel from public.rooms r where r.id = new.room_id;
    if v_room_hotel is distinct from new.hotel_id then
      raise exception 'ICAL_UNIDAD_INVALIDA: la habitación no pertenece a este hotel' using errcode = '22023';
    end if;
  end if;

  new.import_url := nullif(btrim(coalesce(new.import_url, '')), '');
  if new.import_url is not null then
    if length(new.import_url) > 2048 or new.import_url ~ '\s' or new.import_url !~* '^https://' then
      raise exception 'ICAL_URL_INVALIDA: la dirección debe empezar por https:// y no contener espacios'
        using errcode = '22023';
    end if;

    v_hostport := lower(substring(new.import_url from '^[hH][tT][tT][pP][sS]://([^/?#]+)'));
    if v_hostport is null or v_hostport ~ '[@\[\]:]' then
      raise exception 'ICAL_URL_INVALIDA: la dirección no puede incluir usuario, puerto ni IP literal'
        using errcode = '22023';
    end if;
    v_host := v_hostport;

    if v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
       or v_host ~ '^\d+(\.\d+){3}$'
       or v_host ~ '(^|\.)(localhost|local|internal|lan|home|corp|intranet|localdomain)$' then
      raise exception 'ICAL_URL_INVALIDA: el dominio de la dirección no es válido' using errcode = '22023';
    end if;

    if new.platform = 'airbnb' and v_host !~ '(^|\.)airbnb\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$' then
      raise exception 'ICAL_URL_INVALIDA: la dirección no parece un calendario de Airbnb' using errcode = '22023';
    end if;
    if new.platform = 'booking' and v_host !~ '(^|\.)booking\.com$' then
      raise exception 'ICAL_URL_INVALIDA: la dirección no parece un calendario de Booking' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid()::text);
    if v_is_client then
      new.etag := null; new.last_modified := null; new.last_attempt_at := null;
      new.last_synced_at := null; new.last_export_at := null; new.last_error := null;
      new.last_status := 'pendiente'; new.last_event_count := 0; new.consecutive_failures := 0;
    end if;
  else
    if v_is_client then
      new.etag := old.etag; new.last_modified := old.last_modified; new.last_attempt_at := old.last_attempt_at;
      new.last_synced_at := old.last_synced_at; new.last_export_at := old.last_export_at;
      new.last_error := old.last_error; new.last_status := old.last_status;
      new.last_event_count := old.last_event_count; new.consecutive_failures := old.consecutive_failures;
      new.created_by := old.created_by;
    end if;
    if new.import_url is distinct from old.import_url then
      new.etag := null; new.last_modified := null; new.last_attempt_at := null;
      new.last_synced_at := null; new.last_error := null; new.last_status := 'pendiente';
      new.last_event_count := 0; new.consecutive_failures := 0;
    end if;
  end if;

  return new;
end;
$function$;

-- Guarda los eventos importados de un calendario externo, borra los que ya
-- no están y marca conflictos con reservas de Roomia (Edge Function ical).
create or replace function public.ical_apply_sync(
  p_feed_id uuid, p_events jsonb, p_etag text, p_last_modified text, p_not_modified boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_feed public.ical_feeds%rowtype;
  v_valid integer := 0;
  v_deleted integer := 0;
  v_new_conflicts integer := 0;
  v_conflicts integer := 0;
begin
  select * into v_feed from public.ical_feeds where id = p_feed_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'conexion_no_existe');
  end if;

  if p_not_modified then
    update public.ical_feeds
       set last_attempt_at = now(), last_synced_at = now(), last_status = 'ok',
           last_error = null, consecutive_failures = 0
     where id = p_feed_id;
    return jsonb_build_object('ok', true, 'not_modified', true);
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'eventos_invalidos';
  end if;
  if jsonb_array_length(p_events) > 5000 then
    raise exception 'demasiados_eventos';
  end if;

  create temp table if not exists _ical_ev (uid text primary key, s text, e text, summary text) on commit drop;
  truncate _ical_ev;
  insert into _ical_ev (uid, s, e, summary)
  select distinct on (x.uid) x.uid, x.start, x.stop, left(coalesce(x.summary, ''), 200)
    from jsonb_to_recordset(p_events) as x(uid text, start text, stop text, summary text)
   where x.uid is not null and length(x.uid) between 1 and 300
     and x.start ~ '^\d{4}-\d{2}-\d{2}$' and x.stop ~ '^\d{4}-\d{2}-\d{2}$' and x.stop > x.start
   order by x.uid;
  select count(*) into v_valid from _ical_ev;

  insert into public.external_blocks (feed_id, hotel_id, room_id, platform, uid, fecha_inicio, fecha_fin, summary)
  select p_feed_id, v_feed.hotel_id, v_feed.room_id, v_feed.platform, ev.uid, ev.s, ev.e, ev.summary
    from _ical_ev ev
  on conflict (feed_id, uid) do update
     set fecha_inicio = excluded.fecha_inicio, fecha_fin = excluded.fecha_fin,
         summary = excluded.summary, updated_at = now()
   where (public.external_blocks.fecha_inicio, public.external_blocks.fecha_fin, public.external_blocks.summary)
         is distinct from (excluded.fecha_inicio, excluded.fecha_fin, excluded.summary);

  delete from public.external_blocks b
   where b.feed_id = p_feed_id
     and not exists (select 1 from _ical_ev ev where ev.uid = b.uid);
  get diagnostics v_deleted = row_count;

  with hit as (
    select b.id,
           exists (
             select 1 from public.reservations r
              where coalesce(r.roomid, 'full:' || r.hotelid) = coalesce(b.room_id, 'full:' || b.hotel_id)
                and r.estado in ('pendiente', 'confirmada', 'ocupada')
                and r.fechaentrada collate "C" < b.fecha_fin collate "C"
                and r.fechasalida collate "C" > b.fecha_inicio collate "C"
           ) as has_conflict
      from public.external_blocks b
     where b.feed_id = p_feed_id
  ), upd as (
    update public.external_blocks b
       set conflict = hit.has_conflict
      from hit
     where b.id = hit.id and b.conflict is distinct from hit.has_conflict
    returning b.id, b.conflict, b.platform, b.hotel_id, b.fecha_inicio, b.fecha_fin
  ), lg as (
    insert into public.logs (id, timestamp, "user", role, action, detalles)
    select 'ical-' || gen_random_uuid()::text,
           to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'Sincronización iCal', 'sistema', 'Conflicto iCal',
           format('Posible doble reserva en %s: el bloqueo de %s (%s a %s) coincide con una reserva de Roomia.',
                  coalesce(h.nombre, upd.hotel_id), initcap(upd.platform), upd.fecha_inicio, upd.fecha_fin)
      from upd left join public.hotels h on h.id = upd.hotel_id
     where upd.conflict
    returning 1
  )
  select count(*) into v_new_conflicts from lg;

  select count(*) into v_conflicts from public.external_blocks where feed_id = p_feed_id and conflict;

  update public.ical_feeds
     set last_attempt_at = now(), last_synced_at = now(), last_status = 'ok', last_error = null,
         last_event_count = v_valid, consecutive_failures = 0,
         etag = p_etag, last_modified = p_last_modified
   where id = p_feed_id;

  return jsonb_build_object('ok', true, 'events', v_valid, 'deleted', v_deleted,
                            'conflicts', v_conflicts, 'new_conflicts', v_new_conflicts);
end;
$function$;

-- Registra un fallo de sincronización.
create or replace function public.ical_record_failure(p_feed_id uuid, p_error text)
returns void language sql security definer set search_path to 'public' as $function$
  update public.ical_feeds
     set last_attempt_at = now(), last_status = 'error', last_error = left(coalesce(p_error, 'error'), 300),
         consecutive_failures = consecutive_failures + 1
   where id = p_feed_id;
$function$;

-- Datos para el calendario exportado (.ics) que Airbnb/Booking leen de Roomia.
create or replace function public.ical_export_data(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_feed public.ical_feeds%rowtype;
  v_unit text;
  v_from text;
  v_name text;
  v_events jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;

  select * into v_feed from public.ical_feeds where export_token = p_token;
  if not found then return null; end if;

  update public.ical_feeds set last_export_at = now()
   where id = v_feed.id and (last_export_at is null or last_export_at < now() - interval '1 minute');

  v_unit := coalesce(v_feed.room_id, 'full:' || v_feed.hotel_id);
  v_from := to_char(((now() at time zone 'America/Guayaquil')::date - 30), 'YYYY-MM-DD');

  select coalesce(h.nombre, 'Roomia') || case when r.id is not null then ' - ' || r.nombre else '' end
    into v_name
    from public.hotels h left join public.rooms r on r.id = v_feed.room_id
   where h.id = v_feed.hotel_id;

  select coalesce(jsonb_agg(q.e order by q.e->>'start', q.e->>'uid'), '[]'::jsonb) into v_events
    from (
      select jsonb_build_object('uid', 'res-' || r.id || '@roomiapms.site', 'start', r.fechaentrada,
                                'end', r.fechasalida, 'summary', 'Reservado (Roomia)') as e
        from public.reservations r
       where coalesce(r.roomid, 'full:' || r.hotelid) = v_unit
         and r.estado in ('pendiente', 'confirmada', 'ocupada')
         and r.fechaentrada ~ '^\d{4}-\d{2}-\d{2}$' and r.fechasalida ~ '^\d{4}-\d{2}-\d{2}$'
         and r.fechasalida > r.fechaentrada and r.fechasalida >= v_from
      union all
      select jsonb_build_object('uid', 'blk-' || b.id::text || '@roomiapms.site', 'start', b.fecha_inicio,
                                'end', b.fecha_fin, 'summary', 'Reservado (' || initcap(b.platform) || ')')
        from public.external_blocks b
       where coalesce(b.room_id, 'full:' || b.hotel_id) = v_unit
         and b.platform <> v_feed.platform and b.fecha_fin >= v_from
    ) q;

  return jsonb_build_object('name', v_name, 'platform', v_feed.platform, 'events', v_events);
end;
$function$;

-- Comprueba el secreto que envía pg_cron a la Edge Function ical.
create or replace function public.ical_check_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path to 'public', 'vault' as $function$
  select p_secret is not null and length(p_secret) >= 32
     and exists (select 1 from vault.decrypted_secrets s
                  where s.name = 'ical_cron_secret' and s.decrypted_secret = p_secret);
$function$;

-- -----------------------------------------------------------------------------
-- 4.7 Facturación electrónica SRI (Ecuador)
-- -----------------------------------------------------------------------------

-- ¿El módulo SRI está pagado y vigente para el anfitrión de este hotel?
create or replace function public.sri_modulo_activo(p_hotel_id text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.subscriptions s
     where s.owner_id in (select public.duenos_del_hotel(p_hotel_id))
       and s.sri_hasta is not null
       and s.sri_hasta >= now()
       and public.estado_plan(s) not in ('suspendida', 'cancelada')
  )
$function$;

-- Dígito verificador módulo 11 de la clave de acceso.
create or replace function public.sri_modulo11(p_cadena text)
returns integer language plpgsql immutable set search_path to 'public' as $function$
declare v_suma int := 0; v_peso int := 2;
begin
  if p_cadena !~ '^\d+$' then raise exception 'Cadena no numérica para el módulo 11'; end if;
  for i in reverse length(p_cadena)..1 loop
    v_suma := v_suma + substr(p_cadena, i, 1)::int * v_peso;
    v_peso := case when v_peso = 7 then 2 else v_peso + 1 end;
  end loop;
  return case 11 - (v_suma % 11) when 11 then 0 when 10 then 1 else 11 - (v_suma % 11) end;
end;
$function$;

-- Clave de acceso de 49 dígitos de una factura (código de documento 01).
create or replace function public.sri_clave_acceso(
  p_fecha date, p_ruc text, p_ambiente text, p_estab text, p_pto text, p_secuencial bigint, p_codigo text)
returns text language plpgsql immutable set search_path to 'public' as $function$
declare v_base text;
begin
  v_base := to_char(p_fecha, 'DDMMYYYY') || '01' || p_ruc || p_ambiente || p_estab || p_pto
            || lpad(p_secuencial::text, 9, '0') || lpad(p_codigo, 8, '0') || '1';
  if v_base !~ '^\d{48}$' then raise exception 'Datos inválidos para la clave de acceso'; end if;
  return v_base || sri_modulo11(v_base)::text;
end;
$function$;

-- Fecha actual en Ecuador.
create or replace function public.sri_fecha_ecuador(p_momento timestamptz default now())
returns date language sql stable set search_path to 'public' as $function$
  select (p_momento at time zone 'America/Guayaquil')::date;
$function$;

-- Crea el comprobante de una reserva tomando el siguiente secuencial del emisor.
create or replace function public.sri_crear_comprobante(
  p_reservation text, p_origen text default 'manual', p_comprador jsonb default null,
  p_items jsonb default null, p_forma_pago text default null, p_usuario text default null)
returns public.sri_comprobantes language plpgsql security definer set search_path to 'public' as $function$
#variable_conflict use_column
declare
  r public.reservations;
  e public.sri_emisores;
  v_sec bigint;
  v_fecha date := sri_fecha_ecuador();
  c public.sri_comprobantes;
begin
  select * into r from reservations where id = p_reservation;
  if not found then raise exception 'No encontramos la reserva.'; end if;
  if r.estado = 'cancelada' then raise exception 'No se factura una reserva cancelada.'; end if;

  update sri_emisores
     set secuencial_pruebas = secuencial_pruebas + (case when ambiente = '1' then 1 else 0 end),
         secuencial_produccion = secuencial_produccion + (case when ambiente = '2' then 1 else 0 end),
         updated_at = now()
   where hotel_id = r.hotelid and cert_titular is not null
  returning * into e;
  if not found then raise exception 'El establecimiento no tiene configurada la facturación electrónica.'; end if;
  v_sec := case when e.ambiente = '1' then e.secuencial_pruebas - 1 else e.secuencial_produccion - 1 end;

  if exists (select 1 from sri_comprobantes where reservation_id = r.id and ambiente = e.ambiente and estado <> 'anulado') then
    raise exception 'Esta reserva ya tiene una factura electrónica.';
  end if;

  insert into sri_comprobantes (hotel_id, reservation_id, origen, ambiente, ruc, estab, pto_emi, secuencial, clave_acceso,
                                fecha_emision, comprador, items, forma_pago, total, emitido_por)
  values (r.hotelid, r.id, p_origen, e.ambiente, e.ruc, e.estab, e.pto_emi, v_sec,
          sri_clave_acceso(v_fecha, e.ruc, e.ambiente, e.estab, e.pto_emi, v_sec, lpad((floor(random() * 100000000))::bigint::text, 8, '0')),
          v_fecha, p_comprador, p_items, coalesce(p_forma_pago, e.forma_pago), r.total, p_usuario)
  returning * into c;
  return c;
end;
$function$;

-- Al finalizar una reserva con módulo SRI vigente y firma válida, crea la
-- factura automática. Al cancelarla, anula las no enviadas y marca las
-- autorizadas para anular en el portal del SRI.
create or replace function public.sri_reserva_cambio_estado()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.estado is not distinct from old.estado then return null; end if;

  if new.estado = 'finalizada' and coalesce(new.total, 0) > 0 then
    if public.sri_modulo_activo(new.hotelid)
       and exists (select 1 from sri_emisores e where e.hotel_id = new.hotelid and e.activo and e.cert_valido_hasta > now())
       and not exists (select 1 from sri_comprobantes c where c.reservation_id = new.id and c.estado <> 'anulado') then
      begin
        perform sri_crear_comprobante(new.id, 'automatica');
      exception when others then
        raise warning 'SRI: no se creó la factura de la reserva %: %', new.id, sqlerrm;
      end;
    end if;
  end if;

  if new.estado = 'cancelada' then
    update sri_comprobantes set estado = 'anulado', updated_at = now()
     where reservation_id = new.id and not recibido and estado in ('pendiente', 'error', 'devuelta');
    update sri_comprobantes set anulacion_portal = true, updated_at = now()
     where reservation_id = new.id and estado = 'autorizado';
  end if;
  return null;
end;
$function$;

-- Comprobantes listos para enviar o reintentar.
create or replace function public.sri_pendientes(p_limite integer default 15)
returns setof uuid language sql stable security definer set search_path to 'public' as $function$
  select id from sri_comprobantes
   where estado in ('pendiente', 'error', 'recibida') and proximo_intento <= now() and intentos < 15
     and (bloqueado_hasta is null or bloqueado_hasta < now())
   order by proximo_intento
   limit p_limite;
$function$;

-- Bloquea un comprobante 3 minutos mientras la Edge Function lo procesa.
create or replace function public.sri_tomar(p_id uuid)
returns public.sri_comprobantes language plpgsql security definer set search_path to 'public' as $function$
declare c public.sri_comprobantes;
begin
  update sri_comprobantes
     set estado = 'procesando', intentos = intentos + 1, bloqueado_hasta = now() + interval '3 minutes', updated_at = now()
   where id = p_id
     and estado in ('pendiente', 'error', 'recibida')
     and (bloqueado_hasta is null or bloqueado_hasta < now())
  returning * into c;
  return c;
end;
$function$;

-- Cada minuto (cron sri-pendientes): si hay cola, llama a la Edge Function sri.
-- >>> Reemplaza TU-PROYECTO por la referencia del proyecto. <<<
create or replace function public.sri_disparar_pendientes()
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from sri_pendientes(1)) then return; end if;
  perform net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/sri',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-roomia-cron', sri_token('sri_cron_token')),
    body := jsonb_build_object('action', 'pendientes'),
    timeout_milliseconds := 55000
  );
end;
$function$;

-- Lee uno de los dos tokens internos del SRI guardados en Vault.
create or replace function public.sri_token(p_nombre text)
returns text language sql stable security definer set search_path to 'public', 'vault' as $function$
  select decrypted_secret from vault.decrypted_secrets
   where name = p_nombre and p_nombre in ('sri_cron_token', 'sri_correo_token');
$function$;

-- Lo usa api/send-email (Vercel) para aceptar correos con RIDE/XML del SRI.
create or replace function public.sri_validar_token_correo(p_token text)
returns boolean language sql stable security definer set search_path to 'public', 'vault' as $function$
  select coalesce(length(p_token) >= 32 and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'sri_correo_token'), false);
$function$;

-- Guarda o reemplaza la firma .p12 y su contraseña en Vault.
create or replace function public.sri_guardar_firma(p_hotel_id text, p_p12_base64 text, p_password text)
returns void language plpgsql security definer set search_path to 'public', 'vault' as $function$
declare f public.sri_firmas;
begin
  select * into f from public.sri_firmas where hotel_id = p_hotel_id;
  if found then
    perform vault.update_secret(f.p12_secret_id, p_p12_base64);
    perform vault.update_secret(f.password_secret_id, p_password);
    update public.sri_firmas set updated_at = now() where hotel_id = p_hotel_id;
  else
    insert into public.sri_firmas (hotel_id, p12_secret_id, password_secret_id)
    values (p_hotel_id,
            vault.create_secret(p_p12_base64, 'sri_p12_' || p_hotel_id, 'Firma electrónica SRI (.p12)'),
            vault.create_secret(p_password, 'sri_p12_clave_' || p_hotel_id, 'Contraseña de la firma electrónica SRI'));
  end if;
end;
$function$;

-- Lee la firma descifrada (solo servidor).
create or replace function public.sri_leer_firma(p_hotel_id text)
returns table(p12_base64 text, password text) language sql security definer set search_path to 'public', 'vault' as $function$
  select p.decrypted_secret, k.decrypted_secret
  from public.sri_firmas f
  join vault.decrypted_secrets p on p.id = f.p12_secret_id
  join vault.decrypted_secrets k on k.id = f.password_secret_id
  where f.hotel_id = p_hotel_id;
$function$;

-- Mantiene updated_at de sri_emisores.
create or replace function public.sri_tocar_fecha()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

set check_function_bodies = on;


-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- Supabase Auth → perfil en public.users.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();

-- users
drop trigger if exists trg_prevent_user_privilege_escalation on public.users;
create trigger trg_prevent_user_privilege_escalation
  before update on public.users
  for each row execute function public.prevent_user_privilege_escalation();

drop trigger if exists trg_users_keep_auth_email on public.users;
create trigger trg_users_keep_auth_email
  before update of email on public.users
  for each row execute function public.users_keep_auth_email();

-- hotels
drop trigger if exists hotels_dueno_y_limite on public.hotels;
create trigger hotels_dueno_y_limite
  before insert or update on public.hotels
  for each row execute function public.hotels_dueno_y_limite();

drop trigger if exists trg_hotels_separar_propietario on public.hotels;
create trigger trg_hotels_separar_propietario
  before insert or update on public.hotels
  for each row execute function public.hotels_separar_propietario();

-- property_details
drop trigger if exists trg_property_details_sin_datos_privados on public.property_details;
create trigger trg_property_details_sin_datos_privados
  before insert or update on public.property_details
  for each row execute function public.property_details_sin_datos_privados();

-- reservations
drop trigger if exists reservas_bloqueo_por_plan on public.reservations;
create trigger reservas_bloqueo_por_plan
  before insert on public.reservations
  for each row execute function public.reservas_bloqueo_por_plan();

drop trigger if exists trg_reservas_proteger_pago on public.reservations;
create trigger trg_reservas_proteger_pago
  before insert or update on public.reservations
  for each row execute function public.reservas_proteger_pago();

drop trigger if exists trg_reservations_prevent_overlap on public.reservations;
create trigger trg_reservations_prevent_overlap
  before insert or update of roomid, hotelid, fechaentrada, fechasalida, estado on public.reservations
  for each row execute function public.reservations_prevent_overlap();

drop trigger if exists trg_reservations_sync_room_status on public.reservations;
create trigger trg_reservations_sync_room_status
  after insert or update of estado on public.reservations
  for each row execute function public.reservations_sync_room_status();

drop trigger if exists sri_reserva_cambio_estado on public.reservations;
create trigger sri_reserva_cambio_estado
  after update of estado on public.reservations
  for each row execute function public.sri_reserva_cambio_estado();

-- ical_feeds
drop trigger if exists trg_ical_feeds_validate on public.ical_feeds;
create trigger trg_ical_feeds_validate
  before insert or update on public.ical_feeds
  for each row execute function public.ical_feeds_validate();

-- subscriptions / sri_emisores: fecha de actualización
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.subscriptions_tocar_fecha();

drop trigger if exists sri_emisores_fecha on public.sri_emisores;
create trigger sri_emisores_fecha
  before update on public.sri_emisores
  for each row execute function public.sri_tocar_fecha();


-- =============================================================================
-- 6. SEGURIDAD POR FILAS (RLS) Y POLÍTICAS
-- =============================================================================
-- Todas las tablas tienen RLS. Lo que no permite una política, no se puede.
-- Las Edge Functions usan service_role, que no pasa por RLS.

alter table public.hotels                enable row level security;
alter table public.users                 enable row level security;
alter table public.hotel_owners          enable row level security;
alter table public.property_details      enable row level security;
alter table public.rooms                 enable row level security;
alter table public.room_price_variations enable row level security;
alter table public.reservations          enable row level security;
alter table public.transactions          enable row level security;
alter table public.reviews               enable row level security;
alter table public.messages              enable row level security;
alter table public.logs                  enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.payments              enable row level security;
alter table public.ical_feeds            enable row level security;
alter table public.external_blocks       enable row level security;
alter table public.sri_emisores          enable row level security;
alter table public.sri_firmas            enable row level security;   -- sin políticas: solo servidor
alter table public.sri_comprobantes      enable row level security;

-- hotels: catálogo público; el superadmin todo, el anfitrión solo sus hoteles.
drop policy if exists hotels_lectura_publica on public.hotels;
create policy hotels_lectura_publica on public.hotels
  for select to anon, authenticated using (true);
drop policy if exists hotels_gestion_admin on public.hotels;
create policy hotels_gestion_admin on public.hotels
  for all to authenticated
  using (get_my_role() = 'super_admin'
         or (get_my_role() = 'hotel_admin' and id in (select mis_hoteles())))
  with check (get_my_role() = 'super_admin'
              or (get_my_role() = 'hotel_admin' and (owner_id = auth.uid()::text or id in (select mis_hoteles()))));

-- users: cada uno ve su perfil; el personal ve a todos; los clientes no ven a otros clientes.
drop policy if exists users_lectura on public.users;
create policy users_lectura on public.users
  for select to authenticated
  using (id = auth.uid()::text or rol <> 'cliente'
         or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists users_alta on public.users;
create policy users_alta on public.users
  for insert to authenticated
  with check (get_my_role() = 'super_admin'
              or (rol = 'cliente' and (id = auth.uid()::text
                                       or get_my_role() = any (array['hotel_admin', 'recepcionista']))));
drop policy if exists users_edicion on public.users;
create policy users_edicion on public.users
  for update to authenticated
  using (id = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (id = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists users_baja_admin on public.users;
create policy users_baja_admin on public.users
  for delete to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin']));

-- hotel_owners: datos privados, solo administradores.
drop policy if exists hotel_owners_gestion_admin on public.hotel_owners;
create policy hotel_owners_gestion_admin on public.hotel_owners
  for all to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin']))
  with check (get_my_role() = any (array['super_admin', 'hotel_admin']));

-- property_details
drop policy if exists property_details_lectura_publica on public.property_details;
create policy property_details_lectura_publica on public.property_details
  for select to anon, authenticated using (true);
drop policy if exists property_details_gestion_admin on public.property_details;
create policy property_details_gestion_admin on public.property_details
  for all to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin']))
  with check (get_my_role() = any (array['super_admin', 'hotel_admin']));

-- rooms
drop policy if exists rooms_lectura_publica on public.rooms;
create policy rooms_lectura_publica on public.rooms
  for select to anon, authenticated using (true);
drop policy if exists rooms_gestion_personal on public.rooms;
create policy rooms_gestion_personal on public.rooms
  for all to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));

-- room_price_variations
drop policy if exists price_variations_lectura_publica on public.room_price_variations;
create policy price_variations_lectura_publica on public.room_price_variations
  for select to anon, authenticated using (true);
drop policy if exists price_variations_gestion_personal on public.room_price_variations;
create policy price_variations_gestion_personal on public.room_price_variations
  for all to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));

-- reservations: el huésped las suyas; el personal todas.
drop policy if exists reservations_lectura on public.reservations;
create policy reservations_lectura on public.reservations
  for select to authenticated
  using (guestid = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists reservations_alta on public.reservations;
create policy reservations_alta on public.reservations
  for insert to authenticated
  with check (guestid = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists reservations_edicion on public.reservations;
create policy reservations_edicion on public.reservations
  for update to authenticated
  using (guestid = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (guestid = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists reservations_baja_admin on public.reservations;
create policy reservations_baja_admin on public.reservations
  for delete to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin']));

-- transactions
drop policy if exists transactions_lectura on public.transactions;
create policy transactions_lectura on public.transactions
  for select to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista'])
         or exists (select 1 from public.reservations r
                     where r.id = transactions.reservationid and r.guestid = auth.uid()::text));
drop policy if exists transactions_alta on public.transactions;
create policy transactions_alta on public.transactions
  for insert to authenticated
  with check (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists transactions_edicion_personal on public.transactions;
create policy transactions_edicion_personal on public.transactions
  for update to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists transactions_baja_personal on public.transactions;
create policy transactions_baja_personal on public.transactions
  for delete to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));

-- reviews
drop policy if exists reviews_lectura_publica on public.reviews;
create policy reviews_lectura_publica on public.reviews
  for select to anon, authenticated using (true);
drop policy if exists reviews_gestion_autor_o_admin on public.reviews;
create policy reviews_gestion_autor_o_admin on public.reviews
  for all to authenticated
  using (guest_id = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin']))
  with check (guest_id = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin']));

-- messages: el cliente ve lo que envió y lo dirigido a él ([TO_CLIENT:id]).
drop policy if exists messages_lectura on public.messages;
create policy messages_lectura on public.messages
  for select to authenticated
  using (senderid = auth.uid()::text
         or text like '%[TO_CLIENT:' || auth.uid()::text || ']%'
         or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists messages_alta on public.messages;
create policy messages_alta on public.messages
  for insert to authenticated
  with check (senderid = auth.uid()::text or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists messages_edicion on public.messages;
create policy messages_edicion on public.messages
  for update to authenticated
  using (senderid = auth.uid()::text
         or text like '%[TO_CLIENT:' || auth.uid()::text || ']%'
         or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (senderid = auth.uid()::text
              or text like '%[TO_CLIENT:' || auth.uid()::text || ']%'
              or get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists messages_baja_personal on public.messages;
create policy messages_baja_personal on public.messages
  for delete to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));

-- logs: cualquiera con sesión escribe; leen los administradores.
drop policy if exists logs_alta on public.logs;
create policy logs_alta on public.logs
  for insert to authenticated with check (true);
drop policy if exists logs_lectura_admin on public.logs;
create policy logs_lectura_admin on public.logs
  for select to authenticated
  using (get_my_role() = any (array['super_admin', 'hotel_admin']));

-- subscriptions: el anfitrión lee la suya; el superadmin gestiona todas.
drop policy if exists subscriptions_lectura on public.subscriptions;
create policy subscriptions_lectura on public.subscriptions
  for select to authenticated
  using (owner_id = auth.uid()::text or get_my_role() = 'super_admin');
drop policy if exists subscriptions_gestion_super on public.subscriptions;
create policy subscriptions_gestion_super on public.subscriptions
  for all to authenticated
  using (get_my_role() = 'super_admin')
  with check (get_my_role() = 'super_admin');

-- payments: solo lectura (escriben las Edge Functions).
drop policy if exists payments_lectura on public.payments;
create policy payments_lectura on public.payments
  for select to authenticated
  using (payer_id = auth.uid()
         or get_my_role() = 'super_admin'
         or (get_my_role() = any (array['hotel_admin', 'recepcionista']) and hotel_id in (select mis_hoteles())));

-- ical_feeds: el anfitrión gestiona las conexiones de sus hoteles.
drop policy if exists ical_feeds_gestion on public.ical_feeds;
create policy ical_feeds_gestion on public.ical_feeds
  for all to authenticated
  using (get_my_role() = 'super_admin'
         or (get_my_role() = 'hotel_admin' and hotel_id in (select mis_hoteles())))
  with check (get_my_role() = 'super_admin'
              or (get_my_role() = 'hotel_admin' and hotel_id in (select mis_hoteles())));

-- external_blocks: solo lectura del personal de cada hotel.
drop policy if exists external_blocks_lectura_personal on public.external_blocks;
create policy external_blocks_lectura_personal on public.external_blocks
  for select to authenticated
  using (get_my_role() = 'super_admin'
         or (get_my_role() = any (array['hotel_admin', 'recepcionista']) and hotel_id in (select mis_hoteles())));

-- sri_emisores / sri_comprobantes: lectura; se escriben desde la Edge Function sri.
drop policy if exists sri_emisores_lectura on public.sri_emisores;
create policy sri_emisores_lectura on public.sri_emisores
  for select to authenticated using (es_personal_del_hotel(hotel_id));
drop policy if exists sri_comprobantes_lectura on public.sri_comprobantes;
create policy sri_comprobantes_lectura on public.sri_comprobantes
  for select to authenticated
  using (es_personal_del_hotel(hotel_id)
         or exists (select 1 from public.reservations r
                     where r.id = sri_comprobantes.reservation_id and r.guestid = auth.uid()::text));


-- =============================================================================
-- 7. PERMISOS (GRANT / REVOKE)
-- =============================================================================
-- Se parte de cero y se da a cada rol solo lo necesario. RLS sigue filtrando
-- las filas: estos permisos solo dicen qué operaciones se pueden intentar.
--   anon          = visitante sin sesión
--   authenticated = usuario con sesión
--   service_role  = Edge Functions / servidor (todo)

-- 7.1 Tablas
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

-- Catálogo público (lectura sin sesión).
grant select on public.hotels, public.property_details, public.rooms, public.room_price_variations,
                public.reviews to anon;

-- Usuarios con sesión: lectura/escritura (RLS decide qué filas).
grant select, insert, update, delete on
  public.hotels, public.users, public.hotel_owners, public.property_details, public.rooms,
  public.room_price_variations, public.reservations, public.transactions, public.reviews,
  public.messages, public.logs, public.subscriptions, public.ical_feeds
  to authenticated;

-- Solo lectura para usuarios con sesión.
grant select on public.payments, public.external_blocks, public.sri_emisores, public.sri_comprobantes
  to authenticated;
-- sri_firmas: sin permisos para anon ni authenticated.

-- 7.2 Funciones
-- Por defecto Postgres deja ejecutar cualquier función a todos; se quita y se
-- concede una por una.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Visitantes y usuarios con sesión.
grant execute on function
  public.get_my_role(),
  public.get_auth_user_role(),
  public.get_busy_ranges(),
  public.is_email_registered(text),
  public.estado_plan(public.subscriptions),
  public.hotel_admite_reservas(text),
  public.hoteles_sin_reservas(),
  public.sri_validar_token_correo(text),
  public.sri_clave_acceso(date, text, text, text, text, bigint, text),
  public.sri_modulo11(text),
  public.sri_fecha_ecuador(timestamptz)
  to anon, authenticated;

-- Solo usuarios con sesión.
grant execute on function
  public.get_my_hotel(),
  public.mis_hoteles(),
  public.duenos_del_hotel(text),
  public.es_personal_del_hotel(text),
  public.es_personal_o_servidor(),
  public.limite_propiedades(text),
  public.sri_modulo_activo(text),
  public.registrar_pago_plan_manual(text, text, text, text, numeric, text, text, boolean)
  to authenticated;

-- Supabase Auth ejecuta los triggers de auth.users.
grant execute on function public.handle_new_user(), public.sync_profile_email_from_auth()
  to supabase_auth_admin;


-- =============================================================================
-- 8. TIEMPO REAL (Realtime)
-- =============================================================================
-- Tablas cuyos cambios la app escucha en vivo (panel, recepción, chat).
do $$
declare t text;
begin
  foreach t in array array['hotels', 'rooms', 'users', 'reservations', 'messages', 'transactions',
                           'reviews', 'room_price_variations', 'ical_feeds', 'external_blocks']
  loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- =============================================================================
-- 9. ALMACENAMIENTO DE IMÁGENES (Storage)
-- =============================================================================
-- Bucket público "establecimientos": fotos de hoteles y habitaciones.
-- Máximo 5 MB por archivo; solo JPG, PNG y WebP. Lo sube el personal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('establecimientos', 'establecimientos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists establecimientos_lectura_personal on storage.objects;
create policy establecimientos_lectura_personal on storage.objects
  for select to authenticated
  using (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists establecimientos_subida_personal on storage.objects;
create policy establecimientos_subida_personal on storage.objects
  for insert to authenticated
  with check (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists establecimientos_edicion_personal on storage.objects;
create policy establecimientos_edicion_personal on storage.objects
  for update to authenticated
  using (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']))
  with check (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));
drop policy if exists establecimientos_borrado_personal on storage.objects;
create policy establecimientos_borrado_personal on storage.objects
  for delete to authenticated
  using (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']));


-- =============================================================================
-- 10. SECRETOS (Vault) Y TAREAS PROGRAMADAS (pg_cron)
-- =============================================================================
-- Tokens internos aleatorios. Solo los conoce la base: las Edge Functions los
-- comprueban llamando a funciones de la sección 4, así que no hay que copiarlos
-- a ningún lado.
--   ical_cron_secret : cron → Edge Function ical
--   sri_cron_token   : cron → Edge Function sri
--   sri_correo_token : Edge Function sri → api/send-email (Vercel)
-- Las firmas .p12 de cada hotel se guardan aquí también (sri_guardar_firma).
do $$
declare n text;
begin
  foreach n in array array['ical_cron_secret', 'sri_cron_token', 'sri_correo_token'] loop
    if not exists (select 1 from vault.secrets where name = n) then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), n, 'Token interno de Roomia');
    end if;
  end loop;
end $$;

-- Cada 5 minutos: los pagos Payphone sin confirmar en 20 minutos expiran.
select cron.schedule('payments-expirar', '*/5 * * * *', $cron$
  update public.payments set status = 'expirado', status_detail = 'Sin confirmar a tiempo'
   where status = 'creado' and created_at < now() - interval '20 minutes'
$cron$);

-- Cada 15 minutos: sincroniza los calendarios de Airbnb / Booking.
-- >>> Reemplaza TU-PROYECTO por la referencia del proyecto. <<<
select cron.schedule('roomia-ical-sync', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/ical',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ical_cron_secret')
    ),
    body := '{"action":"sync_all"}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

-- Cada minuto: envía al SRI las facturas pendientes (si hay).
select cron.schedule('sri-pendientes', '* * * * *', $cron$select public.sri_disparar_pendientes()$cron$);


-- =============================================================================
-- 11. REGISTRO DEL SUPERADMINISTRADOR
-- =============================================================================
-- La base queda vacía: no hay ningún usuario. Para tener el primer
-- superadministrador:
--
--  PASO 1 — Crea la cuenta en Supabase Auth (no aquí):
--           Dashboard → Authentication → Users → "Add user" → "Create new user",
--           escribe el correo y una contraseña y marca "Auto Confirm User".
--           (También sirve registrarse normalmente desde la app.)
--           El trigger on_auth_user_created crea su perfil como 'cliente'.
--
--  PASO 2 — Cambia SOLO el correo de la línea "set local roomia.superadmin_email"
--           y ejecuta este bloque. Lo convierte en super_admin.
--           "set local role service_role" es necesario porque el trigger
--           anti-escalada no deja cambiar el rol desde el SQL Editor.
--
-- Está comentado para que no se ejecute al correr el archivo completo.
-- Quita los "--" del bloque cuando lo vayas a usar.
--
-- begin;
--   set local roomia.superadmin_email = 'superadmin@tu-dominio.com';
--
--   -- Si el perfil no se creó (por ejemplo, el usuario existía antes que el
--   -- trigger), lo crea desde auth.users.
--   insert into public.users (id, nombre, apellido, email, rol, estado)
--   select a.id::text, 'Super', 'Administrador', a.email, 'super_admin', 'activo'
--     from auth.users a
--    where lower(a.email) = lower(current_setting('roomia.superadmin_email'))
--   on conflict (id) do nothing;
--
--   set local role service_role;
--   update public.users
--      set rol = 'super_admin', hotelid = null, estado = 'activo'
--    where lower(email) = lower(current_setting('roomia.superadmin_email'));
-- commit;
--
-- -- Comprobación: debe devolver una fila con rol = super_admin.
-- select id, nombre, apellido, email, rol, estado from public.users where rol = 'super_admin';
--
-- Al iniciar sesión en la app con ese correo verás el panel de superadministrador.
-- Desde ahí se crean anfitriones (hotel_admin), recepcionistas y hoteles.
-- =============================================================================
