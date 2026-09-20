import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, radius } from "@/src/theme";
import { getExerciseIllustration } from "@/src/data/exerciseIllustrations";
import { MuscleBodyFilter } from "@/src/components/muscle-body-filter";
import { TAB_HEADER_TOP } from "@/src/components/ui";
import {
  BodyGroupKey,
  getBodyGroupLabel,
  getExerciseBodyGroups,
  getPrimaryBodyGroup,
} from "@/src/data/exercise-muscle-groups";

type ExerciseRow = {
  id: string;
  name: string;
  category: string | null;
  equipment?: string[] | null;
  difficulty?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  muscles?: string[] | null;
};

export default function ExerciseLibraryScreen() {
  const [items, setItems] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<BodyGroupKey[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: requestError } = await supabase
        .from("exercises")
        .select("id, name, category, equipment, difficulty, image_url, video_url, muscles")
        .eq("is_library_visible", true)
        .order("name", { ascending: true });

      if (!active) return;
      if (requestError) {
        setError("Impossible de charger la bibliothèque pour le moment.");
        setItems([]);
      } else {
        setItems((data ?? []) as ExerciseRow[]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return items.filter((item) => {
      const textMatches = !needle || item.name.toLocaleLowerCase("fr").includes(needle);
      const muscleGroups = getExerciseBodyGroups(item);
      const muscleMatches =
        selectedGroups.length === 0 ||
        selectedGroups.some((group) => muscleGroups.includes(group));
      return muscleMatches && textMatches;
    });
  }, [items, query, selectedGroups]);

  const sections = useMemo(() => {
    const grouped = new Map<BodyGroupKey, ExerciseRow[]>();
    filtered.forEach((item) => {
      const group = getPrimaryBodyGroup(item);
      grouped.set(group, [...(grouped.get(group) ?? []), item]);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => {
        const order: BodyGroupKey[] = ["cardio", "chest", "back", "shoulders", "arms", "core", "lower_back", "glutes", "quads", "hamstrings", "calves"];
        return order.indexOf(a) - order.indexOf(b);
      })
      .map(([group, data]) => ({
        group,
        title: getBodyGroupLabel(group),
        data: data.sort((a, b) => a.name.localeCompare(b.name, "fr")),
      }));
  }, [filtered]);

  function toggleGroup(group: BodyGroupKey) {
    setSelectedGroups((current) =>
      current.includes(group)
        ? current.filter((value) => value !== group)
        : [...current, group]
    );
  }

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color={colors.yellow} /></View>
      ) : error ? (
        <View style={styles.centerState}><Text style={styles.error}>{error}</Text></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.header}>
                <Text style={styles.eyebrow}>EVOLVE TRAINING</Text>
                <Text style={styles.title}>BIBLIOTHÈQUE</Text>
                <Text style={styles.subtitle}>Retrouve rapidement la technique et les repères de chaque mouvement.</Text>
              </View>

              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher un mouvement..."
                placeholderTextColor={colors.muted2}
                style={styles.search}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <MuscleBodyFilter
                selected={selectedGroups}
                onToggle={toggleGroup}
                onClear={() => setSelectedGroups([])}
              />

              <View style={styles.resultSummary}>
                <Text style={styles.count}>{filtered.length} mouvement{filtered.length > 1 ? "s" : ""}</Text>
                {!!selectedGroups.length && (
                  <Text style={styles.selectionSummary} numberOfLines={1}>
                    {selectedGroups.map(getBodyGroupLabel).join(" + ")}
                  </Text>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucun mouvement ne correspond à ta recherche.</Text>}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const illustration = getExerciseIllustration(item.name, item.image_url);
            const muscleGroups = getExerciseBodyGroups(item).slice(0, 3);

            return (
              <Pressable
                onPress={() => router.push(`/exercise/${item.id}` as never)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.mediaPlaceholder}>
                  {illustration ? (
                    <Image
                      source={illustration}
                      resizeMode="contain"
                      style={styles.mediaImage}
                      accessibilityLabel={`Illustration du mouvement ${item.name}`}
                    />
                  ) : (
                    <Text style={styles.mediaGlyph}>{item.video_url ? "▶" : "＋"}</Text>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <View style={styles.metaRow}>
                    {!!item.category && <Text style={styles.meta}>{item.category}</Text>}
                    {!!item.difficulty && <Text style={styles.meta}>• {item.difficulty}</Text>}
                  </View>
                  {!!muscleGroups.length && (
                    <Text style={styles.targets}>{muscleGroups.map(getBodyGroupLabel).join(" • ")}</Text>
                  )}
                  {!!item.equipment?.length && <Text style={styles.detail}>{item.equipment.join(" • ")}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: TAB_HEADER_TOP, backgroundColor: "transparent" },
  listHeader: { gap: 14, paddingBottom: 18 },
  header: { paddingHorizontal: 20 },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 2.6 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: 1.2, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 360 },
  search: { marginHorizontal: 20, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: "rgba(10,10,11,0.92)", color: colors.text, paddingHorizontal: 16, height: 50, fontSize: 15 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  error: { color: colors.red, textAlign: "center" },
  list: { paddingBottom: 120 },
  resultSummary: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  count: { color: colors.muted2, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  selectionSummary: { flex: 1, color: colors.yellowSoft, fontSize: 11, fontWeight: "800", textAlign: "right" },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: colors.yellow, fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  sectionCount: { color: colors.muted2, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  card: { minHeight: 124, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: "rgba(11,11,12,0.94)", borderRadius: radius.md, marginHorizontal: 20, marginBottom: 10, overflow: "hidden" },
  cardPressed: { opacity: 0.75 },
  mediaPlaceholder: { width: 104, height: 104, flexShrink: 0, marginLeft: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.sm, overflow: "hidden" },
  mediaImage: { width: "100%", height: "100%" },
  mediaGlyph: { color: colors.yellow, fontSize: 24, fontWeight: "900" },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900", lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  meta: { color: colors.yellowSoft, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  targets: { color: colors.text, fontSize: 11, fontWeight: "700", marginTop: 5 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 5 },
  chevron: { color: colors.muted, fontSize: 28, paddingRight: 14 },
  empty: { color: colors.muted, textAlign: "center", paddingHorizontal: 20, paddingVertical: 50 },
});
