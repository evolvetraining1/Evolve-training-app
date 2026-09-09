import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import { getTodaySteps, saveTodaySteps } from "./steps-storage";
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
      activeOnSteps = onSteps;

      if (pedometerSubscription) {
        return {
          available: true,
          permission: "granted",
          todaySteps: activeSteps,
        };
      }

      const baseSteps = await getTodaySteps();
      activeSteps = baseSteps;

      pedometerSubscription = Pedometer.watchStepCount((result) => {
        activeSteps = baseSteps + result.steps;
        void saveTodaySteps(activeSteps);
        activeOnSteps?.(activeSteps);
      });

      return {
        available: true,
        permission: "granted",
        todaySteps: activeSteps,
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
