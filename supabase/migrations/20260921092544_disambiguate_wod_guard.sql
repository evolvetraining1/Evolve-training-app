-- Qualify the JSON loop variable separately from workout_exercises.exercise_id.
create or replace function public.guard_workout_session_update()
returns trigger language plpgsql security invoker set search_path = public as $$
declare score jsonb; v_exercise_id jsonb; metric text;
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
      for v_exercise_id in select value from jsonb_array_elements(score->'exercise_ids') loop
        if not exists(select 1 from public.workout_exercises where id=(v_exercise_id #>> '{}')::uuid and workout_template_id=new.workout_template_id) then
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
