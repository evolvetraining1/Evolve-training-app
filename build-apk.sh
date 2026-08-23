#!/usr/bin/env bash
set -e
echo "=== Evolve Training - création APK Android ==="
echo "1/3 Installation des dépendances"
npm install
echo "2/3 Installation de EAS CLI"
npm install -g eas-cli
echo "3/3 Lancement de la compilation APK"
echo "EAS va demander une connexion/creation de compte Expo."
eas build --platform android --profile preview
