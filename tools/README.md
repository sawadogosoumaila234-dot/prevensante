# Validation des migrations SQL — sans Docker

Ce dossier contient les outils qui permettent de valider `supabase/migrations/`
**sur une machine sans Docker et sans instance Supabase**.

## Pourquoi

`supabase db push` exige Docker ou un projet Supabase connecté. Ces outils
reproduisent localement les trois niveaux de contrôle, du plus léger au plus
strict :

| Outil | Ce qu'il vérifie | Dépendance |
|---|---|---|
| `valider-migrations.mjs` | Chaque instruction est parsée par le vrai parseur PostgreSQL (`libpg_query` en WASM). Détecte la syntaxe invalide. | `pgsql-parser` |
| `coherence-migrations.mjs` | Tables, fonctions, index et triggers référencent des objets qui existent. | aucun |
| `colonnes-migrations.mjs` | Chaque colonne citée dans une politique RLS existe dans la table visée. | aucun |
| `executer-migrations.mjs` | Les migrations sont **exécutées** dans un PostgreSQL complet (PGlite) et l'état final est inspecté. | `@electric-sql/pglite` + extensions |
| `test-fonctionnel.mjs` | Le comportement métier : RLS par rôle, triggers de garde-fou, séparation du schéma `medical`. | idem |

## Installation

```bash
npm i -D pgsql-parser @electric-sql/pglite @electric-sql/pglite-pgvector \
         @electric-sql/pglite-postgis
```

## Usage

```bash
npm run migrations:parse      # syntaxe
npm run migrations:coherence  # objets référencés
npm run migrations:colonnes   # colonnes des politiques RLS
npm run migrations:run        # exécution complète + inspection de la base
npm run db:test               # tests fonctionnels (RLS, triggers)
```

## Émulation de Supabase

`executer-migrations.mjs` et `test-fonctionnel.mjs` créent eux-mêmes ce que
Supabase fournit, afin que les migrations soient testées à l'identique :

- le schéma `auth` et la table `auth.users` ;
- la fonction `auth.uid()` (qui lit `request.jwt.claim.sub`) ;
- les rôles `authenticated`, `anon`, `service_role` (avec `bypassrls`) ;
- les extensions `pgcrypto`, `pg_trgm`, `vector` (pgvector) et `postgis`.

## Limite connue

PGlite n'est pas un serveur : il n'a pas de `pg_auth`, donc **les JWT Supabase
réels ne sont pas vérifiés**. Le test repose sur le claim
`request.jwt.claim.sub`, ce qui reproduit fidèlement le comportement de
`auth.uid()`. Une validation finale reste nécessaire sur l'instance Supabase
avant la mise en production.
