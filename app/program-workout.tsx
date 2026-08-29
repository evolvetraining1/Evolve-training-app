
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


function getPhase(notes?: string) {
  const value = (notes ?? "").trim().toUpperCase();

  if (value.startsWith("WARM UP")) return "WARM UP";
  if (value.startsWith("STRENGTH WORK")) return "STRENGTH WORK";
  if (value.startsWith("RENFO")) return "RENFO";
  if (value.startsWith("WOD")) return "WOD";

  return "AUTRE";
}

function getRounds(notes?: string) {
  const value = notes ?? "";

  const match =
    value.match(/(\d+)\s*(?:ROUNDS?|TOURS?)/i);

  return match ? Number(match[1]) : null;
}

function cleanPrescription(notes?: string) {
  let value = (notes ?? "").trim();

  value = value
    .replace(/^WARM\s*UP\s*[—–-]?\s*/i, "")
    .replace(/^STRENGTH\s*WORK\s*[—–-]?\s*/i, "")
    .replace(/^RENFO\s*[—–-]?\s*/i, "")
    .replace(/^WOD\s*[—–-]?\s*/i, "");

  // Retire le "3 rounds —" répété devant chaque exercice
  value = value.replace(
    /^\d+\s*(?:ROUNDS?|TOURS?)\s*[—–-]?\s*/i,
    ""
  );

  return value.trim();
}

function estimateWorkoutMinutes(items: any[], explicitMinutes?: number | null) {
  if (explicitMinutes && explicitMinutes > 0) {
    return Math.round(explicitMinutes);
  }

  let totalSeconds = 0;

  for (const item of items ?? []) {
    const notes = item.prescription_notes ?? "";
    const phase = getPhase(notes);
    const rounds = getRounds(notes) ?? 1;

    const sets = item.prescribed_sets ?? [];

    // Quand on a de vraies séries prescrites
    if (sets.length) {
      sets.forEach((set: any, index: number) => {
        const reps = Number(set.target_reps ?? 0);
        const rest = Number(set.rest_seconds ?? 0);

        // ~4 secondes par répétition en moyenne
        totalSeconds += reps > 0 ? reps * 4 : 35;

        // pas besoin d'ajouter tout le repos après la dernière série
        if (index < sets.length - 1) {
          totalSeconds += rest;
        }
      });

      // installation / transition exercice
      totalSeconds += 60;
      continue;
    }

    // Exercices exprimés en secondes
    const secMatch = notes.match(/(\d+)\s*sec/i);

    if (secMatch) {
      totalSeconds += Number(secMatch[1]) * rounds;
      totalSeconds += 20 * rounds;
      continue;
    }

    // Exercices exprimés en répétitions
    const repMatch = notes.match(/(\d+)\s*reps?/i);

    if (repMatch) {
      const reps = Number(repMatch[1]);
      totalSeconds += reps * 4 * rounds;
      totalSeconds += 20 * rounds;
      continue;
    }

    // fallback
    if (phase === "WOD") {
      totalSeconds += 90 * rounds;
    } else {
      totalSeconds += 60 * rounds;
    }
  }

  // transitions entre blocs + marge réaliste
  totalSeconds += 6 * 60;

  const minutes = Math.ceil(totalSeconds / 60);

  // arrondi pratique par tranche de 5 min
  return Math.max(10, Math.ceil(minutes / 5) * 5);
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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>

        <Text
          style={styles.back}
          onPress={() => router.back()}
        >
          ← RETOUR
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
    >
      <Text style={styles.back} onPress={() => router.back()}>
        ← RETOUR
      </Text>

      <View style={styles.hero}>
        <Text style={styles.heroKicker}>
          SEMAINE {workout?.week_number ?? "—"} • JOUR {workout?.day_number ?? "—"}
        </Text>

        <Text style={styles.heroTitle}>
          {(workout?.name ?? "Séance").toUpperCase()}
        </Text>

        <View style={styles.heroAccent} />

        <Text style={styles.heroDuration}>
          Durée estimée :{" "}
          <Text style={styles.heroDurationValue}>
            ~{estimateWorkoutMinutes(
              items,
              workout?.estimated_minutes
            )} MIN
          </Text>
        </Text>
      </View>

      {(() => {
        const order = [
          "WARM UP",
          "STRENGTH WORK",
          "RENFO",
          "WOD",
          "AUTRE",
        ];

        const grouped = items.reduce(
          (acc: Record<string, any[]>, item: any) => {
            const block = getPhase(item.prescription_notes);

            if (!acc[block]) acc[block] = [];
            acc[block].push(item);

            return acc;
          },
          {}
        );

        return order
          .filter((block) => grouped[block]?.length)
          .map((block) => {
            const exercises = grouped[block];

            const roundValues = exercises
              .map((exercise: any) =>
                getRounds(exercise.prescription_notes)
              )
              .filter((value: number | null) => value != null);

            const rounds =
              roundValues.length > 0
                ? roundValues[0]
                : null;

            return (
              <View key={block} style={styles.phaseCard}>
                <Text style={styles.phaseTitle}>
                  {block}
                </Text>

                {rounds ? (
                  <Text style={styles.phaseRounds}>
                    {rounds} {rounds === 1 ? "ROUND" : "ROUNDS"}
                  </Text>
                ) : block === "STRENGTH WORK" ? (
                  <Text style={styles.phaseRounds}>
                    TRAVAIL DE FORCE
                  </Text>
                ) : null}

                <View style={styles.phaseDivider} />

                {exercises.map((item: any, index: number) => {
                  const exercise = Array.isArray(item.exercises)
                    ? item.exercises[0]
                    : item.exercises;

                  const prescription =
                    cleanPrescription(item.prescription_notes);

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.phaseExercise,
                        index !== exercises.length - 1 &&
                          styles.phaseExerciseBorder,
                      ]}
                    >
                      <View style={styles.phaseExerciseHeader}>
                        <View style={styles.phaseNumberBox}>
                          <Text style={styles.phaseExerciseNumber}>
                            {index + 1}
                          </Text>
                        </View>

                        <Text style={styles.phaseExerciseName}>
                          {exercise?.name ?? "Exercice"}
                        </Text>
                      </View>

                      {prescription ? (
                        <Text style={styles.phaseExercisePrescription}>
                          {prescription}
                        </Text>
                      ) : null}

                      {exercise?.instructions ? (
                        <Text style={styles.phaseExerciseInstructions}>
                          {exercise.instructions}
                        </Text>
                      ) : null}

                      {(item.prescribed_sets ?? []).map((set: any) => (
                        <View
                          key={set.id}
                          style={styles.phaseSetRow}
                        >
                          <Text style={styles.phaseSetNumber}>
                            S{set.set_number ?? ""}
                          </Text>

                          <Text style={styles.phaseSetText}>
                            {displaySet(set)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          });
      })()}

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
    paddingHorizontal: 24,
  },

  hero: {
    alignItems: "center",
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 34,
  },

  heroKicker: {
    color: colors.yellow,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },

  heroTitle: {
    color: colors.text,
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 8,
  },

  heroAccent: {
    width: 82,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.yellow,
    marginTop: 14,
    marginBottom: 12,
  },

  heroDuration: {
    color: colors.muted,
    fontSize: 16,
    textAlign: "center",
  },

  heroDurationValue: {
    color: colors.yellow,
    fontWeight: "900",
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
  phaseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
  },

  phaseTitle: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },

  phaseRounds: {
    color: colors.yellow,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: 7,
  },

  phaseDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 18,
  },

  phaseExercise: {
    paddingVertical: 16,
  },

  phaseExerciseBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  phaseExerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  phaseNumberBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  phaseExerciseNumber: {
    color: colors.yellow,
    fontSize: 18,
    fontWeight: "900",
    width: 28,
  },

  phaseExerciseName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    flex: 1,
  },

  phaseExercisePrescription: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    marginLeft: 40,
  },

  phaseExerciseInstructions: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginLeft: 40,
  },

  phaseSetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginLeft: 40,
    paddingVertical: 8,
  },

  phaseSetNumber: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },

  phaseSetText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
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
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
  },
});
