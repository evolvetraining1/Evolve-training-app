import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase";

const STORAGE_KEY = "@evolve/daily-steps-v2";
const RAW_COUNTER_KEY = "@evolve/android-step-counter-v2";

async function getUserStorageKeys() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id ?? "anonymous";

  return {
    daily: `${STORAGE_KEY}:${userId}`,
    raw: `${RAW_COUNTER_KEY}:${userId}`,
  };
}

export type DailySteps = {
  date: string;
  steps: number;
  updatedAt: string;
};

type RawCounterState = {
  raw: number;
  date: string;
  capturedAt: string;
};

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getStepsHistory(): Promise<DailySteps[]> {
  const keys = await getUserStorageKeys();
  const raw = await AsyncStorage.getItem(keys.daily);

  if (!raw) return [];

  try {
    return JSON.parse(raw) as DailySteps[];
  } catch {
    return [];
  }
}

export async function getTodaySteps(): Promise<number> {
  const history = await getStepsHistory();
  return history.find((item) => item.date === todayKey())?.steps ?? 0;
}

export async function saveTodaySteps(steps: number, syncRemote = true): Promise<void> {
  const history = await getStepsHistory();
  const date = todayKey();

  const entry: DailySteps = {
    date,
    steps: Math.max(0, Math.round(steps)),
    updatedAt: new Date().toISOString(),
  };

  const index = history.findIndex((item) => item.date === date);

  if (index >= 0) {
    history[index] = entry;
  } else {
    history.push(entry);
  }

  const keys = await getUserStorageKeys();
  await AsyncStorage.setItem(keys.daily, JSON.stringify(history));

  if (!syncRemote) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("daily_steps")
        .upsert(
          {
            user_id: user.id,
            date,
            steps: entry.steps,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,date",
          }
        );

      if (error) {
        console.warn("daily_steps sync failed:", error.message);
      }
    }
  } catch (error) {
    console.warn("daily_steps sync failed:", error);
  }
}

export async function syncAndroidRawSteps(raw: number, syncRemote = true): Promise<number> {
  const date = todayKey();
  const currentTotal = await getTodaySteps();

  const keys = await getUserStorageKeys();
  const stored = await AsyncStorage.getItem(keys.raw);

  if (!stored) {
    await AsyncStorage.setItem(
      keys.raw,
      JSON.stringify({ raw, date, capturedAt: new Date().toISOString() } satisfies RawCounterState)
    );

    await saveTodaySteps(currentTotal, syncRemote);
    return currentTotal;
  }

  let previous: RawCounterState;

  try {
    previous = JSON.parse(stored) as RawCounterState;
  } catch {
    previous = { raw, date, capturedAt: new Date().toISOString() };
  }

  let delta = raw - previous.raw;

  // TYPE_STEP_COUNTER repart à zéro après redémarrage Android.
  if (delta < 0) {
    delta = 0;
  }

  const total = previous.date === date
    ? currentTotal + delta
    : 0;

  await saveTodaySteps(total, syncRemote);

  await AsyncStorage.setItem(
    keys.raw,
    JSON.stringify({ raw, date, capturedAt: new Date().toISOString() } satisfies RawCounterState)
  );

  return total;
}

export async function __testForcePreviousDay(): Promise<void> {
  const keys = await getUserStorageKeys();
  const raw = await AsyncStorage.getItem(keys.raw);

  if (!raw) return;

  try {
    const state = JSON.parse(raw) as RawCounterState;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");

    await AsyncStorage.setItem(
      keys.raw,
      JSON.stringify({
        ...state,
        date: `${year}-${month}-${day}`,
      } satisfies RawCounterState)
    );
  } catch {
    // test helper uniquement
  }
}
