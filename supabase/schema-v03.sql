-- EVOLVE TRAINING — Supabase/PostgreSQL V0.2
-- Core: auth, coach-athlete relationship, programs, workouts,
-- prescribed vs performed sets, journal and feature permissions.

create extension if not exists pgcrypto;

create type public.user_role as enum ('coach','athlete','admin');
create type public.relationship_status as enum ('pending','active','paused','ended');
create type public.workout_status as enum ('planned','in_progress','completed','skipped');
create type public.feature_code as enum (
  'training','journal','nutrition','advanced_stats','messaging','custom_protocols'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'athlete',
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_athlete_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  status public.relationship_status not null default 'active',
  started_at date not null default current_date,
  ended_at date,
  unique(coach_id, athlete_id),
  check (coach_id <> athlete_id)
);

create table public.service_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_features (
  plan_id uuid not null references public.service_plans(id) on delete cascade,
  feature public.feature_code not null,
  enabled boolean not null default true,
  primary key (plan_id, feature)
);

create table public.athlete_subscriptions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.service_plans(id),
  starts_at date not null default current_date,
  ends_at date,
  active boolean not null default true
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_coach_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  instructions text,
  video_url text,
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  duration_weeks int check (duration_weeks is null or duration_weeks > 0),
  created_at timestamptz not null default now()
);

create table public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  active boolean not null default true
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_number int not null check (week_number > 0),
  day_number int not null check (day_number between 1 and 7),
  name text not null,
  notes text,
  estimated_minutes int check (estimated_minutes is null or estimated_minutes > 0)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  position int not null,
  prescription_notes text,
  unique(workout_template_id, position)
);

create table public.prescribed_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number int not null check (set_number > 0),
  target_reps int,
  target_load_kg numeric(7,2),
  target_rpe numeric(3,1),
  target_rir numeric(3,1),
  rest_seconds int,
  check (target_reps is null or target_reps >= 0),
  check (target_load_kg is null or target_load_kg >= 0)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  workout_template_id uuid not null references public.workout_templates(id),
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  status public.workout_status not null default 'planned',
  athlete_notes text,
  session_rpe numeric(3,1),
  created_at timestamptz not null default now()
);

create table public.performed_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id),
  prescribed_set_id uuid references public.prescribed_sets(id),
  set_number int not null,
  reps int not null default 0 check (reps >= 0),
  load_kg numeric(7,2) not null default 0 check (load_kg >= 0),
  rpe numeric(3,1),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(workout_session_id, workout_exercise_id, set_number)
);

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null default current_date,
  sleep_minutes int check (sleep_minutes between 0 and 1440),
  sleep_quality int check (sleep_quality between 1 and 10),
  fatigue int check (fatigue between 1 and 10),
  stress int check (stress between 1 and 10),
  soreness int check (soreness between 1 and 10),
  motivation int check (motivation between 1 and 10),
  pain int check (pain between 0 and 10),
  notes text,
  unique(athlete_id, checkin_date)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric(6,2),
  waist_cm numeric(6,2),
  notes text
);

create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Useful indexes
create index idx_relationship_athlete on public.coach_athlete_relationships(athlete_id);
create index idx_assignment_athlete on public.program_assignments(athlete_id);
create index idx_session_athlete_date on public.workout_sessions(athlete_id, scheduled_for desc);
create index idx_checkin_athlete_date on public.daily_checkins(athlete_id, checkin_date desc);
create index idx_performed_session on public.performed_sets(workout_session_id);

-- Helper: is current user an active coach of this athlete?
create or replace function public.is_coach_of(target_athlete uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_athlete_relationships r
    where r.coach_id = auth.uid()
      and r.athlete_id = target_athlete
      and r.status = 'active'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.coach_athlete_relationships enable row level security;
alter table public.program_assignments enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.performed_sets enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.body_measurements enable row level security;
alter table public.coach_notes enable row level security;

create policy "profile_self_read"
on public.profiles for select
using (id = auth.uid());

create policy "coach_can_read_athlete_profile"
on public.profiles for select
using (public.is_coach_of(id));

create policy "relationship_members_read"
on public.coach_athlete_relationships for select
using (coach_id = auth.uid() or athlete_id = auth.uid());

create policy "athlete_reads_sessions"
on public.workout_sessions for select
using (athlete_id = auth.uid());

create policy "athlete_updates_sessions"
on public.workout_sessions for update
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

create policy "coach_reads_sessions"
on public.workout_sessions for select
using (public.is_coach_of(athlete_id));

create policy "athlete_reads_performed_sets"
on public.performed_sets for select
using (
  exists (
    select 1 from public.workout_sessions s
    where s.id = workout_session_id and s.athlete_id = auth.uid()
  )
);

create policy "athlete_writes_performed_sets"
on public.performed_sets for all
using (
  exists (
    select 1 from public.workout_sessions s
    where s.id = workout_session_id and s.athlete_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workout_sessions s
    where s.id = workout_session_id and s.athlete_id = auth.uid()
  )
);

create policy "athlete_owns_checkins"
on public.daily_checkins for all
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

create policy "coach_reads_checkins"
on public.daily_checkins for select
using (public.is_coach_of(athlete_id));

create policy "athlete_owns_measurements"
on public.body_measurements for all
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

create policy "coach_reads_measurements"
on public.body_measurements for select
using (public.is_coach_of(athlete_id));

create policy "coach_owns_notes"
on public.coach_notes for all
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

-- View: simple session tonnage
create or replace view public.session_training_volume as
select
  workout_session_id,
  sum(reps * load_kg) as volume_kg
from public.performed_sets
where completed = true
group by workout_session_id;


-- V0.3 additions -------------------------------------------------------------

-- Automatically create a public profile after Supabase Auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, first_name, last_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'athlete'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Athlete must be able to read the program structure assigned to them.
alter table public.programs enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.prescribed_sets enable row level security;
alter table public.exercises enable row level security;

create policy "athlete_reads_assigned_programs"
on public.programs for select
using (
  exists (
    select 1 from public.program_assignments a
    where a.program_id = programs.id
      and a.athlete_id = auth.uid()
      and a.active = true
  )
);

create policy "athlete_reads_assigned_workout_templates"
on public.workout_templates for select
using (
  exists (
    select 1
    from public.program_assignments a
    where a.program_id = workout_templates.program_id
      and a.athlete_id = auth.uid()
      and a.active = true
  )
);

create policy "athlete_reads_assigned_workout_exercises"
on public.workout_exercises for select
using (
  exists (
    select 1
    from public.workout_templates wt
    join public.program_assignments a on a.program_id = wt.program_id
    where wt.id = workout_exercises.workout_template_id
      and a.athlete_id = auth.uid()
      and a.active = true
  )
);

create policy "athlete_reads_assigned_prescribed_sets"
on public.prescribed_sets for select
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workout_templates wt on wt.id = we.workout_template_id
    join public.program_assignments a on a.program_id = wt.program_id
    where we.id = prescribed_sets.workout_exercise_id
      and a.athlete_id = auth.uid()
      and a.active = true
  )
);

create policy "athlete_reads_exercises_in_assigned_program"
on public.exercises for select
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workout_templates wt on wt.id = we.workout_template_id
    join public.program_assignments a on a.program_id = wt.program_id
    where we.exercise_id = exercises.id
      and a.athlete_id = auth.uid()
      and a.active = true
  )
);

-- Athlete can read own assignments.
create policy "athlete_reads_assignments"
on public.program_assignments for select
using (athlete_id = auth.uid());
