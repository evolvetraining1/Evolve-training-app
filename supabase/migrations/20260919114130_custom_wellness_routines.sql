-- Habitudes personnalisées : chaque utilisateur ne voit et ne modifie que les siennes.

alter table public.routine_catalog
  add column if not exists created_by uuid references auth.users(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

alter table public.routine_catalog
  drop constraint if exists routine_catalog_custom_slug_check;

alter table public.routine_catalog
  add constraint routine_catalog_custom_slug_check
  check (created_by is null or slug like 'custom:%');

create index if not exists routine_catalog_created_by_idx
  on public.routine_catalog (created_by)
  where created_by is not null;

drop policy if exists routine_catalog_read on public.routine_catalog;
create policy routine_catalog_read
  on public.routine_catalog
  for select
  to authenticated
  using (
    active = true
    and (created_by is null or (select auth.uid()) = created_by)
  );

drop policy if exists routine_catalog_insert_own_custom on public.routine_catalog;
create policy routine_catalog_insert_own_custom
  on public.routine_catalog
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and slug like 'custom:%'
    and default_enabled = false
  );

drop policy if exists routine_catalog_update_own_custom on public.routine_catalog;
create policy routine_catalog_update_own_custom
  on public.routine_catalog
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by and slug like 'custom:%');

drop policy if exists routine_catalog_delete_own_custom on public.routine_catalog;
create policy routine_catalog_delete_own_custom
  on public.routine_catalog
  for delete
  to authenticated
  using ((select auth.uid()) = created_by);

grant select, insert, update, delete on public.routine_catalog to authenticated;
revoke all on public.routine_catalog from anon;
