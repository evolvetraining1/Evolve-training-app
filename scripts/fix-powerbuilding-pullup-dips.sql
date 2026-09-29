-- Power Building Pull-up + Dips confirmed by the program owner on 2026-09-29.
-- Preserve all exercise/set/session identities and do not invent unspecified rest.
begin;
do $$
begin
 if exists (select 1 from (values ('7956447e-16a1-4424-85f7-a3baa0431ae2'::uuid,'RENFO — 4x5 Pull-up','RENFO — 4x5 Pull-up — SUPERSET A1'),('b84a3277-184b-4f41-a218-2b8491f63041'::uuid,'RENFO — 4x5 Dips','RENFO — 4x5 Dips — SUPERSET A2'),('2ccdcca7-5131-47b9-b9bd-d1f6463d94a1'::uuid,'RENFO — 4x5 Pull-up','RENFO — 4x5 Pull-up — SUPERSET A1'),('58d0b3e6-43b6-4b9e-bd02-c3027b2de8a9'::uuid,'RENFO — 4x5 Dips','RENFO — 4x5 Dips — SUPERSET A2'),('d4b731d0-74bf-4fb0-9b32-589ba3b1ff41'::uuid,'RENFO — 4x5 Pull-up','RENFO — 4x5 Pull-up — SUPERSET A1'),('6a5af869-ecba-434c-bb84-8f4df3380795'::uuid,'RENFO — 4x5 Dips','RENFO — 4x5 Dips — SUPERSET A2')) f(id,old_note,new_note) left join workout_exercises e on e.id=f.id where e.id is null or e.prescription_notes not in(f.old_note,f.new_note)) then raise exception 'Power Building pairing source changed'; end if;
end $$;
update workout_exercises e set prescription_notes=f.new_note from (values ('7956447e-16a1-4424-85f7-a3baa0431ae2'::uuid,'RENFO — 4x5 Pull-up','RENFO — 4x5 Pull-up — SUPERSET A1'),('b84a3277-184b-4f41-a218-2b8491f63041'::uuid,'RENFO — 4x5 Dips','RENFO — 4x5 Dips — SUPERSET A2'),('2ccdcca7-5131-47b9-b9bd-d1f6463d94a1'::uuid,'RENFO — 4x5 Pull-up','RENFO — 4x5 Pull-up — SUPERSET A1'),('58d0b3e6-43b6-4b9e-bd02-c3027b2de8a9'::uuid,'RENFO — 4x5 Dips','RENFO — 4x5 Dips — SUPERSET A2'),('d4b731d0-74bf-4fb0-9b32-589ba3b1ff41'::uuid,'RENFO — 4x5 Pull-up','RENFO — 4x5 Pull-up — SUPERSET A1'),('6a5af869-ecba-434c-bb84-8f4df3380795'::uuid,'RENFO — 4x5 Dips','RENFO — 4x5 Dips — SUPERSET A2')) f(id,old_note,new_note) where e.id=f.id and e.prescription_notes=f.old_note;
commit;

