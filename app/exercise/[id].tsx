import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, radius } from "@/src/theme";

type ExerciseDetail = {
  id: string;
  name: string;
  category: string | null;
  instructions: string | null;
  video_url: string | null;
  objective?: string | null;
  key_points?: string[] | null;
  common_errors?: string[] | null;
  regressions?: string[] | null;
  progressions?: string[] | null;
  equipment?: string[] | null;
  muscles?: string[] | null;
  image_url?: string | null;
  difficulty?: string | null;
};

function Section({ title, items, text }: { title: string; items?: string[] | null; text?: string | null }) {
  if (!text && !items?.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!text && <Text style={styles.sectionText}>{text}</Text>}
      {!!items?.length && items.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: requestError } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();

      if (!active) return;
      if (requestError || !data) {
        setError("Impossible de charger ce mouvement.");
        setExercise(null);
      } else {
        setExercise(data as ExerciseDetail);
      }
      setLoading(false);
    }
    if (params.id) void load();
    return () => { active = false; };
  }, [params.id]);

  if (loading) {
    return <View style={styles.state}><ActivityIndicator color={colors.yellow} /></View>;
  }

  if (error || !exercise) {
    return (
      <View style={styles.state}>
        <Text style={styles.error}>{error ?? "Mouvement introuvable."}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Retour</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.brand}>EVOLVE TRAINING</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.eyebrow}>{[exercise.category, exercise.difficulty].filter(Boolean).join("  •  ")}</Text>
      <Text style={styles.title}>{exercise.name.toUpperCase()}</Text>

      <View style={styles.hero}>
        {exercise.image_url ? (
          <Image source={{ uri: exercise.image_url }} resizeMode="cover" style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroGlyph}>▧</Text>
            <Text style={styles.heroPlaceholderText}>VISUEL DU MOUVEMENT</Text>
          </View>
        )}
      </View>

      {!!exercise.video_url && (
        <Pressable onPress={() => void Linking.openURL(exercise.video_url!)} style={styles.videoButton}>
          <Text style={styles.videoIcon}>▶</Text>
          <Text style={styles.videoText}>VOIR LA VIDÉO</Text>
        </Pressable>
      )}

      <View style={styles.tagRow}>
        {!!exercise.equipment?.length && <View style={styles.tag}><Text style={styles.tagLabel}>MATÉRIEL</Text><Text style={styles.tagValue}>{exercise.equipment.join(" • ")}</Text></View>}
        {!!exercise.muscles?.length && <View style={styles.tag}><Text style={styles.tagLabel}>CIBLES</Text><Text style={styles.tagValue}>{exercise.muscles.join(" • ")}</Text></View>}
      </View>

      <Section title="OBJECTIF" text={exercise.objective} />
      <Section title="EXÉCUTION" text={exercise.instructions} />
      <Section title="POINTS CLÉS" items={exercise.key_points} />
      <Section title="ERREURS FRÉQUENTES" items={exercise.common_errors} />

      <View style={styles.twoColumns}>
        <View style={styles.column}><Section title="RÉGRESSION" items={exercise.regressions} /></View>
        <View style={styles.column}><Section title="PROGRESSION" items={exercise.progressions} /></View>
      </View>

      {!exercise.objective && !exercise.instructions && !exercise.key_points?.length && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>FICHE EN PRÉPARATION</Text>
          <Text style={styles.pendingText}>Le mouvement est déjà disponible dans la bibliothèque. Les consignes techniques seront ajoutées progressivement.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingTop: 48, paddingHorizontal: 18, paddingBottom: 60 },
  state: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: colors.red, textAlign: "center", marginBottom: 16 },
  backButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  backButtonText: { color: colors.text, fontWeight: "800" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26 },
  back: { color: colors.text, fontSize: 42, lineHeight: 42 },
  brand: { color: colors.yellowSoft, fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  eyebrow: { color: colors.yellowSoft, fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 7 },
  title: { color: colors.text, fontSize: 30, lineHeight: 33, fontWeight: "900", letterSpacing: 0.5, marginBottom: 18 },
  hero: { height: 280, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,15,16,0.95)" },
  heroGlyph: { color: colors.yellow, fontSize: 44, marginBottom: 10 },
  heroPlaceholderText: { color: colors.muted2, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  videoButton: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, minHeight: 54, borderWidth: 1, borderColor: colors.yellowSoft, borderRadius: radius.md, paddingHorizontal: 16, backgroundColor: "rgba(255,196,0,0.08)" },
  videoIcon: { color: colors.yellow, fontSize: 18 },
  videoText: { color: colors.text, fontWeight: "900", letterSpacing: 1.6, fontSize: 12 },
  tagRow: { gap: 10, marginTop: 12 },
  tag: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, backgroundColor: "rgba(11,11,12,0.92)", padding: 14 },
  tagLabel: { color: colors.yellowSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginBottom: 5 },
  tagValue: { color: colors.text, fontSize: 13, lineHeight: 18 },
  section: { borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: "rgba(11,11,12,0.94)", borderRadius: radius.md, padding: 16, marginTop: 12 },
  sectionTitle: { color: colors.yellowSoft, fontSize: 12, fontWeight: "900", letterSpacing: 1.8, marginBottom: 9 },
  sectionText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  bullet: { color: colors.text, fontSize: 14, lineHeight: 21, marginBottom: 3 },
  twoColumns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  pendingCard: { marginTop: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.md, padding: 18 },
  pendingTitle: { color: colors.yellowSoft, fontWeight: "900", fontSize: 12, letterSpacing: 1.6, marginBottom: 8 },
  pendingText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
