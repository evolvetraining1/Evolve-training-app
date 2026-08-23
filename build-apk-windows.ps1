Write-Host "=== Evolve Training - création APK Android ==="
Write-Host "1/3 Installation des dépendances"
npm install
Write-Host "2/3 Installation de EAS CLI"
npm install -g eas-cli
Write-Host "3/3 Lancement de la compilation APK"
Write-Host "EAS va demander une connexion/creation de compte Expo."
eas build --platform android --profile preview
