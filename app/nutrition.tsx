import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Label, ScreenHeader } from "@/src/components/ui";
import { nutrition } from "@/src/data/mock";
import { colors } from "@/src/theme";

function Macro({
  label,
  values,
  unit,
}: {
  label: string;
  values: number[];
  unit: string;
}) {
  const pct = Math.min(100, (values[0] / values[1]) * 100);

  return (
    <View style={{ gap: 7 }}>
      <View style={styles.row}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {values[0]} / {values[1]} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export default function NutritionScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Retour</Text>
      </Pressable>

      <ScreenHeader
        title="Nutrition"
        subtitle="Module activé par l'offre de coaching."
      />

      <Card>
        <Label>Aujourd'hui</Label>
        <View style={styles.macros}>
          <Macro label="Calories" values={nutrition.calories} unit="kcal" />
          <Macro label="Protéines" values={nutrition.protein} unit="g" />
          <Macro label="Glucides" values={nutrition.carbs} unit="g" />
          <Macro label="Lipides" values={nutrition.fat} unit="g" />
        </View>
      </Card>

      <View style={{ height: 14 }} />
      <Card>
        <Label>Repas</Label>
        {[
          ["Petit-déjeuner", "612 kcal"],
          ["Déjeuner", "798 kcal"],
          ["Collation", "281 kcal"],
          ["Dîner", "656 kcal"],
        ].map(([meal, kcal]) => (
          <View key={meal} style={styles.mealRow}>
            <Text style={styles.meal}>{meal}</Text>
            <Text style={styles.kcal}>{kcal}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 58, paddingBottom: 50, backgroundColor: "transparent" },
  back: { color: colors.yellow, fontWeight: "900", marginBottom: 18 },
  macros: { gap: 18, marginTop: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { color: colors.text, fontWeight: "800" },
  macroValue: { color: colors.muted, fontWeight: "700" },
  track: { height: 9, borderRadius: 99, backgroundColor: colors.surface2, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.yellow, borderRadius: 99 },
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  meal: { color: colors.text, fontWeight: "700" },
  kcal: { color: colors.muted, fontWeight: "800" },
});
