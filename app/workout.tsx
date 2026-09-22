import { WorkoutSetRow } from "@/src/components/workout-set-row";
import { compactFields } from "@/src/lib/screen-layout";
import { ScreenScrollView } from "@/src/components/screen-scroll-view";
import { useEffect, useMemo, useState, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BackScreenHeader, Card, PrimaryButton } from "@/src/components/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isFinishedSession } from "@/src/lib/session-flow";
import { WodCard } from "@/src/components/WodCard";
import { buildWorkoutSections, workoutBlock, serializeWod, restoreWod, type WodDraft, type WorkoutSection } from "@/src/lib/wod";
import { colors } from "@/src/theme";
import {
  completeWorkoutSession,
  getSessionDetail,
  savePerformedSet,
  startWorkoutSession,
} from "@/src/lib/api";

type LocalSet = {
  prescribedId?: string | null;
  workoutExerciseId: string;
  setNumber: number;
  reps: string;
  load: string;
  rpe: string;
  done: boolean;
  simpleCompletion?: boolean;
};

function exerciseData(item: any) {
  return Array.isArray(item?.exercises) ? item.exercises[0] : item?.exercises;
}

function isSimpleCompletionBlock(block: string) {
  return block === "WARM UP" || block === "WOD";
}

function cleanExercisePrescription(notes?: string | null, block?: string) {
  let value = String(notes ?? "").trim();
  if (!value) return "";

  value = value.replace(
    /^(WARM\s*[- ]?UP|STRENGTH\s*WORK|STRENGTH|RENFO|WORKOUT|WOD)\s*[—–:-]?\s*/i,
    ""
  );

  if (block === "WARM UP" || block === "WOD") {
    value = value.replace(/^\d+\s*(?:ROUNDS?|TOURS?)\s*[—–:-]?\s*/i, "");
  }

  return value.trim();
}

function exerciseDisplayLine(item: any, block: string) {
  const exercise = exerciseData(item);
  const name = String(exercise?.name ?? "Exercice").trim();
  const prescription = cleanExercisePrescription(item?.prescription_notes, block);
  return prescription ? `${name} — ${prescription}` : name;
}

function parseRounds(items: any[]) {
  for (const item of items) {
    const notes = String(item?.prescription_notes ?? "");
    const match = notes.match(/(\d+)\s*(?:ROUNDS?|TOURS?)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function buildFallbackSets(item: any): LocalSet[] {
  const exercise = exerciseData(item);
  const notes = [item?.prescription_notes, exercise?.instructions]
    .filter(Boolean)
    .join(" — ")
    .trim();

  let setCount = 1;
  let reps = "";
  let load = "";
  let rpe = "";

  const setRepMatch = notes.match(/(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
  if (setRepMatch) {
    setCount = Math.max(1, Number(setRepMatch[1]));
    const prescribedReps = setRepMatch[2].replace(/\s+/g, "");
    reps = /[-–]/.test(prescribedReps) ? "" : prescribedReps;
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

function parsePerformedValues(item: LocalSet) {
  if (item.simpleCompletion) {
    return { reps: 0, load_kg: 0, rpe: null as number | null };
  }

  const repsRaw = String(item.reps).trim();
  let reps = 0;

  if (repsRaw) {
    if (!/^\d+$/.test(repsRaw)) {
      throw new Error(`Série ${item.setNumber} : indique un nombre entier de répétitions.`);
    }
    reps = Number(repsRaw);
    if (!Number.isSafeInteger(reps) || reps > 2147483647) throw new Error("Nombre de répétitions trop élevé.");
  }

  const loadRaw = String(item.load).trim();
  let loadKg = 0;

  if (loadRaw) {
    if (loadRaw.includes("%")) {
      throw new Error(
        `Série ${item.setNumber} : remplace le pourcentage par la charge réellement utilisée en kg.`
      );
    }

    const parsedLoad = Number(loadRaw.replace(",", "."));
    if (!Number.isFinite(parsedLoad) || parsedLoad < 0) {
      throw new Error(`Série ${item.setNumber} : charge invalide.`);
    }
    loadKg = parsedLoad;
  }

  const rpeRaw = String(item.rpe).trim();
  let rpe: number | null = null;

  if (rpeRaw) {
    const parsedRpe = Number(rpeRaw.replace(",", "."));
    if (!Number.isFinite(parsedRpe) || parsedRpe < 1 || parsedRpe > 10) {
      throw new Error(`Série ${item.setNumber} : le RPE doit être compris entre 1 et 10.`);
    }
    rpe = parsedRpe;
  }

  return { reps, load_kg: loadKg, rpe };
}

export default function WorkoutScreen() {
  const { width, fontScale } = useWindowDimensions();
  const compact = compactFields(width, fontScale);
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [sets, setSets] = useState<Record<string, LocalSet[]>>({});
  const [wods, setWods] = useState<Record<string, WodDraft>>({});
  const wodsRef = useRef<Record<string, WodDraft>>({});
  const activeSession = useRef(sessionId);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const pending = useRef(new Set<string>());
  const finishing = useRef(false);
  const setsRef = useRef<Record<string, LocalSet[]>>({});
  const draftQueue = useRef(Promise.resolve());
  const readOnly = isFinishedSession(detail?.session);
  const draftKey = `evolve-session-draft:${sessionId}`;


  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    activeSession.current = sessionId;
    pending.current.clear();
    finishing.current = false;
    setPendingCount(0);
    setSaving(false);
    setLoading(true);
    setDetail(null);
    setSets({});
    setWods({});
    wodsRef.current = {};
    setsRef.current = {};
    setMessage("");

    (async () => {
      let d = await getSessionDetail(sessionId);
      if (cancelled) return;

      if (d.session.status === "planned") {
        d.session = { ...d.session, ...await startWorkoutSession(sessionId) };
        if (isFinishedSession(d.session)) d = await getSessionDetail(sessionId);
      }
      if (cancelled) return;
      setDetail(d);

      const performedByExerciseAndSet = new Map<string, any>(
        (d.performedSets ?? []).map((item: any) => [
          `${item.workout_exercise_id}:${item.set_number}`,
          item,
        ])
      );

      const byExercise: Record<string, LocalSet[]> = {};

      const sections = buildWorkoutSections(d.workoutExercises, d.session.workout_templates);
      const scoredIds = new Set(sections.filter((section) => section.format && (!isFinishedSession(d.session) || d.session.wod_results?.[section.id])).flatMap((section) => section.items.map((item) => item.id)));
      const loadedWods: Record<string, WodDraft> = {};
      for (const section of sections) {
        const saved = d.session.wod_results?.[section.id];
        if (section.format) loadedWods[section.id] = saved ? restoreWod(saved) : {};
      }
      for (const item of d.workoutExercises ?? []) {
        if (scoredIds.has(item.id)) continue;
        const block = workoutBlock(item);

        if (isSimpleCompletionBlock(block)) {
          const existing = performedByExerciseAndSet.get(`${item.id}:1`);
          byExercise[item.id] = [
            {
              prescribedId: null,
              workoutExerciseId: item.id,
              setNumber: 1,
              reps: "",
              load: "",
              rpe: "",
              done: existing?.completed ?? false,
              simpleCompletion: true,
            },
          ];
          continue;
        }

        const prescribed = [...(item.prescribed_sets ?? [])].sort(
          (a: any, b: any) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
        );

        const rows: LocalSet[] = prescribed.length
          ? prescribed.map((ps: any) => ({
              prescribedId: ps.id,
              workoutExerciseId: item.id,
              setNumber: Number(ps.set_number ?? 1),
              reps: ps.target_reps != null ? String(ps.target_reps) : "",
              load:
                ps.target_load_kg != null && Number(ps.target_load_kg) !== 0
                  ? String(ps.target_load_kg)
                  : "",
              rpe: ps.target_rpe != null ? String(ps.target_rpe) : "",
              done: false,
            }))
          : buildFallbackSets(item);

        byExercise[item.id] = rows.map((row) => {
          const existing = performedByExerciseAndSet.get(`${item.id}:${row.setNumber}`);
          return {
            ...row,
            reps: existing ? (existing.reps == null ? "" : String(existing.reps)) : isFinishedSession(d.session) ? "" : row.reps,
            load:
              existing ? (existing.load_kg == null ? "" : String(existing.load_kg)) : isFinishedSession(d.session) ? "" : row.load,
            rpe: existing ? (existing.rpe == null ? "" : String(existing.rpe)) : isFinishedSession(d.session) ? "" : row.rpe,
            done: existing?.completed ?? false,
          };
        });
      }

      // Restore only matching rows, retaining the current prescription identity.
      await draftQueue.current;
      const rawDraft = await AsyncStorage.getItem(draftKey).catch(() => null);
      if (!isFinishedSession(d.session) && rawDraft) {
        try {
          const savedDraft = JSON.parse(rawDraft);
          const draft = savedDraft.sets ?? savedDraft;
          for (const section of sections.filter((section) => section.format)) {
            if (savedDraft.wods?.[section.id]) loadedWods[section.id] = savedDraft.wods[section.id];
          }
          for (const id of Object.keys(byExercise)) {
            byExercise[id] = byExercise[id].map((row) => {
              const saved = draft[id]?.find((v: LocalSet) => v.setNumber === row.setNumber);
              if (!saved) return row;
              const restored = { ...row, reps: String(saved.reps ?? row.reps), load: String(saved.load ?? row.load), rpe: String(saved.rpe ?? row.rpe) };
              if (restored.reps !== row.reps || restored.load !== row.load || restored.rpe !== row.rpe) restored.done = false;
              return restored;
            });
          }
        } catch { /* Ignore a corrupt device draft; server records remain intact. */ }
      }
      if (cancelled) return;
      wodsRef.current = loadedWods;
      setWods(loadedWods);
      setsRef.current = byExercise;
      setSets(byExercise);
    })()
      .catch((e: any) => {
        if (!cancelled) setMessage(e?.message ?? "Impossible de charger la séance");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (activeSession.current === sessionId) activeSession.current = undefined;
    };
  }, [sessionId]);

  const sections = useMemo(() => buildWorkoutSections(detail?.workoutExercises ?? [], detail?.session?.workout_templates), [detail]);

  function persistDraft() {
    const snapshot = JSON.stringify({ sets: setsRef.current, wods: wodsRef.current });
    draftQueue.current = draftQueue.current.then(() => AsyncStorage.setItem(draftKey, snapshot)).catch(() => {
      if (activeSession.current === sessionId) setMessage("Le brouillon n’a pas pu être conservé sur cet appareil. Valide la séance avant de quitter.");
    });
  }
  function patchWod(id: string, values: Partial<WodDraft>, validating = false) {
    if (readOnly || finishing.current) return;
    const next = { ...wodsRef.current, [id]: { ...wodsRef.current[id], ...values, ...(!validating ? { completed: false } : {}) } };
    wodsRef.current = next;
    setWods(next);
    persistDraft();
  }
  function validateWod(section: WorkoutSection) {
    try {
      const draft = { ...wodsRef.current[section.id], completed: !wodsRef.current[section.id]?.completed };
      serializeWod(section, draft);
      patchWod(section.id, draft, true);
      setMessage("");
    } catch (e: any) { setMessage(e.message); }
  }

  function patch(exerciseId: string, setNumber: number, values: Partial<LocalSet>) {
    if (readOnly || finishing.current) return;
    const next = {
      ...setsRef.current,
      [exerciseId]: (setsRef.current[exerciseId] ?? []).map((item) => item.setNumber === setNumber ? { ...item, ...values, ...(values.done == null ? { done: false } : {}) } : item),
    };
    setsRef.current = next;
    setSets(next);
    persistDraft();
  }

  async function toggleDone(exerciseId: string, item: LocalSet) {
    const key = `${exerciseId}:${item.setNumber}`;
    if (readOnly || finishing.current || pending.current.has(key)) return;
    const next = !item.done;
    pending.current.add(key);
    setPendingCount(pending.current.size);
    try {
      const parsed = parsePerformedValues(item);
      await savePerformedSet({
        workout_session_id: sessionId!, workout_exercise_id: exerciseId,
        prescribed_set_id: item.simpleCompletion ? null : item.prescribedId,
        set_number: item.setNumber, ...parsed, completed: next,
      });
      if (activeSession.current !== sessionId) return;
      patch(exerciseId, item.setNumber, { done: next });
      setMessage("");
    } catch (e: any) {
      if (activeSession.current === sessionId) setMessage(e?.message ?? "Erreur d’enregistrement. La série n’a pas été modifiée.");
    } finally {
      if (activeSession.current === sessionId) {
        pending.current.delete(key);
        setPendingCount(pending.current.size);
      }
    }
  }

  async function finalizeWorkout() {
    if (finishing.current || pending.current.size || readOnly || loading || !detail) return;
    finishing.current = true;
    setSaving(true);
    setMessage("");
    try {
      // Parse every input before sending one transactional request.
      const rows = Object.values(setsRef.current).flat().map((item) => ({
        workout_exercise_id: item.workoutExerciseId,
        prescribed_set_id: item.simpleCompletion ? null : item.prescribedId,
        set_number: item.setNumber, ...parsePerformedValues(item), completed: item.done,
      }));
      const results = Object.fromEntries(sections.filter((section) => section.format).map((section) => [section.id, serializeWod(section, wodsRef.current[section.id])]));
      await completeWorkoutSession(sessionId!, rows, undefined, results);
      await draftQueue.current;
      await AsyncStorage.removeItem(draftKey).catch(() => {});
      if (activeSession.current === sessionId) router.replace("/(tabs)");
    } catch (e: any) {
      if (activeSession.current === sessionId) setMessage(e?.message ?? "Validation impossible. Tes réponses restent disponibles ; réessaie.");
    } finally {
      if (activeSession.current === sessionId) {
        finishing.current = false;
        setSaving(false);
      }
    }
  }

  function finish() {
    if (detail && !detail.workoutExercises.length && !/\b(repos|récupération|recovery|rest)\b/i.test(`${detail.session.workout_templates?.name ?? ""} ${detail.session.workout_templates?.notes ?? ""}`)) {
      setMessage("Cette séance ne contient aucun exercice. Elle ne peut pas être validée tant que son contenu n’est pas renseigné.");
      return;
    }
    if (finishing.current || pending.current.size || readOnly || loading || !detail) return;
    const all = Object.values(setsRef.current).flat();
    const remaining = all.filter((item) => !item.done).length + sections.filter((section) => section.format && !wodsRef.current[section.id]?.completed).length;

    if (remaining > 0) {
      Alert.alert(
        "Séance incomplète",
        `${remaining} ${remaining === 1 ? "élément n'est pas validé" : "éléments ne sont pas validés"}. Terminer quand même ?`,
        [
          { text: "ANNULER", style: "cancel" },
          {
            text: "TERMINER QUAND MÊME",
            style: "destructive",
            onPress: () => void finalizeWorkout(),
          },
        ]
      );
      return;
    }

    void finalizeWorkout();
  }

  if (!loading && (!sessionId || !detail)) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{message || "Aucune séance sélectionnée."}</Text>
      </View>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <BackScreenHeader
        eyebrow={readOnly ? "HISTORIQUE DE SÉANCE" : "SÉANCE EN COURS"}
        title={detail?.session?.workout_templates?.name ?? "Séance"}
        subtitle={readOnly ? "Séance terminée · consultation des résultats." : "Valide tes séries et renseigne le résultat de chaque WOD."}
      />

      {loading ? (
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {!loading && detail?.session?.workout_templates?.notes ? (
        <Card style={styles.simpleBlock}>
          <Text style={styles.simpleLine}>
            {detail.session.workout_templates.notes}
          </Text>
          {detail.workoutExercises.length === 0 ? (
            <Text style={styles.simpleLine}>Aucun exercice prévu pour cette journée de récupération.</Text>
          ) : null}
        </Card>
      ) : null}

      {!loading && detail
        ? sections.map((section) => {
              const { block, items } = section;
              if (section.format && (!readOnly || detail.session.wod_results?.[section.id])) {
                return <WodCard key={section.id} section={section} value={wods[section.id] ?? {}} disabled={readOnly || saving || pendingCount > 0}
                  onChange={(patch) => patchWod(section.id, patch)} onValidate={() => validateWod(section)} />;
              }
              const simple = isSimpleCompletionBlock(block);
              const rounds = simple ? parseRounds(items) : null;

              if (simple) {
                return (
                  <Card key={section.id} style={styles.simpleBlock}>
                    <Text style={styles.simpleBlockTitle}>{block}</Text>
                    {rounds ? (
                      <Text style={styles.roundsText}>
                        {rounds} {rounds === 1 ? "ROUND" : "ROUNDS"}
                      </Text>
                    ) : null}

                    <View style={styles.simpleList}>
                      {items.map((item: any) => {
                        const tracker = sets[item.id]?.[0];
                        return (
                          <View key={item.id} style={styles.simpleRow}>
                            <Text style={styles.simpleLine}>
                              {exerciseDisplayLine(item, block)}
                            </Text>
                            {tracker ? (
                              <Pressable
                                disabled={readOnly || saving || pendingCount > 0}
                            onPress={() => toggleDone(item.id, tracker)}
                                style={[styles.check, tracker.done && styles.done]}
                              >
                                <Text style={styles.checkText}>{tracker.done ? "✓" : ""}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </Card>
                );
              }

              return (
                <View key={section.id} style={styles.trainingBlock}>
                  <View style={styles.blockHeader}>
                    <View style={styles.blockAccent} />
                    <Text style={styles.blockTitle}>{block}</Text>
                  </View>

                  {items.map((item: any) => (
                    <Card key={item.id} style={styles.exerciseCard}>
                      <Text style={styles.exerciseLine}>
                        {exerciseDisplayLine(item, block)}
                      </Text>

                      {!compact && (sets[item.id] ?? []).length ? (
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHeaderText, styles.seriesHeader]}>SÉRIE</Text>
                          <Text style={[styles.tableHeaderText, styles.dataHeader]}>REPS</Text>
                          <Text style={[styles.tableHeaderText, styles.dataHeader]}>POIDS</Text>
                          <Text style={[styles.tableHeaderText, styles.dataHeader]}>RPE</Text>
                          <View style={styles.checkHeader}>
                            <Text style={styles.tableHeaderText}>OK</Text>
                          </View>
                        </View>
                      ) : null}

                      {(sets[item.id] ?? []).map((set) => (
                        <WorkoutSetRow key={set.setNumber} number={set.setNumber} values={set}
                          done={set.done} disabled={readOnly || saving || pendingCount > 0}
                          onChange={(value) => patch(item.id, set.setNumber, value)}
                          onToggle={() => toggleDone(item.id, set)} />
                      ))}
                    </Card>
                  ))}
                </View>
              );
            })
        : null}

      {!loading && detail ? (
        readOnly ? <PrimaryButton label="RETOUR AUX SÉANCES" onPress={() => router.replace("/(tabs)")} /> :
        <PrimaryButton label={saving ? "ENREGISTREMENT…" : pendingCount ? "ENREGISTREMENT D’UNE SÉRIE…" : "VALIDER LA SÉANCE"} disabled={saving || pendingCount > 0} onPress={finish} />
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 68,
    paddingBottom: 50,
    backgroundColor: "transparent",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    padding: 20,
  },
  loadingInline: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  simpleBlock: {
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  simpleBlockTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  roundsText: {
    color: colors.yellow,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 12,
  },
  simpleList: {
    gap: 4,
  },
  simpleRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingVertical: 8,
  },
  simpleLine: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  trainingBlock: {
    marginBottom: 18,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  blockAccent: {
    width: 4,
    height: 24,
    backgroundColor: colors.yellow,
    borderRadius: 2,
    marginRight: 10,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  exerciseCard: {
    marginBottom: 10,
  },
  exerciseLine: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
    marginBottom: 7,
  },
  tableHeaderText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  seriesHeader: { width: 42 },
  dataHeader: { flex: 1 },
  checkHeader: { width: 42, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 9,
  },
  number: {
    width: 42,
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 42,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    textAlign: "center",
    fontWeight: "800",
    paddingHorizontal: 4,
  },
  check: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkText: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
  },
  message: {
    color: colors.yellow,
    textAlign: "center",
    marginTop: 12,
    fontWeight: "800",
  },
  error: {
    color: colors.red,
    textAlign: "center",
  },
});
