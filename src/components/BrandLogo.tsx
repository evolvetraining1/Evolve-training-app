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

        <Text style={styles.brandMain}>EVOLVE</Text>
        <Text style={styles.brandSub}>TRAINING</Text>
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

      <Text style={styles.brandMain}>EVOLVE</Text>
      <Text style={styles.brandSub}>TRAINING</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },

  compact: {
    height: 190,
    width: 260,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  logo: {
    width: 130,
    height: 115,
  },

  logoCompact: {
    width: 145,
    height: 120,
  },

  brandMain: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 7,
    lineHeight: 30,
  },

  brandSub: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 6,
    lineHeight: 20,
  },
});
