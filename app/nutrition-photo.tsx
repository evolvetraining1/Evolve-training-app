import { ScreenScrollView } from "@/src/components/screen-scroll-view";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { Card, Label, PrimaryButton, ScreenHeader, goBackOrReplace } from "@/src/components/ui";
import { localDateString } from "@/src/lib/date";
import { supabase } from "@/src/lib/supabase";
import { colors } from "@/src/theme";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type Confidence = "low" | "medium" | "high";

type EstimatedFood = {
  localId: string;
  name: string;
  estimated_grams: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number;
  cooking_method: string | null;
  confidence: number;
  assumptions: string[];
};

type AnalysisResult = {
  analysisId: string;
  meal_summary: string;
  confidence: Confidence;
  foods: Omit<EstimatedFood, "localId">[];
  warnings: string[];
};

const meals: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Petit-déj." },
  { key: "lunch", label: "Déjeuner" },
  { key: "dinner", label: "Dîner" },
  { key: "snack", label: "Collation" },
];

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function localId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function portion(value100: number, grams: number) {
  return round1((Math.max(0, value100) * Math.max(0, grams)) / 100);
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) return message;
  }

  return "Une erreur est survenue.";
}

export default function NutritionPhotoScreen() {
  const params = useLocalSearchParams<{ mealType?: string }>();
  const initialMeal = meals.some((item) => item.key === params.mealType)
    ? (params.mealType as MealType)
    : "lunch";

  const [mealType, setMealType] = useState<MealType>(initialMeal);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [mealSummary, setMealSummary] = useState("");
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [foods, setFoods] = useState<EstimatedFood[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const totals = useMemo(
    () =>
      foods.reduce(
        (sum, food) => ({
          calories: sum.calories + portion(food.kcal_100g, food.estimated_grams),
          protein: sum.protein + portion(food.protein_100g, food.estimated_grams),
          carbs: sum.carbs + portion(food.carbs_100g, food.estimated_grams),
          fat: sum.fat + portion(food.fat_100g, food.estimated_grams),
          fiber: sum.fiber + portion(food.fiber_100g, food.estimated_grams),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      ),
    [foods]
  );

  function resetAnalysis(nextPhoto: ImagePicker.ImagePickerAsset) {
    setPhoto(nextPhoto);
    setAnalysisId(null);
    setMealSummary("");
    setConfidence(null);
    setFoods([]);
    setWarnings([]);
    setMessage("");
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage("Autorise l'accès à la caméra pour photographier ton assiette.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.45,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) resetAnalysis(result.assets[0]);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function choosePhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("Autorise l'accès aux photos pour sélectionner ton repas.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.45,
        base64: true,
        exif: false,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets[0]) resetAnalysis(result.assets[0]);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function analyzePhoto() {
    if (!photo?.base64) {
      setMessage("Reprends ou resélectionne la photo avant l'analyse.");
      return;
    }

    if (photo.base64.length > 8_000_000) {
      setMessage("Cette photo est trop volumineuse. Reprends-la avec la caméra de l'app.");
      return;
    }

    try {
      setAnalyzing(true);
      setMessage("");

      const { data, error } = await supabase.functions.invoke<AnalysisResult>(
        "analyze-meal-photo",
        {
          body: {
            imageBase64: photo.base64,
            mimeType: photo.mimeType ?? "image/jpeg",
            mealType,
          },
        }
      );

      if (error) {
        let remoteMessage = error.message;
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === "function") {
          const payload = await context.clone().json().catch(() => null);
          if (payload?.error) remoteMessage = String(payload.error);
        }
        throw new Error(remoteMessage);
      }

      if (!data?.analysisId || !data.foods?.length) {
        throw new Error("Aucun aliment n'a été reconnu sur cette photo.");
      }

      setAnalysisId(data.analysisId);
      setMealSummary(data.meal_summary);
      setConfidence(data.confidence);
      setWarnings(data.warnings ?? []);
      setFoods(
        data.foods.map((food) => ({
          ...food,
          localId: localId(),
        }))
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  }

  function updateFood(id: string, patch: Partial<EstimatedFood>) {
    setFoods((current) =>
      current.map((food) => (food.localId === id ? { ...food, ...patch } : food))
    );
  }

  function updateNumber(
    id: string,
    field:
      | "estimated_grams"
      | "kcal_100g"
      | "protein_100g"
      | "carbs_100g"
      | "fat_100g"
      | "fiber_100g",
    value: string
  ) {
    updateFood(id, { [field]: numberValue(value) });
  }

  function addFood() {
    setFoods((current) => [
      ...current,
      {
        localId: localId(),
        name: "Nouvel aliment",
        estimated_grams: 100,
        kcal_100g: 0,
        protein_100g: 0,
        carbs_100g: 0,
        fat_100g: 0,
        fiber_100g: 0,
        cooking_method: null,
        confidence: 1,
        assumptions: ["Ajouté manuellement"],
      },
    ]);
  }

  async function saveMeal() {
    const validFoods = foods.filter(
      (food) => food.name.trim() && food.estimated_grams > 0
    );

    if (!analysisId || !validFoods.length) {
      setMessage("Ajoute au moins un aliment avec une quantité valide.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      const eatenOn = localDateString();
      const rows = validFoods.map((food) => ({
        user_id: user.id,
        entry_date: eatenOn,
        eaten_on: eatenOn,
        meal_type: mealType,
        food_name: food.name.trim(),
        grams: round1(food.estimated_grams),
        calories: portion(food.kcal_100g, food.estimated_grams),
        protein_g: portion(food.protein_100g, food.estimated_grams),
        carbs_g: portion(food.carbs_100g, food.estimated_grams),
        fat_g: portion(food.fat_100g, food.estimated_grams),
        fiber_g: portion(food.fiber_100g, food.estimated_grams),
        source: "ai_plate",
        ai_analysis_id: analysisId,
      }));

      const { error: insertError } = await supabase
        .from("nutrition_entries")
        .insert(rows);
      if (insertError) throw insertError;

      const correctedFoods = validFoods.map(({ localId: _, ...food }) => food);
      const { error: updateError } = await supabase
        .from("nutrition_ai_analyses")
        .update({
          meal_type: mealType,
          status: "saved",
          foods: correctedFoods,
          saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysisId);
      if (updateError) console.warn("NUTRITION_AI_ANALYSIS_UPDATE", updateError.message);

      goBackOrReplace();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenScrollView automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.back} onPress={() => goBackOrReplace()}>
          ← RETOUR
        </Text>

        <ScreenHeader
          eyebrow="EVOLVE NUTRITION IA"
          title="Analyse ton assiette"
          subtitle="Prends une photo, vérifie l'estimation, puis ajoute le repas à ton suivi."
        />

        <Text style={styles.sectionTitle}>REPAS</Text>
        <View style={styles.mealRow}>
          {meals.map((meal) => (
            <Pressable
              key={meal.key}
              onPress={() => setMealType(meal.key)}
              style={[
                styles.mealButton,
                mealType === meal.key && styles.mealButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.mealText,
                  mealType === meal.key && styles.mealTextActive,
                ]}
              >
                {meal.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card style={styles.photoCard}>
          {photo?.uri ? (
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoEmpty}>
              <Text style={styles.photoGlyph}>◎</Text>
              <Text style={styles.photoEmptyTitle}>Cadre toute l'assiette</Text>
              <Text style={styles.photoEmptyText}>
                Lumière naturelle, vue du dessus et couverts visibles si possible.
              </Text>
            </View>
          )}

          <View style={styles.photoActions}>
            <Pressable style={styles.photoActionPrimary} onPress={() => void takePhoto()}>
              <Text style={styles.photoActionPrimaryText}>PRENDRE UNE PHOTO</Text>
            </Pressable>
            <Pressable style={styles.photoAction} onPress={() => void choosePhoto()}>
              <Text style={styles.photoActionText}>GALERIE</Text>
            </Pressable>
          </View>

          {photo ? (
            <PrimaryButton
              label={analyzing ? "ANALYSE EN COURS..." : "ANALYSER L'ASSIETTE"}
              onPress={() => void analyzePhoto()}
              disabled={analyzing}
            />
          ) : null}

          <Text style={styles.privacyText}>
            La photo est analysée à la demande et n'est pas enregistrée dans ton journal.
          </Text>
        </Card>

        {analyzing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.yellow} />
            <Text style={styles.loadingText}>
              Identification des aliments et estimation des portions…
            </Text>
          </View>
        ) : null}

        {message ? <Text style={styles.error}>{message}</Text> : null}

        {analysisId ? (
          <>
            <Card style={styles.resultHeader}>
              <View style={styles.resultTopRow}>
                <View style={{ flex: 1 }}>
                  <Label>Résultat à vérifier</Label>
                  <Text style={styles.summary}>{mealSummary}</Text>
                </View>
                <View
                  style={[
                    styles.confidenceBadge,
                    confidence === "low" && styles.confidenceBadgeLow,
                  ]}
                >
                  <Text style={styles.confidenceText}>
                    {confidence === "high"
                      ? "FIABLE"
                      : confidence === "medium"
                        ? "MOYEN"
                        : "À VÉRIFIER"}
                  </Text>
                </View>
              </View>

              <View style={styles.totalGrid}>
                <View style={styles.totalMain}>
                  <Text style={styles.totalValue}>{Math.round(totals.calories)}</Text>
                  <Text style={styles.totalLabel}>KCAL</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalSmall}>{round1(totals.protein)} g</Text>
                  <Text style={styles.totalLabel}>PROT.</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalSmall}>{round1(totals.carbs)} g</Text>
                  <Text style={styles.totalLabel}>GLUC.</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalSmall}>{round1(totals.fat)} g</Text>
                  <Text style={styles.totalLabel}>LIP.</Text>
                </View>
              </View>

              {warnings.map((warning, index) => (
                <Text key={`${warning}-${index}`} style={styles.warning}>
                  • {warning}
                </Text>
              ))}
            </Card>

            <View style={styles.foodSectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>ALIMENTS DÉTECTÉS</Text>
                <Text style={styles.sectionHelp}>
                  Corrige surtout les grammes, l'huile et les sauces.
                </Text>
              </View>
              <Pressable style={styles.addButton} onPress={addFood}>
                <Text style={styles.addButtonText}>＋ AJOUTER</Text>
              </Pressable>
            </View>

            {foods.map((food, index) => (
              <Card key={food.localId} style={styles.foodCard}>
                <View style={styles.foodTitleRow}>
                  <Text style={styles.foodNumber}>{String(index + 1).padStart(2, "0")}</Text>
                  <TextInput
                    value={food.name}
                    onChangeText={(value) => updateFood(food.localId, { name: value })}
                    style={styles.foodNameInput}
                    placeholder="Nom de l'aliment"
                    placeholderTextColor={colors.muted2}
                  />
                  <Pressable
                    style={styles.removeButton}
                    onPress={() =>
                      setFoods((current) =>
                        current.filter((item) => item.localId !== food.localId)
                      )
                    }
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>

                <View style={styles.gramsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>QUANTITÉ ESTIMÉE</Text>
                    <TextInput
                      value={String(food.estimated_grams)}
                      onChangeText={(value) =>
                        updateNumber(food.localId, "estimated_grams", value)
                      }
                      keyboardType="decimal-pad"
                      style={styles.gramsInput}
                    />
                  </View>
                  <Text style={styles.unit}>g</Text>
                  <View style={styles.portionKcal}>
                    <Text style={styles.portionKcalValue}>
                      {Math.round(portion(food.kcal_100g, food.estimated_grams))}
                    </Text>
                    <Text style={styles.portionKcalLabel}>KCAL PORTION</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>VALEURS POUR 100 G</Text>
                <View style={styles.macroGrid}>
                  {([
                    ["kcal_100g", "Kcal", food.kcal_100g],
                    ["protein_100g", "Prot.", food.protein_100g],
                    ["carbs_100g", "Gluc.", food.carbs_100g],
                    ["fat_100g", "Lip.", food.fat_100g],
                    ["fiber_100g", "Fibres", food.fiber_100g],
                  ] as const).map(([field, label, value]) => (
                    <View key={field} style={styles.macroField}>
                      <TextInput
                        value={String(value)}
                        onChangeText={(text) => updateNumber(food.localId, field, text)}
                        keyboardType="decimal-pad"
                        style={styles.macroInput}
                      />
                      <Text style={styles.macroLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {food.cooking_method ? (
                  <Text style={styles.assumption}>Cuisson : {food.cooking_method}</Text>
                ) : null}
                {food.assumptions.map((assumption, assumptionIndex) => (
                  <Text
                    key={`${assumption}-${assumptionIndex}`}
                    style={styles.assumption}
                  >
                    {assumption}
                  </Text>
                ))}
              </Card>
            ))}

            <Card style={styles.disclaimerCard}>
              <Text style={styles.disclaimerTitle}>ESTIMATION, PAS UNE MESURE</Text>
              <Text style={styles.disclaimerText}>
                Une photo ne permet pas de peser précisément un aliment ni de voir toute l'huile,
                les sauces ou les ingrédients cachés. Vérifie les quantités avant d'enregistrer.
              </Text>
            </Card>

            <PrimaryButton
              label={saving ? "ENREGISTREMENT..." : "AJOUTER AU JOURNAL"}
              onPress={() => void saveMeal()}
              disabled={saving || !foods.length}
            />
          </>
        ) : null}
      </ScreenScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { padding: 20, paddingTop: 58, paddingBottom: 70 },
  back: { color: colors.yellow, fontWeight: "900", marginBottom: 18 },
  sectionTitle: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  sectionHelp: { color: colors.muted, fontSize: 12, marginTop: 4 },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 18 },
  mealButton: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mealButtonActive: { borderColor: colors.yellow, backgroundColor: "#191500" },
  mealText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  mealTextActive: { color: colors.yellow },
  photoCard: { gap: 14, marginBottom: 16 },
  photo: { width: "100%", height: 320, borderRadius: 16, backgroundColor: colors.surface2 },
  photoEmpty: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
  },
  photoGlyph: { color: colors.yellow, fontSize: 52, fontWeight: "900" },
  photoEmptyTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 10 },
  photoEmptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 },
  photoActions: { flexDirection: "row", gap: 9 },
  photoActionPrimary: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#191500",
    borderWidth: 1,
    borderColor: colors.yellow,
    paddingHorizontal: 10,
  },
  photoActionPrimaryText: { color: colors.yellow, fontSize: 11, fontWeight: "900" },
  photoAction: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
  },
  photoActionText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  privacyText: { color: colors.muted2, fontSize: 10, lineHeight: 15, textAlign: "center" },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 14,
  },
  loadingText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
  error: {
    color: "#FF8A8A",
    backgroundColor: "#2A0E0E",
    borderColor: "#612222",
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
    fontSize: 12,
    lineHeight: 17,
  },
  resultHeader: { gap: 14, marginBottom: 20 },
  resultTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  summary: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "800", marginTop: 7 },
  confidenceBadge: {
    backgroundColor: "#173118",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  confidenceBadgeLow: { backgroundColor: "#3B2508" },
  confidenceText: { color: colors.text, fontSize: 9, fontWeight: "900" },
  totalGrid: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  totalMain: {
    flex: 1.35,
    backgroundColor: "#191500",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  totalItem: { flex: 1, backgroundColor: colors.surface2, borderRadius: 14, padding: 10 },
  totalValue: { color: colors.yellow, fontSize: 26, fontWeight: "900" },
  totalSmall: { color: colors.text, fontSize: 15, fontWeight: "900" },
  totalLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", marginTop: 4 },
  warning: { color: "#E8C77A", fontSize: 11, lineHeight: 16 },
  foodSectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  addButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.yellow,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addButtonText: { color: colors.yellow, fontSize: 10, fontWeight: "900" },
  foodCard: { gap: 13, marginBottom: 12 },
  foodTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  foodNumber: { color: colors.yellow, fontSize: 11, fontWeight: "900" },
  foodNameInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 7,
  },
  removeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.surface2,
  },
  removeText: { color: colors.muted, fontSize: 22, lineHeight: 25 },
  gramsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  inputLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  gramsInput: {
    color: colors.text,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 13,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },
  unit: { color: colors.muted, fontSize: 16, fontWeight: "900", paddingBottom: 14 },
  portionKcal: { alignItems: "flex-end", paddingBottom: 7, minWidth: 92 },
  portionKcalValue: { color: colors.yellow, fontSize: 23, fontWeight: "900" },
  portionKcalLabel: { color: colors.muted, fontSize: 8, fontWeight: "900" },
  macroGrid: { flexDirection: "row", gap: 6 },
  macroField: { flex: 1, alignItems: "center" },
  macroInput: {
    width: "100%",
    minHeight: 42,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 12,
    fontWeight: "800",
  },
  macroLabel: { color: colors.muted, fontSize: 8, fontWeight: "800", marginTop: 5 },
  assumption: { color: colors.muted2, fontSize: 10, lineHeight: 14 },
  disclaimerCard: { marginTop: 6, marginBottom: 16, borderColor: "#53430B" },
  disclaimerTitle: { color: colors.yellow, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  disclaimerText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
});
