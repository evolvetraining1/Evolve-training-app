import { Image, StyleSheet, View } from "react-native";

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.compact}>
        <Image
          source={require("@/assets/evolve-logo-header.png")}
          resizeMode="contain"
          style={styles.logoCompact}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Image
        source={require("@/assets/evolve-logo-header.png")}
        resizeMode="contain"
        style={styles.logo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },

  compact: {
    width: 142,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 190,
    height: 178,
  },

  logoCompact: {
    width: 130,
    height: 122,
  },
});
