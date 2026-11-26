-- Módulo adicional de facturación electrónica del SRI dentro del plan del anfitrión.
--
-- · subscriptions.sri_modulo: el período pagado incluye el módulo SRI.
-- · El pago del plan (Payphone o manual) lleva details.sri = true cuando incluye el módulo; al
--   aplicarlo, sri_modulo queda con ese valor para el período que se paga.
-- · registrar_pago_plan_manual recibe p_sri (el superadmin marca si el pago incluye el módulo).

alter table public.subscriptions add column if not exists sri_modulo boolean not null default false;

-- Aplica un cobro del plan: extiende el período o marca la puesta en marcha (uso interno)
create or replace function public._aplicar_cobro_plan(pay public.payments) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sub public.subscriptions%rowtype;
  v_plan text := coalesce(pay.details ->> 'planId', 'roomia-1');
  v_billing text := coalesce(pay.details ->> 'billing', 'mensual');
  v_sri boolean := coalesce((pay.details ->> 'sri')::boolean, false);
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
      sri_modulo = v_sri,
      status = case when status = 'cancelada' then 'cancelada' else 'activa' end,
      current_period_end = v_base + case when v_billing = 'anual' then interval '1 year' else interval '1 month' end
    where id = sub.id;
  end if;

  update public.payments set subscription_id = sub.id where id = pay.id;
  select * into sub from public.subscriptions where id = sub.id;
  return jsonb_build_object('subscriptionId', sub.id, 'currentPeriodEnd', sub.current_period_end, 'setupPaid', sub.setup_paid, 'sriModulo', sub.sri_modulo);
end;
$$;
revoke all on function public._aplicar_cobro_plan(public.payments) from public, anon, authenticated;

-- Pago manual registrado por el superadmin (transferencia, efectivo…), con o sin el módulo SRI
drop function if exists public.registrar_pago_plan_manual(text, text, text, text, numeric, text, text);
create or replace function public.registrar_pago_plan_manual(
  p_owner_id text,
  p_kind text,
  p_plan_id text,
  p_billing text,
  p_amount numeric,
  p_method text,
  p_note text,
  p_sri boolean default false
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
    jsonb_build_object('planId', p_plan_id, 'billing', p_billing, 'manual', true, 'sri', p_kind = 'plan' and coalesce(p_sri, false)), now()
  ) returning * into pay;

  result := public._aplicar_cobro_plan(pay);
  return result || jsonb_build_object('paymentId', pay.id);
end;
$$;
revoke all on function public.registrar_pago_plan_manual(text, text, text, text, numeric, text, text, boolean) from public, anon;
grant execute on function public.registrar_pago_plan_manual(text, text, text, text, numeric, text, text, boolean) to authenticated;
