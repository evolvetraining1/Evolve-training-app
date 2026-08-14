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

import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";

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

const meals: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Petit-déjeuner" },
  { key: "lunch", label: "Déjeuner" },
  { key: "dinner", label: "Dîner" },
  { key: "snack", label: "Collation" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
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

      const { data, error } = await supabase
        .from("nutrition_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("eaten_on", today())
        .order("created_at", { ascending: true });

      if (error) throw error;

      setEntries((data ?? []) as NutritionEntry[]);
    } catch (e: any) {
      setMessage(e?.message ?? "Impossible de charger le suivi nutrition.");
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
        source: "ciqual_2025",
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

      <Card style={styles.summaryCard}>
        <Label>Aujourd'hui</Label>

        <Text style={styles.calories}>
          {Math.round(totals.calories)} kcal
        </Text>

        <View style={styles.macroGrid}>
          <View style={styles.macroBox}>
            <Text style={styles.macroValue}>{round1(totals.protein)} g</Text>
            <Text style={styles.macroLabel}>Protéines</Text>
          </View>

          <View style={styles.macroBox}>
            <Text style={styles.macroValue}>{round1(totals.carbs)} g</Text>
            <Text style={styles.macroLabel}>Glucides</Text>
          </View>

          <View style={styles.macroBox}>
            <Text style={styles.macroValue}>{round1(totals.fat)} g</Text>
            <Text style={styles.macroLabel}>Lipides</Text>
          </View>

          <View style={styles.macroBox}>
            <Text style={styles.macroValue}>{round1(totals.fiber)} g</Text>
            <Text style={styles.macroLabel}>Fibres</Text>
          </View>
        </View>
      </Card>

      <View style={styles.actionRow}>
        <View style={styles.actionActive}>
          <Text style={styles.actionIcon}>＋</Text>
          <Text style={styles.actionTitle}>Ajouter un aliment</Text>
        </View>

        <Pressable
          style={styles.actionCard}
          onPress={() => setMessage("Scanner produit : prochaine étape.")}
        >
          <Text style={styles.actionIcon}>▣</Text>
          <Text style={styles.actionTitle}>Scanner un produit</Text>
          <Text style={styles.coming}>BIENTÔT</Text>
        </Pressable>
      </View>

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
                P {calculated.protein} g
              </Text>
              <Text style={styles.calculationMacro}>
                G {calculated.carbs} g
              </Text>
              <Text style={styles.calculationMacro}>
                L {calculated.fat} g
              </Text>
              <Text style={styles.calculationMacro}>
                F {calculated.fiber} g
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

                  <Text style={styles.entryMacros}>
                    P {round1(entry.protein_g)} • G {round1(entry.carbs_g)} • L{" "}
                    {round1(entry.fat_g)} • F {round1(entry.fiber_g)}
                  </Text>
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  calculationMacro: {
    color: colors.text,
    fontSize: 13,
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
