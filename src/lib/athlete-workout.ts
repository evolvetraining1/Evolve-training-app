import { buildFallbackSets, type LocalSet } from './workout-sets';
import { buildExerciseGroups, exercisePrescription, type ExerciseGroup } from './exercise-groups';
import { type WorkoutSection } from './wod';
export type AthleteSet = LocalSet & {
    skipped?: boolean;
    inputError?: string;
    dirty?: boolean;
};
export type AthleteStep = {
    id: string;
    section: WorkoutSection;
    group: ExerciseGroup;
    wod: boolean;
    warmup: boolean;
};
export function withoutRpe(value: unknown): string {
    return String(value ?? '').replace(/\bRPE\s*[:@]?\s*\d+(?:[.,]\d+)?(?:\s*[-–à]\s*\d+(?:[.,]\d+)?)?/gi, '')
        .replace(/([—–·|])\s*(?:[—–·|]\s*)+/g, '$1 ').replace(/\s{2,}/g, ' ').replace(/^[\s—–·|,]+|[\s—–·|,]+$/g, '').trim();
}
export function athletePrescription(item: any): string { return withoutRpe(exercisePrescription(item)); }
export function athleteSteps(sections: WorkoutSection[], useWod: (s: WorkoutSection) => boolean): AthleteStep[] {
    return sections.flatMap(section => {
        const wod = !!section.format && useWod(section);
        const warmup = section.block === 'WARM UP' || section.block === 'WOD' && !wod;
        const groups = wod || warmup ? [{ id: section.id, items: section.items, paired: false, label: '' }] : buildExerciseGroups(section.items);
        return groups.map(group => ({ id: group.id, section, group, wod, warmup }));
    });
}
export function prescribedRows(item: any, simple = false): AthleteSet[] {
    if (simple)
        return [{ prescribedId: null, workoutExerciseId: item.id, setNumber: 1, reps: '', load: '', rpe: '', done: false, simpleCompletion: true }];
    const prescribed = [...(item.prescribed_sets ?? [])].sort((a: any, b: any) => a.set_number - b.set_number);
    const rows: AthleteSet[] = prescribed.length ? prescribed.map((s: any) => ({ prescribedId: s.id, workoutExerciseId: item.id, setNumber: Number(s.set_number), reps: s.target_reps == null ? '' : String(s.target_reps), load: s.target_load_kg == null ? '' : String(s.target_load_kg), rpe: '', done: false })) : buildFallbackSets(item).map(s => ({ ...s, rpe: '' }));
    // Time/distance-only prescriptions are confirmed as instructions, never stored as repetitions.
    const work = String(item.prescription_notes ?? '').split(/repos|rest/i)[0];
    const timedOrDistance = /\b(?:sec(?:ondes?)?|seconds?|minutes?|min|m[eè]tres?|km)\b|\d\s*m\b/i.test(work) && !/\breps?\b/i.test(work);
    return rows.map(r => timedOrDistance ? { ...r, simpleCompletion: true, reps: '', load: '' } : r);
}
export function stepRows(step: AthleteStep, rows: Record<string, AthleteSet[]>): AthleteSet[] { return step.group.items.flatMap(i => rows[i.id] ?? []); }
export function stepStatus(rows: AthleteSet[]): 'pending' | 'done' | 'skipped' | 'partial' {
    if (!rows.length)
        return 'pending';
    if (rows.every(r => r.done))
        return 'done';
    if (rows.every(r => r.skipped))
        return 'skipped';
    if (rows.every(r => r.done || r.skipped))
        return 'partial';
    return 'pending';
}
export function summaryRows(rows: AthleteSet[]): string {
    if (!rows.length)
        return '';
    const completed = rows.filter(r => r.done);
    if (!completed.length)
        return rows.every(r => r.skipped) ? 'Non réalisé' : 'Aucune série confirmée';
    if (completed.every(r => r.simpleCompletion))
        return 'Réalisé';
    const values = completed.map(r => `${r.reps || '—'} reps${r.load ? ` · ${r.load} kg` : ''}`);
    return values.every(v => v === values[0]) ? `${completed.length} × ${values[0]}` : completed.map((r, i) => `S${r.setNumber} : ${values[i]}`).join(' / ');
}
export function parseAthleteSet(row: AthleteSet) {
    // Unperformed rows must not contribute prescribed weights/reps or block finishing.
    if (!row.done || row.simpleCompletion)
        return { reps: 0, load_kg: 0, rpe: null as number | null };
    if (row.inputError)
        throw new Error(row.inputError);
    const reps = row.reps.trim();
    if (!/^\d+$/.test(reps) || !Number.isSafeInteger(Number(reps)) || Number(reps) > 2147483647)
        throw new Error(`Série ${row.setNumber} : indique les répétitions réellement faites.`);
    const load = row.load.trim().replace(',', '.');
    if (!/^\d+(?:\.\d+)?$/.test(load) || !Number.isFinite(Number(load)) || Number(load) > 10000)
        throw new Error(`Série ${row.setNumber} : indique la charge en kg (0 si aucune charge ajoutée).`);
    // Preserve an old measured RPE only on already saved rows; never copy target RPE.
    const oldRpe = Number(row.rpe.replace(',', '.'));
    return { reps: Number(reps), load_kg: Number(load), rpe: row.rpe && Number.isFinite(oldRpe) && oldRpe >= 1 && oldRpe <= 10 ? oldRpe : null };
}
export function asPlanned(step: AthleteStep, plans: Record<string, AthleteSet[]>): AthleteSet[] {
    return stepRows(step, plans).map(r => ({ ...r, done: true, skipped: false, rpe: '' }));
}
export function skipRows(rows: AthleteSet[]): AthleteSet[] { return rows.map(r => ({ ...r, done: false, skipped: true, rpe: '', reps: '0', load: '0', inputError: undefined })); }
export function editCommon(rows: AthleteSet[], count: string, reps: string, load: string): AthleteSet[] {
    if (!/^\d+$/.test(count) || Number(count) < 0 || Number(count) > 100)
        throw new Error('Indique un nombre entier de séries réalisées, entre 0 et 100.');
    const expanded = [...rows];
    if (!rows.length)
        throw new Error('Aucune prescription chargée.');
    let number = Math.max(...rows.map(r => r.setNumber));
    while (expanded.length < Number(count))
        expanded.push({ ...rows[0], prescribedId: null, setNumber: ++number });
    return expanded.map((r, i) => ({ ...r, reps, load, rpe: '', inputError: undefined, done: i < Number(count), skipped: i >= Number(count) }));
}
export function restoreAthleteRow(row: AthleteSet, saved?: Partial<AthleteSet>): AthleteSet {
    if (!saved)
        return row;
    // Server completion wins. An edited device draft invalidates it until explicitly saved.
    const next = { ...row, reps: String(saved.reps ?? row.reps), load: String(saved.load ?? row.load), rpe: row.rpe };
    const changed = next.reps !== row.reps || next.load !== row.load;
    return { ...next, inputError: saved.inputError, dirty: saved.dirty, done: changed || saved.dirty ? false : row.done, skipped: saved.dirty ? !!saved.skipped : changed ? false : !!row.skipped };
}
