import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import Svg, {
  Circle,
  Line,
  Polyline,
  Text as SvgText,
} from "react-native-svg";

import * as ScreenOrientation from "expo-screen-orientation";

import { colors } from "@/src/theme";
import { getExercisePerformanceHistory } from "@/src/lib/api";

type Period = "week" | "month" | "year";

export default function PerformanceChartScreen() {
  const { exerciseId } =
    useLocalSearchParams<{ exerciseId?: string }>();

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<any>(null);
  const [period, setPeriod] =
    useState<Period>("month");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );

        const data =
          await getExercisePerformanceHistory();

        const found = (data ?? []).find(
          (item: any) =>
            String(item.exerciseId) ===
            String(exerciseId)
        );

        if (mounted) {
          setExercise(found ?? null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;

      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      ).catch(() => {});
    };
  }, [exerciseId]);

  const points = useMemo(() => {
    const history = exercise?.history ?? [];

    const days =
      period === "week"
        ? 7
        : period === "month"
        ? 30
        : 365;

    const limit = new Date();
    limit.setDate(limit.getDate() - days);

    return history
      .map((item: any) => ({
        ...item,
        value: Number(item.e1rm ?? 0),
      }))
      .filter(
        (item: any) =>
          item.date &&
          Number.isFinite(item.value) &&
          item.value > 0 &&
          new Date(item.date) >= limit
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );
  }, [exercise, period]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.yellow}
        />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          Mouvement introuvable
        </Text>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>
            ← RETOUR
          </Text>
        </Pressable>
      </View>
    );
  }

  const width =
    Dimensions.get("window").width - 60;

  const height =
    Math.max(Dimensions.get("window").height - 175, 240);

  const left = 58;
  const right = 24;
  const top = 22;
  const bottom = 42;

  const values = points.map((p: any) => p.value);

  let min =
    values.length ? Math.min(...values) : 0;

  let max =
    values.length ? Math.max(...values) : 100;

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

  const polyline = points
    .map(
      (point: any, index: number) =>
        `${x(index)},${y(point.value)}`
    )
    .join(" ");

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>
            EVOLVE TRAINING
          </Text>

          <Text style={styles.title}>
            {exercise.exerciseName}
          </Text>
        </View>

        <View style={styles.metrics}>
          <View>
            <Text style={styles.metricLabel}>
              e1RM ACTUEL
            </Text>
            <Text style={styles.metricValue}>
              {exercise.current1rm ?? "—"} KG
            </Text>
          </View>

          <View>
            <Text style={styles.metricLabel}>
              RECORD
            </Text>
            <Text style={styles.metricValue}>
              {exercise.pr ?? "—"} KG
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.close}
          onPress={() => router.back()}
        >
          <Text style={styles.closeText}>
            FERMER ✕
          </Text>
        </Pressable>
      </View>

      <View style={styles.periodSelector}>
        {(
          [
            ["week", "SEMAINE"],
            ["month", "MOIS"],
            ["year", "ANNÉE"],
          ] as [Period, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setPeriod(value)}
            style={[
              styles.periodButton,
              period === value &&
                styles.periodButtonActive,
            ]}
          >
            <Text
              style={[
                styles.periodText,
                period === value &&
                  styles.periodTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {points.length < 2 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>
            Pas assez de performances sur cette période.
          </Text>
        </View>
      ) : (
        <Svg width={width} height={height}>
          {[max, (max + min) / 2, min].map(
            (value, index) => {
              const gy = y(value);

              return (
                <Fragment key={index}>
                  <Line
                    x1={left}
                    x2={width - right}
                    y1={gy}
                    y2={gy}
                    stroke="rgba(255,255,255,0.12)"
                  />

                  <SvgText
                    x={left - 8}
                    y={gy + 4}
                    fill="#8f8f8f"
                    fontSize="11"
                    textAnchor="end"
                  >
                    {Math.round(value)}
                  </SvgText>
                </Fragment>
              );
            }
          )}

          <Polyline
            points={polyline}
            fill="none"
            stroke="#F5B400"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map(
            (point: any, index: number) => (
              <Circle
                key={`${point.date}-${index}`}
                cx={x(index)}
                cy={y(point.value)}
                r="5"
                fill="#F5B400"
              />
            )
          )}

          {points.map(
            (point: any, index: number) => {
              const step = Math.max(
                Math.ceil(points.length / 6),
                1
              );

              if (
                index % step !== 0 &&
                index !== points.length - 1
              ) {
                return null;
              }

              return (
                <SvgText
                  key={`date-${index}`}
                  x={x(index)}
                  y={height - 8}
                  fill="#888888"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {new Date(point.date)
                    .toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                </SvgText>
              );
            }
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#080808",
    paddingHorizontal: 28,
    paddingTop: 14,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080808",
    gap: 18,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  kicker: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 2,
  },

  metrics: {
    flexDirection: "row",
    gap: 45,
  },

  metricLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },

  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  close: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  closeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },

  periodSelector: {
    flexDirection: "row",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    overflow: "hidden",
    marginTop: 8,
  },

  periodButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },

  periodButtonActive: {
    backgroundColor: colors.yellow,
  },

  periodText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  periodTextActive: {
    color: "#080808",
  },

  empty: {
    color: colors.muted,
    fontSize: 15,
  },

  back: {
    color: colors.yellow,
    fontWeight: "900",
  },
});
