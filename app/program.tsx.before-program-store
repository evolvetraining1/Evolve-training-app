
import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "@/src/theme";
import { getProgramDetail } from "@/src/lib/api";

export default function ProgramScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();

  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!programId) {
      setError("Programme introuvable.");
      setLoading(false);
      return;
    }

    getProgramDetail(String(programId))
      .then((data) => {
        setProgram(data.program);
        setWorkouts(data.workouts ?? []);

        const firstWeek = Number(data.workouts?.[0]?.week_number ?? 1);
        setSelectedWeek(firstWeek);
      })
      .catch((e: any) => {
        setError(e?.message ?? "Impossible de charger le programme.");
      })
      .finally(() => setLoading(false));
  }, [programId]);

  const weeks = useMemo(() => {
    const values = Array.from(
      new Set(
        workouts.map((w) => Number(w.week_number ?? 1))
      )
    );

    return values.sort((a, b) => a - b);
  }, [workouts]);

  const weekWorkouts = workouts
    .filter((w) => Number(w.week_number ?? 1) === selectedWeek)
    .sort(
      (a, b) =>
        Number(a.day_number ?? 0) - Number(b.day_number ?? 0)
    );

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
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Retour</Text>
      </Pressable>

      <Text style={styles.kicker}>PROGRAMME</Text>

      <Text style={styles.title}>
        {program?.name ?? "Programme"}
      </Text>

      <Text style={styles.subtitle}>
        {program?.duration_weeks
          ? `${program.duration_weeks} semaines`
          : "Durée libre"}
      </Text>

      {program?.description ? (
        <Text style={styles.description}>
          {program.description}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {weeks.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>SEMAINES</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekRow}
          >
            {weeks.map((week) => {
              const active = selectedWeek === week;

              return (
                <Pressable
                  key={week}
                  onPress={() => setSelectedWeek(week)}
                  style={[
                    styles.weekButton,
                    active && styles.weekButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekNumber,
                      active && styles.weekNumberActive,
                    ]}
                  >
                    {week}
                  </Text>
                  <Text
                    style={[
                      styles.weekLabel,
                      active && styles.weekNumberActive,
                    ]}
                  >
                    SEMAINE
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>
            SÉANCES — SEMAINE {selectedWeek}
          </Text>

          {weekWorkouts.map((workout) => (
            <Pressable
              key={workout.id}
              onPress={() =>
                router.push({
                  pathname: "/program-workout",
                  params: {
                    workoutId: String(workout.id),
                    programId: String(programId),
                  },
                })
              }
              style={({ pressed }) => [
                styles.workoutCard,
                pressed && { opacity: 0.82 },
              ]}
            >
              <View style={styles.workoutTop}>
                <View>
                  <Text style={styles.day}>
                    JOUR {workout.day_number ?? "—"}
                  </Text>

                  <Text style={styles.workoutName}>
                    {workout.name ?? "Séance"}
                  </Text>
                </View>

                <Text style={styles.arrow}>›</Text>
              </View>

              <Text style={styles.meta}>
                {workout.estimated_minutes
                  ? `≈ ${workout.estimated_minutes} min`
                  : "Durée libre"}
              </Text>

              {workout.notes ? (
                <Text style={styles.notes}>{workout.notes}</Text>
              ) : null}
            </Pressable>
          ))}

          {weekWorkouts.length === 0 ? (
            <Text style={styles.empty}>
              Aucune séance cette semaine.
            </Text>
          ) : null}
        </>
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
    marginBottom: 26,
  },
  kicker: {
    color: colors.yellow,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "900",
  },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginTop: 8,
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 32,
    marginBottom: 14,
  },
  weekRow: {
    gap: 10,
    paddingRight: 20,
  },
  weekButton: {
    width: 82,
    height: 78,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  weekButtonActive: {
    borderColor: colors.yellow,
  },
  weekNumber: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: "900",
  },
  weekNumberActive: {
    color: colors.yellow,
  },
  weekLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 4,
  },
  workoutCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 19,
    marginBottom: 14,
    backgroundColor: colors.surface,
  },
  workoutTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  day: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: "900",
  },
  workoutName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },
  arrow: {
    color: colors.text,
    fontSize: 35,
  },
  meta: {
    color: colors.muted,
    marginTop: 10,
  },
  notes: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 12,
  },
  empty: {
    color: colors.muted,
    marginTop: 12,
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
