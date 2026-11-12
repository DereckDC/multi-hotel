-- =============================================================================
-- ROOMIA PMS · PASO 2 DE 2 · CERRAR EL ACCESO PÚBLICO A LA BASE DE DATOS
-- =============================================================================
-- Qué hace: elimina las políticas "Acceso total a …" (que permitían a cualquiera
-- con la clave pública leer, modificar y borrar usuarios, reservas, mensajes y
-- pagos) y deja un único juego de políticas coherente por rol.
--
-- ⚠️  ORDEN OBLIGATORIO
--   1. Ejecutar supabase_01_correcciones_seguras.sql.
--   2. Desplegar el frontend nuevo en producción (roomiapms.site).
--   3. Solo entonces ejecutar este archivo.
-- Si se ejecuta con el frontend antiguo, los huéspedes verían el calendario de
-- disponibilidad vacío y los registros de actividad dejarían de guardarse.
--
-- No borra datos. Se puede ejecutar varias veces.
-- Para deshacerlo: supabase_02_ROLLBACK_reabrir_acceso.sql
-- =============================================================================

BEGIN;

-- Comprobación previa: el PASO 1 tiene que estar aplicado
DO $$
BEGIN
  IF to_regprocedure('public.get_busy_ranges()') IS NULL THEN
    RAISE EXCEPTION 'Falta el PASO 1: ejecuta antes supabase_01_correcciones_seguras.sql';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. ELIMINAR TODAS LAS POLÍTICAS ACTUALES DE LAS TABLAS DE LA APP
--    Había tres juegos superpuestos (el original, el de "remediación" con el rol
--    inexistente 'admin', y el de "Acceso total"). Se sustituyen por uno solo.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('hotels', 'rooms', 'users', 'reservations', 'logs', 'messages',
                        'transactions', 'property_details', 'reviews', 'room_price_variations')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.hotels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_details      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_price_variations ENABLE ROW LEVEL SECURITY;

-- Roles de la app (public.users.rol): super_admin, hotel_admin, recepcionista, cliente.
-- get_my_role() devuelve 'anon' si no hay sesión.

-- -----------------------------------------------------------------------------
-- 2. CATÁLOGO PÚBLICO: hoteles, habitaciones, inmuebles, tarifas y reseñas
--    Lectura abierta (es la vitrina del sitio); escritura solo para el personal.
-- -----------------------------------------------------------------------------
CREATE POLICY "hotels_lectura_publica" ON public.hotels
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hotels_gestion_admin" ON public.hotels
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin'));

CREATE POLICY "rooms_lectura_publica" ON public.rooms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rooms_gestion_personal" ON public.rooms
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "property_details_lectura_publica" ON public.property_details
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "property_details_gestion_admin" ON public.property_details
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin'));

CREATE POLICY "price_variations_lectura_publica" ON public.room_price_variations
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "price_variations_gestion_personal" ON public.room_price_variations
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "reviews_lectura_publica" ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews_gestion_autor_o_admin" ON public.reviews
  FOR ALL TO authenticated
  USING (guest_id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'))
  WITH CHECK (guest_id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- -----------------------------------------------------------------------------
-- 3. USUARIOS
--    · Cada persona ve su propio perfil.
--    · El personal ve todos los perfiles.
--    · Un cliente ve además los perfiles del personal (la app los necesita para
--      avisar por correo al administrador del hotel y para el chat), pero ya no
--      los de otros huéspedes.
--    · Nadie puede crear cuentas de personal salvo el Super Admin.
-- -----------------------------------------------------------------------------
CREATE POLICY "users_lectura" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()::text
    OR rol <> 'cliente'
    OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "users_alta" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (
      rol = 'cliente'
      AND (id = auth.uid()::text OR public.get_my_role() IN ('hotel_admin', 'recepcionista'))
    )
  );

-- El trigger trg_prevent_user_privilege_escalation ya impide cambiar "rol" y
-- "hotelid" a quien no sea Super Admin.
CREATE POLICY "users_edicion" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (id = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "users_baja_admin" ON public.users
  FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- -----------------------------------------------------------------------------
-- 4. RESERVAS: el huésped ve y gestiona las suyas; el personal, todas.
--    La disponibilidad de terceros se consulta con get_busy_ranges().
-- -----------------------------------------------------------------------------
CREATE POLICY "reservations_lectura" ON public.reservations
  FOR SELECT TO authenticated
  USING (guestid = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "reservations_alta" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (guestid = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "reservations_edicion" ON public.reservations
  FOR UPDATE TO authenticated
  USING (guestid = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (guestid = auth.uid()::text OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "reservations_baja_admin" ON public.reservations
  FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- -----------------------------------------------------------------------------
-- 5. TRANSACCIONES: las de las reservas propias, o todas para el personal.
-- -----------------------------------------------------------------------------
CREATE POLICY "transactions_lectura" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
    OR EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = transactions.reservationid AND r.guestid = auth.uid()::text
    )
  );

CREATE POLICY "transactions_alta" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
    OR EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = transactions.reservationid AND r.guestid = auth.uid()::text
    )
  );

CREATE POLICY "transactions_edicion_personal" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'))
  WITH CHECK (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

CREATE POLICY "transactions_baja_personal" ON public.transactions
  FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

-- -----------------------------------------------------------------------------
-- 6. MENSAJES DE CHAT: los propios, los dirigidos a uno ([TO_CLIENT:id]) o,
--    para el personal, todos.
-- -----------------------------------------------------------------------------
CREATE POLICY "messages_lectura" ON public.messages
  FOR SELECT TO authenticated
  USING (
    senderid = auth.uid()::text
    OR text LIKE ('%[TO_CLIENT:' || auth.uid()::text || ']%')
    OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "messages_alta" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    senderid = auth.uid()::text
    OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "messages_edicion" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    senderid = auth.uid()::text
    OR text LIKE ('%[TO_CLIENT:' || auth.uid()::text || ']%')
    OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
  )
  WITH CHECK (
    senderid = auth.uid()::text
    OR text LIKE ('%[TO_CLIENT:' || auth.uid()::text || ']%')
    OR public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista')
  );

CREATE POLICY "messages_baja_personal" ON public.messages
  FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin', 'recepcionista'));

-- -----------------------------------------------------------------------------
-- 7. LOGS DE AUDITORÍA: cualquier usuario con sesión los escribe; solo los
--    administradores los leen. No se pueden modificar ni borrar desde la app.
-- -----------------------------------------------------------------------------
CREATE POLICY "logs_alta" ON public.logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "logs_lectura_admin" ON public.logs
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'hotel_admin'));

-- -----------------------------------------------------------------------------
-- 8. PERMISOS DE TABLA
--    Sin sesión: solo lectura (RLS deja pasar únicamente el catálogo público).
--    Con sesión: lectura y escritura, filtradas por las políticas de arriba.
-- -----------------------------------------------------------------------------
REVOKE ALL ON
  public.hotels, public.rooms, public.users, public.reservations, public.logs,
  public.messages, public.transactions, public.property_details, public.reviews,
  public.room_price_variations
FROM anon;

GRANT SELECT ON
  public.hotels, public.rooms, public.users, public.reservations, public.logs,
  public.messages, public.transactions, public.property_details, public.reviews,
  public.room_price_variations
TO anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON
  public.hotels, public.rooms, public.users, public.reservations, public.logs,
  public.messages, public.transactions, public.property_details, public.reviews,
  public.room_price_variations
FROM authenticated;

COMMIT;

SELECT 'PASO 2 aplicado: acceso público cerrado en Roomia PMS' AS resultado;
