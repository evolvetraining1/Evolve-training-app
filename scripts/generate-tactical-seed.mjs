import fs from "node:fs";

const sourcePath = new URL(
  "../supabase/seed-data/tactical-reconditioning.json",
  import.meta.url,
);
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const payload = JSON.stringify(source.workouts);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

if (payload.includes("$tactical$")) {
  throw new Error("The Tactical payload contains the SQL dollar-quote delimiter.");
}

const sql = `
begin;

create temporary table tactical_source_workouts (
  week_number integer not null,
  day_number integer not null,
  name text not null,
  notes text,
  estimated_minutes integer,
  preserve_existing boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  primary key (week_number, day_number)
) on commit drop;

insert into tactical_source_workouts (
  week_number,
  day_number,
  name,
  notes,
  estimated_minutes,
  preserve_existing,
  items
)
select
  source.week,
  source.day,
  source.name,
  source.notes,
  source."estimatedMinutes",
  coalesce(source."preserveExisting", false),
  coalesce(source.items, '[]'::jsonb)
from jsonb_to_recordset($tactical$${payload}$tactical$::jsonb) as source(
  week integer,
  day integer,
  name text,
  notes text,
  "estimatedMinutes" integer,
  "preserveExisting" boolean,
  items jsonb
);

update public.programs
set
  description = ${sqlLiteral(source.description)},
  duration_weeks = ${Number(source.durationWeeks)}
where upper(name) = upper(${sqlLiteral(source.programName)});

do $$
declare
  tactical_program_id uuid;
  tactical_coach_id uuid;
begin
  select id, coach_id
  into tactical_program_id, tactical_coach_id
  from public.programs
  where upper(name) = upper(${sqlLiteral(source.programName)})
  order by created_at
  limit 1;

  if tactical_program_id is null then
    raise exception 'TACTICAL RECONDITIONING program not found';
  end if;

  update public.workout_templates target
  set
    name = source.name,
    notes = source.notes,
    estimated_minutes = source.estimated_minutes
  from tactical_source_workouts source
  where target.program_id = tactical_program_id
    and target.week_number = source.week_number
    and target.day_number = source.day_number;

  insert into public.workout_templates (
    program_id,
    week_number,
    day_number,
    name,
    notes,
    estimated_minutes
  )
  select
    tactical_program_id,
    source.week_number,
    source.day_number,
    source.name,
    source.notes,
    source.estimated_minutes
  from tactical_source_workouts source
  where not exists (
    select 1
    from public.workout_templates existing
    where existing.program_id = tactical_program_id
      and existing.week_number = source.week_number
      and existing.day_number = source.day_number
  );

  delete from public.workout_exercises existing_item
  using public.workout_templates template, tactical_source_workouts source
  where existing_item.workout_template_id = template.id
    and template.program_id = tactical_program_id
    and template.week_number = source.week_number
    and template.day_number = source.day_number
    and not source.preserve_existing
    and not exists (
      select 1
      from public.performed_sets performed
      where performed.workout_exercise_id = existing_item.id
    );

  insert into public.exercises (
    owner_coach_id,
    name,
    category,
    instructions,
    is_library_visible
  )
  select distinct
    tactical_coach_id,
    item.value->>1,
    case item.value->>0
      when 'WARM UP' then 'Warm-up'
      when 'STRENGTH WORK' then 'Strength'
      when 'RENFO' then 'Renfo'
      when 'WORKOUT' then 'Workout'
      when 'WOD' then 'WOD'
      else 'Autre'
    end,
    null,
    true
  from tactical_source_workouts source
  cross join lateral jsonb_array_elements(source.items) item(value)
  where not exists (
    select 1
    from public.exercises existing_exercise
    where lower(existing_exercise.name) = lower(item.value->>1)
      and (
        existing_exercise.owner_coach_id = tactical_coach_id
        or existing_exercise.owner_coach_id is null
      )
  );

  insert into public.workout_exercises (
    workout_template_id,
    exercise_id,
    position,
    prescription_notes
  )
  select
    template.id,
    exercise.id,
    item.ordinality::integer,
    concat(item.value->>0, ' — ', item.value->>2)
  from tactical_source_workouts source
  join public.workout_templates template
    on template.program_id = tactical_program_id
   and template.week_number = source.week_number
   and template.day_number = source.day_number
  cross join lateral jsonb_array_elements(source.items) with ordinality item(value, ordinality)
  join lateral (
    select candidate.id
    from public.exercises candidate
    where lower(candidate.name) = lower(item.value->>1)
      and (
        candidate.owner_coach_id = tactical_coach_id
        or candidate.owner_coach_id is null
      )
    order by
      case when candidate.owner_coach_id = tactical_coach_id then 0 else 1 end,
      candidate.created_at,
      candidate.id
    limit 1
  ) exercise on true
  where not source.preserve_existing
  on conflict (workout_template_id, position)
  do update set
    exercise_id = excluded.exercise_id,
    prescription_notes = excluded.prescription_notes;

  insert into public.workout_sessions (
    athlete_id,
    workout_template_id,
    scheduled_for,
    status
  )
  select
    assignment.athlete_id,
    template.id,
    assignment.starts_on
      + ((template.week_number - 1) * 7)
      + (template.day_number - 1),
    'planned'
  from public.program_assignments assignment
  join public.workout_templates template
    on template.program_id = assignment.program_id
  where assignment.program_id = tactical_program_id
    and assignment.active = true
    and not exists (
      select 1
      from public.workout_sessions existing_session
      where existing_session.athlete_id = assignment.athlete_id
        and existing_session.workout_template_id = template.id
    );
end;
$$;

commit;

select
  p.id,
  p.name,
  p.duration_weeks,
  count(distinct wt.id) as workout_count,
  count(distinct we.id) as exercise_count,
  count(distinct ws.id) as session_count
from public.programs p
left join public.workout_templates wt on wt.program_id = p.id
left join public.workout_exercises we on we.workout_template_id = wt.id
left join public.workout_sessions ws on ws.workout_template_id = wt.id
where upper(p.name) = upper(${sqlLiteral(source.programName)})
group by p.id, p.name, p.duration_weeks;
`;

process.stdout.write(sql.trimStart());
