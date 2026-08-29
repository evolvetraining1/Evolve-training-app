import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/store/auth";
import { getMyProfile } from "@/src/lib/api";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const data = await getMyProfile();
      setProfile(data);
    } catch (e: any) {
      setProfile(null);
      setError(e?.message ?? "Impossible de charger le profil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title="Profil" subtitle={session?.user.email ?? "Compte Evolve"} />

      <Card>
        <Label>Type de compte</Label>

        {loading ? (
          <Text style={styles.status}>Chargement du profil...</Text>
        ) : error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <View style={{ height: 12 }} />
            <PrimaryButton label="RÉESSAYER" onPress={loadProfile} />
          </>
        ) : (
          <Text style={styles.role}>
            {profile?.role === "coach" ? "Coach" : "Athlète"}
          </Text>
        )}
      </Card>

      {!loading && !error ? (
        <>
          <View style={{ height: 14 }} />

          {profile?.role === "coach" ? (
            <PrimaryButton
              label="OUVRIR L'ESPACE COACH"
              onPress={() => router.push("/coach")}
            />
          ) : (
            <PrimaryButton
              label="REJOINDRE UN COACH"
              onPress={() => router.push("/invite")}
            />
          )}
        </>
      ) : null}

      <View style={{ height: 12 }} />
      <PrimaryButton label="SE DÉCONNECTER" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 110, backgroundColor: "transparent" },
  role: { color: colors.yellow, fontSize: 24, fontWeight: "900", marginTop: 8 },
  status: { color: colors.muted, fontSize: 14, marginTop: 8 },
  error: { color: "#ff6464", fontSize: 14, lineHeight: 20, marginTop: 8 },
});
