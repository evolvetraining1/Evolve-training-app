# Séances et résultats WOD — 21 septembre 2026

## Corrections

- Le sélecteur dépendait du nombre de séances non terminées dans la semaine : il disparaissait après la deuxième séance d'une semaine de trois. Il affiche maintenant tout le programme, y compris l'historique, et reste disponible à la fin.
- La recommandation tient compte des modèles sans session créée, reprend une séance en cours dans la première semaine incomplète et conserve les séances antérieures non réalisées.
- La fin d'une séance revient à l'accueil. Elle ne crée ni ne démarre automatiquement la suivante.
- Ouverture sérialisée côté serveur, protection des doubles pressions, horodatage initial conservé, historique terminé en lecture seule. Les anciens doublons actifs/terminés sont conservés ; une séance terminée est prioritaire.
- Sauvegarde de fin atomique : séries et résultats WOD réussissent ensemble ou sont annulés ensemble. Un nouvel essai après une réponse réseau perdue conserve le premier résultat.
- Contrôle de l'appartenance des exercices/prescriptions, des valeurs, des accès et des écritures tardives. Pagination de l'historique, protection contre les chargements incomplets et brouillon local des saisies.
- Les charges nulles/égales à zéro et les RPE non renseignés ne sont plus remplacés par les objectifs lors d'une reprise.

## Formats

| Prescription | Carte et résultat |
| --- | --- |
| AMRAP | Une carte par bloc, mouvements dans l'ordre, tours complets + reps supplémentaires |
| For time, dont Murph | Une carte, minutes/secondes, arrêt ou time cap et travail réalisé |
| EMOM / E2MOM / Death by | Une carte, intervalles accomplis, reps du dernier intervalle facultatives |
| Tours fixes | Une carte, tours réalisés, reps supplémentaires et chrono facultatifs |
| Tabata | Une carte, résultats par intervalle et mouvement ; pas de calcul universel de score |
| Intervalles chronométrés | Une carte avec le détail des résultats par intervalle |
| Finisher ou WOD sans format précis | Carte séparée, résultat libre et validation |
| Travail de force | Séries individuelles conservées, même si une série porte la mention AMRAP |

Les scores sont stockés dans `workout_sessions.wod_results`, séparément des `performed_sets`. Les anciennes séances terminées sans score WOD conservent l'affichage de leurs séries historiques ; aucun score n'est inventé.

Référence : [FAQ officielle CrossFit](https://www.crossfit.com/faq), exemples Cindy, Chelsea, workouts For time et Tabata This. Les consignes particulières du programme priment ; un circuit à tours fixes n'est pas automatiquement considéré comme une course chronométrée.

## Vérification

- `node scripts/test-session-flow.cjs` : progression après deux validations, modèles non instanciés, historique/doublons, fin de programme, séparation des programmes, formats et finishers, validation et aller-retour des scores, API transactionnelle.
- `scripts/test-session-integrity.sql` : tests sous le rôle authenticated et RLS, entièrement annulés par ROLLBACK. Vérifie la sauvegarde atomique, le score WOD seul, les rejets, l'idempotence et les protections d'historique.
- TypeScript et export Expo Android/iOS/web.
- Tests de régression ajoutés au workflow de pull request.

## Limites et contrôle sur appareil

Le parcours tactile n'a pas été testé sur un téléphone réel dans cet environnement. Vérifier à la réception de la mise à jour : terminer deux séances puis choisir la troisième, changer de semaine, quitter/reprendre une saisie, enregistrer un AMRAP, consulter son résultat puis parcourir EMOM et finisher.

Le brouillon reste sur l'appareil jusqu'à validation de la séance ; ce n'est pas une synchronisation en direct entre appareils. La reconnaissance des formats utilise les prescriptions actuelles. Un nouveau format ambigu reste un résultat libre à préciser, sans inventer de règle de score. Aucun test ne garantit l'absence de tous les bugs possibles.
