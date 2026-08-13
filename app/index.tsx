import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/store/auth";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}><ActivityIndicator /></View>;
  return <Redirect href={session ? "/(tabs)" : "/login"} />;
}
