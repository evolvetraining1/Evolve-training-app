import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";


import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { localDateString } from "@/src/lib/date";
import { normalizeFoodText, searchFoods, type SearchableFood } from "@/src/lib/food-search";
import { searchOpenFoodFactsProducts } from "@/src/lib/open-food-facts-search";

const ciqualFoods = require("../src/data/ciqual-foods.json");

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type CiqualFood = SearchableFood;

type CommunityProduct = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
  fiber100: number | null;
  serving_size_g: number | null;
  source: string;
  label_image_path: string | null;
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
  const [remoteFoods, setRemoteFoods] = useState<CiqualFood[]>([]);
  const [communityFoods, setCommunityFoods] = useState<CiqualFood[]>([]);
  const remoteSearchCache = useRef(new Map<string, CiqualFood[]>());

  const [showCustomProduct, setShowCustomProduct] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState("");
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customFiber, setCustomFiber] = useState("");
  const [customServing, setCustomServing] = useState("");
  const [customLabelPhoto, setCustomLabelPhoto] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [savingCustomProduct, setSavingCustomProduct] = useState(false);

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
        communityProductsResult,
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

        supabase
          .from("nutrition_products")
          .select("id, barcode, name, brand, kcal100, protein100, carbs100, fat100, fiber100, serving_size_g, source, label_image_path")
          .order("created_at", { ascending: false })
          .limit(500),
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

      if (communityProductsResult.error) {
        console.warn("COMMUNITY PRODUCTS LOAD", communityProductsResult.error);
      } else {
        setCommunityFoods(
          ((communityProductsResult.data ?? []) as CommunityProduct[]).map(
            (product) => ({
              code: product.barcode ?? product.id,
              name: product.brand
                ? `${product.name} — ${product.brand}`
                : product.name,
              kcal100:
                product.kcal100 != null ? Number(product.kcal100) : null,
              protein100:
                product.protein100 != null ? Number(product.protein100) : null,
              carbs100:
                product.carbs100 != null ? Number(product.carbs100) : null,
              fat100:
                product.fat100 != null ? Number(product.fat100) : null,
              fiber100:
                product.fiber100 != null ? Number(product.fiber100) : null,
              source: "evolve_community",
            })
          )
        );
      }
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

  useEffect(() => {
    const query = foodName.trim();

    if (selectedFood || query.length < 3) {
      setRemoteFoods([]);
      return;
    }

    let cancelled = false;

    const normalizedQuery = normalizeFoodText(query);
    const cached = remoteSearchCache.current.get(normalizedQuery);

    if (cached) {
      setRemoteFoods(cached);
      return;
    }

    const timeout = setTimeout(() => {
      void searchOpenFoodFactsProducts(query, 12)
        .then((results) => {
          remoteSearchCache.current.set(normalizedQuery, results);
          if (!cancelled) setRemoteFoods(results);
        })
        .catch(() => {
          if (!cancelled) setRemoteFoods([]);
        });
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [foodName, selectedFood]);

  const suggestions = useMemo(() => {
    if (selectedFood) return [];

    const query = foodName.trim();
    if (normalizeFoodText(query).length < 2) return [];

    const local = searchFoods(
      ciqualFoods as CiqualFood[],
      query,
      12
    );

    const community = searchFoods(communityFoods, query, 10);
    const remote = searchFoods(remoteFoods, query, 8);
    const seen = new Set<string>();

    return [...community, ...local, ...remote]
      .filter((food) => {
        const key = normalizeFoodText(food.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 16);
  }, [foodName, selectedFood, remoteFoods, communityFoods]);

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

  function resetCustomProduct() {
    setShowCustomProduct(false);
    setPendingBarcode("");
    setCustomName("");
    setCustomBrand("");
    setCustomKcal("");
    setCustomProtein("");
    setCustomCarbs("");
    setCustomFat("");
    setCustomFiber("");
    setCustomServing("");
    setCustomLabelPhoto(null);
  }

  function openCustomProduct(barcode: string) {
    setShowScanner(false);
    setScannerLocked(false);
    setPendingBarcode(barcode);
    setShowCustomProduct(true);
    setSelectedFood(null);
    setFoodName("");
    setMessage("Produit inconnu : crée-le une fois, Evolve le reconnaîtra ensuite.");
  }

  function productRowToFood(product: CommunityProduct): CiqualFood {
    return {
      code: product.barcode ?? product.id,
      name: product.brand
        ? `${product.name} — ${product.brand}`
        : product.name,
      kcal100: product.kcal100 != null ? Number(product.kcal100) : null,
      protein100:
        product.protein100 != null ? Number(product.protein100) : null,
      carbs100: product.carbs100 != null ? Number(product.carbs100) : null,
      fat100: product.fat100 != null ? Number(product.fat100) : null,
      fiber100: product.fiber100 != null ? Number(product.fiber100) : null,
      source: "evolve_community",
    };
  }

  async function takeNutritionLabelPhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setMessage("Autorise l'accès à la caméra pour photographier l'étiquette.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets?.length) return;

      setCustomLabelPhoto(result.assets[0]);
      setMessage("Photo de l'étiquette ajoutée.");
    } catch (e: any) {
      setMessage(e?.message ?? "Impossible de prendre la photo.");
    }
  }

  async function saveCustomProduct() {
    try {
      setMessage("");

      const name = customName.trim();
      if (!name) {
        setMessage("Indique le nom du produit.");
        return;
      }

      const kcal = numberValue(customKcal);
      const protein = numberValue(customProtein);
      const carbs = numberValue(customCarbs);
      const fat = numberValue(customFat);
      const fiber = customFiber.trim() ? numberValue(customFiber) : 0;
      const serving = customServing.trim() ? numberValue(customServing) : null;

      if (
        kcal < 0 ||
        protein < 0 ||
        carbs < 0 ||
        fat < 0 ||
        fiber < 0 ||
        (serving != null && serving <= 0)
      ) {
        setMessage("Vérifie les valeurs nutritionnelles.");
        return;
      }

      setSavingCustomProduct(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      let labelImagePath: string | null = null;

      if (customLabelPhoto?.uri) {
        const arrayBuffer = await fetch(customLabelPhoto.uri).then((res) =>
          res.arrayBuffer()
        );
        const extension =
          customLabelPhoto.fileName?.split(".").pop()?.toLowerCase() ??
          customLabelPhoto.uri.split(".").pop()?.toLowerCase() ??
          "jpg";
        const safeBarcode = pendingBarcode || `manual-${Date.now()}`;
        const path = `${user.id}/${safeBarcode}-${Date.now()}.${extension}`;

        const { data: uploaded, error: uploadError } = await supabase.storage
          .from("nutrition-labels")
          .upload(path, arrayBuffer, {
            contentType: customLabelPhoto.mimeType ?? "image/jpeg",
          });

        if (uploadError) throw uploadError;
        labelImagePath = uploaded.path;
      }

      const payload = {
        barcode: pendingBarcode || null,
        name,
        brand: customBrand.trim() || null,
        kcal100: kcal,
        protein100: protein,
        carbs100: carbs,
        fat100: fat,
        fiber100: fiber,
        serving_size_g: serving,
        source: "evolve_community",
        label_image_path: labelImagePath,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabase
        .from("nutrition_products")
        .insert(payload)
        .select("id, barcode, name, brand, kcal100, protein100, carbs100, fat100, fiber100, serving_size_g, source, label_image_path")
        .single();

      if (error) {
        if (error.code === "23505" && pendingBarcode) {
          const { data: existing, error: existingError } = await supabase
            .from("nutrition_products")
            .select("id, barcode, name, brand, kcal100, protein100, carbs100, fat100, fiber100, serving_size_g, source, label_image_path")
            .eq("barcode", pendingBarcode)
            .single();

          if (existingError) throw existingError;
          const food = productRowToFood(existing as CommunityProduct);
          setSelectedFood(food);
          setFoodName(food.name);
          setCommunityFoods((current) => [
            food,
            ...current.filter((item) => item.code !== food.code),
          ]);
        } else {
          throw error;
        }
      } else {
        const food = productRowToFood(created as CommunityProduct);
        setSelectedFood(food);
        setFoodName(food.name);
        setCommunityFoods((current) => [
          food,
          ...current.filter((item) => item.code !== food.code),
        ]);
      }

      resetCustomProduct();
      setMessage("Produit enregistré dans Evolve. Indique maintenant la quantité consommée.");
    } catch (e: any) {
      setMessage(e?.message ?? "Impossible de créer ce produit.");
    } finally {
      setSavingCustomProduct(false);
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

      const { data: communityProduct, error: communityError } = await supabase
        .from("nutrition_products")
        .select("id, barcode, name, brand, kcal100, protein100, carbs100, fat100, fiber100, serving_size_g, source, label_image_path")
        .eq("barcode", data)
        .maybeSingle();

      if (communityError) throw communityError;

      if (communityProduct) {
        const food = productRowToFood(communityProduct as CommunityProduct);
        setSelectedFood(food);
        setFoodName(food.name);
        setShowScanner(false);
        setMessage("Produit Evolve reconnu. Indique la quantité consommée.");
        return;
      }

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          data
        )}.json`,
        {
          headers: {
            "User-Agent": "EvolveTraining/0.8 (barcode-scan)",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de contacter la base produit.");
      }

      const result = await response.json();

      if (!result?.product) {
        openCustomProduct(data);
        return;
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

      const hasNutrition =
        scannedFood.kcal100 != null ||
        scannedFood.protein100 != null ||
        scannedFood.carbs100 != null ||
        scannedFood.fat100 != null;

      if (!hasNutrition) {
        setCustomName(name);
        openCustomProduct(data);
        setCustomName(name);
        return;
      }

      setSelectedFood(scannedFood);
      setFoodName(scannedFood.name);
      setShowScanner(false);
      setMessage("Produit scanné. Indique la quantité consommée.");
    } catch (e: any) {
      if (
        String(e?.message ?? "").includes("Produit introuvable") ||
        String(e?.message ?? "").includes("base produit")
      ) {
        openCustomProduct(data);
      } else {
        setMessage(e?.message ?? "Impossible de lire ce produit.");
        setScannerLocked(false);
      }
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
        source: selectedFood.source,
        barcode:
          selectedFood.source === "open_food_facts" ||
          selectedFood.source === "evolve_community"
            ? selectedFood.code
            : null,
        source_food_id: selectedFood.code,
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

      {showCustomProduct ? (
        <Card style={styles.customProductCard}>
          <Label>Créer ce produit dans Evolve</Label>

          {pendingBarcode ? (
            <Text style={styles.customBarcode}>Code-barres : {pendingBarcode}</Text>
          ) : null}

          <Text style={styles.customHelp}>
            Recopie les valeurs indiquées pour 100 g. La photo de l'étiquette est conservée avec le produit pour la future lecture automatique.
          </Text>

          <Text style={styles.fieldLabel}>Nom du produit</Text>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Ex. Whey isolate vanille"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Marque (facultatif)</Text>
          <TextInput
            value={customBrand}
            onChangeText={setCustomBrand}
            placeholder="Ex. Nutripure"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Pressable
            style={styles.labelPhotoButton}
            onPress={() => void takeNutritionLabelPhoto()}
          >
            <Text style={styles.labelPhotoButtonText}>
              {customLabelPhoto ? "✓ PHOTO ÉTIQUETTE AJOUTÉE" : "📷 PHOTOGRAPHIER LES MACROS"}
            </Text>
          </Pressable>

          {customLabelPhoto?.uri ? (
            <Image
              source={{ uri: customLabelPhoto.uri }}
              style={styles.labelPhotoPreview}
              resizeMode="cover"
            />
          ) : null}

          <Text style={styles.customSectionTitle}>VALEURS POUR 100 G</Text>

          <View style={styles.customMacroGrid}>
            <View style={styles.customMacroField}>
              <Text style={styles.customMacroLabel}>KCAL</Text>
              <TextInput
                value={customKcal}
                onChangeText={setCustomKcal}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.customMacroField}>
              <Text style={styles.customMacroLabel}>PROTÉINES</Text>
              <TextInput
                value={customProtein}
                onChangeText={setCustomProtein}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.customMacroField}>
              <Text style={styles.customMacroLabel}>GLUCIDES</Text>
              <TextInput
                value={customCarbs}
                onChangeText={setCustomCarbs}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.customMacroField}>
              <Text style={styles.customMacroLabel}>LIPIDES</Text>
              <TextInput
                value={customFat}
                onChangeText={setCustomFat}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.customMacroField}>
              <Text style={styles.customMacroLabel}>FIBRES</Text>
              <TextInput
                value={customFiber}
                onChangeText={setCustomFiber}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.customMacroField}>
              <Text style={styles.customMacroLabel}>1 DOSE (G)</Text>
              <TextInput
                value={customServing}
                onChangeText={setCustomServing}
                keyboardType="decimal-pad"
                placeholder="30"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          </View>

          <PrimaryButton
            label={
              savingCustomProduct
                ? "ENREGISTREMENT..."
                : "ENREGISTRER LE PRODUIT"
            }
            onPress={() => void saveCustomProduct()}
          />

          <Pressable onPress={resetCustomProduct} style={styles.customCancel}>
            <Text style={styles.customCancelText}>ANNULER</Text>
          </Pressable>
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
                key={`${food.source}-${food.code}-${food.name}`}
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
            <Text style={styles.selectedSource}>
              Source : {selectedFood.source === "open_food_facts"
                ? "Open Food Facts"
                : "Ciqual 2025"}
            </Text>
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

  customProductCard: {
    gap: 10,
    marginBottom: 18,
  },
  customBarcode: {
    color: colors.yellow,
    fontWeight: "900",
    marginTop: 4,
  },
  customHelp: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  labelPhotoButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.yellow,
    backgroundColor: "#191500",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 8,
  },
  labelPhotoButtonText: {
    color: colors.yellow,
    fontWeight: "900",
    textAlign: "center",
  },
  labelPhotoPreview: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: colors.surface2,
  },
  customSectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 8,
  },
  customMacroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  customMacroField: {
    width: "48%",
    gap: 5,
  },
  customMacroLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },
  customCancel: {
    alignItems: "center",
    paddingVertical: 10,
  },
  customCancelText: {
    color: colors.muted,
    fontWeight: "900",
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
