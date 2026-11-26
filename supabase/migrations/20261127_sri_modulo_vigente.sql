-- El módulo de facturación electrónica del SRI solo funciona si está pagado y vigente.
--
-- · subscriptions.sri_hasta: fecha hasta la que está pagado el módulo SRI. Al pagar un período del
--   plan que incluye el módulo, sri_hasta pasa a ser el nuevo fin del período.
-- · sri_modulo_activo(hotel): el anfitrión (admin de hotel) del establecimiento tiene el módulo
--   pagado hasta hoy y su plan no está suspendido ni cancelado. Sin eso no se crea la factura
--   automática del check-out y la función sri rechaza las acciones de ese establecimiento.
-- · El pago del plan puede incluir la puesta en marcha como adicional (details.setup = true).

alter table public.subscriptions add column if not exists sri_hasta timestamptz;

create or replace function public.sri_modulo_activo(p_hotel_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.users u
    join public.subscriptions s on s.owner_id = u.id
    where u.rol = 'hotel_admin'
      and u.hotelid = p_hotel_id
      and s.sri_hasta is not null
      and s.sri_hasta >= now()
      and public.estado_plan(s) not in ('suspendida', 'cancelada')
  )
$$;
revoke all on function public.sri_modulo_activo(text) from public, anon;
grant execute on function public.sri_modulo_activo(text) to authenticated, service_role;

-- Check-out: factura automática solo con el módulo vigente, emisión activa y firma vigente
create or replace function public.sri_reserva_cambio_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is not distinct from old.estado then return null; end if;

  if new.estado = 'finalizada' and coalesce(new.total, 0) > 0 then
    if public.sri_modulo_activo(new.hotelid)
       and exists (select 1 from sri_emisores e where e.hotel_id = new.hotelid and e.activo and e.cert_valido_hasta > now())
       and not exists (select 1 from sri_comprobantes c where c.reservation_id = new.id and c.estado <> 'anulado') then
      begin
        perform sri_crear_comprobante(new.id, 'automatica');
      exception when others then
        raise warning 'SRI: no se creó la factura de la reserva %: %', new.id, sqlerrm;
      end;
    end if;
  end if;

  -- Cancelación: lo que no llegó al SRI se anula; una factura autorizada se marca para anular en SRI en línea
  if new.estado = 'cancelada' then
    update sri_comprobantes set estado = 'anulado', updated_at = now()
     where reservation_id = new.id and not recibido and estado in ('pendiente', 'error', 'devuelta');
    update sri_comprobantes set anulacion_portal = true, updated_at = now()
     where reservation_id = new.id and estado = 'autorizado';
  end if;
  return null;
end;
$$;

-- Aplica un cobro del plan: extiende el período (con el módulo SRI y la puesta en marcha si se
-- pagaron) o marca la puesta en marcha pagada por separado (uso interno)
create or replace function public._aplicar_cobro_plan(pay public.payments) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sub public.subscriptions%rowtype;
  v_plan text := coalesce(pay.details ->> 'planId', 'roomia-1');
  v_billing text := coalesce(pay.details ->> 'billing', 'mensual');
  v_sri boolean := coalesce((pay.details ->> 'sri')::boolean, false);
  v_setup boolean := coalesce((pay.details ->> 'setup')::boolean, false);
  v_base timestamptz;
  v_fin timestamptz;
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
    v_fin := v_base + case when v_billing = 'anual' then interval '1 year' else interval '1 month' end;
    update public.subscriptions set
      plan_id = v_plan,
      billing = v_billing,
      sri_modulo = v_sri,
      sri_hasta = case when v_sri then v_fin else sri_hasta end,
      setup_paid = setup_paid or v_setup,
      status = case when status = 'cancelada' then 'cancelada' else 'activa' end,
      current_period_end = v_fin
    where id = sub.id;
  end if;

  update public.payments set subscription_id = sub.id where id = pay.id;
  select * into sub from public.subscriptions where id = sub.id;
  return jsonb_build_object('subscriptionId', sub.id, 'currentPeriodEnd', sub.current_period_end,
    'setupPaid', sub.setup_paid, 'sriModulo', sub.sri_modulo, 'sriHasta', sub.sri_hasta);
end;
$$;
revoke all on function public._aplicar_cobro_plan(public.payments) from public, anon, authenticated;
