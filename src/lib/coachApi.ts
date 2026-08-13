import { supabase } from "@/src/lib/supabase";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Utilisateur non connecté");
  return data.user.id;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createAthleteInvite(email: string) {
  const coachId = await currentUserId();
  const { data, error } = await supabase
    .from("coach_invites")
    .insert({
      coach_id: coachId,
      email: email.trim().toLowerCase(),
      invite_code: randomCode(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCoachAthletes() {
  const coachId = await currentUserId();
  const { data, error } = await supabase
    .from("coach_athlete_relationships")
    .select(`
      id, status, started_at,
      athlete_id,
      profiles!coach_athlete_relationships_athlete_id_fkey (
        id, first_name, last_name, avatar_url
      )
    `)
    .eq("coach_id", coachId)
    .eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function createExercise(input: {
  name: string;
  category?: string;
  instructions?: string;
}) {
  const coachId = await currentUserId();
  const { data, error } = await supabase
    .from("exercises")
    .insert({ owner_coach_id: coachId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCoachExercises() {
  const coachId = await currentUserId();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("owner_coach_id", coachId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSimpleProgram(input: {
  name: string;
  description?: string;
  durationWeeks?: number;
}) {
  const coachId = await currentUserId();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      coach_id: coachId,
      name: input.name,
      description: input.description ?? null,
      duration_weeks: input.durationWeeks ?? 4,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCoachPrograms() {
  const coachId = await currentUserId();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkoutTemplate(input: {
  programId: string;
  name: string;
  weekNumber: number;
  dayNumber: number;
  estimatedMinutes?: number;
}) {
  const { data, error } = await supabase
    .from("workout_templates")
    .insert({
      program_id: input.programId,
      name: input.name,
      week_number: input.weekNumber,
      day_number: input.dayNumber,
      estimated_minutes: input.estimatedMinutes ?? 60,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addExerciseToWorkout(input: {
  workoutTemplateId: string;
  exerciseId: string;
  position: number;
  prescriptionNotes?: string;
  sets: Array<{
    reps?: number;
    loadKg?: number;
    rpe?: number;
    rir?: number;
    restSeconds?: number;
  }>;
}) {
  const { data: we, error: weError } = await supabase
    .from("workout_exercises")
    .insert({
      workout_template_id: input.workoutTemplateId,
      exercise_id: input.exerciseId,
      position: input.position,
      prescription_notes: input.prescriptionNotes ?? null,
    })
    .select()
    .single();

  if (weError) throw weError;

  const rows = input.sets.map((set, i) => ({
    workout_exercise_id: we.id,
    set_number: i + 1,
    target_reps: set.reps ?? null,
    target_load_kg: set.loadKg ?? null,
    target_rpe: set.rpe ?? null,
    target_rir: set.rir ?? null,
    rest_seconds: set.restSeconds ?? null,
  }));

  const { error: setError } = await supabase.from("prescribed_sets").insert(rows);
  if (setError) throw setError;
  return we;
}

export async function assignProgramToAthlete(input: {
  programId: string;
  athleteId: string;
  startsOn: string;
}) {
  const { data, error } = await supabase
    .from("program_assignments")
    .insert({
      program_id: input.programId,
      athlete_id: input.athleteId,
      starts_on: input.startsOn,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function scheduleWorkout(input: {
  athleteId: string;
  workoutTemplateId: string;
  scheduledFor: string;
}) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      athlete_id: input.athleteId,
      workout_template_id: input.workoutTemplateId,
      scheduled_for: input.scheduledFor,
      status: "planned",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptInvite(code: string) {
  const { data, error } = await supabase.rpc("accept_coach_invite", { code });
  if (error) throw error;
  return data;
}
