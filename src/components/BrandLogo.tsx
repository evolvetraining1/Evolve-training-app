import { Image, StyleSheet, Text, View } from "react-native";

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.compact}>
        <Image
          source={require("@/assets/evolve-logo-header.png")}
          resizeMode="contain"
          style={styles.logoCompact}
        />

        <View style={styles.textBlockCompact}>
          <Text style={styles.brandMainCompact}>EVOLVE</Text>
          <Text style={styles.brandSubCompact}>TRAINING</Text>
        </View>
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

      <View style={styles.textBlock}>
        <Text style={styles.brandMain}>EVOLVE</Text>
        <Text style={styles.brandSub}>TRAINING</Text>
      </View>
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
    width: 132,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  logo: {
    width: 135,
    height: 120,
  },

  logoCompact: {
    width: 58,
    height: 40,
  },

  textBlock: {
    alignItems: "center",
    marginTop: -4,
  },

  textBlockCompact: {
    alignItems: "center",
    marginTop: -3,
  },

  brandMain: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: 6,
    lineHeight: 27,
  },

  brandSub: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 5,
    lineHeight: 18,
  },

  brandMainCompact: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    lineHeight: 11,
  },

  brandSubCompact: {
    color: "#FFFFFF",
    fontSize: 6,
    fontWeight: "700",
    letterSpacing: 1.8,
    lineHeight: 8,
  },
});
