-- Enrich the existing exercises table so one canonical exercise record can power
-- workout links, the movement library, and future coach programming tools.

alter table public.exercises
  add column if not exists objective text,
  add column if not exists key_points text[] not null default '{}',
  add column if not exists common_errors text[] not null default '{}',
  add column if not exists regressions text[] not null default '{}',
  add column if not exists progressions text[] not null default '{}',
  add column if not exists equipment text[] not null default '{}',
  add column if not exists muscles text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists difficulty text,
  add column if not exists is_library_visible boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists exercises_library_name_idx
  on public.exercises (lower(name))
  where is_library_visible = true;

create index if not exists exercises_library_category_idx
  on public.exercises (category)
  where is_library_visible = true;

comment on column public.exercises.objective is 'Short athlete-facing purpose of the movement.';
comment on column public.exercises.instructions is 'Athlete-facing execution instructions.';
comment on column public.exercises.key_points is 'Short technical cues displayed on the movement sheet.';
comment on column public.exercises.common_errors is 'Common technical errors to avoid.';
comment on column public.exercises.regressions is 'Simpler movement options.';
comment on column public.exercises.progressions is 'Harder movement options.';
comment on column public.exercises.image_url is 'Optional movement image; video_url remains optional and takes precedence when available.';

-- Pilot movement used to validate the first library screen before the full catalog is enriched.
update public.exercises
set
  objective = 'Développer la stabilité de l’épaule, le contrôle du tronc et la qualité du mouvement au-dessus de la tête.',
  instructions = 'Position demi-genou, genou au sol du même côté que la kettlebell. Tiens la KB bottom-up, cloche vers le haut, poignet neutre et poignée bien serrée. Gaine le tronc, garde le bassin stable, presse verticalement puis redescends lentement sous contrôle.',
  key_points = array[
    'Poignet neutre',
    'KB verticale et contrôlée',
    'Côtes basses et abdos engagés',
    'Épaule loin de l’oreille',
    'Pas de rotation du bassin',
    'Mouvement lent et maîtrisé'
  ],
  common_errors = array[
    'Cambrer pour terminer le mouvement',
    'Laisser la KB basculer',
    'Ouvrir le coude excessivement',
    'Compenser avec le tronc',
    'Utiliser une charge trop lourde'
  ],
  regressions = array['Half-kneeling KB press classique'],
  progressions = array['Bottom-up press debout', 'Augmentation progressive de la charge'],
  equipment = array['Kettlebell'],
  muscles = array['Épaules (deltoïdes)', 'Stabilisateurs de l’épaule', 'Gainage (tronc)'],
  difficulty = 'Intermédiaire',
  is_library_visible = true,
  updated_at = now()
where id = '6e652207-eb2c-403b-b254-f6497ed55d71';
