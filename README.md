# App Pilotage

Application Next.js deployable sur Vercel pour :

- saisir un bon de pilotage depuis un formulaire responsive ;
- générer un PDF à partir d'un template HTML fidèle au modèle ;
- envoyer le PDF par mail via Gmail SMTP ;
- historiser chaque bon dans Supabase.

## Stack

- Next.js App Router
- Supabase Postgres
- Gmail SMTP
- Puppeteer Core + Chromium pour la génération PDF

## Démarrage local

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Copier `.env.example` vers `.env.local` et renseigner les variables.

3. Lancer le serveur :

   ```bash
   npm run dev
   ```

4. Ouvrir `http://localhost:3000`.

## Déploiement Vercel

1. Créer un projet Vercel à partir du dépôt GitHub.
2. Ajouter les variables de `.env.example` dans `Settings > Environment Variables`.
3. Déployer.

## Base de données

Le schéma SQL est dans [supabase/schema.sql](/c:/Users/viole/Documents/App_pilotage/supabase/schema.sql).

## Remarques

- Le formulaire s'auto-sauvegarde localement sur l'appareil pour éviter de ressaisir les informations fréquentes.
- La route `POST /api/submissions` valide les données, stocke la soumission, génère le PDF puis l'envoie par mail.
- En local, si Chromium n'est pas détecté automatiquement, renseigner `CHROME_EXECUTABLE_PATH`.
