# App Pilotage

Application Next.js deployable sur Vercel pour :

- saisir un bon de pilotage depuis un formulaire responsive ;
- generer un PDF a partir d'un template HTML fidele au modele ;
- envoyer le PDF par mail via Gmail SMTP ;
- historiser chaque bon dans Supabase ;
- conserver les suggestions et profils pilotes dans Supabase.

## Stack

- Next.js App Router
- Supabase Postgres
- Gmail SMTP
- Puppeteer Core + Chromium pour la generation PDF

## Demarrage local

1. Installer les dependances :

   ```bash
   npm install
   ```

2. Copier `.env.example` vers `.env.local` et renseigner les variables.

3. Lancer le serveur :

   ```bash
   npm run dev
   ```

4. Ouvrir `http://localhost:3000`.

## Deploiement Vercel

1. Creer un projet Vercel a partir du depot GitHub.
2. Ajouter les variables de `.env.example` dans `Settings > Environment Variables`.
3. Executer le SQL de [supabase/schema.sql](/c:/Users/viole/Documents/App_pilotage/supabase/schema.sql) dans Supabase.
4. Deployer.

## Base de donnees

Le schema SQL est dans [supabase/schema.sql](/c:/Users/viole/Documents/App_pilotage/supabase/schema.sql).

## Remarques

- Les suggestions et profils pilotes sont charges depuis Supabase via `GET /api/memory`.
- La route `POST /api/submissions` valide les donnees, stocke la soumission, genere le PDF puis l'envoie par mail.
- Apres un envoi reussi, `POST /api/submissions` met aussi a jour la memoire Supabase.
- En local, si Chromium n'est pas detecte automatiquement, renseigner `CHROME_EXECUTABLE_PATH`.

## Livraison vers Orange / Wanadoo

- Les messages identifient ELITE GUIDAGE, comprennent un corps texte et HTML ainsi que le PDF en pièce jointe.
- L'adresse `From` reste `GMAIL_USER` : Gmail assure la signature DKIM et l'infrastructure d'envoi. Ne pas la remplacer par une adresse `@orange.fr` non authentifiée par Gmail.
- Le statut `sent` indique que Gmail a accepté le message, pas que le serveur du destinataire l'a livré. Les rejets ultérieurs arrivent dans la boîte `GMAIL_USER`.
- Un rejet `OFR_506` signifie « suspicion de spam ». Il ne prouve pas un défaut SPF/DKIM/DMARC. Si le rejet persiste, conserver le message de non-remise (code, date, Message-ID) et suivre la [procédure Orange Postmaster](https://postmaster.orange.fr/#orange-error-codes).
