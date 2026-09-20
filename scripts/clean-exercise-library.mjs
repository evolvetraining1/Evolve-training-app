const sql = String.raw`
begin;

-- Canonical exercises that replace combined or incorrectly named entries.
insert into public.exercises (
  name, category, instructions, objective, key_points, common_errors,
  regressions, progressions, equipment, muscles, difficulty, is_library_visible
)
select
  'Dips', 'Renforcement',
  'Place-toi en appui bras tendus sur les barres parallèles, épaules basses et poitrine ouverte. Descends en fléchissant les coudes jusqu’à une amplitude confortable, sans laisser les épaules partir vers l’avant. Pousse dans les barres pour revenir bras tendus.',
  'Renforcer les triceps, les pectoraux et la stabilité des épaules.',
  array['Épaules basses et stables', 'Coudes orientés vers l’arrière', 'Amplitude contrôlée et sans douleur'],
  array['S’enfoncer entre les épaules', 'Écarter excessivement les coudes', 'Descendre plus bas que la mobilité disponible'],
  array['Dips assistés avec élastique ou machine', 'Dips entre deux bancs avec amplitude réduite'],
  array['Ajouter une pause en bas', 'Ajouter progressivement du lest'],
  array['Barres parallèles'], array['Triceps', 'Pectoraux', 'Deltoïdes antérieurs'],
  'Intermédiaire', true
where not exists (select 1 from public.exercises where lower(btrim(name)) = 'dips');

insert into public.exercises (
  name, category, instructions, objective, key_points, common_errors,
  regressions, progressions, equipment, muscles, difficulty, is_library_visible
)
select
  'Machine hip adduction', 'Renforcement',
  'Assieds-toi avec le bassin et le dos plaqués au dossier. Place les coussins contre l’intérieur des cuisses, puis rapproche les jambes sans donner d’élan. Marque une courte pause et reviens lentement jusqu’à une amplitude confortable.',
  'Renforcer les adducteurs et améliorer la stabilité du bassin.',
  array['Bassin immobile', 'Genoux alignés avec les hanches', 'Retour lent et contrôlé'],
  array['Décoller le bassin', 'Faire claquer la charge', 'Forcer une amplitude inconfortable'],
  array['Réduire la charge ou l’amplitude'], array['Ajouter une pause en fermeture'],
  array['Machine adducteurs'], array['Adducteurs'], 'Débutant', true
where not exists (select 1 from public.exercises where lower(btrim(name)) = 'machine hip adduction');

insert into public.exercises (
  name, category, instructions, objective, key_points, common_errors,
  regressions, progressions, equipment, muscles, difficulty, is_library_visible
)
select
  'Machine hip abduction', 'Renforcement',
  'Assieds-toi avec le bassin et le dos plaqués au dossier. Place les coussins contre l’extérieur des cuisses, puis écarte les genoux sans basculer le tronc. Marque une courte pause et reviens lentement sans laisser les plaques claquer.',
  'Renforcer les abducteurs de hanche et améliorer la stabilité du bassin.',
  array['Bassin immobile', 'Pieds et genoux alignés', 'Retour lent et contrôlé'],
  array['Se pencher pour créer de l’élan', 'Faire claquer la charge', 'Tourner les pieds pour compenser'],
  array['Réduire la charge ou l’amplitude'], array['Ajouter une pause en ouverture'],
  array['Machine abducteurs'], array['Moyen fessier', 'Petit fessier'], 'Débutant', true
where not exists (select 1 from public.exercises where lower(btrim(name)) = 'machine hip abduction');

-- Exact duplicate rows: preserve every workout reference, then remove the unused copy.
update public.workout_exercises set exercise_id = '10e7ec77-45ff-4ab7-871f-37fac9f5b3db'
where exercise_id = 'ddd466a7-52cc-4b06-9ecc-8f0957f830c7';
delete from public.exercises where id = 'ddd466a7-52cc-4b06-9ecc-8f0957f830c7';

update public.workout_exercises set exercise_id = '3e23063a-30f7-45ef-85c7-42789835ea52'
where exercise_id = '40e4b38d-4328-46f3-b332-85083ffa0853';
delete from public.exercises where id = '40e4b38d-4328-46f3-b332-85083ffa0853';

update public.workout_exercises set exercise_id = '48232acd-b42e-449c-9583-3dc20c356ccc'
where exercise_id = '7d1b3d45-f3c8-4203-bbdc-cbfa7860bdbd';
delete from public.exercises where id = '7d1b3d45-f3c8-4203-bbdc-cbfa7860bdbd';

update public.workout_exercises set exercise_id = '99056ea6-1df8-4e55-a1e7-f29e2ab4811f'
where exercise_id = 'a882819b-f5d8-4a98-83ac-98f2547097c9';
delete from public.exercises where id = 'a882819b-f5d8-4a98-83ac-98f2547097c9';

update public.workout_exercises set exercise_id = '3f456374-c320-44e8-8bc8-c6c1c448efe8'
where exercise_id = '881d6284-4c2f-4acc-8480-0c1923ab0e69';
delete from public.exercises where id = '881d6284-4c2f-4acc-8480-0c1923ab0e69';

-- Same movement under two names.
update public.workout_exercises set exercise_id = 'e5b38167-4dd6-4b53-80b9-90c95db3184b'
where exercise_id = '5a40a4cc-059e-480c-864d-c62b4e3dc01b';
delete from public.exercises where id = '5a40a4cc-059e-480c-864d-c62b4e3dc01b';
update public.exercises set name = 'Barbell bent-over row', updated_at = now()
where id = 'e5b38167-4dd6-4b53-80b9-90c95db3184b';

update public.workout_exercises set exercise_id = 'b0ae2709-5d2c-41ea-9616-56b80526341d'
where exercise_id = '01ecefec-176c-4b72-9f3e-c53e4ec0563e';
delete from public.exercises where id = '01ecefec-176c-4b72-9f3e-c53e4ec0563e';
update public.exercises set name = 'Single-leg GHD hip extension', updated_at = now()
where id = 'b0ae2709-5d2c-41ea-9616-56b80526341d';

update public.workout_exercises set exercise_id = '58163df3-75e8-494f-84e0-02486e3a4866'
where exercise_id = 'a76efdac-8663-434a-99a7-06ab4ca48992';
delete from public.exercises where id = 'a76efdac-8663-434a-99a7-06ab4ca48992';
update public.exercises set name = 'Single-leg hamstring curl', updated_at = now()
where id = '58163df3-75e8-494f-84e0-02486e3a4866';

-- Split the combined Pull-up + Dips entry into two real movements.
create temporary table pullup_dips_rows on commit drop as
select id, workout_template_id, position, prescription_notes
from public.workout_exercises
where exercise_id = 'c2113158-568c-4e0b-acf4-35c78dd74ffc';

update public.workout_exercises we
set position = position + 1000
where exists (
  select 1 from pullup_dips_rows p
  where p.workout_template_id = we.workout_template_id and we.position > p.position
);
update public.workout_exercises we
set position = position - 999
where position >= 1000
  and exists (select 1 from pullup_dips_rows p where p.workout_template_id = we.workout_template_id);

update public.workout_exercises we
set exercise_id = '48232acd-b42e-449c-9583-3dc20c356ccc',
    prescription_notes = replace(coalesce(we.prescription_notes, ''), 'Pull-up + Dips', 'Pull-up')
where we.id in (select id from pullup_dips_rows);

insert into public.workout_exercises (workout_template_id, exercise_id, position, prescription_notes)
select p.workout_template_id,
       (select id from public.exercises where lower(btrim(name)) = 'dips' limit 1),
       p.position + 1,
       replace(coalesce(p.prescription_notes, ''), 'Pull-up + Dips', 'Dips')
from pullup_dips_rows p;
delete from public.exercises where id = 'c2113158-568c-4e0b-acf4-35c78dd74ffc';

-- Death by Burpees is a workout protocol, not an exercise. Keep the protocol in notes.
update public.workout_exercises
set exercise_id = 'b5a8f642-0de7-4ba7-9c9e-ec980a4b89ad'
where exercise_id = '4cc94440-0e32-4009-8cdd-b3f7e661dadf';
delete from public.exercises where id = '4cc94440-0e32-4009-8cdd-b3f7e661dadf';

-- Split the two machine movements that were incorrectly bundled together.
create temporary table hip_machine_rows on commit drop as
select id, workout_template_id, position, prescription_notes
from public.workout_exercises
where exercise_id = 'b501ce06-d981-42bb-83cd-1d457dd5567b';

update public.workout_exercises we
set position = position + 1000
where exists (
  select 1 from hip_machine_rows p
  where p.workout_template_id = we.workout_template_id and we.position > p.position
);
update public.workout_exercises we
set position = position - 999
where position >= 1000
  and exists (select 1 from hip_machine_rows p where p.workout_template_id = we.workout_template_id);

update public.workout_exercises we
set exercise_id = (select id from public.exercises where lower(btrim(name)) = 'machine hip adduction' limit 1)
where we.id in (select id from hip_machine_rows);
insert into public.workout_exercises (workout_template_id, exercise_id, position, prescription_notes)
select p.workout_template_id,
       (select id from public.exercises where lower(btrim(name)) = 'machine hip abduction' limit 1),
       p.position + 1,
       p.prescription_notes
from hip_machine_rows p;
delete from public.exercises where id = 'b501ce06-d981-42bb-83cd-1d457dd5567b';

-- Precise names and instructions for entries that were ambiguous.
update public.exercises
set name = 'Alternating single-arm band row',
    instructions = 'Place-toi face au point d’ancrage, un élastique dans chaque main ou une poignée que tu peux transférer. Tire le coude droit vers les côtes pendant que le bras gauche reste tendu, reviens sous contrôle, puis réalise immédiatement la répétition du bras gauche. Alterne un bras après l’autre sans tourner le buste.',
    objective = 'Renforcer le dos et le contrôle anti-rotation avec un tirage alterné droite-gauche.',
    key_points = array['Un bras tire pendant que l’autre reste tendu', 'Alterner à chaque répétition', 'Bassin et thorax face à l’ancrage'],
    common_errors = array['Tirer avec les deux bras en même temps', 'Tourner le buste', 'Hausser l’épaule du bras qui tire'],
    updated_at = now()
where id = '596b5212-c343-46b5-8a8a-3998b40941c2';

update public.exercises set name = 'Band torso rotation', updated_at = now()
where id = '0d06a06a-5e70-4494-ab58-535668bc1efb';

update public.exercises
set name = 'Overhead DB triceps extension',
    instructions = 'Debout ou assis, tiens un haltère verticalement au-dessus de la tête avec les deux mains. Garde les bras supérieurs proches des oreilles, fléchis uniquement les coudes pour descendre l’haltère derrière la tête, puis tends les coudes sans cambrer le bas du dos.',
    objective = 'Renforcer les triceps sur une grande amplitude de flexion du coude.',
    muscles = array['Triceps'],
    updated_at = now()
where id = 'a0c14e5d-55c9-4dcb-8912-797e5fbb8ca9';

update public.exercises set name = 'Dumbbell side bend', updated_at = now()
where id = 'd285b590-03e8-46c8-a4c4-3e427ed884cb';
update public.exercises set name = 'Barbell thruster', updated_at = now()
where id = '974f2102-c7bf-4963-b97b-f74f5a9a1b94';
update public.exercises set name = 'Single-leg deadlift', updated_at = now()
where id = '06f4b7a6-b23d-47ef-88ce-47dbc7a15ebb';
update public.exercises set name = 'Single-leg extension', updated_at = now()
where id = '319325ee-283f-4a68-bb1b-05dc8ab5e6b9';
update public.exercises set name = 'Single-leg glute bridge', updated_at = now()
where id = '31e557c4-729d-4e96-8092-0d06e122171a';

commit;

select count(*) as visible_exercises,
       count(*) - count(distinct lower(btrim(name))) as exact_duplicate_names
from public.exercises
where is_library_visible = true;
`;

process.stdout.write(sql.trimStart());
