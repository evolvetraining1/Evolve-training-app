import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ProfileAvatar } from "@/src/components/profile-avatar";
import { Card, Label, PrimaryButton, ScreenHeader } from "@/src/components/ui";
import { getMyProfile } from "@/src/lib/api";
import {
  ProfileGender,
  updateMyProfile,
  uploadMyAvatar,
} from "@/src/lib/profile";
import { colors, radius } from "@/src/theme";

type NumberField = "age" | "height" | "weight";

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<ProfileGender>("unspecified");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const fullName = useMemo(
    () => [firstName, lastName].filter(Boolean).join(" ") || "Athlète",
    [firstName, lastName]
  );

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((profile) => {
        if (!active) return;
        setFirstName(profile?.first_name ?? "");
        setLastName(profile?.last_name ?? "");
        setGender((profile?.gender as ProfileGender) ?? "unspecified");
        setAge(profile?.age_years != null ? String(profile.age_years) : "");
        setHeight(profile?.height_cm != null ? String(profile.height_cm) : "");
        setWeight(profile?.weight_kg != null ? String(profile.weight_kg) : "");
        setAvatarUrl(profile?.avatar_url ?? null);
      })
      .catch((error: any) =>
        setMessage(error?.message ?? "Impossible de charger le profil.")
      )
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function chooseAvatar() {
    try {
      setMessage("");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("Autorise l'accès aux photos pour choisir une photo de profil.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.72,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setPendingAvatar(result.assets[0]);
      }
    } catch (error: any) {
      setMessage(error?.message ?? "Impossible de sélectionner cette photo.");
    }
  }

  function validatedNumber(
    field: NumberField,
    value: string,
    min: number,
    max: number
  ) {
    const parsed = optionalNumber(value);
    if (parsed === null) return null;

    const labels: Record<NumberField, string> = {
      age: "L'âge",
      height: "La taille",
      weight: "Le poids",
    };

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new Error(`${labels[field]} doit être compris entre ${min} et ${max}.`);
    }

    return parsed;
  }

  async function save() {
    if (saving) return;

    try {
      setSaving(true);
      setMessage("");

      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();
      if (!cleanFirstName) throw new Error("Renseigne au moins ton prénom.");
      if (cleanFirstName.length > 80 || cleanLastName.length > 80) {
        throw new Error("Le prénom et le nom sont limités à 80 caractères.");
      }

      const ageYears = validatedNumber("age", age, 13, 100);
      const heightCm = validatedNumber("height", height, 100, 250);
      const weightKg = validatedNumber("weight", weight, 30, 350);
      const nextAvatarUrl = pendingAvatar
        ? await uploadMyAvatar(pendingAvatar)
        : avatarUrl;

      await updateMyProfile({
        first_name: cleanFirstName,
        last_name: cleanLastName,
        gender,
        age_years: ageYears == null ? null : Math.round(ageYears),
        height_cm: heightCm,
        weight_kg: weightKg,
        avatar_url: nextAvatarUrl,
      });

      setAvatarUrl(nextAvatarUrl);
      setPendingAvatar(null);
      setMessage("Profil enregistré ✓");
    } catch (error: any) {
      setMessage(error?.message ?? "Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ PROFIL</Text>
        </Pressable>

        <ScreenHeader
          title="Modifier mon profil"
          subtitle="Ces informations personnalisent ton suivi et restent modifiables à tout moment."
        />

        <Card style={styles.avatarCard}>
          <ProfileAvatar
            name={fullName}
            uri={pendingAvatar?.uri ?? avatarUrl}
            size={96}
          />
          <View style={styles.avatarInfo}>
            <Label>Photo de profil</Label>
            <Text style={styles.help}>Visible par ton coach et dans la messagerie.</Text>
            <Pressable onPress={chooseAvatar} style={styles.photoButton}>
              <Text style={styles.photoButtonText}>
                {pendingAvatar || avatarUrl ? "CHANGER LA PHOTO" : "AJOUTER UNE PHOTO"}
              </Text>
            </Pressable>
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Field label="Prénom" value={firstName} onChangeText={setFirstName} />
          <Field label="Nom" value={lastName} onChangeText={setLastName} />

          <Label>Sexe</Label>
          <View style={styles.genderRow}>
            {[
              { key: "male", label: "Homme" },
              { key: "female", label: "Femme" },
              { key: "unspecified", label: "Non précisé" },
            ].map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setGender(item.key as ProfileGender)}
                style={[
                  styles.genderButton,
                  gender === item.key && styles.genderButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === item.key && styles.genderTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.measureRow}>
            <Field
              compact
              label="Âge"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              suffix="ans"
            />
            <Field
              compact
              label="Taille"
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              suffix="cm"
            />
            <Field
              compact
              label="Poids"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              suffix="kg"
            />
          </View>
        </Card>

        {message ? (
          <Text
            selectable
            style={message.includes("✓") ? styles.success : styles.error}
          >
            {message}
          </Text>
        ) : null}

        <PrimaryButton
          label={saving ? "ENREGISTREMENT..." : "ENREGISTRER"}
          onPress={save}
          disabled={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  suffix,
  compact = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.compactField : styles.field}>
      <Label>{label}</Label>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder="—"
          placeholderTextColor={colors.muted2}
          style={styles.input}
          maxLength={keyboardType === "default" ? 80 : 6}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { padding: 20, paddingTop: 58, paddingBottom: 80, gap: 14 },
  backButton: { alignSelf: "flex-start", paddingVertical: 6 },
  backText: { color: colors.yellow, fontSize: 13, fontWeight: "900" },
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarInfo: { flex: 1, gap: 6 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  photoButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 3,
  },
  photoButtonText: { color: colors.yellow, fontSize: 10, fontWeight: "900" },
  formCard: { gap: 17 },
  field: { gap: 7 },
  compactField: { flex: 1, gap: 7 },
  inputWrap: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" },
  suffix: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  genderRow: { flexDirection: "row", gap: 7 },
  genderButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  genderButtonActive: { borderColor: colors.yellow, backgroundColor: "#201A00" },
  genderText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  genderTextActive: { color: colors.yellow },
  measureRow: { flexDirection: "row", gap: 8 },
  success: { color: colors.green, textAlign: "center", fontWeight: "800" },
  error: { color: colors.red, textAlign: "center", fontWeight: "700" },
});
