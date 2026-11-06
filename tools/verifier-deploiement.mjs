// Controle de la configuration de deploiement Vercel.
//
// Equivalent local de « vercel build && find .vercel/output/static -type f »,
// mais executable partout et sans connexion : la commande Vercel echoue sur
// certaines machines Windows (spawn cmd.exe ENOENT).
//
// Ce que le script verifie :
//   1. la configuration Vercel telle qu'elle sera lue par la plateforme ;
//   2. ce que `.vercelignore` laisse passer vers Vercel ;
//   3. ce qui sera reellement servi publiquement (outputDirectory) ;
//   4. qu'aucun document interne, schema SQL ou secret ne part en ligne ;
//   5. que le code deploye s'execute : imports resolus et fichiers requis
//      presents dans l'archive envoyee a Vercel ;
//   6. que le repli SPA est en place (le front utilise BrowserRouter) ;
//   7. que la commande de build existe bien dans package.json.
//
// Sortie : 0 si rien n'est signale, 1 sinon.
//
// Usage : node tools/verifier-deploiement.mjs [racine-du-depot]
// Le second argument permet de controler un autre depot (jeu de donnees de
// test), sans modifier le script.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const argumentRacine = process.argv.slice(2).find((a) => !a.startsWith('-'));
const RACINE = resolve(argumentRacine ?? fileURLToPath(new URL('..', import.meta.url)));

// ── Motifs .vercelignore (syntaxe gitignore) ─────────────────────────────────
// Un motif se terminant par « / » ne concerne que les repertoires ; sinon il
// concerne les fichiers et les repertoires. Un motif ancre par « / » doit
// correspondre a la racine du depot, sinon il correspond a n'importe quel
// niveau.
function segmentEnRegex(segment) {
  const echappe = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${echappe.replace(/\*/g, '.*')}$`);
}

function motifIgnore(motif, cheminRelatif) {
  const estRepertoire = motif.endsWith('/');
  const corps = estRepertoire ? motif.slice(0, -1) : motif;
  const ancre = corps.startsWith('/');
  const segments = (ancre ? corps.slice(1) : corps).split('/').map(segmentEnRegex);
  const cible = cheminRelatif.split('/');

  if (ancre) {
    // Le motif doit correspondre a un prefixe du chemin.
    if (segments.length > cible.length) return false;
    return segments.every((r, i) => r.test(cible[i]));
  }
  if (segments.length === 1) {
    // Motif simple : il correspond a n'importe quel segment du chemin.
    return cible.some((c) => segments[0].test(c));
  }
  // Motif a plusieurs segments : il doit correspondre a la fin du chemin.
  if (segments.length > cible.length) return false;
  return segments.every((r, i) => r.test(cible[cible.length - segments.length + i]));
}

function ignore(motifs, cheminRelatif, estRepertoire) {
  return motifs.some((m) => {
    // Un motif de repertoire ne masque jamais un fichier directement ;
    // ce qu'il contient est masque par le controle des repertoires parents.
    if (estRepertoire === false && m.endsWith('/')) return false;
    return motifIgnore(m, cheminRelatif);
  });
}

/** Lit `.vercelignore` : un motif par ligne, commentaires et lignes vides ignores. */
function chargerMotifs(fichier) {
  if (!existsSync(fichier)) return [];
  return readFileSync(fichier, 'utf8')
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0 && !ligne.startsWith('#'));
}

// ── Parcours du depot ────────────────────────────────────────────────────────
const IGNORES_SYSTEME = new Set(['node_modules', '.git', '.vercel', 'dist', 'test-results', 'playwright-report']);

function parcourir(racine, base = racine) {
  const fichiers = [];
  for (const entree of readdirSync(base, { withFileTypes: true })) {
    if (IGNORES_SYSTEME.has(entree.name)) continue;
    const complet = join(base, entree.name);
    if (entree.isDirectory()) {
      fichiers.push(...parcourir(racine, complet));
    } else {
      fichiers.push(complet);
    }
  }
  return fichiers;
}

// ── 1. Configuration ─────────────────────────────────────────────────────────
console.log('=== 1. Configuration ===');
const fichierVercel = join(RACINE, 'vercel.json');
const vercel = JSON.parse(readFileSync(fichierVercel, 'utf8'));
const motifs = chargerMotifs(join(RACINE, '.vercelignore'));
console.log(`  framework        : ${vercel.framework}`);
console.log(`  buildCommand     : ${vercel.buildCommand}`);
console.log(`  outputDirectory  : ${vercel.outputDirectory}`);
console.log(`  rewrites         : ${(vercel.rewrites ?? []).map((r) => `${r.source} -> ${r.destination}`).join(' | ')}`);
console.log(`  .vercelignore    : ${motifs.length} motif(s)`);

const alertes = [];
function signaler(message) {
  alertes.push(message);
  console.log(`  [ALERTE] ${message}`);
}
function remarquer(message) {
  console.log(`  [remarque] ${message}`);
}

// ── 2. Ce qui part sur Vercel ───────────────────────────────────────────────
console.log('\n=== 2. Fichiers transmis a Vercel ===');
const tous = parcourir(RACINE);
const transmis = [];
const ignores = [];
for (const fichier of tous) {
  const rel = relative(RACINE, fichier).split(sep).join('/');
  const relDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  if (ignore(motifs, rel, false) || (relDir && ignore(motifs, relDir, true))) {
    ignores.push(rel);
  } else {
    transmis.push(rel);
  }
}
console.log(`  ${transmis.length} fichier(s) transmis, ${ignores.length} exclu(s)`);

// ── 3. Ce qui est servi publiquement ─────────────────────────────────────────
console.log('\n=== 3. Sortie statique servie ===');
const sortie = (vercel.outputDirectory ?? '').split(sep).join('/').replace(/\/$/, '');
if (!sortie) {
  signaler('aucun outputDirectory : la racine du depot serait servie publiquement');
} else {
  const horsSortie = transmis.filter((f) => !f.startsWith(`${sortie}/`));
  console.log(`  sortie statique : ${sortie}/ (reconstruite par Vercel au deploiement)`);
  console.log(`  ${horsSortie.length} fichier(s) transmis hors sortie statique (fonction serverless comprise)`);
  // La sortie statique est reconstruite par Vercel : la version locale ne doit
  // pas etre envoyee, sinon elle peut masquer les artefacts du build distant.
  if (transmis.some((f) => f.startsWith(`${sortie}/`))) {
    signaler(`${sortie}/ est transmis alors que Vercel reconstruit cette arborescence`);
  }
  // Contenu reellement public : ce que le visiteur peut telecharger apres
  // le build. On analyse donc le bundle produit sur disque.
  const racineSortie = join(RACINE, sortie);
  if (!existsSync(racineSortie)) {
    remarquer(`${sortie}/ absent : lancer « npm run build:web » avant un deploiement`);
  } else {
    const bundle = parcourir(racineSortie);
    console.log(`  ${bundle.length} fichier(s) dans le bundle local`);
    const TEXTE = /\.(html?|css|json|webmanifest|map|txt|xml|js)$/i;
    for (const fichier of bundle) {
      const rel = relative(racineSortie, fichier).split(sep).join('/');
      if (/\.(md|sql|map)$/i.test(rel) || /(^|\/)\.env/i.test(rel)) {
        signaler(`${sortie}/${rel} serait servi publiquement (document interne, source map ou variable d'environnement)`);
      }
      if (TEXTE.test(rel) && /service_role/i.test(readFileSync(fichier, 'utf8'))) {
        signaler(`${sortie}/${rel} contient une mention de cle service_role`);
      }
    }
  }
}

// ── 4. Rien de sensible en ligne ─────────────────────────────────────────────
console.log('\n=== 4. Donnees internes et secrets ===');
const SENSIBLES = [
  { motif: /^docs\//, why: 'documentation interne (PRD, PV, backlog)' },
  { motif: /^supabase\//, why: 'schema SQL et seed' },
  { motif: /^tools\//, why: 'outillage de developpement' },
  { motif: /^test\//, why: 'tests du routeur' },
  { motif: /^\.github\//, why: 'definition des pipelines CI' },
  { motif: /(^|\/)\.env/, why: 'variables d’environnement' },
  { motif: /\.sql$/i, why: 'script SQL' },
  { motif: /\.md$/i, why: 'document Markdown' },
  { motif: /service_role/i, why: 'mention de cle service_role' },
  { motif: /^web\/e2e\//, why: 'tests E2E (identifiants du jeu de recette)' },
];
let nbSensibles = 0;
for (const f of transmis) {
  for (const s of SENSIBLES) {
    if (s.motif.test(f)) {
      signaler(`${f} est transmis alors qu'il ne doit pas partir en ligne (${s.why})`);
      nbSensibles += 1;
    }
  }
}
if (nbSensibles === 0) console.log('  aucun document interne, script SQL ni secret transmis');

// ── 5. Le code deploye s'execute ─────────────────────────────────────────────
console.log('\n=== 5. Integrite du code deploie ===');

/** Extensions tentees pour un import local sans extension. */
const EXTENSIONS = ['', '.js', '.mjs', '.cjs', '.json', '.ts', '.tsx', '.jsx'];

/** Resout un specifier relatif vers un fichier existant du depot. */
function resoudreLocal(fichier, specifier) {
  const base = resolve(dirname(fichier), specifier);
  for (const extension of EXTENSIONS) {
    const candidat = base + extension;
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat;
  }
  for (const extension of EXTENSIONS.slice(1)) {
    const candidat = join(base, `index${extension}`);
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat;
  }
  return null;
}

/** Extrait les specifiers d'un fichier JS/TS (import statique et dynamique). */
function importsLocaux(contenu) {
  const trouves = [];
  const motifs = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const motif of motifs) {
    let m;
    while ((m = motif.exec(contenu)) !== null) trouves.push(m[1]);
  }
  return trouves;
}

const TRANSMIS = new Set(transmis);
const examines = new Set();
let nbImports = 0;

/** Verifie recursivement que les imports d'un fichier se resolvent et sont transmis. */
function verifierImports(fichier, chaine = []) {
  const complet = resolve(fichier);
  if (examines.has(complet)) return;
  examines.add(complet);

  const rel = relative(RACINE, complet).split(sep).join('/');
  const contenu = readFileSync(complet, 'utf8');
  for (const specifier of importsLocaux(contenu)) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue; // paquet npm
    nbImports += 1;
    const cible = resoudreLocal(complet, specifier);
    if (!cible) {
      signaler(`${rel} importe « ${specifier} » : fichier introuvable dans le depot`);
      continue;
    }
    const relCible = relative(RACINE, cible).split(sep).join('/');
    if (!TRANSMIS.has(relCible)) {
      signaler(`${rel} importe « ${specifier} » (${relCible}), exclu de l'archive Vercel : le deploiement echouerait`);
    }
    verifierImports(cible, [...chaine, rel]);
  }
}

// Point d'entree de la fonction serverless : tout ce qu'elle utilise doit etre
// transmis, sinon Vercel ne pourra pas construire ni executer la fonction.
const dossierApi = join(RACINE, 'api');
const pointEntrees = [];
if (existsSync(dossierApi)) {
  for (const entree of readdirSync(dossierApi, { withFileTypes: true })) {
    if (entree.isFile() && /\.(js|mjs|cjs)$/.test(entree.name)) {
      pointEntrees.push(join(dossierApi, entree.name));
    }
  }
}
if (pointEntrees.length === 0) {
  const routeApi = (vercel.rewrites ?? []).some((r) => String(r.source ?? '').startsWith('/api'));
  if (routeApi) {
    signaler('aucune fonction serverless dans api/ : la reecriture /api/:path* ne pourra pas repondre');
  } else {
    remarquer('aucune fonction serverless dans api/ (deploiement purement statique)');
  }
} else {
  for (const entree of pointEntrees) verifierImports(entree);
  console.log(`  ${nbImports} import(s) local(aux) resolus dans ${pointEntrees.length} fonction(s) serverless`);
}

// Fichiers indispensables au build Vite, hors graphe d'imports.
const REQUIS_BUILD = [
  'web/package.json',
  'web/package-lock.json',
  'web/index.html',
  'web/vite.config.ts',
  'web/tsconfig.json',
  'web/src/main.tsx',
];
for (const f of REQUIS_BUILD) {
  if (!existsSync(join(RACINE, f))) {
    signaler(`${f} est absent du depot : le build Vercel echouerait`);
  } else if (!TRANSMIS.has(f)) {
    signaler(`${f} est exclu de l'archive Vercel alors que le build en a besoin`);
  }
}

/**
 * Graphe d'imports du front, a partir des points d'entree.
 *
 * C'est le controle qui attrape une exclusion **trop large** : le motif
 * « supabase/ » de `.vercelignore`, non ancre, excluait aussi
 * `web/src/lib/supabase/client.ts` — le client Supabase du front — et le build
 * Vercel echouait avec « TS2307: Cannot find module './supabase/client' ».
 * Une liste de fichiers attendus n'aurait pas vu passer ce genre d'exclusion.
 */
function grapheImports(racines) {
  const vus = new Set();
  const atteignables = new Set();
  const visiter = (fichier) => {
    const complet = resolve(fichier);
    if (vus.has(complet)) return;
    vus.add(complet);
    const rel = relative(RACINE, complet).split(sep).join('/');
    atteignables.add(rel);
    if (!/\.(m?[jt]sx?)$/.test(complet)) return;
    const contenu = readFileSync(complet, 'utf8');
    for (const specifier of importsLocaux(contenu)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue; // paquet npm
      const cible = resoudreLocal(complet, specifier);
      if (cible) visiter(cible);
    }
  };
  for (const racine of racines) {
    if (existsSync(join(RACINE, racine))) visiter(join(RACINE, racine));
  }
  return atteignables;
}

const GRAPHE_FRONT = grapheImports(['web/src/main.tsx', 'web/vite.config.ts']);
if (GRAPHE_FRONT.size === 0) {
  signaler("le graphe d'imports du front est vide : web/src/main.tsx est introuvable ou illisible");
} else {
  const manquants = [...GRAPHE_FRONT].filter((f) => !TRANSMIS.has(f)).sort();
  console.log(`  ${GRAPHE_FRONT.size} fichier(s) dans le graphe d'imports du front`);
  if (manquants.length > 0) {
    for (const f of manquants) {
      signaler(`${f} est requis par le build du front mais exclu de l'archive Vercel : le build echouerait`);
    }
  }
}

// ── 6. Repli SPA et commande de build ────────────────────────────────────────
console.log('\n=== 6. Repli SPA et build ===');
const reecritures = vercel.rewrites ?? [];
const repliSpa = reecritures.some(
  (r) => /index\.html$/.test(String(r.destination ?? '')) && !String(r.source ?? '').startsWith('/api'),
);
if (!repliSpa) {
  signaler(
    'aucune reecriture SPA vers index.html : le front utilise BrowserRouter, ' +
      'un rafraichissement sur une route profonde renverrait 404',
  );
} else {
  const trouve = reecritures.find((r) => /index\.html$/.test(String(r.destination ?? '')));
  console.log(`  repli SPA present : ${trouve.source} -> ${trouve.destination}`);
}
const racinePkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
const pkgWeb = JSON.parse(readFileSync(join(RACINE, 'web', 'package.json'), 'utf8'));
const commande = String(vercel.buildCommand ?? '');
const prefixe = commande.includes('--prefix web') ? 'web/' : '';
const script = commande.replace(/^npm --prefix web run /, '').replace(/^npm run /, '');
const scripts = prefixe ? pkgWeb.scripts : racinePkg.scripts;
if (!scripts || !scripts[script]) {
  signaler(`la commande de build « ${commande} » ne correspond a aucun script de package.json`);
} else {
  console.log(`  commande de build valide : ${commande}`);
}

// Racine du depot : contenu transmis, pour reperer un reste inutile.
const racineTransmise = transmis.filter((f) => !f.includes('/'));
console.log(`  racine transmise : ${racineTransmise.join(', ') || '(vide)'}`);

// ── Bilan ─────────────────────────────────────────────────────────────────────
console.log('\n=== Bilan ===');
if (alertes.length === 0) {
  console.log('  aucune alerte : la configuration de deploiement est conforme');
  process.exit(0);
}
console.log(`  ${alertes.length} alerte(s) a traiter`);
process.exit(1);
