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

// ===== ATTRIBUTION PROGRAMME + GENERATION DES SEANCES =====
export async function assignProgramAndSchedule(input: {
  programId: string;
  athleteId: string;
  startsOn: string; // YYYY-MM-DD
}) {
  const { data, error } = await supabase.rpc(
    "assign_program_and_schedule",
    {
      p_program_id: input.programId,
      p_athlete_id: input.athleteId,
      p_starts_on: input.startsOn,
    }
  );

  if (error) throw error;
  if (!data) {
    throw new Error("Impossible d'attribuer le programme.");
  }

  return data;
}

export async function getCoachAthleteOverview(
  athleteId: string,
  days: number
) {
  const coachId = await currentUserId();

  const { data: relationship, error: relationshipError } = await supabase
    .from("coach_athlete_relationships")
    .select("id")
    .eq("coach_id", coachId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();

  if (relationshipError) throw relationshipError;
  if (!relationship) {
    throw new Error("Athlète non lié à ce coach.");
  }

  const since = new Date();
  since.setDate(since.getDate() - Math.max(days - 1, 0));
  const sinceDate = since.toISOString().slice(0, 10);

  const [{ data: profile, error: profileError }, { data: sessions, error: sessionsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .eq("id", athleteId)
        .single(),

      supabase
        .from("workout_sessions")
        .select(`
          id,
          status,
          scheduled_for,
          completed_at,
          session_rpe
        `)
        .eq("athlete_id", athleteId)
        .gte("scheduled_for", sinceDate)
        .order("scheduled_for", { ascending: false }),
    ]);

  if (profileError) throw profileError;
  if (sessionsError) throw sessionsError;

  const rows = sessions ?? [];

  const scheduled = rows.length;
  const completed = rows.filter((session: any) => session.status === "completed");
  const completedCount = completed.length;

  const attendance =
    scheduled > 0
      ? Math.round((completedCount / scheduled) * 100)
      : 0;

  const rpeValues = completed
    .map((session: any) => session.session_rpe)
    .filter(
      (value: any) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    )
    .map((value: any) => Number(value));

  const averageRpe =
    rpeValues.length > 0
      ? Math.round(
          (rpeValues.reduce((sum: number, value: number) => sum + value, 0) /
            rpeValues.length) *
            10
        ) / 10
      : null;

  return {
    profile,
    scheduled,
    completed: completedCount,
    attendance,
    averageRpe,
    sessions: rows,
  };
}
