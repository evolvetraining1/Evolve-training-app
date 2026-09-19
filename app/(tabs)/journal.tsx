import { router } from "expo-router";
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

import { PrimaryButton } from "@/src/components/ui";
import { localDateString } from "@/src/lib/date";
import {
  loadJournalDay,
  loadWellnessTrends,
  RoutinePreference,
  routineIsEnabled,
  routinesForDate,
  saveJournalDay,
  saveRoutinePreferences,
} from "@/src/lib/wellness-api";
import {
  calculateWellnessScores,
  RoutineValue,
  scoreColor,
  sleepHoursFromTimes,
  WellnessBaseline,
  WellnessRoutine,
  wellnessLabel,
} from "@/src/lib/wellness";
import { colors, radius } from "@/src/theme";

const CATEGORY_LABELS: Record<string, string> = {
  sleep: "Sommeil",
  recovery: "Récupération",
  mental: "Mental et stress",
  nutrition: "Nutrition",
  hydration: "Hydratation",
  supplements: "Supplémentation",
  activity: "Activité",
  environment: "Environnement",
  performance: "Entraînement",
  health: "Santé et symptômes",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);
const DAY_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function parseDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function shiftDate(date: string, days: number) {
  const next = parseDate(date);
  next.setDate(next.getDate() + days);
  return localDateString(next);
}

function dayTitle(date: string) {
  const parsed = parseDate(date);
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
}

function ScoreTile({
  label,
  value,
  type,
  compact = false,
}: {
  label: string;
  value: number | null;
  type: "recovery" | "stress" | "readiness" | "habits";
  compact?: boolean;
}) {
  const accent = scoreColor(value, type === "stress");
  return (
    <View style={[styles.scoreTile, compact && styles.scoreTileCompact]}>
      <Text style={styles.scoreTileLabel}>{label}</Text>
      <View style={[styles.scoreRing, { borderColor: accent }]}>
        <Text style={[styles.scoreTileValue, { color: accent }]}>
          {value ?? "--"}
        </Text>
      </View>
      <Text style={styles.scoreTileState}>{wellnessLabel(value, type)}</Text>
    </View>
  );
}

export default function JournalScreen() {
  const [selectedDate, setSelectedDate] = useState(localDateString());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalog, setCatalog] = useState<WellnessRoutine[]>([]);
  const [preferences, setPreferences] = useState<RoutinePreference[]>([]);
  const [values, setValues] = useState<Record<string, RoutineValue>>({});
  const [baseline, setBaseline] = useState<WellnessBaseline>({});
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const [day, trends] = await Promise.all([
        loadJournalDay(selectedDate),
        loadWellnessTrends(21),
      ]);
      setCatalog(day.catalog);
      setPreferences(day.preferences);
      setValues(day.values);
      setNotes(day.notes);
      setBaseline(day.baseline);
      setSelectedIds(
        day.catalog
          .filter((routine) => routineIsEnabled(routine, day.preferences))
          .map((routine) => routine.id)
      );
      setCompletedDates(new Set(trends.filter((row) => row.completion_score > 0).map((row) => row.score_date)));
    } catch (error: any) {
      setMessage(error?.message ?? "Impossible de charger le journal.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRoutines = useMemo(
    () => routinesForDate(catalog, preferences, selectedDate),
    [catalog, preferences, selectedDate]
  );

  const effectiveValues = useMemo(() => {
    const next = { ...values };
    const bedtime = activeRoutines.find((routine) => routine.slug === "bedtime");
    const wake = activeRoutines.find((routine) => routine.slug === "wake_time");
    const duration = activeRoutines.find((routine) => routine.slug === "sleep_duration");
    if (bedtime && wake && duration) {
      const hours = sleepHoursFromTimes(values[bedtime.id]?.value, values[wake.id]?.value);
      if (hours != null) next[duration.id] = { value: String(hours) };
    }
    return next;
  }, [activeRoutines, values]);

  const scores = useMemo(
    () => calculateWellnessScores(activeRoutines, effectiveValues, baseline),
    [activeRoutines, effectiveValues, baseline]
  );

  const dateStrip = useMemo(() => {
    const center = parseDate(selectedDate);
    return [-2, -1, 0, 1, 2].map((offset) => {
      const date = new Date(center);
      date.setDate(center.getDate() + offset);
      return { date: localDateString(date), day: DAY_SHORT[date.getDay()], number: date.getDate() };
    });
  }, [selectedDate]);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return catalog.filter((routine) => {
      const categoryMatch = category === "all" || routine.category === category;
      const searchMatch = !query || `${routine.name} ${routine.description ?? ""}`.toLocaleLowerCase("fr").includes(query);
      return categoryMatch && searchMatch;
    });
  }, [catalog, category, search]);

  function changeDate(direction: number) {
    const next = shiftDate(selectedDate, direction);
    if (next <= localDateString()) setSelectedDate(next);
  }

  function setNumeric(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: { ...current[id], value } }));
  }

  function setBoolean(id: string, value: boolean) {
    setValues((current) => ({ ...current, [id]: { ...current[id], bool: value } }));
  }

  async function save() {
    try {
      setSaving(true);
      setMessage("");
      await saveJournalDay({ date: selectedDate, routines: activeRoutines, values: effectiveValues, notes, scores });
      setCompletedDates((current) => new Set(current).add(selectedDate));
      setMessage("Journal enregistré. Les tendances ont été mises à jour.");
    } catch (error: any) {
      setMessage(error?.message ?? "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCatalog() {
    try {
      setCatalogSaving(true);
      await saveRoutinePreferences(catalog, selectedIds, preferences);
      setCatalogOpen(false);
      await load();
    } catch (error: any) {
      setMessage(error?.message ?? "Impossible d’enregistrer les routines.");
    } finally {
      setCatalogSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.yellow} size="large" />
        <Text style={styles.loadingText}>Préparation du journal…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>EVOLVE TRAINING</Text>
            <Text style={styles.pageTitle}>JOURNAL</Text>
          </View>
          <Pressable style={styles.trendsButton} onPress={() => router.push("/journal-trends" as never)}>
            <Text style={styles.trendsButtonText}>TENDANCES  ›</Text>
          </Pressable>
        </View>

        <View style={styles.dateNav}>
          <Pressable style={styles.arrowButton} onPress={() => changeDate(-1)}><Text style={styles.arrow}>‹</Text></Pressable>
          <Text style={styles.dateNavTitle}>{selectedDate === localDateString() ? "AUJOURD’HUI" : dayTitle(selectedDate).toUpperCase()}</Text>
          <Pressable style={styles.arrowButton} disabled={selectedDate >= localDateString()} onPress={() => changeDate(1)}>
            <Text style={[styles.arrow, selectedDate >= localDateString() && styles.arrowDisabled]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.dateStrip}>
          {dateStrip.map((item) => {
            const selected = item.date === selectedDate;
            const future = item.date > localDateString();
            const complete = completedDates.has(item.date);
            return (
              <Pressable key={item.date} disabled={future} onPress={() => setSelectedDate(item.date)} style={[styles.datePill, selected && styles.datePillSelected, future && styles.datePillDisabled]}>
                <Text style={[styles.dateDay, selected && styles.dateTextSelected]}>{item.day}</Text>
                <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{item.number}</Text>
                <View style={[styles.dateDot, complete && styles.dateDotDone]}>{complete ? <Text style={styles.dateCheck}>✓</Text> : null}</View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.prompt}>Qu’est-ce qui se passe {selectedDate === localDateString() ? "aujourd’hui" : `le ${dayTitle(selectedDate)}`} ?</Text>

        <View style={styles.primaryScores}>
          <ScoreTile label="RÉCUPÉRATION" value={scores.recovery} type="recovery" />
          <ScoreTile label="STRESS" value={scores.stress} type="stress" />
        </View>
        <View style={styles.secondaryScores}>
          <ScoreTile compact label="DISPONIBILITÉ" value={scores.readiness} type="readiness" />
          <ScoreTile compact label="HABITUDES" value={scores.habits} type="habits" />
        </View>

        <View style={styles.confidenceCard}>
          <View style={styles.confidenceHeader}>
            <Text style={styles.confidenceTitle}>FIABILITÉ DU SCORE</Text>
            <Text style={styles.confidenceValue}>{scores.confidence}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${scores.confidence}%` }]} /></View>
          <Text style={styles.confidenceText}>{scores.answered}/{scores.expected} réponses · complète les données principales pour améliorer la précision.</Text>
        </View>

        {scores.drivers.length ? (
          <View style={styles.driversCard}>
            <Text style={styles.blockEyebrow}>FACTEURS DU JOUR</Text>
            {scores.drivers.map((driver) => (
              <View key={driver.slug} style={styles.driverRow}>
                <View style={[styles.driverDot, { backgroundColor: driver.direction === "support" ? colors.green : colors.red }]} />
                <Text style={styles.driverName}>{driver.label}</Text>
                <Text style={[styles.driverState, { color: driver.direction === "support" ? colors.green : colors.red }]}>{driver.direction === "support" ? "SOUTIEN" : "CHARGE"}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>ROUTINES DU JOUR</Text>
            <Text style={styles.sectionSubtitle}>Réponds rapidement, puis termine ton journal.</Text>
          </View>
          <Pressable style={styles.editButton} onPress={() => setCatalogOpen(true)}><Text style={styles.editButtonText}>MODIFIER</Text></Pressable>
        </View>

        {activeRoutines.map((routine) => (
          <RoutineQuestion
            key={routine.id}
            routine={routine}
            input={effectiveValues[routine.id]}
            derived={routine.slug === "sleep_duration" && Boolean(effectiveValues[routine.id]?.value)}
            onBoolean={(value) => setBoolean(routine.id, value)}
            onNumeric={(value) => setNumeric(routine.id, value)}
          />
        ))}

        {!activeRoutines.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucune routine prévue aujourd’hui</Text>
            <Text style={styles.emptyText}>Ajoute des comportements à suivre pour alimenter tes tendances.</Text>
          </View>
        ) : null}

        <View style={styles.notesBlock}>
          <Text style={styles.blockEyebrow}>NOTES</Text>
          <TextInput multiline value={notes} onChangeText={setNotes} placeholder="Sensations, contexte, événement particulier…" placeholderTextColor={colors.muted2} style={styles.notesInput} />
        </View>

        <PrimaryButton label={saving ? "ENREGISTREMENT…" : "J’AI TERMINÉ"} disabled={saving} onPress={() => void save()} />
        {message ? <Text selectable style={styles.message}>{message}</Text> : null}
        <Text style={styles.disclaimer}>Indicateurs de coaching basés sur tes réponses et ta tendance personnelle. Ils ne constituent pas un diagnostic médical.</Text>
      </ScrollView>

      <Modal visible={catalogOpen} transparent animationType="slide" onRequestClose={() => setCatalogOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>SÉLECTIONNER DES ROUTINES</Text>
                <Text style={styles.modalSubtitle}>{selectedIds.length} comportements sélectionnés</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setCatalogOpen(false)}><Text style={styles.closeText}>×</Text></Pressable>
            </View>

            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un comportement…" placeholderTextColor={colors.muted2} style={styles.searchInput} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
              {["all", ...CATEGORY_ORDER].map((key) => {
                const active = category === key;
                return (
                  <Pressable key={key} onPress={() => setCategory(key)} style={[styles.categoryChip, active && styles.categoryChipActive]}>
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{key === "all" ? "TOUT" : CATEGORY_LABELS[key].toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView contentContainerStyle={styles.catalogList} keyboardShouldPersistTaps="handled">
              {filteredCatalog.map((routine) => {
                const selected = selectedIds.includes(routine.id);
                return (
                  <Pressable key={routine.id} onPress={() => setSelectedIds((current) => selected ? current.filter((id) => id !== routine.id) : [...current, routine.id])} style={styles.catalogRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogName}>{routine.name}</Text>
                      <Text style={styles.catalogDescription}>{routine.description ?? CATEGORY_LABELS[routine.category]}</Text>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <PrimaryButton label={catalogSaving ? "ENREGISTREMENT…" : "ENREGISTRER LES ROUTINES"} disabled={catalogSaving} onPress={() => void saveCatalog()} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function RoutineQuestion({ routine, input, derived, onBoolean, onNumeric }: {
  routine: WellnessRoutine;
  input?: RoutineValue;
  derived?: boolean;
  onBoolean: (value: boolean) => void;
  onNumeric: (value: string) => void;
}) {
  const question = routine.description || routine.name;
  return (
    <View style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{CATEGORY_LABELS[routine.category] ?? routine.category}</Text></View>
        {derived ? <Text style={styles.derivedBadge}>CALCULÉ</Text> : null}
      </View>
      <Text style={styles.questionTitle}>{routine.name}</Text>
      <Text style={styles.questionText}>{question}</Text>

      {routine.input_type === "boolean" ? (
        <View style={styles.booleanRow}>
          <Pressable onPress={() => onBoolean(false)} style={[styles.answerButton, input?.bool === false && styles.answerButtonActive]}>
            <Text style={[styles.answerSymbol, input?.bool === false && styles.answerSymbolActive]}>×</Text>
            <Text style={[styles.answerLabel, input?.bool === false && styles.answerLabelActive]}>NON</Text>
          </Pressable>
          <Pressable onPress={() => onBoolean(true)} style={[styles.answerButton, input?.bool === true && styles.answerButtonActive]}>
            <Text style={[styles.answerSymbol, input?.bool === true && styles.answerSymbolActive]}>✓</Text>
            <Text style={[styles.answerLabel, input?.bool === true && styles.answerLabelActive]}>OUI</Text>
          </Pressable>
        </View>
      ) : routine.input_type === "scale_5" || routine.input_type === "scale_10" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scaleRow}>
          {Array.from({ length: routine.input_type === "scale_5" ? 5 : 10 }, (_, index) => String(index + 1)).map((number) => {
            const selected = input?.value === number;
            return <Pressable key={number} onPress={() => onNumeric(number)} style={[styles.scaleButton, selected && styles.scaleButtonActive]}><Text style={[styles.scaleText, selected && styles.scaleTextActive]}>{number}</Text></Pressable>;
          })}
        </ScrollView>
      ) : (
        <View style={styles.valueRow}>
          <TextInput editable={!derived} value={input?.value ?? ""} onChangeText={onNumeric} keyboardType={routine.input_type === "time" ? "numbers-and-punctuation" : "decimal-pad"} placeholder={routine.input_type === "time" ? "23:30" : "Valeur"} placeholderTextColor={colors.muted2} maxLength={routine.input_type === "time" ? 5 : undefined} style={[styles.valueInput, derived && styles.valueInputDerived]} />
          <Text style={styles.unitText}>{routine.input_type === "time" ? "HH:MM" : routine.unit}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 58, paddingBottom: 140, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: 12 },
  loadingText: { color: colors.muted, fontSize: 13 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 2.2 },
  pageTitle: { color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -0.8, marginTop: 4 },
  trendsButton: { minHeight: 42, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, backgroundColor: "rgba(12,12,13,0.92)" },
  trendsButtonText: { color: colors.yellow, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 4 },
  arrowButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  arrow: { color: colors.text, fontSize: 34, lineHeight: 36, fontWeight: "500" },
  arrowDisabled: { color: colors.border },
  dateNavTitle: { minWidth: 150, textAlign: "center", color: colors.text, fontSize: 14, fontWeight: "900", letterSpacing: 1.2 },
  dateStrip: { flexDirection: "row", justifyContent: "space-between", gap: 7 },
  datePill: { flex: 1, minHeight: 82, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: "transparent" },
  datePillSelected: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.09)" },
  datePillDisabled: { opacity: 0.25 },
  dateDay: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  dateNumber: { color: colors.text, fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] },
  dateTextSelected: { color: colors.yellow },
  dateDot: { width: 20, height: 20, borderRadius: 10, marginTop: 4, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  dateDotDone: { backgroundColor: colors.green },
  dateCheck: { color: colors.black, fontSize: 12, fontWeight: "900" },
  prompt: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900", letterSpacing: -0.4, paddingVertical: 10 },
  primaryScores: { flexDirection: "row", gap: 10 },
  secondaryScores: { flexDirection: "row", gap: 10 },
  scoreTile: { flex: 1, minHeight: 176, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(12,12,13,0.94)", alignItems: "center", gap: 8 },
  scoreTileCompact: { minHeight: 138 },
  scoreTileLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  scoreRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 7, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  scoreTileValue: { fontSize: 27, fontWeight: "900", fontVariant: ["tabular-nums"] },
  scoreTileState: { color: colors.text, fontSize: 11, fontWeight: "800" },
  confidenceCard: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, backgroundColor: "rgba(11,11,12,0.92)", padding: 14, gap: 9 },
  confidenceHeader: { flexDirection: "row", justifyContent: "space-between" },
  confidenceTitle: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  confidenceValue: { color: colors.yellow, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.yellow },
  confidenceText: { color: colors.muted2, fontSize: 11, lineHeight: 16 },
  driversCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: "rgba(9,9,10,0.94)", padding: 16, gap: 11 },
  blockEyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  driverDot: { width: 8, height: 8, borderRadius: 4 },
  driverName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  driverState: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: 0.7 },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  editButton: { borderWidth: 1, borderColor: colors.yellow, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  editButtonText: { color: colors.yellow, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  questionCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(13,13,14,0.95)", padding: 16, gap: 9 },
  questionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "rgba(255,196,0,0.1)" },
  categoryBadgeText: { color: colors.yellow, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  derivedBadge: { color: colors.muted2, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  questionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  questionText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  booleanRow: { flexDirection: "row", gap: 10, paddingTop: 3 },
  answerButton: { flex: 1, minHeight: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  answerButtonActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.12)" },
  answerSymbol: { color: colors.muted, fontSize: 20, fontWeight: "900" },
  answerSymbolActive: { color: colors.yellow },
  answerLabel: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  answerLabelActive: { color: colors.yellow },
  scaleRow: { gap: 7, paddingTop: 3 },
  scaleButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  scaleButtonActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.15)" },
  scaleText: { color: colors.muted, fontSize: 14, fontWeight: "900" },
  scaleTextActive: { color: colors.yellow },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 3 },
  valueInput: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: 14, fontSize: 17, fontWeight: "800" },
  valueInputDerived: { color: colors.green, borderColor: "rgba(100,217,75,0.35)" },
  unitText: { minWidth: 48, color: colors.muted, fontSize: 13, fontWeight: "800" },
  emptyCard: { padding: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  notesBlock: { gap: 9, paddingTop: 8 },
  notesInput: { minHeight: 128, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, padding: 14, fontSize: 14, textAlignVertical: "top" },
  message: { color: colors.yellow, textAlign: "center", fontSize: 12, lineHeight: 18 },
  disclaimer: { color: colors.muted2, textAlign: "center", fontSize: 10, lineHeight: 15, paddingHorizontal: 12 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
  modalSheet: { height: "91%", borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: colors.border, backgroundColor: "#10161A", padding: 20, paddingBottom: 30, gap: 15 },
  modalGrabber: { alignSelf: "center", width: 70, height: 5, borderRadius: 3, backgroundColor: "#596167" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: 0.8 },
  modalSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  closeText: { color: colors.text, fontSize: 27, lineHeight: 28 },
  searchInput: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "#090D10", color: colors.text, paddingHorizontal: 16, fontSize: 15, fontWeight: "700" },
  categories: { gap: 8, paddingRight: 20 },
  categoryChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surface2 },
  categoryChipActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.12)" },
  categoryChipText: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  categoryChipTextActive: { color: colors.yellow },
  catalogList: { paddingBottom: 16 },
  catalogRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)", paddingVertical: 12 },
  catalogName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  catalogDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  checkbox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: colors.muted, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  checkboxMark: { color: colors.black, fontSize: 17, fontWeight: "900" },
});
