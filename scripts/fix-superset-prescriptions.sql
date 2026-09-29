-- Restore explicit pair structure without replacing exercises, sessions, or performed sets.
-- Run after complete-tactical-prescriptions.sql. Safe to rerun; unexpected note changes abort.
-- Sources: reciprocal enchaîné avec notes, Tactical Pull-up + Dips source, S2J1 screenshot.
begin;
create temporary table superset_note_fixes (id uuid primary key, old_note text, new_note text) on commit drop;
insert into superset_note_fixes values
('c39b79ff-8a2f-480a-9425-1e8df63d0af7', 'RENFO — 4x12 — enchaîné avec single leg ischio flexion — repos 2 min', 'RENFO — 4x12 — SUPERSET A1 — enchaîné avec single leg ischio flexion — sans repos entre les exercices'),
('e6d67bde-a998-432a-8536-25aa3488a45c', 'RENFO — 12 reps — enchaîné avec single leg extension — repos 2 min', 'RENFO — 4x12 — SUPERSET A2 — repos 2 min après le superset'),
('6e213b8e-2743-44bf-b9fe-7767ae65115c', 'RENFO — 4x12 — enchaîné avec 12 single leg ischio flexion — repos 2 min', 'RENFO — 4x12 — SUPERSET A1 — enchaîné avec single leg ischio flexion — sans repos entre les exercices'),
('57ee6c66-0c87-4bd2-8172-7d96d4587130', 'RENFO — 12 reps — enchaîné avec 4x12 single leg extension — repos 2 min', 'RENFO — 4x12 — SUPERSET A2 — repos 2 min après le superset'),
('a2c5e95b-dd6c-40d8-bdda-8975eda0df1e', 'RENFO — 4x12 — enchaîné avec 12 single leg ischio flexion — repos 2 min', 'RENFO — 4x12 — SUPERSET A1 — enchaîné avec single leg ischio flexion — sans repos entre les exercices'),
('dbca49b3-eb48-4eeb-a913-496e693a1a9a', 'RENFO — 12 reps — enchaîné avec 4x12 single leg extension — repos 2 min', 'RENFO — 4x12 — SUPERSET A2 — repos 2 min après le superset'),
('13a7e1fa-1f14-4ea2-8603-7c96561b769d', 'RENFO — 4x12 — enchaîné avec 12 single leg ischio flexion — repos 2 min', 'RENFO — 4x12 — SUPERSET A1 — enchaîné avec single leg ischio flexion — sans repos entre les exercices'),
('d37fb4ea-6108-4bd9-b1c2-43b706d1a71e', 'RENFO — 12 reps — enchaîné avec 4x12 single leg extension — repos 2 min', 'RENFO — 4x12 — SUPERSET A2 — repos 2 min après le superset'),
('88282621-6ad2-448e-8194-8fa3854a7ea6', 'RENFO — 4x5 Pull-up', 'RENFO — 4x5 Pull-up — SUPERSET A1'),
('2e5ee06e-719b-4d08-91ff-e7390c99610b', 'RENFO — 4x5 Dips', 'RENFO — 4x5 Dips — SUPERSET A2'),
('b77f7892-be08-48fe-a010-fe65fa347f28', 'WORKOUT — 4x8', 'WORKOUT — 4x8 — SUPERSET D1'),
('88635c07-69c9-443b-a9a9-831faebedb23', 'WORKOUT — 4 allers-retours — lourd', 'WORKOUT — 4x1 aller-retour — lourd — SUPERSET D2'),
('19a007c0-4825-4e34-849f-e2ee0484fc6b', 'RENFO — 4x5', 'RENFO — 4x5 — SUPERSET A1'),
('c0016143-18f8-4f33-993e-9d17cc1496a2', 'RENFO — 4x5', 'RENFO — 4x5 — SUPERSET A2'),
('61a18566-df6c-4f95-bc0e-6d0ec14a6936', 'WORKOUT — 4x8', 'WORKOUT — 4x8 — SUPERSET D1'),
('43a6f7b0-b4d9-4050-bf33-3312ea8fbbc4', 'WORKOUT — 4 allers-retours — lourd', 'WORKOUT — 4x1 aller-retour — lourd — SUPERSET D2'),
('d4e50f9e-48ed-4781-b6d1-a225e1dfa0a1', 'RENFO — 4x5', 'RENFO — 4x5 — SUPERSET A1'),
('e8d15c17-fc8f-4d84-86f6-5fed9c49d5f6', 'RENFO — 4x5', 'RENFO — 4x5 — SUPERSET A2'),
('bc23fa63-00a6-46eb-b692-78c74acbaa5e', 'RENFO — 4x10', 'RENFO — 4x10 — SUPERSET A1'),
('f3f15a7f-f889-415c-b723-f010297ab93e', 'RENFO — 4x10', 'RENFO — 4x10 — SUPERSET A2'),
('c3305236-88b6-4c31-9f4c-10a87725b51e', 'RENFO — 4x12', 'RENFO — 4x12 — SUPERSET A1'),
('859db4c3-8457-4091-b9c4-6938b8a826f4', 'RENFO — 4x12', 'RENFO — 4x12 — SUPERSET A2');
do $$ begin
 if exists(select 1 from superset_note_fixes f left join workout_exercises e on e.id=f.id where e.id is null or e.prescription_notes not in (f.old_note,f.new_note)) then
 raise exception 'Superset source differs from reviewed snapshot; no changes applied'; end if;
end $$;
update workout_exercises e set prescription_notes=f.new_note from superset_note_fixes f where e.id=f.id and e.prescription_notes=f.old_note;
-- The initial Tactical curl had only one prescribed set; preserve it and add the three missing sets.
insert into prescribed_sets (workout_exercise_id,set_number,target_reps,rest_seconds)
select 'e6d67bde-a998-432a-8536-25aa3488a45c'::uuid,n,12,120 from generate_series(2,4) n
where not exists(select 1 from prescribed_sets p where p.workout_exercise_id='e6d67bde-a998-432a-8536-25aa3488a45c' and p.set_number=n);
-- No rest between the two movements; keep the 120-second rest on the last movement.
update prescribed_sets set rest_seconds=0 where workout_exercise_id='c39b79ff-8a2f-480a-9425-1e8df63d0af7' and rest_seconds=120;
commit;

