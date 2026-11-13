-- =============================================================================
-- ROOMIA PMS · PASO 3 · SINCRONIZACIÓN iCAL (Airbnb / Booking / otras)
-- =============================================================================
-- Qué añade:
--   · ical_feeds      una conexión por unidad (habitación o inmueble completo) y plataforma.
--   · external_blocks fechas bloqueadas que llegan desde Airbnb/Booking (solo fechas).
--   · Políticas RLS limitadas POR HOTEL (la URL de importación es un secreto).
--   · Validación de URL en el servidor (https, sin IPs ni hosts internos, dominio por plataforma).
--   · Funciones para el servicio de sincronización (solo service_role).
--   · get_busy_ranges() ahora incluye los bloqueos externos.
--   · El trigger de solapamiento ahora cubre también inmuebles completos (roomid nulo)
--     y rechaza reservas sobre fechas bloqueadas por una plataforma externa.
--
-- Es aditivo: no borra datos ni cambia el comportamiento de las tablas existentes,
-- salvo las dos mejoras de solapamiento descritas. Se puede ejecutar varias veces.
-- Requiere haber aplicado antes supabase_01_correcciones_seguras.sql.
-- Para deshacerlo: supabase_03_ROLLBACK_ical.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id text NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,   -- NULL = inmueble completo
  platform text NOT NULL CHECK (platform IN ('airbnb', 'booking', 'otro')),
  import_url text,                                              -- calendario de la plataforma (SECRETO)
  export_token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  etag text,
  last_modified text,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_export_at timestamptz,                                   -- última vez que la plataforma leyó NUESTRO calendario
  last_status text NOT NULL DEFAULT 'pendiente' CHECK (last_status IN ('pendiente', 'ok', 'error')),
  last_error text,
  last_event_count integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ical_feeds_export_token_uk UNIQUE (export_token),
  CONSTRAINT ical_feeds_export_token_len CHECK (length(export_token) >= 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS ical_feeds_unit_platform_uk
  ON public.ical_feeds (hotel_id, COALESCE(room_id, ''), platform);
CREATE INDEX IF NOT EXISTS ical_feeds_hotel_idx ON public.ical_feeds (hotel_id);

CREATE TABLE IF NOT EXISTS public.external_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL REFERENCES public.ical_feeds(id) ON DELETE CASCADE,
  hotel_id text NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id text,                                                 -- NULL = inmueble completo
  platform text NOT NULL,
  uid text NOT NULL,
  fecha_inicio text NOT NULL CHECK (fecha_inicio ~ '^\d{4}-\d{2}-\d{2}$'),
  fecha_fin text NOT NULL CHECK (fecha_fin ~ '^\d{4}-\d{2}-\d{2}$'),   -- EXCLUSIVA (día de salida)
  summary text,
  conflict boolean NOT NULL DEFAULT false,                      -- choca con una reserva de Roomia
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_blocks_feed_uid_uk UNIQUE (feed_id, uid),
  CONSTRAINT external_blocks_dates_ck CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX IF NOT EXISTS external_blocks_unit_idx
  ON public.external_blocks (hotel_id, room_id, fecha_inicio);

-- -----------------------------------------------------------------------------
-- 2. AYUDANTE DE SEGURIDAD: hotel asignado al usuario actual
--    (public.users.hotelid es el único vínculo hotel-usuario que guarda la base).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_hotel()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.hotelid FROM public.users u WHERE u.id = auth.uid()::text LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_hotel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_hotel() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. VALIDACIÓN DE ical_feeds (se aplica también a quien llame directo a la API)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ical_feeds_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_room_hotel text;
  v_hostport text;
  v_host text;
  -- "Cliente" = llamada hecha con la sesión de un usuario (API). El servicio de
  -- sincronización usa la clave de servicio y sí puede escribir los campos de estado.
  v_is_client boolean := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  ) IN ('authenticated', 'anon');
BEGIN
  NEW.updated_at := now();

  -- La unidad es inmutable una vez creada
  IF TG_OP = 'UPDATE' THEN
    IF NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
       OR NEW.room_id IS DISTINCT FROM OLD.room_id
       OR NEW.platform IS DISTINCT FROM OLD.platform THEN
      RAISE EXCEPTION 'ICAL_UNIDAD_INVALIDA: no se puede cambiar la unidad ni la plataforma de una conexión'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- La unidad debe existir y pertenecer al hotel
  IF NEW.room_id IS NULL THEN
    SELECT h.contacto->>'tipoEstablecimiento' INTO v_type FROM public.hotels h WHERE h.id = NEW.hotel_id;
    IF v_type IS NULL OR v_type NOT IN ('casa', 'departamento') THEN
      RAISE EXCEPTION 'ICAL_UNIDAD_INVALIDA: solo las casas y departamentos se conectan como inmueble completo'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT r.hotelid INTO v_room_hotel FROM public.rooms r WHERE r.id = NEW.room_id;
    IF v_room_hotel IS DISTINCT FROM NEW.hotel_id THEN
      RAISE EXCEPTION 'ICAL_UNIDAD_INVALIDA: la habitación no pertenece a este hotel' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- URL de importación (opcional: puede existir solo la conexión de exportación)
  NEW.import_url := NULLIF(btrim(COALESCE(NEW.import_url, '')), '');
  IF NEW.import_url IS NOT NULL THEN
    IF length(NEW.import_url) > 2048 OR NEW.import_url ~ '\s' OR NEW.import_url !~* '^https://' THEN
      RAISE EXCEPTION 'ICAL_URL_INVALIDA: la dirección debe empezar por https:// y no contener espacios'
        USING ERRCODE = '22023';
    END IF;

    v_hostport := lower(substring(NEW.import_url from '^[hH][tT][tT][pP][sS]://([^/?#]+)'));
    IF v_hostport IS NULL OR v_hostport ~ '[@\[\]:]' THEN
      RAISE EXCEPTION 'ICAL_URL_INVALIDA: la dirección no puede incluir usuario, puerto ni IP literal'
        USING ERRCODE = '22023';
    END IF;
    v_host := v_hostport;

    IF v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
       OR v_host ~ '^\d+(\.\d+){3}$'
       OR v_host ~ '(^|\.)(localhost|local|internal|lan|home|corp|intranet|localdomain)$' THEN
      RAISE EXCEPTION 'ICAL_URL_INVALIDA: el dominio de la dirección no es válido' USING ERRCODE = '22023';
    END IF;

    -- airbnb.com, airbnb.es, airbnb.co.uk, airbnb.com.ec... pero NO airbnb.com.evil.net ni airbnb.xx.yy
    IF NEW.platform = 'airbnb' AND v_host !~ '(^|\.)airbnb\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$' THEN
      RAISE EXCEPTION 'ICAL_URL_INVALIDA: la dirección no parece un calendario de Airbnb' USING ERRCODE = '22023';
    END IF;
    IF NEW.platform = 'booking' AND v_host !~ '(^|\.)booking\.com$' THEN
      RAISE EXCEPTION 'ICAL_URL_INVALIDA: la dirección no parece un calendario de Booking' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid()::text);
    IF v_is_client THEN
      -- El cliente no puede fijar los campos que gestiona el servicio de sincronización
      NEW.etag := NULL; NEW.last_modified := NULL; NEW.last_attempt_at := NULL;
      NEW.last_synced_at := NULL; NEW.last_export_at := NULL; NEW.last_error := NULL;
      NEW.last_status := 'pendiente'; NEW.last_event_count := 0; NEW.consecutive_failures := 0;
    END IF;
  ELSE
    IF v_is_client THEN
      NEW.etag := OLD.etag; NEW.last_modified := OLD.last_modified; NEW.last_attempt_at := OLD.last_attempt_at;
      NEW.last_synced_at := OLD.last_synced_at; NEW.last_export_at := OLD.last_export_at;
      NEW.last_error := OLD.last_error; NEW.last_status := OLD.last_status;
      NEW.last_event_count := OLD.last_event_count; NEW.consecutive_failures := OLD.consecutive_failures;
      NEW.created_by := OLD.created_by;
    END IF;
    -- Si cambia la URL de importación, se reinicia el estado de la sincronización
    IF NEW.import_url IS DISTINCT FROM OLD.import_url THEN
      NEW.etag := NULL; NEW.last_modified := NULL; NEW.last_attempt_at := NULL;
      NEW.last_synced_at := NULL; NEW.last_error := NULL; NEW.last_status := 'pendiente';
      NEW.last_event_count := 0; NEW.consecutive_failures := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ical_feeds_validate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ical_feeds_validate ON public.ical_feeds;
CREATE TRIGGER trg_ical_feeds_validate
BEFORE INSERT OR UPDATE ON public.ical_feeds
FOR EACH ROW EXECUTE FUNCTION public.ical_feeds_validate();

-- -----------------------------------------------------------------------------
-- 4. RLS POR HOTEL
--    · ical_feeds: super_admin y el hotel_admin de ESE hotel (contiene URLs secretas).
--    · external_blocks: lectura para super_admin y personal de ESE hotel. Solo escribe
--      el servicio de sincronización (service_role).
-- -----------------------------------------------------------------------------
ALTER TABLE public.ical_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ical_feeds_gestion" ON public.ical_feeds;
CREATE POLICY "ical_feeds_gestion" ON public.ical_feeds
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'hotel_admin' AND hotel_id = public.get_my_hotel())
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'hotel_admin' AND hotel_id = public.get_my_hotel())
  );

DROP POLICY IF EXISTS "external_blocks_lectura_personal" ON public.external_blocks;
CREATE POLICY "external_blocks_lectura_personal" ON public.external_blocks
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() IN ('hotel_admin', 'recepcionista') AND hotel_id = public.get_my_hotel())
  );

REVOKE ALL ON public.ical_feeds, public.external_blocks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ical_feeds TO authenticated;
GRANT SELECT ON public.external_blocks TO authenticated;
GRANT ALL ON public.ical_feeds, public.external_blocks TO service_role;

-- -----------------------------------------------------------------------------
-- 5. FUNCIONES DEL SERVICIO DE SINCRONIZACIÓN (solo service_role)
-- -----------------------------------------------------------------------------

-- 5.1 Aplica el resultado de una lectura del calendario de la plataforma, de forma atómica.
CREATE OR REPLACE FUNCTION public.ical_apply_sync(
  p_feed_id uuid,
  p_events jsonb,
  p_etag text,
  p_last_modified text,
  p_not_modified boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed public.ical_feeds%ROWTYPE;
  v_valid integer := 0;
  v_deleted integer := 0;
  v_new_conflicts integer := 0;
  v_conflicts integer := 0;
BEGIN
  SELECT * INTO v_feed FROM public.ical_feeds WHERE id = p_feed_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conexion_no_existe');
  END IF;

  IF p_not_modified THEN
    UPDATE public.ical_feeds
       SET last_attempt_at = now(), last_synced_at = now(), last_status = 'ok',
           last_error = NULL, consecutive_failures = 0
     WHERE id = p_feed_id;
    RETURN jsonb_build_object('ok', true, 'not_modified', true);
  END IF;

  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RAISE EXCEPTION 'eventos_invalidos';
  END IF;
  IF jsonb_array_length(p_events) > 5000 THEN
    RAISE EXCEPTION 'demasiados_eventos';
  END IF;

  -- Eventos válidos (un solo registro por uid)
  CREATE TEMP TABLE IF NOT EXISTS _ical_ev (uid text PRIMARY KEY, s text, e text, summary text) ON COMMIT DROP;
  TRUNCATE _ical_ev;
  INSERT INTO _ical_ev (uid, s, e, summary)
  SELECT DISTINCT ON (x.uid) x.uid, x.start, x.stop, left(COALESCE(x.summary, ''), 200)
    FROM jsonb_to_recordset(p_events) AS x(uid text, start text, stop text, summary text)
   WHERE x.uid IS NOT NULL AND length(x.uid) BETWEEN 1 AND 300
     AND x.start ~ '^\d{4}-\d{2}-\d{2}$' AND x.stop ~ '^\d{4}-\d{2}-\d{2}$' AND x.stop > x.start
   ORDER BY x.uid;
  SELECT count(*) INTO v_valid FROM _ical_ev;

  INSERT INTO public.external_blocks (feed_id, hotel_id, room_id, platform, uid, fecha_inicio, fecha_fin, summary)
  SELECT p_feed_id, v_feed.hotel_id, v_feed.room_id, v_feed.platform, ev.uid, ev.s, ev.e, ev.summary
    FROM _ical_ev ev
  ON CONFLICT (feed_id, uid) DO UPDATE
     SET fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin,
         summary = EXCLUDED.summary, updated_at = now()
   WHERE (public.external_blocks.fecha_inicio, public.external_blocks.fecha_fin, public.external_blocks.summary)
         IS DISTINCT FROM (EXCLUDED.fecha_inicio, EXCLUDED.fecha_fin, EXCLUDED.summary);

  DELETE FROM public.external_blocks b
   WHERE b.feed_id = p_feed_id
     AND NOT EXISTS (SELECT 1 FROM _ical_ev ev WHERE ev.uid = b.uid);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Conflictos: bloqueo externo que coincide con una reserva activa de Roomia
  WITH hit AS (
    SELECT b.id,
           EXISTS (
             SELECT 1 FROM public.reservations r
              WHERE COALESCE(r.roomid, 'full:' || r.hotelid) = COALESCE(b.room_id, 'full:' || b.hotel_id)
                AND r.estado IN ('pendiente', 'confirmada', 'ocupada')
                AND r.fechaentrada COLLATE "C" < b.fecha_fin COLLATE "C"
                AND r.fechasalida COLLATE "C" > b.fecha_inicio COLLATE "C"
           ) AS has_conflict
      FROM public.external_blocks b
     WHERE b.feed_id = p_feed_id
  ), upd AS (
    UPDATE public.external_blocks b
       SET conflict = hit.has_conflict
      FROM hit
     WHERE b.id = hit.id AND b.conflict IS DISTINCT FROM hit.has_conflict
    RETURNING b.id, b.conflict, b.platform, b.hotel_id, b.fecha_inicio, b.fecha_fin
  ), lg AS (
    INSERT INTO public.logs (id, timestamp, "user", role, action, detalles)
    SELECT 'ical-' || gen_random_uuid()::text,
           to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'Sincronización iCal', 'sistema', 'Conflicto iCal',
           format('Posible doble reserva en %s: el bloqueo de %s (%s a %s) coincide con una reserva de Roomia.',
                  COALESCE(h.nombre, upd.hotel_id), initcap(upd.platform), upd.fecha_inicio, upd.fecha_fin)
      FROM upd LEFT JOIN public.hotels h ON h.id = upd.hotel_id
     WHERE upd.conflict
    RETURNING 1
  )
  SELECT count(*) INTO v_new_conflicts FROM lg;

  SELECT count(*) INTO v_conflicts FROM public.external_blocks WHERE feed_id = p_feed_id AND conflict;

  UPDATE public.ical_feeds
     SET last_attempt_at = now(), last_synced_at = now(), last_status = 'ok', last_error = NULL,
         last_event_count = v_valid, consecutive_failures = 0,
         etag = p_etag, last_modified = p_last_modified
   WHERE id = p_feed_id;

  RETURN jsonb_build_object('ok', true, 'events', v_valid, 'deleted', v_deleted,
                            'conflicts', v_conflicts, 'new_conflicts', v_new_conflicts);
END;
$$;

-- 5.2 Registra un fallo de lectura (conserva los bloqueos anteriores).
CREATE OR REPLACE FUNCTION public.ical_record_failure(p_feed_id uuid, p_error text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ical_feeds
     SET last_attempt_at = now(), last_status = 'error', last_error = left(COALESCE(p_error, 'error'), 300),
         consecutive_failures = consecutive_failures + 1
   WHERE id = p_feed_id;
$$;

-- 5.3 Datos del calendario que Roomia publica para una plataforma (sin datos personales).
CREATE OR REPLACE FUNCTION public.ical_export_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed public.ical_feeds%ROWTYPE;
  v_unit text;
  v_from text;
  v_name text;
  v_events jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN RETURN NULL; END IF;

  SELECT * INTO v_feed FROM public.ical_feeds WHERE export_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.ical_feeds SET last_export_at = now()
   WHERE id = v_feed.id AND (last_export_at IS NULL OR last_export_at < now() - interval '1 minute');

  v_unit := COALESCE(v_feed.room_id, 'full:' || v_feed.hotel_id);
  v_from := to_char(((now() AT TIME ZONE 'America/Guayaquil')::date - 30), 'YYYY-MM-DD');

  SELECT COALESCE(h.nombre, 'Roomia') || CASE WHEN r.id IS NOT NULL THEN ' - ' || r.nombre ELSE '' END
    INTO v_name
    FROM public.hotels h LEFT JOIN public.rooms r ON r.id = v_feed.room_id
   WHERE h.id = v_feed.hotel_id;

  SELECT COALESCE(jsonb_agg(q.e ORDER BY q.e->>'start', q.e->>'uid'), '[]'::jsonb) INTO v_events
    FROM (
      SELECT jsonb_build_object('uid', 'res-' || r.id || '@roomiapms.site', 'start', r.fechaentrada,
                                'end', r.fechasalida, 'summary', 'Reservado (Roomia)') AS e
        FROM public.reservations r
       WHERE COALESCE(r.roomid, 'full:' || r.hotelid) = v_unit
         AND r.estado IN ('pendiente', 'confirmada', 'ocupada')
         AND r.fechaentrada ~ '^\d{4}-\d{2}-\d{2}$' AND r.fechasalida ~ '^\d{4}-\d{2}-\d{2}$'
         AND r.fechasalida > r.fechaentrada AND r.fechasalida >= v_from
      UNION ALL
      SELECT jsonb_build_object('uid', 'blk-' || b.id::text || '@roomiapms.site', 'start', b.fecha_inicio,
                                'end', b.fecha_fin, 'summary', 'Reservado (' || initcap(b.platform) || ')')
        FROM public.external_blocks b
       WHERE COALESCE(b.room_id, 'full:' || b.hotel_id) = v_unit
         AND b.platform <> v_feed.platform AND b.fecha_fin >= v_from
    ) q;

  RETURN jsonb_build_object('name', v_name, 'platform', v_feed.platform, 'events', v_events);
END;
$$;

-- 5.4 Comprueba el secreto con el que el cron llama al servicio (guardado en Vault).
CREATE OR REPLACE FUNCTION public.ical_check_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT p_secret IS NOT NULL AND length(p_secret) >= 32
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets s
                  WHERE s.name = 'ical_cron_secret' AND s.decrypted_secret = p_secret);
$$;

REVOKE EXECUTE ON FUNCTION public.ical_apply_sync(uuid, jsonb, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ical_record_failure(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ical_export_data(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ical_check_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ical_apply_sync(uuid, jsonb, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ical_record_failure(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ical_export_data(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ical_check_cron_secret(text) TO service_role;

-- Secreto del cron (generado aquí, nunca se muestra ni se guarda en este archivo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ical_cron_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'ical_cron_secret',
      'Secreto con el que el cron llama a la función ical (sincronización iCal)'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. DISPONIBILIDAD PÚBLICA: ahora incluye los bloqueos de Airbnb/Booking
--    (solo habitación + fechas; sin plataforma ni datos personales).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_busy_ranges()
RETURNS TABLE (room_id TEXT, hotel_id TEXT, fecha_entrada TEXT, fecha_salida TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.roomid, r.hotelid, r.fechaentrada, r.fechasalida
    FROM public.reservations r
   WHERE r.estado IN ('pendiente', 'confirmada', 'ocupada')
     AND r.fechasalida >= to_char(now() - interval '1 day', 'YYYY-MM-DD')
     AND (auth.uid() IS NULL OR r.guestid IS DISTINCT FROM auth.uid()::text)
  UNION ALL
  SELECT b.room_id, b.hotel_id, b.fecha_inicio, b.fecha_fin
    FROM public.external_blocks b
   WHERE b.fecha_fin >= to_char(now() - interval '1 day', 'YYYY-MM-DD');
$$;

REVOKE EXECUTE ON FUNCTION public.get_busy_ranges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_busy_ranges() TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. SOLAPAMIENTO: ahora cubre inmuebles completos (roomid nulo) y fechas bloqueadas
--    por una plataforma externa. Una reserva ya existente no se rechaza si solo cambia
--    de estado (p. ej. al confirmarse el pago), aunque luego aparezca un bloqueo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_prevent_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit text;
  v_check_blocks boolean;
BEGIN
  IF NEW.estado IN ('cancelada', 'finalizada') THEN
    RETURN NEW;
  END IF;

  v_unit := COALESCE(NEW.roomid, 'full:' || NEW.hotelid);
  IF v_unit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializa las reservas concurrentes de la misma unidad
  PERFORM pg_advisory_xact_lock(hashtextextended(v_unit, 0));

  IF EXISTS (
    SELECT 1 FROM public.reservations r
     WHERE COALESCE(r.roomid, 'full:' || r.hotelid) = v_unit
       AND r.id <> NEW.id
       AND r.estado NOT IN ('cancelada', 'finalizada')
       AND NEW.fechaentrada COLLATE "C" < r.fechasalida COLLATE "C"
       AND NEW.fechasalida COLLATE "C" > r.fechaentrada COLLATE "C"
  ) THEN
    RAISE EXCEPTION 'RESERVA_SOLAPADA: la habitación ya está reservada en esas fechas'
      USING ERRCODE = '23P01';
  END IF;

  v_check_blocks := TG_OP = 'INSERT'
    OR OLD.estado IN ('cancelada', 'finalizada')
    OR OLD.roomid IS DISTINCT FROM NEW.roomid
    OR OLD.hotelid IS DISTINCT FROM NEW.hotelid
    OR OLD.fechaentrada IS DISTINCT FROM NEW.fechaentrada
    OR OLD.fechasalida IS DISTINCT FROM NEW.fechasalida;

  IF v_check_blocks AND EXISTS (
    SELECT 1 FROM public.external_blocks b
     WHERE COALESCE(b.room_id, 'full:' || b.hotel_id) = v_unit
       AND NEW.fechaentrada COLLATE "C" < b.fecha_fin COLLATE "C"
       AND NEW.fechasalida COLLATE "C" > b.fecha_inicio COLLATE "C"
  ) THEN
    RAISE EXCEPTION 'RESERVA_BLOQUEADA: esas fechas están bloqueadas por un calendario externo'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reservations_prevent_overlap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reservations_prevent_overlap ON public.reservations;
CREATE TRIGGER trg_reservations_prevent_overlap
BEFORE INSERT OR UPDATE OF roomid, hotelid, fechaentrada, fechasalida, estado ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reservations_prevent_overlap();

-- -----------------------------------------------------------------------------
-- 8. REALTIME (respeta RLS: cada usuario solo recibe lo que puede leer)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['external_blocks', 'ical_feeds']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;

SELECT 'PASO 3 aplicado: sincronización iCal (tablas, seguridad y funciones)' AS resultado;
