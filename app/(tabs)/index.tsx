import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
} from "react-native-draggable-flatlist";

import AsyncStorage from "@react-native-async-storage/async-storage";
import BrandLogo from "@/src/components/BrandLogo";
import SideMenu from "@/src/components/SideMenu";
import { colors } from "@/src/theme";
import {
  getLatestPerformance, getMyProfile, getMyUpcomingSessions, getRecentCheckins, getMyProgramsWithSelection, setSelectedProgramId,
  getSessionDetail, getTodayCheckin,
  getProgramDetail,
  getWorkoutTemplateDetail,
  getOrCreateWorkoutSession
} from "@/src/lib/api";
import { displayDuration, recoveryLabel, recoveryScore } from "@/src/lib/dashboard";
import { localDateString } from "@/src/lib/date";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

const DASHBOARD_STORAGE_KEY = "evolve-dashboard-layout-v1";

type DashboardWidgetId =
  | "workout"
  | "nextWorkout"
  | "routine"
  | "today"
  | "performance"
  | "programs"
  | "nutrition"
  | "messaging"
  | "oneRM"
  | "macros";

type DashboardWidget = {
  id: DashboardWidgetId;
  label: string;
  visible: boolean;
};

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: "workout", label: "Séance du jour", visible: true },
  { id: "nextWorkout", label: "Prochaine séance", visible: true },
  { id: "routine", label: "Suivi de routine", visible: true },
  { id: "today", label: "Aujourd’hui", visible: true },
  { id: "performance", label: "Dernières performances", visible: true },
  { id: "programs", label: "Mes programmes", visible: true },

  { id: "nutrition", label: "Nutrition", visible: false },
  { id: "messaging", label: "Messagerie", visible: false },
  { id: "oneRM", label: "Calculateur 1RM", visible: false },
  { id: "macros", label: "Calculateur macros", visible: false },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [checkin, setCheckin] = useState<any>(null);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [nextDetail, setNextDetail] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [movingWidgetId, setMovingWidgetId] =
    useState<DashboardWidgetId | null>(null);

  const [nutritionQuickSearch, setNutritionQuickSearch] = useState("");
  const [macroWeight, setMacroWeight] = useState("");
  const [macroGoal, setMacroGoal] =
    useState<"cut" | "maintain" | "gain">("maintain");
  const [dashboardWidgets, setDashboardWidgets] =
    useState<DashboardWidget[]>(DEFAULT_DASHBOARD_WIDGETS);

  useEffect(() => {
    AsyncStorage.getItem(DASHBOARD_STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const defaultById = new Map(
            DEFAULT_DASHBOARD_WIDGETS.map((item) => [item.id, item])
          );

          const restored: DashboardWidget[] = parsed
            .filter(
              (item: DashboardWidget) =>
                item &&
                typeof item.id === "string" &&
                defaultById.has(item.id)
            )
            .map((item: DashboardWidget) => ({
              ...defaultById.get(item.id)!,
              ...item,
            }));

          const restoredIds = new Set(restored.map((item) => item.id));

          const newWidgets = DEFAULT_DASHBOARD_WIDGETS.filter(
            (item) => !restoredIds.has(item.id)
          );

          setDashboardWidgets([...restored, ...newWidgets]);
        }
      })
      .catch((e) => {
        console.error("DASHBOARD LOAD ERROR", e);
      });
  }, []);

  const saveDashboardWidgets = useCallback(
    async (widgets: DashboardWidget[]) => {
      setDashboardWidgets(widgets);

      try {
        await AsyncStorage.setItem(
          DASHBOARD_STORAGE_KEY,
          JSON.stringify(widgets)
        );
      } catch (e) {
        console.error("DASHBOARD SAVE ERROR", e);
      }
    },
    []
  );

  const toggleDashboardWidget = useCallback(
    (id: DashboardWidgetId) => {
      const updated = dashboardWidgets.map((widget) =>
        widget.id === id
          ? { ...widget, visible: !widget.visible }
          : widget
      );

      saveDashboardWidgets(updated);
    },
    [dashboardWidgets, saveDashboardWidgets]
  );

  const moveDashboardWidget = useCallback(
    (id: DashboardWidgetId, direction: -1 | 1) => {
      const index = dashboardWidgets.findIndex(
        (widget) => widget.id === id
      );

      const target = index + direction;

      if (
        index < 0 ||
        target < 0 ||
        target >= dashboardWidgets.length
      ) {
        return;
      }

      const updated = [...dashboardWidgets];
      const [moved] = updated.splice(index, 1);
      updated.splice(target, 0, moved);

      saveDashboardWidgets(updated);
    },
    [dashboardWidgets, saveDashboardWidgets]
  );

  const moveWidgetTo = useCallback(
    (id: DashboardWidgetId, direction: -1 | 1) => {
      const visibleWidgets =
        dashboardWidgets.filter((widget) => widget.visible);

      const currentVisibleIndex =
        visibleWidgets.findIndex((widget) => widget.id === id);

      const targetVisibleIndex =
        currentVisibleIndex + direction;

      if (
        currentVisibleIndex === -1 ||
        targetVisibleIndex < 0 ||
        targetVisibleIndex >= visibleWidgets.length
      ) {
        return;
      }

      const targetId =
        visibleWidgets[targetVisibleIndex].id;

      const currentIndex =
        dashboardWidgets.findIndex((widget) => widget.id === id);

      const targetIndex =
        dashboardWidgets.findIndex(
          (widget) => widget.id === targetId
        );

      if (currentIndex === -1 || targetIndex === -1) {
        return;
      }

      const updated = [...dashboardWidgets];

      const temp = updated[currentIndex];
      updated[currentIndex] = updated[targetIndex];
      updated[targetIndex] = temp;

      saveDashboardWidgets(updated);
    },
    [dashboardWidgets, saveDashboardWidgets]
  );

  const resetDashboardWidgets = useCallback(() => {
    saveDashboardWidgets(DEFAULT_DASHBOARD_WIDGETS);
  }, [saveDashboardWidgets]);

  const [myPrograms, setMyPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramIdState] =
    useState<string | null>(null);
  const [switchingProgram, setSwitchingProgram] = useState(false);
  const [selectedProgramTemplates, setSelectedProgramTemplates] = useState<any[]>([]);
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<any>(null);


  const orderedVisibleDashboardWidgets = dashboardWidgets.filter(
    (widget) => widget.visible
  );

  const saveDraggedWidgetOrder = (visibleWidgets: DashboardWidget[]) => {
    let visibleIndex = 0;

    const merged = dashboardWidgets.map((widget) => {
      if (!widget.visible) return widget;

      const reordered = visibleWidgets[visibleIndex];
      visibleIndex += 1;

      return reordered ?? widget;
    });

    saveDashboardWidgets(merged);
  };

  const dashboardWidgetOrder = (id: DashboardWidgetId) => {
    const index = orderedVisibleDashboardWidgets.findIndex((widget) => widget.id === id);
    return index === -1 ? 999 : index;
  };

  const dashboardWidgetVisible = (id: DashboardWidgetId) =>
    dashboardWidgets.some(
      (widget) => widget.id === id && widget.visible
    );

  const macroWeightNumber =
    Number(String(macroWeight).replace(",", "."));

  const macroCalories =
    macroWeightNumber > 0
      ? Math.round(
          macroWeightNumber *
            (macroGoal === "cut"
              ? 28
              : macroGoal === "gain"
                ? 36
                : 32)
        )
      : 0;

  const macroProtein =
    macroWeightNumber > 0
      ? Math.round(macroWeightNumber * 2)
      : 0;

  const macroFat =
    macroWeightNumber > 0
      ? Math.round(macroWeightNumber * 0.8)
      : 0;

  const macroCarbs =
    macroWeightNumber > 0
      ? Math.max(
          0,
          Math.round(
            (
              macroCalories -
              macroProtein * 4 -
              macroFat * 9
            ) / 4
          )
        )
      : 0;

  const load = useCallback(async () => {
    try {
      setError(null);

      const results = await Promise.allSettled([
        getMyProfile(),
        getMyUpcomingSessions(),
        getTodayCheckin(),
        getRecentCheckins(365),
        getLatestPerformance(),
        getMyProgramsWithSelection(),
      ]);

      const [
        profileResult,
        sessionsResult,
        checkinResult,
        recentCheckinsResult,
        performanceResult,
        programsResult,
      ] = results;

      const p =
        profileResult.status === "fulfilled"
          ? profileResult.value
          : null;

      const sessionsData =
        sessionsResult.status === "fulfilled"
          ? sessionsResult.value
          : [];

      const c =
        checkinResult.status === "fulfilled"
          ? checkinResult.value
          : null;

      const rc =
        recentCheckinsResult.status === "fulfilled"
          ? recentCheckinsResult.value
          : [];

      const perf =
        performanceResult.status === "fulfilled"
          ? performanceResult.value
          : null;

      const programData =
        programsResult.status === "fulfilled"
          ? programsResult.value
          : null;

      setProfile(p);
      setSessions(sessionsData);
      setCheckin(c);
      setRecentCheckins(rc);
      setPerformance(perf);

      const failedLoads = results.filter(
        (result) => result.status === "rejected"
      );

      if (failedLoads.length) {
        failedLoads.forEach((result) => {
          if (result.status === "rejected") {
            console.error("HOME PARTIAL LOAD ERROR", result.reason);
          }
        });

        setError(
          "Certaines données n’ont pas pu être chargées."
        );
      }

      const ownedPrograms = programData?.programs ?? [];

      console.log("=== HOME PROGRAM DEBUG ===");
      console.log("programData:", JSON.stringify(programData));
      console.log("ownedPrograms:", JSON.stringify(ownedPrograms));
      console.log("ownedPrograms count:", ownedPrograms.length);

      setMyPrograms(ownedPrograms);

      const savedProgramId =
        programData?.selectedProgramId &&
        ownedPrograms.some(
          (program: any) =>
            String(program.id) ===
            String(programData.selectedProgramId)
        )
          ? String(programData.selectedProgramId)
          : ownedPrograms[0]?.id
            ? String(ownedPrograms[0].id)
            : null;

      setSelectedProgramIdState(savedProgramId);

      const filteredSessions = savedProgramId
        ? sessionsData.filter(
            (session: any) =>
              String(session?.workout_templates?.program_id ?? "") ===
              String(savedProgramId)
          )
        : sessionsData;

      const active =
        filteredSessions.find(
          (session: any) =>
            session.status !== "completed" &&
            session.status !== "skipped"
        ) ??
        filteredSessions[0] ??
        null;

      // Ne pas bloquer le chargement initial du dashboard
      // sur les détails complets de la séance.
      // Le détail est chargé séparément par l'effet dédié.
      setNextDetail(null);

    } catch (e: any) {
      console.error("HOME LOAD ERROR", e);

      setError(
        e?.message ??
          "Impossible de charger les données"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();

      return () => {};
    }, [load])
  );

  const score = recoveryScore(checkin);

  // Un template est considéré terminé dès qu'au moins une de ses sessions
  // a été validée ou passée. Cela neutralise les anciennes sessions doublons.
  const finishedTemplateIds = new Set(
    sessions
      .filter(
        (session: any) =>
          session.status === "completed" ||
          session.status === "skipped"
      )
      .map((session: any) =>
        String(session.workout_template_id ?? "")
      )
      .filter(Boolean)
  );

  const availableSessions = sessions.filter(
    (session: any) =>
      session.status !== "completed" &&
      session.status !== "skipped" &&
      !finishedTemplateIds.has(
        String(session.workout_template_id ?? "")
      )
  );

  const selectedProgram = myPrograms.find(
    (program: any) => program.id === selectedProgramId
  ) ?? myPrograms[0] ?? null;


  useEffect(() => {
    let cancelled = false;

    async function loadSelectedProgramTemplates() {
      if (!selectedProgram?.id) {
        setSelectedProgramTemplates([]);
        return;
      }

      try {
        const detail = await getProgramDetail(String(selectedProgram.id));

        if (!cancelled) {
          setSelectedProgramTemplates(detail?.workouts ?? []);
        }
      } catch (e) {
        console.error("PROGRAM TEMPLATES LOAD ERROR", e);

        if (!cancelled) {
          setSelectedProgramTemplates([]);
        }
      }
    }

    loadSelectedProgramTemplates();

    return () => {
      cancelled = true;
    };
  }, [selectedProgram?.id]);

  const selectedProgramSessions = selectedProgram
    ? availableSessions
        .filter(
          (session: any) =>
            String(session?.workout_templates?.program_id ?? "") ===
            String(selectedProgram.id)
        )
        // Sécurité supplémentaire contre les doublons planned/in_progress :
        // une seule session par template.
        .filter(
          (session: any, index: number, all: any[]) =>
            index ===
            all.findIndex(
              (candidate: any) =>
                String(candidate.workout_template_id) ===
                String(session.workout_template_id)
            )
        )
        .sort((a: any, b: any) => {
          const aWeek = Number(a?.workout_templates?.week_number ?? 999);
          const bWeek = Number(b?.workout_templates?.week_number ?? 999);

          if (aWeek !== bWeek) return aWeek - bWeek;

          const aDay = Number(a?.workout_templates?.day_number ?? 999);
          const bDay = Number(b?.workout_templates?.day_number ?? 999);

          if (aDay !== bDay) return aDay - bDay;

          return String(a?.scheduled_for ?? "").localeCompare(
            String(b?.scheduled_for ?? "")
          );
        })
    : availableSessions;

  // Templates du programme dans l'ordre Semaine -> Jour.
  const orderedProgramTemplates = [...selectedProgramTemplates].sort(
    (a: any, b: any) => {
      const aWeek = Number(a?.week_number ?? 999);
      const bWeek = Number(b?.week_number ?? 999);

      if (aWeek !== bWeek) return aWeek - bWeek;

      return (
        Number(a?.day_number ?? 999) -
        Number(b?.day_number ?? 999)
      );
    }
  );

  // Premier template pas encore validé.
  const firstUnfinishedTemplate =
    orderedProgramTemplates.find(
      (item: any) =>
        !finishedTemplateIds.has(String(item.id))
    ) ?? null;

  const next = selectedProgramSessions[0] ?? null;
  const afterNext = selectedProgramSessions[1] ?? null;

  const template: any =
    next?.workout_templates ??
    firstUnfinishedTemplate ??
    null;


  useEffect(() => {
    let cancelled = false;

    async function loadSelectedTemplateDetail() {
      if (!template?.id || next?.id) {
        setSelectedTemplateDetail(null);
        return;
      }

      try {
        const detail = await getWorkoutTemplateDetail(String(template.id));

        if (!cancelled) {
          setSelectedTemplateDetail(detail);
        }
      } catch (e) {
        console.error("TEMPLATE DETAIL LOAD ERROR", e);

        if (!cancelled) {
          setSelectedTemplateDetail(null);
        }
      }
    }

    loadSelectedTemplateDetail();

    return () => {
      cancelled = true;
    };
  }, [template?.id, next?.id]);
  useEffect(() => {
    let cancelled = false;

    async function loadNextDetail() {
      if (!next?.id || !next?.workout_template_id) {
        setNextDetail(null);
        return;
      }

      try {
        const detail = await getWorkoutTemplateDetail(
          String(next.workout_template_id)
        );

        if (!cancelled) {
          setNextDetail(detail);
        }
      } catch (e) {
        console.error("NEXT WORKOUT DETAIL LOAD ERROR", e);

        if (!cancelled) {
          setNextDetail(null);
        }
      }
    }

    loadNextDetail();

    return () => {
      cancelled = true;
    };
  }, [next?.id, next?.workout_template_id]);

  const previewExercises = next?.id
    ? (nextDetail?.workoutExercises ?? [])
    : (selectedTemplateDetail?.workoutExercises ?? []);
  const checkinDates = useMemo(
    () => new Set(recentCheckins.map((x: any) => x.checkin_date)),
    [recentCheckins]
  );

  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date();

    while (checkinDates.has(localDateString(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  }, [checkinDates]);

  
  async function switchProgram(programId: string) {
    if (!programId || programId === selectedProgramId) return;

    try {
      setNextDetail(null);
      setSelectedTemplateDetail(null);
      setSwitchingProgram(true);

      await setSelectedProgramId(programId);

      setSelectedProgramIdState(programId);

    } catch (e: any) {
      console.error("PROGRAM SWITCH ERROR", e);
      setError(
        e?.message ??
          "Impossible de changer de programme."
      );
    } finally {
      setSwitchingProgram(false);
    }
  }

if (loading) return <View style={styles.center}><ActivityIndicator color={colors.yellow}/></View>;

  const homeBlockName = (we: any) => {
    const notes = String(
      we?.exercises?.prescription_notes ??
      we?.prescription_notes ??
      ""
    ).trim().toUpperCase();

    if (notes.startsWith("WARM UP")) return "WARM UP";
    if (notes.startsWith("STRENGTH WORK")) return "STRENGTH WORK";
    if (notes.startsWith("RENFO")) return "RENFO";
    if (notes.startsWith("WOD")) return "WOD";

    return "AUTRE";
  };

  const homeBlockRounds = (block: string) => {
    const first = previewExercises.find(
      (we: any) => homeBlockName(we) === block
    );

    if (!first) return "";

    const notes = String(
      first?.exercises?.prescription_notes ??
      first?.prescription_notes ??
      ""
    );

    const match = notes.match(/(\d+)\s*rounds?/i);

    return match ? `${match[1]} rounds` : "";
  };

  const cleanHomePrescription = (value: any) => {
    return String(value ?? "")
      .replace(/\(?\s*tempo\s*[0-9A-Za-z]+\s*\)?/gi, "")
      .replace(
        /\s*[—–-]\s*\d+(?:[.,]\d+)?\s*(?:min(?:ute)?s?|sec(?:onde)?s?|s|'|’)\s*$/gi,
        ""
      )
      .replace(
        /\b(?:repos|récupération|recuperation|rest)\s*:?\s*\d+(?:[.,]\d+)?\s*(?:min(?:ute)?s?|sec(?:onde)?s?|s|'|’)/gi,
        ""
      )
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const homeExerciseText = (we: any) => {
    const ex = we?.exercises ?? {};
    const name =
      ex?.name ??
      we?.exercise_name ??
      we?.name ??
      "Exercice";

    const notes = String(
      ex?.prescription_notes ??
      we?.prescription_notes ??
      ""
    );

    const block = homeBlockName(we);

    // --------------------------------------------------------
    // WARM UP / WOD :
    // prescription_notes contient déjà les infos utiles.
    // On retire seulement le nom du bloc + le nombre de rounds.
    // --------------------------------------------------------

    if (block === "WARM UP" || block === "WOD") {
      let detail = notes
        .replace(
          /^(WARM UP|WOD)\s*[—–-]?\s*/i,
          ""
        )
        .replace(
          /^\d+\s*rounds?\s*[—–-]?\s*/i,
          ""
        );

      detail = cleanHomePrescription(detail);

      if (!detail) return name;

      if (
        detail
          .toLowerCase()
          .includes(String(name).toLowerCase())
      ) {
        return detail;
      }

      return `${detail} ${name}`.trim();
    }

    // --------------------------------------------------------
    // STRENGTH / RENFO :
    // séries, reps, charge ou % depuis prescribed_sets
    // --------------------------------------------------------

    const sets = we?.prescribed_sets ?? [];
    const first = sets[0];

    if (first) {
      const setCount = sets.length || "";

      const reps =
        first?.target_reps ??
        first?.reps ??
        "";

      const loadKg =
        first?.target_load_kg;

      const loadPct =
        first?.target_load_percent ??
        first?.target_percentage ??
        first?.percentage;

      let line = "";

      if (setCount && reps) {
        line += `${setCount}×${reps} `;
      } else if (reps) {
        line += `${reps} `;
      }

      line += name;

      if (loadPct != null && loadPct !== "") {
        line += ` @${loadPct}%`;
      } else if (loadKg != null && loadKg !== "") {
        line += ` @${loadKg} kg`;
      }

      return cleanHomePrescription(line);
    }

    let detail = notes
      .replace(
        /^(STRENGTH WORK|RENFO)\s*[—–-]?\s*/i,
        ""
      );

    detail = cleanHomePrescription(detail);

    return detail || name;
  };

  const homeSessionGroups = [
    "WARM UP",
    "STRENGTH WORK",
    "RENFO",
    "WOD",
    "AUTRE",
  ]
    .map((block) => ({
      block,
      exercises: previewExercises.filter(
        (we: any) => homeBlockName(we) === block
      ),
    }))
    .filter((group) => group.exercises.length > 0);

  return (
    <View style={styles.root}>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} role={profile?.role} />
      <NestableScrollContainer
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.yellow} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}/>}>

        <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.squareButton}>
            <SymbolView name={{ ios: "ellipsis", android: "more_vert" }} size={18} tintColor={colors.text} />
          </Pressable>
          <View style={styles.logoWrap}><BrandLogo compact /></View>
          <Pressable style={styles.squareButton}>
            <SymbolView name={{ ios: "bell", android: "notifications_none" }} size={18} tintColor={colors.text} />
          </Pressable>
        </View>

        {dashboardEditMode ? (
          <View style={styles.dashboardEditTopbar}>
            <Pressable
              onPress={() => setWidgetPickerOpen(true)}
              style={styles.dashboardAddButton}
            >
              <Text style={styles.dashboardAddText}>＋</Text>
            </Pressable>

            <Text style={styles.dashboardEditHint}>
              Maintiens la poignée pour déplacer
            </Text>

            <Pressable
              onPress={() => setDashboardEditMode(false)}
              style={styles.dashboardDoneButton}
            >
              <Text style={styles.dashboardDoneText}>TERMINER</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.greetingRecovery}>
          <View style={styles.greetingBlock}>
            <Text style={styles.hello}>Bonjour</Text>
            <Text style={styles.name}>{profile?.first_name || "Athlète"} <Text style={styles.fist}>👊</Text></Text>
          </View>
          <Pressable
            onLongPress={() => setDashboardEditMode(true)}
            delayLongPress={450}
            style={styles.recoveryCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryLabel}>RÉCUPÉRATION</Text>
              <Text style={[styles.recoveryValue, { color: score != null && score >= 65 ? colors.green : colors.yellow }]}>{score == null ? "--" : `${score}%`}</Text>
              <Text style={styles.recoveryText}>{recoveryLabel(score)}</Text>
            </View>
            <View style={[styles.ring, { borderColor: score != null && score >= 65 ? colors.green : colors.yellow }]}>
              <Text style={[styles.ringBolt, { color: score != null && score >= 65 ? colors.green : colors.yellow }]}>⚡</Text>
            </View>

            {dashboardEditMode ? (
              <View style={styles.dashboardHandle}>
                <Text style={styles.dashboardHandleText}>≡</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

        <NestableDraggableFlatList
          data={orderedVisibleDashboardWidgets}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          onDragEnd={({ data }) => saveDraggedWidgetOrder(data)}
          renderItem={({ item: widget, drag, isActive }: RenderItemParams<DashboardWidget>) => (
          <View
            key={widget.id}
            style={{ opacity: isActive ? 0.92 : 1 }}
          >
            {widget.id === "workout" ? (
              <>
        <SectionTitle title="SÉANCE DU JOUR" />
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.workoutCard}
        >
          {dashboardEditMode ? (
            <Pressable
              onLongPress={drag}
              style={styles.dashboardHandleWorkout}
            >
              <Text style={styles.dashboardHandleText}>≡</Text>
            </Pressable>
          ) : null}
          <Image source={require("@/assets/workout-male-faded.png")} style={styles.workoutImage} resizeMode="cover" />
          <View style={styles.imageShade} />
          <View style={styles.workoutContent}>
            <View style={styles.workoutHead}>
              <HexIcon glyph="▮▮" />
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutTitle}>{template?.name || "Aucune séance"}</Text>
                <Text style={styles.workoutMeta}>◷ {displayDuration(template?.estimated_minutes)}    ▥ Focus Force</Text>
              </View>
            </View>

            <ScrollView
          style={styles.homeWorkoutScroll}
          contentContainerStyle={styles.homeWorkoutScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
        >
{(next || template) ? (
          previewExercises.length ? (
            <View style={styles.homeSessionGroups}>
              {homeSessionGroups.map((group) => (
                <View
                  key={group.block}
                  style={styles.homeSessionGroup}
                >
                  <Text style={styles.homeSessionTitle}>
                    {group.block === "RENFO"
                      ? "RENFORCEMENT"
                      : group.block}
                  </Text>

                  {homeBlockRounds(group.block) ? (
                    <Text style={styles.homeSessionRounds}>
                      {homeBlockRounds(group.block)}
                    </Text>
                  ) : null}

                  {group.exercises.map(
                    (we: any, index: number) => (
                      <View
                        key={we.id ?? `${group.block}-${index}`}
                        style={styles.homeSessionLine}
                      >
                        <Text style={styles.homeSessionBullet}>•</Text>

                        <Text style={styles.homeSessionText}>
                          {homeExerciseText(we)}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyWorkout}>
              Le détail de la séance apparaîtra ici.
            </Text>
          )
        ) : (
          <Text style={styles.emptyWorkout}>
            Aucune séance programmée pour aujourd'hui.
          </Text>
        )}

                </ScrollView>

        <Pressable
          disabled={!next && !template?.id}
          onPress={() => {
            if (next?.id) {
              router.push({
                pathname: "/workout",
                params: { sessionId: next.id },
              });
              return;
            }

            if (template?.id) {
              getOrCreateWorkoutSession(String(template.id))
                .then((session) => {
                  router.push({
                    pathname: "/workout",
                    params: { sessionId: session.id },
                  });
                })
                .catch((e) => {
                  console.error("CREATE WORKOUT SESSION ERROR", e);
                  setError(
                    e?.message ??
                      "Impossible de démarrer cette séance."
                  );
                });
            }
          }}
          style={[
            styles.startButton,
            !next && !template?.id && { opacity: .45 }
          ]}
        >
              <Text style={styles.play}>▶</Text><Text style={styles.startText}>{next?.status === "in_progress" ? "REPRENDRE LA SÉANCE" : "COMMENCER LA SÉANCE"}</Text>
            </Pressable>
          </View>
        </Pressable>

              </>
            ) : null}

            {widget.id === "nextWorkout" ? (
              <>
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.nextCard}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("nextWorkout")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}
          <HexIcon glyph="▣" small />
          <View style={{ flex: 1 }}>
            <Text style={styles.smallCap}>PROCHAINE SÉANCE</Text>
            <Text style={styles.nextTitle}>{afterNext?.workout_templates?.name || "À programmer"}</Text>
            <Text style={styles.muted}>{afterNext?.scheduled_for ? `${afterNext.scheduled_for} • ${displayDuration(afterNext.workout_templates?.estimated_minutes)}` : "Aucune autre séance planifiée"}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

              </>
            ) : null}

            {widget.id === "routine" ? (
              <>
        <SectionTitle title="SUIVI DE ROUTINE" action="Voir le suivi  →" onAction={() => router.push("/(tabs)/journal")} />
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.routineCard}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("routine")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}
          <View style={styles.streakBlock}><Text style={styles.fire}>🔥</Text><Text style={styles.streakNumber}>{streak}</Text><Text style={styles.streakDays}>JOURS</Text><Text style={styles.smallCap}>SÉRIE ACTUELLE</Text></View>
          <View style={styles.routineDivider} />
          <View style={styles.weekBlock}>
            <View style={styles.daysRow}>{DAYS.map((d, i) => {
              const date = new Date(); date.setDate(date.getDate() - (6-i));
              const key = localDateString(date); const done = checkinDates.has(key);
              const isToday = i === 6;
              return <View key={i} style={styles.dayCol}><Text style={[styles.dayLabel,isToday&&{color:colors.yellow}]}>{d}</Text><View style={[styles.dayDot, done&&styles.dayDone, isToday&&!done&&styles.dayToday]}><Text style={styles.dayCheck}>{done ? "✓" : ""}</Text></View></View>;
            })}</View>
            <Text style={styles.routineMessage}>{streak ? "Continue comme ça !" : "Commence ton suivi aujourd’hui."}</Text>
          </View>
        </Pressable>

              </>
            ) : null}

            {widget.id === "today" ? (
              <>
        <View style={styles.dashboardSectionWrap}>
          <SectionTitle title="AUJOURD’HUI" action="Voir le suivi  →" onAction={() => router.push("/(tabs)/journal")} />

          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("today")}
                style={styles.dashboardRemoveSection}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSection}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricScroller}>
          <MetricCard onLongPress={() => setDashboardEditMode(true)} icon="🌙" label="SOMMEIL" value={checkin?.sleep_minutes ? `${Math.floor(checkin.sleep_minutes/60)}h${String(checkin.sleep_minutes%60).padStart(2,'0')}` : "--"} state={checkin?.sleep_minutes ? "Renseigné" : "À saisir"} color={colors.purple}/>
          <MetricCard onLongPress={() => setDashboardEditMode(true)} icon="⚡" label="FATIGUE" value={checkin?.fatigue ? `${checkin.fatigue}/10` : "--"} state={checkin?.fatigue ? (checkin.fatigue <= 3 ? "Faible" : checkin.fatigue <= 6 ? "Modérée" : "Élevée") : "À saisir"} color={colors.yellow}/>
          <MetricCard onLongPress={() => setDashboardEditMode(true)} icon="❤️" label="COURBATURES" value={checkin?.soreness ? `${checkin.soreness}/10` : "--"} state={checkin?.soreness ? (checkin.soreness <= 3 ? "Faibles" : "Présentes") : "À saisir"} color={colors.green}/>
          <MetricCard onLongPress={() => setDashboardEditMode(true)} icon="🙂" label="MOTIVATION" value={checkin?.motivation ? `${checkin.motivation}/10` : "--"} state={checkin?.motivation ? (checkin.motivation >= 7 ? "Élevée" : "Normale") : "À saisir"} color={colors.blue}/>
          <MetricCard onLongPress={() => setDashboardEditMode(true)} icon="🟢" label="DOULEUR" value={checkin?.pain != null ? `${checkin.pain}/10` : "--"} state={checkin?.pain === 0 ? "Aucune" : checkin?.pain ? "Présente" : "À saisir"} color={colors.green}/>
        </ScrollView>
        </View>

              </>
            ) : null}

            {widget.id === "performance" ? (
              <>
        <SectionTitle title="DERNIÈRES PERFORMANCES" action="Voir tout  →" onAction={() => router.push("/(tabs)/stats")} />
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.performanceCard}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("performance")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}
          <HexIcon glyph="▮▮" small />
          <View style={{ flex: 1 }}><Text style={styles.performanceName}>{performance?.exerciseName || "Aucune performance"}</Text><Text style={styles.muted}>{performance?.isPR ? "Nouveau PR" : "Dernière performance"}</Text></View>
          <View><Text style={styles.smallCap}>1RM estimé</Text><Text style={styles.oneRm}>{performance?.estimated1rm ? `${performance.estimated1rm} kg` : "--"}</Text></View>
          <View style={{ alignItems: "flex-end", minWidth: 55 }}><Text style={styles.prUp}>{performance?.deltaKg ? `↑ ${performance.deltaKg} kg` : ""}</Text></View>
        </Pressable>
      
      {/* ===== WIDGETS OPTIONNELS ===== */}

                    </>
            ) : null}

            {widget.id === "nutrition" ? (
              <>
      {dashboardWidgetVisible("nutrition") ? (
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.miniWidget}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("nutrition")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}

          <Text style={styles.miniWidgetIcon}>⌕</Text>

          <TextInput
            editable={!dashboardEditMode}
            value={nutritionQuickSearch}
            onChangeText={setNutritionQuickSearch}
            placeholder="Rechercher un aliment"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (!dashboardEditMode) {
                router.push("/nutrition" as any);
              }
            }}
            style={styles.miniWidgetInput}
          />

          <Pressable
            disabled={dashboardEditMode}
            onPress={() => router.push("/nutrition" as any)}
            style={styles.miniWidgetGo}
          >
            <Text style={styles.miniWidgetGoText}>›</Text>
          </Pressable>
        </Pressable>
      ) : null}


                    </>
            ) : null}

            {widget.id === "messaging" ? (
              <>
      {dashboardWidgetVisible("messaging") ? (
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          disabled={dashboardEditMode}
          onPress={() => router.push("/messaging" as any)}
          style={styles.miniActionWidget}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("messaging")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}

          <Text style={styles.miniActionIcon}>✉</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.miniActionTitle}>MESSAGERIE</Text>
            <Text style={styles.miniActionSub}>
              Coach ↔ Athlète
            </Text>
          </View>

          <Text style={styles.miniActionArrow}>›</Text>
        </Pressable>
      ) : null}


                    </>
            ) : null}

            {widget.id === "oneRM" ? (
              <>
      {dashboardWidgetVisible("oneRM") ? (
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          disabled={dashboardEditMode}
          onPress={() => router.push("/rm-calculator" as any)}
          style={styles.miniActionWidget}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("oneRM")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}

          <Text style={styles.miniActionIcon}>⚡</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.miniActionTitle}>
              CALCULATEUR 1RM
            </Text>

            <Text style={styles.miniActionSub}>
              Estimer ton maximum
            </Text>
          </View>

          <Text style={styles.miniActionArrow}>›</Text>
        </Pressable>
      ) : null}


                    </>
            ) : null}

            {widget.id === "macros" ? (
              <>
      {dashboardWidgetVisible("macros") ? (
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.miniMacroWidget}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("macros")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}

          <View style={styles.miniMacroTop}>
            <Text style={styles.miniMacroTitle}>
              MACROS
            </Text>

            <TextInput
              editable={!dashboardEditMode}
              value={macroWeight}
              onChangeText={setMacroWeight}
              keyboardType="decimal-pad"
              placeholder="Poids"
              placeholderTextColor={colors.muted}
              style={styles.miniMacroWeight}
            />

            <Text style={styles.miniMacroKg}>kg</Text>
          </View>

          <View style={styles.miniMacroGoals}>
            {[
              ["cut", "SÈCHE"],
              ["maintain", "MAINTIEN"],
              ["gain", "PRISE"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                disabled={dashboardEditMode}
                onPress={() =>
                  setMacroGoal(
                    value as "cut" | "maintain" | "gain"
                  )
                }
                style={[
                  styles.miniMacroGoal,
                  macroGoal === value &&
                    styles.miniMacroGoalActive,
                ]}
              >
                <Text
                  style={[
                    styles.miniMacroGoalText,
                    macroGoal === value &&
                      styles.miniMacroGoalTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {macroWeightNumber > 0 ? (
            <View style={styles.miniMacroResults}>

              <View style={styles.miniMacroResultMain}>
                <Text style={styles.miniMacroCalories}>
                  {macroCalories}
                </Text>
                <Text style={styles.miniMacroUnit}>
                  KCAL
                </Text>
              </View>

              <View style={styles.miniMacroDivider} />

              <View style={styles.miniMacroResult}>
                <Text style={styles.miniMacroValue}>
                  {macroProtein}g
                </Text>
                <Text style={styles.miniMacroLabel}>P</Text>
              </View>

              <View style={styles.miniMacroResult}>
                <Text style={styles.miniMacroValue}>
                  {macroCarbs}g
                </Text>
                <Text style={styles.miniMacroLabel}>G</Text>
              </View>

              <View style={styles.miniMacroResult}>
                <Text style={styles.miniMacroValue}>
                  {macroFat}g
                </Text>
                <Text style={styles.miniMacroLabel}>L</Text>
              </View>

            </View>
          ) : (
            <Text style={styles.miniMacroHint}>
              Entre ton poids pour calculer
            </Text>
          )}

        </Pressable>
      ) : null}


              </>
            ) : null}

            {widget.id === "programs" ? (
              <>
      {/* ===== MES PROGRAMMES ===== */}

      {myPrograms.length > 0 ? (
        <Pressable
          onLongPress={() => setDashboardEditMode(true)}
          delayLongPress={450}
          style={styles.programSwitcher}
        >
          {dashboardEditMode ? (
            <>
              <Pressable
                onPress={() => toggleDashboardWidget("programs")}
                style={styles.dashboardRemoveSmall}
              >
                <Text style={styles.dashboardRemoveSmallText}>×</Text>
              </Pressable>

              <Pressable
                onLongPress={drag}
                style={styles.dashboardHandleSide}
              >
                <Text style={styles.dashboardHandleText}>≡</Text>
              </Pressable>
            </>
          ) : null}
          <Text style={styles.programSwitcherTitle}>
            MES PROGRAMMES
          </Text>

          <Text style={styles.programSwitcherSubtitle}>
            Choisis le programme à afficher sur ton accueil.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.programSwitcherRow}
          >
            {myPrograms.map((program: any) => {
              const active =
                program.id === selectedProgram?.id;

              return (
                <Pressable
                  key={program.id}
                  disabled={switchingProgram}
                  onPress={() => switchProgram(program.id)}
                  style={[
                    styles.programSwitchCard,
                    active && styles.programSwitchCardActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.programSwitchName,
                      active && styles.programSwitchNameActive,
                    ]}
                  >
                    {program.name}
                  </Text>

                  {active ? (
                    <Text style={styles.programActiveLabel}>
                      PROGRAMME ACTIF
                    </Text>
                  ) : (
                    <Text style={styles.programSelectLabel}>
                      SÉLECTIONNER
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedProgram ? (
            <Text style={styles.currentProgramText}>
              Programme affiché : {selectedProgram.name}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
              </>
            ) : null}
          </View>
          )}
        />

      </NestableScrollContainer>

      {dashboardEditMode && movingWidgetId ? (
        <View style={styles.widgetMovePanel}>

          <Pressable
            onPress={() => moveWidgetTo(movingWidgetId, -1)}
            style={styles.widgetMoveAction}
          >
            <Text style={styles.widgetMoveArrow}>↑</Text>
            <Text style={styles.widgetMoveLabel}>MONTER</Text>
          </Pressable>

          <View style={styles.widgetMoveSeparator} />

          <Pressable
            onPress={() => moveWidgetTo(movingWidgetId, 1)}
            style={styles.widgetMoveAction}
          >
            <Text style={styles.widgetMoveArrow}>↓</Text>
            <Text style={styles.widgetMoveLabel}>DESCENDRE</Text>
          </Pressable>

          <Pressable
            onPress={() => setMovingWidgetId(null)}
            style={styles.widgetMoveClose}
          >
            <Text style={styles.widgetMoveCloseText}>×</Text>
          </Pressable>

        </View>
      ) : null}

      <Modal
        visible={widgetPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWidgetPickerOpen(false)}
      >
        <View style={styles.widgetPickerBackdrop}>
          <View style={styles.widgetPickerSheet}>

            <View style={styles.widgetPickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.widgetPickerTitle}>
                  AJOUTER UN WIDGET
                </Text>

                <Text style={styles.widgetPickerSubtitle}>
                  Personnalise ton écran d’accueil.
                </Text>
              </View>

              <Pressable
                onPress={() => setWidgetPickerOpen(false)}
                style={styles.widgetPickerClose}
              >
                <Text style={styles.widgetPickerCloseText}>×</Text>
              </Pressable>
            </View>

            {dashboardWidgets.map((widget) => (
              <Pressable
                key={widget.id}
                onPress={() => toggleDashboardWidget(widget.id)}
                style={styles.widgetPickerItem}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.widgetPickerItemTitle}>
                    {widget.label}
                  </Text>

                  <Text style={styles.widgetPickerItemState}>
                    {widget.visible
                      ? "PRÉSENT SUR L’ACCUEIL"
                      : "AJOUTER À L’ACCUEIL"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.widgetPickerPlus,
                    widget.visible && styles.widgetPickerPlusActive,
                  ]}
                >
                  <Text style={styles.widgetPickerPlusText}>
                    {widget.visible ? "✓" : "+"}
                  </Text>
                </View>
              </Pressable>
            ))}

          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ title, action, onAction }: { title:string; action?:string; onAction?:()=>void }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionLeft}><View style={styles.yellowBar}/><Text style={styles.sectionTitle}>{title}</Text></View>{action?<Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable>:null}</View>;
}
function HexIcon({ glyph, small=false }:{glyph:string;small?:boolean}) { return <View style={[styles.hexIcon, small&&styles.hexSmall]}><Text style={styles.hexGlyph}>{glyph}</Text></View>; }
function ExerciseRow({ index, name, detail }:{index:number;name:string;detail:string}) { return <View style={styles.exerciseRow}><View style={styles.exerciseIndex}><Text style={styles.exerciseIndexText}>{index}</Text></View><View style={{flex:1}}><Text style={styles.exerciseName}>{name}</Text><Text style={styles.exerciseDetail}>{detail}</Text></View><View style={styles.arrowCircle}><Text style={styles.arrowText}>›</Text></View></View>; }
function MetricCard({
  icon,
  label,
  value,
  state,
  color,
  onLongPress,
}:{
  icon:string;
  label:string;
  value:string;
  state:string;
  color:string;
  onLongPress?:()=>void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={450}
      style={styles.metricCard}
    >
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={[styles.metricState,{color}]}>{state}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor: "transparent"}, page:{paddingHorizontal:15,paddingTop:18,paddingBottom:105,backgroundColor: "transparent"}, center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor: "transparent"},
  topbar: {
    minHeight: 155,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between"}, squareButton:{width:54,height:54,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:"#0A0A0B",alignItems:"center",justifyContent:"center",position:"relative"}, menuGlyph: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 29,
  }, bell:{color:colors.text,fontSize:26}, notification:{position:"absolute",right:-3,top:-4,width:22,height:22,borderRadius:11,backgroundColor:colors.yellow,alignItems:"center",justifyContent:"center"}, notificationText:{color:"#080808",fontSize:11,fontWeight:"900"}, logoWrap:{position:"absolute",left:"50%",transform:[{translateX:-76}],top:-10,width:152,height:120,alignItems:"center",overflow:"hidden"},
  dashboardEditTopbar:{
    flexDirection:"row",
    alignItems:"center",
    gap:10,
    marginBottom:14
  },

  dashboardAddButton:{
    width:46,
    height:46,
    borderRadius:15,
    borderWidth:1,
    borderColor:colors.yellow,
    backgroundColor:"#09090A",
    alignItems:"center",
    justifyContent:"center"
  },

  dashboardAddText:{
    color:colors.yellow,
    fontSize:28,
    lineHeight:30
  },

  dashboardEditHint:{
    flex:1,
    color:colors.muted,
    fontSize:10,
    textAlign:"center"
  },

  dashboardDoneButton:{
    height:46,
    paddingHorizontal:13,
    borderRadius:13,
    borderWidth:1,
    borderColor:colors.yellow,
    backgroundColor:"rgba(255,196,0,.08)",
    justifyContent:"center"
  },

  dashboardDoneText:{
    color:colors.yellow,
    fontSize:10,
    fontWeight:"900"
  },

  dashboardHandle:{
    position:"absolute",
    right:-7,
    top:"50%",
    marginTop:-23,
    width:30,
    height:46,
    borderRadius:10,
    backgroundColor:"#171719",
    borderWidth:1,
    borderColor:colors.yellow,
    alignItems:"center",
    justifyContent:"center"
  },

  dashboardHandleWorkout:{
    position:"absolute",
    right:8,
    top:8,
    zIndex:50,
    width:34,
    height:50,
    borderRadius:11,
    backgroundColor:"#171719",
    borderWidth:1,
    borderColor:colors.yellow,
    alignItems:"center",
    justifyContent:"center"
  },

  dashboardHandleText:{
    color:colors.yellow,
    fontSize:23,
    fontWeight:"900"
  },

  widgetPickerBackdrop:{
    flex:1,
    backgroundColor:"rgba(0,0,0,.72)",
    justifyContent:"flex-end"
  },

  widgetPickerSheet:{
    maxHeight:"78%",
    backgroundColor:"#0A0A0B",
    borderTopLeftRadius:25,
    borderTopRightRadius:25,
    borderWidth:1,
    borderColor:colors.border,
    padding:18,
    paddingBottom:35
  },

  widgetPickerHeader:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    marginBottom:18
  },

  widgetPickerTitle:{
    color:colors.text,
    fontSize:19,
    fontWeight:"900"
  },

  widgetPickerSubtitle:{
    color:colors.muted,
    fontSize:11,
    marginTop:4
  },

  widgetPickerClose:{
    width:42,
    height:42,
    borderRadius:13,
    borderWidth:1,
    borderColor:colors.border,
    alignItems:"center",
    justifyContent:"center"
  },

  widgetPickerCloseText:{
    color:colors.text,
    fontSize:25
  },

  widgetPickerItem:{
    minHeight:70,
    flexDirection:"row",
    alignItems:"center",
    borderTopWidth:1,
    borderTopColor:colors.borderSoft
  },

  widgetPickerItemTitle:{
    color:colors.text,
    fontSize:14,
    fontWeight:"800"
  },

  widgetPickerItemState:{
    color:colors.muted,
    fontSize:9,
    fontWeight:"800",
    marginTop:4
  },

  widgetPickerPlus:{
    width:40,
    height:40,
    borderRadius:12,
    borderWidth:1,
    borderColor:colors.border,
    alignItems:"center",
    justifyContent:"center"
  },

  widgetPickerPlusActive:{
    borderColor:colors.yellow,
    backgroundColor:"rgba(255,196,0,.08)"
  },

  widgetPickerPlusText:{
    color:colors.yellow,
    fontSize:20,
    fontWeight:"900"
  },

  widgetMovePanel:{
    position:"absolute",
    left:22,
    right:22,
    bottom:28,
    minHeight:62,
    borderRadius:18,
    borderWidth:1,
    borderColor:colors.yellow,
    backgroundColor:"#111113",
    flexDirection:"row",
    alignItems:"center",
    paddingHorizontal:8,
    zIndex:999
  },

  widgetMoveAction:{
    flex:1,
    height:52,
    alignItems:"center",
    justifyContent:"center"
  },

  widgetMoveArrow:{
    color:colors.yellow,
    fontSize:19,
    fontWeight:"900"
  },

  widgetMoveLabel:{
    color:colors.text,
    fontSize:8,
    fontWeight:"900",
    marginTop:2
  },

  widgetMoveSeparator:{
    width:1,
    height:32,
    backgroundColor:colors.border
  },

  widgetMoveClose:{
    width:42,
    height:42,
    alignItems:"center",
    justifyContent:"center"
  },

  widgetMoveCloseText:{
    color:colors.muted,
    fontSize:23,
    fontWeight:"800"
  },

  dashboardSectionWrap:{
    position:"relative"
  },

  dashboardHandleSide:{
    position:"absolute",
    right:-7,
    top:"50%",
    marginTop:-23,
    width:30,
    height:46,
    borderRadius:10,
    backgroundColor:"#171719",
    borderWidth:1,
    borderColor:colors.yellow,
    alignItems:"center",
    justifyContent:"center",
    zIndex:80
  },

  dashboardHandleSection:{
    position:"absolute",
    right:-7,
    top:46,
    width:30,
    height:46,
    borderRadius:10,
    backgroundColor:"#171719",
    borderWidth:1,
    borderColor:colors.yellow,
    alignItems:"center",
    justifyContent:"center",
    zIndex:80
  },

  dashboardRemoveSmall:{
    position:"absolute",
    left:-7,
    top:-7,
    width:30,
    height:30,
    borderRadius:15,
    backgroundColor:"#171719",
    borderWidth:1,
    borderColor:"#7A3434",
    alignItems:"center",
    justifyContent:"center",
    zIndex:90
  },

  dashboardRemoveSection:{
    position:"absolute",
    left:-7,
    top:35,
    width:30,
    height:30,
    borderRadius:15,
    backgroundColor:"#171719",
    borderWidth:1,
    borderColor:"#7A3434",
    alignItems:"center",
    justifyContent:"center",
    zIndex:90
  },

  dashboardRemoveSmallText:{
    color:"#FF6868",
    fontSize:21,
    lineHeight:22,
    fontWeight:"900"
  },

  greetingRecovery:{flexDirection:"row",gap:10,alignItems:"stretch",marginBottom:18}, greetingBlock:{flex:1,justifyContent:"center",paddingLeft:4}, hello:{color:colors.muted,fontSize:15,marginBottom:3}, name:{color:colors.text,fontSize:33,fontWeight:"900",letterSpacing:-1}, fist:{fontSize:22}, recoveryCard:{flex:1.12,minHeight:108,borderWidth:1,borderColor:colors.border,borderRadius:17,backgroundColor:"#0A0A0B",padding:13,flexDirection:"row",alignItems:"center",gap:8}, recoveryLabel:{color:colors.muted,fontSize:10}, recoveryValue:{fontSize:27,fontWeight:"900",marginTop:3}, recoveryText:{color:colors.muted,fontSize:10,marginTop:2}, ring:{width:64,height:64,borderRadius:32,borderWidth:7,alignItems:"center",justifyContent:"center",backgroundColor:"#0B1009"}, ringBolt:{fontSize:24},
  errorCard:{borderColor:"#632E2E",borderWidth:1,borderRadius:14,padding:12,marginBottom:12},error:{color:colors.red}, sectionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:11,marginBottom:10},sectionLeft:{flexDirection:"row",alignItems:"center"},yellowBar:{width:3,height:20,borderRadius:2,backgroundColor:colors.yellow,marginRight:10},sectionTitle:{color:colors.text,fontWeight:"800",fontSize:17},sectionAction:{color:colors.yellow,fontSize:13},
  workoutCard:{height:500,borderWidth:1,borderColor:colors.border,borderRadius:20,overflow:"hidden",backgroundColor:"#080809",position:"relative"},workoutImage:{position:"absolute",right:0,top:0,width:"49%",height:"83%"},imageShade:{position:"absolute",right:0,top:0,width:"58%",height:"84%",backgroundColor:"rgba(0,0,0,.28)"},workoutContent:{padding:15,paddingTop:17},workoutHead:{flexDirection:"row",alignItems:"center",gap:13,marginBottom:13,maxWidth:"73%"},hexIcon:{width:54,height:54,borderWidth:1,borderColor:colors.yellow,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(0,0,0,.55)"},hexSmall:{width:48,height:48,borderRadius:15},hexGlyph:{color:colors.yellow,fontWeight:"900",fontSize:18},workoutTitle:{color:colors.text,fontWeight:"900",fontSize:23},workoutMeta:{color:colors.muted,fontSize:11,marginTop:7},exerciseRow:{minHeight:76,maxWidth:"64%",flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:1,borderBottomColor:colors.borderSoft},exerciseIndex:{width:38,height:38,borderRadius:19,backgroundColor:"rgba(255,196,0,.08)",alignItems:"center",justifyContent:"center"},exerciseIndexText:{color:colors.yellow,fontWeight:"900",fontSize:21},exerciseName:{color:colors.text,fontWeight:"800",fontSize:14},exerciseDetail:{color:colors.muted,fontSize:12,marginTop:5},arrowCircle:{width:32,height:32,borderRadius:16,backgroundColor:"rgba(20,20,21,.85)",alignItems:"center",justifyContent:"center"},arrowText:{color:colors.text,fontSize:28,lineHeight:29},emptyWorkout:{color:colors.muted,maxWidth:"55%",paddingVertical:54},homeWorkoutScroll:{
  height:285,
  marginTop:4
},

homeWorkoutScrollContent:{
  paddingBottom:28
},

homeSessionGroups:{
  paddingTop:4,
  paddingBottom:10,
  paddingRight:"38%"
},

homeSessionGroup:{
  marginBottom:12
},

homeSessionRounds:{
  color:colors.muted,
  fontSize:12,
  fontWeight:"800",
  marginTop:-2,
  marginBottom:5
},

homeSessionTitle:{
  color:colors.yellow,
  fontSize:14,
  fontWeight:"900",
  letterSpacing:0.5,
  marginBottom:5
},

homeSessionLine:{
  flexDirection:"row",
  alignItems:"flex-start",
  marginBottom:3
},

homeSessionBullet:{
  color:colors.yellow,
  fontSize:14,
  fontWeight:"900",
  marginRight:6,
  lineHeight:19
},

homeSessionText:{
  flex:1,
  color:colors.text,
  fontSize:12,
  fontWeight:"700",
  lineHeight:17
},

startButton:{height:57,borderRadius:10,backgroundColor:colors.yellow,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:12,marginTop:15},play:{color:"#060606",fontSize:16},startText:{color:"#060606",fontWeight:"900",fontSize:13},
  nextCard:{minHeight:100,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:"#09090A",padding:14,flexDirection:"row",alignItems:"center",gap:12,marginTop:12},smallCap:{color:colors.muted,fontSize:10,letterSpacing:.4},nextTitle:{color:colors.text,fontSize:19,fontWeight:"800",marginTop:4},muted:{color:colors.muted,fontSize:12,marginTop:3},chevron:{color:colors.text,fontSize:38,paddingHorizontal:8},
  routineCard:{minHeight:126,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:"#09090A",padding:14,flexDirection:"row",alignItems:"center"},streakBlock:{width:98,alignItems:"center"},fire:{fontSize:29},streakNumber:{color:colors.text,fontSize:28,fontWeight:"900",position:"absolute",right:7,top:0},streakDays:{color:colors.muted,fontSize:11,position:"absolute",right:3,top:34},routineDivider:{width:1,height:88,backgroundColor:colors.border,marginHorizontal:12},weekBlock:{flex:1},daysRow:{flexDirection:"row",justifyContent:"space-between"},dayCol:{alignItems:"center",gap:7},dayLabel:{color:colors.muted,fontSize:10},dayDot:{width:30,height:30,borderRadius:15,borderWidth:2,borderColor:colors.border,alignItems:"center",justifyContent:"center"},dayDone:{backgroundColor:"#3C8B1B",borderColor:"#3C8B1B"},dayToday:{borderColor:colors.yellow},dayCheck:{color:colors.text,fontWeight:"900"},routineMessage:{color:colors.muted,fontSize:11,marginTop:9},
  metricScroller:{gap:8,paddingRight:4},metricCard:{width:104,minHeight:145,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:"#0A0A0B",padding:12,alignItems:"center"},metricIcon:{fontSize:26,marginBottom:8},metricLabel:{color:colors.muted,fontSize:9},metricValue:{color:colors.text,fontSize:24,fontWeight:"800",marginTop:8},metricState:{fontWeight:"800",fontSize:11,marginTop:6},
  performanceCard:{minHeight:90,borderWidth:1,borderColor:colors.border,borderRadius:17,backgroundColor:"#09090A",padding:13,flexDirection:"row",alignItems:"center",gap:11},performanceName:{color:colors.text,fontSize:16,fontWeight:"800"},oneRm:{color:colors.text,fontSize:19,fontWeight:"800",marginTop:4},prUp:{color:colors.green,fontSize:14,fontWeight:"800"},


  miniWidget:{
    position:"relative",
    minHeight:58,
    borderRadius:15,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:"#09090A",
    flexDirection:"row",
    alignItems:"center",
    paddingHorizontal:12,
    marginTop:10
  },

  miniWidgetIcon:{
    color:colors.yellow,
    fontSize:24,
    marginRight:8
  },

  miniWidgetInput:{
    flex:1,
    color:colors.text,
    fontSize:13,
    fontWeight:"700",
    minHeight:50
  },

  miniWidgetGo:{
    width:34,
    height:34,
    borderRadius:10,
    borderWidth:1,
    borderColor:colors.border,
    alignItems:"center",
    justifyContent:"center"
  },

  miniWidgetGoText:{
    color:colors.yellow,
    fontSize:26,
    lineHeight:27
  },

  miniActionWidget:{
    position:"relative",
    minHeight:66,
    borderRadius:15,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:"#09090A",
    flexDirection:"row",
    alignItems:"center",
    paddingHorizontal:14,
    marginTop:10
  },

  miniActionIcon:{
    fontSize:21,
    marginRight:12
  },

  miniActionTitle:{
    color:colors.text,
    fontSize:12,
    fontWeight:"900",
    letterSpacing:.7
  },

  miniActionSub:{
    color:colors.muted,
    fontSize:10,
    marginTop:3
  },

  miniActionArrow:{
    color:colors.yellow,
    fontSize:27
  },

  miniMacroWidget:{
    position:"relative",
    borderRadius:15,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:"#09090A",
    padding:13,
    marginTop:10
  },

  miniMacroTop:{
    flexDirection:"row",
    alignItems:"center"
  },

  miniMacroTitle:{
    flex:1,
    color:colors.yellow,
    fontSize:12,
    fontWeight:"900",
    letterSpacing:1
  },

  miniMacroWeight:{
    width:65,
    height:34,
    borderRadius:8,
    borderWidth:1,
    borderColor:colors.border,
    color:colors.text,
    textAlign:"center",
    fontWeight:"800",
    paddingVertical:0
  },

  miniMacroKg:{
    color:colors.muted,
    fontSize:10,
    marginLeft:5
  },

  miniMacroGoals:{
    flexDirection:"row",
    gap:5,
    marginTop:9
  },

  miniMacroGoal:{
    flex:1,
    height:27,
    borderRadius:7,
    borderWidth:1,
    borderColor:colors.border,
    alignItems:"center",
    justifyContent:"center"
  },

  miniMacroGoalActive:{
    borderColor:colors.yellow
  },

  miniMacroGoalText:{
    color:colors.muted,
    fontSize:7,
    fontWeight:"900"
  },

  miniMacroGoalTextActive:{
    color:colors.yellow
  },

  miniMacroResults:{
    flexDirection:"row",
    alignItems:"center",
    marginTop:11
  },

  miniMacroResultMain:{
    minWidth:75
  },

  miniMacroCalories:{
    color:colors.text,
    fontSize:20,
    fontWeight:"900"
  },

  miniMacroUnit:{
    color:colors.muted,
    fontSize:7,
    fontWeight:"800"
  },

  miniMacroDivider:{
    width:1,
    height:34,
    backgroundColor:colors.border,
    marginHorizontal:8
  },

  miniMacroResult:{
    flex:1,
    alignItems:"center"
  },

  miniMacroValue:{
    color:colors.text,
    fontSize:13,
    fontWeight:"900"
  },

  miniMacroLabel:{
    color:colors.yellow,
    fontSize:8,
    fontWeight:"900",
    marginTop:2
  },

  miniMacroHint:{
    color:colors.muted,
    fontSize:10,
    marginTop:10
  },

  quickDashboardWidget:{
    position:"relative",
    minHeight:104,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:18,
    backgroundColor:"#09090A",
    padding:16,
    flexDirection:"row",
    alignItems:"center",
    marginTop:12
  },

  quickWidgetCategory:{
    color:colors.yellow,
    fontSize:9,
    fontWeight:"900",
    letterSpacing:1.1
  },

  quickWidgetTitle:{
    color:colors.text,
    fontSize:18,
    fontWeight:"900",
    marginTop:5
  },

  quickWidgetSubtitle:{
    color:colors.muted,
    fontSize:11,
    marginTop:5
  },

  quickWidgetArrow:{
    color:colors.yellow,
    fontSize:36,
    lineHeight:38,
    marginLeft:12
  },

  macroDashboardWidget:{
    position:"relative",
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:18,
    backgroundColor:"#09090A",
    padding:16,
    marginTop:12
  },

  macroGoalRow:{
    flexDirection:"row",
    gap:6,
    marginTop:14
  },

  macroGoalButton:{
    flex:1,
    minHeight:36,
    borderRadius:9,
    borderWidth:1,
    borderColor:colors.border,
    alignItems:"center",
    justifyContent:"center"
  },

  macroGoalButtonActive:{
    borderColor:colors.yellow,
    backgroundColor:"rgba(255,196,0,.08)"
  },

  macroGoalText:{
    color:colors.muted,
    fontSize:8,
    fontWeight:"900"
  },

  macroGoalTextActive:{
    color:colors.yellow
  },

  macroInput:{
    minHeight:46,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:11,
    color:colors.text,
    backgroundColor:"#0D0D0E",
    paddingHorizontal:13,
    fontSize:16,
    marginTop:10
  },

  macroResults:{
    flexDirection:"row",
    gap:6,
    marginTop:12
  },

  macroResult:{
    flex:1,
    minHeight:58,
    borderWidth:1,
    borderColor:colors.borderSoft,
    borderRadius:10,
    alignItems:"center",
    justifyContent:"center"
  },

  macroResultValue:{
    color:colors.text,
    fontSize:15,
    fontWeight:"900"
  },

  macroResultLabel:{
    color:colors.muted,
    fontSize:8,
    fontWeight:"800",
    marginTop:3
  },

  programSwitcher: {
    marginTop: 28,
    marginBottom: 24,
  },

  programSwitcherTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  programSwitcherSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 14,
  },

  programSwitcherRow: {
    gap: 10,
    paddingRight: 20,
  },

  programSwitchCard: {
    minWidth: 180,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "space-between",
  },

  programSwitchCardActive: {
    borderColor: colors.yellow,
    borderWidth: 2,
  },

  programSwitchName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },

  programSwitchNameActive: {
    color: colors.yellow,
  },

  programActiveLabel: {
    marginTop: 12,
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  programSelectLabel: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  currentProgramText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 12,
  },

});
