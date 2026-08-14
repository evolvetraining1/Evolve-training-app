
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "@/src/theme";
import { getWorkoutTemplateDetail } from "@/src/lib/api";

function displaySet(set: any) {
  const parts: string[] = [];

  if (set.target_reps != null) {
    parts.push(`${set.target_reps} reps`);
  }

  if (set.target_load_kg != null) {
    parts.push(`${set.target_load_kg} kg`);
  }

  if (set.target_rpe != null) {
    parts.push(`RPE ${set.target_rpe}`);
  }

  if (set.target_rir != null) {
    parts.push(`RIR ${set.target_rir}`);
  }

  if (set.rest_seconds != null) {
    parts.push(`Repos ${set.rest_seconds}s`);
  }

  return parts.length ? parts.join(" • ") : "Prescription libre";
}

export default function ProgramWorkoutScreen() {
  const { workoutId } =
    useLocalSearchParams<{ workoutId: string }>();

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workoutId) {
      setError("Séance introuvable.");
      setLoading(false);
      return;
    }

    getWorkoutTemplateDetail(String(workoutId))
      .then((data) => {
        setWorkout(data.workout);
        setItems(data.workoutExercises ?? []);
      })
      .catch((e: any) => {
        setError(e?.message ?? "Impossible de charger la séance.");
      })
      .finally(() => setLoading(false));
  }, [workoutId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
    >
      <Text style={styles.back} onPress={() => router.back()}>
        ‹ Retour
      </Text>

      <Text style={styles.kicker}>
        SEMAINE {workout?.week_number ?? "—"} · JOUR{" "}
        {workout?.day_number ?? "—"}
      </Text>

      <Text style={styles.title}>
        {workout?.name ?? "Séance"}
      </Text>

      <Text style={styles.meta}>
        {workout?.estimated_minutes
          ? `≈ ${workout.estimated_minutes} min`
          : "Durée libre"}
      </Text>

      {workout?.notes ? (
        <View style={styles.notesCard}>
          <Text style={styles.notes}>{workout.notes}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>EXERCICES</Text>

      {items.map((item, index) => {
        const exercise = Array.isArray(item.exercises)
          ? item.exercises[0]
          : item.exercises;

        return (
          <View key={item.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.number}>{index + 1}</Text>

              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>
                  {exercise?.name ?? "Exercice"}
                </Text>

                {exercise?.category ? (
                  <Text style={styles.category}>
                    {exercise.category}
                  </Text>
                ) : null}
              </View>
            </View>

            {item.prescription_notes ? (
              <Text style={styles.prescription}>
                {item.prescription_notes}
              </Text>
            ) : null}

            {exercise?.instructions ? (
              <Text style={styles.instructions}>
                {exercise.instructions}
              </Text>
            ) : null}

            {(item.prescribed_sets ?? []).map((set: any) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setNumber}>
                  SÉRIE {set.set_number ?? "—"}
                </Text>
                <Text style={styles.setText}>
                  {displaySet(set)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      {!error && items.length === 0 ? (
        <Text style={styles.empty}>
          Aucun exercice renseigné pour cette séance.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  page: {
    paddingHorizontal: 26,
    paddingTop: 52,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    color: colors.yellow,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 25,
  },
  kicker: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    marginTop: 9,
  },
  meta: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 9,
  },
  notesCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 17,
    marginTop: 22,
  },
  notes: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 30,
    marginBottom: 14,
  },
  exerciseCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 18,
    marginBottom: 15,
  },
  exerciseHeader: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
  },
  number: {
    width: 38,
    height: 38,
    lineHeight: 38,
    textAlign: "center",
    borderRadius: 10,
    backgroundColor: colors.yellow,
    color: "#080808",
    fontWeight: "900",
  },
  exerciseName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  category: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  prescription: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 17,
  },
  instructions: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 10,
  },
  setRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  setNumber: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: "900",
  },
  setText: {
    color: colors.text,
    marginTop: 4,
  },
  empty: {
    color: colors.muted,
  },
  errorCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#241010",
    marginTop: 20,
  },
  errorText: {
    color: "#F5A299",
  },
});
