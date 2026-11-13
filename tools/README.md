# Outillage de validation — sans Docker

Ce dossier contient les outils qui permettent de valider `supabase/migrations/`
**et** la configuration de déploiement **sur une machine sans Docker et sans
instance Supabase**.

## Pourquoi

`supabase db push` exige Docker ou un projet Supabase connecté. Ces outils
reproduisent localement les contrôles, du plus léger au plus strict.

---

## 1. Validation des migrations SQL

| Outil | Ce qu'il vérifie | Dépendance |
|---|---|---|
| `valider-migrations.mjs` | Chaque instruction est parsée par le vrai parseur PostgreSQL (`libpg_query` en WASM). Détecte la syntaxe invalide. | `pgsql-parser` |
| `coherence-migrations.mjs` | Tables, fonctions, index et triggers référencent des objets qui existent. | aucun |
| `colonnes-migrations.mjs` | Chaque colonne citée dans une politique RLS existe dans la table visée. | aucun |
| `executer-migrations.mjs` | Les migrations sont **exécutées** dans un PostgreSQL complet (PGlite) et l'état final est inspecté. | `@electric-sql/pglite` + extensions |
| `test-fonctionnel.mjs` | Le comportement métier : exécute `supabase/tests/rls.sql` (RLS par rôle, triggers de garde-fou, isolement du schéma `medical`) puis les contrôles complémentaires exigés par le PV de recette (format de référence, refus `23514`). | idem |

### Installation

```bash
npm i -D pgsql-parser @electric-sql/pglite @electric-sql/pglite-pgvector \
         @electric-sql/pglite-postgis
```

### Usage

```bash
npm run migrations:parse      # syntaxe
npm run migrations:coherence  # objets référencés
npm run migrations:colonnes   # colonnes des politiques RLS
npm run migrations:run        # exécution complète + inspection de la base
npm run db:test               # tests fonctionnels (RLS, triggers)
```

### Ce que couvre `npm run db:test`

C'est le pendant SQL de la suite E2E navigateur (`web/e2e`) : les deux vérifient
la même règle d'accès aux données, l'un côté base, l'autre côté IHM. Le runner :

1. applique les migrations versionnées (`supabase/migrations`) ;
2. accorde aux rôles `anon` / `authenticated` des droits « Supabase-like » ;
3. exécute `supabase/tests/rls.sql` — un bloc de test par règle de la
   politique RLS, chacun dans sa propre transaction ;
4. ajoute les contrôles exigés par le PV de recette mais absents de `rls.sql` :
   format de la référence `PES-AAAA-NNNNN`, refus serveur d'une description vide
   (`23514`), passage obligatoire par `to_verify`, interdiction de vérifier sa
   propre action.

Sortie non nulle si un seul contrôle échoue : la commande est utilisable telle
quelle en intégration continue.

> `supabase/tests/rls.sql` reste exécutable ailleurs tel quel :
> `psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql` sur une instance
> PostgreSQL réelle, ou `supabase test db` sur le projet Supabase.

### Émulation de Supabase

`executer-migrations.mjs` et `test-fonctionnel.mjs` créent eux-mêmes ce que
Supabase fournit, afin que les migrations soient testées à l'identique :

- le schéma `auth` et la table `auth.users` ;
- la fonction `auth.uid()` (qui lit `request.jwt.claim.sub`) ;
- les rôles `authenticated`, `anon`, `service_role` (avec `bypassrls`) ;
- les extensions `pgcrypto`, `pg_trgm`, `vector` (pgvector) et `postgis`.

### Limite connue

PGlite n'est pas un serveur : il n'a pas de `pg_auth`, donc **les JWT Supabase
réels ne sont pas vérifiés**. Le test repose sur le claim
`request.jwt.claim.sub`, ce qui reproduit fidèlement le comportement de
`auth.uid()`. Une validation finale reste nécessaire sur l'instance Supabase
avant la mise en production.

---

## 2. Contrôle de la configuration de déploiement

| Outil | Ce qu'il vérifie | Dépendance |
|---|---|---|
| `verifier-deploiement.mjs` | Ce que Vercel recevrait et publierait : fichiers transmis après `.vercelignore`, secrets et documents internes, **imports de la fonction serverless**, repli SPA, commande de build. | aucun |
| `verifier-base.mjs` | L'instance Supabase distante : configuration, connexion des comptes de recette, RLS par rôle, isolement médical. | `@supabase/supabase-js` + variables `VITE_*` |
| `publier-base.mjs` | La publication du schéma sur l'instance : chaîne de validation locale, `db push --dry-run`, `db push`, vérification RLS, **rapport horodaté**. | CLI Supabase + jeton d'accès |

### `verifier-deploiement.mjs`

```bash
npm run deploiement:verifier
```

Équivalent local, portable et **hors ligne**, de `vercel build && find
.vercel/output/static -type f`. La commande `vercel build` lance `cmd.exe` via
`@vercel/static-build` et échoue sur certaines machines Windows ; ce script
rejoue ce que la plateforme examinerait :

1. la configuration Vercel telle qu'elle sera lue (`framework`,
   `buildCommand`, `outputDirectory`, `rewrites`) ;
2. les fichiers réellement transmis, motif `.vercelignore` compris ;
3. qu'aucun document interne, script SQL ou variable d'environnement ne part
   en ligne, et que le **bundle servi** ne contient ni document interne, ni
   source map, ni mention de clé `service_role` ;
4. que **les imports de la fonction serverless se résolvent** et que les
   fichiers dont le build a besoin ne sont pas exclus par erreur — c'est ce
   contrôle qui avait laissé passer un import mort ;
5. que le repli SPA (`/((?!api/).*)` → `/index.html`) est présent, sans quoi un
   rafraîchissement sur une route profonde renvoie 404 ;
6. que la commande de build correspond à un script réel de `package.json`.

Sortie non nulle si une seule alerte est levée : la commande est utilisable
telle quelle en intégration continue (elle tourne dans le job `validation`).

Le script accepte une racine en argument (`node tools/verifier-deploiement.mjs
<racine>`) : c'est ainsi que `test/deploiement.test.js` le rejoue sur des
dépôts de synthèse volontairement dégradés — un contrôle qui validerait
n'importe quoi ne prouverait rien.

### `verifier-base.mjs`

```bash
node tools/verifier-base.mjs            # contrôles en lecture seule
node tools/verifier-base.mjs --ecriture # ajoute un test d'écriture opt-in
```

Ce script parle à l'**instance Supabase réelle** : il vérifie que la
configuration est bien celle attendue, que les comptes de recette se connectent
avec le rôle et le site attendus, que le double facteur amène réellement la
session à `aal2`, que la RLS s'applique comme dans `supabase/tests/rls.sql` et
que l'isolation du schéma `medical` tient. Il est non destructif, sauf
`--ecriture` qui crée une référence de test.

Il a besoin de `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Sans ces
variables, il s'arrête sur un message explicite : c'est le seul contrôle du
projet qui ne peut pas s'exécuter hors ligne.

Les mots de passe des comptes sont lus dans l'environnement
(`PREVENSANTE_WORKER_PASSWORD`, `PREVENSANTE_HSE_PASSWORD`,
`PREVENSANTE_MEDECIN_PASSWORD`, …), puis dans `.env.comptes.local` à la racine
du dépôt, puis — en dernier recours — dans le seed. Ce dernier repli a une
raison d'être : les mots de passe du seed 0016 ont été changés sur l'instance
le 02/11/2026, et une base locale rechargée depuis le seed les attend encore.
Quand le mot de passe lu est celui du seed, le contrôle le signale : sur une
instance publique, c'est un défaut à corriger.

Les secrets des seconds facteurs sont lus de la même façon
(`PREVENSANTE_HSE_MFA_SECRET`, `PREVENSANTE_MEDECIN_MFA_SECRET`,
`PREVENSANTE_ADMIN_MFA_SECRET`, `PREVENSANTE_ENCADREMENT_MFA_SECRET`, …). Sans
eux, le script constate que le facteur est enrôlé mais ne peut pas prouver que
la session atteint `aal2`, et il le dit plutôt que de l'affirmer.

### `tableau-habilitations.mjs`

```bash
node tools/tableau-habilitations.mjs            # relevé lisible
node tools/tableau-habilitations.mjs --markdown # tableau prêt à coller dans le PV
```

Relève, **sur l'instance réelle**, les trois informations que le § 7 du PV de
recette demande par personne : le rôle, le site de rattachement, et l'état du
double facteur. Un compte sans second facteur enrôlé est signalé comme tel —
`non enrole`, et non « on ne sait pas ».

Le double facteur n'est pas déduit de la seule présence d'un facteur : le script
rejoue le challenge TOTP avec le secret local et le temps du serveur, et
n'annonce `actif — session aal2 atteinte` que si la session atteint
réellement `aal2`. Sans secret sur le poste, il se contente de dire `enrole` et
signale que la session n'est pas vérifiable ici.

L'option `--markdown` sort un tableau prêt à coller dans le § 7 du PV : nom de
la personne, compte, rôle, site, état du double facteur, accès aux dossiers
médicaux et état actif du compte.

Comme `verifier-base.mjs`, il lit les mots de passe et les secrets dans
`.env.comptes.local` ou dans l'environnement, et n'affiche jamais de secret.

### `publier-base.mjs`

```bash
npm run base:publier -- --ref <project-ref>            # simulation seule
npm run base:publier -- --ref <project-ref> --confirm  # application
```

Publie le schéma versionné sur l'instance Supabase, en respectant l'ordre
imposé par le projet : **`db push --dry-run` d'abord**, `db push` ensuite, et
uniquement après relecture du plan.

**Une seule chose est demandée à l'opérateur** : `npx supabase login` dans un
terminal. Le CLI enregistre alors ses identifiants dans `~/.supabase/access-token`,
et le script va chercher lui-même :

- la liste des projets (`supabase projects list`) — donc le `project-ref`, sans
  qu'il faille le recopier ;
- l'URL de l'API et la **clé publique `anon`** (`supabase projects api-keys`) pour
  vérifier l'instance.

La clé `service_role` n'est jamais demandée : elle n'a rien à faire dans un
contrôle de lecture, et elle ne doit jamais quitter le serveur.

Le script enchaîne cinq phases et consigne chacune d'elles :

| Phase | Contenu |
|---|---|
| A | Chaîne de validation locale : typage, build, tests, migrations, RLS, audit, contrôle de déploiement |
| B | Prérequis distants : jeton d'accès (`SUPABASE_ACCESS_TOKEN`) et `project-ref` |
| C | État des migrations distantes, simulation, puis application |
| D | Vérification de l'instance (`tools/verifier-base.mjs`) |
| E | **Rapport horodaté** dans `docs/rapports/PUBLICATION-<date>.md` |

Sans `--confirm`, le script s'arrête à la phase C : la simulation est affichée,
rien n'est écrit dans la base. Aucune commande destructive n'est employée
(`db reset`, `db pull`, `db diff`, `db dump` sont exclus), et les migrations
restent immuables.

Le rapport est **assaini** : aucun jeton, clé ni mot de passe n'y figure. Les
sorties de commandes sont filtrées avant d'être consignées.

Options :

| Option | Effet |
|---|---|
| `--ref <project-ref>` | Instance cible (sinon `SUPABASE_PROJECT_REF`, sinon découverte automatique) |
| `--confirm` | Autorise l'application après relecture de la simulation |
| `--rapport <fichier>` | Chemin du rapport |
| `--ecriture-env` | Écrit `web/.env.local` (URL + clé `anon`) pour que le front bascule sur la base réelle |
| `--e2e` | Ajoute la recette Playwright à la phase A |

---

## 3. Nommer les personnes du site pilote

| Outil | Ce qu'il fait | Dépendance |
|---|---|---|
| `chain-connexion.mjs` | Module commun : **retrouve** la chaîne de connexion dans les fichiers locaux, et la prépare pour `pg`. | aucun |
| `maj-habilitations.mjs` | Écrit les 5 noms (nom, fonction, téléphone) en SQL direct, et écrit aussi le nom dans `auth.users`. | `pg` + chaîne de connexion |
| `maj-habilitations-api.mjs` | Écrit les 5 noms **par l'API de l'application** : ni chaîne de connexion, ni mot de passe de base. | `@supabase/supabase-js` + clé publique + compte administrateur |
| `preuve-ecriture-habilitations.mjs` | **Preuve réversible** : écrit un nom temporaire, vérifie que la personne concernée le voit dans l'application, puis restaure le nom d'origine. | idem |

### Pourquoi deux voies

La voie SQL est la plus complète : elle touche aussi `auth.users` (le nom de doublon
et, en option, l'adresse de connexion). La voie API n'a besoin d'aucun secret de base :
elle passe par la clé publique et le mot de passe du compte administrateur, et écrit
dans `public.profiles` — la seule table que l'application consulte pour afficher un nom
(aucune occurrence de `user_metadata` dans `web/src`).

Dans les deux cas, **le résultat visible dans l'application est identique**.

### `chain-connexion.mjs`

La chaîne de connexion n'est jamais demandée à l'opérateur. Elle est cherchée, dans
l'ordre : l'environnement (`SUPABASE_DB_URL`), `.env.sauvegarde.local`,
`supabase/.env.local`, puis la ligne de commande. Ces fichiers sont ignorés par git
(`.gitignore`) et exclus du déploiement (`.vercelignore`).

Le module corrige aussi un piège réel : la chaîne contient `?sslmode=require`, que les
versions récentes de `pg` traitent comme un alias de `verify-full`. La connexion échoue
alors sur « self-signed certificate in certificate chain », **même** si le code demande
`ssl: { rejectUnauthorized: false }`. Le paramètre est donc retiré de la chaîne transmise
à `pg`, qui applique alors sa propre règle : TLS, sans vérification stricte du certificat.

### Les trois commandes

```bash
npm run habilitations:maj          # SQL direct — simulation puis écriture
npm run habilitations:maj:api      # par l'API — sans chaîne de connexion
npm run habilitations:preuve       # preuve réversible de l'écriture
```

Le lot d'habilitations est un JSON local, jamais versionné
(`.env.habilitations.local`, gabarit dans `.env.habilitations.example`) :

```json
{
  "hse":         { "nom": "…", "fonction": "…", "telephone": "…" },
  "medecin":     { "nom": "…", "fonction": "…", "telephone": "…" },
  "admin":       { "nom": "…", "fonction": "…", "telephone": "…" },
  "encadrement": { "nom": "…", "fonction": "…", "telephone": "…" },
  "superviseur": { "nom": "…", "fonction": "…", "telephone": "…" }
}
```

Les trois outils **refusent d'écrire** si l'un des cinq noms manque, et affichent l'état
avant et après. Ils n'écrivent jamais le rôle, ni le site, ni le second facteur.

## 4. Sauvegarder la base, et prouver que la sauvegarde se rejoue

| Outil | Ce qu'il fait | Dépendance |
|---|---|---|
| `sauvegarde-base.mjs` | Exporte la base (structure **et** données) dans `%USERPROFILE%\prevensante-sauvegardes`. Refuse de produire un export sans lignes. | `pg` + chaîne de connexion |
| `restaurer-sauvegarde.mjs` | **Prouve** qu'un export se rejoue : l'ouvre dans une base neuve, y rejoue les données, compare le nombre de lignes à celui de l'instance réelle. | `pg` + chaîne de connexion |

### Les deux commandes

```bash
npm run base:sauvegarder                                    # export
npm run base:restaurer -- --fichier <chemin/vers/le.sql>   # test de restauration
```

Options de l'export : `--schema-only` (structure seule), `--data-only` (données seules),
`--dossier <chemin>` (destination). Un export complet produit un `.sql` et un
`.manifest.json` (empreinte SHA-256, nombre de tables peuplées).

### Ce que le test de restauration mesure

1. Une base neuve est ouverte en local (PGlite) et le schéma versionné y est appliqué —
   **sans le jeu de démonstration**, qui ferait double emploi avec les données du dump.
2. Les instructions d'insertion du dump sont rejouées dedans.
3. Le nombre de lignes de chaque table est comparé à celui de l'instance réelle.

**Verdict** : `dump restaurable` si aucune instruction n'a échoué et qu'au moins une table
est peuplée ; sinon `NON restaurable` (code de sortie 1).

### Ce qui n'est pas un échec

Les tables de session de GoTrue (`auth.sessions`, `auth.refresh_tokens`,
`auth.mfa_amr_claims`, `auth.mfa_factors`, `auth.mfa_challenges`, `auth.flow_state`,
`auth.one_time_tokens`) sont régénérées par Supabase lui-même et ne sont pas émulées
localement. Elles sont classées « hors émulation », pas « échec ».

Un écart entre le dump et l'instance réelle n'est pas non plus un échec : l'instance peut
avoir bougé depuis l'export. Seuls les échecs de rejeu sont bloquants.

### Où cela tourne

Le workflow `.github/workflows/sauvegarde.yml` (dimanche 03:17 UTC, ou à la main) exporte
puis **rejoue l'export avant de le publier**. Si l'export n'est pas restaurable, le job
échoue — donc c'est visible dans l'onglet Actions — mais l'artefact est quand même publié :
un dump douteux se conserve pour être analysé, on ne le jette pas.

