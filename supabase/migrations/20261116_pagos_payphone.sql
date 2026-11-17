-- Fase 1 de pagos: cobros de reservas con la Cajita de Payphone.
-- La tabla `payments` solo la escribe el servidor (función Edge `payphone` con service_role).

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reserva_abono', 'reserva_total', 'reserva_saldo', 'plan', 'puesta_en_marcha')),
  reservation_id text references public.reservations(id) on delete set null,
  hotel_id text,
  payer_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  amount_with_tax integer not null default 0,
  amount_without_tax integer not null default 0,
  tax_cents integer not null default 0,
  currency text not null default 'USD',
  client_transaction_id text not null unique,
  payphone_transaction_id text,
  status text not null default 'creado'
    check (status in ('creado', 'procesando', 'aprobado', 'cancelado', 'expirado', 'error')),
  status_detail text,
  card_brand text,
  last_digits text,
  authorization_code text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint payments_suma_cuadra check (amount_cents = amount_with_tax + amount_without_tax + tax_cents)
);
create index if not exists payments_reservation_idx on public.payments (reservation_id);
create index if not exists payments_payer_idx on public.payments (payer_id);
create index if not exists payments_pendientes_idx on public.payments (status, created_at) where status in ('creado', 'procesando');

alter table public.payments enable row level security;

drop policy if exists payments_lectura on public.payments;
create policy payments_lectura on public.payments
  for select to authenticated
  using (
    payer_id = auth.uid()
    or public.get_my_role() = 'super_admin'
    or (
      public.get_my_role() = any (array['hotel_admin', 'recepcionista'])
      and hotel_id = (select u.hotelid from public.users u where u.id = auth.uid()::text)
    )
  );
-- Sin políticas de alta/edición/baja: solo el servidor escribe.

-- Aplica un pago aprobado por Payphone en una sola operación (idempotente).
create or replace function public.aplicar_pago_reserva(
  p_payment_id uuid,
  p_payphone_id text,
  p_card_brand text,
  p_last_digits text,
  p_authorization_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments%rowtype;
  res public.reservations%rowtype;
  info jsonb;
  pagado numeric;
  pendiente numeric;
  limpio text;
  ahora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'pago no encontrado';
  end if;
  if pay.status = 'aprobado' then
    return jsonb_build_object('yaAplicado', true, 'reservationId', pay.reservation_id);
  end if;

  select * into res from public.reservations where id = pay.reservation_id for update;
  if not found then
    raise exception 'reserva no encontrada';
  end if;

  begin
    info := (regexp_match(coalesce(res.notes, ''), '\[PAYMENT_INFO:(.*?)\]'))[1]::jsonb;
  exception when others then
    info := null;
  end;
  pagado := coalesce((info ->> 'montoPagado')::numeric, 0);
  pagado := least(res.total, round(pagado + pay.amount_cents / 100.0, 2));
  pendiente := round(res.total - pagado, 2);
  limpio := btrim(regexp_replace(coalesce(res.notes, ''), '\s*\[PAYMENT_INFO:.*?\]', '', 'g'));

  update public.reservations set
    estado = case when estado = 'pendiente' then 'confirmada' else estado end,
    notes = limpio || case when limpio = '' then '' else ' ' end
            || '[PAYMENT_INFO:' || jsonb_build_object('montoPagado', pagado, 'montoPendiente', pendiente)::text || ']',
    modificadopor = 'Payphone',
    mensajecambio = 'Pago en línea recibido: $' || to_char(pay.amount_cents / 100.0, 'FM999999990.00'),
    fechacambio = ahora
  where id = res.id;

  insert into public.transactions (id, reservationid, amount, currency, paymentmethod, status, reference, fecha)
  values (
    'TX-' || pay.client_transaction_id,
    res.id,
    pay.amount_cents / 100.0,
    pay.currency,
    'Payphone' || coalesce(' · ' || nullif(p_card_brand, ''), '') || coalesce(' ****' || nullif(p_last_digits, ''), ''),
    'completado',
    'Payphone ' || coalesce(nullif(p_payphone_id, ''), pay.client_transaction_id)
      || coalesce(' · Aut. ' || nullif(p_authorization_code, ''), ''),
    ahora
  )
  on conflict do nothing;

  insert into public.logs (id, timestamp, "user", role, action, detalles)
  values (
    'log-pago-' || pay.id,
    ahora,
    'Payphone',
    'sistema',
    'Pago en línea aprobado',
    'Reserva ' || res.id || ': $' || to_char(pay.amount_cents / 100.0, 'FM999999990.00')
      || ' (' || pay.kind || '). Pagado $' || pagado || ', pendiente $' || pendiente || '.'
  )
  on conflict (id) do nothing;

  update public.payments set
    status = 'aprobado',
    status_detail = null,
    payphone_transaction_id = p_payphone_id,
    card_brand = nullif(p_card_brand, ''),
    last_digits = nullif(p_last_digits, ''),
    authorization_code = nullif(p_authorization_code, ''),
    confirmed_at = now()
  where id = pay.id;

  return jsonb_build_object('yaAplicado', false, 'reservationId', res.id, 'montoPagado', pagado, 'montoPendiente', pendiente);
end;
$$;
revoke all on function public.aplicar_pago_reserva(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.aplicar_pago_reserva(uuid, text, text, text, text) to service_role;

-- Los formularios de la Cajita duran 10 minutos: a los 20 sin confirmar, el pago se da por expirado.
select cron.unschedule('payments-expirar') where exists (select 1 from cron.job where jobname = 'payments-expirar');
select cron.schedule(
  'payments-expirar',
  '*/5 * * * *',
  $$update public.payments set status = 'expirado', status_detail = 'Sin confirmar a tiempo'
    where status = 'creado' and created_at < now() - interval '20 minutes'$$
);
