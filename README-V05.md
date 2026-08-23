# Evolve Training V0.5 — Coach workflow

## Backend déjà migré
Le projet Supabase contient maintenant :
- `coach_invites`
- RPC `accept_coach_invite`
- politiques RLS permettant au coach de gérer ses propres exercices,
  programmes, séances modèles, prescriptions et attributions
- politiques permettant de programmer une séance pour un athlète lié
- inscription sécurisée : un client peut choisir `coach` ou `athlete`,
  mais ne peut jamais s'auto-attribuer le rôle `admin`

## App V0.5
- création de compte Coach / Athlète
- espace Coach
- génération d'un code d'invitation
- côté athlète : écran « Rejoindre un coach »
- création de programme
- création d'exercice
- liste des athlètes actifs
- API prête pour :
  - création d'une séance modèle
  - ajout des exercices et séries prescrites
  - attribution du programme
  - programmation d'une séance

## Premier test bout en bout
1. Créer un compte Coach.
2. Dans Profil > Espace Coach, générer une invitation pour l'email du compte Athlète.
3. Créer un compte Athlète avec EXACTEMENT cet email.
4. Profil > Rejoindre un coach > saisir le code.
5. Revenir sur le compte Coach : l'athlète doit apparaître.

## Étape suivante
Construire l'éditeur visuel de séance :
Back Squat → 5 séries → 5 reps → 135 kg → RPE 8 → repos 180 s,
puis attribuer cette séance à l'athlète depuis l'interface.
