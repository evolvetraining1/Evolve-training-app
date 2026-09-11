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
import { supabase } from "@/src/lib/supabase";
import { getCoachAthleteProgramWorkouts } from "@/src/lib/coachApi";

type ProgramData = {
  id: string;
  name: string;
  description?: string | null;
  duration_weeks?: number | null;
};

export default function CoachAthleteProgramScreen() {
  const { athleteId, assignmentId, programId } =
    useLocalSearchParams<{
      athleteId: string;
      assignmentId: string;
      programId: string;
    }>();

  const [program, setProgram] = useState<ProgramData | null>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!programId || !athleteId) return;

    const loadProgram = async () => {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("programs")
          .select("id, name, description, duration_weeks")
          .eq("id", programId)
          .single();

        if (error) throw error;

        setProgram(data);

        const workoutRows = await getCoachAthleteProgramWorkouts(
          athleteId,
          programId
        );

        setWorkouts(workoutRows);
      } catch (e: any) {
        setError(e?.message ?? "Impossible de charger le programme.");
      } finally {
        setLoading(false);
      }
    };

    loadProgram();
  }, [programId, athleteId]);

  const workoutsByWeek = workouts.reduce(
    (groups: Record<string, any[]>, workout: any) => {
      const week = String(workout.week_number ?? 1);

      if (!groups[week]) {
        groups[week] = [];
      }

      groups[week].push(workout);
      return groups;
    },
    {}
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ RETOUR ATHLÈTE</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="PROGRAMME ATHLÈTE"
        title={program?.name ?? "Programme"}
        subtitle="Suivi des semaines et séances réalisées."
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && program ? (
        <>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>DURÉE</Text>
            <Text style={styles.summaryValue}>
              {program.duration_weeks ?? "—"} semaine(s)
            </Text>

            {program.description ? (
              <Text style={styles.description}>
                {program.description}
              </Text>
            ) : null}
          </Card>

          <View>
            {Object.entries(workoutsByWeek).length ? (
              Object.entries(workoutsByWeek)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([week, weekWorkouts]) => (
                  <Card key={week} style={styles.section}>
                    <Text style={styles.weekTitle}>
                      SEMAINE {week}
                    </Text>

                    {(weekWorkouts as any[])
                      .sort(
                        (a, b) =>
                          Number(a.day_number ?? 0) -
                          Number(b.day_number ?? 0)
                      )
                      .map((workout) => (
                        <Pressable
                          key={workout.id}
                          style={styles.workoutRow}
                          onPress={() =>
                            router.push({
                              pathname: "/coach-athlete-session" as any,
                              params: {
                                athleteId: String(athleteId),
                                workoutTemplateId: String(workout.id),
                                programId: String(programId),
                              },
                            })
                          }
                        >
                          <View style={styles.dayBadge}>
                            <Text style={styles.dayBadgeText}>
                              J{workout.day_number ?? "—"}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.workoutName}>
                              {workout.name ?? "Séance"}
                            </Text>

                            <Text style={styles.workoutMeta}>
                              {workout.estimated_minutes
                                ? `${workout.estimated_minutes} min`
                                : "Durée non renseignée"}
                            </Text>
                          </View>

                          <Text style={styles.workoutArrow}>›</Text>
                        </Pressable>
                      ))}
                  </Card>
                ))
            ) : (
              <Card style={styles.section}>
                <Text style={styles.muted}>
                  Aucune séance trouvée dans ce programme.
                </Text>
              </Card>
            )}
          </View>
        </>
      ) : null}

      <Text style={styles.debug}>
        athleteId: {athleteId ?? "—"}
      </Text>
      <Text style={styles.debug}>
        assignmentId: {assignmentId ?? "—"}
      </Text>
      <Text style={styles.debug}>
        programId: {programId ?? "—"}
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
    paddingVertical: 40,
    alignItems: "center",
  },

  error: {
    color: colors.red,
    marginBottom: 14,
  },

  summaryCard: {
    marginBottom: 14,
  },

  summaryLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
  },

  summaryValue: {
    color: colors.yellow,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },

  description: {
    color: colors.muted,
    marginTop: 10,
    lineHeight: 19,
  },

  section: {
    marginBottom: 14,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  weekTitle: {
    color: colors.yellow,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },

  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingVertical: 10,
  },

  dayBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  dayBadgeText: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "900",
  },

  workoutName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },

  workoutMeta: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },

  workoutArrow: {
    color: colors.yellow,
    fontSize: 28,
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
