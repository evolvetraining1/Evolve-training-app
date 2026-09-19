import { router } from "expo-router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "@/src/components/ui";
import { createCustomRoutine } from "@/src/lib/wellness-api";
import { RoutineInputType, RoutinePolarity } from "@/src/lib/wellness";
import { colors, radius } from "@/src/theme";

const CATEGORIES = [
  ["sleep", "Sommeil"],
  ["recovery", "Récupération"],
  ["mental", "Mental / stress"],
  ["nutrition", "Nutrition"],
  ["hydration", "Hydratation"],
  ["activity", "Activité"],
  ["performance", "Entraînement"],
  ["environment", "Environnement"],
  ["health", "Santé"],
] as const;

const INPUT_TYPES: Array<{ key: RoutineInputType; label: string; unit?: string }> = [
  { key: "boolean", label: "Oui / non" },
  { key: "scale_5", label: "Note 1–5" },
  { key: "scale_10", label: "Note 1–10" },
  { key: "minutes", label: "Minutes", unit: "min" },
  { key: "hours", label: "Heures", unit: "h" },
  { key: "count", label: "Compteur", unit: "fois" },
  { key: "number", label: "Nombre" },
  { key: "time", label: "Horaire", unit: "HH:MM" },
];

const DIRECTIONS: Array<{ key: RoutinePolarity; title: string; text: string }> = [
  { key: "higher_better", title: "À développer", text: "Plus ou oui est favorable" },
  { key: "lower_better", title: "À limiter", text: "Moins ou non est favorable" },
  { key: "neutral", title: "Suivi neutre", text: "Visible sans modifier les scores" },
];

const IMPACTS = [
  { key: "habit", title: "Habitudes", text: "Agit seulement sur la régularité" },
  { key: "recovery", title: "Récupération", text: "Influence légère sur la récupération" },
  { key: "stress", title: "Stress", text: "Influence légère sur la charge perçue" },
] as const;

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];

export default function NewJournalRoutineScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("recovery");
  const [inputType, setInputType] = useState<RoutineInputType>("boolean");
  const [unit, setUnit] = useState("");
  const [polarity, setPolarity] = useState<RoutinePolarity>("higher_better");
  const [target, setTarget] = useState("");
  const [impact, setImpact] = useState<"habit" | "recovery" | "stress">("habit");
  const [scheduledDays, setScheduledDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const numericInput = useMemo(
    () => ["number", "minutes", "hours", "count"].includes(inputType),
    [inputType]
  );
  const scored = polarity !== "neutral" && inputType !== "time";

  function selectInputType(next: RoutineInputType, suggestedUnit?: string) {
    setInputType(next);
    setUnit(suggestedUnit ?? "");
    if (next === "time") setPolarity("neutral");
    else if (inputType === "time") setPolarity("higher_better");
  }

  function toggleDay(day: number) {
    setScheduledDays((current) => {
      if (current.includes(day) && current.length === 1) return current;
      return current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b);
    });
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      const parsedTarget = target.trim() ? Number(target.replace(",", ".")) : null;
      if (target.trim() && !Number.isFinite(parsedTarget)) {
        throw new Error("L’objectif doit être un nombre valide.");
      }
      await createCustomRoutine({
        name,
        description,
        category,
        inputType,
        unit,
        polarity,
        target: parsedTarget,
        impact: scored ? impact : "habit",
        scheduledDays,
      });
      router.back();
    } catch (nextError: any) {
      setError(nextError?.message ?? "Impossible de créer cette habitude.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
    >
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>JOURNAL EVOLVE</Text>
          <Text style={styles.title}>NOUVELLE HABITUDE</Text>
        </View>
      </View>

      <Text style={styles.intro}>
        Crée ton propre suivi. L’influence sur les scores reste volontairement légère pour préserver leur fiabilité.
      </Text>

      <FormBlock title="IDENTITÉ">
        <FieldLabel>Nom</FieldLabel>
        <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="Ex. Respiration 10 minutes" placeholderTextColor={colors.muted2} style={styles.input} />
        <FieldLabel>Question ou consigne</FieldLabel>
        <TextInput value={description} onChangeText={setDescription} maxLength={240} multiline placeholder="Ex. As-tu fait ta séance de respiration ?" placeholderTextColor={colors.muted2} style={[styles.input, styles.multiline]} />
      </FormBlock>

      <FormBlock title="CATÉGORIE">
        <View style={styles.chips}>
          {CATEGORIES.map(([key, label]) => <Chip key={key} label={label} active={category === key} onPress={() => setCategory(key)} />)}
        </View>
      </FormBlock>

      <FormBlock title="TYPE DE RÉPONSE">
        <View style={styles.chips}>
          {INPUT_TYPES.map((item) => <Chip key={item.key} label={item.label} active={inputType === item.key} onPress={() => selectInputType(item.key, item.unit)} />)}
        </View>
        {inputType === "number" ? (
          <>
            <FieldLabel>Unité facultative</FieldLabel>
            <TextInput value={unit} onChangeText={setUnit} maxLength={20} placeholder="Ex. ml, km, pages" placeholderTextColor={colors.muted2} style={styles.input} />
          </>
        ) : null}
      </FormBlock>

      {inputType !== "time" ? (
        <FormBlock title="SENS DE L’HABITUDE">
          {DIRECTIONS.map((item) => (
            <ChoiceCard key={item.key} title={item.title} text={item.text} active={polarity === item.key} onPress={() => setPolarity(item.key)} />
          ))}
          {numericInput && polarity !== "neutral" ? (
            <>
              <FieldLabel>{polarity === "higher_better" ? "Objectif minimum" : "Limite à ne pas dépasser"}</FieldLabel>
              <View style={styles.targetRow}>
                <TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="Valeur" placeholderTextColor={colors.muted2} style={[styles.input, { flex: 1 }]} />
                <Text style={styles.unit}>{unit || "unité"}</Text>
              </View>
            </>
          ) : null}
        </FormBlock>
      ) : null}

      {scored ? (
        <FormBlock title="IMPACT SUR LE SCORE">
          {IMPACTS.map((item) => (
            <ChoiceCard key={item.key} title={item.title} text={item.text} active={impact === item.key} onPress={() => setImpact(item.key)} />
          ))}
        </FormBlock>
      ) : null}

      <FormBlock title="JOURS DE SUIVI">
        <View style={styles.days}>
          {DAYS.map((label, day) => {
            const active = scheduledDays.includes(day);
            return (
              <Pressable key={day} onPress={() => toggleDay(day)} style={[styles.day, active && styles.dayActive]}>
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Au moins un jour doit rester sélectionné.</Text>
      </FormBlock>

      {error ? <Text selectable style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={saving ? "CRÉATION…" : "AJOUTER AU JOURNAL"} disabled={saving} onPress={() => void save()} />
      <Text style={styles.disclaimer}>Les habitudes personnalisées sont privées et visibles uniquement par leur créateur.</Text>
    </ScrollView>
  );
}

function FormBlock({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.block}><Text style={styles.blockTitle}>{title}</Text>{children}</View>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceCard({ title, text, active, onPress }: { title: string; text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>{title}</Text>
        <Text style={styles.choiceText}>{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 58, paddingBottom: 90, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  backText: { color: colors.text, fontSize: 34, lineHeight: 36 },
  eyebrow: { color: colors.yellow, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  block: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,11,12,0.95)", padding: 16, gap: 11 },
  blockTitle: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  input: { minHeight: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: 14, fontSize: 15, fontWeight: "700" },
  multiline: { minHeight: 88, paddingTop: 13, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, paddingHorizontal: 12 },
  chipActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.12)" },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  chipTextActive: { color: colors.yellow },
  choice: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, padding: 12 },
  choiceActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.08)" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.muted2, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.yellow },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.yellow },
  choiceTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  choiceTitleActive: { color: colors.yellow },
  choiceText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  unit: { minWidth: 48, color: colors.muted, fontSize: 12, fontWeight: "800" },
  days: { flexDirection: "row", justifyContent: "space-between", gap: 7 },
  day: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  dayActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.14)" },
  dayText: { color: colors.muted2, fontSize: 12, fontWeight: "900" },
  dayTextActive: { color: colors.yellow },
  hint: { color: colors.muted2, fontSize: 10 },
  error: { color: colors.red, textAlign: "center", fontSize: 12, lineHeight: 18 },
  disclaimer: { color: colors.muted2, textAlign: "center", fontSize: 10, lineHeight: 15, paddingHorizontal: 12 },
});
