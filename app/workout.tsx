import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { completeWorkoutSession, getNextWorkoutSession, getSessionDetail, savePerformedSet, startWorkoutSession } from "@/src/lib/api";

type LocalSet = {
  prescribedId?: string | null;
  workoutExerciseId: string;
  setNumber: number;
  reps: string;
  load: string;
  rpe: string;
  done: boolean;
};


function cleanExercisePrescription(
  notes?: string | null,
  block?: string
) {
  let value = (notes ?? "").trim();

  if (!value) return "";

  // Retire le nom du bloc répété dans chaque exercice
  value = value.replace(
    /^(WARM\s*UP|STRENGTH\s*WORK|RENFO|WOD)\s*[—–-]?\s*/i,
    ""
  );

  // Dans les blocs en rounds, le nombre est déjà affiché dans l'en-tête
  if (block === "WARM UP" || block === "WOD") {
    value = value.replace(
      /^\d+\s*(?:ROUNDS?|TOURS?)\s*[—–-]?\s*/i,
      ""
    );
  }

  return value.trim();
}

function exerciseDisplayLine(
  name?: string | null,
  notes?: string | null,
  block?: string
) {
  const exerciseName = (name ?? "Exercice").trim();
  const prescription = cleanExercisePrescription(notes, block);

  return prescription
    ? `${exerciseName} — ${prescription}`
    : exerciseName;
}

function buildFallbackSets(we: any): LocalSet[] {
  const notes = [
    we?.prescription_notes,
    we?.exercises?.instructions,
  ]
    .filter(Boolean)
    .join(" — ")
    .trim();

  // Même sans prescription structurée :
  // chaque exercice doit avoir au minimum une ligne de suivi.
  if (!notes) {
    return [{
      prescribedId: null,
      workoutExerciseId: we.id,
      setNumber: 1,
      reps: "",
      load: "",
      rpe: "",
      done: false,
    }];
  }

  let setCount = 0;
  let reps = "";
  let load = "";
  let rpe = "";

  // 5x5 / 3x8-12 / 4×10
  const setRepMatch = notes.match(
    /(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/i
  );

  if (setRepMatch) {
    setCount = Number(setRepMatch[1]);
    const prescribedReps = setRepMatch[2].replace(/\s+/g, "");
    reps = /[-–]/.test(prescribedReps) ? "" : prescribedReps;
  }

  // 3 rounds — 10 reps
  if (!setCount) {
    const roundsMatch = notes.match(/(\d+)\s*(?:rounds?|tours?)/i);
    const repsMatch = notes.match(/(\d+)\s*reps?/i);

    if (roundsMatch) {
      setCount = Number(roundsMatch[1]);
      reps = repsMatch?.[1] ?? "";
    }
  }

  // 12 reps seules
  if (!setCount) {
    const simpleReps = notes.match(/(?:^|[—-]\s*)(\d+)\s*reps?/i);

    if (simpleReps) {
      setCount = 1;
      reps = simpleReps[1];
    }
  }

  // Charge en %
  const percentMatch = notes.match(
    /@\s*(\d+(?:[.,]\d+)?)\s*%/i
  );

  if (percentMatch) {
    // Le pourcentage reste visible dans la prescription.
    // L'athlète saisit ici la charge réellement utilisée en kg.
    load = "";
  } else {
    // Charge en kg
    const kgMatch = notes.match(
      /@\s*(\d+(?:[.,]\d+)?)\s*kg/i
    );

    if (kgMatch) {
      load = kgMatch[1].replace(",", ".");
    }
  }

  // RPE seulement s'il est prescrit
  const rpeMatch = notes.match(
    /\bRPE\s*[:@]?\s*(\d+(?:[.,]\d+)?)/i
  );

  if (rpeMatch) {
    rpe = rpeMatch[1].replace(",", ".");
  }

  if (!setCount) {
    return [{
      prescribedId: null,
      workoutExerciseId: we.id,
      setNumber: 1,
      reps: reps || "",
      load,
      rpe,
      done: false,
    }];
  }

  return Array.from({ length: setCount }, (_, index) => ({
    prescribedId: null,
    workoutExerciseId: we.id,
    setNumber: index + 1,
    reps,
    load,
    rpe,
    done: false,
  }));
}

function parsePerformedValues(item: LocalSet) {
  const repsRaw = String(item.reps).trim();

  let reps = 0;

  if (repsRaw) {
    if (!/^\d+$/.test(repsRaw)) {
      throw new Error(
        `Série ${item.setNumber} : indique un nombre entier de répétitions.`
      );
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
      throw new Error(
        `Série ${item.setNumber} : charge invalide.`
      );
    }

    loadKg = parsedLoad;
  }

  const rpeRaw = String(item.rpe).trim();

  let rpe: number | null = null;

  if (rpeRaw) {
    const parsedRpe = Number(rpeRaw.replace(",", "."));

    if (
      !Number.isFinite(parsedRpe) ||
      parsedRpe < 1 ||
      parsedRpe > 10
    ) {
      throw new Error(
        `Série ${item.setNumber} : le RPE doit être compris entre 1 et 10.`
      );
    }

    rpe = parsedRpe;
  }

  return {
    reps,
    load_kg: loadKg,
    rpe,
  };
}

export default function WorkoutScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [sets, setSets] = useState<Record<string, LocalSet[]>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }

    (async () => {
      const d = await getSessionDetail(sessionId);
      setDetail(d);

      const byExercise: Record<string, LocalSet[]> = {};
      for (const we of d.workoutExercises) {
          const prescribed = [...(we.prescribed_sets ?? [])].sort((a: any, b: any) => a.set_number - b.set_number);
          const fallback = buildFallbackSets(we);

          if (!prescribed.length) {
            byExercise[we.id] = fallback.map((row) => {
              const existing = d.performedSets.find((x: any) => x.workout_exercise_id === we.id && x.set_number === row.setNumber);

              return {
                ...row,
                reps: existing?.reps != null ? String(existing.reps) : row.reps,
                load: existing?.load_kg != null && Number(existing.load_kg) !== 0 ? String(existing.load_kg) : row.load,
                rpe: existing?.rpe != null ? String(existing.rpe) : row.rpe,
                done: existing?.completed ?? false,
              };
            });

            continue;
          }

          byExercise[we.id] = prescribed.map((ps: any) => {
            const existing = d.performedSets.find((x: any) => x.workout_exercise_id === we.id && x.set_number === ps.set_number);
            return {
              prescribedId: ps.id,
              workoutExerciseId: we.id,
              setNumber: ps.set_number,
              reps: existing?.reps != null ? String(existing.reps) : ps.target_reps != null ? String(ps.target_reps) : "",
              load:
                existing?.load_kg != null && Number(existing.load_kg) !== 0
                  ? String(existing.load_kg)
                  : ps.target_load_kg != null && Number(ps.target_load_kg) !== 0
                    ? String(ps.target_load_kg)
                    : "",
              rpe: existing?.rpe != null ? String(existing.rpe) : ps.target_rpe != null ? String(ps.target_rpe) : "",
              done: existing?.completed ?? false,
            };
          });
      }
      setSets(byExercise);

      if (d.session.status === "planned") await startWorkoutSession(sessionId);
    })().catch((e) => setMessage(e?.message ?? "Impossible de charger la séance"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function patch(exerciseId: string, setNumber: number, patch: Partial<LocalSet>) {
    setSets((current) => ({
      ...current,
      [exerciseId]: current[exerciseId].map((s) => s.setNumber === setNumber ? { ...s, ...patch } : s),
    }));
  }

  async function toggleDone(exerciseId: string, item: LocalSet) {
    const next = !item.done;
    patch(exerciseId, item.setNumber, { done: next });
    try {
      await savePerformedSet({
        workout_session_id: sessionId!,
        workout_exercise_id: exerciseId,
        prescribed_set_id: item.prescribedId,
        set_number: item.setNumber,
        ...parsePerformedValues(item),
        completed: next,
      });
    } catch (e: any) {
      patch(exerciseId, item.setNumber, { done: item.done });
      setMessage(e?.message ?? "Erreur d'enregistrement");
    }
  }

  function getTrackableSets() {
    const trackableExerciseIds = new Set(
      (detail?.workoutExercises ?? [])
        .filter((we: any) => {
          const notes = String(we?.prescription_notes ?? "")
            .trim()
            .toUpperCase();

          // Warm-up et WOD sont présentés sous forme de résumé :
          // ils ne bloquent donc pas la validation finale.
          return !notes.startsWith("WARM UP") && !notes.startsWith("WOD");
        })
        .map((we: any) => we.id)
    );

    return Object.values(sets)
      .flat()
      .filter((item) => trackableExerciseIds.has(item.workoutExerciseId));
  }

  async function finalizeWorkout() {
    const all = Object.values(sets).flat();

    setMessage("");

    // Étape 1 : sauvegarder toutes les séries avant de terminer la séance.
    try {
      await Promise.all(
        all.map((item) =>
          savePerformedSet({
            workout_session_id: sessionId!,
            workout_exercise_id: item.workoutExerciseId,
            prescribed_set_id: item.prescribedId,
            set_number: item.setNumber,
            ...parsePerformedValues(item),
            completed: item.done,
          })
        )
      );
    } catch (e: any) {
      console.error("SAVE WORKOUT SETS ERROR", e);
      setMessage(
        e?.message ??
          "Impossible d'enregistrer toutes les séries. La séance n'a pas été terminée."
      );
      return;
    }

    // Étape 2 : seulement après une sauvegarde réussie, terminer la séance.
    try {
      await completeWorkoutSession(sessionId!);
    } catch (e: any) {
      console.error("COMPLETE WORKOUT ERROR", e);
      setMessage(
        e?.message ??
          "Les séries sont enregistrées, mais la séance n'a pas pu être terminée."
      );
      return;
    }

    // Étape 3 : la séance est désormais terminée en base.
    // Une erreur de récupération/navigation ne doit plus être présentée
    // comme un échec de validation de la séance.
    try {
      const nextSession = await getNextWorkoutSession(sessionId!);

      if (nextSession?.id) {
        router.replace({
          pathname: "/workout",
          params: { sessionId: nextSession.id },
        });
      } else {
        router.replace("/(tabs)");
      }
    } catch (e) {
      console.error("POST WORKOUT NAVIGATION ERROR", e);
      router.replace("/(tabs)");
    }
  }

  function finish() {
    const trackable = getTrackableSets();
    const remaining = trackable.filter((item) => !item.done).length;

    if (remaining > 0) {
      Alert.alert(
        "Séance incomplète",
        `${remaining} ${
          remaining === 1 ? "série n'est pas validée" : "séries ne sont pas validées"
        }. Terminer quand même la séance ?`,
        [
          {
            text: "ANNULER",
            style: "cancel",
          },
          {
            text: "TERMINER QUAND MÊME",
            style: "destructive",
            onPress: () => {
              void finalizeWorkout();
            },
          },
        ]
      );

      return;
    }

    void finalizeWorkout();
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!sessionId || !detail) return <View style={styles.center}><Text style={styles.error}>{message || "Aucune séance sélectionnée."}</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader
        eyebrow="SÉANCE EN COURS"
        title={detail.session.workout_templates?.name ?? "Séance"}
        subtitle="Chaque série cochée est sauvegardée immédiatement."
      />

      {(() => {
        const blockOrder = ["WARM UP", "STRENGTH WORK", "RENFO", "WOD", "AUTRE"];

        const blockSubtitles: Record<string, string> = {
          "WARM UP": "Préparation / activation",
          "STRENGTH WORK": "Force principale",
          "RENFO": "Travail complémentaire",
          "WOD": "Conditionnement",
          "AUTRE": "Travail complémentaire",
        };

        const getBlock = (notes?: string) => {
          const value = (notes ?? "").trim().toUpperCase();

          if (value.startsWith("WARM UP")) return "WARM UP";
          if (value.startsWith("STRENGTH WORK")) return "STRENGTH WORK";
          if (value.startsWith("RENFO")) return "RENFO";
          if (value.startsWith("WOD")) return "WOD";

          return "AUTRE";
        };

        const grouped = detail.workoutExercises.reduce(
          (acc: Record<string, any[]>, exercise: any) => {
            const block = getBlock(exercise.prescription_notes);

            if (!acc[block]) acc[block] = [];
            acc[block].push(exercise);

            return acc;
          },
          {}
        );

        return blockOrder
          .filter((block) => grouped[block]?.length)
          .map((block) => (
            <View key={block} style={styles.trainingBlock}>
              {(block !== "WARM UP" && block !== "WOD") ? (
                <View style={styles.blockHeader}>
                  <View style={styles.blockAccent} />

                  <View style={styles.blockHeaderText}>
                    <Text style={styles.blockTitle}>{block}</Text>
                    <Text style={styles.blockSubtitle}>
                      {blockSubtitles[block]}
                    </Text>
                  </View>

                  <Text style={styles.blockCount}>
                    {grouped[block].length}
                  </Text>
                </View>
              ) : null}

              <View style={styles.blockContent}>
                {(block === "WARM UP" || block === "WOD") ? (
                  <Card style={styles.phaseSummaryCard}>
                    <Text style={styles.phaseSummaryTitle}>
                      {block}
                    </Text>

                    {(() => {
                      const roundValues = grouped[block]
                        .map((exercise: any) => {
                          const notes = String(
                            exercise.prescription_notes ?? ""
                          );

                          const match = notes.match(
                            /(\d+)\s*(?:ROUNDS?|TOURS?)/i
                          );

                          return match ? Number(match[1]) : null;
                        })
                        .filter((value: number | null) => value != null);

                      const blockRounds =
                        roundValues.length > 0 ? roundValues[0] : null;

                      return blockRounds ? (
                        <Text style={styles.phaseSummaryRounds}>
                          {blockRounds} {blockRounds === 1 ? "ROUND" : "ROUNDS"}
                        </Text>
                      ) : null;
                    })()}

                    <View style={styles.phaseSummaryList}>
                      {grouped[block].map((we: any) => (
                        <View
                          key={we.id}
                          style={styles.phaseSummaryExercise}
                        >
                          <Text style={styles.phaseSummaryLine}>
                                {exerciseDisplayLine(
                                  we.exercises?.name,
                                  we.prescription_notes,
                                  block
                                )}
                              </Text>

                          {we.exercises?.instructions ? (
                            <Text style={styles.phaseSummaryInstructions}>
                              {we.exercises.instructions}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : (
                  grouped[block].map((we: any) => (
                    <Card key={we.id} style={styles.exerciseCard}>
                      <Text style={styles.exerciseLine}>
                          {exerciseDisplayLine(
                            we.exercises?.name,
                            we.prescription_notes,
                            block
                          )}
                        </Text>

                      {(sets[we.id] ?? []).length > 0 && (
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHeaderText, styles.seriesHeader]}>
                            SÉRIE
                          </Text>
                          <Text style={[styles.tableHeaderText, styles.dataHeader]}>
                            REPS
                          </Text>
                          <Text style={[styles.tableHeaderText, styles.dataHeader]}>
                            POIDS
                          </Text>
                          <Text style={[styles.tableHeaderText, styles.dataHeader]}>
                            RPE
                          </Text>
                          <View style={styles.checkHeader}>
                            <Text style={styles.tableHeaderText}>OK</Text>
                          </View>
                        </View>
                      )}

                      {(sets[we.id] ?? []).map((item) => (
                        <View key={item.setNumber} style={styles.row}>
                          <Text style={styles.number}>{item.setNumber}</Text>

                          <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            value={String(item.reps)}
                            onChangeText={(v) =>
                              patch(we.id, item.setNumber, {
                                reps: v,
                              })
                            }
                          />

                          <TextInput
                            style={styles.input}
                            keyboardType="default"
                            value={String(item.load)}
                            onChangeText={(v) =>
                              patch(we.id, item.setNumber, {
                                load: v,
                              })
                            }
                          />

                          <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={String(item.rpe)}
                            onChangeText={(v) =>
                              patch(we.id, item.setNumber, {
                                rpe: v,
                              })
                            }
                          />

                          <Pressable
                            onPress={() => toggleDone(we.id, item)}
                            style={[
                              styles.check,
                              item.done && styles.done,
                            ]}
                          >
                            <Text style={styles.checkText}>
                              {item.done ? "✓" : ""}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </Card>
                  ))
                )}
              </View>
            </View>
          ));
      })()}

      <PrimaryButton label="VALIDER LA SÉANCE" onPress={finish} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  phaseSummaryLine: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "800",
  },

  exerciseLine: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    marginBottom: 14,
  },

  page: { padding: 20, paddingTop: 68, paddingBottom: 50, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", padding: 20 },
  trainingBlock: {
    marginBottom: 26,
  },

  blockHeader: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
  },

  blockAccent: {
    width: 5,
    alignSelf: "stretch",
    backgroundColor: colors.yellow,
    borderRadius: 3,
    marginRight: 14,
  },

  blockHeaderText: {
    flex: 1,
  },

  blockTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  blockSubtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },

  blockCount: {
    color: colors.yellow,
    fontSize: 26,
    fontWeight: "900",
  },

  blockContent: {
    paddingLeft: 8,
  },

  exerciseCard: {
    marginBottom: 12,
  },

  phaseSummaryCard: {
    marginBottom: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },

  phaseSummaryTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1,
  },

  phaseSummaryRounds: {
    color: colors.yellow,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 20,
  },

  phaseSummaryList: {
    gap: 18,
  },

  phaseSummaryExercise: {
    paddingVertical: 16,
  },

  phaseSummaryName: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },

  phaseSummaryPrescription: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 4,
  },

  phaseSummaryInstructions: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },

  exerciseName: { color: colors.text, fontSize: 21, fontWeight: "900" },
  muted: { color: colors.muted, marginTop: 5, marginBottom: 14 },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    marginBottom: 7,
  },

  tableHeaderText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  seriesHeader: {
    width: 42,
  },

  dataHeader: {
    flex: 1,
  },

  checkHeader: {
    width: 42,
    alignItems: "center",
  },

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
  done: { backgroundColor: colors.green, borderColor: colors.green },
  checkText: { color: "#111", fontSize: 20, fontWeight: "900" },
  message: { color: colors.yellow, textAlign: "center", marginTop: 12, fontWeight: "800" },
  error: { color: colors.red, textAlign: "center" },
});
