import { Platform } from "react-native";
import EvolveStepCounterModule, {
  NativeDailySteps,
} from "../../modules/evolve-step-counter/src/EvolveStepCounterModule";

export type PedometerProbe = {
  available: boolean;
  permission: "granted" | "denied" | "undetermined";
  todaySteps: number | null;
  error?: string;
};

export type TodayStepsSubscription = {
  remove: () => void;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function requestPedometerPermission() {
  const { Pedometer } = await import("expo-sensors");
  const available = await Pedometer.isAvailableAsync();

  if (!available) {
    return { available: false, granted: false, Pedometer };
  }

  const permission = await Pedometer.requestPermissionsAsync();
  return { available: true, granted: permission.granted, Pedometer };
}

export async function refreshTodaySteps(): Promise<number | null> {
  if (Platform.OS === "android") {
    if (!EvolveStepCounterModule) return null;

    const value = await EvolveStepCounterModule.getTodayStepCountAsync();
    return value >= 0 ? Math.round(value) : null;
  }

  if (Platform.OS === "ios") {
    const { Pedometer } = await import("expo-sensors");
    const result = await Pedometer.getStepCountAsync(startOfToday(), new Date());
    return Math.max(0, Math.round(result.steps));
  }

  return null;
}

export async function probePedometer(): Promise<PedometerProbe> {
  try {
    const permission = await requestPedometerPermission();

    if (!permission.available) {
      return {
        available: false,
        permission: "undetermined",
        todaySteps: null,
      };
    }

    if (!permission.granted) {
      return {
        available: true,
        permission: "denied",
        todaySteps: null,
      };
    }

    if (Platform.OS === "android") {
      if (!EvolveStepCounterModule) {
        return {
          available: false,
          permission: "granted",
          todaySteps: null,
          error: "Module natif Android du podomètre absent de cette version de l’application.",
        };
      }

      const value = await EvolveStepCounterModule.startTrackingAsync();

      return {
        available: value >= 0,
        permission: "granted",
        todaySteps: value >= 0 ? Math.round(value) : null,
        error: value >= 0 ? undefined : "Impossible de lire TYPE_STEP_COUNTER.",
      };
    }

    const result = await permission.Pedometer.getStepCountAsync(
      startOfToday(),
      new Date()
    );

    return {
      available: true,
      permission: "granted",
      todaySteps: Math.max(0, Math.round(result.steps)),
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

export function watchTodaySteps(
  onSteps: (steps: number) => void,
  onError?: (error: unknown) => void,
  intervalMs = 10_000
): TodayStepsSubscription {
  let active = true;
  let running = false;

  const tick = async () => {
    if (!active || running) return;
    running = true;

    try {
      const steps = await refreshTodaySteps();
      if (active && steps != null) onSteps(steps);
    } catch (error) {
      if (active) onError?.(error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), Math.max(5_000, intervalMs));

  return {
    remove: () => {
      active = false;
      clearInterval(timer);
    },
  };
}

export async function getStoredDailySteps(
  days = 30
): Promise<NativeDailySteps[]> {
  if (Platform.OS !== "android" || !EvolveStepCounterModule) return [];

  return EvolveStepCounterModule.getStoredDailyStepsAsync(days);
}

export async function getStepCounterLastCapturedAt(): Promise<number | null> {
  if (Platform.OS !== "android" || !EvolveStepCounterModule) return null;

  const value = await EvolveStepCounterModule.getLastCapturedAtAsync();
  return value > 0 ? value : null;
}
