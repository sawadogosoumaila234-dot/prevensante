# DEPLOIEMENT — PrevEnSanté

> **Statut de ce document** : procédure. Aucun déploiement n'est décrit ici comme déjà réalisé.
> Les sections marquées **[À FAIRE]** sont des étapes à exécuter et à tracer par l'opérateur.
>
> **Sources de vérité** : `ANALYSE-GLOBALE-PREVSANTE.md` (sections 9, 10, 16, 19.1, 19.2) et
> `SAWADOGO Emmanuel_PRD_PrevEnSanté.md` (section 7 : « Modalités de stockage, sauvegarde et
> hébergement à définir »).
>
> **Pile cible** : front React 19 + Vite + TypeScript (dossier `web/`, sortie `web/dist`) ;
> base Supabase (Postgres, 20 tables métier en schéma `public`) ; Edge Functions Supabase ;
> hébergement front Vercel.

---

## 1. Vue d'ensemble

| Composant | Technologie | Où c'est déployé | Livrable de ce déploiement |
|---|---|---|---|
| Application web (PWA) | React 19 + Vite + TypeScript | Vercel (build `npm --prefix web run build`, sortie `web/dist`) | URL publique de production |
| Base de données | Supabase Postgres | Supabase Cloud (région la plus proche des utilisateurs) | 20 tables en schéma `public` + RLS |
| Authentification | Supabase Auth (email + mot de passe, MFA TOTP) | Supabase Cloud | Comptes et rôles |
| Stockage fichiers | Supabase Storage, 4 buckets privés | Supabase Cloud | Photos de signalement, preuves, consignes, pièces médicales |
| Fonctions serveur | Supabase Edge Functions (Deno) | Supabase Cloud | 8 fonctions déployées |
| Planification | `pg_cron` dans Supabase Postgres | Supabase Cloud | Dispatch d'outbox toutes les minutes, digest hebdomadaire |

**Deux Environnements distincts** : un environnement de recette/test et un environnement de
production. Les identifiants (`project-ref`, clés) diffèrent. Un test d'email envoyé en recette
n'atteint pas un salarié de production.

---

## 2. Mise en place Supabase

### 2.1 Création du projet

1. Créer le projet sur Supabase Cloud avec la **région la plus proche des utilisateurs**
   (arbitrage A10, tranché le 02/11/2026 : Supabase Cloud, région Europe / Paris `eu-west-3` —
   voir § 9).
2. Noter le `project-ref` : il apparaît dans l'URL du dashboard et dans
   `https://<project-ref>.supabase.co`.
3. Consigner le `project-ref` dans le gestionnaire de secrets de la plateforme, **pas** dans un
   fichier versionné.

### 2.2 Extensions

Activer dans le SQL Editor (ou via `supabase db push` qui exécute `0001_extensions_enums.sql`) :

| Extension | Rôle dans PrevEnSanté |
|---|---|
| `pgcrypto` | Génération d'identifiants UUID et de fonctions de hachage |
| `pg_cron` | Planification de `dispatch-outbox` (chaque minute) et du digest hebdomadaire |
| `pg_net` | Appels HTTP sortants depuis Postgres (déclenchement des Edge Functions) |

Vérification :

```sql
select extname, extversion from pg_extension
where extname in ('pgcrypto','pg_cron','pg_net');
```

Les trois lignes doivent être présentes.

### 2.3 Authentification : email + MFA TOTP

Dans **Supabase Dashboard > Authentication** :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Providers > Email | Activé | Seul mode d'authentification du MVP |
| Confirm email | **On** | Évite les comptes fantômes |
| Email template « Invite User » | Gabarit `account_invitation` (§ 14.2, E13) | Invitation par email (N23) |
| Email template « Reset Password » | Gabarit `password_reset` (E14) | Réinitialisation (N24) |
| MFA > TOTP | Autorisé | Second facteur obligatoire (section 6.3 de l'analyse) |
| Rate limits | Valeurs par défautSupabase | Protection contre le bourrage d'identifiants |

**Règles d'imposition du MFA** (section 6.3) : le MFA TOTP est **exigé** pour les rôles
`hse_officer`, `occupational_physician`, `site_director` et `admin`. Les rôles `worker`,
`supervisor`, `maintenance_lead`, `action_owner` en sont dispensés dans le MVP.
Enrôlement : `/settings/security` → « Enable MFA » → QR code `otpauth://` →
code à 6 chiffres → **10 codes de secours affichés une seule fois** → confirmation de sauvegarde.

> Le SMS n'est **pas** un second facteur : c'est un canal de notification réservé aux escalades
> critiques (section 10.4).

### 2.4 Migrations

Les migrations s'appliquent dans l'ordre `0001` → `0022`. Chaque fichier a une dépendance
explicite des précédents ; **ne jamais les appliquer dans le désordre ni en sauter**.

| # | Fichier | Contenu |
|---|---|---|
| 0001 | `0001_extensions_enums.sql` | extensions + 17 enums + 2 séquences |
| 0002 | `0002_organizations_sites_profiles.sql` | `organizations`, `sites`, `profiles` |
| 0003 | `0003_zones_equipments_categories.sql` | `zones`, `equipments`, `risk_categories` |
| 0004 | `0004_safety_events.sql` | `safety_events`, `safety_event_logs` |
| 0005 | `0005_corrective_actions_escalations.sql` | `corrective_actions`, `escalations` |
| 0006 | `0006_documents_ai_proposals.sql` | `safety_documents`, `document_versions`, `ai_proposals` |
| 0007 | `0007_medical_records_worked_hours.sql` | `medical_records`, `site_worked_hours` |
| 0008 | `0008_notifications_outbox.sql` | `notifications`, `email_outbox`, `sms_outbox` |
| 0009 | `0009_audit_settings.sql` | `audit_log`, `app_settings` |
| 0010 | `0010_rls_helpers.sql` | fonctions helper `SECURITY DEFINER` (avec `search_path` explicite) |
| 0011 | `0011_rls_policies.sql` | policies RLS par table et par rôle |
| 0012 | `0012_storage_buckets.sql` | 4 buckets privés + policies Storage |
| 0013 | `0013_triggers.sql` | triggers métier |
| 0014 | `0014_functions_rpc.sql` | RPC publiques et métier |
| 0015 | `0015_views.sql` | vues opérationnelles et KPI (`v_dashboard_kpi`, `v_overdue_actions`, `v_recurrent_risks`, `v_accident_rate`) |
| 0016 | `0016_seed.sql` | site pilote, référentiels, comptes de test |
| 0017 | `0017_seed_sequences.sql` | aligne les séquences de référence sur le seed (sinon le premier signalement réel entre en collision de clé) |
| 0018 | `0018_auth_identites_recette.sql` | identités Auth des comptes de recette (correctif instance réelle) |
| 0019 | `0019_auth_colonnes_texte.sql` | colonnes texte non nullables de `auth.users` (correctif instance réelle) |
| 0020 | `0020_auth_colonnes_texte_restantes.sql` | colonnes texte restantes de `auth.users` (correctif instance réelle) |
| 0021 | `0021_arbitrage_a3_verification_habilitee.sql` | arbitrage A3 : seul un vérificateur habilité peut clôturer une action |
| 0022 | `0022_escalade_notification_hse.sql` | escalade critique déclenchée au triage + notification dans l'application, e-mail et SMS en file d'attente |

Procédure :

```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>

# Toujours relire avant d'écrire en production
supabase db push --dry-run
supabase db push              # applique 0001..0022

# Contrôle de non-régression RLS — sans conteneur, sur la machine
npm run db:test               # exécute supabase/tests/rls.sql dans PGlite

# Même contrôle, sur l'instance Supabase cible
supabase test db
```

**Procédure outillée et horodatée** — la même séquence, mais replayée, contrôlée et
tracée dans un rapport (`docs/rapports/PUBLICATION-<date>.md`) :

```bash
# 1. Simulation : chaîne de validation locale + plan de migration, rien n'est écrit
npm run base:publier -- --ref <PROJECT_REF>

# 2. Application, après relecture du plan affiché
npm run base:publier -- --ref <PROJECT_REF> --confirm
```

Le script rejoue d'abord toute la validation locale (typage, build, tests,
migrations, RLS, audit, contrôle de déploiement), puis exige `db push --dry-run`
avant tout `db push`, puis vérifie l'instance avec `tools/verifier-base.mjs`. Il
n'emploie aucune commande destructive et n'écrit aucun secret dans le rapport.
Voir `tools/README.md` § 2.

**Points de vigilance**

- `0010` crée des fonctions `SECURITY DEFINER` : elles doivent avoir un `search_path` explicite
  (garde-fou R3, anti-récursion sur `profiles`).
- `0011` active la RLS sur les **20 tables métier**. Vérification :

```sql
select relname from pg_class
where relnamespace = 'public'::regnamespace and relrowsecurity
order by relname;
```

- `0013` installe `guard_action_transition` et `ai_proposal_review_guard` : ne pas les neutraliser.
- Les scripts de rollback de chaque migration sont notés dans
  `supabase/migrations/README.md` (section 16.5).

### 2.5 Seed (données de référence)

Le seed `0016_seed.sql` est **idempotent** (`on conflict do nothing`). En local :

```bash
supabase db reset     # applique migrations + seed
```

En production, appliquer le seed via `psql` sur l'hôte (jamais `db reset` sur la production) :

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0016_seed.sql
```

Contenu du seed : 1 organisation (`Cimenterie du Sahel`), 1 site pilote (`Usine de Soumbo`, code
`SMB`), 3 zones (`Crusher hall`, `Kiln area`, `Conveyor gallery`), 2 équipements critiques
(`Primary crusher`, `Gallery conveyor CV-12`), 5 catégories de risques, 2 consignes (1 `validated`,
1 `draft`), les heures travaillées du mois, les réglages `app_settings` (`pilot.site_id`,
`escalation.chain`, `assistant.mode`, `email.mode`, `sms.mode`).

> **Le seed de test crée des comptes avec un mot de passe de test connu.** Ces comptes
> (`admin@`, `hse@`, `worker@`, `maintenance@`, `physician@`, `director@`) sont **uniquement pour
> l'environnement de test**. En production, créer les comptes par le back-office (§ 2.8) et
> **désactiver ou supprimer les comptes de test**.

### 2.6 Storage — 4 buckets privés

Tous les buckets sont **privés** (`public = false`). Les images sont servies par **URL signée
d'une durée de 15 minutes** (garde-fou R12).

| Bucket | Contenu | Écriture | Lecture |
|---|---|---|---|
| `event-photos` | Photos jointes aux signalements | Le déclarant du signalement | Périmètre RLS du site |
| `action-evidence` | Preuves de clôture des actions correctives | Le responsable de l'action | Périmètre RLS du site |
| `safety-documents` | PDF des consignes de sécurité | HSE ou admin | Uniquement si le document est `validated` |
| `medical-evidence` | Pièces de santé liées à un événement | Médecin du travail | Uniquement si `can_view_medical()` est vrai |

Les buckets et leurs policies sont créés par la migration `0012_storage_buckets.sql` ; il n'y a donc
rien à créer manuellement en plus de l'application de la migration. Contrôle :

```sql
select id, name, public from storage.buckets order by id;
-- les 4 lignes doivent avoir public = false
```

`medical-evidence` est le seul bucket contenant des pièces de santé : il est **hors du périmètre**
opérationnel du personnel HSE.

### 2.7 Edge Functions — spécifiées, non implémentées

L'analyse et le PRD décrivent 8 fonctions Edge (Deno) côté Supabase :

| Fonction | Rôle | Déclencheur |
|---|---|---|
| `dispatch-outbox` | Lit `email_outbox` + `sms_outbox`, envoie, met à jour le statut | `pg_cron`, chaque minute |
| `send-email` | Envoi SMTP d'un gabarit | Appel interne |
| `send-sms` | Envoi SMS (canal HSE) | Appel interne (escalades critiques) |
| `propose-classification` | Proposition IA de catégorie | Bouton `Ask the assistant` |
| `lookup-instruction` | Recherche dans les consignes `validated` | Bouton `Find a validated instruction` |
| `invite-user` | Création de compte + invitation | Back-office `/admin/users` |
| `export-report` | Export CSV/JSON des indicateurs | Back-office / HSE |
| `escalate-critical` | Création de la chaîne d'escalade | Événement critique |

> **⚠ Aucune de ces huit fonctions n'est présente dans ce dépôt** : `supabase/functions/` est
> absent. Les commandes `supabase functions deploy <nom>` ci-dessous échoueront donc en l'état.
>
> **L'application n'en dépend pas** : elle parle directement à PostgreSQL via PostgREST et
> PostgRPC (`web/src/lib/api.ts`, `web/src/lib/mutations.ts`), sans jamais appeler
> `functions/v1`. Ce qui reste est déjà couvert autrement :
>
> | Fonction | État réel | Comportement actuel |
> |---|---|---|
> | `dispatch-outbox`, `send-email`, `send-sms` | non implémentée | les e-mails et SMS restent en file d'attente et sont consultables dans `/admin/outbox` — c'est le **mode `mock`**, le réglage par défaut du seed |
> | `propose-classification` | non implémentée | l'assistant fonctionne en mode `rules` (`app_settings.assistant.mode = 'rules'`), repli local sans fournisseur |
> | `lookup-instruction` | non implémentée | la recherche de consigne interroge `safety_documents` directement ; la RLS `safety_documents_select_validated` garantit qu'un salarié ne voit que les consignes `validated` |
> | `export-report` | non implémentée | l'export CSV est produit **côté navigateur** (`web/src/components/DataTable.tsx`) |
> | `invite-user` | non implémentée | l'invitation se fait depuis le back-office `/admin/users`, via le trigger `handle_new_user` (`0013`) |
> | `escalate-critical` | non implémentée | l'escalade est créée **par la base** : le trigger `escalate_critical_event` (`0013`) sur insertion d'un événement critique |
>
> **Conséquence sur le pilote** : aucune. Le mode `mock` est le réglage par défaut du seed
> (`email.mode`, `sms.mode`), et la recette CR01→CR07 se conduit intégralement sans ces
> fonctions. Les implémenter est un **choix d'arbitrage A7**, pas une étape de mise en production.
>
> Si elles sont décidées, voici le squelette attendu (contrats communs) :

Contrats communs, à respecter par toute évolution :

- En-tête `Authorization: Bearer <token>` vérifié + rôle attendu contrôlé.
- **Idempotence** par le statut de l'outbox et la colonne `provider_message_id`.
- Erreurs renvoyées en JSON `{ error: { code, message } }` — **jamais de stack trace**.
- Aucun traitement ne contourne le contrôle de rôle ni le périmètre de site.

Variables côté Edge Functions (à injecter via `supabase secrets set`) : voir § 7.

### 2.8 Premier administrateur et organisation

1. Créer le compte du premier administrateur (Supabase Dashboard > Authentication > Add user, ou
   script SQL sur `auth.users` puis `profiles`).
2. Passer `profiles.role = 'admin'` et renseigner `profiles.organization_id`.
3. Créer l'organisation et le **site pilote** (`sites.is_pilot = true`), ses zones et ses
   équipements.
4. Renseigner les catégories de risques du secteur du site (`risk_categories`).

### 2.9 Planification `pg_cron`

| Tâche | Planning | Commande cible |
|---|---|---|
| Dispatch de l'outbox | **Toutes les minutes** | `dispatch-outbox` avec `{ "limit": 50 }` |
| Digest hebdomadaire | **Lundi 07:00 UTC** | Envoi du gabarit `weekly_digest` (N26) |

Vérification :

```sql
select jobid, schedule, jobname, active from cron.job order by jobid;
```

### 2.10 SMTP (email)

Tant que le commanditaire n'a pas fourni de SMTP, l'application fonctionne en **mode `mock`** :
les e-mails sont écrits dans `email_outbox` et consultables dans `/admin/outbox`, sans erreur.

Passage en `live` :

1. Renseigner le SMTP dans **Supabase Dashboard > Authentication > SMTP** avec les valeurs
   fournies par le commanditaire.
2. Positionner `EMAIL_MODE=live` (variable Edge Function + `app_settings` → `email.mode`).
3. Envoyer un e-mail de test vers une adresse de recette et vérifier qu'il apparaît en `sent`
   dans `/admin/outbox`.

En mode `mock`, aucun e-mail réel n'est envoyé : les lignes restent visibles dans `/admin/outbox`
(règle de silence du mode `mock`, section 14.5).

---

## 3. Mise en place Vercel

> **État au 02/11/2026 — le projet est en service.** L'application est déployée en production
> sur **https://prevensante.vercel.app** (déploiement `prevensante-e3z6g9jgq`, build 33 s) ; la
> base est publiée sur l'instance Supabase `prevensante` (§ 2.4) et les variables `VITE_*` sont
> posées sur Production, Preview et Development. Le déploiement du 25/10
> (`prevensante-a6tcba9i8`) n'avait transmis que **10 fichiers** — le dossier `web/` n'existait
> pas encore : il ne servait que le routeur API et toute route d'application renvoyait 404. Il a
> été remplacé.
>
> **Comptes de démonstration.** Le seed `0016` crée 8 comptes dont les mots de passe sont écrits
> en clair dans le code source ; l'URL de production étant accessible publiquement, ces huit mots
> de passe ont été changés sur l'instance le 02/11/2026. Les nouveaux se trouvent dans
> `.env.comptes.local` — fichier ignoré par git (`.env*`) **et** par `.vercelignore` (`.env.*`),
> donc jamais transmis. Attention : réappliquer le seed réactive les mots de passe publics. Ces
> comptes doivent être supprimés ou désactivés avant la mise en service réelle (§ 2.5 et § 2.8).
>
> **Configuration validée sur un déploiement réel** (28/10/2026) :
> `https://prevensante-kiw0zikg1-sawadogosoumaila234-5698.vercel.app` (prévisualisation).
> Le build passe (49 s), la SPA est servie, `/login` retombe bien sur `index.html` et
> `/api/health` renvoie `{"statut":"ok",…}`. Ce déploiement avait d'abord **échoué** :
> le motif `supabase/` de `.vercelignore`, non ancré, excluait aussi
> `web/src/lib/supabase/client.ts` — le client Supabase du front — et le build s'arrêtait sur
> `TS2307: Cannot find module './supabase/client'`. Les motifs de `.vercelignore` sont désormais
> ancrés (`/supabase/`, `/docs/`, `/tools/`…) et `tools/verifier-deploiement.mjs` contrôle le
> **graphe d'imports complet du front**, ce qui garantit qu'un motif trop large est refusé.

```bash
npm i -g vercel
vercel whoami            # vérifier la session
vercel link              # relier le dépôt au projet Vercel
vercel build             # valider le build en local, sans déployer
vercel deploy            # prévisualisation
vercel deploy --prod     # production
```

> `vercel build` lance `cmd.exe` via `@vercel/static-build` et échoue sur certaines machines
> Windows. Le contrôle local § 3.1 couvre les mêmes points, hors ligne, et fonctionne partout.

**Configuration attendue dans `vercel.json`** (déjà présente dans le dépôt) :

```json
{
  "framework": null,
  "buildCommand": "npm --prefix web run build",
  "outputDirectory": "web/dist",
  "installCommand": "npm install && npm --prefix web install",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Points à vérifier :

- La **sortie statique** est `web/dist` (build Vite), et non la racine du dépôt.
- La **réécriture SPA** (`/((?!api/).*)` → `/index.html`) est obligatoire : le front utilise
  `BrowserRouter`, donc sans elle un rafraîchissement sur `/hse/events` ou `/my-reports` renvoie
  404. La route `/api/*` doit rester traitée par la fonction serverless : le motif l'exclut.
- `.vercelignore` exclut `docs/`, `README.md`, `test/`, `supabase/`, `tools/`, `web/e2e/`,
  `.github/` et `.env*` : les documents internes, le schéma SQL, l'outillage et les identifiants du
  jeu de recette ne doivent jamais être servis publiquement ni transmis au build.
- `server/` est en revanche **conservé** : la fonction `api/index.js` en importe le routeur. Une
  exclusion excessive casserait le déploiement — c'est ce que contrôle le vérificateur ci-dessous.

### 3.1 Contrôle local de la configuration

```bash
npm run deploiement:verifier
```

Équivalent hors ligne de `vercel build && find .vercel/output/static -type f`. Le contrôleur
(`tools/verifier-deploiement.mjs`) vérifie :

| Contrôle | Ce qu'il attrape |
|---|---|
| Fichiers transmis | Un document interne, un script SQL ou un `.env*` qui part en ligne |
| Sortie statique | Un fichier servi qui ne devrait pas l'être |
| Intégrité du code | Un import de la fonction serverless qui ne se résout pas, ou un fichier dont le build a besoin exclu par erreur |
| Repli SPA | L'absence de réécriture vers `index.html` (404 sur route profonde au rafraîchissement) |
| Commande de build | Un `buildCommand` qui ne correspond à aucun script de `package.json` |

Sortie non nulle si une seule alerte est levée. La commande tourne dans le job `validation` de la
CI, et son propre comportement est vérifié par `test/deploiement.test.js` (dépôts de synthèse
volontairement dégradés).

Variables Vercel (section 16.2) :

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_APP_NAME production      # "PrevEnSante"
```

- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont préfixées `VITE_` car elles sont lues par
  le bundler.
- **`SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être présente côté front** (règle 9 du README
  projet). Elle n'est déclarée que comme secret Edge Function.
- Les variables se récupèrent avec `vercel env pull .env.local` ; elles ne se recopient pas à la main.

#### Deux pièges qui cassent un déploiement sans le dire

**Un BOM dans la valeur d'une variable.** Le caractère `U+FEFF` est invisible à l'écran : il peut se
glisser dans une valeur et être embarqué tel quel dans le bundle. Le build passe, la CI passe, le
site s'affiche — mais l'application ne parle plus à la base : `new URL()` refuse une URL précédée
d'un BOM (`Invalid URL`), et le formulaire de connexion affiche « The email address or the
password is incorrect » **même avec les bons identifiants**, parce qu'aucun appel à l'instance
n'est jamais parti. Le contrôle après déploiement doit donc vérifier que l'application **joint**
l'instance, pas seulement qu'elle s'affiche. Un `pipe` de PowerShell vers une commande native
ajoute un BOM : privilégier `cmd /c "type fichier | vercel env add ..."` avec un fichier écrit
sans BOM, et relire `vercel env pull` avant de déployer.

**L'auteur du commit.** Vercel compare l'auteur du commit local à l'adresse du compte qui
déploie. Si elles diffèrent, le déploiement est refusé (« the commit author doesn't have
permission to create deployments for this project ») et **le déploiement précédent reste en
ligne** : la correction n'est visible qu'après un redéploiement réussi. Les déploiements
construits avec `--prebuilt` ne portent pas de métadonnée git et passent donc toujours.
`git config user.email` doit être l'adresse vérifiée du compte Vercel.

**Vérification post-déploiement** : ouvrir l'URL de production, se connecter, et contrôler dans le
bundle servi qu'aucune occurrence de `service_role` n'est présente (voir § 6.4).

---

## 4. Checklist opérateur — section 19.2 (13 étapes)

La checklist d'opérateur de l'analyse (section 19.2) énumère 16 points. Elle est reprise ici en
**13 étapes numérotées**, les points 14 à 16 de l'analyse étant regroupés ou traités en § 5 et § 8
de ce document. La table de correspondance est fournie juste après.

| # | Étape | Statut |
|---|---|---|
| 1 | Créer le projet Supabase (région la plus proche des utilisateurs) et **noter le `project-ref`** | ☐ |
| 2 | Activer les extensions `pgcrypto`, `pg_cron`, `pg_net` | ☐ |
| 3 | Configurer l'authentification : provider `Email`, **confirmation d'e-mail ON**, **MFA TOTP autorisé** | ☐ |
| 4 | Appliquer les migrations **0001 → 0022** dans l'ordre (`supabase db push --dry-run` puis `supabase db push`) | ☐ |
| 5 | Exécuter le seed (`supabase db reset` en local ; `psql` sur l'hôte en production) | ☐ |
| 6 | Créer le premier administrateur (`profiles.role = 'admin'`) et l'affecter à une organisation | ☐ |
| 7 | Créer l'organisation et le **site pilote** (`sites.is_pilot = true`), ses zones et ses équipements | ☐ |
| 8 | Renseigner les **catégories de risques** du secteur du site (`risk_categories`) | ☐ |
| 9 | Charger le **corpus de consignes** et le **valider par un référent** (`status = 'validated'`, `validated_by`, `validated_at`) — condition préalable à l'assistant | ☐ |
| 10 | Configurer le SMTP (Dashboard > Authentication > SMTP) puis passer `EMAIL_MODE=live` | ☐ |
| 11 | Configurer `pg_cron` : `dispatch-outbox` **chaque minute**, digest hebdomadaire **lundi 07:00 UTC** | ☐ |
| 12 | Activer l'assistant : `AI_MODE=rules` (sans fournisseur) ou `AI_MODE=live` avec `AI_API_BASE`, `AI_API_KEY`, `AI_MODEL` | ☐ |
| 13 | Connecter le dépôt Git à Vercel, définir les variables `VITE_*`, déployer, puis **vérifier** la chaîne complète (voir § 5) | ☐ |

### Correspondance avec la checklist d'origine (section 19.2 de l'analyse)

| Étape d'origine | Traitement ici |
|---|---|
| 1 | Étape 1 |
| 2 | Étape 2 |
| 3 | Étape 3 |
| 4 | Étape 4 |
| 5 | Étape 5 |
| 6 | Étape 6 |
| 7 | Étape 7 |
| 8 | Étape 8 |
| 9 | Étape 9 |
| 10 | Étape 10 |
| 11 | Étape 11 |
| 12 | Étape 12 |
| 13 | Étape 13 (la vérification est détaillée en § 5) |
| 14 — Vérifier : connexion + MFA, invitation d'un compte, création d'un signalement, triage, création d'une action, soumission en vérification, clôture, export de rapport, dispatcher d'outbox | **§ 5 — Recette de déploiement (post-déploiement)** |
| 15 — Saisir les heures travaillées du site pilote avant toute publication d'un taux d'accidents | **§ 6.3 — Préparation de la production** |
| 16 — Compléter la section 19.3 et le PV de recette avec le commanditaire | **§ 8 — Recette avec le commanditaire + `docs/PV-RECETTE.md`** |

---

## 5. Recette de déploiement (vérification post-déploiement)

À exécuter sur l'environnement cible, dans l'ordre. Chaque ligne est tracée dans le compte rendu
de déploiement.

- [ ] Connexion d'un compte + **challenge MFA** pour un rôle à MFA obligatoire.
- [ ] Invitation d'un compte depuis `/admin/users` et activation via le lien reçu.
- [ ] Création d'un signalement (`/report`) et obtention d'une référence `PES-2026-xxxxx`.
- [ ] Triage de l'événement par le HSE (`/hse/events/:id/triage`).
- [ ] Création d'une action corrective et attribution d'un responsable.
- [ ] Soumission en vérification (`Submit for verification`) **avec preuve de clôture**.
- [ ] Clôture par un tiers (`Verify and close`) — pas le responsable de l'action.
- [ ] Export de rapport (`Export report` / `Export CSV`) sur le périmètre demandé.
- [ ] Dispatch de l'outbox : les lignes passent de `queued` à `sent` (mode `mock` → visibles dans
      `/admin/outbox`).
- [ ] Saisie des **heures travaillées** du site pilote avant toute publication d'un taux
      d'accidents ; sinon le rapport affiche « Accident rate: not available — worked hours not
      provided. »

---

## 6. Préparation de la production

### 6.1 Données de référence propres

- Ne pas laisser les comptes de test du seed en production : les désactiver.
- `sites.is_pilot = true` : **un seul** site pilote (arbitrage A1).
- `risk_categories` : renseigner au minimum le secteur du site pilote.
- `site_worked_hours` : saisir les heures du mois en cours.

### 6.2 Réglages globaux (`/admin/settings`)

| Clé `app_settings` | Valeur attendue |
|---|---|
| `app.name` | `PrevEnSante` |
| `pilot.site_id` | identifiant du site pilote |
| `escalation.chain` | `["hse_officer","site_director","company_officer"]` |
| `assistant.mode` | `rules` (repli local) ou `live` |
| `email.mode` | `mock` puis `live` |
| `sms.mode` | `mock` puis `live` |

### 6.3 Corpus de consignes

Le corpus doit être **validé par un référent** avant que l'assistant ne puisse l'interroger
(arbitrage A6). Un document n'est consultable par l'IA que si `status = 'validated'` **et**
`validated_by` est renseigné. Un document sans secteur ni site rattaché n'est pas consultable.

### 6.4 Contrôle de non-fuite

Avant la mise en production :

- [ ] Le bundle `web/dist` ne contient aucune occurrence de `SUPABASE_SERVICE_ROLE_KEY`,
      `service_role` ni d'une clé Plane.
- [ ] `docs/`, `test/` et `.env*` ne sont pas dans la sortie statique Vercel.
- [ ] Aucun secret n'est versionné : `git grep -n "service_role\|plane_api\|eyJ" -- ':!docs'`
      ne doit rien retourner.

Les deux premiers points sont vérifiés automatiquement par
`npm run deploiement:verifier` (bundle servi et fichiers transmis) : à relancer après chaque
changement de `vercel.json`, de `.vercelignore` ou du contenu de `web/dist`.

---

## 7. Variables d'environnement — tableau complet (section 19.1)

**Règles**

- Aucune valeur réelle n'est écrite dans ce document : uniquement des **placeholders**.
- Les variables marquées **SECRET** ne doivent jamais quitter le gestionnaire de secrets de la
  plateforme (Vercel > Settings > Environment Variables, ou `supabase secrets set`), ni le dépôt,
  ni un bundle front.
- `PLANE_PROJECT_ID` et `PLANE_API_KEY` concernent le **suivi de projet / CI**, pas le runtime de
  l'application.

### 7.1 Front (Vercel) — bundle Vite

| Variable | Placeholder | Secret ? | Où | Obligatoire |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | non | front (Vercel) | oui |
| `VITE_SUPABASE_ANON_KEY` | `<anon-key>` | **oui** (clé anonyme, semi-publique par nature mais versionnée en secret) | front (Vercel) | oui |
| `VITE_APP_NAME` | `PrevEnSante` | non | front (Vercel) | oui |

### 7.2 Edge Functions (Supabase) — via `supabase secrets set` / Dashboard

| Variable | Placeholder | Secret ? | Obligatoire |
|---|---|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | non | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | **SECRET — jamais le front** | oui |
| `SMTP_HOST` | `VOTRE_SMTP_HOST` | non | en mode `live` |
| `SMTP_PORT` | `587` | non | en mode `live` |
| `SMTP_USER` | `VOTRE_SMTP_USER` | **SECRET** | en mode `live` |
| `SMTP_PASS` | `VOTRE_SMTP_PASSWORD` | **SECRET** | en mode `live` |
| `SMTP_FROM` | `PrevEnSante <no-reply@votre-domaine>` | non | en mode `live` |
| `EMAIL_MODE` | `mock` / `live` | non | oui |
| `SMS_MODE` | `mock` / `live` | non | oui |
| `SMS_PROVIDER_API_KEY` | `<SMS_PROVIDER_API_KEY>` | **SECRET** | non (canal de secours) |
| `SMS_PROVIDER_FROM` | `<SMS_PROVIDER_FROM>` | non | non |
| `AI_MODE` | `off` / `rules` / `live` | non | oui |
| `AI_API_BASE` | `https://<ai-provider-host>` | non | en mode `live` |
| `AI_API_KEY` | `<AI_API_KEY>` | **SECRET** | en mode `live` |
| `AI_MODEL` | `VOTRE_AI_MODEL` | non | en mode `live` |

### 7.3 Agents / CI (hors runtime applicatif)

| Variable | Placeholder | Secret ? | Où |
|---|---|---|---|
| `PLANE_PROJECT_ID` | `<plane-project-id>` | non | agents / CI |
| `PLANE_API_KEY` | `<plane_api_...>` | **SECRET — jamais dans le dépôt** | agents / CI |

### 7.4 Récapitulatif

- **20 variables** au total : **3** côté front, **15** côté Edge Functions, **2** côté agents/CI.
- **7 variables porteuse de secret** : `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SMTP_USER`, `SMTP_PASS`, `SMS_PROVIDER_API_KEY`, `AI_API_KEY`, `PLANE_API_KEY`.
- **13 variables** sans secret : `VITE_SUPABASE_URL`, `VITE_APP_NAME`, `SUPABASE_URL`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_FROM`, `EMAIL_MODE`, `SMS_MODE`, `SMS_PROVIDER_FROM`, `AI_MODE`, `AI_API_BASE`,
  `AI_MODEL`, `PLANE_PROJECT_ID`.
- Valeurs par défaut sûres au démarrage : `EMAIL_MODE=mock`, `SMS_MODE=mock`, `AI_MODE=rules`.

---

## 8. Procédure de rollback

### 8.1 Rollback applicatif (front Vercel)

Déclencheurs : régression visible en production, bundle cassé, erreur bloquante à l'ouverture.

```bash
vercel rollback <deployment-url-ou-id>   # redéploie le commit précédent
```

Vérification après rollback :

- [ ] L'URL de production charge l'application.
- [ ] La connexion et le MFA fonctionnent.
- [ ] Un signalement de test passe (mode `mock` si l'environnement de test).

> Le rollback applicatif ne touche pas à la base : les écritures déjà faites restent visibles.
> Si le front précédent et le schéma actuel sont incompatibles, enchaîner sur § 8.2.

### 8.2 Rollback base de données

Le rollback base est **plus lourd** et n'est pas un miroir du rollback front.

1. Provisionner ou utiliser un **projet Supabase de secours** (schéma à l'état antérieur connu).
2. Appliquer le script de rollback noté dans `supabase/migrations/README.md` pour la migration
   incriminée, ou rejouer l'état précédent depuis l'export de sauvegarde (§ 9).
3. Vérifier le schéma et les RLS :

```sql
select count(*) from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
-- 20 tables métier attendues
```

4. Bascule des variables d'environnement : `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   côté Vercel et `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` côté Edge Functions.
5. Redéployer le front : `vercel --prod`.
6. Contrôler l'outbox et les escalades en cours.

> **Attention** : toute bascule de base implique une **perte de cohérence applicative** pour les
> écritures postérieures au dernier point de sauvegarde. La bascule doit être décidée par le
> responsable d'exploitation, pas exécutée en improvisation.

### 8.3 Rollback des données d'une migration

Chaque migration doit avoir son script de rollback documenté. Avant toute correction en base :

- [ ] Export de l'état courant (voir § 9) — *ne jamais modifier la production sans point de
      restauration*.
- [ ] Script de rollback relu et testé sur une base de recette.
- [ ] Fenêtre de maintenance annoncée aux utilisateurs du site pilote.

---

## 9. Stratégie de sauvegarde

| Élément | Rythme | Contenu | Responsable |
|---|---|---|---|
| Sauvegarde quotidienne automatique Supabase | **Chaque jour** | Base complète gérée par la plateforme | Plateforme Supabase |
| Export hebdomadaire **hors site** | **Chaque semaine** | Dump de la base vers un stockage secondaire hors du site d'hébergement | Responsable d'exploitation |
| Test de restauration | **Au moins une fois par trimestre** | Restauration complète dans un environnement isolé et contrôle d'intégrité | Responsable d'exploitation + DBA |

### 9.1 Export hebdomadaire hors site

Objectif : une copie hors du fournisseur d'hébergement, exploitable même si le compte Supabase
principal est compromis.

```bash
# Exemple de dump — à adapter au client pg de l'environnement
pg_dump "$SUPABASE_DB_URL" --format=custom --file="prevensante-$(date +%F).dump"
```

Contrôles de l'export :

- [ ] Le fichier est chiffré au repos sur le stockage secondaire.
- [ ] Le stockage secondaire est **physiquement et logiquement distinct** du compte principal.
- [ ] L'accès au stockage est restreint et journalisé.
- [ ] La taille de l'export est cohérente avec la taille de la base (contrôle de non-vidage).
- [ ] L'export est conservé selon la politique de conservation convenue.

> **Modalités restant à confirmer par le commanditaire** (PRD section 7 et arbitrage A10) : durée de
> conservation, localisation du stockage secondaire, coût et responsable de l'exploitation.
> L'arbitrage lui-même est tranché (02/11/2026) : la stratégie décrite ci-dessus est celle qui
> s'applique. Tant que ces paramètres ne sont pas nommés, la stratégie reste celle décrite
> ci-dessus et son responsable doit être nommé.

### 9.2 Test de restauration trimestriel

1. Créer un projet Supabase **de test** isolé.
2. Restaurer l'export le plus récent.
3. Contrôler : 20 tables métier présentes, RLS activée sur chacune, 4 buckets créés,
  extensions `pgcrypto` / `pg_cron` / `pg_net` actives.
4. Rejouer un parcours métier minimal : connexion, création d'un signalement, triage, action
   corrective, clôture.
5. Consigner le compte rendu : date, durée de la restauration, anomalies, actions correctives.

---

## 10. Surveillance

### 10.1 Contrôle quotidien

| Contrôle | Où | Fréquence | Seuil d'alerte |
|---|---|---|---|
| Lignes `email_outbox.status = 'failed'` | `/admin/outbox` | **Quotidienne** | ≥ 1 ligne en échec |
| Lignes `sms_outbox.status = 'failed'` | `/admin/outbox` | **Quotidienne** | ≥ 1 ligne en échec |
| Escalades `critical` non acquittées | `/hse/escalations` | Quotidienne | Toute escalade non acquittée |
| Actions correctives en retard | `/hse/actions` (`v_overdue_actions`) | Quotidienne | Toute action `critical` en retard |
| Santé des Edge Functions et de `pg_cron` | Supabase Dashboard > Edge Functions / Logs | Quotidienne | Échec d'invocation |
| Journal d'audit | `/admin/audit` | Hebdomadaire | Mutation de rôle, de site ou de consigne |

Cette surveillance répond à l'exigence du PRD : « les erreurs de notification sont tracables ».

### 10.2 Comportement du dispatcher

- Le dispatcher `dispatch-outbox` est **idempotent** : un envoi déjà effectué (statut + 
  `provider_message_id`) n'est pas rejoué.
- Il **retente 3 fois** avec un backoff de **1 min, 5 min, 30 min**, avant de marquer la ligne
  `failed`.
- Le rattrapage est manuel depuis `/admin/outbox` via l'action `Resend`.

### 10.3 Alertes

- [ ] Adresse d'alerte de l'exploitant configurée (notifications de la plateforme).
- [ ] Destinataire de l'alerte en cas d'échec `critical` : HSE du site + `site_director`.
- [ ] Escalade vers `company_officer` en cas d'accident grave non clôturé à l'échéance
      (arbitrage A5, niveau 3 de `escalation.chain`).

---

## 11. Intégration continue (section 16.4)

La CI doit rejouer, sur chaque `push` et `pull_request` :

```yaml
- run: supabase start
- run: supabase db reset      # migrations + seed
- run: supabase test db       # tests RLS
- run: npm ci && npm run lint && npm run typecheck
- run: npm run test:unit
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

> **Contrainte d'environnement connue dans ce dépôt** : le README projet indique qu'aucun
> Supabase local ni conteneur n'est utilisé sur cette machine (`supabase start`, `db reset`,
> `db dump` sont proscrits). Sur un poste disposant de Docker, la séquence complète ci-dessus est
> applicable ; sinon, s'appuyer sur un projet Supabase de recette lié et `supabase db push` +
> `supabase test db` (pgTAP) contre ce projet.

---

## 12. Documents liés

| Document | Objet |
|---|---|
| `docs/RUNBOOK.md` | Runbook d'exploitation : incidents courants, procédures, contacts |
| `docs/GUIDE-UTILISATEUR.md` | Guide utilisateur (salarié) et guide administrateur |
| `docs/PV-RECETTE.md` | Procès-verbal de recette (7 critères CR01 → CR07) |
| `docs/PRD_PrevEnSante.md` | PRD produit |
| `README.md` | README projet (pile, démarrage, secrets) |

---

## 13. Annexes — points à confirmer par le commanditaire

| # | Point ouvert | Référence | Impact si non tranché |
|---|---|---|---|
| A1 | Secteur de référence (cimenterie ou mine) et confirmation du site pilote unique | Analyse § 3.4 | **Tranché le 02/11/2026** : cimenterie, site pilote unique Usine de Soumbo (`SMB`) |
| A10 | Modalités d'hébergement, de sauvegarde et de conservation | Analyse § 3.4 / PRD § 7 | **Tranché le 02/11/2026** : Supabase Cloud `eu-west-3`, sauvegarde quotidienne + export hebdomadaire hors site. Restent à nommer : durée de conservation et responsables d'exploitation |
| A2 | Activation effective des rôles `supervisor`, `maintenance_lead`, `action_owner`, `occupational_physician`, `site_director` | Analyse § 3.4 | Matrice d'habilitations et périmètre de la recette |
| SMTP | Fournisseur SMTP et domaine d'expédition | Analyse § 10.3 | `EMAIL_MODE` reste `mock` |
| SMS | Fournisseur SMS et numéro émetteur | Analyse § 10.4 | `SMS_MODE` reste `mock` ; escalades critiques par SMS non testées en conditions réelles |
| IA | Fournisseur LLM ou usage du moteur de règles local | Analyse § 10.3 | `AI_MODE=rules` par défaut |
| Heures travaillées | Source et fréquence de saisie des heures | Analyse § 3.4 A8 | Taux d'accidents non calculable |
