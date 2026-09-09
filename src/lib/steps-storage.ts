import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@evolve/daily-steps";

export type DailySteps = {
  date: string;
  steps: number;
  updatedAt: string;
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
