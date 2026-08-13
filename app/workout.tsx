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
  reps: number;
  load: number;
  rpe: number;
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
            reps: existing?.reps ?? ps.target_reps ?? 0,
            load: Number(existing?.load_kg ?? ps.target_load_kg ?? 0),
            rpe: Number(existing?.rpe ?? ps.target_rpe ?? 8),
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
        reps: item.reps,
        load_kg: item.load,
        rpe: item.rpe,
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

      {detail.workoutExercises.map((we: any) => (
        <Card key={we.id} style={{ marginBottom: 14 }}>
          <Text style={styles.exerciseName}>{we.exercises?.name ?? "Exercice"}</Text>
          <Text style={styles.muted}>{we.prescription_notes ?? ""}</Text>

          {(sets[we.id] ?? []).map((item) => (
            <View key={item.setNumber} style={styles.row}>
              <Text style={styles.number}>{item.setNumber}</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={String(item.reps)} onChangeText={(v) => patch(we.id, item.setNumber, { reps: Number(v || 0) })} />
              <TextInput style={styles.input} keyboardType="decimal-pad" value={String(item.load)} onChangeText={(v) => patch(we.id, item.setNumber, { load: Number(v.replace(",", ".") || 0) })} />
              <TextInput style={styles.input} keyboardType="decimal-pad" value={String(item.rpe)} onChangeText={(v) => patch(we.id, item.setNumber, { rpe: Number(v.replace(",", ".") || 0) })} />
              <Pressable onPress={() => toggleDone(we.id, item)} style={[styles.check, item.done && styles.done]}>
                <Text style={styles.checkText}>{item.done ? "✓" : ""}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ))}

      <PrimaryButton label="TERMINER LA SÉANCE" onPress={finish} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 50, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 20 },
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
