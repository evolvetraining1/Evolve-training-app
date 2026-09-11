import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getCoachAthleteOverview, getCoachExercisePerformanceHistory, getCoachAthletePrograms } from "@/src/lib/coachApi";

export default function CoachAthleteScreen() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const [overview, setOverview] = useState<any>(null);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  const [athletePrograms, setAthletePrograms] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [periodDays, setPeriodDays] = useState(30);

  useEffect(() => {
    if (!athleteId) return;

    Promise.all([
      getCoachAthleteOverview(athleteId, periodDays),
      getCoachExercisePerformanceHistory(athleteId, periodDays),
      getCoachAthletePrograms(athleteId),
    ])
      .then(([overviewResult, exerciseResult, programsResult]) => {
        setOverview(overviewResult);
        setExerciseHistory(exerciseResult);
        setAthletePrograms(programsResult);
      })
      .catch((e: any) =>
        setError(e?.message ?? "Impossible de charger l'athlète.")
      );
  }, [athleteId, periodDays]);

  const athleteName = overview?.profile
    ? `${overview.profile.first_name ?? ""} ${overview.profile.last_name ?? ""}`.trim()
    : "Fiche athlète";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ MES ATHLÈTES</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="SUIVI ATHLÈTE"
        title={athleteName || "Fiche athlète"}
        subtitle="Analyse complète de l'activité et des performances."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.periods}>
        {[
          { label: "JOUR", days: 1 },
          { label: "7 J", days: 7 },
          { label: "30 J", days: 30 },
          { label: "3 MOIS", days: 90 },
          { label: "1 AN", days: 365 },
        ].map((period) => (
          <Pressable
            key={period.days}
            onPress={() => setPeriodDays(period.days)}
            style={[
              styles.periodButton,
              periodDays === period.days && styles.periodButtonActive,
            ]}
          >
            <Text
              style={[
                styles.periodText,
                periodDays === period.days && styles.periodTextActive,
              ]}
            >
              {period.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>VUE D'ENSEMBLE</Text>
        <Text style={styles.muted}>
          Synthèse de l'athlète et indicateurs importants.
        </Text>
      </Card>

      <View style={styles.grid}>
        <Card style={styles.gridCard}>
          <Text style={styles.metric}>
            {overview ? overview.completed : "—"}
          </Text>
          <Text style={styles.metricLabel}>Séances terminées</Text>
        </Card>

        <Card style={styles.gridCard}>
          <Text style={styles.metric}>
            {overview ? `${overview.attendance}%` : "—"}
          </Text>
          <Text style={styles.metricLabel}>Assiduité</Text>
        </Card>
      </View>

      <View style={styles.grid}>
        <Card style={styles.gridCard}>
          <Text style={styles.metric}>—</Text>
          <Text style={styles.metricLabel}>Pas / jour</Text>
        </Card>

        <Card style={styles.gridCard}>
          <Text style={styles.metric}>
            {overview?.averageRpe != null ? overview.averageRpe : "—"}
          </Text>
          <Text style={styles.metricLabel}>RPE moyen</Text>
        </Card>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>ENTRAÎNEMENT</Text>
        <Text style={styles.muted}>
          Données calculées sur la période sélectionnée.
        </Text>

        <View style={styles.trainingMetrics}>
          <View style={styles.trainingMetric}>
            <Text style={styles.trainingMetricValue}>
              {overview
                ? `${Number(overview.totalVolume ?? 0).toLocaleString("fr-FR")} kg`
                : "—"}
            </Text>
            <Text style={styles.trainingMetricLabel}>VOLUME TOTAL</Text>
          </View>

          <View style={styles.trainingMetric}>
            <Text style={styles.trainingMetricValue}>
              {overview ? overview.completedSets ?? 0 : "—"}
            </Text>
            <Text style={styles.trainingMetricLabel}>SÉRIES</Text>
          </View>

          <View style={styles.trainingMetric}>
            <Text style={styles.trainingMetricValue}>
              {overview?.bestE1rm > 0
                ? `${overview.bestE1rm} kg`
                : "—"}
            </Text>
            <Text style={styles.trainingMetricLabel}>MEILLEUR e1RM</Text>
          </View>
        </View>

        <View style={styles.exerciseList}>
          <Text style={styles.programListTitle}>PROGRAMMES DE L’ATHLÈTE</Text>

          {athletePrograms.length ? (
            athletePrograms.map((assignment: any) => {
              const program = Array.isArray(assignment.programs)
                ? assignment.programs[0]
                : assignment.programs;

              if (!program) return null;

              return (
                <Pressable
                  key={assignment.id}
                  style={styles.programRow}
                  onPress={() =>
                    router.push({
                      pathname: "/coach-athlete-program" as any,
                      params: {
                        athleteId: String(athleteId),
                        assignmentId: String(assignment.id),
                        programId: String(program.id),
                      },
                    })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.programName}>{program.name}</Text>
                    <Text style={styles.programMeta}>
                      Début : {assignment.starts_on ?? "—"}
                    </Text>
                    <Text style={styles.programMeta}>
                      {program.duration_weeks ?? "—"} semaine(s)
                    </Text>
                  </View>

                  <View style={styles.programStatus}>
                    <Text style={styles.programStatusText}>
                      {assignment.active ? "ACTIF" : "TERMINÉ"}
                    </Text>
                  </View>

                  <Text style={styles.programArrow}>›</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.muted}>
              Aucun programme attribué.
            </Text>
          )}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>NUTRITION</Text>
        <Text style={styles.muted}>
          Calories, protéines, glucides, lipides et fibres.
        </Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVITÉ</Text>
        <Text style={styles.muted}>
          Pas quotidiens et évolution de l'activité.
        </Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>HISTORIQUE</Text>
        <Text style={styles.muted}>
          Séances et données enregistrées sur la période.
        </Text>
      </Card>

      <Text style={styles.debug}>Athlete ID : {athleteId ?? "absent"}</Text>
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
    fontWeight: "900",
    fontSize: 13,
  },

  periods: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 18,
  },

  periodButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  periodButtonActive: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow,
  },

  periodText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },

  periodTextActive: {
    color: colors.black,
  },

  section: {
    marginBottom: 14,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  muted: {
    color: colors.muted,
    marginTop: 7,
    lineHeight: 19,
  },

  trainingMetrics: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },

  trainingMetric: {
    flex: 1,
    minHeight: 82,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  trainingMetricValue: {
    color: colors.yellow,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  trainingMetricLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    marginTop: 5,
    textAlign: "center",
  },

  exerciseList: {
    marginTop: 18,
  },

  programListTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 10,
  },

  programRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },

  programName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },

  programMeta: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
  },

  programStatus: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow,
    backgroundColor: "rgba(255,196,0,.08)",
  },

  programStatusText: {
    color: colors.yellow,
    fontSize: 8,
    fontWeight: "900",
  },

  programArrow: {
    color: colors.yellow,
    fontSize: 28,
    lineHeight: 30,
  },

  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },

  exerciseName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },

  exerciseSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },

  exerciseStat: {
    minWidth: 70,
    alignItems: "flex-end",
  },

  exerciseStatValue: {
    color: colors.yellow,
    fontSize: 13,
    fontWeight: "900",
  },

  exerciseStatLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    marginTop: 3,
  },

  grid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  gridCard: {
    flex: 1,
  },

  metric: {
    color: colors.yellow,
    fontSize: 27,
    fontWeight: "900",
  },

  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },

  error: {
    color: colors.red,
    marginBottom: 14,
    fontWeight: "700",
  },

  debug: {
    color: colors.muted2,
    fontSize: 10,
    textAlign: "center",
    marginTop: 10,
  },
});
