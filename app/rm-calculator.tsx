import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Card, Label, ScreenHeader } from "@/src/components/ui";
import { colors } from "@/src/theme";

function estimateOneRepMax(load: number, reps: number) {
  if (!load || !reps || reps < 1) return 0;

  if (reps === 1) return load;

  return load * (1 + reps / 30);
}

function estimateLoadForReps(oneRm: number, reps: number) {
  if (!oneRm || !reps || reps < 1) return 0;

  if (reps === 1) return oneRm;

  return oneRm / (1 + reps / 30);
}

function confidenceLabel(reps: number) {
  if (!reps) return "—";
  if (reps <= 5) return "Élevée";
  if (reps <= 10) return "Bonne";
  if (reps <= 15) return "Indicative";
  return "Faible";
}

export default function RmCalculatorScreen() {
  const [loadText, setLoadText] = useState("");
  const [repsText, setRepsText] = useState("");

  const load = Number(loadText.replace(",", "."));
  const reps = Number(repsText);

  const oneRm = useMemo(
    () => estimateOneRepMax(load, reps),
    [load, reps]
  );

  const targets = [2, 3, 5, 8, 10, 12];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader
        eyebrow="OUTILS"
        title="Calculateur RM"
        subtitle="Estime ton 1RM à partir d'une charge et d'un nombre de répétitions."
      />

      <Card style={styles.section}>
        <Label>Performance réalisée</Label>

        <Text style={styles.fieldLabel}>Charge utilisée</Text>
        <TextInput
          value={loadText}
          onChangeText={setLoadText}
          keyboardType="decimal-pad"
          placeholder="Ex. 100"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.unit}>kg</Text>

        <Text style={styles.fieldLabel}>Répétitions</Text>
        <TextInput
          value={repsText}
          onChangeText={setRepsText}
          keyboardType="number-pad"
          placeholder="Ex. 5"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </Card>

      <Card style={styles.resultCard}>
        <Label>1RM estimé</Label>

        <Text style={styles.oneRm}>
          {oneRm > 0 ? `${oneRm.toFixed(1)} kg` : "—"}
        </Text>

        <Text style={styles.confidence}>
          Fiabilité : {confidenceLabel(reps)}
        </Text>

        <Text style={styles.note}>
          Formule d'Epley. Plus le nombre de répétitions est élevé,
          plus l'estimation devient approximative.
        </Text>
      </Card>

      <Card style={styles.section}>
        <Label>Charges théoriques</Label>

        {targets.map((targetReps) => {
          const estimated = estimateLoadForReps(oneRm, targetReps);

          return (
            <View key={targetReps} style={styles.rmRow}>
              <Text style={styles.rmLabel}>{targetReps}RM</Text>

              <Text style={styles.rmValue}>
                {estimated > 0 ? `${estimated.toFixed(1)} kg` : "—"}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card style={styles.section}>
        <Label>Repères</Label>

        <Text style={styles.referenceText}>
          1–5 reps : estimation généralement la plus fiable
        </Text>

        <Text style={styles.referenceText}>
          6–10 reps : bonne estimation
        </Text>

        <Text style={styles.referenceText}>
          11–15 reps : résultat indicatif
        </Text>

        <Text style={styles.referenceText}>
          Plus de 15 reps : forte variabilité individuelle
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 70,
    paddingBottom: 100,
    backgroundColor: "transparent",
    gap: 14,
  },

  section: {
    gap: 12,
  },

  fieldLabel: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 8,
  },

  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    padding: 16,
    fontSize: 22,
    fontWeight: "800",
  },

  unit: {
    color: colors.muted,
    fontSize: 14,
    marginTop: -8,
  },

  resultCard: {
    alignItems: "center",
  },

  oneRm: {
    color: colors.yellow,
    fontSize: 48,
    fontWeight: "900",
    marginTop: 12,
  },

  confidence: {
    color: colors.green,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },

  note: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 20,
  },

  rmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  rmLabel: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },

  rmValue: {
    color: colors.yellow,
    fontSize: 20,
    fontWeight: "900",
  },

  referenceText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
