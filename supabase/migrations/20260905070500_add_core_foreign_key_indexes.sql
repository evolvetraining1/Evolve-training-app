-- Add low-risk covering indexes for foreign keys used by the core coaching flows.
-- Prepared on the stabilisation branch only; apply to production after review/test.

create index if not exists profiles_selected_program_id_idx
  on public.profiles (selected_program_id);

create index if not exists programs_coach_id_idx
  on public.programs (coach_id);

create index if not exists program_assignments_program_id_idx
  on public.program_assignments (program_id);

create index if not exists workout_templates_program_id_idx
  on public.workout_templates (program_id);

create index if not exists workout_exercises_exercise_id_idx
  on public.workout_exercises (exercise_id);

create index if not exists prescribed_sets_workout_exercise_id_idx
  on public.prescribed_sets (workout_exercise_id);

create index if not exists performed_sets_workout_exercise_id_idx
  on public.performed_sets (workout_exercise_id);

create index if not exists performed_sets_prescribed_set_id_idx
  on public.performed_sets (prescribed_set_id);

create index if not exists workout_sessions_workout_template_id_idx
  on public.workout_sessions (workout_template_id);
