# PrevEnSanté

Plateforme multisectorielle de prévention des risques professionnels — mines, carrières,
cimenteries, usines de production, BTP, métallurgie, agroalimentaire, entrepôts et logistique.

Signalement des dangers, suivi des accidents et des actions correctives, assistance IA limitée.
Première version minimale fonctionnelle (MVP) sur **site pilote** avant extension multisectorielle.

## Pile technique

| Élément | Choix |
|---|---|
| Runtime | Node.js **LTS v24** |
| Gestionnaire de paquets | **npm** (seul lock du dépôt : `package-lock.json`) |
| Modules | **ESM** (`"type": "module"`) |
| Framework applicatif | **aucun imposé** — le socle utilise la bibliothèque standard (`node:http`) |
| Base de données / services | **Supabase distant** |
| Hébergement | **Vercel** |
| Versionnage | **git** + **GitHub** |
| Conteneurs | **aucun** — ni Docker ni Docker Compose, à aucun moment |

## Démarrage

```bash
npm ci            # installation reproductible depuis package-lock.json
cp .env.example .env
npm run dev       # serveur de développement (rechargement automatique)
```

Vérifier que l'application répond :

```bash
curl http://localhost:3000/health
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Démarre le serveur avec rechargement automatique (`node --watch`) |
| `npm start` | Démarre le serveur sans rechargement |
| `npm test` | Exécute les tests (banc d'essai intégré à Node) |

## Arborescence

```
prevensante/
├─ src/index.js        point d'entrée et serveur HTTP
├─ test/               tests
├─ .env.example        modèle de variables d'environnement
└─ .gitignore          secrets et artefacts exclus
```

## Secrets

`.env` n'est **jamais** versionné. Seul `.env.example` l'est, avec des valeurs fictives.
La clé `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais atteindre le navigateur.
Les variables Vercel se récupèrent avec `vercel env pull`, elles ne se recopient pas à la main.

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

## Déploiement Vercel

```bash
vercel whoami        # vérifier la session avant toute action
vercel link          # ⚠️ peut créer un projet distant — à confirmer
vercel deploy        # prévisualisation
vercel deploy --prod # production (après vérification)
```

## Documentation

- PRD : `docs/PRD_PrevEnSante.md`
- Backlog : géré dans Plane
