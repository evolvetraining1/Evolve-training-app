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

  useEffect(() => { getMyProfile().then(setProfile).catch(() => null); }, []);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title="Profil" subtitle={session?.user.email ?? "Compte Evolve"} />

      <Card>
        <Label>Type de compte</Label>
        <Text style={styles.role}>{profile?.role === "coach" ? "Coach" : "Athlète"}</Text>
      </Card>

      <View style={{ height: 14 }} />
      {profile?.role === "coach" ? (
        <PrimaryButton label="OUVRIR L'ESPACE COACH" onPress={() => router.push("/coach")} />
      ) : (
        <PrimaryButton label="REJOINDRE UN COACH" onPress={() => router.push("/invite")} />
      )}

      <View style={{ height: 12 }} />
      <PrimaryButton label="SE DÉCONNECTER" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 110, backgroundColor: "transparent" },
  role: { color: colors.yellow, fontSize: 24, fontWeight: "900", marginTop: 8 },
});
