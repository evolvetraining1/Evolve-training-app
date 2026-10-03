export type SearchableFood = {
  code: string;
  name: string;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
  fiber100: number | null;
  source: string;
  servingGrams?: number | null;
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
  pates: ["pates", "spaghetti", "macaroni", "tagliatelles", "penne", "nouilles"],
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

  // Replace a whole phrase, keeping every qualifier ("riz complet", "poulet cru").
  const entry = Object.entries(COMMON_ALIASES)
    .sort(([a], [b]) => b.length - a.length)
    .find(([alias]) => (` ${normalized} `).includes(` ${alias} `));
  if (entry) {
    const [alias, values] = entry;
    for (const value of values) {
      variants.add((` ${normalized} `).replace(` ${alias} `, ` ${value} `).trim());
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

const STOP_WORDS = new Set(["a", "au", "aux", "de", "des", "d", "du", "en", "et", "la", "le", "les"]);

function words(value: string) {
  return value.split(" ").filter((word) => word && !STOP_WORDS.has(word));
}

function wordMatches(name: string, query: string) {
  if (name === query) return true;
  // Plurals, without confusing pâtes with pâte or pâté.
  if ([name, query].some((word) => word === "pate" || word === "pates")) return false;
  return name.replace(/s$/, "") === query.replace(/s$/, "");
}

function scoreFood(food: SearchableFood, variants: string[], query: string) {
  const name = normalizedFoodName(food);
  if (!name) return -1;
  const nameWords = words(name);
  const pastaQuery = words(normalizeFoodText(query)).includes("pates") &&
    !/(^|[\s,(])pâtés?(?=$|[\s,)])/iu.test(query) &&
    !/feuillete|brise|sable|pizza|tartiner|amande/.test(normalizeFoodText(query));
  if (pastaQuery && (/(^|[\s,(])pâtés?(?=$|[\s,)])/iu.test(food.name) ||
      /\b(pate|feuilletee?s?|brisee?s?|sablee?s?|tartiner|pizza|courge)\b/.test(name))) return -1;

  const explicitPate = /(^|[\s,(])pâtés?(?=$|[\s,)])/iu.test(query);
  if (explicitPate && !/(^|[\s,(])pâtés?(?=$|[\s,)])/iu.test(food.name)) return -1;
  let best = -1;
  variants.forEach((variant, index) => {
    const tokens = words(variant);
    if (!tokens.length) return;
    const complete = tokens.every((token) => nameWords.some((word) => wordMatches(word, token)));
    // Prefix completion only on the final unfinished word, never in the middle of a word.
    const prefix = tokens.every((token, i) => nameWords.some((word) =>
      wordMatches(word, token) || (i === tokens.length - 1 && token.length >= 3 && word.startsWith(token))));
    let score = -1;
    if (complete) {
      score = name === variant ? 1100 : name.startsWith(`${variant} `) ? 950 :
        (` ${name} `).includes(` ${variant} `) ? 850 : 700;
    } else if (prefix && !pastaQuery) score = 400;
    if (score < 0) return;
    if (index > 0) score -= 25;
    if (pastaQuery && /^(pates (seches|fraiches)|spaghetti|macaroni|tagliatelles|penne|nouilles)/.test(name) &&
        !/farci|sauce|carbonara|bolognaise/.test(name)) {
      score += 120;
      if (name.includes("standard")) score += 60;
      if (name.includes("cuites")) score += 10;
    }
    best = Math.max(best, score);
  });
  return best;
}

export function searchFoods<T extends SearchableFood>(foods: T[], query: string, limit = 16) {
  const variants = queryVariants(query);
  if (!variants.length || normalizeFoodText(query).length < 2) return [];
  const seen = new Set<string>();
  return foods
    .map((food) => ({ food, score: scoreFood(food, variants, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score ||
      Number(b.food.source === "ciqual_2025") - Number(a.food.source === "ciqual_2025") ||
      a.food.name.localeCompare(b.food.name, "fr"))
    .filter(({ food }) => {
      const key = normalizedFoodName(food);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((item) => item.food);
}
