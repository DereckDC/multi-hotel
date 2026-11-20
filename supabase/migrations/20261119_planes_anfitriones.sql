-- Planes de los anfitriones (admin de hotel): suscripción, pagos del plan y restricciones por falta de pago.
--
-- · subscriptions: una fila por anfitrión. Solo la edita el superadmin; el anfitrión solo la lee.
-- · payments (ya existe): los cobros del plan usan kind 'plan' o 'puesta_en_marcha' y quedan ligados
--   a la suscripción. Payphone los aplica con aplicar_pago_plan (solo el servidor); el superadmin
--   registra pagos manuales (transferencia o efectivo) con registrar_pago_plan_manual.
-- · Estado real (al día, vencida, suspendida…) calculado con las fechas: estado_plan().
-- · Un establecimiento cuyo anfitrión está suspendido o cancelado no recibe reservas nuevas de
--   huéspedes (trigger en reservations). Los anfitriones sin suscripción no se bloquean.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null unique references public.users(id) on delete cascade,
  plan_id text not null default 'roomia-1' check (plan_id in ('roomia-1', 'roomia-3', 'roomia-5')),
  billing text not null default 'mensual' check (billing in ('mensual', 'anual')),
  status text not null default 'prueba' check (status in ('prueba', 'activa', 'suspendida', 'cancelada')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  grace_days integer not null default 7 check (grace_days between 0 and 60),
  setup_paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_lectura on public.subscriptions;
create policy subscriptions_lectura on public.subscriptions
  for select to authenticated
  using (owner_id = auth.uid()::text or public.get_my_role() = 'super_admin');

drop policy if exists subscriptions_gestion_super on public.subscriptions;
create policy subscriptions_gestion_super on public.subscriptions
  for all to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

revoke all on public.subscriptions from anon;

create or replace function public.subscriptions_tocar_fecha() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.subscriptions_tocar_fecha();

-- Pagos del plan ligados a la suscripción, con el detalle cobrado y el medio de pago
alter table public.payments add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;
alter table public.payments add column if not exists details jsonb;
alter table public.payments add column if not exists method text not null default 'payphone';
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('payphone', 'transferencia', 'efectivo', 'otro'));
alter table public.payments add column if not exists recorded_by text;
create index if not exists payments_subscription_idx on public.payments (subscription_id);

-- Estado real de una suscripción (misma regla que effectiveStatus en _shared/plans.ts)
create or replace function public.estado_plan(s public.subscriptions) returns text
language sql stable set search_path = public as $$
  select case
    when s.id is null then 'sin_plan'
    when s.status in ('cancelada', 'suspendida') then s.status
    when coalesce(s.current_period_end, s.trial_ends_at) is null then 'sin_plan'
    when now() <= coalesce(s.current_period_end, s.trial_ends_at) then s.status
    when now() <= coalesce(s.current_period_end, s.trial_ends_at) + make_interval(days => greatest(s.grace_days, 0)) then 'vencida'
    else 'suspendida'
  end
$$;

-- Aplica un cobro del plan: extiende el período o marca la puesta en marcha (uso interno)
create or replace function public._aplicar_cobro_plan(pay public.payments) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sub public.subscriptions%rowtype;
  v_plan text := coalesce(pay.details ->> 'planId', 'roomia-1');
  v_billing text := coalesce(pay.details ->> 'billing', 'mensual');
  v_base timestamptz;
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
    update public.subscriptions set
      plan_id = v_plan,
      billing = v_billing,
      status = case when status = 'cancelada' then 'cancelada' else 'activa' end,
      current_period_end = v_base + case when v_billing = 'anual' then interval '1 year' else interval '1 month' end
    where id = sub.id;
  end if;

  update public.payments set subscription_id = sub.id where id = pay.id;
  select * into sub from public.subscriptions where id = sub.id;
  return jsonb_build_object('subscriptionId', sub.id, 'currentPeriodEnd', sub.current_period_end, 'setupPaid', sub.setup_paid);
end;
$$;
revoke all on function public._aplicar_cobro_plan(public.payments) from public, anon, authenticated;

-- Pago de Payphone aprobado (lo llama la función Edge payphone con service_role). Idempotente.
create or replace function public.aplicar_pago_plan(
  p_payment_id uuid,
  p_payphone_id text,
  p_card_brand text,
  p_last_digits text,
  p_authorization_code text
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
$$;
revoke all on function public.aplicar_pago_plan(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.aplicar_pago_plan(uuid, text, text, text, text) to service_role;

-- Pago manual registrado por el superadmin (transferencia, efectivo…)
create or replace function public.registrar_pago_plan_manual(
  p_owner_id text,
  p_kind text,
  p_plan_id text,
  p_billing text,
  p_amount numeric,
  p_method text,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
    jsonb_build_object('planId', p_plan_id, 'billing', p_billing, 'manual', true), now()
  ) returning * into pay;

  result := public._aplicar_cobro_plan(pay);
  return result || jsonb_build_object('paymentId', pay.id);
end;
$$;
revoke all on function public.registrar_pago_plan_manual(text, text, text, text, numeric, text, text) from public, anon;
grant execute on function public.registrar_pago_plan_manual(text, text, text, text, numeric, text, text) to authenticated;

-- ¿Este establecimiento recibe reservas nuevas? No, si su anfitrión está suspendido o cancelado.
create or replace function public.hotel_admite_reservas(p_hotel_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
    from public.users u
    join public.subscriptions s on s.owner_id = u.id
    where u.rol = 'hotel_admin'
      and u.hotelid = p_hotel_id
      and public.estado_plan(s) in ('suspendida', 'cancelada')
  )
$$;

-- Lista para el catálogo: establecimientos que hoy no reciben reservas
create or replace function public.hoteles_sin_reservas() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct u.hotelid
  from public.users u
  join public.subscriptions s on s.owner_id = u.id
  where u.rol = 'hotel_admin'
    and u.hotelid is not null
    and public.estado_plan(s) in ('suspendida', 'cancelada')
$$;
grant execute on function public.hoteles_sin_reservas() to anon, authenticated;

-- Las reservas que crean los huéspedes se rechazan si el establecimiento está suspendido.
-- Recepción, administradores y el servidor no se bloquean (atienden lo que ya existe).
create or replace function public.reservas_bloqueo_por_plan() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.get_my_role() in ('cliente', 'anon') and not public.hotel_admite_reservas(new.hotelid) then
    raise exception 'Este establecimiento no está recibiendo reservas en este momento.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists reservas_bloqueo_por_plan on public.reservations;
create trigger reservas_bloqueo_por_plan before insert on public.reservations
  for each row execute function public.reservas_bloqueo_por_plan();
