create or replace function public.assign_program_and_schedule(
  p_program_id uuid,
  p_athlete_id uuid,
  p_starts_on date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assignment public.program_assignments%rowtype;
  v_template record;
  v_session public.workout_sessions%rowtype;
  v_sessions jsonb := '[]'::jsonb;
  v_scheduled_for date;
begin
  -- Empêche un doublon actif du même programme pour le même athlète.
  select *
  into v_assignment
  from public.program_assignments
  where program_id = p_program_id
    and athlete_id = p_athlete_id
    and active = true
  limit 1;

  if found then
    raise exception 'Ce programme est déjà attribué à cet athlète.';
  end if;

  -- Vérifie que le programme contient au moins une séance.
  if not exists (
    select 1
    from public.workout_templates
    where program_id = p_program_id
  ) then
    raise exception 'Ce programme ne contient aucune séance.';
  end if;

  -- Crée l'attribution.
  insert into public.program_assignments (
    program_id,
    athlete_id,
    starts_on,
    active
  )
  values (
    p_program_id,
    p_athlete_id,
    p_starts_on,
    true
  )
  returning * into v_assignment;

  -- Génère toutes les séances du programme.
  for v_template in
    select id, week_number, day_number, name
    from public.workout_templates
    where program_id = p_program_id
    order by week_number asc, day_number asc
  loop
    v_scheduled_for :=
      p_starts_on
      + ((v_template.week_number - 1) * 7)
      + (v_template.day_number - 1);

    insert into public.workout_sessions (
      athlete_id,
      workout_template_id,
      scheduled_for,
      status
    )
    values (
      p_athlete_id,
      v_template.id,
      v_scheduled_for,
      'planned'
    )
    returning * into v_session;

    v_sessions :=
      v_sessions ||
      jsonb_build_array(
        jsonb_build_object(
          'id', v_session.id,
          'workout_template_id', v_session.workout_template_id,
          'scheduled_for', v_session.scheduled_for,
          'status', v_session.status
        )
      );
  end loop;

  return jsonb_build_object(
    'assignment',
    jsonb_build_object(
      'id', v_assignment.id,
      'program_id', v_assignment.program_id,
      'athlete_id', v_assignment.athlete_id,
      'starts_on', v_assignment.starts_on,
      'ends_on', v_assignment.ends_on,
      'active', v_assignment.active
    ),
    'sessions',
    v_sessions
  );
end;
$$;

create unique index if not exists
  program_assignments_one_active_per_program
on public.program_assignments (
  athlete_id,
  program_id
)
where active = true;
