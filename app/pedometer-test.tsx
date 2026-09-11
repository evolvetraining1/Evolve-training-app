import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/theme";
import { PedometerProbe, probePedometer } from "@/src/lib/pedometer";
import { __testForcePreviousDay } from "@/src/lib/steps-storage";

export default function PedometerTestScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PedometerProbe | null>(null);

  const runProbe = async () => {
    setLoading(true);
    try {
      setResult(await probePedometer((steps) => {
        setResult((prev) => prev ? { ...prev, todaySteps: steps } : prev);
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>TEST TECHNIQUE</Text>
        <Text style={styles.title}>Podomètre</Text>
        <Text style={styles.subtitle}>Écran temporaire pour vérifier la lecture réelle des pas du téléphone.</Text>

        <View style={styles.card}>
          <Row label="Disponible" value={result ? (result.available ? "OUI" : "NON") : "—"} />
          <Row label="Permission" value={result ? result.permission.toUpperCase() : "—"} />
          <Row label="Pas aujourd'hui" value={result?.todaySteps != null ? result.todaySteps.toLocaleString("fr-FR") : "—"} />
          {result?.error ? <Text style={styles.error}>{result.error}</Text> : null}
        </View>

        <Pressable style={styles.button} onPress={runProbe} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.black} /> : <Text style={styles.buttonText}>TESTER LE PODOMÈTRE</Text>}
        </Pressable>

      <Pressable style={styles.button} onPress={__testForcePreviousDay}>
        <Text style={styles.buttonText}>SIMULER JOUR SUIVANT</Text>
      </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  card: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  value: { color: colors.text, fontSize: 15, fontWeight: "900" },
  error: { color: colors.red, marginTop: 14, lineHeight: 18 },
  button: { marginTop: 18, minHeight: 54, borderRadius: 16, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.black, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
});
