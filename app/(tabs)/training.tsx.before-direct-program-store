
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
    Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "@/src/theme";
import { getMyPrograms } from "@/src/lib/api";

export default function TrainingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getMyPrograms();
      setPrograms(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les programmes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.yellow}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text style={styles.kicker}>EVOLVE TRAINING</Text>
      <Text style={styles.title}>Mes programmes</Text>
      <Text style={styles.subtitle}>
        Retrouve tes programmations et tes séances.
      </Text>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!error && programs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucun programme attribué</Text>
          <Text style={styles.emptyText}>
            Ton coach pourra t’attribuer un programme depuis son espace.
          </Text>
        </View>
      ) : null}

      {programs.map((program) => (
        <Pressable
          key={program.assignment_id ?? program.id}
          onPress={() =>
            router.push({
              pathname: "/program",
              params: { programId: String(program.id) },
            })
          }
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.82 },
          ]}
        >
          <Image
            source={require("../../assets/tactical-reconditioning.png")}
            style={styles.programCover}
            resizeMode="cover"
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  page: {
    paddingHorizontal: 28,
    paddingTop: 54,
    paddingBottom: 130,
  },
  center: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: colors.yellow,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
    marginTop: 16,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 12,
    marginBottom: 30,
  },
  programCover: {
    width: "100%",
    height: 260,
    borderRadius: 18,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 8,
    marginBottom: 18,
    backgroundColor: colors.surface,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.yellow,
    fontSize: 21,
    fontWeight: "900",
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 18,
  },
  programName: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  programMeta: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 7,
  },
  arrow: {
    color: colors.text,
    fontSize: 40,
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 22,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: 8,
  },
  errorCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#241010",
  },
  errorText: {
    color: "#F5A299",
  },
});
