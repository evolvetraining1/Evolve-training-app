import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import { getTodaySteps, saveTodaySteps, syncAndroidRawSteps } from "./steps-storage";
import EvolveStepCounterModule from "../../modules/evolve-step-counter/src/EvolveStepCounterModule";

let pedometerSubscription: { remove: () => void } | null = null;
let activeSteps = 0;
let activeOnSteps: ((steps: number) => void) | undefined;

export type PedometerProbe = {
  available: boolean;
  permission: "granted" | "denied" | "undetermined";
  todaySteps: number | null;
  error?: string;
};


export async function getAndroidRawStepCounter(): Promise<number | null> {
  try {
    const value = await EvolveStepCounterModule.getCurrentStepCountAsync();
    return value >= 0 ? value : null;
  } catch {
    return null;
  }
}

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
      const rawSteps = await getAndroidRawStepCounter();

      if (rawSteps === null) {
        return {
          available: false,
          permission: "granted",
          todaySteps: null,
          error: "Impossible de lire TYPE_STEP_COUNTER.",
        };
      }

      const todaySteps = await syncAndroidRawSteps(rawSteps);

      return {
        available: true,
        permission: "granted",
        todaySteps,
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
