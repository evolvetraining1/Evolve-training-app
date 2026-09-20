import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import tacticalProgramSource from "@/supabase/seed-data/tactical-reconditioning.json";
import { BackScreenHeader } from "@/src/components/ui";
import { colors, radius } from "@/src/theme";

type ProgramItem = [phase: string, exercise: string, prescription: string];

type ProgramWorkout = {
  week: number;
  day: number;
  name: string;
  notes?: string;
  estimatedMinutes?: number;
  items: ProgramItem[];
};

const program = tacticalProgramSource as {
  programName: string;
  description: string;
  durationWeeks: number;
  workouts: ProgramWorkout[];
};

const PHASE_ORDER = ["WARM UP", "STRENGTH WORK", "RENFO", "WORKOUT", "WOD"];

function groupItems(items: ProgramItem[]) {
  const groups = new Map<string, ProgramItem[]>();

  for (const item of items) {
    const current = groups.get(item[0]) ?? [];
    current.push(item);
    groups.set(item[0], current);
  }

  return Array.from(groups.entries()).sort(
    ([a], [b]) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b)
  );
}

export default function TestProgramScreen() {
  const [selectedWeek, setSelectedWeek] = useState(1);

  const weeks = useMemo(
    () =>
      Array.from(
        new Set(program.workouts.map((workout) => workout.week))
      ).sort((a, b) => a - b),
    []
  );

  const workouts = useMemo(
    () =>
      program.workouts
        .filter((workout) => workout.week === selectedWeek)
        .sort((a, b) => a.day - b.day),
    [selectedWeek]
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <BackScreenHeader
        eyebrow="VÉRIFICATION TEMPORAIRE"
        title="Test prog"
        subtitle="Programme Tactical Reconditioning complet. Choisis une semaine puis contrôle chaque séance et chaque prescription."
      />

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryValue}>{program.durationWeeks}</Text>
          <Text style={styles.summaryLabel}>SEMAINES</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View>
          <Text style={styles.summaryValue}>{program.workouts.length}</Text>
          <Text style={styles.summaryLabel}>SÉANCES</Text>
        </View>
      </View>

      <Text style={styles.selectorLabel}>CHOISIR UNE SEMAINE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekSelector}
      >
        {weeks.map((week) => {
          const active = week === selectedWeek;

          return (
            <Pressable
              key={week}
              accessibilityRole="button"
              accessibilityLabel={`Afficher la semaine ${week}`}
              onPress={() => setSelectedWeek(week)}
              style={({ pressed }) => [
                styles.weekButton,
                active && styles.weekButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.weekButtonText,
                  active && styles.weekButtonTextActive,
                ]}
              >
                S{week}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.weekHeadingRow}>
        <Text style={styles.weekTitle}>SEMAINE {selectedWeek}</Text>
        <Text style={styles.weekCount}>
          {workouts.length} {workouts.length > 1 ? "SÉANCES" : "SÉANCE"}
        </Text>
      </View>

      {workouts.map((workout) => {
        const groupedItems = groupItems(workout.items);

        return (
          <View key={`${workout.week}-${workout.day}`} style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>JOUR {workout.day}</Text>
              </View>
              {workout.estimatedMinutes ? (
                <Text style={styles.duration}>~{workout.estimatedMinutes} MIN</Text>
              ) : null}
            </View>

            <Text style={styles.workoutName}>{workout.name}</Text>

            {workout.notes ? (
              <Text style={styles.workoutNotes}>{workout.notes}</Text>
            ) : null}

            {!groupedItems.length ? (
              <View style={styles.restCard}>
                <Text style={styles.restTitle}>RÉCUPÉRATION COMPLÈTE</Text>
                <Text style={styles.restText}>
                  Aucun exercice prévu pour cette journée.
                </Text>
              </View>
            ) : null}

            {groupedItems.map(([phase, items]) => (
              <View key={phase} style={styles.phaseBlock}>
                <View style={styles.phaseHeader}>
                  <Text style={styles.phaseTitle}>{phase}</Text>
                  <Text style={styles.phaseCount}>{items.length}</Text>
                </View>

                {items.map(([, exercise, prescription], index) => (
                  <View key={`${phase}-${exercise}-${index}`} style={styles.exerciseRow}>
                    <View style={styles.exerciseNumber}>
                      <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.exerciseCopy}>
                      <Text style={styles.exerciseName}>{exercise}</Text>
                      <Text style={styles.prescription}>{prescription}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 120,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 26,
  },
  summaryValue: {
    color: colors.yellow,
    fontSize: 28,
    fontWeight: "900",
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: colors.border,
    marginHorizontal: 26,
  },
  selectorLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  weekSelector: {
    gap: 8,
    paddingBottom: 24,
  },
  weekButton: {
    minWidth: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  weekButtonActive: {
    borderColor: colors.yellow,
    backgroundColor: colors.yellow,
  },
  weekButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  weekButtonTextActive: {
    color: colors.black,
  },
  pressed: {
    opacity: 0.75,
  },
  weekHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  weekTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  weekCount: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  workoutCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 18,
  },
  workoutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: colors.yellow,
  },
  dayBadgeText: {
    color: colors.black,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  duration: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  workoutName: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    marginTop: 14,
  },
  workoutNotes: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    marginBottom: 4,
  },
  restCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 18,
  },
  restTitle: {
    color: colors.yellow,
    fontSize: 14,
    fontWeight: "900",
  },
  restText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
  },
  phaseBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    marginTop: 18,
    paddingTop: 16,
  },
  phaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  phaseTitle: {
    color: colors.yellow,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  phaseCount: {
    color: colors.muted2,
    fontSize: 11,
    fontWeight: "900",
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 11,
  },
  exerciseNumber: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface3,
    marginRight: 11,
  },
  exerciseNumberText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  exerciseCopy: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  prescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
});
