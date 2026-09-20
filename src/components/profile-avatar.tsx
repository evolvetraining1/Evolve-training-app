import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme";

type Props = {
  name?: string | null;
  uri?: string | null;
  size?: number;
};

function initials(name?: string | null) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "A";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function ProfileAvatar({ name, uri, size = 52 }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const radius = Math.min(18, size / 2);

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(15, size * 0.34) }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.yellow,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.yellow,
    fontWeight: "900",
  },
});
