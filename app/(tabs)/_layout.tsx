import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/store/auth";

const icon = (symbol: string, color: string) => (
  <Text style={{ color, fontSize: 22, fontWeight: "900" }}>{symbol}</Text>
);

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
        }}
      >
        <ActivityIndicator color={colors.yellow} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0B",
          borderTopColor: colors.border,
          height: 70 + bottomPadding,
          paddingTop: 7,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarActiveTintColor: colors.yellow,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => icon("⌂", String(color)),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Bibliothèque",
          tabBarIcon: ({ color }) => icon("⌘", String(color)),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: "Programme",
          tabBarIcon: ({ color }) => icon("▣", String(color)),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => icon("▥", String(color)),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => icon("♙", String(color)),
        }}
      />
      <Tabs.Screen name="journal" options={{ href: null }} />
    </Tabs>
  );
}
