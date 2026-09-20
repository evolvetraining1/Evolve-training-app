export const WELLNESS_ALGORITHM_VERSION = "evolve-wellness-v2";

export type RoutineInputType =
  | "boolean"
  | "scale_5"
  | "scale_10"
  | "number"
  | "minutes"
  | "hours"
  | "count"
  | "time";

export type RoutinePolarity =
  | "higher_better"
  | "lower_better"
  | "target_range"
  | "neutral";

export type WellnessRoutine = {
  id: string;
  slug: string;
  name: string;
  category: string;
  input_type: RoutineInputType | string;
  unit: string | null;
  description: string | null;
  default_enabled: boolean;
  polarity: RoutinePolarity | string;
  target_min: number | null;
  target_max: number | null;
  recovery_weight: number;
  stress_weight: number;
  readiness_weight: number;
  sort_order: number;
  created_by: string | null;
};

export type RoutineValue = {
  value?: string;
  bool?: boolean;
};

export type WellnessBaseline = Record<
  string,
  { median: number; count: number }
>;

export type WellnessDriver = {
  slug: string;
  label: string;
  quality: number;
  weight: number;
  direction: "support" | "load";
};

export type WellnessScores = {
  recovery: number | null;
  stress: number | null;
  readiness: number | null;
  habits: number | null;
  completion: number;
  confidence: number;
  answered: number;
  expected: number;
  drivers: WellnessDriver[];
};

const SUBJECTIVE_SLUGS = new Set([
  "sleep_quality",
  "fatigue",
  "soreness",
  "pain",
  "recovery_feeling",
  "stress",
  "motivation",
  "mood",
  "digestion",
  "energy_morning",
  "resting_hr",
  "hrv",
  "session_rpe",
]);

const CORE_SLUGS = new Set([
  "sleep_duration",
  "sleep_quality",
  "fatigue",
  "stress",
  "soreness",
  "pain",
  "motivation",
  "recovery_feeling",
]);

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function numeric(value?: string) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseClockMinutes(value?: string) {
  const match = (value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function sleepHoursFromTimes(bedtime?: string, wakeTime?: string) {
  const bed = parseClockMinutes(bedtime);
  const wake = parseClockMinutes(wakeTime);
  if (bed == null || wake == null) return null;
  let duration = wake - bed;
  if (duration <= 0) duration += 24 * 60;
  if (duration <= 0 || duration > 16 * 60) return null;
  return Math.round((duration / 60) * 100) / 100;
}

function scaleQuality(value: number, max: number, lowerBetter: boolean) {
  const normalized = clamp((value - 1) / Math.max(1, max - 1));
  return lowerBetter ? 1 - normalized : normalized;
}

function baselineQuality(
  routine: WellnessRoutine,
  value: number,
  baseline?: WellnessBaseline
) {
  const reference = baseline?.[routine.slug];
  if (!reference || reference.count < 7 || reference.median <= 0) return null;
  const delta = (value - reference.median) / reference.median;

  if (routine.slug === "hrv") {
    return clamp(0.5 + delta * 2);
  }

  if (routine.slug === "resting_hr") {
    return clamp(0.5 - delta * 4);
  }

  return null;
}

/** Retourne 1 pour une donnée favorable et 0 pour une donnée défavorable. */
export function routineQuality(
  routine: WellnessRoutine,
  input?: RoutineValue,
  baseline?: WellnessBaseline
) {
  if (!input) return null;

  if (routine.input_type === "boolean") {
    if (input.bool == null) return null;
    if (routine.polarity === "neutral") return null;
    return routine.polarity === "lower_better"
      ? input.bool ? 0 : 1
      : input.bool ? 1 : 0;
  }

  if (routine.input_type === "time") return null;

  const value = numeric(input.value);
  if (value == null) return null;

  const personalized = baselineQuality(routine, value, baseline);
  if (personalized != null) return personalized;

  if (routine.input_type === "scale_5") {
    return scaleQuality(value, 5, routine.polarity === "lower_better");
  }

  if (routine.input_type === "scale_10") {
    return scaleQuality(value, 10, routine.polarity === "lower_better");
  }

  const min = routine.target_min == null ? null : Number(routine.target_min);
  const max = routine.target_max == null ? null : Number(routine.target_max);

  if (routine.polarity === "higher_better") {
    if (min == null || min <= 0) return null;
    return clamp(value / min);
  }

  if (routine.polarity === "lower_better") {
    const threshold = max ?? min;
    if (threshold == null) return null;
    if (threshold === 0) return value <= 0 ? 1 : clamp(1 / (1 + value));
    if (value <= threshold) return 1;
    return clamp(1 - (value - threshold) / Math.max(1, threshold));
  }

  if (routine.polarity === "target_range") {
    if (min == null && max == null) return null;
    if (min != null && value < min) return min <= 0 ? 0 : clamp(value / min);
    if (max != null && value > max) return clamp(max / Math.max(value, 0.01));
    return 1;
  }

  return null;
}

function weightedScore(
  routines: WellnessRoutine[],
  values: Record<string, RoutineValue>,
  baseline: WellnessBaseline | undefined,
  type: "recovery" | "stress"
) {
  let weightedTotal = 0;
  let totalWeight = 0;
  let count = 0;

  for (const routine of routines) {
    const quality = routineQuality(routine, values[routine.id], baseline);
    if (quality == null) continue;
    const rawWeight = type === "recovery"
      ? Number(routine.recovery_weight || 0)
      : Number(routine.stress_weight || 0);
    const weight = Math.abs(rawWeight);
    if (weight <= 0) continue;
    const contribution = type === "stress" ? 1 - quality : quality;
    weightedTotal += contribution * weight;
    totalWeight += weight;
    count += 1;
  }

  if (count < 3 || totalWeight <= 0) return null;
  return Math.round(clamp(weightedTotal / totalWeight) * 100);
}

function habitScore(
  routines: WellnessRoutine[],
  values: Record<string, RoutineValue>,
  baseline?: WellnessBaseline
) {
  const qualities = routines
    .filter((routine) => !SUBJECTIVE_SLUGS.has(routine.slug))
    .map((routine) => routineQuality(routine, values[routine.id], baseline))
    .filter((value): value is number => value != null);

  if (qualities.length < 2) return null;
  return Math.round(
    (qualities.reduce((sum, value) => sum + value, 0) / qualities.length) * 100
  );
}

export function calculateWellnessScores(
  routines: WellnessRoutine[],
  values: Record<string, RoutineValue>,
  baseline?: WellnessBaseline
): WellnessScores {
  const answered = routines.filter((routine) => {
    const input = values[routine.id];
    return routine.input_type === "boolean"
      ? input?.bool != null
      : Boolean(input?.value?.trim());
  }).length;
  const expected = routines.length;
  const completion = expected ? Math.round((answered / expected) * 100) : 0;
  const recovery = weightedScore(routines, values, baseline, "recovery");
  const stress = weightedScore(routines, values, baseline, "stress");
  const habits = habitScore(routines, values, baseline);

  let readiness: number | null = null;
  if (recovery != null && stress != null) {
    const habitSupport = habits ?? 50;
    readiness = Math.round(
      clamp((recovery * 0.55 + (100 - stress) * 0.3 + habitSupport * 0.15) / 100) * 100
    );
  }

  const coreAnswered = routines.filter(
    (routine) => CORE_SLUGS.has(routine.slug) && values[routine.id] && (
      routine.input_type === "boolean"
        ? values[routine.id].bool != null
        : Boolean(values[routine.id].value?.trim())
    )
  ).length;
  const confidence = Math.round(
    clamp(completion / 100 * 0.5 + Math.min(coreAnswered / 5, 1) * 0.5) * 100
  );

  const drivers = routines
    .map((routine) => {
      const quality = routineQuality(routine, values[routine.id], baseline);
      if (quality == null) return null;
      const recoveryWeight = Math.abs(Number(routine.recovery_weight || 0));
      const stressWeight = Math.abs(Number(routine.stress_weight || 0));
      const weight = Math.max(recoveryWeight, stressWeight);
      if (!weight) return null;
      return {
        slug: routine.slug,
        label: routine.name,
        quality,
        weight,
        direction: quality >= 0.6 ? "support" as const : "load" as const,
      };
    })
    .filter((driver): driver is WellnessDriver => driver != null)
    .sort((a, b) => {
      const impactA = Math.abs(a.quality - 0.5) * a.weight;
      const impactB = Math.abs(b.quality - 0.5) * b.weight;
      return impactB - impactA;
    })
    .slice(0, 4);

  return {
    recovery,
    stress,
    readiness,
    habits,
    completion,
    confidence,
    answered,
    expected,
    drivers,
  };
}

export function wellnessLabel(
  value: number | null,
  type: "recovery" | "stress" | "readiness" | "habits"
) {
  if (value == null) return "À compléter";
  if (type === "stress") {
    if (value <= 30) return "Faible";
    if (value <= 60) return "Modéré";
    return "Élevé";
  }
  if (value >= 75) return type === "habits" ? "Solide" : "Élevé";
  if (value >= 50) return "Modéré";
  return "Faible";
}

export function scoreColor(value: number | null, inverse = false) {
  if (value == null) return "#73726F";
  const favorable = inverse ? 100 - value : value;
  if (favorable >= 70) return "#64D94B";
  if (favorable >= 45) return "#FFC400";
  return "#F04444";
}

export function buildBaselines(
  rows: Array<{ slug: string; value: number | string | null }>
): WellnessBaseline {
  const grouped: Record<string, number[]> = {};
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    (grouped[row.slug] ??= []).push(value);
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([slug, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
      return [slug, { median, count: sorted.length }];
    })
  );
}
