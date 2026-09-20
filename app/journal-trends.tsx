import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { loadWellnessTrends, WellnessTrendRow } from "@/src/lib/wellness-api";
import { colors, radius } from "@/src/theme";
import { goBackOrReplace } from "@/src/components/ui";

type MetricKey = "recovery_score" | "stress_score" | "readiness_score" | "habit_score";
type PeriodKey = "S" | "M" | "6M";

const METRICS: Array<{ key: MetricKey; label: string; inverse?: boolean; explanation: string }> = [
  { key: "recovery_score", label: "RÉCUPÉRATION", explanation: "Synthèse du sommeil, des sensations physiques, de l’énergie et des comportements qui soutiennent la récupération." },
  { key: "stress_score", label: "STRESS", inverse: true, explanation: "Estimation de la charge perçue et des facteurs défavorables. Un score bas est favorable." },
  { key: "readiness_score", label: "DISPONIBILITÉ", explanation: "Croisement entre récupération, stress et habitudes. Il aide à contextualiser la séance, sans remplacer ton ressenti." },
  { key: "habit_score", label: "HABITUDES", explanation: "Qualité moyenne des comportements suivis : nutrition, hydratation, sommeil, récupération et activité." },
];

const PERIODS: Record<PeriodKey, number> = { S: 7, M: 30, "6M": 183 };

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function trendMessage(metric: typeof METRICS[number], change: number | null) {
  if (change == null) return "Continue à remplir ton journal pour obtenir une comparaison fiable.";
  const favorableChange = metric.inverse ? -change : change;
  if (Math.abs(change) < 4) return "La tendance est stable par rapport à la période précédente.";
  if (favorableChange > 0) return "La tendance évolue favorablement. Observe les routines les plus régulières sur cette période.";
  return "La tendance est moins favorable. Regarde le sommeil, le stress et la charge des derniers jours avant d’ajuster l’entraînement.";
}

export default function JournalTrendsScreen() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<WellnessTrendRow[]>([]);
  const [metricKey, setMetricKey] = useState<MetricKey>("recovery_score");
  const [period, setPeriod] = useState<PeriodKey>("M");

  useEffect(() => {
    let active = true;
    loadWellnessTrends(366)
      .then((data) => active && setRows(data))
      .catch((nextError: any) => active && setError(nextError?.message ?? "Impossible de charger les tendances."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const metric = METRICS.find((item) => item.key === metricKey) ?? METRICS[0];
  const periodDays = PERIODS[period];
  const currentRows = useMemo(
    () => rows.filter((row) => row.score_date >= dateDaysAgo(periodDays - 1)),
    [rows, periodDays]
  );
  const previousRows = useMemo(() => {
    const start = dateDaysAgo(periodDays * 2 - 1);
    const end = dateDaysAgo(periodDays);
    return rows.filter((row) => row.score_date >= start && row.score_date <= end);
  }, [rows, periodDays]);
  const values = currentRows.map((row) => row[metricKey]).filter((value): value is number => value != null);
  const currentAverage = average(values);
  const previousAverage = average(previousRows.map((row) => row[metricKey]).filter((value): value is number => value != null));
  const change = currentAverage != null && previousAverage != null ? currentAverage - previousAverage : null;
  const chartWidth = Math.max(280, width - 72);
  const chartHeight = 220;
  const points = values.map((value, index) => ({
    x: values.length <= 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth,
    y: chartHeight - (value / 100) * chartHeight,
    value,
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.yellow} size="large" /></View>;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBackOrReplace()}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>JOURNAL EVOLVE</Text>
          <Text style={styles.title}>TENDANCES</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricTabs}>
        {METRICS.map((item) => (
          <Pressable key={item.key} onPress={() => setMetricKey(item.key)} style={[styles.metricTab, metricKey === item.key && styles.metricTabActive]}>
            <Text style={[styles.metricTabText, metricKey === item.key && styles.metricTabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.averageLabel}>MOYENNE</Text>
          <Text style={styles.averageValue}>{currentAverage ?? "--"}</Text>
        </View>
        <View style={styles.periodTabs}>
          {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
            <Pressable key={key} onPress={() => setPeriod(key)} style={[styles.periodTab, period === key && styles.periodTabActive]}>
              <Text style={[styles.periodText, period === key && styles.periodTextActive]}>{key}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.changeRow}>
        <Text style={[styles.changeBadge, { color: change == null ? colors.muted : (metric.inverse ? change <= 0 : change >= 0) ? colors.green : colors.red }]}>
          {change == null ? "Comparaison en attente" : `${change > 0 ? "+" : ""}${change} points vs période précédente`}
        </Text>
      </View>

      <Text style={styles.insight}>{trendMessage(metric, change)}</Text>

      <View style={styles.chartCard}>
        {points.length ? (
          <Svg width={chartWidth} height={chartHeight + 20}>
            {[0, 25, 50, 75, 100].map((level) => (
              <Line key={level} x1={0} x2={chartWidth} y1={chartHeight - (level / 100) * chartHeight} y2={chartHeight - (level / 100) * chartHeight} stroke="#2C2C2F" strokeWidth={1} />
            ))}
            {path ? <Path d={path} fill="none" stroke={colors.yellow} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
            {points.map((point, index) => <Circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={4} fill={colors.yellow} stroke="#FFE39A" strokeWidth={1} />)}
          </Svg>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyTitle}>Pas encore assez de données</Text>
            <Text style={styles.emptyText}>Enregistre plusieurs journaux pour faire apparaître la courbe.</Text>
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{metric.label}, QU’EST-CE QUE C’EST ?</Text>
        <Text style={styles.infoText}>{metric.explanation}</Text>
        <Text style={styles.infoText}>Le calcul utilise uniquement les réponses réellement disponibles, indique son niveau de confiance et privilégie ta tendance personnelle lorsque suffisamment de données existent.</Text>
      </View>

      {error ? <Text selectable style={styles.error}>{error}</Text> : null}
      <Text style={styles.disclaimer}>Outil de suivi et de coaching, non destiné au diagnostic médical.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 58, paddingBottom: 90, gap: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  backText: { color: colors.text, fontSize: 34, lineHeight: 36 },
  eyebrow: { color: colors.yellow, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 31, fontWeight: "900", letterSpacing: -0.5, marginTop: 3 },
  metricTabs: { gap: 8, paddingRight: 20 },
  metricTab: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, paddingHorizontal: 13, paddingVertical: 10 },
  metricTabActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.12)" },
  metricTabText: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  metricTabTextActive: { color: colors.yellow },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  averageLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  averageValue: { color: colors.text, fontSize: 54, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -2 },
  periodTabs: { flexDirection: "row", borderRadius: 16, backgroundColor: colors.surface, padding: 5 },
  periodTab: { width: 52, minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  periodTabActive: { backgroundColor: colors.surface3 },
  periodText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  periodTextActive: { color: colors.text },
  changeRow: { flexDirection: "row" },
  changeBadge: { borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 11, paddingVertical: 8, fontSize: 11, fontWeight: "900" },
  insight: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: "700" },
  chartCard: { minHeight: 270, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: "rgba(8,10,12,0.94)", padding: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emptyChart: { alignItems: "center", gap: 6, paddingHorizontal: 30 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  infoCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18, gap: 12 },
  infoTitle: { color: colors.yellow, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  infoText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.red, textAlign: "center", fontSize: 12 },
  disclaimer: { color: colors.muted2, textAlign: "center", fontSize: 10 },
});
