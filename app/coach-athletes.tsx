import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { Card, ScreenHeader } from "@/src/components/ui";
import { ProfileAvatar } from "@/src/components/profile-avatar";
import { colors } from "@/src/theme";
import { getCoachAthletes } from "@/src/lib/coachApi";

export default function CoachAthletesScreen() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getCoachAthletes();
      setAthletes(data);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les athlètes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
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
      <ScreenHeader
        eyebrow="ESPACE COACH"
        title="Mes athlètes"
        subtitle="Suivi individuel, performances et données athlètes."
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && athletes.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Aucun athlète actif</Text>
          <Text style={styles.muted}>
            Les athlètes liés à ton compte apparaîtront ici.
          </Text>
        </Card>
      ) : null}

      {athletes.map((relationship: any) => {
        const profile = relationship.profiles;
        const firstName = profile?.first_name || "Athlète";
        const lastName = profile?.last_name || "";

        return (
          <Pressable
            key={relationship.athlete_id}
            onPress={() =>
              router.push({
                pathname: "/coach-athlete" as any,
                params: {
                  athleteId: String(relationship.athlete_id),
                },
              })
            }
          >
            <Card style={styles.athleteCard}>
              <ProfileAvatar
                name={`${firstName} ${lastName}`}
                uri={profile?.avatar_url}
              />

              <View style={styles.athleteInfo}>
                <Text style={styles.athleteName}>
                  {firstName} {lastName}
                </Text>

                <Text style={styles.muted}>
                  Suivi actif
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 68,
    paddingBottom: 100,
    backgroundColor: "transparent",
  },

  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },

  athleteCard: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  athleteInfo: {
    flex: 1,
  },

  athleteName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },

  arrow: {
    color: colors.yellow,
    fontSize: 32,
  },

  muted: {
    color: colors.muted,
    marginTop: 4,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  error: {
    color: colors.red,
    marginBottom: 14,
  },
});
