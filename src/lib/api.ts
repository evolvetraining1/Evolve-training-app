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
      workout_templates ( id, name, notes, estimated_minutes )
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
