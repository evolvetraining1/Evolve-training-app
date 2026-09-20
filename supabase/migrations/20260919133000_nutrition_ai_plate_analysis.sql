create table if not exists public.nutrition_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null default 'lunch' check (
    meal_type = any (array['breakfast', 'lunch', 'dinner', 'snack'])
  ),
  status text not null default 'estimated' check (
    status = any (array['estimated', 'saved', 'discarded'])
  ),
  confidence text not null check (
    confidence = any (array['low', 'medium', 'high'])
  ),
  meal_summary text not null default '',
  foods jsonb not null default '[]'::jsonb check (jsonb_typeof(foods) = 'array'),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  model_name text,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_ai_analyses enable row level security;

drop policy if exists nutrition_ai_analyses_select_own on public.nutrition_ai_analyses;
create policy nutrition_ai_analyses_select_own
on public.nutrition_ai_analyses
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists nutrition_ai_analyses_insert_own on public.nutrition_ai_analyses;
create policy nutrition_ai_analyses_insert_own
on public.nutrition_ai_analyses
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_ai_analyses_update_own on public.nutrition_ai_analyses;
create policy nutrition_ai_analyses_update_own
on public.nutrition_ai_analyses
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_ai_analyses_delete_own on public.nutrition_ai_analyses;
create policy nutrition_ai_analyses_delete_own
on public.nutrition_ai_analyses
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists nutrition_ai_analyses_user_created_idx
  on public.nutrition_ai_analyses (user_id, created_at desc);

alter table public.nutrition_entries
  add column if not exists ai_analysis_id uuid
  references public.nutrition_ai_analyses(id) on delete set null;

create index if not exists nutrition_entries_ai_analysis_id_idx
  on public.nutrition_entries (ai_analysis_id)
  where ai_analysis_id is not null;

alter table public.nutrition_entries
  drop constraint if exists nutrition_entries_source_check;

alter table public.nutrition_entries
  add constraint nutrition_entries_source_check check (
    source = any (
      array[
        'manual'::text,
        'open_food_facts'::text,
        'usda'::text,
        'ciqual_2025'::text,
        'evolve_community'::text,
        'ai_plate'::text
      ]
    )
  );

grant select, insert, update, delete
  on table public.nutrition_ai_analyses
  to authenticated;

