import { Image, StyleSheet, View } from "react-native";
export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <View style={[styles.wrap, compact && styles.compact]}><Image source={require("@/assets/evolve-logo.jpg")} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} /></View>;
}
const styles = StyleSheet.create({ wrap:{width:"100%",height:150,alignItems:"center",justifyContent:"center",overflow:"hidden"}, compact:{height:86,width:155,alignItems:"flex-start"}, logo:{width:240,height:240}, logoCompact:{width:150,height:150} });
