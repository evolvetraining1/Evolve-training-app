create unique index if not exists exercises_name_ci_unique
  on public.exercises (lower(btrim(name)));
