-- =============================================================================
-- ROOMIA PMS · PASO 1 DE 2 · CORRECCIONES SEGURAS (ADITIVAS)
-- =============================================================================
-- Qué hace: corrige fallos de guardado, cierra la escalada de rol en el registro,
-- añade validación de solapamiento en el servidor, mantiene el correo del perfil
-- igual al de Supabase Auth y activa realtime.
--
-- ESTADO: ya aplicado en producción el 12/11/2026. Se conserva como referencia y
-- para poder reproducirlo en otro proyecto.
--
-- Es seguro ejecutarlo con el frontend antiguo o con el nuevo:
--   · No borra tablas, columnas ni datos.
--   · No cambia quién puede leer o escribir (eso es el PASO 2).
--   · Se puede ejecutar varias veces sin efectos secundarios.
--
-- Cómo: Supabase → SQL Editor → pegar todo → Run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. RESEÑAS: la app envía "user_name" y la columna no existía, así que ninguna
--    reseña llegaba a guardarse.
-- -----------------------------------------------------------------------------
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_name TEXT;

-- -----------------------------------------------------------------------------
-- 2. TRANSACCIONES: la app guarda el método de pago como etiqueta legible
--    ("Visa/Mastercard", "PSE Pagos", "Transferencia Bancaria") y el CHECK solo
--    admitía cinco códigos, así que ningún pago llegaba a guardarse.
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_paymentmethod_check;

-- -----------------------------------------------------------------------------
-- 3. ÍNDICE DUPLICADO: users_email_key (UNIQUE) ya cubre las búsquedas por email.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_users_email;

-- -----------------------------------------------------------------------------
-- 4. ESCALADA DE ROL EN EL REGISTRO
--    Antes el rol se tomaba de los metadatos del registro, de modo que cualquiera
--    podía crearse una cuenta "super_admin" llamando a la API de Auth.
--    Ahora todo registro nace como "cliente"; el ascenso a personal lo sigue
--    haciendo el Super Admin desde el panel, como hasta ahora.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, nombre, apellido, email, telefono, documento, avatar,
    rol, estado, fechaRegistro, debecambiarpassword
  )
  VALUES (
    new.id::text,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'apellido', 'Nuevo'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'telefono', ''),
    COALESCE(new.raw_user_meta_data->>'documento', ''),
    COALESCE(new.raw_user_meta_data->>'avatar', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
    'cliente',
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
$$;

-- -----------------------------------------------------------------------------
-- 5. FUNCIONES INTERNAS EXPUESTAS POR LA API
--    Estas funciones no deben poder llamarse desde /rest/v1/rpc. Los triggers
--    siguen funcionando: Postgres no exige EXECUTE al usuario para dispararlos.
--    (get_my_role y get_auth_user_role NO se tocan: las usan las políticas RLS.)
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_user_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpiar_datos_expirados() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(TEXT) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. DISPONIBILIDAD PÚBLICA SIN DATOS PERSONALES
--    Devuelve solo habitación + fechas de las reservas activas de OTROS huéspedes.
--    Permite pintar el calendario de disponibilidad sin exponer quién reservó,
--    cuánto pagó ni el identificador de la reserva.
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
    AND (auth.uid() IS NULL OR r.guestid IS DISTINCT FROM auth.uid()::text);
$$;

REVOKE EXECUTE ON FUNCTION public.get_busy_ranges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_busy_ranges() TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. COMPROBACIÓN DE CORREO YA REGISTRADO
--    El formulario de registro avisa si el correo ya existe. Antes lo hacía leyendo
--    la tabla users completa; con esto solo recibe verdadero/falso.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE lower(u.email) = lower(trim(p_email))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_email_registered(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_registered(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. VALIDACIÓN DE SOLAPAMIENTO EN EL SERVIDOR
--    Antes solo el navegador comprobaba que una habitación no estuviera ya
--    reservada. Dos personas reservando a la vez podían duplicar la reserva.
--    Regla idéntica a la de la app: el día de salida queda libre para otra entrada.
--    Solo aplica a reservas con habitación; las de inmueble completo no cambian.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_prevent_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.roomid IS NULL OR NEW.estado IN ('cancelada', 'finalizada') THEN
    RETURN NEW;
  END IF;

  -- Serializa las reservas concurrentes de la misma habitación
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.roomid, 0));

  IF EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.roomid = NEW.roomid
      AND r.id <> NEW.id
      AND r.estado NOT IN ('cancelada', 'finalizada')
      AND NEW.fechaentrada COLLATE "C" < r.fechasalida COLLATE "C"
      AND NEW.fechasalida COLLATE "C" > r.fechaentrada COLLATE "C"
  ) THEN
    RAISE EXCEPTION 'RESERVA_SOLAPADA: la habitación ya está reservada en esas fechas'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reservations_prevent_overlap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reservations_prevent_overlap ON public.reservations;
CREATE TRIGGER trg_reservations_prevent_overlap
BEFORE INSERT OR UPDATE OF roomid, fechaentrada, fechasalida, estado ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reservations_prevent_overlap();

-- -----------------------------------------------------------------------------
-- 9. ESTADO DE LA HABITACIÓN SINCRONIZADO DESDE EL SERVIDOR
--    Antes era el navegador del huésped quien marcaba la habitación como
--    "reservado" al reservar y como "disponible" al cancelar. Cuando se cierre el
--    acceso público (PASO 2) el huésped ya no podrá escribir en "rooms", así que
--    esa misma lógica pasa a hacerla la base de datos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_sync_room_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.roomid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reserva nueva o reactivada: disponible -> reservado
  IF NEW.estado IN ('pendiente', 'confirmada')
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
    UPDATE public.rooms SET estado = 'reservado'
    WHERE id = NEW.roomid AND estado = 'disponible';
  END IF;

  -- Reserva cancelada: reservado -> disponible, solo si no queda otra reserva activa
  IF TG_OP = 'UPDATE' AND NEW.estado = 'cancelada' AND OLD.estado IS DISTINCT FROM 'cancelada' THEN
    UPDATE public.rooms SET estado = 'disponible'
    WHERE id = NEW.roomid
      AND estado = 'reservado'
      AND NOT EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.roomid = NEW.roomid
          AND r.id <> NEW.id
          AND r.estado IN ('pendiente', 'confirmada', 'ocupada')
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reservations_sync_room_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reservations_sync_room_status ON public.reservations;
CREATE TRIGGER trg_reservations_sync_room_status
AFTER INSERT OR UPDATE OF estado ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reservations_sync_room_status();

-- -----------------------------------------------------------------------------
-- 10. REALTIME
--     La app se suscribe a cambios de estas tablas, pero ninguna estaba publicada,
--     así que los cambios de otros usuarios solo aparecían al recargar.
--     Realtime respeta RLS: cada usuario solo recibe las filas que puede leer.
--     ("logs" se deja fuera a propósito: cada acción dispararía una recarga.)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['hotels', 'rooms', 'users', 'reservations', 'messages',
                             'transactions', 'reviews', 'room_price_variations']
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

-- -----------------------------------------------------------------------------
-- 11. CORREO DE ACCESO SIEMPRE IGUAL AL DE SUPABASE AUTH
--     El correo con el que se inicia sesión vive en auth.users. Si el perfil
--     (public.users) guardaba otro distinto, la persona veía un correo con el que
--     no podía entrar. Dos triggers los mantienen idénticos:
--       a) cuando Auth cambia el correo (tras confirmarlo), se copia al perfil;
--       b) el perfil de una cuenta con Auth no puede guardar un correo distinto.
--     Los huéspedes creados en recepción sin cuenta de Auth no se ven afectados.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    BEGIN
      UPDATE public.users SET email = NEW.email
      WHERE id = NEW.id::text AND email IS DISTINCT FROM NEW.email;
    EXCEPTION WHEN unique_violation THEN
      -- Otro perfil (p. ej. un huésped creado en recepción) ya usa ese correo:
      -- no se bloquea el cambio en Auth por ello.
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_from_auth();

CREATE OR REPLACE FUNCTION public.users_keep_auth_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_email TEXT;
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    SELECT a.email INTO v_auth_email FROM auth.users a WHERE a.id::text = NEW.id LIMIT 1;
    IF v_auth_email IS NOT NULL THEN
      NEW.email := v_auth_email;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.users_keep_auth_email() FROM PUBLIC, anon, authenticated;

-- El servicio de Auth es quien dispara estos dos triggers al registrar o cambiar correo.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.sync_profile_email_from_auth() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS trg_users_keep_auth_email ON public.users;
CREATE TRIGGER trg_users_keep_auth_email
BEFORE UPDATE OF email ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_keep_auth_email();

COMMIT;

-- =============================================================================
-- OPCIONAL · LIMPIEZA AUTOMÁTICA (NO se ejecuta: está comentado a propósito)
-- =============================================================================
-- limpiar_datos_expirados() borra DEFINITIVAMENTE los mensajes de chat de más de
-- 24 horas y los logs de más de 30 días. La función existe pero nunca se programó.
-- Si quieres activarla, descomenta estas líneas y ejecútalas aparte:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule('roomia-limpieza-diaria', '15 8 * * *',
--                        $$SELECT public.limpiar_datos_expirados()$$);
-- =============================================================================

SELECT 'PASO 1 aplicado: correcciones seguras de Roomia PMS' AS resultado;
