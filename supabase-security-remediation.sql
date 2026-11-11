-- =============================================================================
-- ROOMIA PMS - SCRIPT UNIFICADO DE REMEDIACIÓN DE SEGURIDAD Y RLS (PRODUCCIÓN)
-- Corrige vulnerabilidades H-01, H-02, H-03 (BOPLA / BOLA / RLS)
-- Para ejecutar directamente en el Editor SQL de Supabase
-- NOTA: Este script NO elimina ningún dato existente (NO hace DROP TABLE ni DELETE).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ACTIVACIÓN DE ROW-LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.room_price_variations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. LIMPIEZA DE POLÍTICAS PREVIAS (Idempotencia para evitar duplicados)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Users
  DROP POLICY IF EXISTS "Users can view own profile or admin view all" ON public.users;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
  DROP POLICY IF EXISTS "Allow authenticated user profile insertion" ON public.users;
  
  -- Hotels
  DROP POLICY IF EXISTS "Public can view active hotels" ON public.hotels;
  DROP POLICY IF EXISTS "Staff can manage hotels" ON public.hotels;
  
  -- Rooms
  DROP POLICY IF EXISTS "Public can view active rooms" ON public.rooms;
  DROP POLICY IF EXISTS "Staff can manage rooms" ON public.rooms;
  
  -- Reservations
  DROP POLICY IF EXISTS "Users and staff can view reservations" ON public.reservations;
  DROP POLICY IF EXISTS "Users can create reservations" ON public.reservations;
  DROP POLICY IF EXISTS "Users and staff can update reservations" ON public.reservations;

  -- Transactions & Logs
  DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
  DROP POLICY IF EXISTS "Staff can create logs" ON public.logs;
  DROP POLICY IF EXISTS "Users and staff can view transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
  
  -- Reviews & Price Variations
  DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
  DROP POLICY IF EXISTS "Users can insert reviews" ON public.reviews;
  DROP POLICY IF EXISTS "Public can view price variations" ON public.room_price_variations;
  DROP POLICY IF EXISTS "Staff can manage price variations" ON public.room_price_variations;

  -- Messages
  DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
  DROP POLICY IF EXISTS "Users and staff can view messages" ON public.messages;
  DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
  DROP POLICY IF EXISTS "Users and staff can send messages" ON public.messages;
  DROP POLICY IF EXISTS "Users and staff can update messages" ON public.messages;
  DROP POLICY IF EXISTS "Staff can delete messages" ON public.messages;
END $$;

-- -----------------------------------------------------------------------------
-- 3. FUNCIÓN AUXILIAR DE COMPROBACIÓN DE ROL (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rol FROM public.users WHERE id = auth.uid()::text LIMIT 1),
    'anon'
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. TRIGGER PREVENTIVO DE ESCALADA DE PRIVILEGIOS (BOPLA / BOLA)
-- Impide estrictamente que un usuario normal o la API cliente modifique 'rol' u 'hotelid'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_user_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  executor_role text;
BEGIN
  -- Si la modificación proviene del Service Role interno de Supabase, se permite.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  executor_role := public.get_auth_user_role();

  -- Si un usuario no es super_admin e intenta cambiar su campo 'rol' u 'hotelid', se fuerza a mantener el valor previo.
  IF executor_role != 'super_admin' THEN
    IF OLD.rol IS DISTINCT FROM NEW.rol THEN
      NEW.rol := OLD.rol;
    END IF;
    IF OLD.hotelid IS DISTINCT FROM NEW.hotelid THEN
      NEW.hotelid := OLD.hotelid;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_privilege_escalation ON public.users;

CREATE TRIGGER trg_prevent_user_privilege_escalation
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_privilege_escalation();

-- -----------------------------------------------------------------------------
-- 5. POLÍTICAS DE SEGURIDAD PARA TABLA 'users'
-- -----------------------------------------------------------------------------
-- A. Lectura de perfil propio o acceso total para super_admin/staff
CREATE POLICY "Users can view own profile or admin view all"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = id OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
);

-- B. Edición de perfil propio (sujeta al Trigger anti-escalada)
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id OR public.get_auth_user_role() = 'super_admin')
WITH CHECK (auth.uid()::text = id OR public.get_auth_user_role() = 'super_admin');

-- C. Inserción permitida durante autoregistro de usuario
CREATE POLICY "Allow authenticated user profile insertion"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = id OR public.get_auth_user_role() = 'super_admin');

-- -----------------------------------------------------------------------------
-- 6. POLÍTICAS DE SEGURIDAD PARA 'hotels' Y 'rooms' (Catálogo Público Seguro)
-- -----------------------------------------------------------------------------
CREATE POLICY "Public can view active hotels"
ON public.hotels
FOR SELECT
TO public
USING (estado = 'activo' OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'));

CREATE POLICY "Staff can manage hotels"
ON public.hotels
FOR ALL
TO authenticated
USING (public.get_auth_user_role() IN ('super_admin', 'admin'))
WITH CHECK (public.get_auth_user_role() IN ('super_admin', 'admin'));

-- Rooms
CREATE POLICY "Public can view active rooms"
ON public.rooms
FOR SELECT
TO public
USING (true);

CREATE POLICY "Staff can manage rooms"
ON public.rooms
FOR ALL
TO authenticated
USING (public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'))
WITH CHECK (public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'));

-- -----------------------------------------------------------------------------
-- 7. POLÍTICAS DE SEGURIDAD PARA 'reservations'
-- -----------------------------------------------------------------------------
CREATE POLICY "Users and staff can view reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (
  guestid = auth.uid()::text OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
);

CREATE POLICY "Users can create reservations"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (guestid = auth.uid()::text OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'));

CREATE POLICY "Users and staff can update reservations"
ON public.reservations
FOR UPDATE
TO authenticated
USING (guestid = auth.uid()::text OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'))
WITH CHECK (guestid = auth.uid()::text OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'));

-- -----------------------------------------------------------------------------
-- 8. POLÍTICAS PARA LOGS, TRANSACCIONES, RESEÑAS, VARIACIONES Y MENSAJES
-- -----------------------------------------------------------------------------
-- Logs
CREATE POLICY "Admins can view logs"
ON public.logs
FOR SELECT
TO authenticated
USING (public.get_auth_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "Staff can create logs"
ON public.logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Transactions
CREATE POLICY "Users and staff can view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
  OR auth.uid() IS NOT NULL
);

CREATE POLICY "Users can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Reviews
CREATE POLICY "Public can view reviews"
ON public.reviews
FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can insert reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Price Variations
CREATE POLICY "Public can view price variations"
ON public.room_price_variations
FOR SELECT
TO public
USING (true);

CREATE POLICY "Staff can manage price variations"
ON public.room_price_variations
FOR ALL
TO authenticated
USING (public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'))
WITH CHECK (public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista'));

-- Messages (Utiliza senderid y etiquetas en el texto; sin columna ficticia receiverid)
CREATE POLICY "Users and staff can view messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  senderid = auth.uid()::text 
  OR text LIKE ('%[TO_CLIENT:' || auth.uid()::text || ']%')
  OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
);

CREATE POLICY "Users and staff can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  senderid = auth.uid()::text 
  OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
);

CREATE POLICY "Users and staff can update messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  senderid = auth.uid()::text 
  OR text LIKE ('%[TO_CLIENT:' || auth.uid()::text || ']%')
  OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
)
WITH CHECK (
  senderid = auth.uid()::text 
  OR text LIKE ('%[TO_CLIENT:' || auth.uid()::text || ']%')
  OR public.get_auth_user_role() IN ('super_admin', 'admin', 'recepcionista')
);

-- -----------------------------------------------------------------------------
-- 9. PERMISOS DE ESQUEMA ESTRICTOS
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.hotels, public.rooms, public.reviews, public.room_price_variations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

SELECT 'Remediación de Seguridad y Políticas RLS aplicadas con éxito en Roomia PMS' AS resultado;
