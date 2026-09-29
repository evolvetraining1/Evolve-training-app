export type LocalSet = {
  prescribedId?: string | null;
  workoutExerciseId: string;
  setNumber: number;
  reps: string;
  load: string;
  rpe: string;
  done: boolean;
  simpleCompletion?: boolean;
};


export function buildFallbackSets(item: any): LocalSet[] {
  const notes = String(item?.prescription_notes ?? "").split(/encha[îi]n[ée]\s+avec/i)[0].trim();

  let setCount = Number(notes.match(/\b(\d+)\s*[x×]/i)?.[1] ?? 1);
  let reps = "";
  let load = "";
  let rpe = "";

  const setRepMatch = notes.match(/(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
  if (setRepMatch) {
    setCount = Math.max(1, Number(setRepMatch[1]));
    const prescribedReps = setRepMatch[2].replace(/\s+/g, "");
    // A range or compound rep/hold/rep sequence requires the athlete’s actual result.
    reps = /[-–]/.test(prescribedReps) || /[x×]\s*\d+\s*\+/.test(notes) ? "" : prescribedReps;
  } else {
    const simpleReps = notes.match(/(?:^|[—-]\s*)(\d+)\s*reps?/i);
    if (simpleReps) reps = simpleReps[1];
  }

  const kgMatch = notes.match(/@\s*(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) load = kgMatch[1].replace(",", ".");

  const rpeMatch = notes.match(/\bRPE\s*[:@]?\s*(\d+(?:[.,]\d+)?)/i);
  if (rpeMatch) rpe = rpeMatch[1].replace(",", ".");

  return Array.from({ length: setCount }, (_, index) => ({
    prescribedId: null,
    workoutExerciseId: item.id,
    setNumber: index + 1,
    reps,
    load,
    rpe,
    done: false,
  }));
}

