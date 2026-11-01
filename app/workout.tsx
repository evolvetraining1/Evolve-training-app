import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenScrollView } from '@/src/components/screen-scroll-view';
import { BackScreenHeader, PrimaryButton } from '@/src/components/ui';
import { AthleteExerciseCard } from '@/src/components/athlete-exercise-card';
import { WodCard } from '@/src/components/WodCard';
import { colors } from '@/src/theme';
import { isFinishedSession } from '@/src/lib/session-flow';
import { buildWorkoutSections, serializeWod, restoreWod, type WodDraft, type WodResult } from '@/src/lib/wod';
import { athleteSteps, asPlanned, parseAthleteSet, prescribedRows, restoreAthleteRow, skipRows, stepRows, stepStatus, summaryRows, withoutRpe, type AthleteSet, type AthleteStep } from '@/src/lib/athlete-workout';
import { completeWorkoutSession, getSessionDetail, getAthletePreviousSets, savePerformedSets, saveWorkoutWodResults, startWorkoutSession } from '@/src/lib/api';
const payload = (row: AthleteSet) => ({ workout_exercise_id: row.workoutExerciseId, prescribed_set_id: row.prescribedId, set_number: row.setNumber, ...parseAthleteSet(row), completed: row.done });
export default function WorkoutScreen() {
    const { sessionId } = useLocalSearchParams<{
        sessionId?: string;
    }>();
    const [loading, setLoading] = useState(true), [detail, setDetail] = useState<any>(null), [message, setMessage] = useState('');
    const [rows, setRows] = useState<Record<string, AthleteSet[]>>({}), rowsRef = useRef(rows), plans = useRef<Record<string, AthleteSet[]>>({});
    const [wods, setWods] = useState<Record<string, WodDraft>>({}), wodsRef = useRef(wods), savedWods = useRef<Record<string, WodResult>>({});
    const [previous, setPrevious] = useState<Record<string, string>>({});
    const [editing, setEditing] = useState<Record<string, boolean>>({});
    const [showNotes, setShowNotes] = useState(false);
    const [messageStep, setMessageStep] = useState<string | null>(null);
    const focus = useRef<string | undefined>(undefined), scrollY = useRef(0), restoreScroll = useRef(false);
    const [busy, setBusy] = useState(false), lock = useRef(false), active = useRef(sessionId), queue = useRef(Promise.resolve());
    const scroll = useRef<ScrollView>(null), [retry, setRetry] = useState(0);
    const readOnly = isFinishedSession(detail?.session), draftKey = `evolve-session-draft:${sessionId}`;
    const sections = useMemo(() => buildWorkoutSections(detail?.workoutExercises ?? [], detail?.session?.workout_templates), [detail]);
    const steps = useMemo(() => athleteSteps(sections, s => !readOnly || !!detail?.session?.wod_results?.[s.id]), [sections, readOnly, detail]);
    useEffect(() => {
        let cancelled = false;
        active.current = sessionId;
        lock.current = false;
        setBusy(false);
        setLoading(true);
        setDetail(null);
        setMessage('');
        setEditing({});
        setMessageStep(null);
        setShowNotes(false);
        focus.current = undefined;
        scrollY.current = 0;
        restoreScroll.current = false;
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
            let restoredFocus: string | undefined;
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
                    restoredFocus = localSteps.find(s => s.id === draft.activeStep)?.id;
                    scrollY.current = typeof draft.scrollY === 'number' && Number.isFinite(draft.scrollY) ? Math.max(0, draft.scrollY) : 0;
                    setEditing(Object.fromEntries(localSteps.map(s => [s.id, !!draft.editing?.[s.id]])));
                    restoreScroll.current = scrollY.current > 0;
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
            focus.current = restoredFocus;
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
    function persist(blockId = focus.current) {
        if (readOnly || !detail || active.current !== sessionId) return;
        focus.current = blockId;
        const snapshot = JSON.stringify({ sets: rowsRef.current, wods: wodsRef.current, activeStep: blockId, scrollY: scrollY.current, editing });
        queue.current = queue.current.then(() => AsyncStorage.setItem(draftKey, snapshot)).catch(() => { if (active.current === sessionId)
            setMessage('Le brouillon n’a pas pu être conservé. Valide tes résultats avant de quitter.'); });
    }
    function patch(id: string, nextRows: AthleteSet[]) {
        if (lock.current || readOnly)
            return;
        rowsRef.current = { ...rowsRef.current, [id]: nextRows.map(r => ({ ...r, done: false, dirty: true })) };
        setRows(rowsRef.current);
        persist();
    }
    async function commitRows(step: AthleteStep, nextRows: AthleteSet[]) {
        if (lock.current || readOnly || !sessionId || !step)
            return;
        setMessageStep(step.id);
        let parsed;
        try {
            const error = nextRows.find(r => r.inputError)?.inputError;
            if (error)
                throw new Error(error);
            parsed = nextRows.map(payload);
        }
        catch (e: any) {
            setEditing(v => ({ ...v, [step.id]: true }));
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
            persist(step.id);
            setEditing(v => ({ ...v, [step.id]: false }));
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
    function confirmCard(step: AthleteStep) {
        if (!step || lock.current || readOnly) return;
        const current = stepRows(step, rowsRef.current);
        // “Terminé” confirms the visible draft, including edits hidden by “Réduire”.
        // It must never silently replace actual results with the original targets.
        const edited = current.some(r => r.dirty || r.done);
        const planned = edited ? current.map(r => ({ ...r, done: !r.skipped })) : asPlanned(step, plans.current);
        const extra = current.filter(r => !planned.some(p => p.workoutExerciseId === r.workoutExerciseId && p.setNumber === r.setNumber));
        void commitRows(step, [...planned, ...skipRows(extra)]);
    }
    function edit(step: AthleteStep, value: boolean) {
        if (lock.current || readOnly) return;
        setEditing(v => ({ ...v, [step.id]: value }));
        setMessage('');
        focus.current = step.id;
    }
    function patchWod(step: AthleteStep, value: Partial<WodDraft>) {
        if (lock.current || readOnly) return;
        wodsRef.current = { ...wodsRef.current, [step.section.id]: { ...wodsRef.current[step.section.id], ...value, completed: false } };
        setWods(wodsRef.current);
        persist(step.id);
    }
    async function commitWod(step: AthleteStep, skipped = false) {
        if (lock.current || readOnly || !sessionId || !step)
            return;
        setMessageStep(step.id);
        const draft: WodDraft = skipped ? { completed: false, notes: 'Non réalisé' } : { ...wodsRef.current[step.section.id], completed: true };
        let score;
        try {
            score = serializeWod(step.section, draft);
        }
        catch (e: any) {
            setEditing(v => ({ ...v, [step.id]: true }));
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
            persist(step.id);
            setEditing(v => ({ ...v, [step.id]: false }));
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
        setMessageStep(null);
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
        setMessageStep(null);
        if (!detail.workoutExercises.length && !/\b(repos|récupération|recovery|rest)\b/i.test(`${detail.session.workout_templates?.name} ${detail.session.workout_templates?.notes}`)) {
            setMessage('Cette séance ne contient aucun exercice.');
            return;
        }
        const remaining = steps.filter(s => status(s) === 'pending').length;
        if (remaining) {
            Alert.alert('Résultats non confirmés', `${remaining} bloc(s) restent sans validation. Elles ne seront pas comptées comme réalisées. Terminer ?`, [{ text: 'REVENIR À LA SÉANCE', style: 'cancel' }, { text: 'TERMINER', onPress: () => void finalize() }]);
            return;
        }
        void finalize();
    }
    const template = detail?.session?.workout_templates;
    const metadata = [template?.week_number != null ? `S${template.week_number}` : '', template?.day_number != null ? `J${template.day_number}` : '', template?.estimated_minutes ? `≈ ${template.estimated_minutes} min` : ''].filter(Boolean).join(' · ');
    return <ScreenScrollView ref={scroll} style={styles.surface} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"
      scrollEventThrottle={100}
      onScroll={event => { if (!restoreScroll.current) scrollY.current = event.nativeEvent.contentOffset.y; }}
      onScrollEndDrag={() => { if (detail && !readOnly) persist(); }}
      onMomentumScrollEnd={() => { if (detail && !readOnly) persist(); }}
      onContentSizeChange={() => { if (!loading && detail && restoreScroll.current) { restoreScroll.current = false; scroll.current?.scrollTo({ y: scrollY.current, animated: false }); } }}>
      <BackScreenHeader compact eyebrow={readOnly ? 'HISTORIQUE' : 'SÉANCE EN COURS'} title={template?.name ?? 'Séance'} subtitle={metadata || undefined}/>
      {loading ? <ActivityIndicator color={colors.yellow} size="large"/> : !detail ? <PrimaryButton label="Réessayer" onPress={() => setRetry(n => n + 1)}/> : <>
        {steps.length > 0 ? <Text style={styles.progressText}>{steps.filter(s => status(s) !== 'pending').length} / {steps.length} blocs renseignés</Text> : null}
        {steps.length > 0 && template?.notes ? <View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showNotes }} onPress={() => setShowNotes(v => !v)} style={styles.noteToggle}>
            <Text style={styles.noteLink}>{showNotes ? 'Masquer les consignes' : 'Consignes du coach'}</Text>
          </Pressable>
          {showNotes ? <Text style={styles.notes}>{withoutRpe(template.notes)}</Text> : null}
        </View> : null}
        {steps.map((step, i) => <View key={step.id} style={styles.block}>
          {step.wod ? <WodCard section={step.section} value={wods[step.section.id] ?? {}} ordinal={i + 1}
            editing={!!editing[step.id]} readOnly={readOnly} disabled={busy || readOnly} navigationDisabled={busy}
            onEdit={value => edit(step, value)} onOpen={() => persist(step.id)}
            onChange={value => patchWod(step, value)} onValidate={() => void commitWod(step)} onSkip={() => void commitWod(step, true)}/> :
            <AthleteExerciseCard step={step} ordinal={i + 1} rows={rows} previous={previous} editing={!!editing[step.id]} disabled={busy} readOnly={readOnly}
              onEdit={value => edit(step, value)} onOpen={() => persist(step.id)} onPatch={patch} onPlanned={() => confirmCard(step)}
              onSave={() => void commitRows(step, stepRows(step, rowsRef.current).map(r => ({ ...r, done: !r.skipped })))}
              onSkip={() => void commitRows(step, skipRows(stepRows(step, rowsRef.current)))}/>}
          {message && messageStep === step.id ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
        </View>)}
        {!steps.length ? <Text style={styles.notes}>{withoutRpe(template?.notes) || 'Aucun exercice prévu.'}</Text> : null}
        {message && !messageStep ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
        {busy ? <ActivityIndicator color={colors.yellow}/> : null}
        <View style={styles.footer}>
          {readOnly ? <PrimaryButton compact label="Retour aux séances" onPress={() => router.replace('/(tabs)')}/> :
            <PrimaryButton compact label={busy ? 'Enregistrement…' : 'Terminer la séance'} disabled={busy} onPress={finish}/>}
        </View>
      </>}
      {!detail && message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </ScreenScrollView>;
}
const styles = StyleSheet.create({
    surface: { backgroundColor: colors.surface }, page: { padding: 20, paddingBottom: 40 },
    progressText: { color: colors.muted, fontSize: 13, marginBottom: 8 },
    block: { paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
    footer: { paddingTop: 24 }, noteToggle: { minHeight: 44, justifyContent: 'center' }, noteLink: { color: colors.muted, fontSize: 13 },
    message: { color: colors.yellow, fontSize: 14, lineHeight: 21, marginTop: 12 },
    notes: { color: colors.text, fontSize: 15, lineHeight: 23 }
});
