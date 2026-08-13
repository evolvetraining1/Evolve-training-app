import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import {
  addExerciseToWorkout,
  assignProgramToAthlete,
  createWorkoutTemplate,
  getCoachAthletes,
  getCoachExercises,
  getCoachPrograms,
  scheduleWorkout,
} from "@/src/lib/coachApi";

type SetDraft = {
  reps: string;
  loadKg: string;
  rpe: string;
  rir: string;
  restSeconds: string;
};

const emptySet = (): SetDraft => ({
  reps: "5",
  loadKg: "",
  rpe: "8",
  rir: "",
  restSeconds: "180",
});

export default function CoachWorkoutScreen() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [programId, setProgramId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [workoutName, setWorkoutName] = useState("Séance Force");
  const [weekNumber, setWeekNumber] = useState("1");
  const [dayNumber, setDayNumber] = useState("1");
  const [estimatedMinutes, setEstimatedMinutes] = useState("60");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sets, setSets] = useState<SetDraft[]>([
    emptySet(), emptySet(), emptySet(), emptySet(), emptySet()
  ]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getCoachAthletes(), getCoachPrograms(), getCoachExercises()])
      .then(([a, p, e]) => {
        setAthletes(a);
        setPrograms(p);
        setExercises(e);
        if (a[0]) setAthleteId(a[0].athlete_id);
        if (p[0]) setProgramId(p[0].id);
        if (e[0]) setExerciseId(e[0].id);
      })
      .catch((e) => setMessage(e?.message ?? "Erreur chargement"));
  }, []);

  const selectedExercise = useMemo(
    () => exercises.find((e) => e.id === exerciseId),
    [exercises, exerciseId]
  );

  function updateSet(index: number, key: keyof SetDraft, value: string) {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [key]: value } : s));
  }

  function addSet() {
    setSets(prev => [...prev, emptySet()]);
  }

  function removeSet(index: number) {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, i) => i !== index));
  }

  async function saveAndAssign() {
    if (!programId || !exerciseId || !athleteId) {
      setMessage("Crée d'abord un programme, un exercice et lie un athlète.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const workout = await createWorkoutTemplate({
        programId,
        name: workoutName,
        weekNumber: Number(weekNumber || 1),
        dayNumber: Number(dayNumber || 1),
        estimatedMinutes: Number(estimatedMinutes || 60),
      });

      await addExerciseToWorkout({
        workoutTemplateId: workout.id,
        exerciseId,
        position: 1,
        prescriptionNotes: "Prescription coach Evolve Training",
        sets: sets.map(s => ({
          reps: s.reps ? Number(s.reps) : undefined,
          loadKg: s.loadKg ? Number(s.loadKg) : undefined,
          rpe: s.rpe ? Number(s.rpe) : undefined,
          rir: s.rir ? Number(s.rir) : undefined,
          restSeconds: s.restSeconds ? Number(s.restSeconds) : undefined,
        })),
      });

      await assignProgramToAthlete({
        programId,
        athleteId,
        startsOn: date,
      });

      await scheduleWorkout({
        athleteId,
        workoutTemplateId: workout.id,
        scheduledFor: date,
      });

      setMessage("Séance créée, attribuée et programmée ✓");
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur pendant la création");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader
        eyebrow="PROGRAMMATION"
        title="Créer une séance"
        subtitle="Prescription détaillée : séries, reps, charge, RPE/RIR et repos."
      />

      <Card style={styles.section}>
        <Label>Programme</Label>
        <View style={styles.chips}>
          {programs.map((p:any) => (
            <Pressable key={p.id} onPress={() => setProgramId(p.id)}
              style={[styles.chip, programId === p.id && styles.chipActive]}>
              <Text style={[styles.chipText, programId === p.id && styles.chipTextActive]}>{p.name}</Text>
            </Pressable>
          ))}
        </View>

        <Label>Nom de la séance</Label>
        <TextInput value={workoutName} onChangeText={setWorkoutName} style={styles.input} />

        <View style={styles.row}>
          <View style={styles.flex}><Label>Semaine</Label><TextInput value={weekNumber} onChangeText={setWeekNumber} keyboardType="number-pad" style={styles.input} /></View>
          <View style={styles.flex}><Label>Jour</Label><TextInput value={dayNumber} onChangeText={setDayNumber} keyboardType="number-pad" style={styles.input} /></View>
          <View style={styles.flex}><Label>Minutes</Label><TextInput value={estimatedMinutes} onChangeText={setEstimatedMinutes} keyboardType="number-pad" style={styles.input} /></View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Label>Exercice</Label>
        <View style={styles.chips}>
          {exercises.map((e:any) => (
            <Pressable key={e.id} onPress={() => setExerciseId(e.id)}
              style={[styles.chip, exerciseId === e.id && styles.chipActive]}>
              <Text style={[styles.chipText, exerciseId === e.id && styles.chipTextActive]}>{e.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.exerciseTitle}>{selectedExercise?.name ?? "Aucun exercice"}</Text>

        {sets.map((s, i) => (
          <View key={i} style={styles.setCard}>
            <View style={styles.setHead}>
              <Text style={styles.setTitle}>SÉRIE {i + 1}</Text>
              <Pressable onPress={() => removeSet(i)}><Text style={styles.remove}>SUPPRIMER</Text></Pressable>
            </View>
            <View style={styles.row}>
              <View style={styles.flex}><Label>Reps</Label><TextInput value={s.reps} onChangeText={v => updateSet(i,"reps",v)} keyboardType="numeric" style={styles.input} /></View>
              <View style={styles.flex}><Label>kg</Label><TextInput value={s.loadKg} onChangeText={v => updateSet(i,"loadKg",v)} keyboardType="numeric" placeholder="135" placeholderTextColor={colors.muted} style={styles.input} /></View>
              <View style={styles.flex}><Label>RPE</Label><TextInput value={s.rpe} onChangeText={v => updateSet(i,"rpe",v)} keyboardType="numeric" style={styles.input} /></View>
            </View>
            <View style={styles.row}>
              <View style={styles.flex}><Label>RIR</Label><TextInput value={s.rir} onChangeText={v => updateSet(i,"rir",v)} keyboardType="numeric" placeholder="—" placeholderTextColor={colors.muted} style={styles.input} /></View>
              <View style={styles.flex}><Label>Repos (s)</Label><TextInput value={s.restSeconds} onChangeText={v => updateSet(i,"restSeconds",v)} keyboardType="numeric" style={styles.input} /></View>
            </View>
          </View>
        ))}
        <Pressable onPress={addSet} style={styles.add}><Text style={styles.addText}>+ AJOUTER UNE SÉRIE</Text></Pressable>
      </Card>

      <Card style={styles.section}>
        <Label>Athlète</Label>
        <View style={styles.chips}>
          {athletes.map((r:any) => (
            <Pressable key={r.id} onPress={() => setAthleteId(r.athlete_id)}
              style={[styles.chip, athleteId === r.athlete_id && styles.chipActive]}>
              <Text style={[styles.chipText, athleteId === r.athlete_id && styles.chipTextActive]}>
                {r.profiles?.first_name || "Athlète"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Label>Date</Label>
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} />
      </Card>

      <PrimaryButton label={busy ? "ENREGISTREMENT..." : "CRÉER ET ENVOYER LA SÉANCE"} onPress={saveAndAssign} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{padding:20,paddingTop:68,paddingBottom:60,backgroundColor:colors.bg},
  section:{marginBottom:14,gap:12},
  input:{backgroundColor:colors.surface2,borderColor:colors.border,borderWidth:1,borderRadius:12,color:colors.text,padding:12,fontSize:16},
  row:{flexDirection:"row",gap:8},
  flex:{flex:1,gap:5},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:8},
  chip:{borderWidth:1,borderColor:colors.border,borderRadius:999,paddingHorizontal:12,paddingVertical:9},
  chipActive:{backgroundColor:colors.yellow,borderColor:colors.yellow},
  chipText:{color:colors.text,fontWeight:"800"},
  chipTextActive:{color:"#111"},
  exerciseTitle:{color:colors.yellow,fontSize:22,fontWeight:"900"},
  setCard:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:12,gap:8},
  setHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  setTitle:{color:colors.text,fontWeight:"900"},
  remove:{color:colors.muted,fontSize:11,fontWeight:"900"},
  add:{borderWidth:1,borderStyle:"dashed",borderColor:colors.yellow,borderRadius:12,padding:13,alignItems:"center"},
  addText:{color:colors.yellow,fontWeight:"900"},
  message:{color:colors.yellow,fontWeight:"900",textAlign:"center",marginTop:14},
});
