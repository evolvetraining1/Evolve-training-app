import type { SearchableFood } from "./food-search";

type OffProduct = {
  code?: string;
  product_name_fr?: string;
  product_name?: string;
  generic_name_fr?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
};

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function remoteSearchTerm(query: string) {
  const normalized = query
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (/^(prot|proteine|proteines|protein|whey)$/.test(normalized)) {
    return "whey protein";
  }
  if (normalized.includes("clear whey")) return "clear whey";
  if (normalized.includes("isolate") || normalized.includes("isolat")) return "whey isolate";
  if (normalized.includes("native whey") || normalized.includes("whey native")) return "whey native";
  if (normalized.includes("caseine") || normalized.includes("casein")) return "casein";
  if (normalized.includes("skyr")) return "skyr";
  return query.trim();
}

export async function searchOpenFoodFactsProducts(
  query: string,
  limit = 12
): Promise<SearchableFood[]> {
  const trimmed = remoteSearchTerm(query);
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(Math.max(1, Math.min(limit, 20))),
    fields:
      "code,product_name_fr,product_name,generic_name_fr,generic_name,brands,nutriments",
  });

  const response = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
    {
      headers: {
        "User-Agent": "EvolveTraining/0.8 (nutrition-search)",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Recherche Open Food Facts indisponible.");
  }

  const payload = await response.json();
  const products: OffProduct[] = Array.isArray(payload?.products)
    ? payload.products
    : [];

  return products
    .map((product): SearchableFood | null => {
      const name =
        product.product_name_fr ||
        product.product_name ||
        product.generic_name_fr ||
        product.generic_name ||
        "";

      if (!name.trim()) return null;

      const nutriments = product.nutriments ?? {};
      const brand = String(product.brands ?? "").trim();
      const displayName = brand ? `${name} — ${brand}` : name;

      return {
        code: String(product.code ?? `off-${displayName}`),
        name: displayName,
        kcal100: finiteNumber(nutriments["energy-kcal_100g"]),
        protein100: finiteNumber(nutriments.proteins_100g),
        carbs100: finiteNumber(nutriments.carbohydrates_100g),
        fat100: finiteNumber(nutriments.fat_100g),
        fiber100: finiteNumber(nutriments.fiber_100g),
        source: "open_food_facts",
      };
    })
    .filter((product): product is SearchableFood => product !== null)
    .filter(
      (product, index, all) =>
        index === all.findIndex((candidate) => candidate.code === product.code)
    );
}
