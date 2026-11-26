-- Varias propiedades por anfitrión (propuesta A: la propiedad tiene dueño).
--
-- · hotels.owner_id: el anfitrión (admin de hotel) dueño de la propiedad. Un anfitrión ve y
--   administra todas sus propiedades; recepción sigue ligada a una sola (users.hotelid).
-- · mis_hoteles(): propiedades del usuario con sesión (las suyas como dueño + su users.hotelid).
-- · Límite del plan: un anfitrión no puede tener más propiedades que las de su plan
--   (Roomia 1 → 1, Roomia 3 → 3, Roomia 5 → 5; sin suscripción → 1). El superadmin no tiene límite.
-- · El módulo SRI y el bloqueo por falta de pago se resuelven por el dueño de la propiedad.

alter table public.hotels add column if not exists owner_id text references public.users(id) on delete set null;
create index if not exists hotels_owner_idx on public.hotels (owner_id);

-- Cada hotel actual queda con su admin actual como dueño
update public.hotels h set owner_id = u.id
  from public.users u
 where u.rol = 'hotel_admin' and u.hotelid = h.id and h.owner_id is null;

-- Propiedades del usuario con sesión
create or replace function public.mis_hoteles() returns setof text
language sql stable security definer set search_path = public as $$
  select h.id from public.hotels h where h.owner_id = auth.uid()::text
  union
  select u.hotelid from public.users u where u.id = auth.uid()::text and u.hotelid is not null
$$;
revoke all on function public.mis_hoteles() from public, anon;
grant execute on function public.mis_hoteles() to authenticated;

-- Dueños (anfitriones) de una propiedad: el de owner_id y, por compatibilidad, el admin enlazado
create or replace function public.duenos_del_hotel(p_hotel_id text) returns setof text
language sql stable security definer set search_path = public as $$
  select h.owner_id from public.hotels h where h.id = p_hotel_id and h.owner_id is not null
  union
  select u.id from public.users u where u.rol = 'hotel_admin' and u.hotelid = p_hotel_id
$$;
revoke all on function public.duenos_del_hotel(text) from public, anon;
grant execute on function public.duenos_del_hotel(text) to authenticated, service_role;

-- ¿El usuario administra o atiende esta propiedad? (lo usan la función sri y las políticas)
create or replace function public.usuario_gestiona_hotel(p_user_id text, p_hotel_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotels h where h.id = p_hotel_id and h.owner_id = p_user_id)
      or exists (select 1 from public.users u where u.id = p_user_id and u.hotelid = p_hotel_id)
$$;
revoke all on function public.usuario_gestiona_hotel(text, text) from public, anon, authenticated;
grant execute on function public.usuario_gestiona_hotel(text, text) to service_role;

create or replace function public.es_personal_del_hotel(p_hotel_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.get_my_role() = 'super_admin'
      or (public.get_my_role() in ('hotel_admin', 'recepcionista') and p_hotel_id in (select public.mis_hoteles()))
$$;

-- Módulo SRI vigente: lo paga el dueño de la propiedad
create or replace function public.sri_modulo_activo(p_hotel_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
     where s.owner_id in (select public.duenos_del_hotel(p_hotel_id))
       and s.sri_hasta is not null
       and s.sri_hasta >= now()
       and public.estado_plan(s) not in ('suspendida', 'cancelada')
  )
$$;

-- Reservas nuevas bloqueadas si el dueño está suspendido o cancelado
create or replace function public.hotel_admite_reservas(p_hotel_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.subscriptions s
     where s.owner_id in (select public.duenos_del_hotel(p_hotel_id))
       and public.estado_plan(s) in ('suspendida', 'cancelada')
  )
$$;

create or replace function public.hoteles_sin_reservas() returns setof text
language sql stable security definer set search_path = public as $$
  select h.id from public.hotels h where not public.hotel_admite_reservas(h.id)
$$;
grant execute on function public.hoteles_sin_reservas() to anon, authenticated;

-- Límite de propiedades según el plan del dueño
create or replace function public.limite_propiedades(p_owner_id text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case s.plan_id when 'roomia-5' then 5 when 'roomia-3' then 3 else 1 end
      from public.subscriptions s where s.owner_id = p_owner_id
  ), 1)
$$;
revoke all on function public.limite_propiedades(text) from public, anon;
grant execute on function public.limite_propiedades(text) to authenticated, service_role;

-- Dueño de las propiedades nuevas y límite del plan
create or replace function public.hotels_dueno_y_limite() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text := public.get_my_role();
  v_servidor boolean := coalesce(current_setting('role', true), '') = 'service_role' or auth.uid() is null;
begin
  if not v_servidor and v_rol is distinct from 'super_admin' then
    if tg_op = 'INSERT' then
      -- Un anfitrión crea sus propiedades: queda como dueño
      new.owner_id := auth.uid()::text;
    elsif new.owner_id is distinct from old.owner_id then
      -- Solo el superadmin cambia el dueño
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
$$;
drop trigger if exists hotels_dueno_y_limite on public.hotels;
create trigger hotels_dueno_y_limite before insert or update on public.hotels
  for each row execute function public.hotels_dueno_y_limite();

-- Hoteles: el anfitrión solo crea y edita sus propiedades (antes podía editar cualquiera)
drop policy if exists hotels_gestion_admin on public.hotels;
create policy hotels_gestion_admin on public.hotels
  for all to authenticated
  using (public.get_my_role() = 'super_admin' or (public.get_my_role() = 'hotel_admin' and id in (select public.mis_hoteles())))
  with check (public.get_my_role() = 'super_admin' or (public.get_my_role() = 'hotel_admin' and (owner_id = auth.uid()::text or id in (select public.mis_hoteles()))));

-- Calendarios externos y pagos: todas las propiedades del usuario
drop policy if exists external_blocks_lectura_personal on public.external_blocks;
create policy external_blocks_lectura_personal on public.external_blocks
  for select to authenticated
  using (public.get_my_role() = 'super_admin' or (public.get_my_role() in ('hotel_admin', 'recepcionista') and hotel_id in (select public.mis_hoteles())));

drop policy if exists ical_feeds_gestion on public.ical_feeds;
create policy ical_feeds_gestion on public.ical_feeds
  for all to authenticated
  using (public.get_my_role() = 'super_admin' or (public.get_my_role() = 'hotel_admin' and hotel_id in (select public.mis_hoteles())))
  with check (public.get_my_role() = 'super_admin' or (public.get_my_role() = 'hotel_admin' and hotel_id in (select public.mis_hoteles())));

drop policy if exists payments_lectura on public.payments;
create policy payments_lectura on public.payments
  for select to authenticated
  using (payer_id = auth.uid() or public.get_my_role() = 'super_admin'
         or (public.get_my_role() in ('hotel_admin', 'recepcionista') and hotel_id in (select public.mis_hoteles())));
