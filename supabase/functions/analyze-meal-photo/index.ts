// @ts-nocheck -- This file is type-checked by the Supabase Deno runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_IMAGE_BASE64_LENGTH = 8_000_000;
const MAX_ANALYSES_PER_DAY = 15;

const foodSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    estimated_grams: { type: "number", minimum: 1, maximum: 3000 },
    kcal_100g: { type: "number", minimum: 0, maximum: 1000 },
    protein_100g: { type: "number", minimum: 0, maximum: 100 },
    carbs_100g: { type: "number", minimum: 0, maximum: 100 },
    fat_100g: { type: "number", minimum: 0, maximum: 100 },
    fiber_100g: { type: "number", minimum: 0, maximum: 100 },
    cooking_method: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    assumptions: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
  },
  required: [
    "name",
    "estimated_grams",
    "kcal_100g",
    "protein_100g",
    "carbs_100g",
    "fat_100g",
    "fiber_100g",
    "cooking_method",
    "confidence",
    "assumptions",
  ],
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    meal_summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    foods: {
      type: "array",
      items: foodSchema,
      minItems: 1,
      maxItems: 20,
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
  },
  required: ["meal_summary", "confidence", "foods", "warnings"],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getOutputText(response: any): string | null {
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function cleanNumber(value: unknown, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.min(max, Math.max(0, parsed)) * 10) / 10;
}

function sanitizeAnalysis(value: any) {
  const foods = Array.isArray(value?.foods)
    ? value.foods.slice(0, 20).map((food: any) => ({
        name: String(food?.name ?? "Aliment à préciser").slice(0, 120),
        estimated_grams: Math.max(1, cleanNumber(food?.estimated_grams, 3000)),
        kcal_100g: cleanNumber(food?.kcal_100g, 1000),
        protein_100g: cleanNumber(food?.protein_100g, 100),
        carbs_100g: cleanNumber(food?.carbs_100g, 100),
        fat_100g: cleanNumber(food?.fat_100g, 100),
        fiber_100g: cleanNumber(food?.fiber_100g, 100),
        cooking_method:
          typeof food?.cooking_method === "string"
            ? food.cooking_method.slice(0, 80)
            : null,
        confidence: Math.min(1, Math.max(0, Number(food?.confidence) || 0)),
        assumptions: Array.isArray(food?.assumptions)
          ? food.assumptions.slice(0, 5).map((item: unknown) => String(item).slice(0, 180))
          : [],
      }))
    : [];

  return {
    meal_summary: String(value?.meal_summary ?? "Repas analysé").slice(0, 240),
    confidence: ["low", "medium", "high"].includes(value?.confidence)
      ? value.confidence
      : "low",
    foods,
    warnings: Array.isArray(value?.warnings)
      ? value.warnings.slice(0, 8).map((item: unknown) => String(item).slice(0, 240))
      : [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée." }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Connexion requise." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-6-astra";

    if (!openAiKey) {
      return json({ error: "Le service d'analyse photo n'est pas encore activé." }, 503);
    }

    const token = authorization.slice("Bearer ".length);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "Session invalide ou expirée." }, 401);
    }

    const body = await req.json();
    const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
    const mimeType = ["image/jpeg", "image/png", "image/webp"].includes(body?.mimeType)
      ? body.mimeType
      : "image/jpeg";
    const mealType = ["breakfast", "lunch", "dinner", "snack"].includes(body?.mealType)
      ? body.mealType
      : "lunch";

    if (!imageBase64 || imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return json({ error: "Photo absente ou trop volumineuse. Reprends-la en qualité standard." }, 400);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("nutrition_ai_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .gte("created_at", since);

    if (countError) throw countError;
    if ((count ?? 0) >= MAX_ANALYSES_PER_DAY) {
      return json({ error: "Limite quotidienne atteinte. Réessaie dans quelques heures." }, 429);
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 2200,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Tu es un assistant de journal nutritionnel. Analyse uniquement ce qui est visible sur la photo. Identifie séparément les aliments, sauces, boissons et matières grasses plausibles. Estime la masse comestible servie et les valeurs nutritionnelles moyennes pour 100 g. Réponds en français. N'invente pas une certitude: baisse confidence et explique toute ambiguïté. Les valeurs servent à une estimation, jamais à un avis médical.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Analyse cette assiette. Sépare les ingrédients utiles au suivi des macros. Signale particulièrement l'huile, les sauces, les aliments cachés et l'absence de repère d'échelle.",
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "meal_photo_analysis",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    });

    const openAiPayload = await openAiResponse.json();
    if (!openAiResponse.ok) {
      console.error("OPENAI_MEAL_ANALYSIS_ERROR", openAiResponse.status, openAiPayload?.error?.code);
      return json({ error: "L'analyse de la photo a échoué. Réessaie avec une photo plus nette." }, 502);
    }

    const outputText = getOutputText(openAiPayload);
    if (!outputText) {
      return json({ error: "La photo n'a pas pu être interprétée." }, 422);
    }

    const analysis = sanitizeAnalysis(JSON.parse(outputText));
    if (!analysis.foods.length) {
      return json({ error: "Aucun aliment identifiable. Reprends la photo avec plus de lumière." }, 422);
    }

    const { data: savedAnalysis, error: saveError } = await supabase
      .from("nutrition_ai_analyses")
      .insert({
        user_id: userData.user.id,
        meal_type: mealType,
        confidence: analysis.confidence,
        meal_summary: analysis.meal_summary,
        foods: analysis.foods,
        warnings: analysis.warnings,
        model_name: model,
      })
      .select("id")
      .single();

    if (saveError) throw saveError;

    return json({ analysisId: savedAnalysis.id, ...analysis });
  } catch (error) {
    console.error("MEAL_ANALYSIS_ERROR", error instanceof Error ? error.message : "unknown");
    return json({ error: "Impossible d'analyser ce repas pour le moment." }, 500);
  }
});
