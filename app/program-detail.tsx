import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { colors } from "@/src/theme";
import { getProgramDetail } from "@/src/lib/api";

type Workout = {
  id: string;
  week_number: number;
  day_number: number;
  name: string;
  notes?: string | null;
  estimated_minutes?: number | null;
};

export default function ProgramDetailScreen() {
  const { programName } = useLocalSearchParams<{
    programName?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const { getMyPrograms } = await import("@/src/lib/api");
      const programs = await getMyPrograms();

      const found = (programs ?? []).find(
        (p: any) =>
          String(p.name).toUpperCase() ===
          String(programName ?? "").toUpperCase()
      );

      if (!found) {
        throw new Error("Programme introuvable.");
      }

      const detail = await getProgramDetail(found.id);

      setProgram(detail.program);
      setWorkouts(detail.workouts ?? []);
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible de charger le programme."
      );
    } finally {
      setLoading(false);
    }
  }

  const weeks = useMemo(() => {
    const grouped = new Map<number, Workout[]>();

    for (const workout of workouts) {
      const week = Number(workout.week_number);
      const current = grouped.get(week) ?? [];
      current.push(workout);
      grouped.set(week, current);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, entries]) => ({
        weekNumber,
        entries: entries.sort(
          (a, b) => Number(a.day_number) - Number(b.day_number)
        ),
      }));
  }, [workouts]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.yellow}
          size="large"
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← RETOUR</Text>
      </Pressable>

      <Text style={styles.kicker}>EVOLVE TRAINING</Text>

      <Text style={styles.title}>
        {program?.name ?? "PROGRAMME"}
      </Text>

      {program?.description ? (
        <Text style={styles.subtitle}>
          {program.description}
        </Text>
      ) : null}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {!weeks.length && !error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            Aucune séance disponible
          </Text>
        </View>
      ) : null}

      {weeks.map(({ weekNumber, entries }) => (
        <View key={weekNumber} style={styles.weekBlock}>
          <Text style={styles.weekTitle}>
            SEMAINE {weekNumber}
          </Text>

          {entries.map((workout) => (
            <Pressable
              key={workout.id}
              style={styles.sessionCard}
              onPress={() =>
                router.push({
                  pathname: "/program-workout",
                  params: {
                    workoutId: workout.id,
                  },
                })
              }
            >
              <View style={styles.sessionTop}>
                <Text style={styles.sessionDay}>
                  JOUR {workout.day_number}
                </Text>

                {workout.estimated_minutes ? (
                  <Text style={styles.duration}>
                    {workout.estimated_minutes} MIN
                  </Text>
                ) : null}
              </View>

              <Text style={styles.sessionName}>
                {String(workout.name).toUpperCase()}
              </Text>

              {workout.notes ? (
                <Text style={styles.sessionNotes}>
                  {workout.notes}
                </Text>
              ) : null}

              <Text style={styles.openText}>
                OUVRIR LA SÉANCE →
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 22,
    paddingTop: 58,
    paddingBottom: 120,
    backgroundColor: "transparent",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },

  back: {
    color: colors.yellow,
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 24,
  },

  kicker: {
    color: colors.yellow,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.2,
    marginBottom: 8,
  },

  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },

  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 26,
  },

  error: {
    color: "#ff6464",
    marginVertical: 18,
    textAlign: "center",
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  weekBlock: {
    marginTop: 28,
  },

  weekTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  sessionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },

  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sessionDay: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  duration: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  sessionName: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 8,
  },

  sessionNotes: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  openText: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 16,
    letterSpacing: 1,
  },
});
