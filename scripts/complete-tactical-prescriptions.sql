-- Complete the existing Tactical templates without replacing exercises or history.
-- Repetition ranges, timed holds, max efforts and complex sequences stay in notes:
-- their repetitions remain blank for the athlete to enter.
-- Percentage prescriptions are never stored as kilograms.
begin;

create temporary table tactical_set_specs (
  week integer, day integer, position integer, expected_notes text,
  set_count integer, reps integer, kg numeric, rpe numeric, rest integer
) on commit drop;
insert into tactical_set_specs values
(1, 2, 8, 'RENFO — 4x5 Dips', 4, 5, null, null, null),
(1, 3, 6, 'STRENGTH WORK — 5x5 @60% — tempo 5151 — repos 3 min', 5, 5, null, null, 180),
(1, 3, 7, 'RENFO — 4x12 + 5 sec iso + 12 reps — repos 2 min', 4, null, null, null, 120),
(1, 3, 8, 'RENFO — 3x max time — repos 2 min 30', 3, null, null, null, 150),
(2, 1, 5, 'WORKOUT — 4x12 — RPE 7', 4, 12, null, 7, null),
(2, 1, 6, 'WORKOUT — 4x12 — RPE 7 — repos 1 min 30 après le superset', 4, 12, null, 7, 90),
(2, 1, 7, 'WORKOUT — 4x12 — RPE 8', 4, 12, null, 8, null),
(2, 1, 8, 'WORKOUT — 4x12 — pause en haut — RPE 8 — repos 2 min après le superset', 4, 12, null, 8, 120),
(2, 1, 9, 'WORKOUT — 3x8 — RPE 7 — finir en push press si nécessaire', 3, 8, null, 7, null),
(2, 1, 10, 'WORKOUT — 3x max — repos 1 min 30 après le superset', 3, null, null, null, 90),
(2, 1, 11, 'WORKOUT — 4x8', 4, 8, null, null, null),
(2, 1, 12, 'WORKOUT — 4 allers-retours — lourd', 4, null, null, null, null),
(2, 2, 1, 'WORKOUT — AMRAP 40 min — 5 reps — lourd', 1, 5, null, null, null),
(2, 2, 2, 'WORKOUT — AMRAP 40 min — 5 reps', 1, 5, null, null, null),
(2, 2, 3, 'WORKOUT — AMRAP 40 min — 10 reps', 1, 10, null, null, null),
(2, 2, 4, 'WORKOUT — AMRAP 40 min — 10 reps', 1, 10, null, null, null),
(2, 2, 5, 'WORKOUT — AMRAP 40 min — 15 reps', 1, 15, null, null, null),
(2, 2, 6, 'WORKOUT — AMRAP 40 min — 15 reps', 1, 15, null, null, null),
(2, 3, 5, 'WORKOUT — 4x8 — RPE 7', 4, 8, null, 7, null),
(2, 3, 6, 'WORKOUT — 4x12 — RPE 8 — repos 1 min 30 après le superset', 4, 12, null, 8, 90),
(2, 3, 7, 'WORKOUT — 4x12', 4, 12, null, null, null),
(2, 3, 8, 'WORKOUT — 4x12 — repos 1 min 30 après le superset', 4, 12, null, null, 90),
(2, 3, 9, 'WORKOUT — 4x12', 4, 12, null, null, null),
(2, 3, 10, 'WORKOUT — 4x12 — repos 1 min 30 après le superset', 4, 12, null, null, 90),
(2, 3, 11, 'WORKOUT — 3x20', 3, 20, null, null, null),
(2, 3, 12, 'WORKOUT — 3x12', 3, 12, null, null, null),
(2, 3, 13, 'WORKOUT — 3x4', 3, 4, null, null, null),
(3, 1, 4, 'STRENGTH WORK — 5x5 @70% +2 à 3 kg — tempo 33X1 — repos 3 min', 5, 5, null, null, 180),
(3, 1, 5, 'STRENGTH WORK — 3x2 @90% +2 à 3 kg — explosif — repos 3 min', 3, 2, null, null, 180),
(3, 1, 6, 'RENFO — 4x12', 4, 12, null, null, null),
(3, 1, 7, 'RENFO — 4x12 — repos 2 min après le superset', 4, 12, null, null, 120),
(3, 2, 4, 'STRENGTH WORK — 2x5 @85% — repos 3 min', 2, 5, null, null, 180),
(3, 2, 5, 'STRENGTH WORK — 3x5 @80% — tempo 3131 — repos 3 min', 3, 5, null, null, 180),
(3, 2, 6, 'RENFO — 3x8-12 @12 kg', 3, null, 12, null, null),
(3, 2, 7, 'RENFO — 4x5', 4, 5, null, null, null),
(3, 2, 8, 'RENFO — 4x5', 4, 5, null, null, null),
(3, 2, 9, 'RENFO — 3x15 — tempo 3131 — barre à vide', 3, 15, null, null, null),
(3, 3, 6, 'STRENGTH WORK — 5x5 @60% +2 à 3 kg — tempo 5151 — repos 3 min', 5, 5, null, null, 180),
(3, 3, 7, 'RENFO — 4x12 + 5 sec iso + 12 reps — repos 2 min', 4, null, null, null, 120),
(3, 3, 8, 'RENFO — 3x max time — repos 2 min 30', 3, null, null, null, 150),
(4, 1, 5, 'WORKOUT — 4x12 — RPE 7', 4, 12, null, 7, null),
(4, 1, 6, 'WORKOUT — 4x12 — RPE 7 — repos 1 min 30 après le superset', 4, 12, null, 7, 90),
(4, 1, 7, 'WORKOUT — 4x12 — RPE 8', 4, 12, null, 8, null),
(4, 1, 8, 'WORKOUT — 4x12 — pause en haut — RPE 8 — repos 2 min après le superset', 4, 12, null, 8, 120),
(4, 1, 9, 'WORKOUT — 3x8 — RPE 7 — finir en push press si nécessaire', 3, 8, null, 7, null),
(4, 1, 10, 'WORKOUT — 3x max — repos 1 min 30 après le superset', 3, null, null, null, 90),
(4, 1, 11, 'WORKOUT — 4x8', 4, 8, null, null, null),
(4, 1, 12, 'WORKOUT — 4 allers-retours — lourd', 4, null, null, null, null),
(4, 2, 1, 'WORKOUT — AMRAP 40 min — 10 reps', 1, 10, null, null, null),
(4, 2, 2, 'WORKOUT — AMRAP 40 min — 15 reps', 1, 15, null, null, null),
(4, 2, 3, 'WORKOUT — AMRAP 40 min — 20 reps', 1, 20, null, null, null),
(4, 3, 5, 'WORKOUT — 4x8 — RPE 7', 4, 8, null, 7, null),
(4, 3, 6, 'WORKOUT — 4x12 — RPE 8 — repos 1 min 30 après le superset', 4, 12, null, 8, 90),
(4, 3, 7, 'WORKOUT — 4x12', 4, 12, null, null, null),
(4, 3, 8, 'WORKOUT — 4x12 — repos 1 min 30 après le superset', 4, 12, null, null, 90),
(4, 3, 9, 'WORKOUT — 4x12', 4, 12, null, null, null),
(4, 3, 10, 'WORKOUT — 4x12 — repos 1 min 30 après le superset', 4, 12, null, null, 90),
(4, 3, 11, 'WORKOUT — 3x20 @2.5 kg plate', 3, 20, 2.5, null, null),
(4, 3, 12, 'WORKOUT — 3x12', 3, 12, null, null, null),
(4, 3, 13, 'WORKOUT — 3x4', 3, 4, null, null, null),
(5, 1, 4, 'STRENGTH WORK — 5x5 @70% +5 à 7 kg — tempo 33X1 — repos 3 min', 5, 5, null, null, 180),
(5, 1, 5, 'STRENGTH WORK — 3x2 @90% +5 à 7 kg — explosif — repos 3 min', 3, 2, null, null, 180),
(5, 1, 6, 'RENFO — 4x12', 4, 12, null, null, null),
(5, 1, 7, 'RENFO — 4x12 — repos 2 min après le superset', 4, 12, null, null, 120),
(5, 2, 4, 'STRENGTH WORK — 4x5 @85% — repos 3 min', 4, 5, null, null, 180),
(5, 2, 5, 'STRENGTH WORK — 1x5 @80% — tempo 3131 — repos 3 min', 1, 5, null, null, 180),
(5, 2, 6, 'RENFO — 3x8-12 @12 kg', 3, null, 12, null, null),
(5, 2, 7, 'RENFO — 4x5', 4, 5, null, null, null),
(5, 2, 8, 'RENFO — 4x5', 4, 5, null, null, null),
(5, 2, 9, 'RENFO — 3x15 — tempo 3131 — barre à vide', 3, 15, null, null, null),
(5, 3, 6, 'STRENGTH WORK — 5x5 @60% +4 à 6 kg — tempo 5151 — repos 3 min', 5, 5, null, null, 180),
(5, 3, 7, 'RENFO — 4x12 + 5 sec iso + 12 reps — repos 2 min', 4, null, null, null, 120),
(5, 3, 8, 'RENFO — 3x max time — repos 2 min 30', 3, null, null, null, 150),
(7, 1, 4, 'STRENGTH WORK — 5-3 — le plus lourd possible avec une bonne amplitude', 1, null, null, null, null),
(7, 2, 4, 'STRENGTH WORK — 5-3 — le plus lourd possible', 1, null, null, null, null),
(7, 3, 6, 'STRENGTH WORK — 5-3 — le plus lourd possible', 1, null, null, null, null),
(8, 1, 5, 'WORKOUT — 4x8-12', 4, null, null, null, null),
(8, 1, 6, 'WORKOUT — 4x10-12 — tempo 3111 — repos 1 min 30 après le superset', 4, null, null, null, 90),
(8, 1, 7, 'WORKOUT — 4x8-12', 4, null, null, null, null),
(8, 1, 8, 'WORKOUT — 4x5-8 @5-10 kg — repos 1 min 30 après le superset', 4, null, null, null, 90),
(8, 1, 9, 'WORKOUT — 3x8-10 — charge à définir', 3, null, null, null, null),
(8, 1, 10, 'WORKOUT — 3x12 — charge à définir — repos 1 min 30 après le superset', 3, 12, null, null, 90),
(8, 1, 11, 'WORKOUT — 4x2 allers-retours — lourd', 4, null, null, null, null),
(8, 1, 12, 'WORKOUT — 4x max time', 4, null, null, null, null),
(8, 1, 13, 'WORKOUT — 3x15', 3, 15, null, null, null),
(8, 1, 14, 'WORKOUT — 3x30 sec', 3, null, null, null, null),
(8, 2, 1, 'WORKOUT — EMOM 30 min — minute 1 — 200 m', 1, null, null, null, null),
(8, 2, 2, 'WORKOUT — EMOM 30 min — minute 2 — 12 reps', 1, 12, null, null, null),
(8, 2, 3, 'WORKOUT — EMOM 30 min — minute 3 — 7 reps', 1, 7, null, null, null),
(8, 2, 4, 'WORKOUT — EMOM 30 min — minute 4 — 14 reps @15 kg', 1, 14, 15, null, null),
(8, 2, 5, 'WORKOUT — EMOM 30 min — minute 5 — 250 m', 1, null, null, null, null),
(8, 2, 6, 'WORKOUT — Finisher — 100 reps', 1, 100, null, null, null),
(8, 3, 5, 'WORKOUT — 4x8', 4, 8, null, null, null),
(8, 3, 6, 'WORKOUT — 4x8 — gilet lesté — repos 1 min 10 après le superset', 4, 8, null, null, 70),
(8, 3, 7, 'WORKOUT — 4x12', 4, 12, null, null, null),
(8, 3, 8, 'WORKOUT — 4x12', 4, 12, null, null, null),
(8, 3, 9, 'WORKOUT — 4x12 — repos 1 min 30 après le triset', 4, 12, null, null, 90),
(8, 3, 10, 'WORKOUT — 4x12', 4, 12, null, null, null),
(8, 3, 11, 'WORKOUT — 4x12 — repos 1 min 30 après le superset', 4, 12, null, null, 90),
(8, 3, 12, 'WORKOUT — 3x8 allers-retours', 3, null, null, null, null),
(8, 3, 13, 'WORKOUT — 3x30 sec', 3, null, null, null, null),
(8, 3, 14, 'WORKOUT — 3x8', 3, 8, null, null, null),
(8, 3, 15, 'WORKOUT — 3x20', 3, 20, null, null, null),
(9, 1, 4, 'STRENGTH WORK — 5x5 @85% — repos 3 min', 5, 5, null, null, 180),
(9, 1, 5, 'STRENGTH WORK — 1x25-30 @45% — technique mais explosif — repos 2 min', 1, null, null, null, 120),
(9, 1, 6, 'RENFO — 4x12', 4, 12, null, null, null),
(9, 1, 7, 'RENFO — 4x12 — repos 2 min après le superset', 4, 12, null, null, 120),
(9, 1, 8, 'RENFO — 4x20', 4, 20, null, null, null),
(9, 2, 4, 'STRENGTH WORK — 5x5 @85% — repos 3 min', 5, 5, null, null, 180),
(9, 2, 5, 'STRENGTH WORK — 1x25-30 @45% — technique mais explosif — repos 2 min', 1, null, null, null, 120),
(9, 2, 6, 'RENFO — 3x8-12 @12 kg', 3, null, 12, null, null),
(9, 2, 7, 'RENFO — 4x10', 4, 10, null, null, null),
(9, 2, 8, 'RENFO — 4x10', 4, 10, null, null, null),
(9, 3, 4, 'STRENGTH WORK — 5x5 @80% — repos 3 min', 5, 5, null, null, 180),
(9, 3, 5, 'STRENGTH WORK — 1x25-30 @45% — technique mais explosif — repos 2 min', 1, null, null, null, 120),
(9, 3, 6, 'RENFO — 4x12 + 10 sec iso + 10 reps', 4, null, null, null, null),
(9, 3, 7, 'RENFO — 3x max time', 3, null, null, null, null),
(10, 1, 5, 'WORKOUT — 4x8-12', 4, null, null, null, null),
(10, 1, 6, 'WORKOUT — 4x10-12 — tempo 3111 — repos 1 min 30 après le superset', 4, null, null, null, 90),
(10, 1, 7, 'WORKOUT — 4x8-12', 4, null, null, null, null),
(10, 1, 8, 'WORKOUT — 4x5-8 @5-10 kg — repos 1 min 30 après le superset', 4, null, null, null, 90),
(10, 1, 9, 'WORKOUT — 3x8-10 — charge à définir', 3, null, null, null, null),
(10, 1, 10, 'WORKOUT — 3x12 — charge à définir — repos 1 min 30 après le superset', 3, 12, null, null, 90),
(10, 1, 11, 'WORKOUT — 4x2 allers-retours — lourd', 4, null, null, null, null),
(10, 1, 12, 'WORKOUT — 4x max time', 4, null, null, null, null),
(10, 1, 13, 'WORKOUT — 3x15', 3, 15, null, null, null),
(10, 1, 14, 'WORKOUT — 3x30 sec', 3, null, null, null, null),
(10, 2, 1, 'WORKOUT — 1 mile', 1, null, null, null, null),
(10, 2, 2, 'WORKOUT — 100 reps', 1, 100, null, null, null),
(10, 2, 3, 'WORKOUT — 200 reps', 1, 200, null, null, null),
(10, 2, 4, 'WORKOUT — 300 reps', 1, 300, null, null, null),
(10, 2, 5, 'WORKOUT — 1 mile', 1, null, null, null, null),
(10, 3, 5, 'WORKOUT — 4x8', 4, 8, null, null, null),
(10, 3, 6, 'WORKOUT — 4x8 — gilet lesté — repos 1 min 10 après le superset', 4, 8, null, null, 70),
(10, 3, 7, 'WORKOUT — 4x12', 4, 12, null, null, null),
(10, 3, 8, 'WORKOUT — 4x12', 4, 12, null, null, null),
(10, 3, 9, 'WORKOUT — 4x12 — repos 1 min 30 après le triset', 4, 12, null, null, 90),
(10, 3, 10, 'WORKOUT — 4x12', 4, 12, null, null, null),
(10, 3, 11, 'WORKOUT — 4x12 — repos 1 min 30 après le superset', 4, 12, null, null, 90),
(10, 3, 12, 'WORKOUT — 3x8 allers-retours', 3, null, null, null, null),
(10, 3, 13, 'WORKOUT — 3x30 sec', 3, null, null, null, null),
(10, 3, 14, 'WORKOUT — 3x8', 3, 8, null, null, null),
(10, 3, 15, 'WORKOUT — 3x20', 3, 20, null, null, null),
(11, 1, 4, 'STRENGTH WORK — 5x5 @85% +2.5 kg — repos 3 min', 5, 5, null, null, 180),
(11, 1, 5, 'STRENGTH WORK — 1x25-30 @45% — technique mais explosif — repos 2 min', 1, null, null, null, 120),
(11, 1, 6, 'RENFO — 4x12', 4, 12, null, null, null),
(11, 1, 7, 'RENFO — 4x12 — repos 2 min après le superset', 4, 12, null, null, 120),
(11, 1, 8, 'RENFO — 4x8-12', 4, null, null, null, null),
(11, 1, 9, 'RENFO — 4x8-12', 4, null, null, null, null),
(11, 1, 10, 'RENFO — 4x20', 4, 20, null, null, null),
(11, 2, 4, 'STRENGTH WORK — 5x5 @85% +2.5 kg — repos 3 min', 5, 5, null, null, 180),
(11, 2, 5, 'STRENGTH WORK — 1x25-30 @45% — technique mais explosif — repos 2 min', 1, null, null, null, 120),
(11, 2, 6, 'RENFO — 3x8-12 @14 kg', 3, null, 14, null, null),
(11, 2, 7, 'RENFO — 4x12', 4, 12, null, null, null),
(11, 2, 8, 'RENFO — 4x12', 4, 12, null, null, null);

do $$
begin
  if (select count(*) from programs where id='c8100eec-e202-4ea6-81fa-20600fe46d7b' and name='TACTICAL RECONDITIONING' and duration_weeks=11) <> 1 then
    raise exception 'Tactical program does not match the reviewed source';
  end if;
  if (select count(*) from tactical_set_specs s
      join workout_templates wt on wt.program_id='c8100eec-e202-4ea6-81fa-20600fe46d7b'
        and wt.week_number=s.week and wt.day_number=s.day
      join workout_exercises we on we.workout_template_id=wt.id
        and we.position=s.position and we.prescription_notes=s.expected_notes) <> 155 then
    raise exception 'Tactical prescriptions changed; review before applying';
  end if;
end $$;

insert into prescribed_sets (workout_exercise_id,set_number,target_reps,target_load_kg,target_rpe,rest_seconds)
select we.id,n,s.reps,s.kg,s.rpe,s.rest
from tactical_set_specs s
join workout_templates wt on wt.program_id='c8100eec-e202-4ea6-81fa-20600fe46d7b'
  and wt.week_number=s.week and wt.day_number=s.day
join workout_exercises we on we.workout_template_id=wt.id and we.position=s.position
cross join lateral generate_series(1,s.set_count) n
where not exists (select 1 from prescribed_sets ps where ps.workout_exercise_id=we.id and ps.set_number=n);

-- Backfill any missing scheduled sessions for existing active assignments only.
insert into workout_sessions (athlete_id,workout_template_id,scheduled_for,status)
select pa.athlete_id,wt.id,pa.starts_on + (wt.week_number-1)*7 + wt.day_number-1,'planned'
from program_assignments pa
join workout_templates wt on wt.program_id=pa.program_id
where pa.program_id='c8100eec-e202-4ea6-81fa-20600fe46d7b' and pa.active
and not exists (select 1 from workout_sessions ws where ws.athlete_id=pa.athlete_id and ws.workout_template_id=wt.id);

select count(*) as structured_sets from prescribed_sets ps
join workout_exercises we on we.id=ps.workout_exercise_id
join workout_templates wt on wt.id=we.workout_template_id
where wt.program_id='c8100eec-e202-4ea6-81fa-20600fe46d7b';
commit;
