-- Enrich the existing exercises table so one canonical exercise record can power
-- workout links, the movement library, and future coach programming tools.

alter table public.exercises
  add column if not exists objective text,
  add column if not exists key_points text[] not null default '{}',
  add column if not exists common_errors text[] not null default '{}',
  add column if not exists regressions text[] not null default '{}',
  add column if not exists progressions text[] not null default '{}',
  add column if not exists equipment text[] not null default '{}',
  add column if not exists muscles text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists difficulty text,
  add column if not exists is_library_visible boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists exercises_library_name_idx
  on public.exercises (lower(name))
  where is_library_visible = true;

create index if not exists exercises_library_category_idx
  on public.exercises (category)
  where is_library_visible = true;

comment on column public.exercises.objective is 'Short athlete-facing purpose of the movement.';
comment on column public.exercises.instructions is 'Athlete-facing execution instructions.';
comment on column public.exercises.key_points is 'Short technical cues displayed on the movement sheet.';
comment on column public.exercises.common_errors is 'Common technical errors to avoid.';
comment on column public.exercises.regressions is 'Simpler movement options.';
comment on column public.exercises.progressions is 'Harder movement options.';
comment on column public.exercises.image_url is 'Optional movement image; video_url remains optional and takes precedence when available.';
