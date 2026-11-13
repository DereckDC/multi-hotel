-- =============================================================================
-- ROOMIA PMS · ROLLBACK DEL PASO 3 (sincronización iCal) · solo para emergencias
-- =============================================================================
-- Quita la sincronización iCal y devuelve get_busy_ranges() y el trigger de
-- solapamiento a la versión del PASO 1. BORRA las conexiones iCal guardadas
-- (las URL de importación y los enlaces de exportación dejarán de funcionar) y los
-- bloqueos importados. No toca reservas ni ningún otro dato.
--
-- Después, desde la consola de Supabase, elimina la función Edge "ical"
-- (o ejecútalo con la CLI: supabase functions delete ical).
-- =============================================================================

BEGIN;

-- 1. Detener la programación
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'roomia-ical-sync') THEN
    PERFORM cron.unschedule('roomia-ical-sync');
  END IF;
END $$;

-- 2. Versiones del PASO 1
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

-- 3. Funciones, tablas y secreto del PASO 3
DROP FUNCTION IF EXISTS public.ical_check_cron_secret(text);
DROP FUNCTION IF EXISTS public.ical_export_data(text);
DROP FUNCTION IF EXISTS public.ical_record_failure(uuid, text);
DROP FUNCTION IF EXISTS public.ical_apply_sync(uuid, jsonb, text, text, boolean);
DROP TABLE IF EXISTS public.external_blocks;
DROP TABLE IF EXISTS public.ical_feeds;
DROP FUNCTION IF EXISTS public.ical_feeds_validate();
DROP FUNCTION IF EXISTS public.get_my_hotel();

DO $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'ical_cron_secret';
END $$;

COMMIT;

SELECT 'ROLLBACK del PASO 3 aplicado: iCal desactivado' AS resultado;
