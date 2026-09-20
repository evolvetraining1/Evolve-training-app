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
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { DailySteps, getStepsHistory } from "@/src/lib/steps-storage";
import { getStoredDailySteps, probePedometer, watchTodaySteps } from "@/src/lib/pedometer";
import { getMyStepsHistory, syncMyDailySteps } from "@/src/lib/steps-cloud";
import { localDateString } from "@/src/lib/date";

type Tab = "workouts" | "nutrition";
type Range = 7 | 30 | 90;

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


function StepsTrendChart({ data }: { data: DailySteps[] }) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(windowWidth - 72, 260);
  const height = 230;
  const left = 48;
  const right = 14;
  const top = 20;
  const bottom = 34;

  const points = [...data]
    .filter((item) => item.date && Number.isFinite(item.steps))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.muted}>
          Pas encore assez de jours enregistrés pour tracer une courbe.
        </Text>
      </View>
    );
  }

  const values = points.map((item) => item.steps);
  const maxValue = Math.max(1000, ...values);
  const roundedMax = Math.ceil(maxValue / 1000) * 1000;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const x = (index: number) =>
    left + (index / Math.max(points.length - 1, 1)) * graphWidth;

  const y = (value: number) =>
    top + ((roundedMax - value) / roundedMax) * graphHeight;

  const linePoints = points
    .map((item, index) => `${x(index)},${y(item.steps)}`)
    .join(" ");

  const gridValues = [
    roundedMax,
    roundedMax * 0.75,
    roundedMax * 0.5,
    roundedMax * 0.25,
    0,
  ];

  return (
    <View style={styles.chartShell}>
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

        <Polyline
          points={linePoints}
          fill="none"
          stroke="#F5B400"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((item, index) => (
          <Circle
            key={item.date}
            cx={x(index)}
            cy={y(item.steps)}
            r="3.5"
            fill="#F5B400"
          />
        ))}

        <SvgText x={left} y={height - 8} fill="#858585" fontSize="9">
          {new Date(`${points[0].date}T12:00:00`).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </SvgText>

        <SvgText
          x={width - right}
          y={height - 8}
          fill="#858585"
          fontSize="9"
          textAnchor="end"
        >
          {new Date(`${points[points.length - 1].date}T12:00:00`).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </SvgText>
      </Svg>
    </View>
  );
}

export default function HistoryStatsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"workouts" | "nutrition" | "steps">("workouts");
  const [range, setRange] = useState<Range>(30);
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
        getMyStepsHistory(90).catch(() => []),
        getStoredDailySteps(90).catch(() => []),
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

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)" as any);
  }, []);

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
    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    const sorted = [...stepsHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const recent = sorted.slice(-range);

    const todaySteps =
      sorted.find((item) => item.date === todayKey)?.steps ?? 0;

    const average =
      recent.length > 0
        ? Math.round(
            recent.reduce((sum, item) => sum + item.steps, 0) /
              recent.length
          )
        : 0;

    const best =
      recent.length > 0
        ? recent.reduce((max, item) =>
            item.steps > max.steps ? item : max
          )
        : null;

    return { today: todaySteps, average, best, recent };
  }, [stepsHistory, range]);

  if (loading) {


    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }

  return (
    <ScrollView
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revenir à la page précédente"
          hitSlop={10}
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
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

          {/* PÉRIODE PAS */}
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
              Nombre de pas par jour sur la période sélectionnée.
            </Text>

            <StepsTrendChart data={stepsStats.recent} />
          </View>
        </View>
      )}
    </ScrollView>
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.72 },
  backText: { color: colors.text, fontSize: 30, lineHeight: 31 },
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
