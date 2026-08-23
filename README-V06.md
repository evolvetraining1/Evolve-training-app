# Evolve Training V0.6 — Éditeur de séance

Ajout principal : premier éditeur de prescription Coach → Athlète.

## Workflow
1. Coach crée un programme.
2. Coach crée au moins un exercice.
3. Coach lie un athlète via le code d'invitation.
4. Espace Coach > Créer une séance.
5. Choix programme + nom + semaine + jour + durée.
6. Choix exercice.
7. Prescription série par série :
   - reps
   - charge kg
   - RPE
   - RIR
   - repos en secondes
8. Choix athlète + date.
9. "Créer et envoyer la séance".

L'action crée :
- `workout_templates`
- `workout_exercises`
- `prescribed_sets`
- `program_assignments`
- `workout_sessions`

Exemple :
Back Squat — 5 x 5 — 135 kg — RPE 8 — repos 180 s.

## Limite actuelle
Cette V0.6 édite un exercice détaillé par séance. La V0.7 devra permettre plusieurs exercices dans une même séance avec drag/reorder, blocs échauffement/force/accessoires/conditioning, notes coach et prévisualisation avant envoi.
