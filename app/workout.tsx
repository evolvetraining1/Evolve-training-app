import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BackScreenHeader, Card, PrimaryButton } from "@/src/components/ui";
import { colors } from "@/src/theme";
import {
  completeWorkoutSession,
  getNextWorkoutSession,
  getSessionDetail,
  savePerformedSet,
  startWorkoutSession,
} from "@/src/lib/api";

type WorkoutBlock = "WARM UP" | "STRENGTH WORK" | "RENFO" | "WORKOUT" | "WOD" | "AUTRE";

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

function workoutBlock(item: any): WorkoutBlock {
  const value = String(item?.prescription_notes ?? "").trim().toUpperCase();

  if (value.startsWith("WARM UP") || value.startsWith("WARM-UP")) return "WARM UP";
  if (value.startsWith("STRENGTH WORK") || value.startsWith("STRENGTH")) return "STRENGTH WORK";
  if (value.startsWith("RENFO")) return "RENFO";
  if (value.startsWith("WORKOUT")) return "WORKOUT";
  if (value.startsWith("WOD")) return "WOD";
  return "AUTRE";
}

function isSimpleCompletionBlock(block: WorkoutBlock) {
  return block === "WARM UP" || block === "WOD";
}

function cleanExercisePrescription(notes?: string | null, block?: WorkoutBlock) {
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

function exerciseDisplayLine(item: any, block: WorkoutBlock) {
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
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [sets, setSets] = useState<Record<string, LocalSet[]>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const d = await getSessionDetail(sessionId);
      if (cancelled) return;

      setDetail(d);

      const performedByExerciseAndSet = new Map<string, any>(
        (d.performedSets ?? []).map((item: any) => [
          `${item.workout_exercise_id}:${item.set_number}`,
          item,
        ])
      );

      const byExercise: Record<string, LocalSet[]> = {};

      for (const item of d.workoutExercises ?? []) {
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
            reps: existing?.reps != null ? String(existing.reps) : row.reps,
            load:
              existing?.load_kg != null && Number(existing.load_kg) !== 0
                ? String(existing.load_kg)
                : row.load,
            rpe: existing?.rpe != null ? String(existing.rpe) : row.rpe,
            done: existing?.completed ?? false,
          };
        });
      }

      setSets(byExercise);

      if (d.session.status === "planned") {
        await startWorkoutSession(sessionId);
      }
    })()
      .catch((e: any) => {
        if (!cancelled) setMessage(e?.message ?? "Impossible de charger la séance");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const groupedExercises = useMemo(() => {
    const grouped: Record<WorkoutBlock, any[]> = {
      "WARM UP": [],
      "STRENGTH WORK": [],
      RENFO: [],
      WORKOUT: [],
      WOD: [],
      AUTRE: [],
    };

    for (const item of detail?.workoutExercises ?? []) {
      grouped[workoutBlock(item)].push(item);
    }

    return grouped;
  }, [detail]);

  function patch(exerciseId: string, setNumber: number, values: Partial<LocalSet>) {
    setSets((current) => ({
      ...current,
      [exerciseId]: (current[exerciseId] ?? []).map((item) =>
        item.setNumber === setNumber ? { ...item, ...values } : item
      ),
    }));
  }

  async function toggleDone(exerciseId: string, item: LocalSet) {
    const next = !item.done;
    patch(exerciseId, item.setNumber, { done: next });

    try {
      await savePerformedSet({
        workout_session_id: sessionId!,
        workout_exercise_id: exerciseId,
        prescribed_set_id: item.simpleCompletion ? null : item.prescribedId,
        set_number: item.setNumber,
        ...parsePerformedValues(item),
        completed: next,
      });
    } catch (e: any) {
      patch(exerciseId, item.setNumber, { done: item.done });
      setMessage(e?.message ?? "Erreur d'enregistrement");
    }
  }

  async function finalizeWorkout() {
    const all = Object.values(sets).flat();
    setMessage("");

    try {
      await Promise.all(
        all.map((item) =>
          savePerformedSet({
            workout_session_id: sessionId!,
            workout_exercise_id: item.workoutExerciseId,
            prescribed_set_id: item.simpleCompletion ? null : item.prescribedId,
            set_number: item.setNumber,
            ...parsePerformedValues(item),
            completed: item.done,
          })
        )
      );
    } catch (e: any) {
      setMessage(
        e?.message ??
          "Impossible d'enregistrer toute la séance. La validation a été annulée."
      );
      return;
    }

    try {
      await completeWorkoutSession(sessionId!);
    } catch (e: any) {
      setMessage(
        e?.message ??
          "Les données sont enregistrées, mais la séance n'a pas pu être terminée."
      );
      return;
    }

    try {
      const nextSession = await getNextWorkoutSession(sessionId!);
      if (nextSession?.id) {
        router.replace({ pathname: "/workout", params: { sessionId: nextSession.id } });
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      router.replace("/(tabs)");
    }
  }

  function finish() {
    const all = Object.values(sets).flat();
    const remaining = all.filter((item) => !item.done).length;

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

  const blockOrder: WorkoutBlock[] = [
    "WARM UP",
    "STRENGTH WORK",
    "RENFO",
    "WORKOUT",
    "WOD",
    "AUTRE",
  ];

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <BackScreenHeader
        eyebrow="SÉANCE EN COURS"
        title={detail?.session?.workout_templates?.name ?? "Séance"}
        subtitle="Valide les éléments au fur et à mesure."
      />

      {loading ? (
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {!loading && detail
        ? blockOrder
            .filter((block) => groupedExercises[block].length > 0)
            .map((block) => {
              const items = groupedExercises[block];
              const simple = isSimpleCompletionBlock(block);
              const rounds = simple ? parseRounds(items) : null;

              if (simple) {
                return (
                  <Card key={block} style={styles.simpleBlock}>
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
                <View key={block} style={styles.trainingBlock}>
                  <View style={styles.blockHeader}>
                    <View style={styles.blockAccent} />
                    <Text style={styles.blockTitle}>{block}</Text>
                  </View>

                  {items.map((item: any) => (
                    <Card key={item.id} style={styles.exerciseCard}>
                      <Text style={styles.exerciseLine}>
                        {exerciseDisplayLine(item, block)}
                      </Text>

                      {(sets[item.id] ?? []).length ? (
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
                        <View key={set.setNumber} style={styles.row}>
                          <Text style={styles.number}>{set.setNumber}</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            value={set.reps}
                            onChangeText={(value) => patch(item.id, set.setNumber, { reps: value })}
                          />
                          <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={set.load}
                            onChangeText={(value) => patch(item.id, set.setNumber, { load: value })}
                          />
                          <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={set.rpe}
                            onChangeText={(value) => patch(item.id, set.setNumber, { rpe: value })}
                          />
                          <Pressable
                            onPress={() => toggleDone(item.id, set)}
                            style={[styles.check, set.done && styles.done]}
                          >
                            <Text style={styles.checkText}>{set.done ? "✓" : ""}</Text>
                          </Pressable>
                        </View>
                      ))}
                    </Card>
                  ))}
                </View>
              );
            })
        : null}

      {!loading && detail ? (
        <PrimaryButton label="VALIDER LA SÉANCE" onPress={finish} />
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
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
