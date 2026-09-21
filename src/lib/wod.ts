export type WodFormat = 'amrap' | 'for_time' | 'emom' | 'tabata' | 'rounds' | 'intervals' | 'circuit';
export type WorkoutSection = { id: string; block: string; format: WodFormat | null; signature: string; items: any[] };
export type WodDraft = { rounds?: string; reps?: string; minutes?: string; seconds?: string; intervals?: string; intervalResults?: string; notes?: string; capped?: boolean; completed?: boolean };
export type WodResult = { format: WodFormat; exercise_ids: string[]; rounds: number | null; reps: number | null; elapsed_seconds: number | null; intervals: number | null; interval_results: string; notes: string; capped: boolean; completed: boolean };

export function workoutBlock(item: any): string {
  const value = String(item?.prescription_notes ?? '').trim().toUpperCase();
  if (/^WARM\s*[- ]?UP/.test(value)) return 'WARM UP';
  if (value.startsWith('STRENGTH')) return 'STRENGTH WORK';
  if (value.startsWith('RENFO')) return 'RENFO';
  if (value.startsWith('WORKOUT')) return 'WORKOUT';
  if (value.startsWith('WOD')) return 'WOD';
  return 'AUTRE';
}
function detect(text: string): WodFormat | null {
  if (/\bTABATA\b/i.test(text)) return 'tabata';
  if (/\b(each (round )?for time|intervals?|intervalles?)\b/i.test(text)) return 'intervals';
  if (/\b(AMRAP|as many (rounds|reps) as possible)\b/i.test(text)) return 'amrap';
  if (/\b(EMOM|E\d+MOM|every \d+ minutes?|every minute|death by)\b/i.test(text)) return 'emom';
  if (/\b(for time|contre.la.montre)\b/i.test(text)) return 'for_time';
  if (/\b\d+\s*(rounds?|tours?)\b/i.test(text)) return 'rounds';
  return null;
}
/** Preserve order and group only conditioning prescriptions, never strength AMRAP sets. */
export function buildWorkoutSections(items: any[], template: any = {}): WorkoutSection[] {
  const sections: WorkoutSection[] = [];
  for (const item of items) {
    const block = workoutBlock(item);
    const notes = String(item.prescription_notes ?? '');
    let format: WodFormat | null = null;
    let signature = block;
    if (block === 'WORKOUT' || block === 'WOD') {
      const prescription = notes.replace(/^(WORKOUT|WOD)\s*[—–:-]?\s*/i, '');
      // An explicit finisher is never swallowed by the main AMRAP/EMOM.
      const finisher = /^FINISHER\b/i.test(prescription);
      const context = String(template.notes ?? '').split('|').find((part) => part.trim().toUpperCase().startsWith(block)) ?? '';
      format = finisher ? detect(prescription) ?? 'circuit' : detect(prescription) ?? detect(context);
      if (!format && block === 'WORKOUT' && /^MURPH$/i.test(String(template.name ?? '').trim())) format = 'for_time';
      if (!format && block === 'WOD') format = 'circuit';
      // Duration/round target separates consecutive WODs of the same format.
      const header = prescription.split(/[—–]/)[0].trim().toUpperCase();
      signature = `${block}:${format}:${finisher ? 'FINISHER' : detect(header) ? header : ''}`;
    }
    const previous = sections.at(-1);
    if (previous && previous.block === block && previous.format === format && previous.signature === signature) previous.items.push(item);
    else sections.push({ id: `block-${item.id}`, block, format, signature, items: [item] });
  }
  return sections;
}
export const wodLabels: Record<WodFormat, string> = { amrap: 'AMRAP', for_time: 'FOR TIME', emom: 'EMOM / INTERVALLES', tabata: 'TABATA', rounds: 'CIRCUIT À TOURS', intervals: 'INTERVALLES', circuit: 'CIRCUIT' };
export const wodHelp: Record<WodFormat, string> = {
  amrap: 'À la fin du temps prévu, note les tours complets puis les répétitions du tour inachevé.',
  for_time: 'Note le temps total. Si la limite de temps est atteinte ou si tu arrêtes, indique le travail réalisé.',
  emom: 'Respecte les départs prévus et note le nombre d’intervalles entièrement accomplis. Un intervalle n’est pas un tour du circuit.',
  tabata: 'Suis les temps d’effort/repos prescrits. Note les répétitions de chaque intervalle, par mouvement ; le score dépend de la consigne.',
  rounds: 'Réalise les tours prescrits, puis note les tours complets. Le chrono est facultatif.',
  intervals: 'Note chaque intervalle séparément dans le résultat : temps, répétitions ou distance selon la consigne.',
  circuit: 'Suis la consigne ci-dessus et note ton résultat ou les adaptations réalisées.',
};
function integer(value: string | undefined, label: string): number | null {
  if (value == null || !value.trim()) return null;
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) throw new Error(`${label} : indique un entier positif ou zéro.`);
  return Number(value);
}
export function serializeWod(section: WorkoutSection, draft: WodDraft = {}): WodResult {
  if (!section.format) throw new Error('Ce bloc n’est pas un WOD.');
  const rounds = integer(draft.rounds, 'Tours');
  const reps = integer(draft.reps, 'Répétitions');
  const minutes = integer(draft.minutes, 'Minutes');
  const seconds = integer(draft.seconds, 'Secondes');
  const intervals = integer(draft.intervals, 'Intervalles');
  if (seconds != null && seconds > 59) throw new Error('Les secondes doivent être comprises entre 0 et 59.');
  const elapsed = minutes == null && seconds == null ? null : (minutes ?? 0) * 60 + (seconds ?? 0);
  const intervalResults = (draft.intervalResults ?? '').trim();
  const notes = (draft.notes ?? '').trim();
  if (draft.completed) {
    if (['amrap', 'rounds'].includes(section.format) && rounds == null) throw new Error('Indique le nombre de tours complets (0 si nécessaire).');
    if (section.format === 'emom' && intervals == null) throw new Error('Indique le nombre d’intervalles accomplis.');
    if (section.format === 'for_time' && !draft.capped && (!elapsed || elapsed <= 0)) throw new Error('Indique ton temps de réalisation.');
    if (section.format === 'for_time' && draft.capped && !notes && reps == null && rounds == null) throw new Error('Indique le travail réalisé avant l’arrêt.');
    if (['tabata', 'intervals'].includes(section.format) && !intervalResults) throw new Error('Indique les résultats des intervalles.');
  }
  return { format: section.format, exercise_ids: section.items.map((i) => i.id), rounds, reps, elapsed_seconds: elapsed, intervals, interval_results: intervalResults, notes, capped: !!draft.capped, completed: !!draft.completed };
}
export function restoreWod(result: WodResult): WodDraft {
  const str = (v: number | null) => v == null ? '' : String(v);
  return { rounds: str(result.rounds), reps: str(result.reps), minutes: result.elapsed_seconds == null ? '' : String(Math.floor(result.elapsed_seconds / 60)), seconds: result.elapsed_seconds == null ? '' : String(result.elapsed_seconds % 60), intervals: str(result.intervals), intervalResults: result.interval_results, notes: result.notes, capped: result.capped, completed: result.completed };
}
