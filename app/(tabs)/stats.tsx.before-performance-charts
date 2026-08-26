import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card, Label, Metric, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getAthleteStatsDashboard, getExercisePerformanceHistory } from "@/src/lib/api";

export default function StatsScreen() {
  const [stats, setStats] = useState<any>(null);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [data, history] = await Promise.all([
        getAthleteStatsDashboard(),
        getExercisePerformanceHistory(),
      ]);

      setStats(data);
      setExerciseHistory(history);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du chargement des statistiques.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <ScreenHeader
        title="Stats"
        subtitle="Tes performances réelles, issues de tes séances."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <Card style={styles.gridCard}>
          <Metric
            value={`${stats?.totalVolume ?? 0} kg`}
            label="Volume dernière séance"
            accent={colors.yellow}
          />
        </Card>

        <Card style={styles.gridCard}>
          <Metric
            value={
              stats?.bestE1rm > 0
                ? `${stats.bestE1rm} kg`
                : "—"
            }
            label="Meilleur e1RM séance"
            accent={colors.green}
          />
        </Card>
      </View>

      <Card>
        <Label>Dernière séance</Label>

        <Text style={styles.big}>
          {stats?.latestSession?.name ?? "Aucune séance terminée"}
        </Text>

        <Text style={styles.muted}>
          {stats?.completedSets ?? 0} séries validées
        </Text>

        <Text style={styles.muted}>
          RPE moyen :{" "}
          {stats?.averageRpe != null ? stats.averageRpe : "—"}
        </Text>

        <Text style={styles.muted}>
          Volume : {(stats?.totalVolume ?? 0).toLocaleString("fr-FR")} kg
        </Text>
      </Card>

      <Card>
        <Label>Assiduité 30 jours</Label>

        <Text style={[styles.big, { color: colors.green }]}>
          {stats?.attendance ?? 0}%
        </Text>

        <Text style={styles.muted}>
          {stats?.completedLast30 ?? 0} séance(s) terminée(s) sur{" "}
          {stats?.scheduledLast30 ?? 0} prévue(s)
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  100,
                  Math.max(0, stats?.attendance ?? 0)
                )}%`,
              },
            ]}
          />
        </View>
      </Card>
    
      <Card>
        <Label>Progression par exercice</Label>

        {exerciseHistory.length ? (
          exerciseHistory.map((exercise: any) => (
            <View key={exercise.exerciseId} style={styles.exerciseBlock}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>

              <View style={styles.exerciseMetrics}>
                <View>
                  <Text style={styles.exerciseMetricValue}>
                    {exercise.latest?.e1rm ?? "--"} kg
                  </Text>
                  <Text style={styles.muted}>e1RM actuel</Text>
                </View>

                <View>
                  <Text style={styles.exerciseMetricValue}>
                    {exercise.bestE1rm ?? "--"} kg
                  </Text>
                  <Text style={styles.muted}>Record</Text>
                </View>

                <View>
                  <Text
                    style={[
                      styles.exerciseMetricValue,
                      exercise.delta > 0
                        ? { color: colors.green }
                        : exercise.delta < 0
                        ? { color: colors.red }
                        : null,
                    ]}
                  >
                    {exercise.delta == null
                      ? "--"
                      : `${exercise.delta > 0 ? "+" : ""}${exercise.delta} kg`}
                  </Text>

                  <Text style={styles.muted}>Évolution</Text>
                </View>
              </View>

              <Text style={[styles.muted, { marginTop: 16 }]}>
                Dernières performances
              </Text>

              {exercise.history.map((perf: any, index: number) => (
                <View
                  key={`${exercise.exerciseId}-${index}`}
                  style={styles.historyRow}
                >
                  <Text style={styles.historyDate}>
                    {perf.date
                      ? new Date(perf.date).toLocaleDateString("fr-FR")
                      : "--"}
                  </Text>

                  <Text style={styles.historyPerformance}>
                    {perf.load} kg × {perf.reps}
                  </Text>

                  <Text style={styles.historyE1rm}>
                    e1RM {perf.e1rm} kg
                  </Text>
                </View>
              ))}
            </View>
          ))
        ) : (
          <Text style={styles.muted}>
            Termine plusieurs séances pour construire ton historique.
          </Text>
        )}
      </Card>

</ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 110,
    paddingBottom: 110,
    backgroundColor: "transparent",
    gap: 14,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },

  grid: {
    flexDirection: "row",
    gap: 12,
  },

  gridCard: {
    flex: 1,
  },

  big: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 8,
  },

  muted: {
    color: colors.muted,
    fontSize: 16,
    marginTop: 5,
  },

  error: {
    color: colors.red,
    fontWeight: "800",
  },

  progressTrack: {
    height: 14,
    backgroundColor: colors.surface2,
    borderRadius: 7,
    overflow: "hidden",
    marginTop: 20,
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.yellow,
    borderRadius: 7,
  },

  exerciseBlock: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  exerciseName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 14,
  },

  exerciseMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  exerciseMetricValue: {
    color: colors.yellow,
    fontSize: 20,
    fontWeight: "900",
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  historyDate: {
    color: colors.muted,
    fontSize: 13,
  },

  historyPerformance: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  historyE1rm: {
    color: colors.yellow,
    fontSize: 14,
    fontWeight: "800",
  },
});
