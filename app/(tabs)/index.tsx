import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { getMyProfile, getMyUpcomingSessions, getTodayCheckin } from "@/src/lib/api";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [checkin, setCheckin] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, s, c] = await Promise.all([
        getMyProfile(),
        getMyUpcomingSessions(),
        getTodayCheckin(),
      ]);
      setProfile(p);
      setSessions(s);
      setCheckin(c);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les données");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const next = sessions.find((s) => s.status !== "completed" && s.status !== "skipped");
  const template: any = next?.workout_templates;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <ScreenHeader
        title={`Bonjour ${profile?.first_name || "athlète"} 👊`}
        subtitle="Tes données viennent maintenant du backend Evolve."
      />

      {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}

      <Card>
        <Label>Journal du jour</Label>
        {checkin ? (
          <View style={styles.metrics}>
            <Text style={styles.metric}>Sommeil {Math.round((checkin.sleep_minutes || 0) / 60 * 10) / 10} h</Text>
            <Text style={styles.metric}>Fatigue {checkin.fatigue ?? "—"}/10</Text>
            <Text style={styles.metric}>Motivation {checkin.motivation ?? "—"}/10</Text>
          </View>
        ) : (
          <Text style={styles.muted}>Aucun check-in enregistré aujourd'hui.</Text>
        )}
      </Card>

      <View style={{ height: 14 }} />

      <Card>
        <Label>Prochaine séance</Label>
        {next ? (
          <>
            <Text style={styles.title}>{template?.name || "Séance"}</Text>
            <Text style={styles.muted}>
              {next.scheduled_for || "Date libre"} · {template?.estimated_minutes ? `≈ ${template.estimated_minutes} min` : "Durée libre"}
            </Text>
            <View style={{ height: 18 }} />
            <PrimaryButton
              label={next.status === "in_progress" ? "REPRENDRE LA SÉANCE" : "COMMENCER LA SÉANCE"}
              onPress={() => router.push({ pathname: "/workout", params: { sessionId: next.id } })}
            />
          </>
        ) : (
          <Text style={styles.muted}>Aucune séance programmée pour le moment.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 110, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 8 },
  muted: { color: colors.muted, marginTop: 7, lineHeight: 20 },
  error: { color: colors.red },
  metrics: { marginTop: 12, gap: 8 },
  metric: { color: colors.text, fontWeight: "800", fontSize: 16 },
});
