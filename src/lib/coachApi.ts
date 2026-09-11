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

  const completedSessionIds = completed.map(
    (session: any) => session.id
  );

  let totalVolume = 0;
  let completedSets = 0;
  let bestE1rm = 0;

  if (completedSessionIds.length > 0) {
    const { data: performedSets, error: setsError } = await supabase
      .from("performed_sets")
      .select("workout_session_id, reps, load_kg, rpe, completed")
      .in("workout_session_id", completedSessionIds)
      .eq("completed", true);

    if (setsError) throw setsError;

    const validSets = performedSets ?? [];

    completedSets = validSets.length;

    totalVolume = validSets.reduce((sum: number, set: any) => {
      const reps = Number(set.reps ?? 0);
      const load = Number(set.load_kg ?? 0);

      return sum + reps * load;
    }, 0);

    bestE1rm = validSets.reduce((best: number, set: any) => {
      const reps = Number(set.reps ?? 0);
      const load = Number(set.load_kg ?? 0);

      if (!load || !reps) return best;

      const estimated = load * (1 + reps / 30);

      return Math.max(best, estimated);
    }, 0);
  }

  return {
    profile,
    scheduled,
    completed: completedCount,
    attendance,
    averageRpe,
    totalVolume: Math.round(totalVolume),
    completedSets,
    bestE1rm: Math.round(bestE1rm * 10) / 10,
    sessions: rows,
  };
}

export async function getCoachExercisePerformanceHistory(
  athleteId: string,
  days: number
) {
  const coachId = await currentUserId();

  // Vérifie explicitement que cet athlète appartient bien au coach connecté.
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
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("performed_sets")
    .select(`
      id,
      reps,
      load_kg,
      rpe,
      created_at,
      workout_exercises (
        id,
        exercises (
          id,
          name
        )
      ),
      workout_sessions!inner (
        id,
        athlete_id,
        status,
        completed_at
      )
    `)
    .eq("completed", true)
    .eq("workout_sessions.athlete_id", athleteId)
    .eq("workout_sessions.status", "completed")
    .gte("workout_sessions.completed_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const byExercise: Record<string, any> = {};

  for (const row of rows) {
    const workoutExercise = Array.isArray(row.workout_exercises)
      ? row.workout_exercises[0]
      : row.workout_exercises;

    const exercise = Array.isArray(workoutExercise?.exercises)
      ? workoutExercise.exercises[0]
      : workoutExercise?.exercises;

    if (!exercise?.id || !exercise?.name) continue;

    const reps = Number(row.reps ?? 0);
    const load = Number(row.load_kg ?? 0);

    if (!load || !reps) continue;

    const e1rm = load * (1 + reps / 30);

    if (!byExercise[exercise.id]) {
      byExercise[exercise.id] = {
        exerciseId: exercise.id,
        name: exercise.name,
        performances: [],
      };
    }

    const session = Array.isArray(row.workout_sessions)
      ? row.workout_sessions[0]
      : row.workout_sessions;

    byExercise[exercise.id].performances.push({
      date: session?.completed_at ?? row.created_at,
      reps,
      load,
      rpe:
        row.rpe !== null && row.rpe !== undefined
          ? Number(row.rpe)
          : null,
      e1rm: Math.round(e1rm * 10) / 10,
    });
  }

  return Object.values(byExercise)
    .map((exercise: any) => {
      const performances = exercise.performances.sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const latest =
        performances.length > 0
          ? performances[performances.length - 1]
          : null;

      const previous =
        performances.length > 1
          ? performances[performances.length - 2]
          : null;

      const bestE1rm = performances.reduce(
        (best: number, perf: any) =>
          Math.max(best, Number(perf.e1rm ?? 0)),
        0
      );

      const delta =
        latest && previous
          ? Math.round((latest.e1rm - previous.e1rm) * 10) / 10
          : null;

      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        latest,
        bestE1rm: Math.round(bestE1rm * 10) / 10,
        delta,
        history: performances,
      };
    })
    .sort((a: any, b: any) => b.bestE1rm - a.bestE1rm);
}

export async function getCoachAthletePrograms(athleteId: string) {
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

  const { data, error } = await supabase
    .from("program_assignments")
    .select(`
      id,
      starts_on,
      active,
      program_id,
      programs (
        id,
        name,
        description,
        duration_weeks
      )
    `)
    .eq("athlete_id", athleteId)
    .order("starts_on", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

// ===== SÉANCES D'UN PROGRAMME POUR LE SUIVI COACH =====
export async function getCoachAthleteProgramWorkouts(
  athleteId: string,
  programId: string
) {
  const coachId = await currentUserId();

  // Sécurité : l'athlète doit être lié au coach connecté.
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

  const { data, error } = await supabase
    .from("workout_templates")
    .select(`
      id,
      program_id,
      week_number,
      day_number,
      name,
      notes,
      estimated_minutes
    `)
    .eq("program_id", programId)
    .order("week_number", { ascending: true })
    .order("day_number", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

// ===== DÉTAIL D'UNE SÉANCE ATHLÈTE : PRESCRIT + RÉALISÉ =====
export async function getCoachAthleteSessionDetail(
  athleteId: string,
  workoutTemplateId: string
) {
  const coachId = await currentUserId();

  // Vérifie que l'athlète appartient bien au coach connecté.
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

  // Séance prescrite.
  const { data: workout, error: workoutError } = await supabase
    .from("workout_templates")
    .select(`
      id,
      name,
      week_number,
      day_number,
      notes,
      estimated_minutes
    `)
    .eq("id", workoutTemplateId)
    .single();

  if (workoutError) throw workoutError;

  // Exercices + séries prescrites.
  const { data: exercises, error: exercisesError } = await supabase
    .from("workout_exercises")
    .select(`
      id,
      position,
      prescription_notes,
      exercises (
        id,
        name
      ),
      prescribed_sets (
        id,
        set_number,
        target_reps,
        target_load_kg,
        target_rpe,
        target_rir,
        rest_seconds
      )
    `)
    .eq("workout_template_id", workoutTemplateId)
    .order("position", { ascending: true });

  if (exercisesError) throw exercisesError;

  // Instance réelle de cette séance pour cet athlète.
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      status,
      scheduled_for,
      started_at,
      completed_at,
      session_rpe
    `)
    .eq("athlete_id", athleteId)
    .eq("workout_template_id", workoutTemplateId)
    .order("scheduled_for", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;

  let performedSets: any[] = [];

  if (session?.id) {
    const { data, error } = await supabase
      .from("performed_sets")
      .select(`
        id,
        workout_session_id,
        workout_exercise_id,
        prescribed_set_id,
        set_number,
        reps,
        load_kg,
        rpe,
        completed
      `)
      .eq("workout_session_id", session.id)
      .order("set_number", { ascending: true });

    if (error) throw error;

    performedSets = data ?? [];
  }

  return {
    workout,
    exercises: exercises ?? [],
    session,
    performedSets,
  };
}
