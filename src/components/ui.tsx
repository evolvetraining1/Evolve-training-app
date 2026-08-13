import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius } from "@/src/theme";

export function ScreenHeader({
  eyebrow = "EVOLVE TRAINING",
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 5, marginBottom: 22 }}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Metric({
  value,
  label,
  accent = colors.text,
}: {
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={[styles.metric, { color: accent }]}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && { opacity: 0.45 },
        pressed && !disabled && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.yellow,
    fontWeight: "900",
    letterSpacing: 1.2,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
  },
  label: {
    color: colors.muted,
    textTransform: "uppercase",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  metric: {
    fontSize: 22,
    fontWeight: "900",
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
