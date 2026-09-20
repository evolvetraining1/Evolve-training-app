import type { ImageSourcePropType } from "react-native";

const localIllustrations: Record<string, ImageSourcePropType> = {
  "air squat": require("../../assets/exercises/goblet-squat.jpg"),
  "alternating single arm db bench press": require("../../assets/exercises/alternating-single-arm-db-bench-press.jpg"),
  "alternating single arm incline db bench press": require("../../assets/exercises/alternating-single-arm-db-bench-press.jpg"),
  "back squat": require("../../assets/exercises/back-squat.jpg"),
  "barbell row": require("../../assets/exercises/barbell-row.jpg"),
  "bench press": require("../../assets/exercises/bench-press.jpg"),
  "bent over row": require("../../assets/exercises/bent-over-row.jpg"),
  bike: require("../../assets/exercises/bike.jpg"),
  "box jump": require("../../assets/exercises/box-jump.jpg"),
  "box jump over": require("../../assets/exercises/box-jump.jpg"),
  "bulgarian split squat": require("../../assets/exercises/bulgarian-split-squat.jpg"),
  burpee: require("../../assets/exercises/burpee.jpg"),
  "burpees over the box": require("../../assets/exercises/burpees-over-the-box.jpg"),
  "copenhagen plank": require("../../assets/exercises/star-plank.jpg"),
  "db bench press": require("../../assets/exercises/db-bench-press.jpg"),
  "db bulgarian split squat": require("../../assets/exercises/bulgarian-split-squat.jpg"),
  "db deadlift": require("../../assets/exercises/deadlift.jpg"),
  "db front squat": require("../../assets/exercises/goblet-squat.jpg"),
  "db lateral raise": require("../../assets/exercises/db-lateral-raise.jpg"),
  "db romanian deadlift": require("../../assets/exercises/deadlift.jpg"),
  "dead hang": require("../../assets/exercises/dead-hang.jpg"),
  deadlift: require("../../assets/exercises/deadlift.jpg"),
  "death by burpees": require("../../assets/exercises/burpee.jpg"),
  "farmer carry": require("../../assets/exercises/farmer-carry.jpg"),
  "forward lunge": require("../../assets/exercises/forward-lunge.jpg"),
  "goblet squat": require("../../assets/exercises/goblet-squat.jpg"),
  "half kneeling kb bottom up press": require("../../assets/exercises/half-kneeling-kb-bottom-up-press.jpg"),
  "incline db bench press": require("../../assets/exercises/db-bench-press.jpg"),
  "incline run": require("../../assets/exercises/run.jpg"),
  "jumping lunge": require("../../assets/exercises/forward-lunge.jpg"),
  "kettlebell deadlift": require("../../assets/exercises/deadlift.jpg"),
  "kettlebell swing": require("../../assets/exercises/kettlebell-swing.jpg"),
  "pallof press": require("../../assets/exercises/pallof-press.jpg"),
  "plank hold": require("../../assets/exercises/plank-hold.jpg"),
  "pull up dips": require("../../assets/exercises/pull-up-dips.jpg"),
  "pull up": require("../../assets/exercises/pull-up.jpg"),
  "push up": require("../../assets/exercises/push-up.jpg"),
  rameur: require("../../assets/exercises/rameur.jpg"),
  run: require("../../assets/exercises/run.jpg"),
  "scapular push up": require("../../assets/exercises/push-up.jpg"),
  "side plank": require("../../assets/exercises/star-plank.jpg"),
  "single arm band rowing": require("../../assets/exercises/single-arm-band-rowing.jpg"),
  "single leg deadlift": require("../../assets/exercises/single-leg-deadlift.jpg"),
  "single leg extension": require("../../assets/exercises/single-leg-extension.jpg"),
  "one leg ghd back extension": require("../../assets/exercises/single-leg-ghd-hip-extension.jpg"),
  "single leg ghd hip extension": require("../../assets/exercises/single-leg-ghd-hip-extension.jpg"),
  "single leg glute bridge": require("../../assets/exercises/single-leg-glute-bridge.jpg"),
  "single leg ischio flexion": require("../../assets/exercises/single-leg-ischio-flexion.jpg"),
  "single leg hamstring curl": require("../../assets/exercises/single-leg-ischio-flexion.jpg"),
  "sit up": require("../../assets/exercises/sit-up.jpg"),
  "star plank": require("../../assets/exercises/star-plank.jpg"),
  "superman plank hold": require("../../assets/exercises/plank-hold.jpg"),
  "weighted box jump": require("../../assets/exercises/box-jump.jpg"),
  "weighted pull up": require("../../assets/exercises/pull-up.jpg"),
  "wrist roller": require("../../assets/exercises/wrist-roller.jpg"),
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
