export type SearchableFood = {
  code: string;
  name: string;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
  fiber100: number | null;
  source: string;
};

const COMMON_ALIASES: Record<string, string[]> = {
  oeuf: ["oeuf", "oeufs", "egg"],
  oeufs: ["oeuf", "oeufs", "egg"],
  "blanc oeuf": ["blanc d oeuf", "blanc oeuf"],
  "jaune oeuf": ["jaune d oeuf", "jaune oeuf"],
  avoine: ["avoine", "flocon d avoine", "flocons d avoine"],
  "flocon avoine": ["avoine", "flocon d avoine", "flocons d avoine"],
  poulet: ["poulet", "blanc de poulet", "escalope de poulet"],
  dinde: ["dinde", "escalope de dinde"],
  boeuf: ["boeuf", "steak", "steak hache"],
  "steak hache": ["steak hache", "boeuf hache"],
  riz: ["riz"],
  pates: ["pate", "pates", "spaghetti", "macaroni"],
  patate: ["pomme de terre", "patate"],
  "patate douce": ["patate douce"],
  saumon: ["saumon"],
  thon: ["thon"],
  banane: ["banane"],
  pomme: ["pomme"],
  skyr: ["skyr", "yaourt skyr", "skyr nature"],
  prot: ["proteine", "protein", "whey", "whey protein"],
  proteine: ["proteine", "protein", "whey", "whey protein"],
  proteines: ["proteine", "protein", "whey", "whey protein"],
  whey: ["whey", "whey protein", "proteine de lactoserum"],
  isolate: ["whey isolate", "isolate", "isolat de proteine"],
  "whey isolate": ["whey isolate", "isolat de proteine"],
  "clear whey": ["clear whey", "whey clear", "whey protein"],
  "whey native": ["whey native", "native whey", "whey protein"],
  caseine: ["caseine", "casein"],
  "fromage blanc": ["fromage blanc"],
  yaourt: ["yaourt", "yogourt"],
  lait: ["lait"],
};

const NORMALIZED_FOOD_NAMES = new WeakMap<object, string>();

export function normalizeFoodText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function queryVariants(query: string) {
  const normalized = normalizeFoodText(query);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);

  for (const [alias, values] of Object.entries(COMMON_ALIASES)) {
    if (normalized === alias || normalized.includes(alias)) {
      values.forEach((value) => variants.add(normalizeFoodText(value)));
    }
  }

  return [...variants].filter(Boolean);
}

function normalizedFoodName(food: SearchableFood) {
  const cached = NORMALIZED_FOOD_NAMES.get(food);
  if (cached != null) return cached;

  const normalized = normalizeFoodText(food.name);
  NORMALIZED_FOOD_NAMES.set(food, normalized);
  return normalized;
}

function scoreFood(food: SearchableFood, variants: string[]) {
  const normalizedName = normalizedFoodName(food);
  if (!normalizedName) return -1;

  let best = -1;

  for (const variant of variants) {
    if (normalizedName === variant) best = Math.max(best, 1000);
    if (normalizedName.startsWith(`${variant} `)) best = Math.max(best, 900);
    if (normalizedName.includes(variant)) best = Math.max(best, 700);

    const tokens = variant.split(" ").filter(Boolean);
    if (tokens.length && tokens.every((token) => normalizedName.includes(token))) {
      best = Math.max(best, 500 + tokens.length * 10);
    }
  }

  return best;
}

export function searchFoods<T extends SearchableFood>(foods: T[], query: string, limit = 16) {
  const variants = queryVariants(query);
  if (!variants.length || normalizeFoodText(query).length < 2) return [];

  return foods
    .map((food) => ({ food, score: scoreFood(food, variants) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.food.name.localeCompare(b.food.name, "fr");
    })
    .slice(0, limit)
    .map((item) => item.food);
}
