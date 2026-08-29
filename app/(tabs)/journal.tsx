import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { upsertTodayCheckin } from "@/src/lib/api";

type Routine = {
  id: string;
  slug: string;
  name: string;
  category: string;
  input_type: string;
  unit: string | null;
  description: string | null;
  default_enabled: boolean;
  polarity: string;
  target_min: number | null;
  target_max: number | null;
  recovery_weight: number;
  stress_weight: number;
  readiness_weight: number;
  sort_order: number;
};

type RoutineValue = {
  value?: string;
  bool?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  sleep: "SOMMEIL",
  recovery: "RÉCUPÉRATION",
  mental: "MENTAL",
  nutrition: "ALIMENTATION",
  hydration: "HYDRATATION",
  supplements: "SUPPLÉMENTATION",
  activity: "ACTIVITÉ",
  environment: "ENVIRONNEMENT",
  performance: "PERFORMANCE",
  health: "SANTÉ",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function numeric(value?: string) {
  if (!value) return null;

  const n = Number(value.replace(",", "."));

  return Number.isFinite(n) ? n : null;
}


function sleepHoursFromTimes(bedtime?: string, wakeTime?: string) {
  const parse = (value?: string) => {
    const match = (value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);

    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  };

  const bed = parse(bedtime);
  const wake = parse(wakeTime);

  if (bed == null || wake == null) return null;

  let duration = wake - bed;

  // Passage de minuit.
  if (duration <= 0) duration += 24 * 60;

  // Garde-fou contre une saisie incohérente.
  if (duration <= 0 || duration > 16 * 60) return null;

  return Math.round((duration / 60) * 100) / 100;
}

/**
 * Transforme une donnée brute en qualité 0 → 1.
 * 1 = favorable
 * 0 = défavorable
 */
function routineQuality(routine: Routine, input?: RoutineValue) {
  if (!input) return null;

  if (routine.input_type === "boolean") {
    if (input.bool == null) return null;

    if (routine.polarity === "lower_better") {
      return input.bool ? 0 : 1;
    }

    return input.bool ? 1 : 0;
  }

  const value = numeric(input.value);

  if (value == null) return null;

  const min =
    routine.target_min == null ? null : Number(routine.target_min);

  const max =
    routine.target_max == null ? null : Number(routine.target_max);

  if (routine.polarity === "higher_better") {
    if (min == null || min <= 0) return null;
    return clamp(value / min);
  }

  if (routine.polarity === "lower_better") {
    const threshold =
      max != null ? max :
      min != null ? min :
      null;

    if (threshold == null) return null;

    if (threshold === 0) {
      return value <= 0 ? 1 : 0;
    }

    if (value <= threshold) return 1;

    return clamp(1 - (value - threshold) / threshold);
  }

  if (routine.polarity === "target_range") {
    if (min == null && max == null) return null;

    if (min != null && value < min) {
      return min <= 0 ? 0 : clamp(value / min);
    }

    if (max != null && value > max) {
      return value <= 0 ? 0 : clamp(max / value);
    }

    return 1;
  }

  return null;
}

function score(
  routines: Routine[],
  values: Record<string, RoutineValue>,
  type: "recovery" | "stress" | "readiness"
) {
  let totalWeight = 0;
  let total = 0;
  let answered = 0;

  routines.forEach((routine) => {
    const quality = routineQuality(routine, values[routine.id]);

    if (quality == null) return;

    let weight = 0;

    if (type === "recovery") {
      weight = Math.abs(Number(routine.recovery_weight || 0));
    }

    if (type === "stress") {
      weight = Math.abs(Number(routine.stress_weight || 0));
    }

    if (type === "readiness") {
      weight = Math.abs(Number(routine.readiness_weight || 0));
    }

    if (weight <= 0) return;

    answered += 1;
    totalWeight += weight;

    // Stress = charge défavorable.
    total +=
      type === "stress"
        ? (1 - quality) * weight
        : quality * weight;
  });

  // On évite d'afficher un score pseudo-précis avec 1 seule réponse.
  if (answered < 3 || totalWeight <= 0) return null;

  return Math.round((total / totalWeight) * 100);
}

function scoreLabel(
  value: number | null,
  type: "recovery" | "stress" | "readiness"
) {
  if (value == null) return "À compléter";

  if (type === "stress") {
    if (value <= 30) return "Faible";
    if (value <= 60) return "Modéré";
    return "Élevé";
  }

  if (value >= 75) return "Bon";
  if (value >= 50) return "Moyen";
  return "Faible";
}

export default function JournalScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<Routine[]>([]);
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, RoutineValue>>({});
  const [message, setMessage] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      const { data: routines, error: routinesError } = await supabase
        .from("routine_catalog")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (routinesError) throw routinesError;

      const typedRoutines = (routines ?? []) as Routine[];

      setCatalog(typedRoutines);

      const { data: userRoutines, error: urError } = await supabase
        .from("user_routines")
        .select("routine_id, enabled")
        .eq("athlete_id", user.id)
        .eq("enabled", true);

      if (urError) throw urError;

      setCustomIds(
        (userRoutines ?? []).map((row: any) => row.routine_id)
      );

      const { data: logs, error: logsError } = await supabase
        .from("routine_logs")
        .select("routine_id, value, bool_value")
        .eq("athlete_id", user.id)
        .eq("log_date", today());

      if (logsError) throw logsError;

      const loaded: Record<string, RoutineValue> = {};

      (logs ?? []).forEach((row: any) => {
        loaded[row.routine_id] = {
          value:
            row.value == null
              ? undefined
              : String(row.value),
          bool:
            row.bool_value == null
              ? undefined
              : Boolean(row.bool_value),
        };
      });

      setValues(loaded);
    } catch (e: any) {
      setMessage(
        e?.message ?? "Impossible de charger le journal."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeRoutines = useMemo(() => {
    return catalog.filter(
      (routine) =>
        routine.default_enabled ||
        customIds.includes(routine.id)
    );
  }, [catalog, customIds]);

  const optionalRoutines = useMemo(() => {
    return catalog.filter(
      (routine) => !routine.default_enabled
    );
  }, [catalog]);

  const recoveryScore = useMemo(
    () => score(activeRoutines, values, "recovery"),
    [activeRoutines, values]
  );

  const stressScore = useMemo(
    () => score(activeRoutines, values, "stress"),
    [activeRoutines, values]
  );

  const readinessScore = useMemo(
    () => score(activeRoutines, values, "readiness"),
    [activeRoutines, values]
  );

  function setNumericValue(id: string, value: string) {
    setValues((current) => ({
      ...current,
      [id]: {
        ...current[id],
        value,
      },
    }));
  }

  function setBooleanValue(id: string, value: boolean) {
    setValues((current) => ({
      ...current,
      [id]: {
        ...current[id],
        bool: value,
      },
    }));
  }

  async function addRoutine(routine: Routine) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Utilisateur non connecté.");

      const { error } = await supabase
        .from("user_routines")
        .upsert(
          {
            athlete_id: user.id,
            routine_id: routine.id,
            enabled: true,
          },
          {
            onConflict: "athlete_id,routine_id",
          }
        );

      if (error) throw error;

      setCustomIds((current) =>
        current.includes(routine.id)
          ? current
          : [...current, routine.id]
      );
    } catch (e: any) {
      setMessage(
        e?.message ?? "Impossible d'ajouter cette routine."
      );
    }
  }

  async function save() {
    try {
      setSaving(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      const valuesToSave: Record<string, RoutineValue> = {
        ...values,
      };

      const bedtimeRoutine = activeRoutines.find(
        (routine) => routine.slug === "bedtime"
      );

      const wakeRoutine = activeRoutines.find(
        (routine) => routine.slug === "wake_time"
      );

      const sleepDurationRoutine = activeRoutines.find(
        (routine) => routine.slug === "sleep_duration"
      );

      if (bedtimeRoutine && wakeRoutine && sleepDurationRoutine) {
        const calculatedSleep = sleepHoursFromTimes(
          valuesToSave[bedtimeRoutine.id]?.value,
          valuesToSave[wakeRoutine.id]?.value
        );

        if (calculatedSleep != null) {
          valuesToSave[sleepDurationRoutine.id] = {
            value: String(calculatedSleep),
          };
        }
      }

      const rows = activeRoutines
        .map((routine) => {
          const input = valuesToSave[routine.id];

          if (!input) return null;

          if (routine.input_type === "boolean") {
            if (input.bool == null) return null;

            return {
              athlete_id: user.id,
              routine_id: routine.id,
              log_date: today(),
              bool_value: input.bool,
              value: null,
            };
          }

          if (routine.input_type === "time") {
            const value = input.value?.trim();

            if (!value) return null;

            if (!/^(\d{1,2}):(\d{2})$/.test(value)) return null;

            return {
              athlete_id: user.id,
              routine_id: routine.id,
              log_date: today(),
              value,
              bool_value: null,
            };
          }

          const value = numeric(input.value);

          if (value == null) return null;

          return {
            athlete_id: user.id,
            routine_id: routine.id,
            log_date: today(),
            value,
            bool_value: null,
          };
        })
        .filter(Boolean);

      if (rows.length) {
        const { error } = await supabase
          .from("routine_logs")
          .upsert(rows as any[], {
            onConflict: "athlete_id,routine_id,log_date",
          });

        if (error) throw error;
      }

      // Synchronise les anciens champs de check-in.
      // Ça permet à l'accueil actuel de continuer à fonctionner.
      const bySlug: Record<string, Routine> = {};

      activeRoutines.forEach((routine) => {
        bySlug[routine.slug] = routine;
      });

      const getValue = (slug: string) => {
        const routine = bySlug[slug];
        if (!routine) return null;
        return numeric(valuesToSave[routine.id]?.value);
      };

      const sleepHours = getValue("sleep_duration");

      await upsertTodayCheckin({
        sleep_minutes:
          sleepHours == null
            ? null
            : Math.round(sleepHours * 60),
        sleep_quality: getValue("sleep_quality"),
        fatigue: getValue("fatigue"),
        stress: getValue("stress"),
        soreness: getValue("soreness"),
        motivation: getValue("motivation"),
        pain: getValue("pain"),
      });

      setValues(valuesToSave);

      await load();

      setMessage("Journal enregistré.");
    } catch (e: any) {
      setMessage(
        e?.message ?? "Erreur lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.yellow}
          size="large"
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow="EVOLVE TRAINING"
          title="Journal & routine"
          subtitle="Mesure ce qui influence réellement ta récupération et ta performance."
        />

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>RÉCUPÉRATION</Text>
            <Text style={styles.scoreValue}>
              {recoveryScore ?? "--"}
            </Text>
            <Text style={styles.scoreState}>
              {scoreLabel(recoveryScore, "recovery")}
            </Text>
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>STRESS</Text>
            <Text style={styles.scoreValue}>
              {stressScore ?? "--"}
            </Text>
            <Text style={styles.scoreState}>
              {scoreLabel(stressScore, "stress")}
            </Text>
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>READINESS</Text>
            <Text style={styles.scoreValue}>
              {readinessScore ?? "--"}
            </Text>
            <Text style={styles.scoreState}>
              {scoreLabel(readinessScore, "readiness")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          FONDAMENTAUX DU JOUR
        </Text>

        <Text style={styles.sectionSubtitle}>
          Ces données alimentent les indicateurs de récupération,
          stress et disponibilité à l'entraînement.
        </Text>

        {activeRoutines.map((routine) => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            input={values[routine.id]}
            onNumeric={(value) =>
              setNumericValue(routine.id, value)
            }
            onBoolean={(value) =>
              setBooleanValue(routine.id, value)
            }
          />
        ))}

        <Pressable
          style={styles.addButton}
          onPress={() => setCatalogOpen(true)}
        >
          <Text style={styles.addPlus}>＋</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.addTitle}>
              AJOUTER UNE ROUTINE
            </Text>
            <Text style={styles.addSubtitle}>
              Récupération, santé, nutrition, sommeil,
              performance…
            </Text>
          </View>
        </Pressable>

        <PrimaryButton
          label={
            saving
              ? "ENREGISTREMENT..."
              : "ENREGISTRER LE JOURNAL"
          }
          onPress={save}
        />

        {message ? (
          <Text style={styles.message}>{message}</Text>
        ) : null}
      </ScrollView>

      <Modal
        visible={catalogOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCatalogOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>
                  PERSONNALISATION
                </Text>
                <Text style={styles.modalTitle}>
                  Ajouter une routine
                </Text>
              </View>

              <Pressable
                onPress={() => setCatalogOpen(false)}
                style={styles.close}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.catalog}
            >
              {Object.keys(CATEGORY_LABELS).map((category) => {
                const rows = optionalRoutines.filter(
                  (routine) =>
                    routine.category === category
                );

                if (!rows.length) return null;

                return (
                  <View key={category}>
                    <Text style={styles.catalogCategory}>
                      {CATEGORY_LABELS[category]}
                    </Text>

                    {rows.map((routine) => {
                      const active = customIds.includes(
                        routine.id
                      );

                      return (
                        <Pressable
                          key={routine.id}
                          onPress={() =>
                            !active && addRoutine(routine)
                          }
                          style={styles.catalogRow}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.catalogName}>
                              {routine.name}
                            </Text>

                            <Text style={styles.catalogMeta}>
                              {routine.unit
                                ? `Suivi en ${routine.unit}`
                                : routine.input_type ===
                                  "boolean"
                                ? "Oui / Non"
                                : "Suivi quotidien"}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.catalogAdd,
                              active &&
                                styles.catalogAdded,
                            ]}
                          >
                            {active ? "AJOUTÉE" : "＋"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function RoutineCard({
  routine,
  input,
  onNumeric,
  onBoolean,
}: {
  routine: Routine;
  input?: RoutineValue;
  onNumeric: (value: string) => void;
  onBoolean: (value: boolean) => void;
}) {
  const category =
    CATEGORY_LABELS[routine.category] ??
    routine.category.toUpperCase();

  return (
    <Card style={styles.routineCard}>
      <View style={styles.routineHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.routineCategory}>
            {category}
          </Text>

          <Text style={styles.routineName}>
            {routine.name}
          </Text>
        </View>

        {routine.default_enabled ? (
          <Text style={styles.baseBadge}>BASE</Text>
        ) : null}
      </View>

      {routine.input_type === "boolean" ? (
        <View style={styles.booleanRow}>
          <Pressable
            style={[
              styles.booleanButton,
              input?.bool === true &&
                styles.booleanActive,
            ]}
            onPress={() => onBoolean(true)}
          >
            <Text
              style={[
                styles.booleanText,
                input?.bool === true &&
                  styles.booleanTextActive,
              ]}
            >
              OUI
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.booleanButton,
              input?.bool === false &&
                styles.booleanActive,
            ]}
            onPress={() => onBoolean(false)}
          >
            <Text
              style={[
                styles.booleanText,
                input?.bool === false &&
                  styles.booleanTextActive,
              ]}
            >
              NON
            </Text>
          </Pressable>
        </View>
      ) : routine.input_type === "time" ? (
        <View style={styles.valueRow}>
          <TextInput
            value={input?.value ?? ""}
            onChangeText={onNumeric}
            keyboardType="default"
            placeholder={
              routine.slug === "bedtime" ? "23:30" : "07:00"
            }
            placeholderTextColor={colors.muted}
            maxLength={5}
            style={styles.input}
          />

          <Text style={styles.unit}>
            HH:MM
          </Text>
        </View>
      ) : (
        <View style={styles.valueRow}>
          <TextInput
            value={input?.value ?? ""}
            onChangeText={onNumeric}
            keyboardType="decimal-pad"
            placeholder={
              routine.input_type === "scale_5"
                ? "1 - 5"
                : routine.input_type === "scale_10"
                ? "0 - 10"
                : "Valeur"
            }
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          {routine.unit ? (
            <Text style={styles.unit}>{routine.unit}</Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 68,
    paddingBottom: 130,
    backgroundColor: "transparent",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },

  scoreRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 30,
  },

  scoreCard: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
  },

  scoreLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  scoreValue: {
    color: colors.yellow,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 12,
  },

  scoreState: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 15,
  },

  routineCard: {
    marginBottom: 12,
  },

  routineHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  routineCategory: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  routineName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  baseBadge: {
    color: colors.yellow,
    fontSize: 9,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: "800",
  },

  unit: {
    minWidth: 38,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },

  booleanRow: {
    flexDirection: "row",
    gap: 10,
  },

  booleanButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },

  booleanActive: {
    borderColor: colors.yellow,
    backgroundColor: "#241D00",
  },

  booleanText: {
    color: colors.muted,
    fontWeight: "900",
  },

  booleanTextActive: {
    color: colors.yellow,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 18,
    padding: 18,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: "#171400",
  },

  addPlus: {
    color: colors.yellow,
    fontSize: 34,
    fontWeight: "400",
  },

  addTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  addSubtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  message: {
    color: colors.yellow,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.72)",
  },

  modal: {
    maxHeight: "88%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 22,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  modalEyebrow: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  modalTitle: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 5,
  },

  close: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "700",
  },

  catalog: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  catalogCategory: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 8,
  },

  catalogRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },

  catalogName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },

  catalogMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },

  catalogAdd: {
    color: colors.yellow,
    fontSize: 25,
    fontWeight: "900",
    marginLeft: 14,
  },

  catalogAdded: {
    fontSize: 10,
    letterSpacing: 1,
  },
});
