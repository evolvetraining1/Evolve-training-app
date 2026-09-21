import { numeric, parseClockMinutes, RoutineValue, WellnessRoutine } from "./wellness";

export type DetailField = { key: string; label: string; kind: "number" | "count" | "time"; unit?: string };
type Behavior = { question: string; quantity?: string; fields?: DetailField[] };
const time = (label = "À quelle heure ?"): DetailField => ({ key: "time", label, kind: "time" });
const amount = (unit: string): DetailField => ({ key: "amount", label: `Quelle quantité (${unit}) ?`, kind: "number", unit });
const duration: DetailField = { key: "duration", label: "Pendant combien de temps ?", kind: "number", unit: "min" };
const portions: DetailField = { key: "portions", label: "Combien de portions ?", kind: "count", unit: "portions" };

// Keep existing questions (e.g. a protein TARGET) distinct from consumption.
export const BEHAVIORS: Record<string, Behavior> = {
  protein_target: { question: "As-tu atteint ton objectif de protéines ?", fields: [amount("g")] },
  fiber_target: { question: "As-tu atteint ton objectif de fibres ?", fields: [amount("g")] },
  creatine: { question: "As-tu pris de la créatine ?", fields: [amount("g"), time()] },
  late_screen: { question: "As-tu regardé un écran avant de dormir ?", fields: [duration] },
  late_caffeine: { question: "As-tu consommé de la caféine tardivement ?", fields: [portions, time("Heure de la dernière prise")] },
  alcohol: { question: "As-tu consommé de l’alcool ?", quantity: "Combien de verres ?", fields: [time("Heure du dernier verre")] },
  fruit_veg: { question: "As-tu mangé des fruits ou des légumes ?", quantity: "Combien de portions ?" },
  nap: { question: "As-tu fait une sieste ?", quantity: "Pendant combien de temps ?", fields: [time("Heure de début")] },
  breathing: { question: "As-tu fait des exercices de respiration ?", quantity: "Pendant combien de temps ?", fields: [time()] },
  meditation: { question: "As-tu médité ?", quantity: "Pendant combien de temps ?", fields: [time()] },
  mobility: { question: "As-tu fait de la mobilité ?", quantity: "Pendant combien de temps ?" },
  foam_rolling: { question: "As-tu fait de l’automassage ?", quantity: "Pendant combien de temps ?" },
  zone2: { question: "As-tu fait du cardio léger ?", quantity: "Pendant combien de temps ?" },
  reading: { question: "As-tu lu au lit, sans écran ?", fields: [duration, time("Heure de début")] },
  magnesium: { question: "As-tu pris du magnésium ?", fields: [amount("mg"), time()] },
  caffeine: { question: "As-tu consommé de la caféine ?", fields: [portions, time("Heure de la dernière prise")] },
  proteins: { question: "As-tu consommé des protéines ?", fields: [amount("g")] },
  fibers: { question: "As-tu consommé des fibres ?", fields: [amount("g")] },
  carbohydrates: { question: "As-tu consommé des glucides ?", fields: [amount("g")] },
  meat: { question: "As-tu consommé de la viande ?", fields: [time("Heure du dernier repas")] },
  late_meal: { question: "As-tu mangé peu avant de te coucher ?", fields: [time("Heure du dernier repas")] },
  hot_shower: { question: "As-tu pris une douche chaude avant de dormir ?", fields: [duration, time()] },
  cold_shower: { question: "As-tu pris une douche froide ?", fields: [duration, time()] },
  hot_bath: { question: "As-tu pris un bain chaud ?", fields: [duration, time()] },
  ice_bath: { question: "As-tu pris un bain froid ?", fields: [duration, time()] },
  sauna: { question: "As-tu fait une séance de sauna ?", fields: [duration, time()] },
  standing_desk: { question: "As-tu travaillé à un bureau debout ?", fields: [duration] },
  professional_calls: { question: "As-tu participé à des appels professionnels ?", fields: [duration] },
  sexual_activity: { question: "As-tu eu des rapports sexuels ?", fields: [time()] },
  masturbation: { question: "T’es-tu masturbé(e) ?", fields: [time()] },
};

export function behaviorQuestion(routine: WellnessRoutine) {
  return BEHAVIORS[routine.slug]?.question ?? routine.description ?? routine.name;
}
export function hasYesNo(routine: WellnessRoutine) {
  return routine.input_type === "boolean" || Boolean(BEHAVIORS[routine.slug]?.quantity);
}
export function behaviorAnswer(routine: WellnessRoutine, input?: RoutineValue) {
  if (input?.bool != null) return input.bool;
  if (routine.input_type !== "boolean" && hasYesNo(routine)) {
    const value = numeric(input?.value);
    if (value != null) return value > 0;
  }
  return undefined;
}
export function setBehaviorAnswer(routine: WellnessRoutine, input: RoutineValue | undefined, answer: boolean): RoutineValue {
  if (behaviorAnswer(routine, input) === answer) return {};
  return answer
    ? { bool: true }
    : { bool: false, value: routine.input_type === "boolean" ? undefined : "0" };
}
export function validateRoutineValue(routine: WellnessRoutine, input?: RoutineValue) {
  const raw = input?.value?.trim();
  if (raw) {
    if (routine.input_type === "time") {
      if (parseClockMinutes(raw) == null) throw new Error(`${routine.name} : indique une heure entre 00:00 et 23:59.`);
    } else {
      const n = numeric(raw);
      if (n == null || n < 0) throw new Error(`${routine.name} : indique un nombre positif ou nul.`);
      const max = routine.input_type === "scale_5" ? 5 : routine.input_type === "scale_10" ? 10 : null;
      if (max && (!Number.isInteger(n) || n < 1 || n > max)) throw new Error(`${routine.name} : choisis une valeur entre 1 et ${max}.`);
      if (routine.input_type === "hours" && n > 24) throw new Error(`${routine.name} : la durée ne peut pas dépasser 24 h.`);
    }
  }
  for (const field of BEHAVIORS[routine.slug]?.fields ?? []) {
    const value = input?.details?.[field.key]?.trim();
    if (!value || behaviorAnswer(routine, input) !== true) continue;
    if (field.kind === "time" ? parseClockMinutes(value) == null : numeric(value) == null || numeric(value)! < 0) {
      throw new Error(`${routine.name} — ${field.label} : valeur invalide${field.kind === "time" ? " (HH:MM)" : ""}.`);
    }
  }
}
export function searchText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}
