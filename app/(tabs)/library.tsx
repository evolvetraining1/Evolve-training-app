import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, radius } from "@/src/theme";

type ExerciseRow = {
  id: string;
  name: string;
  category: string | null;
  equipment?: string[] | null;
  muscles?: string[] | null;
  difficulty?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  is_library_visible?: boolean | null;
};

export default function ExerciseLibraryScreen() {
  const [items, setItems] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: requestError } = await supabase
        .from("exercises")
        .select("*")
        .order("name", { ascending: true });

      if (!active) return;
      if (requestError) {
        setError("Impossible de charger la bibliothèque pour le moment.");
        setItems([]);
      } else {
        setItems((data ?? []).filter((item: ExerciseRow) => item.is_library_visible !== false));
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];
    return ["Toutes", ...values.sort((a, b) => a.localeCompare(b, "fr"))];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return items.filter((item) => {
      const categoryMatches = category === "Toutes" || item.category === category;
      const textMatches = !needle || item.name.toLocaleLowerCase("fr").includes(needle);
      return categoryMatches && textMatches;
    });
  }, [items, query, category]);

  return (
    <View style={styles.screen}>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {categories.map((value) => {
          const selected = value === category;
          return (
            <Pressable key={value} onPress={() => setCategory(value)} style={[styles.filterChip, selected && styles.filterChipActive]}>
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>{value}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color={colors.yellow} /></View>
      ) : error ? (
        <View style={styles.centerState}><Text style={styles.error}>{error}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={styles.count}>{filtered.length} mouvement{filtered.length > 1 ? "s" : ""}</Text>
          {filtered.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/exercise/${item.id}` as never)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.mediaPlaceholder}>
                <Text style={styles.mediaGlyph}>{item.video_url ? "▶" : item.image_url ? "▧" : "＋"}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.metaRow}>
                  {!!item.category && <Text style={styles.meta}>{item.category}</Text>}
                  {!!item.difficulty && <Text style={styles.meta}>• {item.difficulty}</Text>}
                </View>
                {!!item.equipment?.length && <Text style={styles.detail}>{item.equipment.join(" • ")}</Text>}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          {!filtered.length && <Text style={styles.empty}>Aucun mouvement ne correspond à ta recherche.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 54, backgroundColor: "transparent" },
  header: { paddingHorizontal: 20, marginBottom: 18 },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 2.6 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: 1.2, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 360 },
  search: { marginHorizontal: 20, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: "rgba(10,10,11,0.92)", color: colors.text, paddingHorizontal: 16, height: 50, fontSize: 15 },
  filters: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filterChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(11,11,12,0.9)", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.12)" },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: colors.yellow },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  error: { color: colors.red, textAlign: "center" },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  count: { color: colors.muted2, fontSize: 12, fontWeight: "700", marginBottom: 10 },
  card: { minHeight: 92, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: "rgba(11,11,12,0.94)", borderRadius: radius.md, marginBottom: 10, overflow: "hidden" },
  cardPressed: { opacity: 0.75 },
  mediaPlaceholder: { width: 82, alignSelf: "stretch", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3, borderRightWidth: 1, borderRightColor: colors.borderSoft },
  mediaGlyph: { color: colors.yellow, fontSize: 24, fontWeight: "900" },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900", lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  meta: { color: colors.yellowSoft, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  detail: { color: colors.muted, fontSize: 12, marginTop: 5 },
  chevron: { color: colors.muted, fontSize: 28, paddingRight: 14 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 50 },
});
