export function sessionTemplate(session: any) {
  return Array.isArray(session?.workout_templates) ? session.workout_templates[0] : session?.workout_templates;
}
export function isFinishedSession(session: any) {
  return session?.status === "completed" || session?.status === "skipped";
}
export function compareTemplates(a: any, b: any) {
  return Number(a.week_number ?? 999) - Number(b.week_number ?? 999)
    || Number(a.day_number ?? 999) - Number(b.day_number ?? 999)
    || String(a.id).localeCompare(String(b.id));
}
/** One consistent catalogue for recommendations, selection and completed history. */
export function buildProgramProgress(templates: any[], sessions: any[], programId?: string) {
  const scoped = sessions.filter((s) => !programId || String(sessionTemplate(s)?.program_id) === programId);
  const byId = new Map<string, any>(templates.filter((t) => !programId || String(t.program_id ?? programId) === programId).map((t) => [String(t.id), t]));
  for (const s of scoped) {
    const template = sessionTemplate(s);
    if (template?.id && !byId.has(String(template.id))) byId.set(String(template.id), template);
  }
  const options = [...byId.values()].sort(compareTemplates).map((template) => {
    const matching = scoped.filter((s) => String(s.workout_template_id) === String(template.id));
    const completed = matching.filter(isFinishedSession).sort((a, b) => String(b.completed_at ?? b.created_at ?? "").localeCompare(String(a.completed_at ?? a.created_at ?? "")));
    const active = matching.filter((s) => s.status === "planned" || s.status === "in_progress").sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress") || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    return { template, session: completed[0] ?? active[0] ?? null, finished: completed.length > 0 };
  });
  const remaining = options.filter((o) => !o.finished);
  // Earlier uncompleted weeks never disappear because a later week was started.
  const week = remaining[0]?.template.week_number ?? null;
  const recommended = remaining.find((o) => o.template.week_number === week && o.session?.status === "in_progress") ?? remaining[0] ?? null;
  return { options, remaining, recommended, complete: options.length > 0 && !remaining.length };
}
