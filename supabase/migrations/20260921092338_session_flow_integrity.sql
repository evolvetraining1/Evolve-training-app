-- Transactional finish and stable session identity. Existing history is retained.
alter table public.workout_sessions add column wod_results jsonb not null default '{}'::jsonb
  check (jsonb_typeof(wod_results)='object');
comment on column public.workout_sessions.wod_results is 'Conditioning block scores keyed by stable block ID; separate from strength sets.';
create or replace function public.guard_workout_session_update()
returns trigger language plpgsql security invoker set search_path = public as $$
declare score jsonb; exercise_id jsonb; metric text;
begin
  if new.athlete_id is distinct from old.athlete_id or new.workout_template_id is distinct from old.workout_template_id then
    raise exception 'Une séance ne peut pas changer de sportif ou de modèle.';
  end if;
  if old.status in ('completed','skipped') and new is distinct from old then
    raise exception 'Cette séance est terminée et reste consultable dans l’historique.';
  end if;
  if old.status='in_progress' and new.status='planned' then raise exception 'Une séance commencée ne peut pas redevenir planifiée.'; end if;
  if new.wod_results is distinct from old.wod_results then
    for score in select value from jsonb_each(new.wod_results) loop
      if jsonb_typeof(score)<>'object' or coalesce(score->>'format','') not in ('amrap','for_time','emom','tabata','rounds','intervals','circuit')
        or jsonb_typeof(score->'exercise_ids') is distinct from 'array'
        or jsonb_typeof(score->'completed') is distinct from 'boolean'
        or jsonb_typeof(score->'capped') is distinct from 'boolean' then raise exception 'Résultat de WOD invalide.'; end if;
      if jsonb_array_length(score->'exercise_ids')=0 then raise exception 'Le WOD ne contient aucun mouvement.'; end if;
      for exercise_id in select value from jsonb_array_elements(score->'exercise_ids') loop
        if not exists(select 1 from public.workout_exercises where id=(exercise_id #>> '{}')::uuid and workout_template_id=new.workout_template_id) then
          raise exception 'Un mouvement du WOD ne fait pas partie de cette séance.';
        end if;
      end loop;
      foreach metric in array array['rounds','reps','elapsed_seconds','intervals'] loop
        if score->metric is not null and score->metric <> 'null'::jsonb then
          if jsonb_typeof(score->metric)<>'number' or (score->>metric)::numeric<0 or (score->>metric)::numeric<>trunc((score->>metric)::numeric) then
            raise exception 'Score de WOD invalide.';
          end if;
        end if;
      end loop;
      if coalesce(score->>'completed','false')='true' then
        if score->>'format' in ('amrap','rounds') and coalesce(score->>'rounds','')='' then raise exception 'Nombre de tours requis.'; end if;
        if score->>'format'='emom' and coalesce(score->>'intervals','')='' then raise exception 'Nombre d’intervalles requis.'; end if;
        if score->>'format'='for_time' and score->>'capped'='false' and coalesce((score->>'elapsed_seconds')::numeric,0)<=0 then raise exception 'Temps requis.'; end if;
        if score->>'format' in ('tabata','intervals') and length(trim(coalesce(score->>'interval_results','')))=0 then raise exception 'Résultats des intervalles requis.'; end if;
      end if;
    end loop;
  end if;
  if old.started_at is not null then new.started_at := old.started_at; end if;
  return new;
end;
$$;
create trigger workout_session_update_guard before update on public.workout_sessions
for each row execute function public.guard_workout_session_update();

create or replace function public.guard_performed_set_write()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_session public.workout_sessions%rowtype;
begin
  -- Same row lock as finalization: a late save cannot rewrite completed history.
  select * into v_session from public.workout_sessions
  where id = case when tg_op = 'DELETE' then old.workout_session_id else new.workout_session_id end for update;
  -- Allow a legitimate parent cascade; direct child deletes still require ownership.
  if not found and tg_op='DELETE' then return old; end if;
  if not found or v_session.athlete_id is distinct from auth.uid() then
    raise exception 'Séance inaccessible.';
  end if;
  if v_session.status not in ('planned','in_progress') then raise exception 'Cette séance est déjà terminée.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and (new.workout_session_id, new.workout_exercise_id, new.set_number)
      is distinct from (old.workout_session_id, old.workout_exercise_id, old.set_number) then
    raise exception 'Une série ne peut pas être déplacée vers une autre séance.';
  end if;
  if not exists (select 1 from public.workout_exercises where id=new.workout_exercise_id and workout_template_id=v_session.workout_template_id) then
    raise exception 'Cet exercice ne fait pas partie de la séance.';
  end if;
  if new.prescribed_set_id is not null and not exists (
    select 1 from public.prescribed_sets where id=new.prescribed_set_id and workout_exercise_id=new.workout_exercise_id and set_number=new.set_number
  ) then raise exception 'La prescription ne correspond pas à cette série.'; end if;
  if new.set_number is null or new.set_number < 1 or new.reps is null or new.reps < 0
    or new.load_kg is null or new.load_kg < 0 or new.load_kg::text in ('NaN','Infinity','-Infinity')
    or (new.rpe is not null and (new.rpe < 1 or new.rpe > 10 or new.rpe::text in ('NaN','Infinity','-Infinity'))) then
    raise exception 'Valeurs de série invalides.';
  end if;
  return new;
end;
$$;
create trigger performed_set_write_guard before insert or update or delete on public.performed_sets
for each row execute function public.guard_performed_set_write();

create or replace function public.open_workout_session(p_template_id uuid)
returns public.workout_sessions language plpgsql security invoker set search_path = public as $$
declare v_session public.workout_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from public.workout_templates where id=p_template_id) then raise exception 'Programme inaccessible.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_template_id::text, 0));
  select * into v_session from public.workout_sessions
    where athlete_id=auth.uid() and workout_template_id=p_template_id
    order by (status in ('completed','skipped')) desc, (status='in_progress') desc, created_at asc limit 1;
  if found then return v_session; end if;
  insert into public.workout_sessions(athlete_id,workout_template_id,status,scheduled_for)
    values(auth.uid(),p_template_id,'planned',current_date) returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.finish_workout_session(p_session_id uuid, p_sets jsonb, p_session_rpe numeric default null, p_wod_results jsonb default '{}'::jsonb)
returns public.workout_sessions language plpgsql security invoker set search_path = public as $$
declare v_session public.workout_sessions%rowtype; v_template_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  select workout_template_id into v_template_id from public.workout_sessions where id=p_session_id and athlete_id=auth.uid();
  if not found then raise exception 'Séance inaccessible.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || v_template_id::text, 0));
  select * into v_session from public.workout_sessions where id=p_session_id and athlete_id=auth.uid() for update;
  -- A retry after a lost response returns the original completion unchanged.
  if v_session.status='completed' then return v_session; end if;
  if v_session.status not in ('planned','in_progress') then raise exception 'Cette séance ne peut plus être validée.'; end if;
  if p_sets is null or jsonb_typeof(p_sets)<>'array' then raise exception 'Liste des séries invalide.'; end if;
  if p_session_rpe is not null and (p_session_rpe<1 or p_session_rpe>10 or p_session_rpe::text in ('NaN','Infinity','-Infinity')) then raise exception 'RPE invalide.'; end if;
  if p_wod_results is null or jsonb_typeof(p_wod_results)<>'object' then raise exception 'Résultats de WOD invalides.'; end if;
  if jsonb_array_length(p_sets)=0 and p_wod_results='{}'::jsonb and exists(select 1 from public.workout_exercises where workout_template_id=v_template_id) then
    raise exception 'Les séries de la séance ne sont pas chargées. Recharge la séance.';
  end if;
  if not exists(select 1 from public.workout_exercises where workout_template_id=v_template_id)
    and not exists(select 1 from public.workout_templates where id=v_template_id and (name || ' ' || coalesce(notes,'')) ~* '(repos|récupération|recovery|rest)') then
    raise exception 'Cette séance ne contient aucun exercice.';
  end if;
  insert into public.performed_sets(workout_session_id,workout_exercise_id,prescribed_set_id,set_number,reps,load_kg,rpe,completed)
    select p_session_id, x.workout_exercise_id,x.prescribed_set_id,x.set_number,x.reps,x.load_kg,x.rpe,coalesce(x.completed,false)
    from jsonb_to_recordset(p_sets) as x(workout_exercise_id uuid,prescribed_set_id uuid,set_number integer,reps integer,load_kg numeric,rpe numeric,completed boolean)
    on conflict(workout_session_id,workout_exercise_id,set_number) do update
      set prescribed_set_id=excluded.prescribed_set_id,reps=excluded.reps,load_kg=excluded.load_kg,rpe=excluded.rpe,completed=excluded.completed;
  update public.workout_sessions set status='completed', completed_at=now(),started_at=coalesce(started_at,now()),session_rpe=p_session_rpe, wod_results=p_wod_results
    where id=p_session_id returning * into v_session;
  return v_session;
end;
$$;
revoke all on function public.guard_workout_session_update() from public,anon,authenticated;
revoke all on function public.guard_performed_set_write() from public,anon,authenticated;
revoke all on function public.open_workout_session(uuid) from public,anon;
revoke all on function public.finish_workout_session(uuid,jsonb,numeric,jsonb) from public,anon;
grant execute on function public.open_workout_session(uuid) to authenticated;
grant execute on function public.finish_workout_session(uuid,jsonb,numeric,jsonb) to authenticated;
