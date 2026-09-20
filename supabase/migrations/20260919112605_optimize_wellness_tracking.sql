create index if not exists routine_logs_routine_id_idx
  on public.routine_logs (routine_id);

create index if not exists user_routines_routine_id_idx
  on public.user_routines (routine_id);

drop policy if exists routine_logs_own_all on public.routine_logs;
create policy routine_logs_own_all
  on public.routine_logs
  for all
  to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

drop policy if exists user_routines_own_all on public.user_routines;
create policy user_routines_own_all
  on public.user_routines
  for all
  to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);
