import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type PedometerProbe = {
  available: boolean;
  permission: "granted" | "denied" | "undetermined";
  todaySteps: number | null;
  error?: string;
};

export async function probePedometer(
  onSteps?: (steps: number) => void
): Promise<PedometerProbe> {
  try {
    if (!requireOptionalNativeModule("ExponentPedometer")) {
      return {
        available: false,
        permission: "undetermined",
        todaySteps: null,
        error: "Module natif podomètre absent de cette version de l’application.",
      };
    }

    const { Pedometer } = await import("expo-sensors");

    const available = await Pedometer.isAvailableAsync();

    if (!available) {
      return {
        available: false,
        permission: "undetermined",
        todaySteps: null,
      };
    }

    const permissionResponse = await Pedometer.requestPermissionsAsync();

    if (!permissionResponse.granted) {
      return {
        available: true,
        permission: "denied",
        todaySteps: null,
      };
    }

    if (Platform.OS === "android") {
      Pedometer.watchStepCount((result) => {
        onSteps?.(result.steps);
      });

      return {
        available: true,
        permission: "granted",
        todaySteps: 0,
      };
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const result = await Pedometer.getStepCountAsync(start, new Date());

    return {
      available: true,
      permission: "granted",
      todaySteps: result.steps,
    };
  } catch (error) {
    return {
      available: false,
      permission: "undetermined",
      todaySteps: null,
      error: error instanceof Error ? error.message : "Unknown pedometer error",
    };
  }
}
