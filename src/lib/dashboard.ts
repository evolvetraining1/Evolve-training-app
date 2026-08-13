export function recoveryScore(checkin: any) {
  if (!checkin) return null;
  const sleep = Math.min(100, ((checkin.sleep_minutes ?? 0) / 480) * 100);
  const sleepQuality = ((checkin.sleep_quality ?? 5) / 10) * 100;
  const fatigue = (1 - ((checkin.fatigue ?? 5) - 1) / 9) * 100;
  const soreness = (1 - ((checkin.soreness ?? 5) - 1) / 9) * 100;
  const motivation = ((checkin.motivation ?? 5) / 10) * 100;
  return Math.max(0, Math.min(100, Math.round(
    sleep * .25 + sleepQuality * .20 + fatigue * .20 + soreness * .15 + motivation * .20
  )));
}

export function recoveryLabel(score: number | null) {
  if (score == null) return "Check-in requis";
  if (score >= 80) return "Prêt à performer";
  if (score >= 60) return "Bonne disponibilité";
  if (score >= 40) return "Récupération moyenne";
  return "Priorité récupération";
}

export function displayDuration(minutes?: number | null) {
  if (!minutes) return "≈ 60 min";
  return `≈ ${minutes} min`;
}

export function estimated1RM(load: number, reps: number) {
  if (!load || !reps) return 0;
  if (reps <= 1) return load;
  return Math.round((load * (1 + reps / 30)) * 2) / 2;
}
