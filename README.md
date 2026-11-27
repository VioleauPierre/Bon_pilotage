# Bon Pilotage · ELITE GUIDAGE

Le formulaire public enregistre les bons et mémorise les suggestions utilisées par les pilotes. L’espace `/admin` permet aux administrateurs autorisés de retrouver les bons enregistrés, de suivre leur consultation et de récupérer les documents.

## Démarrage local

1. Utiliser Node.js 22.17 ou une version plus récente de la branche 22, ou Node.js 24.
2. Exécuter `npm ci`, puis copier [`.env.example`](.env.example) vers `.env.local`.
3. Configurer un projet Supabase de test et suivre l’ordre SQL ci-dessous.
4. Exécuter `npm run dev` et ouvrir `http://localhost:3000`. Si Chrome est introuvable, spécifier `CHROME_EXECUTABLE_PATH`.
5. Lancer `npm run lint`, `npx tsc --noEmit` après `npx next typegen` et `npm run build`.

## Supabase et Vercel

Sur la base existante, ouvrir **SQL Editor** et exécuter les fichiers suivants dans cet ordre, après revue de la PR.

1. [`supabase/preflight-admin.sql`](supabase/preflight-admin.sql) en lecture seule. Vérifier les colonnes existantes, l’état de RLS, les politiques et le nombre de références de bon réutilisées.
2. [`supabase/migrations/202611250001_admin_dashboard.sql`](supabase/migrations/202611250001_admin_dashboard.sql). La migration conserve les bons historiques et crée les tables de mémorisation si elles sont absentes. Elle applique l’unicité aux empreintes des nouvelles soumissions. Les mêmes numéros de bon historiques restent utilisables.
3. [`supabase/migrations/202611260001_archive_test_submissions.sql`](supabase/migrations/202611260001_archive_test_submissions.sql). La migration archive les bons existants dont la date de prestation est antérieure au 7 juin 2026. Les bons archivés sont exclus de l’historique, des indicateurs et des exports.
4. [`supabase/migrations/202611260002_admin_invitations.sql`](supabase/migrations/202611260002_admin_invitations.sql). La migration crée le stockage privé des invitations et empêche plusieurs activations simultanées.
5. Relancer le contrôle préalable et vérifier que RLS est actif pour les tables concernées. Tester le parcours dans un environnement isolé avec des données fictives. Pour une base vide, exécuter [`supabase/schema.sql`](supabase/schema.sql) avant le contrôle préalable et les migrations.

Dans Supabase, ouvrir **Authentication → Users → Add user**, créer l’administrateur principal avec son adresse e-mail et un mot de passe unique, puis confirmer son adresse lors de la création. Copier l’UUID de cet utilisateur. Dans **Authentication → Settings**, désactiver les nouvelles inscriptions, conserver le fournisseur **Email** et autoriser les sessions simultanées. Dans **URL Configuration**, renseigner l’URL de l’application comme **Site URL**. [Configuration Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).

Sur le projet Vercel existant, renseigner les variables suivantes dans **Settings → Environment Variables**. Utiliser un projet Supabase de test pour les déploiements de prévisualisation.

| Variable | Valeur ou usage |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé privée de rôle de service. Conserver la clé côté serveur. |
| `SUPABASE_PUBLISHABLE_KEY` | Clé publiable Supabase, ou clé historique `anon`, pour la connexion. |
| `ADMIN_SUPABASE_USER_ID` | UUID de l’administrateur principal dans Supabase Auth. |
| `ADMIN_SUPABASE_SECOND_USER_ID` | Facultatif. UUID distinct du second administrateur dans Supabase Auth. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFICATION_EMAIL` | Requises quand l’envoi automatique est activé. |
| `CHROMIUM_REMOTE_EXEC_PATH` | Optionnel. S’il existe déjà dans Vercel, utiliser une archive x64 compatible avec la version de Chromium installée dans le dépôt. |

Configurer le projet pour Node.js 22 ou 24. Si `BON_PILOTAGE_TABLE` est déjà renseignée, vérifier qu’elle désigne `bon_pilotage_submissions`. La migration doit précéder le passage à cette version. Le paramètre initial conserve l’envoi automatique. Depuis **Administration → Paramètres**, désactiver l’envoi si nécessaire. Ce mode fonctionne sans variables Gmail et sans lancer Chromium lors d’une soumission.

### Invitation manuelle du second administrateur

1. Depuis un environnement serveur de confiance, créer l’utilisateur Supabase Auth avec `supabase.auth.admin.createUser({ email })`. Renseigner son UUID dans `ADMIN_SUPABASE_SECOND_USER_ID` sur Vercel et déployer la configuration.
2. Générer un jeton aléatoire de 32 octets et l’encoder en hexadécimal. Dans `bon_pilotage_admin_invitations`, renseigner `user_id`, `token_digest` (l’empreinte SHA-256 hexadécimale du jeton) et `expires_at` (la date d’expiration avec son fuseau). Envoyer le lien privé `https://<domaine>/admin/invitation#type=invite&token_hash=<jeton>` à l’adresse du compte.
3. Le lien reste utilisable jusqu’à l’échéance ou jusqu’à l’enregistrement du mot de passe. Le destinataire se connecte ensuite sur `/admin`. Si une invitation expire avant l’activation, renouveler le jeton et l’échéance pour cet UUID. Pour un compte déjà activé, utiliser le parcours de récupération de Supabase Auth. [Récupération du mot de passe](https://supabase.com/docs/guides/auth/passwords#resetting-a-password).

En cas de perte d’un appareil, se connecter depuis un appareil sûr et utiliser **Paramètres → Déconnecter les autres appareils**. L’appareil utilisé conserve sa session. Si un mot de passe a pu être enregistré sur l’appareil perdu, le changer via Supabase Auth après avoir révoqué les sessions. Contrôler l’accès depuis un deuxième appareil. [Sessions Supabase](https://supabase.com/docs/guides/auth/sessions).

## Fonctionnement

- **Transmission.** L’enregistrement est la condition de réussite du formulaire. L’envoi et la mise à jour de la mémoire s’effectuent après l’enregistrement. Un clic répété avec les mêmes données retourne le bon déjà enregistré. Le statut « Mail accepté par Gmail » décrit la réponse SMTP. Les rejets ultérieurs arrivent dans la boîte Gmail. [Codes d’erreur Orange](https://postmaster.orange.fr/#orange-error-codes).
- **Suggestions.** La route publique renvoie jusqu’à huit transporteurs, huit villes de départ et huit villes d’arrivée. Les profils sont mis à jour côté serveur et ne sont pas renvoyés publiquement.
- **Historique.** La liste est triée par transmission et paginée par 20. Les périodes se fondent sur la date de prestation et le mois calendaire de Paris. Le total kilométrique couvre la période, y compris quand une recherche ou un filtre de consultation restreint la liste.
- **PDF.** Le numéro et les valeurs proviennent du bon enregistré. La version du modèle et le repère communiqué dans les PDF sont fixés lors de la transmission des nouveaux bons. Le repère est formaté en UTC, comme le rendu historique sur Vercel. Pour un bon ancien, l’heure d’enregistrement peut être affichée comme telle lorsque l’heure de génération n’est pas archivée. Les champs historiques manquants sont signalés. Toute évolution visuelle future doit ajouter un nouveau modèle dans `lib/bon-pilotage-pdf.ts` et conserver les versions précédentes. Aucun PDF n’est stocké par défaut.
- **Exports.** Le ZIP est limité à 8 bons et 4 Mo. Si une période est plus grande, la fractionner ou cocher les bons sur une page. Le CSV utilise UTF‑8 avec BOM et des points-virgules. Il est limité à 5 000 lignes et 4 Mo. [Limites des fonctions Vercel](https://vercel.com/docs/functions/limitations).
- **Évolution PWA.** Le manifeste du formulaire reste en place. Un futur manifeste d’administration pourra prendre `/admin` comme `start_url`. Le signal de notification doit partir d’une nouvelle insertion réussie, avant toute opération SMTP. Les futurs abonnements devront être rattachés à l’UUID administrateur et à un identifiant par appareil. Le service worker devra laisser les pages et documents privés hors du cache.

## Validation avant mise en production

1. Sur ordinateur, ouvrir le formulaire en navigation privée. Soumettre un bon de test en vérifiant les suggestions et le message de confirmation. Refaire le parcours avec l’envoi désactivé, puis avec une panne SMTP simulée. Sur la base isolée, rendre Supabase inaccessible et vérifier que le formulaire affiche une erreur sans effacer la saisie. Relancer une soumission identique et contrôler l’absence de doublon.
2. Ouvrir `/admin` sans session, puis avec un compte de test non autorisé. Vérifier que l’accès à la liste et aux URL PDF, CSV et ZIP est refusé. Se connecter avec le compte autorisé et fermer puis rouvrir le navigateur.
3. Sur iPhone, ouvrir l’URL de test dans Safari et se connecter pendant que la session sur ordinateur reste ouverte. Vérifier les cartes, la navigation et les actions sans défilement horizontal. Ouvrir un PDF, puis utiliser **Partager → Enregistrer dans Fichiers**. Tester aussi le téléchargement direct.
4. Consulter un bon sur un appareil et actualiser l’autre. Vérifier le statut de consultation et la remise en non lu. Tester une recherche, chaque période, la pagination, un PDF ancien, le ZIP d’une sélection et du résultat filtré, puis ouvrir le CSV dans Excel.
5. Dans **Paramètres**, révoquer les autres sessions. Revenir sur le deuxième appareil et vérifier qu’il faut s’y reconnecter.

## Ordre de grandeur des ressources

Pour 100 bons par mois, compter environ 0,2 à 1 Mo de données de bons hors index et historique technique. Les suggestions et profils sont mis à jour par clé et leur volume suit le nombre de valeurs distinctes. Une transmission effectue une lecture du paramètre, un enregistrement et des mises à jour de mémoire. L’envoi ajoute un rendu et une mise à jour de statut. Un PDF téléchargé correspond à un rendu Chromium et un ZIP à un rendu par bon. Sans envoi automatique, seuls les téléchargements mobilisent Chromium. Mesurer les durées et tailles réelles en prévisualisation Vercel, notamment le premier téléchargement à froid.
