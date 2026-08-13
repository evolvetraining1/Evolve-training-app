import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getTodayCheckin, upsertTodayCheckin } from "@/src/lib/api";

export default function JournalScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fatigue, setFatigue] = useState("3");
  const [stress, setStress] = useState("4");
  const [motivation, setMotivation] = useState("8");
  const [pain, setPain] = useState("0");
  const [sleep, setSleep] = useState("450");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getTodayCheckin().then((c) => {
      if (c) {
        setFatigue(String(c.fatigue ?? 3));
        setStress(String(c.stress ?? 4));
        setMotivation(String(c.motivation ?? 8));
        setPain(String(c.pain ?? 0));
        setSleep(String(c.sleep_minutes ?? 450));
      }
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await upsertTodayCheckin({
        sleep_minutes: Number(sleep),
        fatigue: Number(fatigue),
        stress: Number(stress),
        motivation: Number(motivation),
        pain: Number(pain),
      });
      setMessage("Journal enregistré ✓");
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  const fields = [
    ["Sommeil (minutes)", sleep, setSleep],
    ["Fatigue /10", fatigue, setFatigue],
    ["Stress /10", stress, setStress],
    ["Motivation /10", motivation, setMotivation],
    ["Douleur /10", pain, setPain],
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title="Journal" subtitle="Check-in quotidien enregistré dans Supabase." />
      <Card>
        <Label>Aujourd'hui</Label>
        <View style={styles.form}>
          {fields.map(([label, value, setter]) => (
            <View key={label}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                keyboardType="number-pad"
                value={value}
                onChangeText={setter}
                style={styles.input}
              />
            </View>
          ))}
          <PrimaryButton label={saving ? "ENREGISTREMENT..." : "ENREGISTRER"} disabled={saving} onPress={save} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 110, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  form: { marginTop: 14, gap: 14 },
  fieldLabel: { color: colors.muted, marginBottom: 6, fontWeight: "700" },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, padding: 13, fontSize: 17, fontWeight: "800" },
  message: { color: colors.green, textAlign: "center", fontWeight: "800" },
});
