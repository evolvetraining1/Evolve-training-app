-- EVOLVE TRAINING
-- Informations personnelles facultatives et photos de profil.

alter table public.profiles
  add column if not exists gender text not null default 'unspecified',
  add column if not exists age_years smallint,
  add column if not exists height_cm numeric(5,2),
  add column if not exists weight_kg numeric(6,2);

alter table public.profiles
  drop constraint if exists profiles_gender_check,
  drop constraint if exists profiles_age_years_check,
  drop constraint if exists profiles_height_cm_check,
  drop constraint if exists profiles_weight_kg_check;

alter table public.profiles
  add constraint profiles_gender_check
    check (gender in ('male', 'female', 'unspecified')),
  add constraint profiles_age_years_check
    check (age_years is null or age_years between 13 and 100),
  add constraint profiles_height_cm_check
    check (height_cm is null or height_cm between 100 and 250),
  add constraint profiles_weight_kg_check
    check (weight_kg is null or weight_kg between 30 and 350);

grant update (
  gender,
  age_years,
  height_cm,
  weight_kg
)
on table public.profiles
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own_folder" on storage.objects;
drop policy if exists "avatars_update_own_objects" on storage.objects;
drop policy if exists "avatars_delete_own_objects" on storage.objects;

create policy "avatars_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_update_own_objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_delete_own_objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid())::text
);
