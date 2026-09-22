import { compactFields } from "@/src/lib/screen-layout";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { BEHAVIORS, behaviorAnswer, behaviorQuestion, hasYesNo, setBehaviorAnswer } from "@/src/lib/journal-behaviors";
import { numeric, RoutineValue, WellnessRoutine } from "@/src/lib/wellness";
import { colors } from "@/src/theme";

export function JournalBehaviorCard({ routine, input, derived, weekly, onChange }: {
  routine: WellnessRoutine;
  input?: RoutineValue;
  derived?: boolean;
  weekly?: { done: number; total: number };
  onChange: (value: RoutineValue) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const compact = compactFields(width, fontScale);
  const config = BEHAVIORS[routine.slug];
  const yesNo = hasYesNo(routine);
  const answer = behaviorAnswer(routine, input);
  const scale = routine.input_type === "scale_5" ? 5 : routine.input_type === "scale_10" ? 10 : 0;
  const answered = yesNo ? answer != null : Boolean(input?.value?.trim());
  const setValue = (value: string) => onChange({ ...input, value });
  return (
    <View style={[s.card, answered && s.answered]}>
      <View style={[s.heading, compact && { flexDirection: "column", alignItems: "stretch" }]}>
        <View style={{ flex: compact ? 0 : 1, gap: 5 }}>
          <Text style={s.name}>{routine.name}</Text>
          <Text style={s.question}>{behaviorQuestion(routine)}</Text>
        </View>
        {yesNo ? <View style={[s.answers, compact && { alignSelf: "flex-end" }]}>{[false, true].map((choice) => (
          <Pressable key={String(choice)} accessibilityRole="button" accessibilityLabel={`${choice ? "Oui" : "Non"} : ${routine.name}`} accessibilityState={{ selected: answer === choice }} onPress={() => onChange(setBehaviorAnswer(routine, input, choice))} style={[s.answer, answer === choice && s.selected]}>
            <Text style={[s.symbol, answer === choice && s.selectedText]}>{choice ? "✓" : "×"}</Text>
          </Pressable>
        ))}</View> : null}
      </View>
      {!yesNo || answer === true ? <>
        {scale ? <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scale}>
            {Array.from({ length: scale }, (_, i) => String(i + 1)).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${routine.name} : ${value} sur ${scale}`} accessibilityState={{ selected: input?.value === value }} onPress={() => setValue(input?.value === value ? "" : value)} style={[s.answer, input?.value === value && s.selected]}><Text style={[s.symbol, input?.value === value && s.selectedText]}>{value}</Text></Pressable>)}
          </ScrollView>
          <Text style={s.hint}>1 = niveau le plus faible · {scale} = le plus élevé</Text>
        </> : routine.input_type !== "boolean" ? <View style={yesNo && s.details}>
          <ValueField label={config?.quantity ?? (derived ? "Durée calculée depuis tes horaires" : routine.input_type === "time" ? "À quelle heure ?" : "Quelle quantité ?")} value={input?.value ?? ""} unit={routine.input_type === "time" ? "HH:MM" : routine.unit ?? ""} kind={routine.input_type === "time" ? "time" : routine.input_type === "count" || routine.slug === "alcohol" ? "count" : "number"} disabled={derived} onChange={setValue} />
        </View> : null}
        {answer === true && config?.fields?.length ? <View style={s.details}>
          <Text style={s.hint}>PRÉCISIONS FACULTATIVES</Text>
          {config.fields.map((field) => <ValueField key={field.key} label={field.label} kind={field.kind} unit={field.kind === "time" ? "HH:MM" : field.unit ?? ""} value={input?.details?.[field.key] ?? ""} onChange={(value) => onChange({ ...input, details: { ...input?.details, [field.key]: value } })} />)}
        </View> : null}
      </> : null}
      <View style={s.bottom}>
        {weekly ? <View style={s.weekly} accessibilityLabel={`${weekly.done} jours renseignés sur ${weekly.total} prévus cette semaine`}>
          <Svg width={26} height={26} viewBox="0 0 26 26"><Circle cx={13} cy={13} r={10} stroke={colors.border} strokeWidth={3} fill="none" /><Circle cx={13} cy={13} r={10} stroke={colors.green} strokeWidth={3} fill="none" strokeDasharray={`${Math.min(1, weekly.done / Math.max(1, weekly.total)) * 62.83} 62.83`} rotation={-90} origin="13, 13" strokeLinecap="round" /></Svg>
          <Text style={[s.hint, { flex: 1, minWidth: 0 }]}>{weekly.done}/{weekly.total} jours renseignés cette semaine</Text>
        </View> : <View />}
        {answered && !derived ? <Pressable accessibilityRole="button" accessibilityLabel={`Effacer la réponse : ${routine.name}`} onPress={() => onChange({})} hitSlop={8}><Text style={s.clear}>Effacer</Text></Pressable> : null}
      </View>
    </View>
  );
}

function ValueField({ label, value, unit, kind, disabled, onChange }: { label: string; value: string; unit: string; kind: "number" | "count" | "time"; disabled?: boolean; onChange: (value: string) => void }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <View style={s.valueRow}>
      {kind === "count" ? <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer : ${label}`} disabled={disabled || !(numeric(value)! > 0)} onPress={() => onChange(String(Math.max(0, (numeric(value) ?? 0) - 1)))} style={s.step}><Text style={s.symbol}>−</Text></Pressable> : null}
      <TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChange} keyboardType={kind === "time" ? "numbers-and-punctuation" : "decimal-pad"} placeholder={kind === "time" ? "HH:MM" : "—"} placeholderTextColor={colors.muted2} maxLength={kind === "time" ? 5 : 10} style={[s.input, disabled && { color: colors.green }]} />
      {kind === "count" ? <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter : ${label}`} disabled={disabled} onPress={() => onChange(String((numeric(value) ?? 0) + 1))} style={s.step}><Text style={s.symbol}>+</Text></Pressable> : null}
      <Text style={s.unit}>{unit}</Text>
    </View>
  </View>;
}
const s = StyleSheet.create({
  card: { borderRadius: 22, padding: 18, gap: 16, backgroundColor: "rgba(30,32,34,0.94)", borderWidth: 1, borderColor: colors.borderSoft },
  answered: { borderColor: "#49412B" }, heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  question: { color: colors.text, fontSize: 16, fontWeight: "700", lineHeight: 23 }, answers: { flexDirection: "row", gap: 8 },
  answer: { width: 44, minHeight: 46, borderRadius: 13, backgroundColor: "#37393B", alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: colors.yellow }, symbol: { color: colors.text, fontSize: 20, fontWeight: "800" }, selectedText: { color: colors.black },
  details: { borderTopWidth: 1, borderTopColor: "#434446", paddingTop: 16, gap: 16 },
  field: { gap: 9 }, label: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  valueRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }, input: { flex: 1, minHeight: 46, minWidth: 60, borderRadius: 12, paddingHorizontal: 14, backgroundColor: "#37393B", color: colors.text, fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  step: { width: 44, minHeight: 46, borderRadius: 12, backgroundColor: "#37393B", alignItems: "center", justifyContent: "center" },
  unit: { color: colors.muted, fontSize: 12, maxWidth: 64 }, scale: { gap: 7 },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 15 }, bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  weekly: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }, clear: { color: colors.muted, fontSize: 11, textDecorationLine: "underline" },
});
