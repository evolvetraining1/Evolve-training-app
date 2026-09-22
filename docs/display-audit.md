# Audit d’affichage — 22 septembre 2026

## Corrections

- Les pages défilantes utilisent des marges communes, alignées sur l’en-tête Stats (110 points), augmentées si les zones système l’exigent. Connexion conserve son espacement compact. Les listes internes gardent leur propre défilement.
- L’ajustement du clavier iOS est activé sur les pages sans KeyboardAvoidingView ; il n’est pas cumulé avec ce composant. La messagerie respecte les zones sûres en haut et sous la saisie.
- Les graphiques Stats et pas utilisent la largeur réellement disponible dans leur carte. Le graphique détaillé défile et son en-tête ne juxtapose plus titre, deux indicateurs et bouton dans une seule ligne trop large.
- Les séries de musculation passent sur deux niveaux sur les écrans étroits ou avec une taille de texte agrandie. Les champs reps/charge/RPE et la validation conservent les mêmes callbacks et protections d’enregistrement.
- La carte de séance peut grandir avec le titre ; ses boutons peuvent grandir avec le texte. Le résumé accueil s’empile sur petit écran.
- Le panneau des onze widgets défile dans sa hauteur limitée. Les panneaux de sélection et le menu latéral tiennent compte des zones système.
- Les images et cartes de médias de la messagerie sont bornées par la largeur des bulles.
- Les questions du journal et leurs boutons se réorganisent en mode compact. Le texte hebdomadaire peut revenir à la ligne ; la création d’habitude défile avec le catalogue pour libérer de la place quand le clavier est ouvert.
- Les boutons principaux ont un espace vertical extensible et un texte centré.

## Vérifications

- TypeScript : `npx tsc --noEmit`.
- Régressions existantes : `node scripts/test-session-flow.cjs` et `node scripts/test-journal-behaviors.cjs`.
- Calcul des marges : 54 combinaisons de largeur (320 à 768 points), taille de texte et zones sûres ; contrôle distinct du formulaire de connexion. Il s’agit de calculs, pas d’un rendu d’appareil.
- Export Expo Android, iOS et web ; aucun changement de dépendance native ou de base de données.

## Limite et recette sur appareil

L’aperçu local a été bloqué par le navigateur de vérification (`ERR_BLOCKED_BY_CLIENT`). Aucun essai tactile ni contrôle visuel exhaustif sur téléphone réel n’a été réalisé. Ces corrections ne garantissent pas l’absence de tout défaut d’affichage.

À vérifier dans la version preview : petit téléphone et taille de texte agrandie, accueil avec un titre de séance long, dernier widget de la liste, saisie de séries et WOD avec clavier, catalogue du journal avec recherche, photo dans une conversation, graphiques et boutons de retour. Tester également le passage en arrière-plan puis la reprise.
