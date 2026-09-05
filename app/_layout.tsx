import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, ImageBackground, Platform, StyleSheet } from "react-native";
import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";
import { SessionProvider } from "@/src/store/session";
import { AuthProvider } from "@/src/store/auth";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const hideNavigationBar = () => {
      void NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    };

    hideNavigationBar();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        hideNavigationBar();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ImageBackground
        source={require("../assets/evolve-concrete-dark.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <AuthProvider>
          <SessionProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="workout" />
              <Stack.Screen name="program" />
              <Stack.Screen name="program-workout" />
              <Stack.Screen name="nutrition" />
              <Stack.Screen name="messaging" />
              <Stack.Screen name="rm-calculator" />
              <Stack.Screen name="coach" />
              <Stack.Screen name="coach-workout" />
              <Stack.Screen name="invite" />
            </Stack>
          </SessionProvider>
        </AuthProvider>
      </ImageBackground>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
});
