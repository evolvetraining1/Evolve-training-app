# Evolve Training — MVP mobile

Prototype fonctionnel local pour valider la navigation et le parcours critique athlète.

## Fonctionnalités incluses

- Accueil athlète
- Navigation 5 onglets
- Programme / séance du jour
- Saisie séries, reps, charge et RPE
- Validation de séance
- PR / statistiques simples
- Journal quotidien
- Aperçu nutrition
- Profil et modules actifs

Les données sont mockées et conservées uniquement en mémoire pendant l'exécution.
La prochaine étape sera de brancher Supabase.

## Lancer le projet

Le moyen le plus sûr est de partir d'un projet Expo SDK 57 neuf, puis de remplacer son dossier `app` et d'ajouter `src`.

```bash
npx create-expo-app@latest evolve-training --template default@sdk-57
cd evolve-training
```

Copiez ensuite les dossiers `app` et `src` de ce prototype dans le projet créé.

Puis :

```bash
npx expo start
```

Ouvrez avec Expo Go sur Android/iOS, ou utilisez un émulateur.

## Parcours à tester

1. Accueil
2. Commencer la séance
3. Modifier les séries du Back Squat
4. Valider la séance
5. Aller dans Stats
6. Ouvrir Journal
7. Consulter Nutrition

## Architecture

`app/` = navigation Expo Router  
`src/components/` = composants UI  
`src/data/` = données mock  
`src/store/` = état local du prototype  
`src/theme.ts` = design system Evolve


## Générer un APK installable

Le projet contient désormais un profil EAS `preview` configuré pour produire un `.apk`
installable directement sur Android.

### Windows

Dans PowerShell, dans le dossier du projet :

```powershell
.\build-apk-windows.ps1
```

### macOS / Linux

```bash
chmod +x build-apk.sh
./build-apk.sh
```

EAS demandera une connexion ou la création gratuite d'un compte Expo, puis lancera
la compilation à distance. À la fin, Expo fournit une page de build depuis laquelle
l'APK peut être téléchargé et installé sur Android.

Commande manuelle équivalente :

```bash
npm install
npm install -g eas-cli
eas build --platform android --profile preview
```
