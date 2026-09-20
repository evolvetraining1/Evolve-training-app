import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card, ScreenHeader, goBackOrReplace } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getCoachAthleteSessionDetail } from "@/src/lib/coachApi";

export default function CoachAthleteSessionScreen() {
  const { athleteId, workoutTemplateId, programId } =
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

  const blockOrder = ["WARM UP", "STRENGTH WORK", "RENFO", "WOD", "AUTRE"];

  const blockSubtitles: Record<string, string> = {
    "WARM UP": "Préparation / activation",
    "STRENGTH WORK": "Force principale",
    "RENFO": "Travail complémentaire",
    "WOD": "Conditionnement",
    "AUTRE": "Travail complémentaire",
  };

  const groupedExercises = (detail?.exercises ?? []).reduce(
    (grouped: Record<string, any[]>, exercise: any) => {
      const value = String(exercise?.prescription_notes ?? "")
        .trim()
        .toUpperCase();

      const block =
        value.startsWith("WARM UP") || value.startsWith("WARMUP")
          ? "WARM UP"
          : value.startsWith("STRENGTH WORK") || value.startsWith("STRENGTH")
          ? "STRENGTH WORK"
          : value.startsWith("RENFO")
          ? "RENFO"
          : value.startsWith("WOD")
          ? "WOD"
          : "AUTRE";

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
    <ScrollView contentContainerStyle={styles.page}>
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
                  {items.map((item: any, index: number) => {
                    const exercise = Array.isArray(item.exercises)
                      ? item.exercises[0]
                      : item.exercises;

                    const name = String(
                      exercise?.name ?? `Exercice ${index + 1}`
                    ).trim();

                    const cleanNote = String(item.prescription_notes ?? "")
                      .replace(
                        /^(WARM\s*UP|WARMUP|STRENGTH\s*WORK|STRENGTH|RENFO|WOD)\s*[:\-–—]?\s*/i,
                        ""
                      )
                      .replace(
                        /^\d+\s*(ROUNDS?|TOURS?)\s*[:\-–—]?\s*/i,
                        ""
                      )
                      .trim();

                    const sets = item.prescribed_sets ?? [];
                    const firstSet = sets[0];

                    const repMatch = cleanNote.match(
                      /^(\d+(?:[.,]\d+)?)\s*(?:REPS?)\b/i
                    );

                    const distanceMatch = cleanNote.match(
                      /^(\d+(?:[.,]\d+)?\s*(?:M|KM))\b/i
                    );

                    const loadMatch = cleanNote.match(
                      /@\s*(\d+(?:[.,]\d+)?)\s*KG\b/i
                    );

                    const reps =
                      firstSet?.target_reps ??
                      (repMatch ? repMatch[1] : null);

                    const load =
                      firstSet?.target_load_kg ??
                      (loadMatch ? loadMatch[1] : null);

                    const noteHasName =
                      cleanNote &&
                      cleanNote.toLowerCase().includes(name.toLowerCase());

                    const compactLine = (() => {
                      if (noteHasName) return cleanNote;

                      if (distanceMatch) {
                        return `${distanceMatch[1]} ${name.toLowerCase()}`;
                      }

                      if (reps != null) {
                        return `${reps} ${name.toLowerCase()}${
                          load != null ? ` @ ${load} kg` : ""
                        }`;
                      }

                      if (cleanNote) {
                        return `${cleanNote} ${name.toLowerCase()}`;
                      }

                      return name;
                    })();

                    const same =
                      sets.length > 0 &&
                      sets.every(
                        (set: any) =>
                          set.target_reps === firstSet?.target_reps &&
                          set.target_load_kg === firstSet?.target_load_kg &&
                          set.target_rpe === firstSet?.target_rpe &&
                          set.target_rir === firstSet?.target_rir &&
                          set.rest_seconds === firstSet?.rest_seconds
                      );

                    const strengthFallback =
                      same && sets.length
                        ? [
                            firstSet?.target_reps != null
                              ? `${sets.length} × ${firstSet.target_reps}`
                              : null,
                            firstSet?.target_load_kg != null
                              ? `@ ${firstSet.target_load_kg} kg`
                              : null,
                            firstSet?.target_rpe != null
                              ? `RPE ${firstSet.target_rpe}`
                              : null,
                            firstSet?.target_rir != null
                              ? `RIR ${firstSet.target_rir}`
                              : null,
                            firstSet?.rest_seconds != null
                              ? `repos ${Math.round(
                                  firstSet.rest_seconds / 60
                                )} min`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "";

                    if (block === "STRENGTH WORK") {
                      return (
                        <View
                          key={item.id ?? index}
                          style={{ marginTop: index === 0 ? 2 : 14 }}
                        >
                          <Text
                            style={{
                              color: colors.text,
                              fontSize: 15,
                              fontWeight: "800",
                            }}
                          >
                            {name}
                          </Text>

                          {(cleanNote || strengthFallback) ? (
                            <Text
                              style={{
                                color: colors.muted,
                                fontSize: 13,
                                lineHeight: 19,
                                marginTop: 2,
                              }}
                            >
                              {cleanNote || strengthFallback}
                            </Text>
                          ) : null}
                        </View>
                      );
                    }

                    return (
                      <Text
                        key={item.id ?? index}
                        style={{
                          color: colors.text,
                          fontSize: 14,
                          fontWeight: "600",
                          lineHeight: 22,
                        }}
                      >
                        {compactLine}
                      </Text>
                    );
                  })}
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

      <Text style={styles.debug}>
        athleteId : {athleteId ?? "—"}
      </Text>

      <Text style={styles.debug}>
        workoutTemplateId : {workoutTemplateId ?? "—"}
      </Text>

      <Text style={styles.debug}>
        programId : {programId ?? "—"}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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

  debug: {
    color: colors.muted2,
    fontSize: 9,
    textAlign: "center",
    marginTop: 4,
  },
});
