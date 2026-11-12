-- =============================================================================
-- ROOMIA PMS · ROLLBACK DEL PASO 2 (solo para emergencias)
-- =============================================================================
-- Vuelve a dejar la base de datos tan abierta como estaba ANTES del PASO 2:
-- cualquiera con la clave pública puede leer y escribir en todas las tablas.
-- Úsalo únicamente si, tras aplicar el PASO 2, algo de la app deja de funcionar
-- y necesitas recuperarla de inmediato mientras se investiga.
-- No borra datos ni toca las políticas del PASO 2: solo añade las abiertas.
-- Para volver a cerrar, ejecuta de nuevo supabase_02_cerrar_acceso_publico.sql.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hotels', 'rooms', 'users', 'reservations', 'logs', 'messages',
                           'transactions', 'property_details', 'reviews', 'room_price_variations']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acceso total a ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)',
      'Acceso total a ' || t, t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;

SELECT 'ROLLBACK aplicado: la base vuelve a estar ABIERTA. Reaplica el PASO 2 cuanto antes.' AS resultado;
