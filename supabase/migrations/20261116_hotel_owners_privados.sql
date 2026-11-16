-- Datos privados del propietario (aplicado en producción el 16/11/2026).
-- Correo y cédula del propietario salen de hotels.contacto (lectura pública) a hotel_owners,
-- que solo leen superadmin y admin de hotel. En contacto.propietario quedan nombre y teléfono.

create table if not exists public.hotel_owners (
  hotel_id text primary key,
  nombre text,
  telefono text,
  email text,
  documento text,
  updated_at timestamptz not null default now()
);

alter table public.hotel_owners drop constraint if exists hotel_owners_hotel_id_fkey;
alter table public.hotel_owners
  add constraint hotel_owners_hotel_id_fkey foreign key (hotel_id)
  references public.hotels(id) on delete cascade deferrable initially deferred;

alter table public.hotel_owners enable row level security;
drop policy if exists hotel_owners_gestion_admin on public.hotel_owners;
create policy hotel_owners_gestion_admin on public.hotel_owners
  for all to authenticated
  using (public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text]))
  with check (public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text]));
revoke all on public.hotel_owners from anon;

-- Copia inicial desde hotels.contacto
insert into public.hotel_owners (hotel_id, nombre, telefono, email, documento)
select h.id,
       nullif(btrim(h.contacto->'propietario'->>'nombre'), ''),
       nullif(btrim(h.contacto->'propietario'->>'telefono'), ''),
       nullif(btrim(h.contacto->'propietario'->>'email'), ''),
       nullif(btrim(h.contacto->'propietario'->>'documento'), '')
from public.hotels h
where jsonb_typeof(h.contacto->'propietario') = 'object'
on conflict (hotel_id) do nothing;

-- Separa lo privado al guardar (también protege a versiones antiguas de la app).
-- Un valor vacío o ausente no borra el guardado.
create or replace function public.hotels_separar_propietario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p jsonb; v_nombre text; v_tel text; v_email text; v_doc text;
begin
  p := new.contacto -> 'propietario';
  if p is null or jsonb_typeof(p) <> 'object' then return new; end if;
  v_nombre := nullif(btrim(p ->> 'nombre'), '');
  v_tel := nullif(btrim(p ->> 'telefono'), '');
  v_email := nullif(btrim(p ->> 'email'), '');
  v_doc := nullif(btrim(p ->> 'documento'), '');
  if coalesce(v_nombre, v_tel, v_email, v_doc) is not null then
    insert into public.hotel_owners (hotel_id, nombre, telefono, email, documento)
    values (new.id, v_nombre, v_tel, v_email, v_doc)
    on conflict (hotel_id) do update set
      nombre = coalesce(excluded.nombre, public.hotel_owners.nombre),
      telefono = coalesce(excluded.telefono, public.hotel_owners.telefono),
      email = coalesce(excluded.email, public.hotel_owners.email),
      documento = coalesce(excluded.documento, public.hotel_owners.documento),
      updated_at = now();
  end if;
  new.contacto := jsonb_set(new.contacto, '{propietario}',
    jsonb_build_object('nombre', coalesce(p ->> 'nombre', ''), 'telefono', coalesce(p ->> 'telefono', '')));
  return new;
end;
$$;
revoke all on function public.hotels_separar_propietario() from public, anon, authenticated;
drop trigger if exists trg_hotels_separar_propietario on public.hotels;
create trigger trg_hotels_separar_propietario
  before insert or update on public.hotels
  for each row execute function public.hotels_separar_propietario();

-- property_details es de lectura pública: nunca guarda correo ni cédula del propietario
create or replace function public.property_details_sin_datos_privados()
returns trigger language plpgsql set search_path = public as $$
begin
  new.owner_email := null;
  new.owner_document := null;
  return new;
end;
$$;
revoke all on function public.property_details_sin_datos_privados() from public, anon, authenticated;
drop trigger if exists trg_property_details_sin_datos_privados on public.property_details;
create trigger trg_property_details_sin_datos_privados
  before insert or update on public.property_details
  for each row execute function public.property_details_sin_datos_privados();

-- Limpieza de lo ya publicado
update public.hotels set contacto = contacto where jsonb_typeof(contacto -> 'propietario') = 'object';
update public.property_details set owner_email = null, owner_document = null
where owner_email is not null or owner_document is not null;
