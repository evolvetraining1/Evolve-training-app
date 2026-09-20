import { localDateString } from "@/src/lib/date";
import { supabase } from "@/src/lib/supabase";
import {
  buildBaselines,
  RoutineInputType,
  RoutinePolarity,
  RoutineValue,
  WellnessRoutine,
  WellnessScores,
} from "@/src/lib/wellness";

export type RoutinePreference = {
  routine_id: string;
  enabled: boolean;
  target_value: number | null;
  scheduled_days: number[];
  position: number;
};

export type WellnessTrendRow = {
  score_date: string;
  recovery_score: number | null;
  stress_score: number | null;
  readiness_score: number | null;
  habit_score: number | null;
  completion_score: number;
  confidence_score: number;
};

export type CustomRoutineDraft = {
  name: string;
  description: string;
  category: string;
  inputType: RoutineInputType;
  unit: string;
  polarity: RoutinePolarity;
  target: number | null;
  impact: "habit" | "recovery" | "stress";
  scheduledDays: number[];
};

async function currentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error("Utilisateur non connecté.");
  return data.session.user;
}

export function routineIsEnabled(
  routine: WellnessRoutine,
  preferences: RoutinePreference[]
) {
  const preference = preferences.find((row) => row.routine_id === routine.id);
  return preference ? preference.enabled : routine.default_enabled;
}

export function routinesForDate(
  catalog: WellnessRoutine[],
  preferences: RoutinePreference[],
  date: string
) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return catalog
    .filter((routine) => routineIsEnabled(routine, preferences))
    .filter((routine) => {
      const preference = preferences.find((row) => row.routine_id === routine.id);
      const days = preference?.scheduled_days?.length
        ? preference.scheduled_days
        : [0, 1, 2, 3, 4, 5, 6];
      return days.includes(weekday);
    })
    .sort((a, b) => {
      const aPosition = preferences.find((row) => row.routine_id === a.id)?.position ?? a.sort_order;
      const bPosition = preferences.find((row) => row.routine_id === b.id)?.position ?? b.sort_order;
      return aPosition - bPosition;
    });
}

export async function loadJournalDay(date: string) {
  const user = await currentUser();
  const since = new Date(`${date}T12:00:00`);
  since.setDate(since.getDate() - 35);

  const [catalogResult, preferencesResult, logsResult, checkinResult, baselineResult] =
    await Promise.all([
      supabase
        .from("routine_catalog")
        .select("id, slug, name, category, input_type, unit, description, default_enabled, polarity, target_min, target_max, recovery_weight, stress_weight, readiness_weight, sort_order, created_by")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_routines")
        .select("routine_id, enabled, target_value, scheduled_days, position")
        .eq("athlete_id", user.id),
      supabase
        .from("routine_logs")
        .select("routine_id, value, bool_value, text_value")
        .eq("athlete_id", user.id)
        .eq("log_date", date),
      supabase
        .from("daily_checkins")
        .select("notes")
        .eq("athlete_id", user.id)
        .eq("checkin_date", date)
        .maybeSingle(),
      supabase
        .from("routine_logs")
        .select("value, routine_catalog!inner(slug)")
        .eq("athlete_id", user.id)
        .gte("log_date", localDateString(since))
        .lt("log_date", date)
        .not("value", "is", null),
    ]);

  if (catalogResult.error) throw catalogResult.error;
  if (preferencesResult.error) throw preferencesResult.error;
  if (logsResult.error) throw logsResult.error;
  if (checkinResult.error) throw checkinResult.error;
  if (baselineResult.error) throw baselineResult.error;

  const values: Record<string, RoutineValue> = {};
  for (const row of logsResult.data ?? []) {
    values[row.routine_id] = {
      value: row.text_value ?? (row.value == null ? undefined : String(row.value)),
      bool: row.bool_value == null ? undefined : Boolean(row.bool_value),
    };
  }

  const baselineRows = (baselineResult.data ?? []).map((row: any) => ({
    slug: Array.isArray(row.routine_catalog)
      ? row.routine_catalog[0]?.slug
      : row.routine_catalog?.slug,
    value: row.value,
  })).filter((row: any) => row.slug);

  return {
    userId: user.id,
    catalog: (catalogResult.data ?? []) as WellnessRoutine[],
    preferences: (preferencesResult.data ?? []) as RoutinePreference[],
    values,
    notes: checkinResult.data?.notes ?? "",
    baseline: buildBaselines(baselineRows),
  };
}

export async function saveRoutinePreferences(
  catalog: WellnessRoutine[],
  selectedIds: string[],
  existing: RoutinePreference[],
  schedules: Record<string, number[]> = {}
) {
  const user = await currentUser();
  const rows = catalog.map((routine, index) => {
    const previous = existing.find((item) => item.routine_id === routine.id);
    return {
      athlete_id: user.id,
      routine_id: routine.id,
      enabled: selectedIds.includes(routine.id),
      target_value: previous?.target_value ?? null,
      scheduled_days: schedules[routine.id]?.length
        ? schedules[routine.id]
        : previous?.scheduled_days?.length
          ? previous.scheduled_days
          : [0, 1, 2, 3, 4, 5, 6],
      position: previous?.position ?? index,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("user_routines")
    .upsert(rows, { onConflict: "athlete_id,routine_id" });
  if (error) throw error;
}

export async function createCustomRoutine(input: CustomRoutineDraft) {
  const user = await currentUser();
  const name = input.name.trim();
  const description = input.description.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error("Le nom doit contenir entre 2 et 80 caractères.");
  }
  if (!input.scheduledDays.length) {
    throw new Error("Sélectionne au moins un jour.");
  }

  const numericInput = ["number", "minutes", "hours", "count"].includes(input.inputType);
  if (numericInput && input.polarity !== "neutral" && input.target == null) {
    throw new Error("Ajoute un objectif pour que cette habitude puisse être évaluée.");
  }

  const targetMin = input.polarity === "higher_better" ? input.target : null;
  const targetMax = input.polarity === "lower_better" ? input.target : null;
  const recoveryWeight = input.impact === "recovery" ? 0.75 : 0;
  const stressWeight = input.impact === "stress" ? 0.75 : input.impact === "recovery" ? 0.25 : 0;
  const readinessWeight = input.impact === "habit" ? 0.25 : 0.5;
  const slug = `custom:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  const { data: routine, error: routineError } = await supabase
    .from("routine_catalog")
    .insert({
      slug,
      name,
      category: input.category,
      input_type: input.inputType,
      unit: input.unit.trim() || null,
      description: description || null,
      default_enabled: false,
      polarity: input.polarity,
      target_min: targetMin,
      target_max: targetMax,
      recovery_weight: recoveryWeight,
      stress_weight: stressWeight,
      readiness_weight: readinessWeight,
      sort_order: 1000,
      active: true,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (routineError) throw routineError;

  const { error: preferenceError } = await supabase
    .from("user_routines")
    .insert({
      athlete_id: user.id,
      routine_id: routine.id,
      enabled: true,
      target_value: input.target,
      scheduled_days: input.scheduledDays,
      position: 1000,
      updated_at: new Date().toISOString(),
    });

  if (preferenceError) {
    await supabase.from("routine_catalog").delete().eq("id", routine.id);
    throw preferenceError;
  }

  return routine.id as string;
}

export async function archiveCustomRoutine(routineId: string) {
  const user = await currentUser();
  const { error } = await supabase
    .from("routine_catalog")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", routineId)
    .eq("created_by", user.id);
  if (error) throw error;
}

export async function saveJournalDay(input: {
  date: string;
  routines: WellnessRoutine[];
  values: Record<string, RoutineValue>;
  notes: string;
  scores: WellnessScores;
}) {
  const user = await currentUser();
  const answeredRows: any[] = [];
  const unansweredIds: string[] = [];

  for (const routine of input.routines) {
    const value = input.values[routine.id];
    if (routine.input_type === "boolean") {
      if (value?.bool == null) {
        unansweredIds.push(routine.id);
      } else {
        answeredRows.push({
          athlete_id: user.id,
          routine_id: routine.id,
          log_date: input.date,
          value: null,
          bool_value: value.bool,
          text_value: null,
          updated_at: new Date().toISOString(),
        });
      }
      continue;
    }

    const raw = value?.value?.trim();
    if (!raw) {
      unansweredIds.push(routine.id);
      continue;
    }

    if (routine.input_type === "time") {
      answeredRows.push({
        athlete_id: user.id,
        routine_id: routine.id,
        log_date: input.date,
        value: null,
        bool_value: null,
        text_value: raw,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    const numericValue = Number(raw.replace(",", "."));
    if (!Number.isFinite(numericValue)) {
      unansweredIds.push(routine.id);
      continue;
    }

    answeredRows.push({
      athlete_id: user.id,
      routine_id: routine.id,
      log_date: input.date,
      value: numericValue,
      bool_value: null,
      text_value: null,
      updated_at: new Date().toISOString(),
    });
  }

  if (unansweredIds.length) {
    const { error } = await supabase
      .from("routine_logs")
      .delete()
      .eq("athlete_id", user.id)
      .eq("log_date", input.date)
      .in("routine_id", unansweredIds);
    if (error) throw error;
  }

  if (answeredRows.length) {
    const { error } = await supabase
      .from("routine_logs")
      .upsert(answeredRows, { onConflict: "athlete_id,routine_id,log_date" });
    if (error) throw error;
  }

  const bySlug = Object.fromEntries(input.routines.map((routine) => [routine.slug, routine]));
  const getNumeric = (slug: string) => {
    const routine = bySlug[slug];
    if (!routine) return null;
    const raw = input.values[routine.id]?.value;
    const value = raw ? Number(raw.replace(",", ".")) : NaN;
    return Number.isFinite(value) ? value : null;
  };
  const sleepHours = getNumeric("sleep_duration");

  const { error: checkinError } = await supabase
    .from("daily_checkins")
    .upsert({
      athlete_id: user.id,
      checkin_date: input.date,
      sleep_minutes: sleepHours == null ? null : Math.round(sleepHours * 60),
      sleep_quality: getNumeric("sleep_quality"),
      fatigue: getNumeric("fatigue"),
      stress: getNumeric("stress"),
      soreness: getNumeric("soreness"),
      motivation: getNumeric("motivation"),
      pain: getNumeric("pain"),
      notes: input.notes.trim() || null,
    }, { onConflict: "athlete_id,checkin_date" });
  if (checkinError) throw checkinError;

  const { error: scoreError } = await supabase
    .from("daily_wellness_scores")
    .upsert({
      athlete_id: user.id,
      score_date: input.date,
      recovery_score: input.scores.recovery,
      stress_score: input.scores.stress,
      readiness_score: input.scores.readiness,
      habit_score: input.scores.habits,
      completion_score: input.scores.completion,
      confidence_score: input.scores.confidence,
      inputs_count: input.scores.answered,
      algorithm_version: "evolve-wellness-v2",
      components: { drivers: input.scores.drivers },
      updated_at: new Date().toISOString(),
    }, { onConflict: "athlete_id,score_date" });
  if (scoreError) throw scoreError;
}

export async function loadWellnessTrends(days = 183) {
  const user = await currentUser();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const { data, error } = await supabase
    .from("daily_wellness_scores")
    .select("score_date, recovery_score, stress_score, readiness_score, habit_score, completion_score, confidence_score")
    .eq("athlete_id", user.id)
    .gte("score_date", localDateString(since))
    .order("score_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WellnessTrendRow[];
}
