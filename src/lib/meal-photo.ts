// Pure helpers shared by the screen and regression tests. No native dependency.
export function photoMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  throw new Error('Format photo non reconnu. Choisis une photo JPEG ou PNG, ou reprends-la avec la caméra.');
}

export function createFoodId() {
  // IDs identify journal rows, never credentials or access tokens.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export function portion(value100: number, grams: number) {
  if (!Number.isFinite(value100) || !Number.isFinite(grams) || value100 < 0 || grams < 0) {
    throw new Error('Vérifie les quantités et les valeurs nutritionnelles.');
  }
  return Math.round(value100 * grams / 10) / 10;
}

export type PhotoFood = {
  localId: string; name: string; estimated_grams: number;
  kcal_100g: number; protein_100g: number; carbs_100g: number;
  fat_100g: number; fiber_100g: number;
};

export function buildPhotoEntries(foods: PhotoFood[], userId: string, analysisId: string, mealType: string, eatenOn: string) {
  if (!foods.length) throw new Error('Ajoute au moins un aliment.');
  return foods.map((food) => {
    if (!food.name.trim() || food.estimated_grams <= 0 || food.estimated_grams > 10000 ||
        !Number.isFinite(food.estimated_grams) || food.kcal_100g > 1000 ||
        [food.protein_100g, food.carbs_100g, food.fat_100g, food.fiber_100g].some(v => v > 100)) {
      throw new Error('Vérifie le nom, les grammes et les valeurs pour 100 g de chaque aliment.');
    }
    return {
      id: food.localId, user_id: userId, entry_date: eatenOn, eaten_on: eatenOn,
      meal_type: mealType, food_name: food.name.trim(), grams: Math.round(food.estimated_grams * 10) / 10,
      calories: portion(food.kcal_100g, food.estimated_grams),
      protein_g: portion(food.protein_100g, food.estimated_grams),
      carbs_g: portion(food.carbs_100g, food.estimated_grams),
      fat_g: portion(food.fat_100g, food.estimated_grams),
      fiber_g: portion(food.fiber_100g, food.estimated_grams),
      source: 'ai_plate', ai_analysis_id: analysisId,
    };
  });
}
