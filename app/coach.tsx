import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import {
  createAthleteInvite,
  createExercise,
  createSimpleProgram,
  getCoachAthletes,
  getCoachExercises,
  getCoachPrograms,
} from "@/src/lib/coachApi";

export default function CoachScreen() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [programName, setProgramName] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const [a, p, e] = await Promise.all([
        getCoachAthletes(),
        getCoachPrograms(),
        getCoachExercises(),
      ]);
      setAthletes(a);
      setPrograms(p);
      setExercises(e);
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur");
    }
  }

  useEffect(() => { refresh(); }, []);

  async function invite() {
    setMessage("");
    try {
      const row = await createAthleteInvite(inviteEmail);
      setInviteCode(row.invite_code);
      setInviteEmail("");
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur invitation");
    }
  }

  async function createProgram() {
    try {
      await createSimpleProgram({ name: programName, durationWeeks: 4 });
      setProgramName("");
      setMessage("Programme créé ✓");
      refresh();
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur programme");
    }
  }

  async function createEx() {
    try {
      await createExercise({ name: exerciseName, category: "Force" });
      setExerciseName("");
      setMessage("Exercice créé ✓");
      refresh();
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur exercice");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader eyebrow="ESPACE COACH" title="Dashboard" subtitle="Premier workflow coach réel relié à Supabase." />

      <View style={styles.grid}>
        <Card style={styles.gridCard}><Label>Athlètes</Label><Text style={styles.metric}>{athletes.length}</Text></Card>
        <Card style={styles.gridCard}><Label>Programmes</Label><Text style={styles.metric}>{programs.length}</Text></Card>
        <Card style={styles.gridCard}><Label>Exercices</Label><Text style={styles.metric}>{exercises.length}</Text></Card>
      </View>

      <Card style={styles.section}>
        <Label>Programmation</Label>
        <Text style={styles.muted}>Construis une prescription complète puis envoie-la à un athlète.</Text>
        <PrimaryButton label="CRÉER UNE SÉANCE" onPress={() => router.push("/coach-workout")} />
      </Card>

      <Card style={styles.section}>
        <Label>Inviter un athlète</Label>
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@client.fr"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <PrimaryButton label="GÉNÉRER L'INVITATION" onPress={invite} />
        {inviteCode ? <Text style={styles.code}>CODE : {inviteCode}</Text> : null}
      </Card>

      <Card style={styles.section}>
        <Label>Créer un programme</Label>
        <TextInput
          value={programName}
          onChangeText={setProgramName}
          placeholder="Ex. Force — Bloc 1"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <PrimaryButton label="CRÉER LE PROGRAMME" onPress={createProgram} />
      </Card>

      <Card style={styles.section}>
        <Label>Ajouter un exercice</Label>
        <TextInput
          value={exerciseName}
          onChangeText={setExerciseName}
          placeholder="Ex. Back Squat"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <PrimaryButton label="AJOUTER L'EXERCICE" onPress={createEx} />
      </Card>

      <Card style={styles.section}>
        <Label>Athlètes actifs</Label>
        {athletes.length ? athletes.map((r: any) => {
          const p = r.profiles;
          return <Text key={r.id} style={styles.listItem}>{p?.first_name || "Athlète"} {p?.last_name || ""}</Text>;
        }) : <Text style={styles.muted}>Aucun athlète lié pour l'instant.</Text>}
      </Card>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 68, paddingBottom: 50, backgroundColor: colors.bg },
  grid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  gridCard: { flex: 1 },
  metric: { color: colors.yellow, fontSize: 28, fontWeight: "900", marginTop: 6 },
  section: { marginBottom: 14, gap: 12 },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, padding: 13, fontSize: 16 },
  code: { color: colors.yellow, fontWeight: "900", fontSize: 20, textAlign: "center" },
  listItem: { color: colors.text, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, fontWeight: "800" },
  muted: { color: colors.muted, marginTop: 8 },
  message: { color: colors.green, textAlign: "center", fontWeight: "900" },
});
