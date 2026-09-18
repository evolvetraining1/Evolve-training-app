import type { ImageSourcePropType } from "react-native";

const localIllustrations: Record<string, ImageSourcePropType> = {
  "alternating single arm db bench press": require("../../assets/exercises/alternating-single-arm-db-bench-press.jpg"),
  "back squat": require("../../assets/exercises/back-squat.jpg"),
  "bench press": require("../../assets/exercises/bench-press.jpg"),
  "bent over row": require("../../assets/exercises/bent-over-row.jpg"),
  "burpees over the box": require("../../assets/exercises/burpees-over-the-box.jpg"),
  "dead hang": require("../../assets/exercises/dead-hang.jpg"),
  deadlift: require("../../assets/exercises/deadlift.jpg"),
  "half kneeling kb bottom up press": require("../../assets/exercises/half-kneeling-kb-bottom-up-press.jpg"),
};

function normalizeExerciseName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getExerciseIllustration(
  name: string,
  imageUrl?: string | null
): ImageSourcePropType | null {
  const remoteUrl = imageUrl?.trim();
  if (remoteUrl) return { uri: remoteUrl };

  return localIllustrations[normalizeExerciseName(name)] ?? null;
}
