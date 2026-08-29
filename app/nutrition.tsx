import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";


import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { localDateString } from "@/src/lib/date";

const ciqualFoods = require("../src/data/ciqual-foods.json");

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type CiqualFood = {
  code: string;
  name: string;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
  fiber100: number | null;
  source: string;
};

type NutritionEntry = {
  id: string;
  food_name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: MealType;
  eaten_on: string;
  source: string;
};

type NutritionTargets = {
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
};

const meals: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Petit-déjeuner" },
  { key: "lunch", label: "Déjeuner" },
  { key: "dinner", label: "Dîner" },
  { key: "snack", label: "Collation" },
];

function today() {
  return localDateString();
}

function numberValue(value: string) {
  return Number(value.replace(",", ".") || 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function calculateValue(
  value100: number | null,
  grams: number
): number {
  if (value100 == null || grams <= 0) return 0;
  return round1(value100 * grams / 100);
}

export default function NutritionScreen() {
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [targets, setTargets] = useState<NutritionTargets>({
    calories_target: 2500,
    protein_target_g: 170,
    carbs_target_g: 280,
    fat_target_g: 75,
    fiber_target_g: 30,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [nutritionGoal, setNutritionGoal] = useState<
    "mass_gain" | "weight_loss" | "maintenance"
  >("maintenance");

  const [showScanner, setShowScanner] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [scanningProduct, setScanningProduct] = useState(false);
  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [mealType, setMealType] = useState<MealType>("lunch");
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("");
  const [selectedFood, setSelectedFood] = useState<CiqualFood | null>(null);

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

      // Charger le profil nutrition, les objectifs et les repas
      // en parallèle pour éviter le délai/glitch à l'ouverture.
      const [
        profileResult,
        targetsResult,
        entriesResult,
      ] = await Promise.all([
        supabase
          .from("nutrition_profile")
          .select("weight_kg, goal")
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("nutrition_targets")
          .select(
            "calories_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g"
          )
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("nutrition_entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("eaten_on", today())
          .order("created_at", { ascending: true }),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (targetsResult.error) throw targetsResult.error;
      if (entriesResult.error) throw entriesResult.error;

      const nutritionProfile = profileResult.data;

      if (nutritionProfile) {
        setWeightKg(
          nutritionProfile.weight_kg != null
            ? String(nutritionProfile.weight_kg)
            : ""
        );

        if (
          nutritionProfile.goal === "mass_gain" ||
          nutritionProfile.goal === "weight_loss" ||
          nutritionProfile.goal === "maintenance"
        ) {
          setNutritionGoal(nutritionProfile.goal);
        }
      }

      const targetData = targetsResult.data;

      if (targetData) {
        setTargets({
          calories_target: Number(targetData.calories_target),
          protein_target_g: Number(targetData.protein_target_g),
          carbs_target_g: Number(targetData.carbs_target_g),
          fat_target_g: Number(targetData.fat_target_g),
          fiber_target_g: Number(targetData.fiber_target_g),
        });
      }

      setEntries(
        (entriesResult.data ?? []) as NutritionEntry[]
      );
    } catch (e: any) {
      setMessage(
        e?.message ?? "Impossible de charger le suivi nutrition."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.calories += Number(entry.calories ?? 0);
        acc.protein += Number(entry.protein_g ?? 0);
        acc.carbs += Number(entry.carbs_g ?? 0);
        acc.fat += Number(entry.fat_g ?? 0);
        acc.fiber += Number(entry.fiber_g ?? 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [entries]);

  const suggestions = useMemo(() => {
    const query = foodName.trim().toLowerCase();

    if (query.length < 2 || selectedFood) return [];

    return (ciqualFoods as CiqualFood[])
      .filter((food) => food.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [foodName, selectedFood]);

  const calculated = useMemo(() => {
    const quantity = numberValue(grams);

    if (!selectedFood || quantity <= 0) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };
    }

    return {
      calories: calculateValue(selectedFood.kcal100, quantity),
      protein: calculateValue(selectedFood.protein100, quantity),
      carbs: calculateValue(selectedFood.carbs100, quantity),
      fat: calculateValue(selectedFood.fat100, quantity),
      fiber: calculateValue(selectedFood.fiber100, quantity),
    };
  }, [selectedFood, grams]);

  function chooseFood(food: CiqualFood) {
    setSelectedFood(food);
    setFoodName(food.name);
    setMessage("");
  }

  function editFoodName(value: string) {
    setFoodName(value);

    if (selectedFood && value !== selectedFood.name) {
      setSelectedFood(null);
    }
  }

  async function handleBarcodeScanned({
    data,
  }: {
    data: string;
  }) {
    if (scannerLocked || scanningProduct) return;

    try {
      setScannerLocked(true);
      setScanningProduct(true);
      setMessage("Recherche du produit...");

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          data
        )}.json`
      );

      if (!response.ok) {
        throw new Error("Impossible de contacter la base produit.");
      }

      const result = await response.json();

      if (!result?.product) {
        throw new Error("Produit introuvable.");
      }

      const product = result.product;
      const nutriments = product.nutriments ?? {};

      const name =
        product.product_name_fr ||
        product.product_name ||
        product.generic_name_fr ||
        product.generic_name ||
        `Produit ${data}`;

      const scannedFood: CiqualFood = {
        code: String(data),
        name,
        kcal100:
          nutriments["energy-kcal_100g"] != null
            ? Number(nutriments["energy-kcal_100g"])
            : null,
        protein100:
          nutriments.proteins_100g != null
            ? Number(nutriments.proteins_100g)
            : null,
        carbs100:
          nutriments.carbohydrates_100g != null
            ? Number(nutriments.carbohydrates_100g)
            : null,
        fat100:
          nutriments.fat_100g != null
            ? Number(nutriments.fat_100g)
            : null,
        fiber100:
          nutriments.fiber_100g != null
            ? Number(nutriments.fiber_100g)
            : null,
        source: "open_food_facts",
      };

      setSelectedFood(scannedFood);
      setFoodName(scannedFood.name);
      setShowScanner(false);
      setMessage("Produit scanné. Indique la quantité consommée.");
    } catch (e: any) {
      setMessage(e?.message ?? "Impossible de lire ce produit.");
      setScannerLocked(false);
    } finally {
      setScanningProduct(false);
    }
  }

  async function saveEntry() {
    try {
      setMessage("");

      if (!selectedFood) {
        setMessage("Sélectionne un aliment dans les résultats Ciqual.");
        return;
      }

      const quantity = numberValue(grams);

      if (quantity <= 0) {
        setMessage("Entre un grammage valide.");
        return;
      }

      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      const { error } = await supabase.from("nutrition_entries").insert({
        user_id: user.id,
        food_name: selectedFood.name,
        grams: quantity,
        calories: calculated.calories,
        protein_g: calculated.protein,
        carbs_g: calculated.carbs,
        fat_g: calculated.fat,
        fiber_g: calculated.fiber,
        meal_type: mealType,
        eaten_on: today(),
        source:
          selectedFood.source === "open_food_facts"
            ? "open_food_facts"
            : "ciqual_2025",
      });

      if (error) throw error;

      setFoodName("");
      setGrams("");
      setSelectedFood(null);

      await load();
      setMessage("Aliment ajouté.");
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    try {
      const { error } = await supabase
        .from("nutrition_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (e: any) {
      setMessage(e?.message ?? "Impossible de supprimer cet aliment.");
    }
  }

  function calculateNutritionTargets(
    weight: number,
    goal: "mass_gain" | "weight_loss" | "maintenance"
  ): NutritionTargets {
    // V1 temporaire basée sur poids + objectif.
    // Le calcul complet utilisera ensuite âge, taille, sexe et activité.

    const maintenanceCalories = weight * 30;

    let calories = maintenanceCalories;
    let proteinPerKg = 1.8;

    if (goal === "mass_gain") {
      calories = maintenanceCalories * 1.10;
      proteinPerKg = 2.0;
    }

    if (goal === "weight_loss") {
      calories = maintenanceCalories * 0.85;
      proteinPerKg = 2.2;
    }

    const protein = weight * proteinPerKg;
    const fat = weight * 0.9;

    const carbs = Math.max(
      0,
      (
        calories -
        protein * 4 -
        fat * 9
      ) / 4
    );

    return {
      calories_target: Math.round(calories),
      protein_target_g: Math.round(protein),
      carbs_target_g: Math.round(carbs),
      fat_target_g: Math.round(fat),
      fiber_target_g: 30,
    };
  }

  async function saveNutritionSettings() {
    try {
      const weight = numberValue(weightKg);

      if (weight <= 0) {
        setMessage("Entre un poids valide.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      const newTargets = calculateNutritionTargets(
        weight,
        nutritionGoal
      );

      const [profileResult, targetsResult] = await Promise.all([
        supabase
          .from("nutrition_profile")
          .upsert(
            {
              user_id: user.id,
              weight_kg: weight,
              goal: nutritionGoal,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          ),

        supabase
          .from("nutrition_targets")
          .upsert(
            {
              user_id: user.id,
              ...newTargets,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          ),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (targetsResult.error) throw targetsResult.error;

      setTargets(newTargets);

      setMessage("Objectifs nutrition recalculés.");
      setShowSettings(false);
    } catch (e: any) {
      setMessage(
        e?.message ?? "Impossible d'enregistrer les réglages."
      );
    }
  }

  function progress(value: number, target: number) {
    if (!target || target <= 0) return 0;
    return Math.min(100, Math.max(0, (value / target) * 100));
  }

  function remaining(value: number, target: number) {
    return round1(Math.max(0, target - value));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.back} onPress={() => router.back()}>
        ← RETOUR
      </Text>

      <ScreenHeader
        eyebrow="EVOLVE TRAINING"
        title="Suivi nutrition"
        subtitle="Tes apports réels de la journée."
      />

      <View style={styles.settingsTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.currentGoalLabel}>OBJECTIF ACTUEL</Text>

          <Text style={styles.currentGoalValue}>
            {nutritionGoal === "mass_gain"
              ? "PRISE DE MASSE"
              : nutritionGoal === "weight_loss"
              ? "PERTE DE POIDS"
              : "MAINTIEN"}
          </Text>
        </View>

        <Pressable
          style={styles.settingsButton}
          onPress={() => setShowSettings((value) => !value)}
        >
          <Text style={styles.settingsButtonText}>
            ⚙ Réglages
          </Text>
        </Pressable>
      </View>

      {showSettings ? (
        <Card style={styles.settingsCard}>
          <Label>Réglages nutrition</Label>

          <Text style={styles.fieldLabel}>Poids actuel</Text>

          <View style={styles.weightRow}>
            <TextInput
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholder="Ex. 82"
              placeholderTextColor={colors.muted}
              style={[styles.input, { flex: 1 }]}
            />

            <Text style={styles.weightUnit}>kg</Text>
          </View>

          <Text style={styles.fieldLabel}>Objectif</Text>

          <View style={styles.goalList}>
            <Pressable
              style={[
                styles.goalButton,
                nutritionGoal === "mass_gain" &&
                  styles.goalButtonActive,
              ]}
              onPress={() => setNutritionGoal("mass_gain")}
            >
              <Text
                style={[
                  styles.goalButtonText,
                  nutritionGoal === "mass_gain" &&
                    styles.goalButtonTextActive,
                ]}
              >
                Prise de masse
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.goalButton,
                nutritionGoal === "maintenance" &&
                  styles.goalButtonActive,
              ]}
              onPress={() => setNutritionGoal("maintenance")}
            >
              <Text
                style={[
                  styles.goalButtonText,
                  nutritionGoal === "maintenance" &&
                    styles.goalButtonTextActive,
                ]}
              >
                Maintien
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.goalButton,
                nutritionGoal === "weight_loss" &&
                  styles.goalButtonActive,
              ]}
              onPress={() => setNutritionGoal("weight_loss")}
            >
              <Text
                style={[
                  styles.goalButtonText,
                  nutritionGoal === "weight_loss" &&
                    styles.goalButtonTextActive,
                ]}
              >
                Perte de poids
              </Text>
            </Pressable>
          </View>

          <PrimaryButton
            label="ENREGISTRER"
            onPress={saveNutritionSettings}
          />
        </Card>
      ) : null}

      <Card style={styles.summaryCard}>
        <Label>Aujourd'hui</Label>

        <View style={styles.dailyRow}>
          <Text style={styles.dailyLabel}>Calories</Text>
          <Text style={styles.dailyValue}>
            {Math.round(totals.calories)} / {Math.round(targets.calories_target)} kcal
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress(totals.calories, targets.calories_target)}%` },
            ]}
          />
        </View>

        <View style={styles.dailyRow}>
          <Text style={styles.dailyLabel}>Protéines</Text>
          <Text style={styles.dailyValue}>
            {round1(totals.protein)} / {round1(targets.protein_target_g)} g
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress(totals.protein, targets.protein_target_g)}%` },
            ]}
          />
        </View>

        <View style={styles.dailyRow}>
          <Text style={styles.dailyLabel}>Glucides</Text>
          <Text style={styles.dailyValue}>
            {round1(totals.carbs)} / {round1(targets.carbs_target_g)} g
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress(totals.carbs, targets.carbs_target_g)}%` },
            ]}
          />
        </View>

        <View style={styles.dailyRow}>
          <Text style={styles.dailyLabel}>Lipides</Text>
          <Text style={styles.dailyValue}>
            {round1(totals.fat)} / {round1(targets.fat_target_g)} g
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress(totals.fat, targets.fat_target_g)}%` },
            ]}
          />
        </View>

        <View style={styles.dailyRow}>
          <Text style={styles.dailyLabel}>Fibres</Text>
          <Text style={styles.dailyValue}>
            {round1(totals.fiber)} / {round1(targets.fiber_target_g)} g
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress(totals.fiber, targets.fiber_target_g)}%` },
            ]}
          />
        </View>
      </Card>

      <View style={styles.actionRow}>
        <View style={styles.actionActive}>
          <Text style={styles.actionIcon}>＋</Text>
          <Text style={styles.actionTitle}>Ajouter un aliment</Text>
        </View>

        <Pressable
          style={styles.actionCard}
          onPress={async () => {
            if (!cameraPermission?.granted) {
              const result = await requestCameraPermission();

              if (!result.granted) {
                setMessage(
                  "Autorise l'accès à la caméra pour scanner un produit."
                );
                return;
              }
            }

            setScannerLocked(false);
            setShowScanner(true);
            setMessage("");
          }}
        >
          <Text style={styles.actionIcon}>▣</Text>
          <Text style={styles.actionTitle}>Scanner un produit</Text>
        </Pressable>
      </View>

      {showScanner ? (
        <Card style={styles.scannerCard}>
          <View style={styles.scannerHeader}>
            <View style={{ flex: 1 }}>
              <Label>Scanner un produit</Label>
              <Text style={styles.scannerHelp}>
                Place le code-barres dans le cadre.
              </Text>
            </View>

            <Pressable
              style={styles.scannerClose}
              onPress={() => {
                setShowScanner(false);
                setScannerLocked(false);
              }}
            >
              <Text style={styles.scannerCloseText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.cameraFrame}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={
                scannerLocked ? undefined : handleBarcodeScanned
              }
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                ],
              }}
            />

            <View pointerEvents="none" style={styles.scanTarget} />
          </View>

          <Text style={styles.scannerStatus}>
            {scanningProduct
              ? "Recherche du produit..."
              : "EAN / UPC"}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.formCard}>
        <Label>Ajouter un aliment</Label>

        <Text style={styles.fieldLabel}>Repas</Text>

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

        <Text style={styles.fieldLabel}>Aliment</Text>

        <TextInput
          value={foodName}
          onChangeText={editFoodName}
          placeholder="Ex. riz, poulet, banane..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
        />

        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((food) => (
              <Pressable
                key={food.code}
                style={styles.suggestionRow}
                onPress={() => chooseFood(food)}
              >
                <Text style={styles.suggestionName}>{food.name}</Text>

                <Text style={styles.suggestionMeta}>
                  {food.kcal100 != null
                    ? `${food.kcal100} kcal / 100 g`
                    : "Valeur énergétique indisponible"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {selectedFood ? (
          <View style={styles.selectedFood}>
            <Text style={styles.selectedLabel}>ALIMENT SÉLECTIONNÉ</Text>
            <Text style={styles.selectedName}>{selectedFood.name}</Text>
            <Text style={styles.selectedSource}>Source : Ciqual 2025</Text>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>Quantité consommée</Text>

        <View style={styles.gramsRow}>
          <TextInput
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
            placeholder="Ex. 150"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={styles.gramsUnit}>g</Text>
        </View>

        {selectedFood && numberValue(grams) > 0 ? (
          <View style={styles.calculationCard}>
            <Text style={styles.calculationLabel}>
              POUR {numberValue(grams)} G
            </Text>

            <Text style={styles.calculationCalories}>
              {calculated.calories} kcal
            </Text>

            <View style={styles.calculationMacros}>
              <Text style={styles.calculationMacro}>
                Protéines : {calculated.protein} g
              </Text>
              <Text style={styles.calculationMacro}>
                Glucides : {calculated.carbs} g
              </Text>
              <Text style={styles.calculationMacro}>
                Lipides : {calculated.fat} g
              </Text>
              <Text style={styles.calculationMacro}>
                Fibres : {calculated.fiber} g
              </Text>
            </View>
          </View>
        ) : null}

        <PrimaryButton
          label={saving ? "ENREGISTREMENT..." : "AJOUTER L'ALIMENT"}
          onPress={saveEntry}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      <Text style={styles.sectionTitle}>REPAS DE LA JOURNÉE</Text>

      {meals.map((meal) => {
        const mealEntries = entries.filter(
          (entry) => entry.meal_type === meal.key
        );

        if (!mealEntries.length) return null;

        const mealCalories = mealEntries.reduce(
          (sum, entry) => sum + Number(entry.calories ?? 0),
          0
        );

        return (
          <Card key={meal.key} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <Label>{meal.label}</Label>
              <Text style={styles.mealCalories}>
                {Math.round(mealCalories)} kcal
              </Text>
            </View>

            {mealEntries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>{entry.food_name}</Text>

                  <Text style={styles.entryMeta}>
                    {entry.grams} g • {Math.round(entry.calories)} kcal
                  </Text>

                  <View style={styles.entryMacroList}>
                    <Text style={styles.entryMacros}>
                      Protéines : {round1(entry.protein_g)} g
                    </Text>

                    <Text style={styles.entryMacros}>
                      Glucides : {round1(entry.carbs_g)} g
                    </Text>

                    <Text style={styles.entryMacros}>
                      Lipides : {round1(entry.fat_g)} g
                    </Text>

                    <Text style={styles.entryMacros}>
                      Fibres : {round1(entry.fiber_g)} g
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => removeEntry(entry.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>×</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        );
      })}

      {!entries.length ? (
        <Card>
          <Text style={styles.empty}>
            Aucun aliment enregistré aujourd'hui.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 120,
    backgroundColor: "transparent",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  back: {
    color: colors.yellow,
    fontWeight: "900",
    marginBottom: 18,
  },
  summaryCard: {
    marginBottom: 18,
  },

  settingsTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  currentGoalLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  currentGoalValue: {
    color: colors.yellow,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },

  settingsButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },

  settingsButtonText: {
    color: colors.text,
    fontWeight: "900",
  },

  settingsCard: {
    gap: 10,
    marginBottom: 18,
  },

  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  weightUnit: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  goalList: {
    gap: 8,
  },

  goalButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: 14,
    padding: 14,
  },

  goalButtonActive: {
    borderColor: colors.yellow,
    backgroundColor: "#191500",
  },

  goalButtonText: {
    color: colors.muted,
    fontWeight: "800",
  },

  goalButtonTextActive: {
    color: colors.yellow,
  },

  dailyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },

  dailyLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  dailyValue: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
  },

  progressTrack: {
    height: 10,
    backgroundColor: colors.surface2,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.yellow,
    borderRadius: 999,
  },

  remainingText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
    textAlign: "right",
  },
  calories: {
    color: colors.yellow,
    fontSize: 42,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 18,
  },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  macroBox: {
    width: "48%",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  macroValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  macroLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  actionCard: {
    flex: 1,
    minHeight: 115,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  actionActive: {
    flex: 1,
    minHeight: 115,
    backgroundColor: "#191500",
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 18,
    padding: 16,
  },
  actionIcon: {
    color: colors.yellow,
    fontSize: 24,
    fontWeight: "900",
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
  },
  coming: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 6,
  },
  scannerCard: {
    marginBottom: 18,
    overflow: "hidden",
  },

  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  scannerHelp: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },

  scannerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  scannerCloseText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },

  cameraFrame: {
    height: 280,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  scanTarget: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "32%",
    bottom: "32%",
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 14,
  },

  scannerStatus: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
  },

  formCard: {
    gap: 10,
    marginBottom: 24,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  mealRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mealButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mealButtonActive: {
    borderColor: colors.yellow,
    backgroundColor: "#191500",
  },
  mealText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  mealTextActive: {
    color: colors.yellow,
  },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface2,
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionName: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 14,
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  selectedFood: {
    backgroundColor: "#191500",
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 14,
    padding: 14,
  },
  selectedLabel: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  selectedName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 6,
  },
  selectedSource: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  gramsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gramsUnit: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  calculationCard: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  calculationLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  calculationCalories: {
    color: colors.yellow,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  calculationMacros: {
    gap: 8,
    marginTop: 12,
  },
  calculationMacro: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  message: {
    color: colors.yellow,
    textAlign: "center",
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    letterSpacing: 1,
  },
  mealCard: {
    marginBottom: 14,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealCalories: {
    color: colors.yellow,
    fontWeight: "900",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  entryMeta: {
    color: colors.muted,
    marginTop: 4,
  },
  entryMacroList: {
    gap: 3,
    marginTop: 7,
  },
  entryMacros: {
    color: colors.yellow,
    fontSize: 12,
    marginTop: 5,
    fontWeight: "800",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  deleteText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  empty: {
    color: colors.muted,
    textAlign: "center",
  },
});
