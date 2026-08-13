export type SetEntry = {
  id: string;
  reps: number;
  load: number;
  rpe: number;
  done: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  prescription: string;
  sets: SetEntry[];
};

export const exercises: Exercise[] = [
  {
    id: "squat",
    name: "Back Squat",
    prescription: "5 × 5 · 135 kg · repos 3 min",
    sets: Array.from({ length: 5 }, (_, i) => ({
      id: `sq-${i + 1}`,
      reps: 5,
      load: 135,
      rpe: 8,
      done: false,
    })),
  },
  {
    id: "rdl",
    name: "Romanian Deadlift",
    prescription: "4 × 8 · RPE 8 · repos 2 min",
    sets: Array.from({ length: 4 }, (_, i) => ({
      id: `rdl-${i + 1}`,
      reps: 8,
      load: 90,
      rpe: 8,
      done: false,
    })),
  },
  {
    id: "lunges",
    name: "Walking Lunges",
    prescription: "3 × 12 · repos 90 sec",
    sets: Array.from({ length: 3 }, (_, i) => ({
      id: `lu-${i + 1}`,
      reps: 12,
      load: 20,
      rpe: 7,
      done: false,
    })),
  },
];

export const habits = [
  ["Sommeil", "7 h 34", "Bon"],
  ["Fatigue", "3 / 10", "Faible"],
  ["Stress", "4 / 10", "Modéré"],
  ["Motivation", "9 / 10", "Élevée"],
];

export const nutrition = {
  calories: [2347, 2500],
  protein: [156, 170],
  carbs: [242, 280],
  fat: [71, 75],
};
