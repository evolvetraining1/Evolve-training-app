import { athletePrescription, type AthleteStep } from './athlete-workout';

/** Put a recognized dose beside its movement without guessing or changing the prescription. */
export function inlineExerciseDisplay(name: string, prescription: string) {
  const text = prescription.trim();
  const dose = text.match(/^((?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?(?:\s*[-–à]\s*\d+(?:[.,]\d+)?)?)(?:\s*(reps?|répétitions?|repetitions?|secondes?|seconds?|sec|s|minutes?|min|mètres?|metres?|km|m|calories?|cal|allers?[ -]retours?|A\/R))?(?=$|\s|[—·:@+])/i);
  if (!dose) return { title: name, detail: text };
  let detail = text.slice(dose[0].length).trim();
  // A bare number followed by an unknown unit (kg, %, rounds...) is not a rep count.
  if (!dose[2] && detail && !/^(?:[—–·:@+]|par\b|de chaque\b|chaque\b|tempo\b|repos\b)/i.test(detail))
    return { title: name, detail: text };
  let amount = dose[1].replace(/\s*[x×]\s*/g, ' × ');
  const unit = dose[2];
  if (unit && !/^(?:reps?|répétitions?|repetitions?)$/i.test(unit)) amount += ` ${unit}`;
  const side = detail.match(/^(?:par\s+(?:côté|cote|jambe|bras)|de chaque\s+(?:côté|cote|jambe|bras)|chaque\s+(?:côté|cote|jambe|bras))(?=\s|$)/i);
  if (side) { amount += ` ${side[0]}`; detail = detail.slice(side[0].length).trim(); }
  return { title: `${amount} ${name}`, detail: detail.replace(/^[—–·:]\s*/, '') };
}

const parts = (value: string) => {
  // Dashes inside repetition ranges (8–12) are not instruction separators.
  const clauses: string[] = [];
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (!/[—–]/.test(value[i])) continue;
    if (/\d\s*$/.test(value.slice(0, i)) && /^\s*\d/.test(value.slice(i + 1))) continue;
    clauses.push(value.slice(start, i).trim());
    start = i + 1;
  }
  clauses.push(value.slice(start).trim());
  return clauses.filter(Boolean);
};
const roundsOf = (item: any): number | null => {
  const explicitRounds = athletePrescription(item).match(/\b(\d+)\s*(?:rounds?|tours?)\b/i);
  if (explicitRounds) return Number(explicitRounds[1]);
  const count = item.prescribed_sets?.length;
  if (count) return count;
  const match = athletePrescription(item).match(/\b(\d+)\s*(?:[x×]|rounds?\b|tours?\b)/i);
  return match ? Number(match[1]) : null;
};

/** Presentation only: keep the original prescription and recorded results untouched. */
export function compactAthleteDisplay(step: AthleteStep) {
  const items = step.group.items;
  const counts = items.map(roundsOf);
  const rounds = (step.warmup || step.group.paired) && counts[0] && counts.every(n => n === counts[0]) ? counts[0] : null;
  const label = step.warmup ? 'Échauffement' : step.group.paired
    ? step.group.label.replace(/SUPER\s*SET/i, 'Superset').replace(/BI[ -]?SET/i, 'Biset').replace(/TRI[ -]?SET/i, 'Triset') : '';
  const title = [label, rounds ? `${rounds} tour${rounds > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  const last = items.at(-1);
  // Move only a complete, recognized rest clause. Unusual instructions stay verbatim.
  const restClause = step.group.paired ? parts(athletePrescription(last)).find(p => /^repos\s+\d+(?:[.,]\d+)?\s*(?:min(?:utes?)?|s|sec(?:ondes?)?)(?:\s+\d+\s*(?:s|sec(?:ondes?)?))?(?:\s+apr[eè]s\s+(?:le\s+)?(?:super\s*set|bi[ -]?set|tri[ -]?set))?\.?$/i.test(p)) : undefined;
  const rests = (last?.prescribed_sets ?? []).map((s: any) => s.rest_seconds);
  const uniformRest = rests.length && rests[0] != null && rests.every((s: unknown) => s === rests[0]);
  const rest = restClause ? restClause.replace(/\s+apr[eè]s\s+.*$/i, '').replace(/\.$/, '').replace(/^repos/i, 'Repos')
    : step.group.paired && uniformRest ? `Repos ${rests[0]} s` : '';
  const noPause = step.group.paired && items.some(i => /sans repos entre les exercices/i.test(athletePrescription(i)));
  const footer = step.group.paired ? [noPause ? 'Sans pause entre les exercices' : 'Enchaîne les exercices dans l’ordre', rest ? `${rest.toLowerCase()} après le tour` : ''].filter(Boolean).join(' · ') : '';
  const prescriptions: Record<string, string> = {};
  for (const item of items) {
    let value = athletePrescription(item);
    if (step.group.paired) {
      value = parts(value).filter(p => !/^\s*(?:SUPER\s*SET|BI[ -]?SET|TRI[ -]?SET)\s+[A-Z][1-9]\s*$/i.test(p)
        && !(/^encha[îi]n[eé]\s+avec\s+[^—–]+$/i.test(p) && !/\b(?:tempo|repos|pause|reps?|kg|sec|secondes?|min|lent|vite)\b/i.test(p))
        && !(noPause && /^sans repos entre les exercices\.?$/i.test(p))
        && !(item === last && restClause && p === restClause)).join(' · ');
    }
    if (rounds) {
      value = value.replace(new RegExp(`^${rounds}\\s*(?:rounds?|tours?)\\s*[—–·:-]?\\s*`, 'i'), '');
      value = value.replace(new RegExp(`^${rounds}\\s*[x×]\\s*(\\d+)(?![\\d.,])(?=\\s|$)`, 'i'), (_, reps: string) => {
        const tail = value.replace(/^\d+\s*[x×]\s*\d+/, '');
        return `${reps}${/^\s*(?:reps?\b|sec\b|s\b|min\b|m\b|km\b|allers?\b)/i.test(tail) ? '' : ' reps'}`;
      });
    }
    prescriptions[item.id] = value;
  }
  return { title, footer, prescriptions };
}
