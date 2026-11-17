-- Fase 0 de pagos: el huésped no puede confirmar su reserva ni registrar pagos.
-- Solo el personal, las funciones del servidor (service_role) y el SQL directo pueden.

create or replace function public.es_personal_o_servidor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Sin token (SQL directo, pg_cron, migraciones) o con service_role = servidor.
  -- (No usar current_user: dentro de security definer es el dueño de la función.)
  select
    coalesce(auth.jwt() ->> 'role', '') in ('', 'service_role')
    or public.get_my_role() = any (array['super_admin', 'hotel_admin', 'recepcionista']);
$$;
revoke all on function public.es_personal_o_servidor() from public, anon;
grant execute on function public.es_personal_o_servidor() to authenticated, service_role;

-- Reservas creadas o editadas por un huésped: las columnas de pago, precio y estado no se tocan.
-- No se rechaza el guardado (la app reenvía la fila completa): se restaura el valor protegido.
create or replace function public.reservas_proteger_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_personal_o_servidor() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.guestid := auth.uid()::text;
    new.notes := btrim(regexp_replace(coalesce(new.notes, ''), '\s*\[PAYMENT_INFO:.*?\]', '', 'g'));
    new.checkedinat := null;
    new.checkedoutat := null;
    new.recepcionistaid := null;
    return new;
  end if;

  -- UPDATE de un huésped: solo puede cancelar u ocultar su reserva
  if new.estado is distinct from old.estado
     and not (new.estado = 'cancelada' and old.estado in ('pendiente', 'confirmada')) then
    new.estado := old.estado;
  end if;
  new.guestid := old.guestid;
  new.hotelid := old.hotelid;
  new.roomid := old.roomid;
  new.fechaentrada := old.fechaentrada;
  new.fechasalida := old.fechasalida;
  new.noches := old.noches;
  new.subtotal := old.subtotal;
  new.impuestos := old.impuestos;
  new.total := old.total;
  new.serviciosadicionales := old.serviciosadicionales;
  new.notes := old.notes;
  new.qrcode := old.qrcode;
  new.checkedinat := old.checkedinat;
  new.checkedoutat := old.checkedoutat;
  new.recepcionistaid := old.recepcionistaid;
  new.reservation_type := old.reservation_type;
  return new;
end;
$$;
revoke all on function public.reservas_proteger_pago() from public, anon, authenticated;

drop trigger if exists trg_reservas_proteger_pago on public.reservations;
create trigger trg_reservas_proteger_pago
  before insert or update on public.reservations
  for each row execute function public.reservas_proteger_pago();

-- Transacciones de pago: solo el personal (y el servidor, que no pasa por RLS)
drop policy if exists transactions_alta on public.transactions;
create policy transactions_alta on public.transactions
  for insert to authenticated
  with check (public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text, 'recepcionista'::text]));
