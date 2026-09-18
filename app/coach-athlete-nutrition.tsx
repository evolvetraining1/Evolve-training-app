import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Card, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getCoachAthleteNutrition } from "@/src/lib/coachApi";

export default function CoachAthleteNutritionScreen() {
  const { athleteId, periodDays } = useLocalSearchParams<{
    athleteId?: string;
    periodDays?: string;
  }>();

  const [nutrition, setNutrition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const days = Number(periodDays ?? 30);

  useEffect(() => {
    if (!athleteId) return;

    setLoading(true);
    setError("");

    getCoachAthleteNutrition(athleteId, days)
      .then(setNutrition)
      .catch((e: any) =>
        setError(e?.message ?? "Impossible de charger la nutrition.")
      )
      .finally(() => setLoading(false));
  }, [athleteId, days]);

  const grouped = useMemo(() => {
    if (!nutrition?.entries?.length) return [];

    const map = nutrition.entries.reduce((acc: Record<string, any[]>, entry: any) => {
      const date = entry.eaten_on ?? entry.date ?? "Date inconnue";
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {});

    return Object.entries(map) as [string, any[]][];
  }, [nutrition]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ RETOUR ATHLÈTE</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="SUIVI COACH"
        title="Nutrition"
        subtitle="Détail alimentaire de l’athlète."
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error ? (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>RÉSUMÉ</Text>
            <Text style={styles.muted}>
              {nutrition?.daysWithEntries ?? 0} jour(s) enregistré(s)
            </Text>

            <View style={styles.metrics}>
              <Metric
                label="CALORIES"
                value={`${Math.round(nutrition?.totals?.calories ?? 0)} kcal`}
              />
              <Metric
                label="PROTÉINES"
                value={`${Math.round(nutrition?.totals?.protein ?? 0)} g`}
              />
              <Metric
                label="GLUCIDES"
                value={`${Math.round(nutrition?.totals?.carbs ?? 0)} g`}
              />
              <Metric
                label="LIPIDES"
                value={`${Math.round(nutrition?.totals?.fat ?? 0)} g`}
              />
            </View>
          </Card>

          <Text style={styles.blockTitle}>DÉTAIL PAR JOUR</Text>

          {grouped.length ? (
            grouped.map(([date, entries]) => {
              const totals = entries.reduce(
                (acc: any, entry: any) => ({
                  calories: acc.calories + Number(entry.calories ?? 0),
                  protein: acc.protein + Number(entry.protein_g ?? 0),
                  carbs: acc.carbs + Number(entry.carbs_g ?? 0),
                  fat: acc.fat + Number(entry.fat_g ?? 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0 }
              );

              const isOpen = expandedDate === date;

              return (
                <Card key={date} style={styles.section}>
                  <Pressable
                    onPress={() => setExpandedDate(isOpen ? null : date)}
                    style={styles.dayHeader}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.date}>{date}</Text>
                      <Text style={styles.dayPreview}>
                        {Math.round(totals.calories)} kcal · {entries.length} entrée(s)
                      </Text>
                    </View>

                    <Text style={styles.chevron}>
                      {isOpen ? "⌃" : "⌄"}
                    </Text>
                  </Pressable>

                  {isOpen ? (
                    <View style={styles.dayContent}>
                      <Text style={styles.dayTotal}>
                        P {Math.round(totals.protein)} g · G{" "}
                        {Math.round(totals.carbs)} g · L{" "}
                        {Math.round(totals.fat)} g
                      </Text>

                      {entries.map((entry: any, index: number) => (
                        <View key={entry.id ?? index} style={styles.entry}>
                          <Text style={styles.foodName}>
                            {entry.food_name ?? "Aliment"}
                          </Text>

                          <Text style={styles.entryMeta}>
                            {entry.grams != null ? `${entry.grams} g · ` : ""}
                            {Math.round(Number(entry.calories ?? 0))} kcal · P{" "}
                            {Math.round(Number(entry.protein_g ?? 0))} g · G{" "}
                            {Math.round(Number(entry.carbs_g ?? 0))} g · L{" "}
                            {Math.round(Number(entry.fat_g ?? 0))} g
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            })
          ) : (
            <Card style={styles.section}>
              <Text style={styles.muted}>
                Aucun enregistrement nutritionnel sur cette période.
              </Text>
            </Card>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
  loading: {
    paddingVertical: 30,
  },
  error: {
    color: colors.red,
    fontWeight: "700",
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  metric: {
    width: "48%",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 14,
  },
  metricValue: {
    color: colors.yellow,
    fontSize: 18,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: {
    color: colors.yellow,
    fontSize: 16,
    fontWeight: "900",
  },
  dayPreview: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
  },
  chevron: {
    color: colors.yellow,
    fontSize: 24,
    fontWeight: "900",
    marginLeft: 12,
  },
  dayContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  dayTotal: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },
  entry: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  foodName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  entryMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
});
