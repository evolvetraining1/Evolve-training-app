export const BODY_GROUPS = [
  { key: "chest", label: "Pectoraux", section: "Haut du corps" },
  { key: "back", label: "Dos", section: "Haut du corps" },
  { key: "shoulders", label: "Épaules", section: "Haut du corps" },
  { key: "arms", label: "Bras", section: "Haut du corps" },
  { key: "core", label: "Abdominaux", section: "Tronc" },
  { key: "lower_back", label: "Lombaires", section: "Tronc" },
  { key: "glutes", label: "Fessiers", section: "Bas du corps" },
  { key: "quads", label: "Quadriceps", section: "Bas du corps" },
  { key: "hamstrings", label: "Ischio-jambiers", section: "Bas du corps" },
  { key: "calves", label: "Mollets", section: "Bas du corps" },
  { key: "cardio", label: "Cardio", section: "Cardio" },
] as const;

export type BodyGroupKey = (typeof BODY_GROUPS)[number]["key"];

export type ExerciseMuscleSource = {
  name: string;
  category?: string | null;
  muscles?: string[] | null;
};

const matchers: Record<BodyGroupKey, RegExp> = {
  chest: /pectora/,
  back: /grand dorsal|rhombo|trapez/,
  shoulders: /epaule|deltoid/,
  arms: /biceps|triceps|avant bras|grip|\bbras\b/,
  core: /abdomin|oblique|gainage \(tronc\)|grand droit|flechisseur de hanche/,
  lower_back: /lombaire|erecteur du rachis|extenseur lombaire/,
  glutes: /fessier/,
  quads: /quadriceps/,
  hamstrings: /ischio/,
  calves: /mollet/,
  cardio: /cardio respiratoire/,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getExerciseBodyGroups(exercise: ExerciseMuscleSource): BodyGroupKey[] {
  const muscleText = normalize((exercise.muscles ?? []).join(" "));
  const groups = BODY_GROUPS
    .map(({ key }) => key)
    .filter((key) => matchers[key].test(muscleText));

  return groups;
}

export function getBodyGroupLabel(key: BodyGroupKey) {
  return BODY_GROUPS.find((group) => group.key === key)?.label ?? key;
}

export function getPrimaryBodyGroup(exercise: ExerciseMuscleSource): BodyGroupKey {
  const groups = getExerciseBodyGroups(exercise);
  if (groups.includes("cardio")) return "cardio";

  const firstMuscle = normalize(exercise.muscles?.[0] ?? "");
  const firstMatch = BODY_GROUPS.find(({ key }) => key !== "cardio" && matchers[key].test(firstMuscle));
  return firstMatch?.key ?? groups[0] ?? "core";
}

