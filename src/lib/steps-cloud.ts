import { Platform } from "react-native";
import { localDateString } from "./date";
import { getStoredDailySteps } from "./pedometer";
import { supabase } from "./supabase";

const MIN_SYNC_INTERVAL_MS = 10_000;
let lastSyncAt = 0;
let lastSyncedSteps: number | null = null;

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user?.id ?? null;
}

export async function syncMyDailySteps(
  steps: number,
  options: { force?: boolean; date?: string } = {}
): Promise<boolean> {
  const safeSteps = Math.max(0, Math.round(steps));
  const now = Date.now();

  if (
    !options.force &&
    lastSyncedSteps === safeSteps &&
    now - lastSyncAt < MIN_SYNC_INTERVAL_MS
  ) {
    return false;
  }

  if (!options.force && now - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return false;
  }

  const userId = await currentUserId();
  if (!userId) return false;

  const date = options.date ?? localDateString();

  const { error } = await supabase.from("daily_steps").upsert(
    {
      user_id: userId,
      date,
      steps: safeSteps,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );

  if (error) throw error;

  lastSyncAt = now;
  lastSyncedSteps = safeSteps;
  return true;
}

export async function syncStoredStepHistoryToCloud(days = 30): Promise<number> {
  if (Platform.OS !== "android") return 0;

  const userId = await currentUserId();
  if (!userId) return 0;

  const records = await getStoredDailySteps(days);
  if (!records.length) return 0;

  const rows = records.map((record) => ({
    user_id: userId,
    date: record.date,
    steps: Math.max(0, Math.round(record.steps)),
    platform: "android",
    updated_at: record.updatedAt > 0
      ? new Date(record.updatedAt).toISOString()
      : new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("daily_steps")
    .upsert(rows, { onConflict: "user_id,date" });

  if (error) throw error;
  return rows.length;
}

export function resetStepCloudSyncThrottle() {
  lastSyncAt = 0;
  lastSyncedSteps = null;
}
