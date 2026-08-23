# Evolve Training V0.4 LIVE

Cette version est configurée sur le projet Supabase Evolve actuellement connecté.

## Changements
- URL et publishable key Supabase configurées
- Accueil alimenté par `profiles`, `workout_sessions`, `daily_checkins`
- Liste Entraînement alimentée par les vraies séances
- Journal quotidien réellement sauvegardé
- Séance réelle chargée depuis Supabase
- Chaque série cochée est persistée dans `performed_sets`
- Début et fin de séance persistés dans `workout_sessions`

## Important
La publishable key est volontairement utilisable dans une application cliente.
La sécurité des données repose sur les politiques RLS du backend.

## Prochaine étape
Créer l'interface coach permettant :
1. créer un athlète/relation,
2. créer un programme,
3. construire une séance,
4. attribuer le programme,
5. générer les `workout_sessions`.

Ensuite, tester le circuit complet avec un vrai compte athlète.
