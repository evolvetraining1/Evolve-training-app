import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { completeWorkoutSession, getSessionDetail, savePerformedSet, startWorkoutSession } from "@/src/lib/api";

type LocalSet = {
  prescribedId?: string | null;
  workoutExerciseId: string;
  setNumber: number;
  reps: string;
  load: string;
  rpe: string;
  done: boolean;
};

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
        byExercise[we.id] = prescribed.map((ps: any) => {
          const existing = d.performedSets.find((x: any) => x.workout_exercise_id === we.id && x.set_number === ps.set_number);
          return {
            prescribedId: ps.id,
            workoutExerciseId: we.id,
            setNumber: ps.set_number,
            reps: existing?.reps != null ? String(existing.reps) : ps.target_reps != null ? String(ps.target_reps) : "",
            load: existing?.load_kg != null ? String(existing.load_kg) : ps.target_load_kg != null ? String(ps.target_load_kg) : "",
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
        reps: Number(String(item.reps).replace(",", ".")) || 0,
        load_kg: String(item.load).includes("%") ? 0 : (Number(String(item.load).replace(",", ".")) || 0),
        rpe: String(item.rpe).trim() ? Number(String(item.rpe).replace(",", ".")) : null,
        completed: next,
      });
    } catch (e: any) {
      patch(exerciseId, item.setNumber, { done: item.done });
      setMessage(e?.message ?? "Erreur d'enregistrement");
    }
  }

  async function finish() {
    const all = Object.values(sets).flat();
    if (!all.length || !all.every((s) => s.done)) {
      setMessage("Valide toutes les séries avant de terminer.");
      return;
    }
    await completeWorkoutSession(sessionId!);
    router.replace("/(tabs)/stats");
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

              <View style={styles.blockContent}>
                {grouped[block].map((we: any) => (
                  <Card key={we.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseName}>
                      {we.exercises?.name ?? "Exercice"}
                    </Text>

                    <Text style={styles.muted}>
                      {we.prescription_notes ?? ""}
                    </Text>

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
                          keyboardType="decimal-pad"
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
                ))}
              </View>
            </View>
          ));
      })()}

      <PrimaryButton label="TERMINER LA SÉANCE" onPress={finish} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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

  exerciseName: { color: colors.text, fontSize: 21, fontWeight: "900" },
  muted: { color: colors.muted, marginTop: 5, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
  number: { width: 24, color: colors.text, fontWeight: "900", textAlign: "center" },
  input: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, paddingVertical: 10, textAlign: "center", fontWeight: "800" },
  check: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  done: { backgroundColor: colors.green, borderColor: colors.green },
  checkText: { color: "#111", fontSize: 20, fontWeight: "900" },
  message: { color: colors.yellow, textAlign: "center", marginTop: 12, fontWeight: "800" },
  error: { color: colors.red, textAlign: "center" },
});
