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

        <View style={styles.textBlock}>
          <Text style={styles.brandMain}>EVOLVE</Text>
          <Text style={styles.brandSub}>TRAINING</Text>
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
    width: 260,
    height: 210,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 18,
  },

  logo: {
    width: 135,
    height: 120,
  },

  logoCompact: {
    width: 145,
    height: 120,
  },

  textBlock: {
    alignItems: "center",
    marginTop: -4,
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
});
