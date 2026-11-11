# PrevEnSanté

Plateforme multisectorielle de prévention des risques professionnels — mines, carrières,
cimenteries, usines de production, BTP, métallurgie, agroalimentaire, entrepôts et logistique.

Signalement des dangers, suivi des accidents et des actions correctives, assistance IA limitée.
Première version minimale fonctionnelle (MVP) sur **site pilote** avant extension multisectorielle.

## Pile technique

| Élément | Choix |
|---|---|
| Front | React + TypeScript + Vite (`web/`) — application monopage, deux espaces : salarié et HSE |
| API | Routeur portable en API Web standard (`Request`/`Response`), ESM, sans framework |
| Runtime | Node.js **LTS v24** |
| Gestionnaire de paquets | **npm** (seul lock du dépôt : `package-lock.json`) |
| Modules | **ESM** (`"type": "module"`) |
| Serveur local | `node:http` via un adaptateur (`server/index.js`) |
| Déploiement | Vercel **Functions** (`api/index.js`) + sortie statique `web/dist` |
| Base de données / services | **Supabase distant** (PostgreSQL + Auth + Storage) |
| Hébergement | **Vercel** |
| Versionnage | **git** + **GitHub** |
| Conteneurs | **aucun** — ni Docker ni Docker Compose, à aucun moment |

## Architecture

Le dépôt contient deux ensembles distincts, qui ne se mélangent pas :

| Dossier | Rôle |
|---|---|
| `web/` | Application React (TypeScript). C'est l'IHM livrée au navigateur. |
| `api/` | Fonction serverless Vercel : le point d'entrée HTTP pour les appels qui exigent le `service_role`. |
| `server/` | Adaptateur `node:http` qui sert le même routeur en local. |
| `supabase/migrations/` | Schéma PostgreSQL versionné : tables, RLS, triggers, vues, RPC, seed. |
| `supabase/tests/` | Suite de tests SQL de non-régression RLS (`rls.sql`). |
| `tools/` | Outillage de validation **sans Docker** (PGlite, parseur PostgreSQL). |
| `docs/` | PRD, PV de recette, runbook, guide utilisateur, déploiement. |

## Démarrage

```bash
npm ci                     # racine : routeur API + outillage SQL
npm --prefix web ci        # front
npm run dev:web            # application sur http://localhost:5173
```

Les deux serveurs peuvent tourner côte à côte : `npm run dev` (API, port 3000) et
`npm run dev:web` (front).

## Scripts

### Racine

| Commande | Rôle |
|---|---|
| `npm run dev` / `npm start` | Serveur API local (rechargement automatique / stable) |
| `npm test` | Tests du routeur, du contrôleur de déploiement et de parité des modes (`node --test`) |
| `npm run dev:web` | Front en développement |
| `npm run build:web` | Build de production du front (`web/dist`) |
| `npm run preview:web` | Sert le build de production (cible de la recette E2E) |
| `npm run migrations:parse` | Syntaxe des migrations (vrai parseur PostgreSQL) |
| `npm run migrations:coherence` | Les objets référencés existent-ils ? |
| `npm run migrations:colonnes` | Les colonnes citées par les politiques RLS existent-elles ? |
| `npm run migrations:run` | Exécution complète des migrations + inspection de la base |
| `npm run db:test` | **Tests fonctionnels SQL** : RLS par rôle, triggers, garde-fous |
| `npm run deploiement:verifier` | **Contrôle de la configuration Vercel** hors ligne (fichiers transmis, secrets, imports, repli SPA) |
| `npm run base:publier -- --ref <project-ref>` | **Publication du schéma sur Supabase** : validation locale, `db push --dry-run`, puis application avec `--confirm`, et rapport horodaté |
| `npm run base:verifier` | **Contrôle de l'instance réelle** : RLS, cloisonnement par site, isolement médical, preuve `aal2` du second facteur (lecture seule) |
| `npm run base:sauvegarder` | **Export hebdomadaire hors site** de la base (dump + empreinte SHA-256 + manifeste) |
| `npm run mfa:enroller` | **Enrôlement du second facteur** TOTP et preuve `aal2` sur les 5 rôles qui le portent |
| `npm run habilitations:maj` | **Écriture des noms des personnes** du site pilote (simulation par défaut, refus si un nom manque) |

### Front (`web/`)

| Commande | Rôle |
|---|---|
| `npm --prefix web run dev` | Vite en développement |
| `npm --prefix web run build` | `tsc -b` puis build Vite |
| `npm --prefix web run typecheck` | `tsc -b --noEmit` |
| `npm --prefix web run test:e2e` | Playwright (desktop + mobile) |
| `npm --prefix web run test:e2e:desktop` | Playwright, projet bureau seul |

## Deux modes de fonctionnement

L'application lit **la même** couche d'accès aux données dans les deux cas
(`web/src/lib/api.ts`), seule l'origine des données change :

| | Mode démonstration | Mode Supabase |
|---|---|---|
| Déclencheur | `web/.env.local` absent ou sans `VITE_SUPABASE_*` | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` définis |
| Origine des données | Jeu local `web/src/data/demo.ts` | PostgreSQL distant |
| Qui applique la RLS | Le code émule la règle : `web/src/lib/rls/scope.ts` | PostgreSQL : `supabase/migrations/0011_rls_policies.sql` |

L'émulation est un **portage ligne à ligne** de `public.can_access_site` et de la politique
`safety_events_select_scoped` : un salarié voit ses propres signalements, un HSE voit les sites de
son organisation, les dossiers médicaux restent réservés au patient et aux rôles médicaux
habilités. La suite E2E et la suite SQL vérifient séparément ces deux implémentations.

Le périmètre de lecture est résolu à partir du **répertoire des sites** (`web/src/lib/rls/scope.ts`).
En mode démonstration, c'est le jeu local ; en mode Supabase, ce sont les sites que la RLS laisse
lire au profil connecté (la politique `sites_select_scoped` s'appuie sur `can_access_site`). Sans
cette distinction, les identifiants de la base — qui n'ont rien de commun avec ceux du jeu local —
ne seraient jamais trouvés, et le HSE serait refusé sur les sites de sa propre organisation.

Pour basculer sur la base réelle :

```bash
cp web/.env.example web/.env.local   # puis renseigner les deux variables
```

⚠️ Seules des variables `VITE_*` publiques vont dans ce fichier : elles sont embarquées dans le
bundle du navigateur. La clé `service_role` reste côté serveur.

## Tests

| Niveau | Commande | Ce qu'il couvre |
|---|---|---|
| Typage | `npm --prefix web run typecheck` | Types de l'application |
| Navigateur | `npm --prefix web run test:e2e` | Les 7 critères de réception, en bureau (1280×800) et mobile (Pixel 5) |
| SQL | `npm run db:test` | RLS par rôle, triggers de garde-fou, isolement médical, format de référence |
| Routeur API | `npm test` | Réponses HTTP du routeur (aucun port, aucun réseau) |
| Parité des modes | `npm test` | Le périmètre de lecture ne doit jamais être décidé à partir du jeu de démonstration quand la base réelle est configurée |
| Déploiement | `npm run deploiement:verifier` | Ce que Vercel recevrait et publierait, hors ligne |

La suite navigateur s'exécute **contre le build de production** (`vite preview`), pas contre le
serveur de développement : c'est la cible de la recette. La suite SQL s'exécute dans PGlite
(PostgreSQL 16 en WebAssembly) : aucun conteneur, aucune instance distante.

> `supabase/tests/rls.sql` reste exécutable ailleurs tel quel :
> `psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql`, ou `supabase test db` sur le projet
> Supabase.

### Recette en intégration continue

`.github/workflows/ci.yml` rejoue tout à chaque push et à chaque pull request : typage, build,
tests du routeur, validation SQL, puis la recette E2E bureau + mobile. Le rapport Playwright est
publié en artefact.

Un second job, **opt-in**, rejoue la même recette contre l'instance Supabase de recette — là où
la RLS est appliquée par PostgreSQL et non émulée dans le code. Il ne démarre que si la variable
de dépôt `ENABLE_BASE_REELLE` vaut `true`, et utilise les secrets `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` (clé publique, déjà exposée au navigateur ; la clé `service_role` n'est
jamais nécessaire côté front).

Pour activer ce job :

1. *Settings → Secrets and variables → Actions → Variables* : créer `ENABLE_BASE_REELLE = true` ;
2. *… → Secrets* : créer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ;
3. appliquer les migrations à l'instance (`supabase db push`) et y charger le seed.

## Authentification

Deux chemins, selon la configuration :

| | Mode démonstration | Mode Supabase |
|---|---|---|
| Connexion | Choix d'un profil sur `/login` | Adresse + mot de passe (Supabase Auth) |
| Second facteur | Code de démonstration `123456` | Challenge TOTP **réellement vérifié** par Supabase (`mfa.verify`) |
| Profils de démonstration | Proposés sur `/login` | **Masqués** : en production, un clic ne doit pas ouvrir une session HSE sans mot de passe |

Un compte sans facteur TOTP enrolé ouvre sa session directement : exiger un code que personne ne
peut produire bloquerait la connexion. Les comptes de recette sont dans
`supabase/migrations/0016_seed.sql`.

En mode Supabase, la suite E2E se connecte avec ces comptes de recette au lieu des profils de
démonstration (`web/e2e/helpers.ts`) : le même code de test sert aux deux modes.

## Secrets

`.env` et `.env.local` ne sont **jamais** versionnés. Seul `.env.example` l'est, avec des valeurs
fictives. La clé `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais atteindre le navigateur. Les variables
Vercel se récupèrent avec `vercel env pull`, elles ne se recopient pas à la main.

## Supabase — distant uniquement

Aucun Supabase local n'est installé et aucun conteneur n'est requis.

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref <REFERENCE_PROJET>
```

**À ne pas lancer** (ces opérations peuvent exiger des conteneurs) :
`supabase start`, `db pull`, `db diff`, `db dump`, `db reset`.

Pour appliquer des migrations distantes : toujours `npx supabase db push --dry-run` d'abord,
puis `npx supabase db push` après relecture et accord explicite.

Les migrations s'appliquent dans l'ordre lexicographique (`0001` → `0017`). La `0017` aligne les
séquences de référence sur le seed : sans elle, le premier signalement créé après l'installation
génère une référence déjà utilisée et échoue.

## Déploiement Vercel

Projet lié : `sawadogosoumaila234-5698/prevensante` — **https://prevensante.vercel.app**

> ✅ **État vérifié le 11/11/2026** : l'application React **est** en ligne. Le déploiement en
> production du 08/11/2026 sert le bundle `index-1lPOegWM.js` — le hash exact produit par le code
> de `main` ; `/api/health` répond ; les variables `VITE_SUPABASE_URL` et
> `VITE_SUPABASE_ANON_KEY` sont configurées pour Production, Preview et Development.
>
> ⚠️ **Ce qui n'était pas fait, et qui a été corrigé le 11/11/2026** : le projet Vercel n'était
> relié à **aucun dépôt GitHub**. Un push ne mettait donc rien en ligne, et un déploiement refusé
> laissait l'ancienne version en service **sans le dire** — c'est exactement ce qui s'est produit
> le 06/11/2026 (*« the commit author doesn't have permission to create deployments »*). Désormais,
> le job `deploiement` de `.github/workflows/ci.yml` déploie en production **après chaque recette
> verte**, à condition que la variable de dépôt `DEPLOY_PRODUCTION` vaille `true`.
>
> Le compte Vercel reste lié au projet par `VERCEL_TOKEN` (secret du dépôt). Le déploiement passe
> par `--prebuilt` : un artefact construit par la CI ne porte pas de métadonnée git et n'est donc
> jamais refusé pour un auteur de commit différent du compte Vercel.

```bash
vercel whoami        # vérifier la session avant toute action
vercel link          # relier le dossier au projet (déjà fait)
vercel build         # valide le build en local, sans rien déployer
vercel deploy        # prévisualisation
vercel deploy --prod # production (après vérification)
```

### ⚠️ Ne jamais déployer sans `.vercelignore` et `outputDirectory`

Le projet n'a **aucun framework**. Sans protection, Vercel sert la racine du dépôt en fichiers
statiques, sur une URL publique — ce qui publierait le PRD, le backlog et le code.

Quatre protections sont en place, et elles sont **nécessaires toutes les quatre** :

1. **`.vercelignore`** — `docs/`, `test/`, `supabase/`, `tools/`, `web/e2e/`, `.github/` et les
   meta-fichiers ne sont pas envoyés du tout.
2. **`outputDirectory: "web/dist"`** dans `vercel.json` — seule la sortie statique du front est
   publiée.
3. **`buildCommand: "npm --prefix web run build"`** — le front est construit au déploiement.
4. **Réécriture SPA** (`/((?!api/).*)` → `/index.html`) — le front utilise `BrowserRouter` : sans
   ce repli, un rafraîchissement sur `/hse/events` renvoie 404.

⚠️ **Un `rewrites` seul ne suffit pas** : les réécritures s'appliquent *après* la vérification du
système de fichiers, donc un fichier existant serait servi avant d'être réécrit. La seule protection
fiable est de ne pas envoyer le fichier.

Après tout changement de `vercel.json` ou `.vercelignore`, vérifier :

```bash
npm run deploiement:verifier
```

Ce contrôle rejoue **hors ligne** ce que Vercel examinerait : fichiers transmis, secrets et
documents internes, imports de la fonction serverless, repli SPA, commande de build. Il lève une
alerte et sort en erreur au moindre problème.

> `vercel build` reste la référence, mais elle n'est pas exécutable partout : elle lance `cmd.exe`
> via `@vercel/static-build` et échoue sur certaines machines Windows. Le contrôleur ci-dessus
> couvre les mêmes points sans dépendre de la plateforme.

## Documentation

- PRD : `docs/PRD_PrevEnSante.md`
- PV de recette : `docs/PV-RECETTE.md` (statut d'exécution et réserves)
- Fiche de décision des arbitrages : `docs/ARBITRAGES.md` (les 5 points à trancher, avec le coût de chaque option)
- Rapports de publication horodatés : `docs/rapports/`
- Carte de point d'étape : `docs/etat-projet.html`
- Déploiement : `docs/DEPLOIEMENT.md`
- Exploitation : `docs/RUNBOOK.md`
- Guide utilisateur : `docs/GUIDE-UTILISATEUR.md`
- Backlog : géré dans Plane
