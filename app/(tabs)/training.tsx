import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Label, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getMyUpcomingSessions } from "@/src/lib/api";

export default function TrainingScreen() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    getMyUpcomingSessions()
      .then(setSessions)
      .catch((e) => setError(e?.message ?? "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title="Entraînement" subtitle="Tes séances programmées par le coach." />
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !sessions.length ? <Card><Text style={styles.muted}>Aucune séance attribuée.</Text></Card> : null}

      {sessions.map((s) => {
        const t: any = s.workout_templates;
        return (
          <Pressable key={s.id} onPress={() => router.push({ pathname: "/workout", params: { sessionId: s.id } })}>
            <Card style={{ marginBottom: 12 }}>
              <Label>{s.scheduled_for ?? "À planifier"}</Label>
              <Text style={styles.title}>{t?.name ?? "Séance"}</Text>
              <Text style={styles.muted}>{t?.estimated_minutes ? `≈ ${t.estimated_minutes} min` : ""} · {s.status}</Text>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 110, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 21, fontWeight: "900", marginTop: 7 },
  muted: { color: colors.muted, marginTop: 5 },
  error: { color: colors.red, marginBottom: 12 },
});
