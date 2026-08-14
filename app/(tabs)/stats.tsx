import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Label, Metric, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { useSession } from "@/src/store/session";

export default function StatsScreen() {
  const { totalVolume, completed } = useSession();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader
        title="Stats"
        subtitle="Les données utiles, sans noyer l'athlète."
      />

      <View style={styles.grid}>
        <Card style={styles.gridCard}><Metric value="170 kg" label="PR Back Squat" accent={colors.yellow} /></Card>
        <Card style={styles.gridCard}><Metric value="110 kg" label="e1RM Bench" accent={colors.green} /></Card>
      </View>

      <Card>
        <Label>Dernière séance</Label>
        <Text style={styles.big}>
          {completed ? "Lower Strength ✓" : "En attente"}
        </Text>
        <Text style={styles.muted}>
          Volume validé : {totalVolume.toLocaleString("fr-FR")} kg
        </Text>
      </Card>

      <View style={{ height: 14 }} />
      <Card>
        <Label>Assiduité 30 jours</Label>
        <Text style={[styles.big, { color: colors.green }]}>92%</Text>
        <View style={styles.fakeChart}>
          {[40, 62, 55, 78, 68, 88, 92].map((h, i) => (
            <View key={i} style={[styles.bar, { height: h }]} />
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 110, backgroundColor: "transparent" },
  grid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  gridCard: { flex: 1 },
  big: { color: colors.text, fontSize: 25, fontWeight: "900", marginTop: 8 },
  muted: { color: colors.muted, marginTop: 6 },
  fakeChart: { height: 110, flexDirection: "row", alignItems: "flex-end", gap: 9, marginTop: 22 },
  bar: { flex: 1, backgroundColor: colors.yellow, borderRadius: 5 },
});
