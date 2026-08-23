# Evolve Training V0.3 — authentification + Supabase

Cette version ajoute le branchement réel à Supabase.

## Ce qui est maintenant codé

- Connexion email/mot de passe
- Création de compte
- Session persistante sur mobile
- Déconnexion
- Client Supabase React Native
- API de lecture profil / séances / journal
- API d'écriture du journal
- API de sauvegarde des séries réalisées
- Protection de la navigation si non connecté
- SQL V0.3 avec création automatique du profil et RLS supplémentaire

## Il reste 2 informations que ChatGPT ne peut pas inventer

Il faut créer TON projet Supabase pour obtenir :

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Ces valeurs sont propres à ton projet.

## Installation

1. Crée un projet sur Supabase.
2. Dans SQL Editor, exécute `supabase/schema-v03.sql`.
3. Copie `.env.example` vers `.env`.
4. Mets ton URL Supabase et ta publishable key dans `.env`.
5. Lance :

```bash
npm install
npx expo start
```

## Test minimal

1. Créer un compte athlète depuis l'app.
2. Se connecter.
3. Vérifier qu'une ligne est créée dans `public.profiles`.
4. Se déconnecter.
5. Relancer l'app et vérifier la persistance de session après reconnexion.

## Prochaine étape

Relier les écrans `Accueil`, `Entraînement`, `Journal` et `Stats` aux vraies requêtes
de `src/lib/api.ts`, puis créer l'interface coach qui génère les programmes et
les attribue aux athlètes.
