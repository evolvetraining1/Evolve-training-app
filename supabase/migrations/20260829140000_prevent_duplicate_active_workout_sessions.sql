-- EVOLVE TRAINING
-- Nettoie les doublons de sessions actives et empêche leur réapparition.
--
-- Une seule session "planned" ou "in_progress" est autorisée
-- par couple (athlete_id, workout_template_id).

-- Sécurité :
-- si plusieurs sessions actives d'un même groupe contiennent déjà
-- des performed_sets, on bloque la migration au lieu de supprimer
-- potentiellement des données utiles.
do $$
begin
  if exists (
    select 1
    from (
      select
        ws.athlete_id,
        ws.workout_template_id,
        count(*) filter (
          where exists (
            select 1
            from public.performed_sets ps
            where ps.workout_session_id = ws.id
          )
        ) as sessions_with_data
      from public.workout_sessions ws
      where ws.status in ('planned', 'in_progress')
      group by ws.athlete_id, ws.workout_template_id
      having count(*) > 1
    ) duplicates
    where duplicates.sessions_with_data > 1
  ) then
    raise exception
      'Duplicate active workout sessions with performed data detected. Manual review required.';
  end if;
end
$$;

-- Classe les sessions actives.
-- Priorité :
-- 1. session contenant des performed_sets
-- 2. session déjà in_progress
-- 3. session ayant été démarrée
-- 4. session créée la plus tôt
with session_stats as (
  select
    ws.id,
    ws.athlete_id,
    ws.workout_template_id,
    ws.status,
    ws.started_at,
    ws.created_at,
    (
      select count(*)
      from public.performed_sets ps
      where ps.workout_session_id = ws.id
    ) as performed_set_count
  from public.workout_sessions ws
  where ws.status in ('planned', 'in_progress')
),
ranked as (
  select
    id,
    row_number() over (
      partition by athlete_id, workout_template_id
      order by
        case when performed_set_count > 0 then 0 else 1 end,
        case when status = 'in_progress' then 0 else 1 end,
        case when started_at is not null then 0 else 1 end,
        created_at asc,
        id asc
    ) as keep_rank
  from session_stats
),
duplicates_to_delete as (
  select id
  from ranked
  where keep_rank > 1
)
delete from public.workout_sessions ws
using duplicates_to_delete d
where ws.id = d.id;

-- Protection définitive contre les doublons actifs.
create unique index if not exists
  workout_sessions_one_active_per_template
on public.workout_sessions (
  athlete_id,
  workout_template_id
)
where status in ('planned', 'in_progress');
