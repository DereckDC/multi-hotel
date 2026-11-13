-- =============================================================================
-- ROOMIA PMS · PASO 3b · PROGRAMACIÓN DE LA SINCRONIZACIÓN iCAL (cada 15 minutos)
-- =============================================================================
-- Ejecutar DESPUÉS de supabase_03_ical.sql y de desplegar la función Edge "ical"
-- (supabase/functions/ical). Cambia la URL si usas otro proyecto de Supabase.
--
-- El secreto con el que el cron se identifica ante la función vive en Vault
-- (ical_cron_secret, creado por supabase_03_ical.sql). No aparece en este archivo
-- ni en cron.job: se lee de Vault cada vez que se ejecuta el trabajo.
-- Para quitar la sincronización automática: SELECT cron.unschedule('roomia-ical-sync');
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'roomia-ical-sync') THEN
    PERFORM cron.unschedule('roomia-ical-sync');
  END IF;
END $$;

SELECT cron.schedule(
  'roomia-ical-sync',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://fyreapnukipdvcebvokj.supabase.co/functions/v1/ical',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ical_cron_secret')
    ),
    body := '{"action":"sync_all"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
