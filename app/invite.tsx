import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Card, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { acceptInvite } from "@/src/lib/coachApi";

export default function InviteScreen() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function accept() {
    try {
      await acceptInvite(code.trim().toUpperCase());
      setMessage("Coach associé ✓");
      setTimeout(() => router.replace("/(tabs)"), 600);
    } catch (e: any) {
      setMessage(e?.message ?? "Invitation invalide");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title="Rejoindre un coach" subtitle="Saisis le code reçu de ton coach Evolve." />
      <Card style={{ gap: 14 }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="ABC123"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <PrimaryButton label="VALIDER LE CODE" onPress={accept} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, backgroundColor: colors.bg, flexGrow: 1 },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, padding: 14, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: 3 },
  message: { color: colors.yellow, textAlign: "center", fontWeight: "900" },
});
