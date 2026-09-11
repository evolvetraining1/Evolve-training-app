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

import { Card, ScreenHeader } from "@/src/components/ui";
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
      <Pressable onPress={() => router.back()} style={styles.backButton}>
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
                  marginTop: 14,
                  padding: 18,
                  borderRadius: 18,
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
                    letterSpacing: 1.6,
                  }}
                >
                  {block}
                </Text>

                {rounds ? (
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: "900",
                      marginTop: 4,
                      marginBottom: 8,
                    }}
                  >
                    {rounds} ROUNDS
                  </Text>
                ) : null}

                {items.map((item: any, index: number) => {
                  const exercise = Array.isArray(item.exercises)
                    ? item.exercises[0]
                    : item.exercises;

                  const cleanNote = String(item.prescription_notes ?? "")
                    .replace(/^(WARM\s*UP|WARMUP|STRENGTH\s*WORK|STRENGTH|RENFO|WOD)\s*[:\-–—]?\s*/i, "")
                    .replace(/^\d+\s*(ROUNDS?|TOURS?)\s*[:\-–—]?\s*/i, "")
                    .trim();

                  const sets = item.prescribed_sets ?? [];

                  const same =
                    sets.length > 0 &&
                    sets.every((set: any) =>
                      set.target_reps === sets[0]?.target_reps &&
                      set.target_load_kg === sets[0]?.target_load_kg &&
                      set.target_rpe === sets[0]?.target_rpe &&
                      set.target_rir === sets[0]?.target_rir &&
                      set.rest_seconds === sets[0]?.rest_seconds
                    );

              const wodLine = (() => {
                const name = String(
                  exercise?.name ?? `Exercice ${index + 1}`
                ).trim();

                const firstSet = sets[0];

                const distance =
                  cleanNote.match(/\b\d+\s*m\b/i)?.[0] ?? null;

                if (distance) {
                  return `${distance} ${name.toLowerCase()}`;
                }

                const reps = firstSet?.target_reps;
                const load = firstSet?.target_load_kg;

                if (reps != null) {
                  return `${reps} ${name.toLowerCase()}${
                    load != null ? ` @ ${load} kg` : ""
                  }`;
                }

                return cleanNote || name;
              })();

              const performedForExercise = (detail?.performedSets ?? []).filter(
                (performed: any) => performed.workout_exercise_id === item.id
              );

              const completedPerformed = performedForExercise.filter(
                (done: any) => done.completed === true
              );

              const hasPerformed = completedPerformed.length > 0;

              const hasPercentPrescription = /@?\s*\d+(?:[.,]\d+)?\s*%/.test(
                String(item.prescription_notes ?? "")
              );

              const sortedPerformed = completedPerformed
                .slice()
                .sort(
                  (a: any, b: any) =>
                    Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
                );

              const referenceLoad =
                sortedPerformed.find((done: any) => done.load_kg != null)?.load_kg ??
                null;

              const differences = sets.flatMap((prescribed: any, setIndex: number) => {
                const performed = completedPerformed.find(
                  (done: any) =>
                    done.prescribed_set_id === prescribed.id ||
                    done.set_number === prescribed.set_number
                );

                if (!performed) return [];

                const changes: string[] = [];

                if (
                  prescribed.target_reps != null &&
                  performed.reps != null &&
                  Number(performed.reps) !== Number(prescribed.target_reps)
                ) {
                  changes.push(
                    `${prescribed.target_reps} reps → ${performed.reps} reps`
                  );
                }

                if (
                  prescribed.target_load_kg != null &&
                  performed.load_kg != null &&
                  Number(performed.load_kg) !== Number(prescribed.target_load_kg)
                ) {
                  changes.push(
                    `${prescribed.target_load_kg} kg → ${performed.load_kg} kg`
                  );
                }

                if (
                  prescribed.target_load_kg == null &&
                  hasPercentPrescription &&
                  referenceLoad != null &&
                  performed.load_kg != null &&
                  Number(performed.load_kg) !== Number(referenceLoad)
                ) {
                  changes.push(
                    `${referenceLoad} kg → ${performed.load_kg} kg`
                  );
                }

                if (!changes.length) return [];

                return [
                  `Série ${prescribed.set_number ?? setIndex + 1} : ${changes.join(
                    " · "
                  )}`,
                ];
              });

              const missingCount = Math.max(
                sets.length - completedPerformed.length,
                0
              );

              const exerciseStatus =
                sets.length > 0 && completedPerformed.length === 0
                  ? "INCOMPLET"
                  : missingCount > 0
                  ? "INCOMPLET"
                  : differences.length > 0
                  ? "MODIFIÉ"
                  : hasPerformed
                  ? "COMPLET"
                  : "INCOMPLET";

              const summary =
                same && sets.length
                  ? [
                      sets.length > 1 && sets[0]?.target_reps != null
                        ? `${sets.length} × ${sets[0].target_reps}`
                        : sets[0]?.target_reps != null
                        ? `${sets[0].target_reps} reps`
                        : null,
                      sets[0]?.target_load_kg != null
                        ? `@ ${sets[0].target_load_kg} kg`
                        : null,
                      sets[0]?.target_rpe != null
                        ? `RPE ${sets[0].target_rpe}`
                        : null,
                      sets[0]?.target_rir != null
                        ? `RIR ${sets[0].target_rir}`
                        : null,
                      sets[0]?.rest_seconds != null
                        ? `repos ${Math.round(sets[0].rest_seconds / 60)} min`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "";

              return (
                <View
                  key={item.id ?? index}
                  style={{
                    marginTop: index === 0 ? 6 : 12,
                  }}
                >
                  {block === "WOD" ? (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 16,
                          fontWeight: "700",
                          lineHeight: 24,
                          flex: 1,
                        }}
                      >
                        {wodLine}
                      </Text>

                      <Text
                        style={{
                          color:
                            exerciseStatus === "COMPLET"
                              ? colors.green
                              : exerciseStatus === "MODIFIÉ"
                              ? colors.yellow
                              : colors.red,
                          fontSize: 10,
                          fontWeight: "900",
                          letterSpacing: 0.8,
                          marginLeft: 10,
                        }}
                      >
                        {exerciseStatus}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: "900",
                            lineHeight: 21,
                            flex: 1,
                          }}
                        >
                          {exercise?.name ?? `Exercice ${index + 1}`}
                        </Text>

                        {exerciseStatus ? (
                          <Text
                            style={{
                              color:
                                exerciseStatus === "COMPLET"
                                  ? colors.green
                                  : exerciseStatus === "MODIFIÉ"
                                  ? colors.yellow
                                  : colors.red,
                              fontSize: 10,
                              fontWeight: "900",
                              letterSpacing: 0.8,
                              marginLeft: 10,
                            }}
                          >
                            {exerciseStatus}
                          </Text>
                        ) : null}
                      </View>

                      {(cleanNote || summary) ? (
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: 14,
                            lineHeight: 20,
                            marginTop: 2,
                          }}
                        >
                          {cleanNote || summary}
                        </Text>
                      ) : null}
                    </>
                  )}

                  {hasPerformed ? (
                    <View style={{ marginTop: 9 }}>
                      <Text
                        style={{
                          color: colors.yellow,
                          fontSize: 11,
                          fontWeight: "900",
                          letterSpacing: 1,
                          marginBottom: 3,
                        }}
                      >
                        RÉALISÉ
                      </Text>

                      {performedForExercise
                        .slice()
                        .sort(
                          (a: any, b: any) =>
                            Number(a.set_number ?? 0) -
                            Number(b.set_number ?? 0)
                        )
                        .map((done: any, doneIndex: number) => {
                          const parts = [
                            done.reps != null ? `${done.reps} reps` : null,
                            done.load_kg != null ? `${done.load_kg} kg` : null,
                            done.rpe != null ? `RPE ${done.rpe}` : null,
                          ].filter(Boolean);

                          return (
                            <Text
                              key={done.id ?? doneIndex}
                              style={{
                                color: colors.text,
                                fontSize: 12,
                                lineHeight: 18,
                              }}
                            >
                              S{done.set_number ?? doneIndex + 1} · {parts.join(" · ")}
                            </Text>
                          );
                        })}

                      {differences.map(
                        (difference: string, differenceIndex: number) => (
                          <Text
                            key={`diff-${differenceIndex}`}
                            style={{
                              color: colors.yellow,
                              fontSize: 12,
                              fontWeight: "700",
                              lineHeight: 18,
                              marginTop: 2,
                            }}
                          >
                            {difference}
                          </Text>
                        )
                      )}
                    </View>
                  ) : null}
                </View>
              );
                })}
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
