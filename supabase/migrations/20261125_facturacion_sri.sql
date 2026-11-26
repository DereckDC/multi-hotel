-- Facturación electrónica del SRI (Ecuador), esquema offline, factura 01 versión 1.1.0.
--
-- Flujo (igual que Roomia ERP):
--   check-out (reserva → finalizada) ─► trigger crea la factura "pendiente" con su secuencial y
--   clave de acceso ─► función `sri` (la llama la app al instante y pg_cron cada minuto):
--   arma el XML, firma XAdES-BES, envía a recepción, consulta la autorización, genera el RIDE y
--   lo envía por correo al huésped. Si el SRI no responde, reintenta con espera creciente.
--   También se puede emitir a mano desde la reserva (antes del check-out o con otros datos).
--
-- · sri_emisores: datos tributarios de cada establecimiento (cada uno factura con su propio RUC).
-- · sri_firmas: firma .p12 y su contraseña cifradas en Supabase Vault; solo el servidor las lee.
-- · sri_comprobantes: cada factura, su estado ante el SRI, el XML y la autorización.
-- · Nunca se bloquea un check-out ni una cancelación por la facturación.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- Configuración del emisor ----------
create table if not exists public.sri_emisores (
  hotel_id text primary key references public.hotels(id) on delete cascade,
  activo boolean not null default false,          -- emitir automáticamente al hacer check-out
  ruc text not null check (ruc ~ '^\d{10}(00[1-9]|0[1-9]\d|[1-9]\d\d)$'),
  razon_social text not null check (length(btrim(razon_social)) between 1 and 300),
  nombre_comercial text check (nombre_comercial is null or length(nombre_comercial) <= 300),
  dir_matriz text not null check (length(btrim(dir_matriz)) between 1 and 300),
  dir_establecimiento text check (dir_establecimiento is null or length(dir_establecimiento) <= 300),
  estab text not null default '001' check (estab ~ '^\d{3}$' and estab <> '000'),
  pto_emi text not null default '001' check (pto_emi ~ '^\d{3}$' and pto_emi <> '000'),
  obligado_contabilidad boolean not null default false,
  contribuyente_especial text check (contribuyente_especial is null or contribuyente_especial ~ '^[0-9A-Za-z]{3,13}$'),
  agente_retencion text check (agente_retencion is null or agente_retencion ~ '^[1-9]\d{0,7}$'),
  regimen text not null default 'general' check (regimen in ('general', 'rimpe_emprendedor', 'rimpe_negocio_popular')),
  ambiente text not null default '1' check (ambiente in ('1', '2')),
  codigo_iva text not null default '4' check (codigo_iva in ('0', '2', '3', '4', '5', '6', '7', '10')),
  forma_pago text not null default '19',          -- forma de pago por defecto de las facturas automáticas
  correo_copia text check (correo_copia is null or length(correo_copia) <= 254),
  secuencial_pruebas bigint not null default 1 check (secuencial_pruebas between 1 and 999999999),
  secuencial_produccion bigint not null default 1 check (secuencial_produccion between 1 and 999999999),
  cert_titular text,
  cert_emisor text,
  cert_valido_hasta timestamptz,
  cert_subido_at timestamptz,
  cert_ruc_ok boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sri_firmas (
  hotel_id text primary key references public.sri_emisores(hotel_id) on delete cascade,
  p12_secret_id uuid not null,
  password_secret_id uuid not null,
  updated_at timestamptz not null default now()
);

-- ---------- Comprobantes ----------
create table if not exists public.sri_comprobantes (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete restrict,
  reservation_id text references public.reservations(id) on delete set null,
  origen text not null default 'manual' check (origen in ('automatica', 'manual')),
  ambiente text not null check (ambiente in ('1', '2')),
  ruc text not null,
  estab text not null,
  pto_emi text not null,
  secuencial bigint not null check (secuencial between 1 and 999999999),
  clave_acceso text not null unique check (clave_acceso ~ '^\d{49}$'),
  fecha_emision date not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'recibida', 'autorizado', 'devuelta', 'no_autorizado', 'error', 'anulado')),
  recibido boolean not null default false,          -- el SRI ya lo recibió: solo falta autorizar
  comprador jsonb,                                  -- null: se toma del huésped al procesar
  items jsonb,                                      -- null: se calculan de la reserva al procesar
  forma_pago text,
  subtotal numeric(12, 2),
  iva numeric(12, 2),
  total numeric(12, 2),
  xml_firmado text,
  xml_autorizado text,
  numero_autorizacion text,
  fecha_autorizacion timestamptz,
  mensajes jsonb not null default '[]'::jsonb,
  intentos integer not null default 0,
  proximo_intento timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  correo_estado text not null default 'pendiente'
    check (correo_estado in ('pendiente', 'enviado', 'sin_correo', 'sin_configurar', 'error')),
  correo_enviado_at timestamptz,
  anulacion_portal boolean not null default false,  -- reserva cancelada con factura autorizada: anular en SRI en línea
  emitido_por text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sri_comprobantes_numero_unico unique (ruc, ambiente, estab, pto_emi, secuencial)
);
create index if not exists sri_comprobantes_hotel_idx on public.sri_comprobantes (hotel_id, created_at desc);
create index if not exists sri_comprobantes_reserva_idx on public.sri_comprobantes (reservation_id);
create index if not exists sri_comprobantes_cola_idx on public.sri_comprobantes (estado, proximo_intento)
  where estado in ('pendiente', 'error', 'recibida');
-- Una sola factura vigente por reserva y ambiente
create unique index if not exists sri_comprobantes_una_por_reserva on public.sri_comprobantes (reservation_id, ambiente)
  where reservation_id is not null and estado <> 'anulado';

-- ---------- Funciones de apoyo ----------
create or replace function public.sri_fecha_ecuador(p_momento timestamptz default now())
returns date language sql stable set search_path = public as $$
  select (p_momento at time zone 'America/Guayaquil')::date;
$$;

create or replace function public.sri_modulo11(p_cadena text)
returns int language plpgsql immutable set search_path = public as $$
declare v_suma int := 0; v_peso int := 2;
begin
  if p_cadena !~ '^\d+$' then raise exception 'Cadena no numérica para el módulo 11'; end if;
  for i in reverse length(p_cadena)..1 loop
    v_suma := v_suma + substr(p_cadena, i, 1)::int * v_peso;
    v_peso := case when v_peso = 7 then 2 else v_peso + 1 end;
  end loop;
  return case 11 - (v_suma % 11) when 11 then 0 when 10 then 1 else 11 - (v_suma % 11) end;
end;
$$;

-- fecha ddmmaaaa + 01 + RUC + ambiente + serie + secuencial + código numérico + emisión normal + dígito
create or replace function public.sri_clave_acceso(
  p_fecha date, p_ruc text, p_ambiente text, p_estab text, p_pto text, p_secuencial bigint, p_codigo text
) returns text language plpgsql immutable set search_path = public as $$
declare v_base text;
begin
  v_base := to_char(p_fecha, 'DDMMYYYY') || '01' || p_ruc || p_ambiente || p_estab || p_pto
            || lpad(p_secuencial::text, 9, '0') || lpad(p_codigo, 8, '0') || '1';
  if v_base !~ '^\d{48}$' then raise exception 'Datos inválidos para la clave de acceso'; end if;
  return v_base || sri_modulo11(v_base)::text;
end;
$$;

-- ¿El usuario actual es superadmin o personal de ese establecimiento?
create or replace function public.es_personal_del_hotel(p_hotel_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_my_role() = 'super_admin'
      or exists (
        select 1 from public.users u
        where u.id = auth.uid()::text and u.rol in ('hotel_admin', 'recepcionista') and u.hotelid = p_hotel_id
      );
$$;

-- Crea la factura "pendiente" de una reserva: toma el secuencial del ambiente activo y calcula
-- la clave de acceso en la misma operación (sin choques entre emisiones simultáneas).
create or replace function public.sri_crear_comprobante(
  p_reservation text,
  p_origen text default 'manual',
  p_comprador jsonb default null,
  p_items jsonb default null,
  p_forma_pago text default null,
  p_usuario text default null
) returns public.sri_comprobantes
language plpgsql security definer set search_path = public as $$
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
$$;

-- ---------- Triggers de la reserva (nunca bloquean la operación) ----------
create or replace function public.sri_reserva_cambio_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is not distinct from old.estado then return null; end if;

  -- Check-out: factura automática si el establecimiento la tiene activa y su firma está vigente
  if new.estado = 'finalizada' and coalesce(new.total, 0) > 0 then
    if exists (select 1 from sri_emisores e where e.hotel_id = new.hotelid and e.activo and e.cert_valido_hasta > now())
       and not exists (select 1 from sri_comprobantes c where c.reservation_id = new.id and c.estado <> 'anulado') then
      begin
        perform sri_crear_comprobante(new.id, 'automatica');
      exception when others then
        raise warning 'SRI: no se creó la factura de la reserva %: %', new.id, sqlerrm;
      end;
    end if;
  end if;

  -- Cancelación: lo que no llegó al SRI se anula; una factura autorizada se marca para anular en SRI en línea
  if new.estado = 'cancelada' then
    update sri_comprobantes set estado = 'anulado', updated_at = now()
     where reservation_id = new.id and not recibido and estado in ('pendiente', 'error', 'devuelta');
    update sri_comprobantes set anulacion_portal = true, updated_at = now()
     where reservation_id = new.id and estado = 'autorizado';
  end if;
  return null;
end;
$$;
drop trigger if exists sri_reserva_cambio_estado on public.reservations;
create trigger sri_reserva_cambio_estado after update of estado on public.reservations
  for each row execute function public.sri_reserva_cambio_estado();

-- ---------- Cola de procesamiento (solo el servidor) ----------
-- Toma un comprobante para procesarlo: evita que dos procesos lo envíen a la vez (bloqueo de 3 min)
create or replace function public.sri_tomar(p_id uuid)
returns public.sri_comprobantes language plpgsql security definer set search_path = public as $$
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
$$;

create or replace function public.sri_pendientes(p_limite int default 15)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from sri_comprobantes
   where estado in ('pendiente', 'error', 'recibida') and proximo_intento <= now() and intentos < 15
     and (bloqueado_hasta is null or bloqueado_hasta < now())
   order by proximo_intento
   limit p_limite;
$$;

-- ---------- Firma en Vault (solo el servidor) ----------
create or replace function public.sri_guardar_firma(p_hotel_id text, p_p12_base64 text, p_password text)
returns void language plpgsql security definer set search_path = public, vault as $$
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
$$;

create or replace function public.sri_leer_firma(p_hotel_id text)
returns table (p12_base64 text, password text)
language sql security definer set search_path = public, vault as $$
  select p.decrypted_secret, k.decrypted_secret
  from public.sri_firmas f
  join vault.decrypted_secrets p on p.id = f.p12_secret_id
  join vault.decrypted_secrets k on k.id = f.password_secret_id
  where f.hotel_id = p_hotel_id;
$$;

-- ---------- Tokens internos (Vault) ----------
-- sri_cron_token: pg_cron → función sri. sri_correo_token: función sri → /api/send-email (adjuntos).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sri_cron_token') then
    perform vault.create_secret(md5(random()::text) || md5(clock_timestamp()::text), 'sri_cron_token', 'Token de pg_cron para la función sri');
  end if;
  if not exists (select 1 from vault.secrets where name = 'sri_correo_token') then
    perform vault.create_secret(md5(random()::text) || md5(clock_timestamp()::text || 'correo'), 'sri_correo_token', 'Token de la función sri para enviar correos con adjuntos');
  end if;
end $$;

create or replace function public.sri_token(p_nombre text)
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets
   where name = p_nombre and p_nombre in ('sri_cron_token', 'sri_correo_token');
$$;

-- El endpoint de correo (Vercel) comprueba que la llamada con adjuntos viene de la función sri
create or replace function public.sri_validar_token_correo(p_token text)
returns boolean language sql stable security definer set search_path = public, vault as $$
  select coalesce(length(p_token) >= 32 and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'sri_correo_token'), false);
$$;

-- pg_cron: despierta a la función solo si hay trabajo pendiente
create or replace function public.sri_disparar_pendientes()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sri_pendientes(1)) then return; end if;
  perform net.http_post(
    url := 'https://fyreapnukipdvcebvokj.supabase.co/functions/v1/sri',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-roomia-cron', sri_token('sri_cron_token')),
    body := jsonb_build_object('action', 'pendientes'),
    timeout_milliseconds := 55000
  );
end;
$$;

-- ---------- Seguridad ----------
alter table public.sri_emisores enable row level security;
alter table public.sri_firmas enable row level security;
alter table public.sri_comprobantes enable row level security;

drop policy if exists sri_emisores_lectura on public.sri_emisores;
create policy sri_emisores_lectura on public.sri_emisores
  for select to authenticated using (public.es_personal_del_hotel(hotel_id));

drop policy if exists sri_comprobantes_lectura on public.sri_comprobantes;
create policy sri_comprobantes_lectura on public.sri_comprobantes
  for select to authenticated
  using (
    public.es_personal_del_hotel(hotel_id)
    or exists (select 1 from public.reservations r where r.id = sri_comprobantes.reservation_id and r.guestid = auth.uid()::text)
  );
-- Sin políticas de escritura: solo el servidor escribe. sri_firmas no tiene ninguna política.
revoke all on public.sri_emisores, public.sri_firmas, public.sri_comprobantes from anon;
revoke insert, update, delete on public.sri_emisores, public.sri_comprobantes from authenticated;
revoke all on public.sri_firmas from authenticated;

revoke all on function public.es_personal_del_hotel(text) from public, anon;
grant execute on function public.es_personal_del_hotel(text) to authenticated, service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'sri_crear_comprobante(text, text, jsonb, jsonb, text, text)', 'sri_reserva_cambio_estado()', 'sri_tomar(uuid)',
    'sri_pendientes(integer)', 'sri_guardar_firma(text, text, text)', 'sri_leer_firma(text)', 'sri_token(text)',
    'sri_disparar_pendientes()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.sri_crear_comprobante(text, text, jsonb, jsonb, text, text) to service_role;
grant execute on function public.sri_tomar(uuid) to service_role;
grant execute on function public.sri_pendientes(integer) to service_role;
grant execute on function public.sri_guardar_firma(text, text, text) to service_role;
grant execute on function public.sri_leer_firma(text) to service_role;
grant execute on function public.sri_token(text) to service_role;
revoke all on function public.sri_validar_token_correo(text) from public;
grant execute on function public.sri_validar_token_correo(text) to anon, authenticated, service_role;

create or replace function public.sri_tocar_fecha() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists sri_emisores_fecha on public.sri_emisores;
create trigger sri_emisores_fecha before update on public.sri_emisores for each row execute function public.sri_tocar_fecha();

-- ---------- Tarea programada: cada minuto ----------
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'sri-pendientes';
  perform cron.schedule('sri-pendientes', '* * * * *', 'select public.sri_disparar_pendientes()');
end $$;
