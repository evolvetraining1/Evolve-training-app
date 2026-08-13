import { useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/store/auth";

export default function LoginScreen() {
  const { session, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (session) return <Redirect href="/(tabs)" />;

  async function submit() {
    setBusy(true);
    setMessage(null);
    const error = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, firstName.trim(), role);
    setBusy(false);

    if (error) setMessage(error);
    else if (mode === "signup") {
      setMessage("Compte créé. Vérifie ton email si la confirmation est activée.");
      setMode("login");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.brand}>EVOLVE TRAINING</Text>
      <Text style={styles.title}>{mode === "login" ? "Connexion" : "Créer un compte"}</Text>

      {mode === "signup" && (
        <>
          <TextInput value={firstName} onChangeText={setFirstName} placeholder="Prénom" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.roleRow}>
            <Pressable onPress={() => setRole("athlete")} style={[styles.roleButton, role === "athlete" && styles.roleActive]}>
              <Text style={[styles.roleText, role === "athlete" && styles.roleTextActive]}>ATHLÈTE</Text>
            </Pressable>
            <Pressable onPress={() => setRole("coach")} style={[styles.roleButton, role === "coach" && styles.roleActive]}>
              <Text style={[styles.roleText, role === "coach" && styles.roleTextActive]}>COACH</Text>
            </Pressable>
          </View>
        </>
      )}

      <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Mot de passe" placeholderTextColor={colors.muted} style={styles.input} />

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {busy ? <ActivityIndicator /> : <PrimaryButton label={mode === "login" ? "SE CONNECTER" : "CRÉER LE COMPTE"} onPress={submit} />}

      <Pressable onPress={() => setMode(mode === "login" ? "signup" : "login")}>
        <Text style={styles.switch}>
          {mode === "login" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  brand: { color: colors.yellow, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, color: colors.text, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 },
  message: { color: colors.muted, lineHeight: 20 },
  switch: { color: colors.yellow, textAlign: "center", fontWeight: "800", paddingVertical: 8 },
  roleRow: { flexDirection: "row", gap: 10 },
  roleButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, alignItems: "center" },
  roleActive: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  roleText: { color: colors.text, fontWeight: "900" },
  roleTextActive: { color: "#111" },
});
