-- Integration test against an assigned planned session. Every change is rolled back.
-- Run as the database test administrator; assertions execute under authenticated RLS.
begin;
do $$
declare candidate public.workout_sessions%rowtype;
begin
  select ws.* into candidate from public.workout_sessions ws
  where ws.status='planned'
    and exists(select 1 from public.workout_exercises we where we.workout_template_id=ws.workout_template_id)
    and exists(select 1 from public.program_assignments pa join public.workout_templates wt on wt.program_id=pa.program_id
      where wt.id=ws.workout_template_id and pa.athlete_id=ws.athlete_id and pa.active=true)
  limit 1;
  if not found then raise exception 'No suitable test fixture; no changes made.'; end if;
  perform set_config('request.jwt.claim.sub',candidate.athlete_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.athlete_id,'role','authenticated')::text,true);
  perform set_config('session_audit.fixture',candidate.id::text,true);
end $$;
set local role authenticated;
do $$
declare sid uuid:=current_setting('session_audit.fixture')::uuid;
  s public.workout_sessions%rowtype; finished public.workout_sessions%rowtype; retried public.workout_sessions%rowtype;
  eid uuid; payload jsonb; score jsonb; before_sets jsonb; after_sets jsonb; rejected boolean; original_started timestamptz;
begin
  select * into s from public.workout_sessions where id=sid;
  if not found then raise exception 'RLS fixture inaccessible'; end if;
  select id into eid from public.workout_exercises where workout_template_id=s.workout_template_id order by position limit 1;
  payload:=jsonb_build_array(jsonb_build_object('workout_exercise_id',eid,'set_number',1,'reps',0,'load_kg',0,'completed',true));
  update public.workout_sessions set status='in_progress',started_at=now()-interval '10 minutes' where id=sid returning started_at into original_started;
  update public.workout_sessions set started_at=now() where id=sid;
  if (select started_at from public.workout_sessions where id=sid)<>original_started then raise exception 'Start timestamp reset'; end if;
  rejected:=false;
  begin update public.workout_sessions set status='planned' where id=sid;
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Backward transition accepted'; end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into before_sets from public.performed_sets p where workout_session_id=sid;
  rejected:=false;
  begin
    perform public.finish_workout_session(sid,payload || jsonb_build_array(jsonb_build_object('workout_exercise_id',gen_random_uuid(),'set_number',1,'reps',1,'load_kg',0,'completed',true)));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Foreign exercise accepted'; end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into after_sets from public.performed_sets p where workout_session_id=sid;
  if before_sets<>after_sets or (select status from public.workout_sessions where id=sid)<>'in_progress' then raise exception 'Partial completion persisted'; end if;
  score:=jsonb_build_object('block-'||eid,jsonb_build_object('format','amrap','exercise_ids',jsonb_build_array(eid),'rounds',4,'reps',7,'elapsed_seconds',null,'intervals',null,'interval_results','','notes','test rollback','completed',true,'capped',false));
  rejected:=false;
  begin perform public.finish_workout_session(sid,payload,null,jsonb_set(score,array['block-'||eid,'rounds'],'-1'::jsonb));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Negative WOD accepted'; end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into after_sets from public.performed_sets p where workout_session_id=sid;
  if before_sets<>after_sets then raise exception 'Invalid WOD left partial strength rows'; end if;
  -- A conditioning-only workout can finish without fake strength rows.
  finished:=public.finish_workout_session(sid,'[]'::jsonb,null,score);
  if finished.status<>'completed' or finished.wod_results<>score then raise exception 'WOD result did not round-trip'; end if;
  retried:=public.finish_workout_session(sid,payload,null,'{}'::jsonb);
  if retried.completed_at<>finished.completed_at or retried.wod_results<>score then raise exception 'Retry rewrote history'; end if;
  retried:=public.open_workout_session(s.workout_template_id);
  if retried.status not in ('completed','skipped') then raise exception 'Open reopened terminal template'; end if;
  rejected:=false;
  begin insert into public.performed_sets(workout_session_id,workout_exercise_id,set_number,reps,load_kg,completed) values(sid,eid,999,1,0,true);
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Late save rewrote history'; end if;
  rejected:=false;
  begin update public.workout_sessions set status='in_progress' where id=sid;
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Completed session reopened'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
  rejected:=false;
  begin perform public.finish_workout_session(sid,payload); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Another athlete accessed completion'; end if;
end $$;
rollback;
select 'PASS: RLS, atomic rollback, WOD-only finish, score validation, timestamp preservation, retry, terminal reopen and late-write protection; all fixture changes rolled back.' as result;
