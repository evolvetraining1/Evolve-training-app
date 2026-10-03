export type PortionUnit = "g" | "ml" | "unit";

export function portionNumber(value: string): number {
  const cleaned = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

export function defaultUnitGrams(name: string, servingGrams?: number | null): number | null {
  if (servingGrams != null && Number.isFinite(servingGrams) && servingGrams > 0) return servingGrams;
  const normalized = name.toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Indicative edible weights only for ordinary chicken eggs, not other species or dishes.
  if (/^oeuf, blanc .*\b(cru|cuit)$/.test(normalized) || /^blanc d['’ ]oeuf,? (cru|cuit)$/.test(normalized)) return 30;
  if (/^oeuf, jaune .*\b(cru|cuit)$/.test(normalized) || /^jaune d['’ ]oeuf,? (cru|cuit)$/.test(normalized)) return 18;
  if (/^oeuf (cru|dur|poche|a la coque|au plat, sans matiere grasse)$/.test(normalized)) return 50;
  return null;
}

export function portionGrams(amount: string, unit: PortionUnit, gramsPerUnit: string, gramsPerMl: string): number | null {
  const quantity = portionNumber(amount);
  const factor = unit === "unit" ? portionNumber(gramsPerUnit) : unit === "ml" ? portionNumber(gramsPerMl) : 1;
  const grams = quantity * factor;
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(grams) || grams < 0.1 || grams > 10000) return null;
  return Math.round(grams * 10) / 10;
}

export function portionEntryName(name: string, amount: string, unit: PortionUnit): string {
  if (unit === "g") return name;
  return `${name} (${portionNumber(amount)} ${unit === "ml" ? "ml" : "unité(s)"})`;
}
