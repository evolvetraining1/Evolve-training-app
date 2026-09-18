import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Polyline,
  Text as SvgText,
} from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { Card, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { getCoachAthleteStepsHistory } from "@/src/lib/coachApi";

export default function CoachAthleteStepsScreen() {
  const { athleteId } = useLocalSearchParams<{ athleteId?: string }>();

  const [range, setRange] = useState<1 | 7 | 30 | 180 | 365>(30);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!athleteId) return;

    setLoading(true);
    setError("");

    getCoachAthleteStepsHistory(athleteId, range)
      .then(setHistory)
      .catch((e: any) =>
        setError(e?.message ?? "Impossible de charger les pas.")
      )
      .finally(() => setLoading(false));
  }, [athleteId, range]);

  useEffect(() => {
    if (!athleteId) return;

    const channel = supabase
      .channel(`coach-athlete-steps-${athleteId}-${range}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_steps",
          filter: `user_id=eq.${athleteId}`,
        },
        () => {
          void getCoachAthleteStepsHistory(athleteId, range)
            .then(setHistory)
            .catch((e: any) =>
              setError(e?.message ?? "Impossible d'actualiser les pas.")
            );
        }
      )
      .subscribe();

    const fallbackTimer = setInterval(() => {
      void getCoachAthleteStepsHistory(athleteId, range)
        .then(setHistory)
        .catch(() => {});
    }, 30_000);

    return () => {
      clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [athleteId, range]);

  const stats = useMemo(() => {
    if (!history.length) {
      return { average: 0, total: 0, best: 0 };
    }

    const total = history.reduce(
      (sum, day) => sum + Number(day.steps ?? 0),
      0
    );

    return {
      total,
      average: Math.round(total / history.length),
      best: Math.max(...history.map((day) => Number(day.steps ?? 0))),
    };
  }, [history]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ RETOUR ATHLÈTE</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="SUIVI COACH"
        title="Activité"
        subtitle="Historique des pas de l’athlète."
      />

      <View style={styles.ranges}>
        {[
          { days: 1, label: "1 J" },
          { days: 7, label: "7 J" },
          { days: 30, label: "1 M" },
          { days: 180, label: "6 M" },
          { days: 365, label: "1 A" },
        ].map((item) => (
          <Pressable
            key={item.days}
            onPress={() =>
              setRange(item.days as 1 | 7 | 30 | 180 | 365)
            }
            style={[
              styles.rangeButton,
              range === item.days && styles.rangeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                range === item.days && styles.rangeTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error ? (
        <>
          <Card style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {stats.average.toLocaleString("fr-FR")}
              </Text>
              <Text style={styles.summaryLabel}>MOYENNE / JOUR</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {stats.best.toLocaleString("fr-FR")}
              </Text>
              <Text style={styles.summaryLabel}>MEILLEUR JOUR</Text>
            </View>
          </Card>

          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>ÉVOLUTION DES PAS</Text>
            <StepsChart data={history} range={range} />
          </Card>

      </>
    ) : null}
        </ScrollView>
  );
}


function StepsChart({
  data,
  range,
}: {
  data: any[];
  range: 1 | 7 | 30 | 180 | 365;
}) {
  const width = Math.min(Dimensions.get("window").width - 40, 520);
  const height = 270;

  const left = 54;
  const right = 14;
  const top = 22;
  const bottom = 48;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const points = [...data]
    .filter(
      (item) =>
        item?.date &&
        Number.isFinite(Number(item?.steps))
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (!points.length) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.muted}>
          Pas encore de données pour tracer le graphique.
        </Text>
      </View>
    );
  }

  const values = points.map((item) => Number(item.steps ?? 0));
  const maxValue = Math.max(...values, 1);

  const roughStep = maxValue / 4;
  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(Math.max(roughStep, 1)))
  );

  const residual = roughStep / magnitude;

  const niceFactor =
    residual <= 1
      ? 1
      : residual <= 2
        ? 2
        : residual <= 5
          ? 5
          : 10;

  const yStep = niceFactor * magnitude;
  const yMax = Math.max(
    yStep,
    Math.ceil(maxValue / yStep) * yStep
  );

  const yTicks: number[] = [];
  for (let value = 0; value <= yMax + yStep / 2; value += yStep) {
    yTicks.push(value);
  }

  const x = (index: number) =>
    left +
    (points.length === 1
      ? graphWidth / 2
      : (index / (points.length - 1)) * graphWidth);

  const y = (value: number) =>
    top + graphHeight - (value / yMax) * graphHeight;

  const linePoints = points
    .map((item, index) => `${x(index)},${y(Number(item.steps ?? 0))}`)
    .join(" ");

  const maxXLabels =
    range <= 7 ? 7 :
    range <= 30 ? 6 :
    range <= 180 ? 6 :
    7;

  const labelIndexes = new Set<number>();

  if (points.length === 1) {
    labelIndexes.add(0);
  } else {
    const count = Math.min(maxXLabels, points.length);

    for (let i = 0; i < count; i++) {
      labelIndexes.add(
        Math.round((i / (count - 1)) * (points.length - 1))
      );
    }
  }

  const formatDate = (date: string) => {
    const parsed = new Date(`${date}T12:00:00`);

    if (range >= 180) {
      return parsed.toLocaleDateString("fr-FR", {
        month: "short",
        year: "2-digit",
      });
    }

    return parsed.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <View style={styles.chartShell}>
      <Svg width={width} height={height}>
        {yTicks.map((value) => (
          <Line
            key={`grid-${value}`}
            x1={left}
            x2={width - right}
            y1={y(value)}
            y2={y(value)}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1"
          />
        ))}

        {yTicks.map((value) => (
          <SvgText
            key={`ylabel-${value}`}
            x={left - 8}
            y={y(value) + 4}
            fill="#A4A3A0"
            fontSize="10"
            textAnchor="end"
          >
            {Math.round(value).toLocaleString("fr-FR")}
          </SvgText>
        ))}

        <Line
          x1={left}
          x2={left}
          y1={top}
          y2={height - bottom}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
        />

        <Line
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
        />

        {points.length > 1 ? (
          <Polyline
            points={linePoints}
            fill="none"
            stroke="#FFC400"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.map((item, index) => (
          <Circle
            key={`${item.date}-${index}`}
            cx={x(index)}
            cy={y(Number(item.steps ?? 0))}
            r="4"
            fill="#FFC400"
          />
        ))}

        {points.map((item, index) =>
          labelIndexes.has(index) ? (
            <SvgText
              key={`xlabel-${item.date}-${index}`}
              x={x(index)}
              y={height - 23}
              fill="#A4A3A0"
              fontSize="9"
              textAnchor="middle"
            >
              {formatDate(item.date)}
            </SvgText>
          ) : null
        )}

        <SvgText
          x={11}
          y={14}
          fill="#73726F"
          fontSize="9"
          fontWeight="700"
        >
          PAS
        </SvgText>

        <SvgText
          x={width - right}
          y={height - 5}
          fill="#73726F"
          fontSize="9"
          fontWeight="700"
          textAnchor="end"
        >
          DATE
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
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
  ranges: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  rangeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  rangeButtonActive: {
    borderColor: colors.yellow,
  },
  rangeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  rangeTextActive: {
    color: colors.yellow,
  },
  loading: {
    paddingVertical: 30,
  },
  error: {
    color: colors.red,
    fontWeight: "700",
  },
  summary: {
    flexDirection: "row",
    marginBottom: 22,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryValue: {
    color: colors.yellow,
    fontSize: 24,
    fontWeight: "900",
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
  },
  chartCard: {
    marginBottom: 22,
    overflow: "hidden",
  },
  chartTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  chartShell: {
    alignItems: "center",
    overflow: "hidden",
  },
  chartEmpty: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  dayCard: {
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  platform: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  stepsBlock: {
    alignItems: "flex-end",
  },
  steps: {
    color: colors.yellow,
    fontSize: 22,
    fontWeight: "900",
  },
  stepsLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
});
