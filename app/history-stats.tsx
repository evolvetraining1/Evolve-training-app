import { ScreenScrollView } from "@/src/components/screen-scroll-view";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { BackButton } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { DailySteps, getStepsHistory } from "@/src/lib/steps-storage";
import { getStoredDailySteps, probePedometer, watchTodaySteps } from "@/src/lib/pedometer";
import { getMyStepsHistory, syncMyDailySteps } from "@/src/lib/steps-cloud";
import { localDateString } from "@/src/lib/date";

type Range = 7 | 30 | 90;
type StepsPeriod = "day" | "week" | "month" | "year";

type StepsChartPoint = {
  key: string;
  label: string;
  value: number;
};

type WorkoutHistoryItem = {
  id: string;
  scheduled_for?: string | null;
  completed_at?: string | null;
  session_rpe?: number | null;
  workout_template_id?: string | null;
  workout_templates?: any;
  sets: any[];
};

type NutritionDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

function getNested(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mergeStepsHistory(...sources: DailySteps[][]): DailySteps[] {
  const byDate = new Map<string, DailySteps>();

  for (const source of sources) {
    for (const item of source) {
      if (!item?.date || !Number.isFinite(Number(item.steps))) continue;

      const normalized: DailySteps = {
        date: String(item.date),
        steps: Math.max(0, Math.round(Number(item.steps))),
        updatedAt: String(item.updatedAt ?? new Date().toISOString()),
      };
      const current = byDate.get(normalized.date);

      // Un compteur journalier ne peut qu'augmenter. Conserver la valeur la
      // plus haute évite qu'une ancienne copie locale écrase la lecture native.
      if (!current || normalized.steps >= current.steps) {
        byDate.set(normalized.date, normalized);
      }
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function workoutBlockLabel(notes?: string | null) {
  const value = String(notes ?? "").trim().toUpperCase();
  if (value.startsWith("WARM UP") || value.startsWith("WARMUP")) return "WARM UP";
  if (value.startsWith("STRENGTH WORK") || value.startsWith("STRENGTH")) return "STRENGTH";
  if (value.startsWith("RENFO")) return "RENFO";
  if (value.startsWith("WOD")) return "WOD";
  return "EXERCICE";
}

function compactPrescription(notes?: string | null) {
  return String(notes ?? "")
    .replace(/^(WARM\s*UP|WARMUP|STRENGTH\s*WORK|STRENGTH|RENFO|WOD)\s*[:\-–—]?\s*/i, "")
    .trim();
}

function formatLoad(value: unknown) {
  const load = Number(value ?? 0);
  return Number.isInteger(load) ? String(load) : load.toFixed(1).replace(".", ",");
}

function dateAtNoon(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  }
  return new Date(`${value}T12:00:00`);
}

function addDays(value: Date, days: number) {
  const next = dateAtNoon(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(value: Date) {
  const date = dateAtNoon(value);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return addDays(date, mondayOffset);
}

function stepsPeriodBounds(period: StepsPeriod, offset: number) {
  const today = dateAtNoon(new Date());
  let start = today;
  let naturalEnd = today;

  if (period === "day") {
    start = addDays(today, offset);
    naturalEnd = start;
  } else if (period === "week") {
    start = addDays(startOfWeek(today), offset * 7);
    naturalEnd = addDays(start, 6);
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12);
    naturalEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
  } else {
    start = new Date(today.getFullYear() + offset, 0, 1, 12);
    naturalEnd = new Date(start.getFullYear(), 11, 31, 12);
  }

  const end = offset === 0 && naturalEnd > today ? today : naturalEnd;
  return { start, end };
}

function formatPeriodTitle(period: StepsPeriod, start: Date, end: Date) {
  if (period === "day") {
    return start.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (period === "year") return String(start.getFullYear());

  const startLabel = start.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function averageSteps(data: DailySteps[]) {
  if (!data.length) return 0;
  return Math.round(data.reduce((sum, item) => sum + item.steps, 0) / data.length);
}

function NutritionTrendChart({ data }: { data: NutritionDay[] }) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(windowWidth - 72, 260);
  const height = 220;
  const left = 38;
  const right = 12;
  const top = 18;
  const bottom = 30;

  const series = [
    { key: "protein", label: "Protéines", color: "#F5B400" },
    { key: "carbs", label: "Glucides", color: "#5CC8FF" },
    { key: "fat", label: "Lipides", color: "#E96B6B" },
  ] as const;

  const values = data.flatMap((day) => [day.protein, day.carbs, day.fat]);
  const max = Math.max(10, ...values);
  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const x = (index: number) =>
    left + (index / Math.max(data.length - 1, 1)) * graphWidth;

  const y = (value: number) => top + ((max - value) / max) * graphHeight;

  if (data.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.muted}>Pas encore assez de jours enregistrés pour tracer une courbe.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.legendRow}>
        {series.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chartShell}>
        <Svg width={width} height={height}>
          {[max, max / 2, 0].map((value, index) => {
            const gy = y(value);
            return (
              <Fragment key={`grid-${index}`}>
                <Line
                  x1={left}
                  x2={width - right}
                  y1={gy}
                  y2={gy}
                  stroke="rgba(255,255,255,0.09)"
                  strokeWidth="1"
                />
                <SvgText
                  x={left - 6}
                  y={gy + 4}
                  fill="#858585"
                  fontSize="10"
                  textAnchor="end"
                >
                  {Math.round(value)}
                </SvgText>
              </Fragment>
            );
          })}

          {series.map((serie) => {
            const points = data
              .map((day, index) => `${x(index)},${y(day[serie.key])}`)
              .join(" ");

            return (
              <Fragment key={serie.key}>
                <Polyline
                  points={points}
                  fill="none"
                  stroke={serie.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {data.map((day, index) => (
                  <Circle
                    key={`${serie.key}-${day.date}`}
                    cx={x(index)}
                    cy={y(day[serie.key])}
                    r="2.7"
                    fill={serie.color}
                  />
                ))}
              </Fragment>
            );
          })}

          <SvgText x={left} y={height - 7} fill="#858585" fontSize="9">
            {new Date(`${data[0].date}T12:00:00`).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </SvgText>
          <SvgText
            x={width - right}
            y={height - 7}
            fill="#858585"
            fontSize="9"
            textAnchor="end"
          >
            {new Date(`${data[data.length - 1].date}T12:00:00`).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}


function StepsTrendChart({
  data,
  average,
}: {
  data: StepsChartPoint[];
  average: number;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const viewportWidth = Math.max(windowWidth - 72, 260);
  const left = 50;
  const right = 12;
  const top = 24;
  const bottom = 42;
  const height = 250;
  const minimumBarSlot = data.length > 12 ? 29 : 34;
  const width = Math.max(
    viewportWidth,
    left + right + data.length * minimumBarSlot
  );

  if (!data.length) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.muted}>
          Aucune donnée de pas pour cette période.
        </Text>
      </View>
    );
  }

  const values = data.map((item) => item.value);
  const maxValue = Math.max(1000, ...values);
  const roundedMax = Math.ceil(maxValue / 5000) * 5000;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;
  const slotWidth = graphWidth / Math.max(data.length, 1);
  const barWidth = Math.max(7, Math.min(18, slotWidth * 0.58));

  const y = (value: number) =>
    top + ((roundedMax - value) / roundedMax) * graphHeight;

  const gridValues = [
    roundedMax,
    roundedMax * 0.75,
    roundedMax * 0.5,
    roundedMax * 0.25,
    0,
  ];

  const averageY = y(Math.min(average, roundedMax));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stepsChartScroll}
    >
      <Svg width={width} height={height}>
        {gridValues.map((value, index) => {
          const gy = y(value);

          return (
            <Fragment key={`steps-grid-${index}`}>
              <Line
                x1={left}
                x2={width - right}
                y1={gy}
                y2={gy}
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="1"
              />

              <SvgText
                x={left - 7}
                y={gy + 4}
                fill="#858585"
                fontSize="10"
                textAnchor="end"
              >
                {Math.round(value).toLocaleString("fr-FR")}
              </SvgText>
            </Fragment>
          );
        })}

        {average > 0 ? (
          <>
            <Line
              x1={left}
              x2={width - right}
              y1={averageY}
              y2={averageY}
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <Rect x={2} y={averageY - 12} width={43} height={23} rx={6} fill="#F4F4F4" />
            <SvgText x={23.5} y={averageY + 4} fill="#111111" fontSize="9" fontWeight="900" textAnchor="middle">
              MOY.
            </SvgText>
          </>
        ) : null}

        {data.map((item, index) => {
          const centerX = left + slotWidth * index + slotWidth / 2;
          const barTop = y(item.value);
          return (
            <Fragment key={item.key}>
              <Rect
                x={centerX - barWidth / 2}
                y={barTop}
                width={barWidth}
                height={Math.max(2, top + graphHeight - barTop)}
                rx={barWidth / 2}
                fill={item.value > 0 ? colors.yellow : "rgba(255,255,255,0.12)"}
              />
              <SvgText
                x={centerX}
                y={height - 13}
                fill="#969696"
                fontSize={data.length > 20 ? "8" : "9"}
                fontWeight="700"
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

export default function HistoryStatsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"workouts" | "nutrition" | "steps">("workouts");
  const [range, setRange] = useState<Range>(30);
  const [stepsPeriod, setStepsPeriod] = useState<StepsPeriod>("week");
  const [stepsPeriodOffset, setStepsPeriodOffset] = useState(0);
  const [workouts, setWorkouts] = useState<WorkoutHistoryItem[]>([]);
  const [nutrition, setNutrition] = useState<NutritionDay[]>([]);
  const [stepsHistory, setStepsHistory] = useState<DailySteps[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      const since = new Date();
      since.setDate(since.getDate() - 89);
      const sinceDate = since.toISOString().slice(0, 10);

      const [
        sessionsResult,
        nutritionResult,
        legacyStepsResult,
        cloudStepsResult,
        nativeStepsResult,
        pedometerResult,
      ] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select(`
            id,
            scheduled_for,
            completed_at,
            session_rpe,
            workout_template_id,
            workout_templates (
              id,
              name,
              week_number,
              day_number
            )
          `)
          .eq("athlete_id", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(100),

        supabase
          .from("nutrition_entries")
          .select("eaten_on, calories, protein_g, carbs_g, fat_g, fiber_g")
          .eq("user_id", user.id)
          .gte("eaten_on", sinceDate)
          .order("eaten_on", { ascending: true }),
        getStepsHistory().catch(() => []),
        getMyStepsHistory(740).catch(() => []),
        getStoredDailySteps(740).catch(() => []),
        probePedometer().catch(() => null),
      ]);

      if (sessionsResult.error) throw sessionsResult.error;
      if (nutritionResult.error) throw nutritionResult.error;

      const sessionRows = sessionsResult.data ?? [];
      const sessionIds = sessionRows.map((session: any) => session.id).filter(Boolean);

      let performedSets: any[] = [];

      if (sessionIds.length) {
        const { data, error: setsError } = await supabase
          .from("performed_sets")
          .select(`
            id,
            workout_session_id,
            workout_exercise_id,
            set_number,
            reps,
            load_kg,
            rpe,
            completed,
            workout_exercises (
              id,
              position,
              prescription_notes,
              exercises ( id, name )
            )
          `)
          .in("workout_session_id", sessionIds)
          .eq("completed", true)
          .order("set_number", { ascending: true });

        if (setsError) throw setsError;
        performedSets = data ?? [];
      }

      setWorkouts(
        sessionRows.map((session: any) => ({
          ...session,
          sets: performedSets.filter(
            (set: any) => String(set.workout_session_id) === String(session.id)
          ),
        }))
      );

      const nutritionByDay = new Map<string, NutritionDay>();

      for (const entry of nutritionResult.data ?? []) {
        const date = String(entry.eaten_on ?? "");
        if (!date) continue;

        const current = nutritionByDay.get(date) ?? {
          date,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        };

        current.calories += Number(entry.calories ?? 0);
        current.protein += Number(entry.protein_g ?? 0);
        current.carbs += Number(entry.carbs_g ?? 0);
        current.fat += Number(entry.fat_g ?? 0);
        current.fiber += Number(entry.fiber_g ?? 0);
        nutritionByDay.set(date, current);
      }

      setNutrition(
        Array.from(nutritionByDay.values()).map((day) => ({
          ...day,
          calories: Math.round(day.calories),
          protein: Math.round(day.protein * 10) / 10,
          carbs: Math.round(day.carbs * 10) / 10,
          fat: Math.round(day.fat * 10) / 10,
          fiber: Math.round(day.fiber * 10) / 10,
        }))
      );

      const nativeHistory = (nativeStepsResult ?? []).map((item) => ({
        date: item.date,
        steps: item.steps,
        updatedAt: item.updatedAt > 0
          ? new Date(item.updatedAt).toISOString()
          : new Date().toISOString(),
      }));

      const liveToday = pedometerResult?.todaySteps != null
        ? [{
            date: localDateString(),
            steps: pedometerResult.todaySteps,
            updatedAt: new Date().toISOString(),
          }]
        : [];

      setStepsHistory(
        mergeStepsHistory(
          Array.isArray(legacyStepsResult) ? legacyStepsResult : [],
          Array.isArray(cloudStepsResult) ? cloudStepsResult : [],
          nativeHistory,
          liveToday
        )
      );

      if (pedometerResult?.todaySteps != null) {
        void syncMyDailySteps(pedometerResult.todaySteps, { force: true }).catch(
          (syncError) => console.warn("History steps sync failed:", syncError)
        );
      }
    } catch (e: any) {
      console.error("HISTORY STATS LOAD ERROR", e);
      setError(e?.message ?? "Impossible de charger l’historique.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (tab !== "steps") return;

    const subscription = watchTodaySteps(
      (steps) => {
        const today: DailySteps = {
          date: localDateString(),
          steps,
          updatedAt: new Date().toISOString(),
        };

        setStepsHistory((current) => mergeStepsHistory(current, [today]));
        void syncMyDailySteps(steps).catch((syncError) =>
          console.warn("Live history steps sync failed:", syncError)
        );
      },
      (stepError) => console.warn("Live history steps failed:", stepError),
      10_000
    );

    return () => subscription.remove();
  }, [tab]);

  const rangedNutrition = useMemo(() => {
    if (!nutrition.length) return [];
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - (range - 1));
    const thresholdDate = threshold.toISOString().slice(0, 10);
    return nutrition.filter((day) => day.date >= thresholdDate);
  }, [nutrition, range]);

  const nutritionAverages = useMemo(() => {
    if (!rangedNutrition.length) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }

    const totals = rangedNutrition.reduce(
      (acc, day) => ({
        calories: acc.calories + day.calories,
        protein: acc.protein + day.protein,
        carbs: acc.carbs + day.carbs,
        fat: acc.fat + day.fat,
        fiber: acc.fiber + day.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    const count = rangedNutrition.length;
    return {
      calories: Math.round(totals.calories / count),
      protein: Math.round(totals.protein / count),
      carbs: Math.round(totals.carbs / count),
      fat: Math.round(totals.fat / count),
      fiber: Math.round(totals.fiber / count),
    };
  }, [rangedNutrition]);

  const stepsStats = useMemo(() => {
    const sorted = [...stepsHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const todayKey = localDateString();
    const todaySteps =
      sorted.find((item) => item.date === todayKey)?.steps ?? 0;
    const { start, end } = stepsPeriodBounds(stepsPeriod, stepsPeriodOffset);
    const previous = stepsPeriodBounds(stepsPeriod, stepsPeriodOffset - 1);
    const elapsedDays = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 86_400_000)
    );
    const previousComparableEnd = stepsPeriodOffset === 0
      ? addDays(previous.start, elapsedDays)
      : previous.end;
    const startKey = localDateString(start);
    const endKey = localDateString(end);
    const previousStartKey = localDateString(previous.start);
    const previousEndKey = localDateString(previousComparableEnd);
    const currentRows = sorted.filter(
      (item) => item.date >= startKey && item.date <= endKey
    );
    const previousRows = sorted.filter(
      (item) => item.date >= previousStartKey && item.date <= previousEndKey
    );
    const average = averageSteps(currentRows);
    const previousAverage = averageSteps(previousRows);
    const change = previousAverage > 0
      ? Math.round(((average - previousAverage) / previousAverage) * 100)
      : null;
    const best = currentRows.length
      ? currentRows.reduce((max, item) => item.steps > max.steps ? item : max)
      : null;
    const stepsByDate = new Map(currentRows.map((item) => [item.date, item.steps]));
    const chartPoints: StepsChartPoint[] = [];

    if (stepsPeriod === "year") {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
      const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1, 12);

      while (cursor <= finalMonth) {
        const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        const monthRows = currentRows.filter((item) => item.date.startsWith(monthKey));
        chartPoints.push({
          key: monthKey,
          label: cursor.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase(),
          value: averageSteps(monthRows),
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      let cursor = dateAtNoon(start);
      while (cursor <= end) {
        const key = localDateString(cursor);
        const label = stepsPeriod === "month"
          ? String(cursor.getDate()).padStart(2, "0")
          : stepsPeriod === "day"
          ? cursor.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase()
          : cursor.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase();
        chartPoints.push({ key, label, value: stepsByDate.get(key) ?? 0 });
        cursor = addDays(cursor, 1);
      }
    }

    return {
      today: todaySteps,
      average,
      best,
      change,
      chartPoints,
      periodTitle: formatPeriodTitle(stepsPeriod, start, end),
    };
  }, [stepsHistory, stepsPeriod, stepsPeriodOffset]);

  if (loading) {


    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }

  return (
    <ScreenScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.page,
        { paddingTop: Math.max(insets.top + 18, 44) },
      ]}
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
      <View style={styles.header}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MON SUIVI</Text>
          <Text style={styles.title}>Historique & stats</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("workouts")}
          style={[styles.tab, tab === "workouts" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "workouts" && styles.tabTextActive]}>
            SÉANCES
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("nutrition")}
          style={[styles.tab, tab === "nutrition" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "nutrition" && styles.tabTextActive]}>
            NUTRITION
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("steps")}
          style={[styles.tab, tab === "steps" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "steps" && styles.tabTextActive]}>
            PAS
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === "workouts" ? (
        <View style={styles.sectionGap}>
          <View>
            <Text style={styles.sectionTitle}>Séances terminées</Text>
            <Text style={styles.muted}>{workouts.length} séance(s) enregistrée(s)</Text>
          </View>

          {workouts.length ? (
            workouts.map((session) => {
              const template = getNested(session.workout_templates);
              const expanded = expandedSessionId === session.id;
              const exerciseGroups = new Map<
                string,
                {
                  id: string;
                  name: string;
                  position: number;
                  notes: string;
                  sets: any[];
                }
              >();

              for (const set of session.sets) {
                const workoutExercise = getNested(set.workout_exercises);
                const exercise = getNested(workoutExercise?.exercises);
                const name = exercise?.name ?? "Exercice";
                const key = String(
                  set.workout_exercise_id ?? workoutExercise?.id ?? set.id
                );
                const current = exerciseGroups.get(key) ?? {
                  id: key,
                  name,
                  position: Number(workoutExercise?.position ?? 999),
                  notes: String(workoutExercise?.prescription_notes ?? ""),
                  sets: [] as any[],
                };
                current.sets.push(set);
                exerciseGroups.set(key, current);
              }

              const exercises = [...exerciseGroups.values()]
                .map((exercise) => ({
                  ...exercise,
                  sets: exercise.sets.slice().sort(
                    (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
                  ),
                }))
                .sort((a, b) => a.position - b.position);

              const totalVolume = session.sets.reduce(
                (sum, set) =>
                  sum + Number(set.load_kg ?? 0) * Number(set.reps ?? 0),
                0
              );

              return (
                <View key={session.id} style={[styles.card, styles.sessionCard]}>
                  <Pressable
                    onPress={() =>
                      setExpandedSessionId(expanded ? null : session.id)
                    }
                    style={styles.sessionHead}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{template?.name ?? "Séance"}</Text>
                      <Text style={styles.sessionDate}>
                        {formatDate(session.completed_at ?? session.scheduled_for)}
                        {template?.week_number ? ` • S${template.week_number}` : ""}
                        {template?.day_number ? ` J${template.day_number}` : ""}
                      </Text>
                    </View>
                    <View style={styles.sessionMeta}>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>TERMINÉE</Text>
                      </View>
                      <Text style={styles.chevron}>{expanded ? "⌃" : "⌄"}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.sessionSummary}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{exercises.length}</Text>
                      <Text style={styles.summaryLabel}>EXERCICES</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{session.sets.length}</Text>
                      <Text style={styles.summaryLabel}>SÉRIES</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>
                        {totalVolume > 0
                          ? `${Math.round(totalVolume).toLocaleString("fr-FR")} kg`
                          : "—"}
                      </Text>
                      <Text style={styles.summaryLabel}>VOLUME</Text>
                    </View>
                  </View>

                  {expanded ? (
                    <View style={styles.expandedContent}>
                      {exercises.map((exercise) => {
                        const first = exercise.sets[0];
                        const identical = exercise.sets.length > 1 && exercise.sets.every(
                          (set) =>
                            Number(set.reps ?? 0) === Number(first?.reps ?? 0) &&
                            Number(set.load_kg ?? 0) === Number(first?.load_kg ?? 0) &&
                            Number(set.rpe ?? 0) === Number(first?.rpe ?? 0)
                        );

                        return (
                          <View key={exercise.id} style={styles.exerciseBlock}>
                            <View style={styles.exerciseHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.blockLabel}>
                                  {workoutBlockLabel(exercise.notes)}
                                </Text>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                              </View>
                              <Text style={styles.exerciseSetCount}>
                                {exercise.sets.length} série{exercise.sets.length > 1 ? "s" : ""}
                              </Text>
                            </View>

                            {compactPrescription(exercise.notes) ? (
                              <Text style={styles.exercisePrescription}>
                                {compactPrescription(exercise.notes)}
                              </Text>
                            ) : null}

                            <Text style={styles.performedLabel}>RÉALISÉ</Text>

                            {identical ? (
                              <View style={[styles.setRow, styles.compactSetRow]}>
                                <Text style={styles.setPerformance}>
                                  {exercise.sets.length} × {Number(first?.reps ?? 0)} reps
                                  {Number(first?.load_kg ?? 0) > 0
                                    ? ` @ ${formatLoad(first?.load_kg)} kg`
                                    : ""}
                                </Text>
                                <Text style={styles.setRpe}>
                                  {first?.rpe != null ? `RPE ${first.rpe}` : ""}
                                </Text>
                              </View>
                            ) : (
                              exercise.sets.map((set: any) => (
                                <View key={set.id} style={styles.setRow}>
                                  <Text style={styles.setNumber}>S{set.set_number}</Text>
                                  <Text style={styles.setPerformance}>
                                    {Number(set.reps ?? 0)} reps
                                    {Number(set.load_kg ?? 0) > 0
                                      ? ` @ ${formatLoad(set.load_kg)} kg`
                                      : ""}
                                  </Text>
                                  <Text style={styles.setRpe}>
                                    {set.rpe != null ? `RPE ${set.rpe}` : ""}
                                  </Text>
                                </View>
                              ))
                            )}
                          </View>
                        );
                      })}

                      {!session.sets.length ? (
                        <Text style={styles.muted}>Aucune série détaillée enregistrée.</Text>
                      ) : null}

                      {session.session_rpe != null ? (
                        <View style={styles.sessionRpeRow}>
                          <Text style={styles.sessionRpeLabel}>RESSENTI DE LA SÉANCE</Text>
                          <Text style={styles.sessionRpe}>RPE {session.session_rpe}/10</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.card}>
              <Text style={styles.muted}>Aucune séance terminée pour le moment.</Text>
            </View>
          )}
        </View>
      ) : tab === "nutrition" ? (
        <View style={styles.sectionGap}>
          <View>
            <Text style={styles.sectionTitle}>Évolution des macros</Text>
            <Text style={styles.muted}>Consommation réellement enregistrée dans le suivi nutrition.</Text>
          </View>

          <View style={styles.rangeRow}>
            {([7, 30, 90] as Range[]).map((value) => (
              <Pressable
                key={value}
                onPress={() => setRange(value)}
                style={[styles.rangeButton, range === value && styles.rangeButtonActive]}
              >
                <Text style={[styles.rangeText, range === value && styles.rangeTextActive]}>
                  {value} J
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{nutritionAverages.calories}</Text>
              <Text style={styles.metricLabel}>kcal / jour</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{nutritionAverages.protein} g</Text>
              <Text style={styles.metricLabel}>protéines</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{nutritionAverages.carbs} g</Text>
              <Text style={styles.metricLabel}>glucides</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{nutritionAverages.fat} g</Text>
              <Text style={styles.metricLabel}>lipides</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.chartTitle}>MACROS CONSOMMÉES / JOUR</Text>
            <NutritionTrendChart data={rangedNutrition} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Base prête pour les prochaines stats</Text>
            <Text style={styles.muted}>
              Cet écran est prévu pour recevoir les prochains indicateurs sans surcharger le dashboard principal.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.sectionGap}>
          <View>
            <Text style={styles.sectionTitle}>Activité quotidienne</Text>
            <Text style={styles.muted}>Suivi de tes pas enregistrés par Evolve.</Text>
          </View>

          <View style={styles.stepsPeriodTabs}>
            {([
              ["day", "JOUR"],
              ["week", "SEMAINE"],
              ["month", "MOIS"],
              ["year", "ANNÉE"],
            ] as [StepsPeriod, string][]).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => {
                  setStepsPeriod(value);
                  setStepsPeriodOffset(0);
                }}
                style={[
                  styles.stepsPeriodButton,
                  stepsPeriod === value && styles.stepsPeriodButtonActive,
                ]}
              >
                <Text style={[
                  styles.stepsPeriodText,
                  stepsPeriod === value && styles.stepsPeriodTextActive,
                ]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.periodNavigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Période précédente"
              onPress={() => setStepsPeriodOffset((value) => value - 1)}
              style={({ pressed }) => [styles.periodArrow, pressed && styles.pressed]}
            >
              <Text style={styles.periodArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.periodTitle}>{stepsStats.periodTitle.toUpperCase()}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Période suivante"
              disabled={stepsPeriodOffset >= 0}
              onPress={() => setStepsPeriodOffset((value) => Math.min(0, value + 1))}
              style={({ pressed }) => [
                styles.periodArrow,
                stepsPeriodOffset >= 0 && styles.periodArrowDisabled,
                pressed && stepsPeriodOffset < 0 && styles.pressed,
              ]}
            >
              <Text style={styles.periodArrowText}>›</Text>
            </Pressable>
          </View>

          {stepsStats.change != null ? (
            <View style={styles.changeBadge}>
              <Text style={styles.changeBadgeText}>
                {stepsStats.change > 0 ? "▲" : stepsStats.change < 0 ? "▼" : "•"} {Math.abs(stepsStats.change)}% vs période précédente
              </Text>
            </View>
          ) : null}

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stepsStats.today.toLocaleString("fr-FR")}</Text>
              <Text style={styles.metricLabel}>PAS AUJOURD’HUI</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stepsStats.average.toLocaleString("fr-FR")}</Text>
              <Text style={styles.metricLabel}>MOYENNE / JOUR</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{(stepsStats.best?.steps ?? 0).toLocaleString("fr-FR")}</Text>
              <Text style={styles.metricLabel}>MEILLEUR JOUR</Text>
            </View>
          </View>

          {stepsStats.best ? (
            <Text style={styles.muted}>
              Record le {new Date(`${stepsStats.best.date}T12:00:00`).toLocaleDateString("fr-FR")}
            </Text>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>ÉVOLUTION DES PAS</Text>
            <Text style={styles.muted}>
              {stepsPeriod === "year"
                ? "Moyenne quotidienne pour chaque mois."
                : "Nombre de pas pour chaque jour de la période."}
            </Text>

            <StepsTrendChart data={stepsStats.chartPoints} average={stepsStats.average} />
          </View>
        </View>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 20, paddingBottom: 100 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  pressed: { opacity: 0.72 },
  eyebrow: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    marginBottom: 22,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.yellow },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  tabTextActive: { color: "#111111" },
  error: {
    color: colors.red,
    fontWeight: "800",
    marginBottom: 14,
  },
  sectionGap: { gap: 14 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  sessionCard: { padding: 0, overflow: "hidden" },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  sessionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 13,
  },
  sessionDate: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 3 },
  sessionMeta: { alignItems: "flex-end", gap: 4 },
  completedBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(58, 196, 116, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(58, 196, 116, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedBadgeText: { color: colors.green, fontSize: 9, fontWeight: "900" },
  chevron: { color: colors.muted, fontSize: 20 },
  sessionSummary: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface2,
    paddingVertical: 11,
  },
  summaryItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  summaryDivider: { width: 1, backgroundColor: colors.borderSoft },
  summaryValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  expandedContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 12,
  },
  exerciseBlock: {
    gap: 7,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(255,255,255,0.018)",
  },
  exerciseHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  blockLabel: { color: colors.yellow, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 3 },
  exerciseSetCount: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  exercisePrescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  performedLabel: {
    color: colors.green,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 2,
  },
  setRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: colors.surface2,
    paddingHorizontal: 10,
  },
  compactSetRow: { paddingLeft: 12 },
  setNumber: { color: colors.muted, width: 34, fontSize: 11, fontWeight: "800" },
  setPerformance: { color: colors.text, flex: 1, fontSize: 13, fontWeight: "800" },
  setRpe: { color: colors.yellow, fontSize: 11, fontWeight: "900" },
  sessionRpeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  sessionRpeLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  sessionRpe: { color: colors.yellow, fontSize: 12, fontWeight: "900" },
  rangeRow: { flexDirection: "row", gap: 8 },
  rangeButton: {
    paddingHorizontal: 18,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
  },
  rangeButtonActive: { borderColor: colors.yellow },
  rangeText: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  rangeTextActive: { color: colors.yellow },
  stepsPeriodTabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepsPeriodButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepsPeriodButtonActive: { backgroundColor: colors.yellow },
  stepsPeriodText: { color: colors.muted, fontSize: 9, fontWeight: "900" },
  stepsPeriodTextActive: { color: "#111111" },
  periodNavigation: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  periodArrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodArrowDisabled: { opacity: 0.28 },
  periodArrowText: { color: colors.text, fontSize: 28, lineHeight: 29 },
  periodTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.6,
  },
  changeBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "rgba(245,180,0,0.13)",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  changeBadgeText: { color: colors.yellow, fontSize: 10, fontWeight: "900" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48%",
    minHeight: 86,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    justifyContent: "center",
  },
  metricValue: { color: colors.yellow, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  chartTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chartShell: { alignItems: "center", overflow: "hidden" },
  stepsChartScroll: { minWidth: "100%" },
  chartEmpty: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
});
