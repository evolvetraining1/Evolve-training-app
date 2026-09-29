import { ExerciseGroupHeader } from "@/src/components/exercise-group-header";
import { buildExerciseGroups, exercisePrescription } from "@/src/lib/exercise-groups";
import { workoutBlock } from "@/src/lib/wod";
import { ScreenScrollView } from "@/src/components/screen-scroll-view";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card, ScreenHeader, goBackOrReplace } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getCoachAthleteSessionDetail } from "@/src/lib/coachApi";

export default function CoachAthleteSessionScreen() {
  const { athleteId, workoutTemplateId } =
    useLocalSearchParams<{
      athleteId: string;
      workoutTemplateId: string;
      programId: string;
    }>();

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!athleteId || !workoutTemplateId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const result = await getCoachAthleteSessionDetail(
          athleteId,
          workoutTemplateId
        );

        setDetail(result);
      } catch (e: any) {
        setError(
          e?.message ?? "Impossible de charger le détail de la séance."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [athleteId, workoutTemplateId]);

  const blockOrder = ["WARM UP", "STRENGTH WORK", "RENFO", "WORKOUT", "WOD", "AUTRE"];

  const groupedExercises = (detail?.exercises ?? []).reduce(
    (grouped: Record<string, any[]>, exercise: any) => {
      const block = workoutBlock(exercise);

      if (!grouped[block]) grouped[block] = [];
      grouped[block].push(exercise);

      return grouped;
    },
    {}
  );

  const allExercises = detail?.exercises ?? [];
  const allPerformed = detail?.performedSets ?? [];

  const totalPrescribedSets = allExercises.reduce(
    (total: number, exercise: any) =>
      total + (exercise.prescribed_sets?.length ?? 0),
    0
  );

  const completedSets = allPerformed.filter(
    (set: any) => set.completed !== false
  ).length;

  const modifiedSets = allExercises.reduce(
    (total: number, exercise: any) => {
      const prescribedSets = exercise.prescribed_sets ?? [];

      const exercisePerformed = allPerformed
        .filter(
          (done: any) =>
            done.workout_exercise_id === exercise.id &&
            done.completed !== false
        )
        .slice()
        .sort(
          (a: any, b: any) =>
            Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
        );

      const hasPercentPrescription = /@?\s*\d+(?:[.,]\d+)?\s*%/.test(
        String(exercise.prescription_notes ?? "")
      );

      const referenceLoad =
        exercisePerformed.find((done: any) => done.load_kg != null)?.load_kg ??
        null;

      const changes = prescribedSets.filter((prescribed: any) => {
        const performed = allPerformed.find(
          (done: any) =>
            done.prescribed_set_id === prescribed.id ||
            (
              done.workout_exercise_id === exercise.id &&
              done.set_number === prescribed.set_number
            )
        );

        if (!performed) return false;

        const repsChanged =
          prescribed.target_reps != null &&
          performed.reps != null &&
          Number(prescribed.target_reps) !== Number(performed.reps);

        const loadChanged =
          prescribed.target_load_kg != null &&
          performed.load_kg != null &&
          Number(prescribed.target_load_kg) !== Number(performed.load_kg);

        const percentLoadChanged =
          prescribed.target_load_kg == null &&
          hasPercentPrescription &&
          referenceLoad != null &&
          performed.load_kg != null &&
          Number(performed.load_kg) !== Number(referenceLoad);

        return repsChanged || loadChanged || percentLoadChanged;
      }).length;

      return total + changes;
    },
    0
  );

  return (
    <ScreenScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => goBackOrReplace()} style={styles.backButton}>
        <Text style={styles.backText}>‹ RETOUR PROGRAMME</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="SUIVI SÉANCE"
        title={detail?.workout?.name ?? "Détail de la séance"}
        subtitle="Prescription et réalisation de l'athlète."
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Text style={styles.title}>PRESCRIPTION</Text>

          <Text
            style={{
              color:
                detail?.session?.status === "completed"
                  ? colors.green
                  : detail?.session
                  ? colors.yellow
                  : colors.muted,
              fontSize: 12,
              fontWeight: "900",
              letterSpacing: 1,
            }}
          >
            {detail?.session?.status === "completed"
              ? "TERMINÉE"
              : detail?.session
              ? "EN COURS"
              : "À FAIRE"}
          </Text>
        </View>

        {detail?.session ? (
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              fontWeight: "700",
              marginBottom: 14,
            }}
          >
            {completedSets}/{totalPrescribedSets} séries
            {totalPrescribedSets - completedSets > 0
              ? ` · ${totalPrescribedSets - completedSets} non réalisée${
                  totalPrescribedSets - completedSets > 1 ? "s" : ""
                }`
              : ""}
            {modifiedSets > 0
              ? ` · ${modifiedSets} modification${modifiedSets > 1 ? "s" : ""}`
              : ""}
          </Text>
        ) : null}

        {blockOrder
          .filter((block) => groupedExercises[block]?.length)
          .map((block) => {
            const items = groupedExercises[block];

            const rounds = items
              .map((item: any) => {
                const notes = String(item.prescription_notes ?? "");
                const match = notes.match(/(\d+)\s*(?:ROUNDS?|TOURS?)/i);
                return match ? Number(match[1]) : null;
              })
              .find((value: number | null) => value != null);

            return (
              <Card
                key={block}
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text
                  style={{
                    color: colors.yellow,
                    fontSize: 13,
                    fontWeight: "900",
                    letterSpacing: 1.2,
                  }}
                >
                  {block}
                </Text>

                {rounds ? (
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 15,
                      fontWeight: "800",
                      marginTop: 4,
                      marginBottom: 6,
                    }}
                  >
                    {rounds} ROUNDS
                  </Text>
                ) : null}

                <View style={{ marginTop: rounds ? 0 : 8 }}>
                  {buildExerciseGroups(items).map((group) => (
                    <View key={group.id} style={group.paired ? styles.supersetGroup : undefined}>
                      <ExerciseGroupHeader group={group} />
                      {group.items.map((item: any) => {
                        const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
                        const prescription = exercisePrescription(item);
                        return <View key={item.id} style={{ marginBottom: 12 }}>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                            {exercise?.name ?? "Exercice"}
                          </Text>
                          {prescription ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
                            {prescription}
                          </Text> : null}
                        </View>;
                      })}
                    </View>
                  ))}
                </View>

                {(() => {
                  const performedForBlock = items.flatMap((item: any) => {
                    const exercise = Array.isArray(item.exercises)
                      ? item.exercises[0]
                      : item.exercises;

                    const performed = allPerformed
                      .filter(
                        (done: any) =>
                          done.workout_exercise_id === item.id &&
                          done.completed !== false
                      )
                      .slice()
                      .sort(
                        (a: any, b: any) =>
                          Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
                      );

                    if (!performed.length) return [];

                    const name = String(
                      exercise?.name ?? "Exercice"
                    ).trim();

                    const same =
                      performed.length > 0 &&
                      performed.every(
                        (set: any) =>
                          Number(set.reps ?? 0) ===
                            Number(performed[0]?.reps ?? 0) &&
                          Number(set.load_kg ?? 0) ===
                            Number(performed[0]?.load_kg ?? 0)
                      );

                    let value = "";

                    if (same) {
                      const first = performed[0];

                      const parts = [
                        first?.reps != null
                          ? `${performed.length} × ${first.reps}`
                          : `${performed.length} série${
                              performed.length > 1 ? "s" : ""
                            }`,
                        first?.load_kg != null
                          ? `@ ${first.load_kg} kg`
                          : null,
                      ].filter(Boolean);

                      value = parts.join(" ");
                    } else {
                      value = performed
                        .map((set: any) => {
                          const parts = [
                            `S${set.set_number ?? "?"}`,
                            set.reps != null ? `${set.reps} reps` : null,
                            set.load_kg != null ? `@ ${set.load_kg} kg` : null,
                          ].filter(Boolean);

                          return parts.join(" ");
                        })
                        .join(" · ");
                    }

                    return [{ name, value }];
                  });

                  if (!performedForBlock.length) return null;

                  return (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: colors.borderSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.green,
                          fontSize: 10,
                          fontWeight: "800",
                          letterSpacing: 1.1,
                          marginBottom: 6,
                        }}
                      >
                        RÉALISÉ
                      </Text>

                      {performedForBlock.map(
                        (performed: any, performedIndex: number) => (
                          <Text
                            key={`${performed.name}-${performedIndex}`}
                            style={{
                              color: colors.text,
                              fontSize: 13,
                              lineHeight: 21,
                              fontWeight: "700",
                            }}
                          >
                            {performed.name}
                            {performed.value
                              ? ` — ${performed.value}`
                              : ""}
                          </Text>
                        )
                      )}
                    </View>
                  );
                })()}
              </Card>
            );
          })}
      </View>

    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  supersetGroup: { borderWidth: 1, borderColor: colors.yellow, borderRadius: 14, padding: 12, marginTop: 10, marginBottom: 10 },
  page: {
    padding: 20,
    paddingTop: 64,
    paddingBottom: 100,
    backgroundColor: "transparent",
  },

  backButton: {
    marginBottom: 18,
  },

  backText: {
    color: colors.yellow,
    fontSize: 13,
    fontWeight: "900",
  },

  loading: {
    paddingVertical: 30,
    alignItems: "center",
  },

  error: {
    color: colors.red,
    marginBottom: 14,
    fontWeight: "700",
  },

  section: {
    marginBottom: 14,
  },

  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  muted: {
    color: colors.muted,
    marginTop: 6,
  },

});
