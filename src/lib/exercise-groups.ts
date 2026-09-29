/** Group only explicit pair/triset prescriptions; equal reps alone never imply a superset. */
export type ExerciseGroup = { id: string; items: any[]; paired: boolean; label: string };
const phase = (item: any) => String(item.prescription_notes ?? '').trim().match(/^(WARM\s*[- ]?UP|STRENGTH\s*WORK|STRENGTH|RENFO|WORKOUT|WOD)\b/i)?.[0].toUpperCase() ?? 'AUTRE';
const explicit = (item: any) => String(item.prescription_notes ?? '').match(/\b(SUPER\s*SET|BI[ -]?SET|TRI[ -]?SET)\s+([A-Z])([1-9])\b/i);
const endMarker = (item: any) => String(item.prescription_notes ?? '').match(/apr[eè]s\s+(?:le\s+)?(super\s*set|bi[ -]?set|tri[ -]?set)\b/i);

export function buildExerciseGroups(items: any[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  for (let i = 0; i < items.length;) {
    const first = items[i];
    const tag = explicit(first);
    if (tag && tag[3] === '1') {
      const members = [first];
      while (i + members.length < items.length) {
        const next = items[i + members.length];
        const nextTag = explicit(next);
        if (!nextTag || phase(next) !== phase(first) || nextTag[1].toUpperCase() !== tag[1].toUpperCase() || nextTag[2].toUpperCase() !== tag[2].toUpperCase() || Number(nextTag[3]) !== members.length + 1) break;
        members.push(next);
      }
      if (members.length === (/tri/i.test(tag[1]) ? 3 : 2)) {
        groups.push({ id: first.id, items: members, paired: true, label: `${tag[1].toUpperCase()} ${tag[2].toUpperCase()}` });
        i += members.length; continue;
      }
    }
    // Legacy imports put "repos ... après le superset/triset" on the LAST movement.
    const count = [3, 2].find((n) => {
      const slice = items.slice(i, i + n);
      const lastTag = slice.length === n ? endMarker(slice[n - 1]) : null;
      return !!lastTag && (/tri/i.test(lastTag[1]) ? 3 : 2) === n && slice.every((item) => phase(item) === phase(first) && !explicit(item)) && slice.slice(0, -1).every((item) => !endMarker(item)) && !/^WARM|^WOD/.test(phase(first));
    });
    if (count) {
      groups.push({ id: first.id, items: items.slice(i, i + count), paired: true, label: count === 3 ? 'TRISET' : /bi[ -]?set/i.test(endMarker(items[i + count - 1])?.[1] ?? '') ? 'BISET' : 'SUPERSET' });
      i += count; continue;
    }
    groups.push({ id: first.id, items: [first], paired: false, label: '' }); i++;
  }
  return groups;
}

export function exercisePrescription(item: any): string {
  const note = String(item.prescription_notes ?? '').replace(/^(WARM\s*[- ]?UP|STRENGTH\s*WORK|STRENGTH|RENFO|WORKOUT|WOD)\s*[—–:-]?\s*/i, '').trim();
  if (note) return note;
  const sets = [...(item.prescribed_sets ?? [])].sort((a, b) => a.set_number - b.set_number);
  return sets.map((s) => [`S${s.set_number}`, s.target_reps == null ? null : `${s.target_reps} reps`, s.target_load_kg == null ? null : `${s.target_load_kg} kg`, s.target_rpe == null ? null : `RPE ${s.target_rpe}`, s.rest_seconds == null ? null : `repos ${s.rest_seconds} s`].filter(Boolean).join(' · ')).join(' / ');
}
export function groupSetNumbers(group: ExerciseGroup, rowsById?: Record<string, { setNumber: number }[]>): number[] {
  const numbers = group.items.flatMap((item) => rowsById ? (rowsById[item.id] ?? []).map((s) => s.setNumber) : (item.prescribed_sets?.length ? item.prescribed_sets.map((s: any) => Number(s.set_number)) : Array.from({ length: Number(String(item.prescription_notes ?? '').match(/\b(\d+)\s*[x×]/i)?.[1] ?? 1) }, (_, i) => i + 1)));
  return [...new Set<number>(numbers)].sort((a, b) => a - b);
}
export function groupRest(group: ExerciseGroup, setNumber?: number): string {
  const last = group.items.at(-1);
  const sets = last?.prescribed_sets ?? [];
  const set = setNumber == null ? sets[0] : sets.find((s: any) => Number(s.set_number) === setNumber);
  if (set?.rest_seconds != null) {
    const seconds = Number(set.rest_seconds);
    const duration = [Math.floor(seconds / 60) ? `${Math.floor(seconds / 60)} min` : '', seconds % 60 ? `${seconds % 60} s` : ''].filter(Boolean).join(' ');
    return seconds === 0 ? 'Sans repos prescrit après l’enchaînement.' : `Repos après l’enchaînement : ${duration}.`;
  }
  const match = String(last?.prescription_notes ?? '').match(/repos\s+(.+?)(?:\s+apr[eè]s\s+(?:le\s+)?(?:super\s*set|bi[ -]?set|tri[ -]?set)|[—–]|$)/i);
  return match ? `Repos après l’enchaînement : ${match[1]}.` : 'Repos après l’enchaînement : non précisé dans le programme.';
}
export function repetitionLabel(item: any): string {
  return /allers?[ -]retours?/i.test(String(item.prescription_notes ?? '')) ? 'A/R' : 'REPS';
}
