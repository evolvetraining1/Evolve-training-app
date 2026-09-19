import type { ImageSourcePropType } from "react-native";

const localIllustrations: Record<string, ImageSourcePropType> = {
  "alternating single arm db bench press": require("../../assets/exercises/alternating-single-arm-db-bench-press.jpg"),
  "back squat": require("../../assets/exercises/back-squat.jpg"),
  "bench press": require("../../assets/exercises/bench-press.jpg"),
  "bent over row": require("../../assets/exercises/bent-over-row.jpg"),
  "burpees over the box": require("../../assets/exercises/burpees-over-the-box.jpg"),
  "dead hang": require("../../assets/exercises/dead-hang.jpg"),
  deadlift: require("../../assets/exercises/deadlift.jpg"),
  "forward lunge": require("../../assets/exercises/forward-lunge.jpg"),
  "half kneeling kb bottom up press": require("../../assets/exercises/half-kneeling-kb-bottom-up-press.jpg"),
  "pallof press": require("../../assets/exercises/pallof-press.jpg"),
  "plank hold": require("../../assets/exercises/plank-hold.jpg"),
  "pull up dips": require("../../assets/exercises/pull-up-dips.jpg"),
  "push up": require("../../assets/exercises/push-up.jpg"),
  rameur: require("../../assets/exercises/rameur.jpg"),
  "single arm band rowing": require("../../assets/exercises/single-arm-band-rowing.jpg"),
  "single leg deadlift": require("../../assets/exercises/single-leg-deadlift.jpg"),
  "single leg extension": require("../../assets/exercises/single-leg-extension.jpg"),
  "one leg ghd back extension": require("../../assets/exercises/single-leg-ghd-hip-extension.jpg"),
  "single leg ghd hip extension": require("../../assets/exercises/single-leg-ghd-hip-extension.jpg"),
  "single leg glute bridge": require("../../assets/exercises/single-leg-glute-bridge.jpg"),
  "single leg ischio flexion": require("../../assets/exercises/single-leg-ischio-flexion.jpg"),
  "sit up": require("../../assets/exercises/sit-up.jpg"),
  "star plank": require("../../assets/exercises/star-plank.jpg"),
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
