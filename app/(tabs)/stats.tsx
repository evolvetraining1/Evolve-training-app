import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Pressable
} from "react-native";

import Svg, {
  Circle,
  Line,
  Polyline,
  Text as SvgText,
} from "react-native-svg";


import { router } from "expo-router";
import { Card, Label, Metric, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getAthleteStatsDashboard, getExercisePerformanceHistory } from "@/src/lib/api";


function MiniPerformanceChart({
  history,
}: {
  history: any[];
}) {
  const points = (history ?? [])
    .map((item: any) => ({
      date: item.date,
      value: Number(item.e1rm ?? 0),
    }))
    .filter(
      (item: any) =>
        item.date &&
        Number.isFinite(item.value) &&
        item.value > 0
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

  const width = Math.max(
    Dimensions.get("window").width - 92,
    250
  );

  const height = 165;

  if (points.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>
          Pas encore assez de données pour afficher une courbe.
        </Text>
      </View>
    );
  }

  const left = 40;
  const right = 12;
  const top = 14;
  const bottom = 28;

  const values = points.map((point: any) => point.value);

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min -= 5;
    max += 5;
  }

  const pad = Math.max((max - min) * 0.12, 2);

  min = Math.max(0, min - pad);
  max += pad;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const x = (index: number) =>
    left +
    (index / Math.max(points.length - 1, 1)) *
      graphWidth;

  const y = (value: number) =>
    top +
    ((max - value) / Math.max(max - min, 1)) *
      graphHeight;

  const linePoints = points
    .map(
      (point: any, index: number) =>
        `${x(index)},${y(point.value)}`
    )
    .join(" ");

  return (
    <View style={styles.chartShell}>
      <Svg width={width} height={height}>
        {[max, (max + min) / 2, min].map(
          (value, index) => {
            const gy = y(value);

            return (
              <Fragment key={`grid-${index}`}>
                <Line
                  x1={left}
                  x2={width - right}
                  y1={gy}
                  y2={gy}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="1"
                />

                <SvgText
                  x={left - 6}
                  y={gy + 4}
                  fill="#888888"
                  fontSize="10"
                  textAnchor="end"
                >
                  {Math.round(value)}
                </SvgText>
              </Fragment>
            );
          }
        )}

        <Polyline
          points={linePoints}
          fill="none"
          stroke="#F5B400"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point: any, index: number) => (
          <Circle
            key={`${point.date}-${index}`}
            cx={x(index)}
            cy={y(point.value)}
            r="4"
            fill="#F5B400"
          />
        ))}

        <SvgText
          x={left}
          y={height - 7}
          fill="#888888"
          fontSize="9"
        >
          {new Date(points[0].date).toLocaleDateString(
            "fr-FR",
            { day: "2-digit", month: "2-digit" }
          )}
        </SvgText>

        <SvgText
          x={width - right}
          y={height - 7}
          fill="#888888"
          fontSize="9"
          textAnchor="end"
        >
          {new Date(
            points[points.length - 1].date
          ).toLocaleDateString(
            "fr-FR",
            { day: "2-digit", month: "2-digit" }
          )}
        </SvgText>
      </Svg>
    </View>
  );
}

export default function StatsScreen() {
  const [stats, setStats] = useState<any>(null);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [statsResult, historyResult] = await Promise.allSettled([
        getAthleteStatsDashboard(),
        getExercisePerformanceHistory(),
      ]);

      const data =
        statsResult.status === "fulfilled"
          ? statsResult.value
          : null;

      const history =
        historyResult.status === "fulfilled"
          ? historyResult.value
          : [];

      setStats(data);
      setExerciseHistory(history);

      const failedLoads = [statsResult, historyResult].filter(
        (result) => result.status === "rejected"
      );

      if (failedLoads.length) {
        failedLoads.forEach((result) => {
          if (result.status === "rejected") {
            console.error("STATS PARTIAL LOAD ERROR", result.reason);
          }
        });

        setError(
          "Certaines statistiques n’ont pas pu être chargées."
        );
      }
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

              <Pressable
                  style={styles.chartBlock}
                  onPress={() =>
                    router.push({
                      pathname: "/performance-chart" as any,
                      params: {
                        exerciseId: String(exercise.exerciseId),
                      },
                    })
                  }
                >
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>
                      ÉVOLUTION e1RM
                    </Text>

                    <Text style={styles.chartCurrent}>
                      {exercise.current1rm != null
                        ? `${exercise.current1rm} kg`
                        : "—"}
                    </Text>
                  </View>

                  <MiniPerformanceChart
                    history={exercise.history ?? []}
                  />

                  <Text style={styles.chartHint}>
                    Appuie pour agrandir
                  </Text>
                </Pressable>

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

  chartBlock: {
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },

  chartTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  chartCurrent: {
    color: colors.yellow,
    fontSize: 15,
    fontWeight: "900",
  },

  chartShell: {
    alignItems: "center",
    overflow: "hidden",
  },

  chartHint: {
    color: colors.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },

  chartEmpty: {
    height: 125,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 18,
  },

  chartEmptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },


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
