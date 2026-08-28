import { supabase } from "@/src/lib/supabase";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Utilisateur non connecté");
  return data.user.id;
}

export async function getMyProfile() {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, avatar_url")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getMyUpcomingSessions() {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id, scheduled_for, status, started_at, completed_at, session_rpe,
      workout_template_id,
      workout_templates ( id, name, notes, estimated_minutes, program_id )
    `)
    .eq("athlete_id", id)
    .order("scheduled_for", { ascending: true })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getSessionDetail(sessionId: string) {
  const id = await currentUserId();

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(`
      id, athlete_id, scheduled_for, status, started_at, completed_at, session_rpe,
      workout_template_id,
      workout_templates ( id, name, notes, estimated_minutes )
    `)
    .eq("id", sessionId)
    .eq("athlete_id", id)
    .single();

  if (sessionError) throw sessionError;

  const { data: workoutExercises, error: exError } = await supabase
    .from("workout_exercises")
    .select(`
      id, position, prescription_notes,
      exercise_id,
      exercises ( id, name, category, instructions, video_url ),
      prescribed_sets (
        id, set_number, target_reps, target_load_kg, target_rpe, target_rir, rest_seconds
      )
    `)
    .eq("workout_template_id", session.workout_template_id)
    .order("position", { ascending: true });

  if (exError) throw exError;

  const { data: performed, error: performedError } = await supabase
    .from("performed_sets")
    .select("*")
    .eq("workout_session_id", sessionId);

  if (performedError) throw performedError;

  return { session, workoutExercises: workoutExercises ?? [], performedSets: performed ?? [] };
}

export async function startWorkoutSession(sessionId: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeWorkoutSession(sessionId: string, sessionRpe?: number) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      session_rpe: sessionRpe ?? null,
    })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


export async function getNextWorkoutSession(sessionId: string) {
  const { data: current, error: currentError } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      athlete_id,
      workout_template_id,
      workout_templates!inner(
        program_id,
        week_number,
        day_number,
        name
      )
    `)
    .eq("id", sessionId)
    .single();

  if (currentError) throw currentError;
  if (!current) return null;

  const currentTemplate: any = Array.isArray((current as any).workout_templates)
    ? (current as any).workout_templates[0]
    : (current as any).workout_templates;

  if (!currentTemplate?.program_id) return null;

  const { data: candidates, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      workout_template_id,
      scheduled_for,
      created_at,
      status,
      workout_templates!inner(
        program_id,
        week_number,
        day_number,
        name
      )
    `)
    .eq("athlete_id", (current as any).athlete_id)
    .eq("status", "planned")
    .eq("workout_templates.program_id", currentTemplate.program_id)
    .neq("id", sessionId);

  if (error) throw error;

  const currentWeek = Number(currentTemplate.week_number ?? 0);
  const currentDay = Number(currentTemplate.day_number ?? 0);

  const ordered = (candidates ?? [])
    .map((session: any) => {
      const template = Array.isArray(session.workout_templates)
        ? session.workout_templates[0]
        : session.workout_templates;

      return {
        session,
        week: Number(template?.week_number ?? 0),
        day: Number(template?.day_number ?? 0),
      };
    })
    .filter(
      ({ week, day }) =>
        week > currentWeek ||
        (week === currentWeek && day > currentDay)
    )
    .sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      if (a.day !== b.day) return a.day - b.day;

      return String(a.session.created_at ?? "").localeCompare(
        String(b.session.created_at ?? "")
      );
    });

  return ordered[0]?.session ?? null;
}

export async function savePerformedSet(input: {
  workout_session_id: string;
  workout_exercise_id: string;
  prescribed_set_id?: string | null;
  set_number: number;
  reps: number;
  load_kg: number;
  rpe?: number | null;
  completed: boolean;
}) {
  const { data, error } = await supabase
    .from("performed_sets")
    .upsert(input, { onConflict: "workout_session_id,workout_exercise_id,set_number" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTodayCheckin() {
  const id = await currentUserId();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("athlete_id", id)
    .eq("checkin_date", today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTodayCheckin(input: {
  sleep_minutes?: number;
  sleep_quality?: number;
  fatigue?: number;
  stress?: number;
  soreness?: number;
  motivation?: number;
  pain?: number;
  notes?: string;
}) {
  const id = await currentUserId();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_checkins")
    .upsert({ athlete_id: id, checkin_date: today, ...input }, { onConflict: "athlete_id,checkin_date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}


export async function getRecentCheckins(days = 7) {
  const id = await currentUserId();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("checkin_date, sleep_minutes, sleep_quality, fatigue, stress, soreness, motivation, pain")
    .eq("athlete_id", id)
    .gte("checkin_date", since.toISOString().slice(0, 10))
    .order("checkin_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestPerformance() {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from("performed_sets")
    .select(`
      id, reps, load_kg, created_at, completed,
      workout_exercises (
        exercises ( id, name )
      ),
      workout_sessions!inner ( athlete_id )
    `)
    .eq("workout_sessions.athlete_id", id)
    .eq("completed", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows: any[] = data ?? [];
  if (!rows.length) return null;
  const latest: any = rows[0];
  const score = (r: any) => Number(r.load_kg || 0) * (1 + Number(r.reps || 0) / 30);
  const latestScore = score(latest);
  const previousBest = Math.max(0, ...rows.slice(1).map(score));
  return {
    exerciseName: latest.workout_exercises?.exercises?.name ?? "Performance",
    reps: Number(latest.reps || 0),
    loadKg: Number(latest.load_kg || 0),
    estimated1rm: Math.round(latestScore * 2) / 2,
    isPR: latestScore >= previousBest && latestScore > 0,
    deltaKg: Math.max(0, Math.round((latestScore - previousBest) * 2) / 2),
    createdAt: latest.created_at,
  };
}


// ===== PROGRAM API RESTORE =====

export async function getMyPrograms() {
  const uid = await currentUserId();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", uid)
    .single();

  if (profileError) throw profileError;

  // COACH : affiche les programmes qu'il a créés
  if (profile?.role === "coach") {
    const { data, error } = await supabase
      .from("programs")
      .select("id, name, description, duration_weeks, created_at")
      .eq("coach_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data ?? [];
  }

  // ATHLETE : affiche les programmes qui lui sont attribués
  const { data, error } = await supabase
    .from("program_assignments")
    .select(`
      id,
      starts_on,
      ends_on,
      active,
      programs (
        id,
        name,
        description,
        duration_weeks
      )
    `)
    .eq("athlete_id", uid)
    .eq("active", true)
    .order("starts_on", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((assignment: any) => ({
    assignment_id: assignment.id,
    starts_on: assignment.starts_on,
    ends_on: assignment.ends_on,
    active: assignment.active,
    ...(Array.isArray(assignment.programs)
      ? assignment.programs[0]
      : assignment.programs),
  }));
}

export async function getProgramDetail(programId: string) {
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, name, description, duration_weeks")
    .eq("id", programId)
    .single();

  if (programError) throw programError;

  const { data: workouts, error: workoutsError } = await supabase
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

  if (workoutsError) throw workoutsError;

  return {
    program,
    workouts: workouts ?? [],
  };
}

export async function getWorkoutTemplateDetail(workoutId: string) {
  const { data: workout, error: workoutError } = await supabase
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
    .eq("id", workoutId)
    .single();

  if (workoutError) throw workoutError;

  const { data: workoutExercises, error: exercisesError } = await supabase
    .from("workout_exercises")
    .select(`
      id,
      position,
      prescription_notes,
      exercises (
        id,
        name,
        category,
        instructions,
        video_url
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
    .eq("workout_template_id", workoutId)
    .order("position", { ascending: true });

  if (exercisesError) throw exercisesError;

  return {
    workout,
    workoutExercises: (workoutExercises ?? []).map((item: any) => ({
      ...item,
      prescribed_sets: [...(item.prescribed_sets ?? [])].sort(
        (a: any, b: any) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
      ),
    })),
  };
}

// ===== DASHBOARD STATS ATHLETE =====
export async function getAthleteStatsDashboard() {
  const uid = await currentUserId();

  const { data: latestSession, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      scheduled_for,
      completed_at,
      session_rpe,
      workout_templates (
        id,
        name
      )
    `)
    .eq("athlete_id", uid)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;

  let totalVolume = 0;
  let completedSets = 0;
  let averageRpe = 0;
  let bestE1rm = 0;

  if (latestSession?.id) {
    const { data: sets, error: setsError } = await supabase
      .from("performed_sets")
      .select("reps, load_kg, rpe, completed")
      .eq("workout_session_id", latestSession.id)
      .eq("completed", true);

    if (setsError) throw setsError;

    const validSets = sets ?? [];

    completedSets = validSets.length;

    totalVolume = validSets.reduce((sum: number, set: any) => {
      const reps = Number(set.reps ?? 0);
      const load = Number(set.load_kg ?? 0);
      return sum + reps * load;
    }, 0);

    const rpes = validSets
      .map((set: any) => Number(set.rpe))
      .filter((value: number) => Number.isFinite(value) && value > 0);

    if (rpes.length) {
      averageRpe =
        rpes.reduce((sum: number, value: number) => sum + value, 0) /
        rpes.length;
    }

    bestE1rm = validSets.reduce((best: number, set: any) => {
      const reps = Number(set.reps ?? 0);
      const load = Number(set.load_kg ?? 0);

      if (!load || !reps) return best;

      // Formule d'Epley
      const estimated = load * (1 + reps / 30);

      return Math.max(best, estimated);
    }, 0);
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: recentSessions, error: recentError } = await supabase
    .from("workout_sessions")
    .select("id, status, scheduled_for")
    .eq("athlete_id", uid)
    .gte("scheduled_for", sinceDate)
    .lte("scheduled_for", new Date().toISOString().slice(0, 10));

  if (recentError) throw recentError;

  const dueSessions = recentSessions ?? [];
  const completedCount = dueSessions.filter(
    (session: any) => session.status === "completed"
  ).length;

  const attendance =
    dueSessions.length > 0
      ? Math.round((completedCount / dueSessions.length) * 100)
      : 0;

  const template = Array.isArray(latestSession?.workout_templates)
    ? latestSession?.workout_templates?.[0]
    : latestSession?.workout_templates;

  return {
    latestSession: latestSession
      ? {
          id: latestSession.id,
          name: template?.name ?? "Séance",
          completedAt: latestSession.completed_at,
        }
      : null,

    totalVolume: Math.round(totalVolume),
    completedSets,
    averageRpe:
      averageRpe > 0 ? Math.round(averageRpe * 10) / 10 : null,
    bestE1rm: Math.round(bestE1rm),
    attendance,
    completedLast30: completedCount,
    scheduledLast30: dueSessions.length,
  };
}

// ===== PERFORMANCE PAR EXERCICE =====
export async function getExercisePerformanceHistory() {
  const uid = await currentUserId();

  const { data, error } = await supabase
    .from("performed_sets")
    .select(`
      id,
      reps,
      load_kg,
      rpe,
      completed,
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
    .eq("workout_sessions.athlete_id", uid)
    .eq("workout_sessions.status", "completed")
    .eq("completed", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const byExercise: Record<string, any> = {};

  for (const row of rows as any[]) {
    const workoutExercise = Array.isArray(row.workout_exercises)
      ? row.workout_exercises[0]
      : row.workout_exercises;

    const exercise = Array.isArray(workoutExercise?.exercises)
      ? workoutExercise.exercises[0]
      : workoutExercise?.exercises;

    if (!exercise?.id || !exercise?.name) continue;

    const reps = Number(row.reps ?? 0);
    const load = Number(row.load_kg ?? 0);

    if (!reps || !load) continue;

    const e1rm = load * (1 + reps / 30);

    if (!byExercise[exercise.id]) {
      byExercise[exercise.id] = {
        exerciseId: exercise.id,
        name: exercise.name,
        performances: [],
      };
    }

    byExercise[exercise.id].performances.push({
      date: row.workout_sessions?.completed_at ?? row.created_at,
      reps,
      load,
      rpe: row.rpe != null ? Number(row.rpe) : null,
      e1rm: Math.round(e1rm * 10) / 10,
    });
  }

  return Object.values(byExercise)
    .map((exercise: any) => {
      const perfs = exercise.performances.sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const latest = perfs[perfs.length - 1] ?? null;
      const previous = perfs[perfs.length - 2] ?? null;

      const best = perfs.reduce(
        (max: number, perf: any) => Math.max(max, perf.e1rm),
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
        previous,
        bestE1rm: Math.round(best * 10) / 10,
        delta,
        history: perfs.slice(-6).reverse(),
      };
    })
    .sort((a: any, b: any) => b.bestE1rm - a.bestE1rm);
}


// ===== SELECTED PROGRAM API =====

export async function getSelectedProgramId(): Promise<string | null> {
  const uid = await currentUserId();

  const { data, error } = await supabase
    .from("profiles")
    .select("selected_program_id")
    .eq("id", uid)
    .single();

  if (error) throw error;

  return data?.selected_program_id ?? null;
}

export async function setSelectedProgramId(programId: string) {
  const uid = await currentUserId();

  const { error } = await supabase
    .from("profiles")
    .update({
      selected_program_id: programId,
    })
    .eq("id", uid);

  if (error) throw error;
}

export async function getMyProgramsWithSelection() {
  const [programs, selectedProgramId] = await Promise.all([
    getMyPrograms(),
    getSelectedProgramId(),
  ]);

  return {
    programs,
    selectedProgramId,
  };
}
