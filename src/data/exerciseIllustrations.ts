import type { ImageSourcePropType } from "react-native";

// Only map an exercise to an illustration that depicts that exact movement.
// Missing exact illustrations use the Evolve logo in the UI. Borrowing a
// picture from a similar exercise would be unsafe and misleading.
const localIllustrations: Record<string, ImageSourcePropType> = {
  "ab wheel": require("../../assets/exercises/ab-wheel.jpg"),
  "air squat": require("../../assets/exercises/air-squat.jpg"),
  "alternating db hang snatch": require("../../assets/exercises/alternating-db-hang-snatch.jpg"),
  "alternating gorilla row": require("../../assets/exercises/alternating-gorilla-row.jpg"),
  "alternating single arm db bench press": require("../../assets/exercises/alternating-single-arm-db-bench-press.jpg"),
  "alternating single arm incline db bench press": require("../../assets/exercises/alternating-single-arm-incline-db-bench-press.jpg"),
  "alternating single arm band row": require("../../assets/exercises/alternating-single-arm-band-row.jpg"),
  "back squat": require("../../assets/exercises/back-squat.jpg"),
  "band pull apart": require("../../assets/exercises/band-pull-apart.jpg"),
  "band torso rotation": require("../../assets/exercises/band-torso-rotation.jpg"),
  "barbell bent over row": require("../../assets/exercises/barbell-bent-over-row.jpg"),
  "barbell thruster": require("../../assets/exercises/barbell-thruster.jpg"),
  "bear crawl": require("../../assets/exercises/bear-crawl.jpg"),
  "bench press": require("../../assets/exercises/bench-press.jpg"),
  bike: require("../../assets/exercises/bike.jpg"),
  "box jump": require("../../assets/exercises/box-jump.jpg"),
  "box jump over": require("../../assets/exercises/box-jump-over.jpg"),
  "box step over": require("../../assets/exercises/box-step-over.jpg"),
  "bulgarian split squat": require("../../assets/exercises/bodyweight-bulgarian-split-squat.jpg"),
  burpee: require("../../assets/exercises/burpee.jpg"),
  "burpees over the box": require("../../assets/exercises/burpees-over-the-box.jpg"),
  "chest supported db row": require("../../assets/exercises/chest-supported-db-row.jpg"),
  "copenhagen plank": require("../../assets/exercises/copenhagen-plank.jpg"),
  "db bench press": require("../../assets/exercises/db-bench-press.jpg"),
  "db bulgarian split squat": require("../../assets/exercises/db-bulgarian-split-squat.jpg"),
  "db clean and jerk": require("../../assets/exercises/db-clean-and-jerk.jpg"),
  "db deadlift": require("../../assets/exercises/db-deadlift.jpg"),
  "db front squat": require("../../assets/exercises/db-front-squat.jpg"),
  "db lateral raise": require("../../assets/exercises/db-lateral-raise.jpg"),
  "db romanian deadlift": require("../../assets/exercises/db-romanian-deadlift.jpg"),
  "db skull crusher": require("../../assets/exercises/db-skull-crusher.jpg"),
  "db thruster": require("../../assets/exercises/db-thruster.jpg"),
  "dead bug": require("../../assets/exercises/dead-bug.jpg"),
  "dead hang": require("../../assets/exercises/dead-hang.jpg"),
  deadlift: require("../../assets/exercises/deadlift.jpg"),
  "devil press": require("../../assets/exercises/devil-press.jpg"),
  dips: require("../../assets/exercises/dips.jpg"),
  "dumbbell side bend": require("../../assets/exercises/dumbbell-side-bend.jpg"),
  "face pull": require("../../assets/exercises/face-pull.jpg"),
  "farmer carry": require("../../assets/exercises/farmer-carry.jpg"),
  "forward lunge": require("../../assets/exercises/forward-lunge.jpg"),
  "goblet squat": require("../../assets/exercises/goblet-squat.jpg"),
  "half kneeling kb bottom up press": require("../../assets/exercises/half-kneeling-kb-bottom-up-press.jpg"),
  "hanging knee raise": require("../../assets/exercises/hanging-knee-raise.jpg"),
  "hollow hold": require("../../assets/exercises/hollow-hold.jpg"),
  "incline curl": require("../../assets/exercises/incline-curl.jpg"),
  "incline db bench press": require("../../assets/exercises/incline-db-bench-press.jpg"),
  "incline run": require("../../assets/exercises/incline-run.jpg"),
  "jumping lunge": require("../../assets/exercises/jumping-lunge.jpg"),
  "kb russian twist": require("../../assets/exercises/kb-russian-twist.jpg"),
  "kettlebell deadlift": require("../../assets/exercises/kettlebell-deadlift.jpg"),
  "kettlebell swing": require("../../assets/exercises/kettlebell-swing.jpg"),
  "landmine press": require("../../assets/exercises/landmine-press.jpg"),
  "machine hip abduction": require("../../assets/exercises/machine-hip-abduction.jpg"),
  "machine hip adduction": require("../../assets/exercises/machine-hip-adduction.jpg"),
  "overhead db triceps extension": require("../../assets/exercises/overhead-db-triceps-extension.jpg"),
  "pallof press": require("../../assets/exercises/pallof-press.jpg"),
  "plank hold": require("../../assets/exercises/plank-hold.jpg"),
  "plate pinch hold": require("../../assets/exercises/plate-pinch-hold.jpg"),
  "pull up": require("../../assets/exercises/pull-up.jpg"),
  "push up": require("../../assets/exercises/push-up.jpg"),
  rameur: require("../../assets/exercises/rameur.jpg"),
  "rear delt db raise": require("../../assets/exercises/rear-delt-db-raise.jpg"),
  run: require("../../assets/exercises/run.jpg"),
  "scapular push up": require("../../assets/exercises/scapular-push-up.jpg"),
  "side plank": require("../../assets/exercises/side-plank.jpg"),
  "single unders": require("../../assets/exercises/single-unders.jpg"),
  "single leg deadlift": require("../../assets/exercises/single-leg-deadlift.jpg"),
  "single leg extension": require("../../assets/exercises/single-leg-extension.jpg"),
  "single leg ghd hip extension": require("../../assets/exercises/single-leg-ghd-hip-extension.jpg"),
  "single leg glute bridge": require("../../assets/exercises/single-leg-glute-bridge.jpg"),
  "single leg hamstring curl": require("../../assets/exercises/single-leg-hamstring-curl.jpg"),
  "sit up": require("../../assets/exercises/sit-up.jpg"),
  "standing curl": require("../../assets/exercises/standing-curl.jpg"),
  "star plank": require("../../assets/exercises/star-plank.jpg"),
  "strict press": require("../../assets/exercises/strict-press.jpg"),
  "superman plank hold": require("../../assets/exercises/superman-plank-hold.jpg"),
  "toes to bar": require("../../assets/exercises/toes-to-bar.jpg"),
  "weighted box jump": require("../../assets/exercises/weighted-box-jump.jpg"),
  "weighted pull up": require("../../assets/exercises/weighted-pull-up.jpg"),
  "wrist roller": require("../../assets/exercises/wrist-roller.jpg"),
};

export const exerciseIllustrationPlaceholder = require("../../assets/evolve-logo-header.png");

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
