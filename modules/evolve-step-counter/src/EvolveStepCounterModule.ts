import { requireOptionalNativeModule } from "expo-modules-core";

export type NativeDailySteps = {
  date: string;
  steps: number;
  updatedAt: number;
};

export type EvolveStepCounterNativeModule = {
  getCurrentStepCountAsync(): Promise<number>;
  startTrackingAsync(): Promise<number>;
  getTodayStepCountAsync(): Promise<number>;
  getStoredTodayStepCountAsync(): Promise<number>;
  getLastCapturedAtAsync(): Promise<number>;
  getStoredDailyStepsAsync(days: number): Promise<NativeDailySteps[]>;
};

export default requireOptionalNativeModule<EvolveStepCounterNativeModule>(
  "EvolveStepCounter"
);
