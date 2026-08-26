alter table public.profiles
add column if not exists selected_program_id uuid
references public.programs(id)
on delete set null;

drop policy if exists "profile_self_update_selected_program" on public.profiles;

create policy "profile_self_update_selected_program"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
