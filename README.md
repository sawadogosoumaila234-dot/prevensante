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
| Framework applicatif | **aucun imposé** — routeur portable écrit en API Web standard (`Request`/`Response`) |
| Serveur local | `node:http` via un adaptateur (`src/index.js`) |
| Déploiement | Vercel **Functions** (`api/index.js`) — le même routeur sert en local et en production |
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
├─ src/
│  ├─ app.js           routeur portable (Request -> Response), sans dépendance
│  └─ index.js         adaptateur node:http + serveur de développement local
├─ api/index.js        fonction serverless Vercel (réutilise src/app.js)
├─ test/               tests
├─ public/             sortie statique (volontairement vide)
├─ vercel.json         routage vers la fonction
├─ .vercelignore       exclut docs/, test/ et les méta-fichiers du déploiement
├─ .env.example        modèle de variables d'environnement
└─ .gitignore          secrets et artefacts exclus
```

Pourquoi un routeur séparé : le même code répond en local et sur Vercel, donc ce qui est
testé est ce qui est déployé. Aucun framework n'est imposé ; remplacer `src/app.js` par
un framework plus tard ne touche ni `api/index.js` ni `src/index.js`.

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

Projet lié : `sawadogosoumaila234-5698/prevensante` — **https://prevensante.vercel.app**

```bash
vercel whoami        # vérifier la session avant toute action
vercel link          # relier le dossier au projet (déjà fait)
vercel build         # valide le build en local, sans rien déployer
vercel deploy        # prévisualisation
vercel deploy --prod # production (après vérification)
```

### ⚠️ Ne jamais déployer sans `.vercelignore` et `outputDirectory`

Le projet n'a **aucun framework**. Sans protection, Vercel sert la racine du dépôt en
fichiers statiques, sur une URL publique — ce qui publierait le PRD, le backlog et le code.

Deux protections sont en place, et elles sont **nécessaires toutes les deux** :

1. **`.vercelignore`** — `docs/`, `test/` et les méta-fichiers ne sont pas envoyés du tout.
2. **`outputDirectory: "public"`** dans `vercel.json` — `public/` est vide, donc la sortie
   statique ne contient rien du dépôt.

⚠️ **Un `rewrites` seul ne suffit pas** : les réécritures s'appliquent *après* la
vérification du système de fichiers, donc un fichier existant serait servi avant d'être
réécrit. La seule protection fiable est de ne pas envoyer le fichier.

Après tout changement de `vercel.json` ou `.vercelignore`, vérifier :

```bash
vercel build && find .vercel/output/static -type f   # doit n'afficher que .gitkeep
```

## Documentation

- PRD : `docs/PRD_PrevEnSante.md`
- Backlog : géré dans Plane
