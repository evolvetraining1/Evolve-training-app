import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/store/auth";

const icon = (symbol: string, color: string) => <Text style={{ color, fontSize: 18 }}>{symbol}</Text>;

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: "#101012", borderTopColor: colors.border, height: 68, paddingTop: 8 },
      tabBarActiveTintColor: colors.yellow,
      tabBarInactiveTintColor: colors.muted,
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color }) => icon("⌂", color) }} />
      <Tabs.Screen name="training" options={{ title: "Entraînement", tabBarIcon: ({ color }) => icon("◆", color) }} />
      <Tabs.Screen name="journal" options={{ title: "Journal", tabBarIcon: ({ color }) => icon("☷", color) }} />
      <Tabs.Screen name="stats" options={{ title: "Stats", tabBarIcon: ({ color }) => icon("↗", color) }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => icon("●", color) }} />
    </Tabs>
  );
}
