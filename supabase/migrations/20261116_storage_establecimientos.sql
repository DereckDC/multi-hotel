-- Fotos de hoteles, propiedades y habitaciones (aplicado en produccion el 16/11/2026).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('establecimientos', 'establecimientos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists establecimientos_subida_personal on storage.objects;
create policy establecimientos_subida_personal on storage.objects for insert to authenticated
  with check (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text, 'recepcionista'::text]));
drop policy if exists establecimientos_edicion_personal on storage.objects;
create policy establecimientos_edicion_personal on storage.objects for update to authenticated
  using (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text, 'recepcionista'::text]))
  with check (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text, 'recepcionista'::text]));
drop policy if exists establecimientos_borrado_personal on storage.objects;
create policy establecimientos_borrado_personal on storage.objects for delete to authenticated
  using (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text, 'recepcionista'::text]));

-- Respaldo de las direcciones de imagenes antes de moverlas al almacenamiento propio
create table if not exists public.image_migration_backup (
  tabla text not null, registro_id text not null, imagenes text[], portada text, logo text,
  guardado_en timestamptz not null default now(), primary key (tabla, registro_id));
alter table public.image_migration_backup enable row level security;
revoke all on public.image_migration_backup from anon, authenticated;

-- Para borrar o reemplazar archivos, Storage exige que el personal tambien pueda "verlos" por la API
drop policy if exists establecimientos_lectura_personal on storage.objects;
create policy establecimientos_lectura_personal on storage.objects for select to authenticated
  using (bucket_id = 'establecimientos' and public.get_my_role() = any (array['super_admin'::text, 'hotel_admin'::text, 'recepcionista'::text]));
