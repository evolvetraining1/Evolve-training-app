-- Journal V2: routines planifiables, valeurs horaires fiables et tendances.

alter table public.routine_logs
  add column if not exists text_value text;

alter table public.user_routines
  add column if not exists scheduled_days smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  add column if not exists position integer not null default 100,
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_routines
  drop constraint if exists user_routines_scheduled_days_check;

alter table public.user_routines
  add constraint user_routines_scheduled_days_check
  check (scheduled_days <@ array[0,1,2,3,4,5,6]::smallint[]);

create table if not exists public.daily_wellness_scores (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  score_date date not null default current_date,
  recovery_score smallint check (recovery_score between 0 and 100),
  stress_score smallint check (stress_score between 0 and 100),
  readiness_score smallint check (readiness_score between 0 and 100),
  habit_score smallint check (habit_score between 0 and 100),
  completion_score smallint not null default 0 check (completion_score between 0 and 100),
  confidence_score smallint not null default 0 check (confidence_score between 0 and 100),
  inputs_count smallint not null default 0 check (inputs_count >= 0),
  algorithm_version text not null default 'evolve-wellness-v2',
  components jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, score_date)
);

create index if not exists daily_wellness_scores_athlete_date_idx
  on public.daily_wellness_scores (athlete_id, score_date desc);

alter table public.daily_wellness_scores enable row level security;

drop policy if exists daily_wellness_scores_own_all on public.daily_wellness_scores;
create policy daily_wellness_scores_own_all
  on public.daily_wellness_scores
  for all
  to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

drop policy if exists daily_wellness_scores_coach_read on public.daily_wellness_scores;
create policy daily_wellness_scores_coach_read
  on public.daily_wellness_scores
  for select
  to authenticated
  using (public.is_coach_of(athlete_id));

grant select, insert, update, delete on public.daily_wellness_scores to authenticated;
grant all on public.daily_wellness_scores to service_role;
revoke all on public.daily_wellness_scores from anon;

-- Ces données appartiennent à un utilisateur connecté. L'accès anonyme n'est
-- pas nécessaire et les politiques RLS restent la barrière d'autorisation.
revoke all on public.routine_logs from anon;
revoke all on public.user_routines from anon;
