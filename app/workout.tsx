import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenScrollView } from '@/src/components/screen-scroll-view';
import { BackScreenHeader, Card, PrimaryButton } from '@/src/components/ui';
import { AthleteExerciseCard } from '@/src/components/athlete-exercise-card';
import { WodCard } from '@/src/components/WodCard';
import { colors } from '@/src/theme';
import { isFinishedSession } from '@/src/lib/session-flow';
import { buildWorkoutSections, serializeWod, restoreWod, type WodDraft, type WodResult } from '@/src/lib/wod';
import { athleteSteps, asPlanned, parseAthleteSet, prescribedRows, restoreAthleteRow, skipRows, stepRows, stepStatus, summaryRows, withoutRpe, type AthleteSet, type AthleteStep } from '@/src/lib/athlete-workout';
import { completeWorkoutSession, getSessionDetail, getAthletePreviousSets, savePerformedSets, saveWorkoutWodResults, startWorkoutSession } from '@/src/lib/api';
const exerciseName = (item: any) => String((Array.isArray(item.exercises) ? item.exercises[0] : item.exercises)?.name ?? 'Exercice');
const stepName = (step: AthleteStep) => step.wod ? step.section.format!.toUpperCase().replace('_', ' ') : step.warmup ? 'Échauffement' : step.group.paired ? `${step.group.label} · ${step.group.items.map(exerciseName).join(' + ')}` : exerciseName(step.group.items[0]);
const payload = (row: AthleteSet) => ({ workout_exercise_id: row.workoutExerciseId, prescribed_set_id: row.prescribedId, set_number: row.setNumber, ...parseAthleteSet(row), completed: row.done });
export default function WorkoutScreen() {
    const { sessionId } = useLocalSearchParams<{
        sessionId?: string;
    }>();
    const [loading, setLoading] = useState(true), [detail, setDetail] = useState<any>(null), [message, setMessage] = useState('');
    const [rows, setRows] = useState<Record<string, AthleteSet[]>>({}), rowsRef = useRef(rows), plans = useRef<Record<string, AthleteSet[]>>({});
    const [wods, setWods] = useState<Record<string, WodDraft>>({}), wodsRef = useRef(wods), savedWods = useRef<Record<string, WodResult>>({});
    const [previous, setPrevious] = useState<Record<string, string>>({});
    const [index, setIndex] = useState(0), [editing, setEditing] = useState(false), [overview, setOverview] = useState(false);
    const [busy, setBusy] = useState(false), lock = useRef(false), active = useRef(sessionId), queue = useRef(Promise.resolve());
    const scroll = useRef<ScrollView>(null), [retry, setRetry] = useState(0);
    const readOnly = isFinishedSession(detail?.session), draftKey = `evolve-session-draft:${sessionId}`;
    const sections = useMemo(() => buildWorkoutSections(detail?.workoutExercises ?? [], detail?.session?.workout_templates), [detail]);
    const steps = useMemo(() => athleteSteps(sections, s => !readOnly || !!detail?.session?.wod_results?.[s.id]), [sections, readOnly, detail]);
    const step = steps[index];
    useEffect(() => {
        let cancelled = false;
        active.current = sessionId;
        lock.current = false;
        setBusy(false);
        setLoading(true);
        setDetail(null);
        setMessage('');
        setIndex(0);
        setEditing(false);
        setOverview(false);
        setPrevious({});
        setRows({});
        rowsRef.current = {};
        plans.current = {};
        setWods({});
        wodsRef.current = {};
        savedWods.current = {};
        if (!sessionId) {
            setLoading(false);
            return;
        }
        (async () => {
            let d = await getSessionDetail(sessionId);
            if (cancelled)
                return;
            if (d.session.status === 'planned') {
                d.session = { ...d.session, ...await startWorkoutSession(sessionId) };
                if (isFinishedSession(d.session))
                    d = await getSessionDetail(sessionId);
            }
            if (cancelled)
                return;
            const finished = isFinishedSession(d.session), ss = buildWorkoutSections(d.workoutExercises, d.session.workout_templates);
            const localSteps = athleteSteps(ss, s => !finished || !!d.session.wod_results?.[s.id]);
            const byId: Record<string, AthleteSet[]> = {}, prescribed: Record<string, AthleteSet[]> = {}, loadedWods: Record<string, WodDraft> = {};
            const saved = new Map<string, any>((d.performedSets ?? []).map((r: any) => [`${r.workout_exercise_id}:${r.set_number}`, r]));
            for (const s of localSteps) {
                if (s.wod) {
                    loadedWods[s.section.id] = d.session.wod_results?.[s.section.id] ? restoreWod(d.session.wod_results[s.section.id]) : {};
                    continue;
                }
                for (const item of s.group.items) {
                    const base = prescribedRows(item, s.warmup);
                    prescribed[item.id] = base;
                    const extra = (d.performedSets ?? []).filter((r: any) => r.workout_exercise_id === item.id && !base.some(b => b.setNumber === r.set_number));
                    const allRows = [...base, ...extra.map((r: any) => ({ ...base[0], prescribedId: r.prescribed_set_id, setNumber: r.set_number }))].sort((a, b) => a.setNumber - b.setNumber);
                    byId[item.id] = allRows.map(r => {
                        const old = saved.get(`${item.id}:${r.setNumber}`);
                        return old ? { ...r, reps: r.simpleCompletion ? '' : old.reps == null ? '' : String(old.reps), load: r.simpleCompletion ? '' : old.load_kg == null ? '' : String(old.load_kg), rpe: old.rpe == null ? '' : String(old.rpe), done: !!old.completed, skipped: !old.completed } : finished ? { ...r, reps: '', load: '', done: false, skipped: true } : r;
                    });
                }
            }
            await queue.current;
            const raw = await AsyncStorage.getItem(draftKey).catch(() => null);
            let focus = 0;
            if (!finished && raw) {
                try {
                    const draft = JSON.parse(raw), oldRows = draft.sets ?? draft;
                    for (const id of Object.keys(byId)) {
                        const extraDraft = (oldRows[id] ?? []).filter((v: AthleteSet) => v.workoutExerciseId === id && v.prescribedId == null && Number.isInteger(v.setNumber) && v.setNumber > 0 && v.setNumber <= 100 && !byId[id].some(r => r.setNumber === v.setNumber));
                        const unique = new Map(byId[id].map(r => [r.setNumber, r]));
                        for (const v of extraDraft)
                            if (!unique.has(v.setNumber))
                                unique.set(v.setNumber, { ...byId[id][0], setNumber: v.setNumber, prescribedId: null, done: false, skipped: false });
                        byId[id] = [...unique.values()].sort((a, b) => a.setNumber - b.setNumber).map(r => restoreAthleteRow(r, oldRows[id]?.find((v: AthleteSet) => v.setNumber === r.setNumber)));
                    }
                    for (const id of Object.keys(loadedWods))
                        if (draft.wods?.[id])
                            loadedWods[id] = draft.wods[id];
                    const found = localSteps.findIndex(s => s.id === draft.activeStep);
                    if (found >= 0)
                        focus = found;
                }
                catch { /* Keep verified server data if a device draft is corrupt. */ }
            }
            if (cancelled)
                return;
            plans.current = prescribed;
            rowsRef.current = byId;
            setRows(byId);
            wodsRef.current = loadedWods;
            setWods(loadedWods);
            savedWods.current = d.session.wod_results ?? {};
            setIndex(focus);
            setDetail(d);
            setLoading(false);
            // Nonessential history must never delay or block the active session.
            void getAthletePreviousSets([...new Set<string>(d.workoutExercises.map((i: any) => i.exercise_id).filter(Boolean))], d.session.started_at ?? new Date().toISOString(), sessionId)
                .then(history => { if (!cancelled)
                setPrevious(Object.fromEntries(Object.entries(history).map(([id, rs]) => [id, summaryRows(rs.map((r: any) => ({ workoutExerciseId: r.workout_exercise_id, setNumber: r.set_number, reps: String(r.reps), load: String(r.load_kg), rpe: '', done: true })))]))); })
                .catch(() => { });
        })().catch((e: any) => { if (!cancelled) {
            setMessage(e.message ?? 'Impossible de charger la séance.');
            setLoading(false);
        } });
        return () => { cancelled = true; if (active.current === sessionId)
            active.current = undefined; };
    }, [sessionId, retry]);
    function persist(focus = step?.id) {
        const snapshot = JSON.stringify({ sets: rowsRef.current, wods: wodsRef.current, activeStep: focus });
        queue.current = queue.current.then(() => AsyncStorage.setItem(draftKey, snapshot)).catch(() => { if (active.current === sessionId)
            setMessage('Le brouillon n’a pas pu être conservé. Valide tes résultats avant de quitter.'); });
    }
    function move(next: number) { if (lock.current)
        return; setIndex(next); setEditing(false); setOverview(false); setMessage(''); persist(steps[next]?.id); scroll.current?.scrollTo({ y: 0, animated: false }); }
    function next() { if (index + 1 < steps.length)
        move(index + 1);
    else {
        setOverview(true);
        setEditing(false);
        scroll.current?.scrollTo({ y: 0, animated: false });
        persist();
    } }
    function patch(id: string, nextRows: AthleteSet[]) {
        if (lock.current || readOnly)
            return;
        rowsRef.current = { ...rowsRef.current, [id]: nextRows.map(r => ({ ...r, done: false, dirty: true })) };
        setRows(rowsRef.current);
        persist();
    }
    async function commitRows(nextRows: AthleteSet[]) {
        if (lock.current || readOnly || !sessionId || !step)
            return;
        let parsed;
        try {
            const error = nextRows.find(r => r.inputError)?.inputError;
            if (error)
                throw new Error(error);
            parsed = nextRows.map(payload);
        }
        catch (e: any) {
            setEditing(true);
            setMessage(e.message);
            return;
        }
        lock.current = true;
        setBusy(true);
        setMessage('');
        try {
            await savePerformedSets(sessionId, parsed);
            if (active.current !== sessionId)
                return;
            const normalized = nextRows.map((r, i) => ({ ...r, reps: r.simpleCompletion ? '' : String(parsed[i].reps), load: r.simpleCompletion ? '' : String(parsed[i].load_kg), inputError: undefined, dirty: false }));
            const updated = { ...rowsRef.current };
            for (const id of new Set(normalized.map(r => r.workoutExerciseId)))
                updated[id] = normalized.filter(r => r.workoutExerciseId === id);
            rowsRef.current = updated;
            setRows(updated);
            persist(steps[index + 1]?.id ?? step.id);
            lock.current = false;
            next();
        }
        catch (e: any) {
            if (active.current === sessionId)
                setMessage(e.message ?? 'Enregistrement impossible. Tes saisies sont conservées ; réessaie.');
        }
        finally {
            if (active.current === sessionId) {
                lock.current = false;
                setBusy(false);
            }
        }
    }
    function edit(value: boolean) { if (lock.current)
        return; setEditing(value); setMessage(''); }
    function patchWod(value: Partial<WodDraft>) { if (lock.current || readOnly || !step)
        return; wodsRef.current = { ...wodsRef.current, [step.section.id]: { ...wodsRef.current[step.section.id], ...value, completed: false } }; setWods(wodsRef.current); persist(); }
    async function commitWod(skipped = false) {
        if (lock.current || readOnly || !sessionId || !step)
            return;
        const draft: WodDraft = skipped ? { completed: false, notes: 'Non réalisé' } : { ...wodsRef.current[step.section.id], completed: true };
        let score;
        try {
            score = serializeWod(step.section, draft);
        }
        catch (e: any) {
            setMessage(e.message);
            return;
        }
        lock.current = true;
        setBusy(true);
        setMessage('');
        try {
            const results = { ...savedWods.current, [step.section.id]: score };
            await saveWorkoutWodResults(sessionId, results);
            if (active.current !== sessionId)
                return;
            savedWods.current = results;
            wodsRef.current = { ...wodsRef.current, [step.section.id]: draft };
            setWods(wodsRef.current);
            persist(steps[index + 1]?.id ?? step.id);
            lock.current = false;
            next();
        }
        catch (e: any) {
            if (active.current === sessionId)
                setMessage(e.message ?? 'Résultat non enregistré. Réessaie.');
        }
        finally {
            if (active.current === sessionId) {
                lock.current = false;
                setBusy(false);
            }
        }
    }
    const status = (s: AthleteStep) => s.wod ? (wods[s.section.id]?.completed ? 'done' : wods[s.section.id]?.notes === 'Non réalisé' ? 'skipped' : 'pending') : stepStatus(stepRows(s, rows));
    async function finalize() {
        if (lock.current || readOnly || !sessionId || !detail)
            return;
        lock.current = true;
        setBusy(true);
        setMessage('');
        try {
            const results = Object.fromEntries(steps.filter(s => s.wod).map(s => [s.section.id, serializeWod(s.section, wodsRef.current[s.section.id]?.completed ? wodsRef.current[s.section.id] : { completed: false, notes: wodsRef.current[s.section.id]?.notes })]));
            await completeWorkoutSession(sessionId, Object.values(rowsRef.current).flat().map(payload), undefined, results);
            await queue.current;
            await AsyncStorage.removeItem(draftKey).catch(() => { });
            if (active.current === sessionId)
                router.replace('/(tabs)');
        }
        catch (e: any) {
            if (active.current === sessionId)
                setMessage(e.message ?? 'Validation impossible. Tes résultats restent disponibles.');
        }
        finally {
            if (active.current === sessionId) {
                lock.current = false;
                setBusy(false);
            }
        }
    }
    function finish() {
        if (lock.current || readOnly || !detail)
            return;
        if (!detail.workoutExercises.length && !/\b(repos|récupération|recovery|rest)\b/i.test(`${detail.session.workout_templates?.name} ${detail.session.workout_templates?.notes}`)) {
            setMessage('Cette séance ne contient aucun exercice.');
            return;
        }
        const remaining = steps.filter(s => status(s) === 'pending').length;
        if (remaining) {
            Alert.alert('Résultats non confirmés', `${remaining} carte(s) restent sans validation. Elles ne seront pas comptées comme réalisées. Terminer ?`, [{ text: 'REVENIR À LA SÉANCE', style: 'cancel' }, { text: 'TERMINER', onPress: () => void finalize() }]);
            return;
        }
        void finalize();
    }
    return <ScreenScrollView ref={scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <BackScreenHeader eyebrow={readOnly ? 'HISTORIQUE DE SÉANCE' : 'SÉANCE EN COURS'} title={detail?.session?.workout_templates?.name ?? 'Séance'} subtitle={readOnly ? 'Tes résultats enregistrés.' : 'Une carte à la fois. Confirme ou ajuste ce que tu as fait.'}/>
    {loading ? <ActivityIndicator color={colors.yellow} size="large"/> : !detail ? <PrimaryButton label="RÉESSAYER" onPress={() => setRetry(n => n + 1)}/> : <>
      {steps.length > 0 ? <View style={styles.progress}><Text style={styles.progressText}>{steps.filter(s => status(s) !== 'pending').length} / {steps.length} cartes renseignées</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setOverview(v => !v)} style={styles.navButton}><Text style={styles.link}>{overview ? 'REVENIR À LA CARTE' : 'VOIR LA SÉANCE'}</Text></Pressable></View> : null}
      {overview ? <>
        <Text style={styles.heading}>Ma séance</Text>
        {detail.session.workout_templates?.notes ? <Text style={styles.notes}>{withoutRpe(detail.session.workout_templates.notes)}</Text> : null}
        {steps.map((s, i) => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${stepName(s)}`} disabled={busy} onPress={() => move(i)} style={styles.overviewRow}><Text style={styles.overviewName}>{i + 1}. {stepName(s)}</Text><Text style={styles.status}>{({ done: '✓ Fait', partial: 'Adapté', skipped: 'Non réalisé', pending: 'À confirmer' })[status(s)]}</Text></Pressable>)}
        {!readOnly ? <PrimaryButton label={busy ? 'ENREGISTREMENT…' : 'TERMINER MA SÉANCE'} disabled={busy} onPress={finish}/> : null}
      </> : step ? <>
        <Text style={styles.heading}>{step.section.block === 'AUTRE' ? 'EXERCICE' : step.section.block} · {index + 1} / {steps.length}</Text>
        {step.wod ? <><WodCard section={step.section} value={wods[step.section.id] ?? {}} disabled={readOnly || busy} navigationDisabled={busy} onChange={patchWod} onValidate={() => void commitWod()}/>{!readOnly ? <Pressable disabled={busy} onPress={() => void commitWod(true)} style={styles.navButton}><Text style={styles.link}>Je n’ai pas fait ce WOD</Text></Pressable> : null}</> :
                    <AthleteExerciseCard key={step.id} step={step} rows={rows} previous={previous} editing={editing} disabled={busy} readOnly={readOnly} onEdit={edit} onPatch={patch} onPlanned={() => { const planned = asPlanned(step, plans.current); const extra = stepRows(step, rowsRef.current).filter(r => !planned.some(p => p.workoutExerciseId === r.workoutExerciseId && p.setNumber === r.setNumber)); void commitRows([...planned, ...skipRows(extra)]); }} onSave={() => void commitRows(stepRows(step, rowsRef.current).map(r => ({ ...r, done: !r.skipped })))} onSkip={() => void commitRows(skipRows(stepRows(step, rowsRef.current)))}/>}
        <View style={styles.navigation}><Pressable accessibilityRole="button" disabled={busy || index === 0} onPress={() => move(index - 1)} style={[styles.navButton, index === 0 && styles.dim]}><Text style={styles.link}>PRÉCÉDENT</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={next} style={styles.navButton}><Text style={styles.link}>{index + 1 < steps.length ? 'SUIVANT' : 'VOIR LE BILAN'}</Text></Pressable></View>
      </> : <Card><Text style={styles.notes}>{withoutRpe(detail.session.workout_templates?.notes) || 'Aucun exercice prévu.'}</Text>{!readOnly ? <PrimaryButton label="TERMINER" disabled={busy} onPress={finish}/> : null}</Card>}
      {readOnly ? <PrimaryButton label="RETOUR AUX SÉANCES" onPress={() => router.replace('/(tabs)')}/> : null}
    </>}
    {busy ? <ActivityIndicator color={colors.yellow}/> : null}
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
  </ScreenScrollView>;
}
const styles = StyleSheet.create({ page: { padding: 20, paddingTop: 68, paddingBottom: 50 }, progress: { gap: 6, marginBottom: 12 }, progressText: { color: colors.muted, fontSize: 14 }, link: { color: colors.yellow, fontWeight: '800', fontSize: 13 }, navButton: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' }, heading: { color: colors.yellow, fontWeight: '900', fontSize: 14, marginVertical: 14 }, navigation: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginTop: 12 }, dim: { opacity: 0.3 }, overviewRow: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }, overviewName: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 24 }, status: { color: colors.muted, fontSize: 13 }, message: { color: colors.yellow, fontSize: 15, lineHeight: 22, marginVertical: 14 }, notes: { color: colors.text, fontSize: 15, lineHeight: 23 } });
