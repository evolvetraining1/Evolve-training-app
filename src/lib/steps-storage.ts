import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@evolve/daily-steps-v2";
const RAW_COUNTER_KEY = "@evolve/android-step-counter-v2";

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
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

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

export async function saveTodaySteps(steps: number): Promise<void> {
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

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function syncAndroidRawSteps(raw: number): Promise<number> {
  const date = todayKey();
  const currentTotal = await getTodaySteps();

  const stored = await AsyncStorage.getItem(RAW_COUNTER_KEY);

  if (!stored) {
    await AsyncStorage.setItem(
      RAW_COUNTER_KEY,
      JSON.stringify({ raw, date, capturedAt: new Date().toISOString() } satisfies RawCounterState)
    );
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

  await saveTodaySteps(total);

  await AsyncStorage.setItem(
    RAW_COUNTER_KEY,
    JSON.stringify({ raw, date, capturedAt: new Date().toISOString() } satisfies RawCounterState)
  );

  return total;
}

export async function __testForcePreviousDay(): Promise<void> {
  const raw = await AsyncStorage.getItem(RAW_COUNTER_KEY);

  if (!raw) return;

  try {
    const state = JSON.parse(raw) as RawCounterState;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");

    await AsyncStorage.setItem(
      RAW_COUNTER_KEY,
      JSON.stringify({
        ...state,
        date: `${year}-${month}-${day}`,
      } satisfies RawCounterState)
    );
  } catch {
    // test helper uniquement
  }
}
