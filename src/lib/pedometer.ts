import { requireOptionalNativeModule } from "expo-modules-core";

export type PedometerProbe = {
  available: boolean;
  permission: "granted" | "denied" | "undetermined";
  todaySteps: number | null;
  error?: string;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function probePedometer(): Promise<PedometerProbe> {
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
    const permission = permissionResponse.granted ? "granted" : "denied";

    if (!permissionResponse.granted) {
      return {
        available: true,
        permission,
        todaySteps: null,
      };
    }

    const result = await Pedometer.getStepCountAsync(startOfToday(), new Date());

    return {
      available: true,
      permission,
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
