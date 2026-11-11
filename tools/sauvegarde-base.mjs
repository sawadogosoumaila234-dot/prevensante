// Sauvegarde de l'instance Supabase hors site.
//
// La decision A10 (hebergement et sauvegardes, validee le 02/11/2026) repose
// sur deux volumes : la sauvegarde quotidienne automatique de la plateforme, et
// un export hebdomadaire « hors site ». C'est cet export que ce script
// produit : il n'etait pas outille, et n'etait donc pas fait.
//
//   node tools/sauvegarde-base.mjs                 # schema + donnees
//   node tools/sauvegarde-base.mjs --schema-only   # structure seule
//   node tools/sauvegarde-base.mjs --data-only     # donnees seules
//   node tools/sauvegarde-base.mjs --dossier <chemin>
//
// La source de verite est la chaine de connexion Postgres de l'instance :
//
//   SUPABASE_DB_URL=postgresql://postgres.<ref>:<mot de passe>@aws-0-<region>.pooler.supabase.com:5432/postgres
//
// Elle se lit, dans l'ordre, dans l'environnement, puis dans
// `.env.sauvegarde.local` (racine du depot, ignore par git et par
// `.vercelignore`), puis dans le premier argument de la ligne de commande.
//
// L'export part par defaut dans `%USERPROFILE%\prevensante-sauvegardes`, donc
// hors du depot : un dump contient les donnees metier et les comptes, il ne
// doit jamais pouvoir etre commite par megarde. Le script refuse tout
// dossier situe dans le depot.
//
// L'export utilise la CLI Supabase du depot (`node_modules/.bin/supabase`),
// qui embarque son propre `pg_dump` : aucun conteneur n'est demarre, ce que
// les regles du projet interdisent.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FICHIER_ENV = join(RACINE, '.env.sauvegarde.local');
const DOSSIER_PAR_DEFAUT = join(homedir(), 'prevensante-sauvegardes');

/** Retire le mot de passe d'une chaine de connexion avant toute affichage. */
function masquerUrl(url) {
  return url.replace(/\/\/([^:@/]+):([^@]*)@/, '//$1:***@');
}

/** Lit `VARIABLE=valeur` dans un fichier de type `.env`. */
function lireFichierEnv(fichier) {
  if (!existsSync(fichier)) return {};
  const variables = {};
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

function aide() {
  console.log(`
Sauvegarde hebdomadaire de l'instance PrevEnSanté.

  node tools/sauvegarde-base.mjs [options] [chaine de connexion]

Options :
  --schema-only   structure seule (tables, index, politiques, fonctions)
  --data-only     donnees seules
  --dossier <p>   dossier de sortie (défaut : ${DOSSIER_PAR_DEFAUT})
  --aide          cette page

Variable d'environnement :
  SUPABASE_DB_URL   chaine de connexion de l'instance
`.trim());
}

const args = process.argv.slice(2);
if (args.includes('--aide') || args.includes('-h')) {
  aide();
  process.exit(0);
}

const schemaOnly = args.includes('--schema-only');
const dataOnly = args.includes('--data-only');
const indexDossier = args.indexOf('--dossier');
const dossier =
  indexDossier !== -1 && args[indexDossier + 1]
    ? resolve(args[indexDossier + 1])
    : process.env.SAUVERGARDE_DOSSIER
      ? resolve(process.env.SAUVERGARDE_DOSSIER)
      : DOSSIER_PAR_DEFAUT;

const positionnel = args.filter(
  (a, i) =>
    !a.startsWith('--') &&
    !(indexDossier !== -1 && i === indexDossier + 1) &&
    a !== 'supabase',
);

const variablesFichier = lireFichierEnv(FICHIER_ENV);
const fournie = positionnel.find((a) => a.startsWith('postgres'));
const url = process.env.SUPABASE_DB_URL || variablesFichier.SUPABASE_DB_URL || fournie || '';

if (!url) {
  const fournieMaisInvalide = positionnel.length > 0;
  if (fournieMaisInvalide) {
    console.error('Chaine de connexion invalide : elle doit commencer par postgresql:// ou postgres://');
    process.exit(1);
  }
  console.error('Aucune chaine de connexion.');
  console.error('');
  console.error('Renseigner SUPABASE_DB_URL :');
  console.error('  - dans l’environnement, ou');
  console.error(`  - dans ${FICHIER_ENV} (jamais versionné), ou`);
  console.error('  - en premier argument de la commande.');
  console.error('');
  console.error('Format : postgresql://postgres.<ref>:<mot de passe>@aws-0-<region>.pooler.supabase.com:5432/postgres');
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error(`Chaine de connexion invalide : ${masquerUrl(url)}`);
  process.exit(1);
}

// Garde-fou : un dump ne doit jamais atterrir dans le depot.
const relatif = relative(RACINE, dossier);
const dansDepot = relatif === '' || (!relatif.startsWith('..') && !isAbsolute(relatif));
if (dansDepot) {
  console.error(`Refus : le dossier ${dossier} est dans le depot.`);
  console.error('Un dump contient les donnees metier et les comptes : il doit rester hors du depot.');
  process.exit(1);
}

const binaire = join(
  RACINE,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
);
if (!existsSync(binaire)) {
  console.error('CLI Supabase introuvable. Lancer `npm ci` a la racine du depot.');
  process.exit(1);
}

mkdirSync(dossier, { recursive: true });

const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const suffixe = schemaOnly ? 'schema' : dataOnly ? 'donnees' : 'complet';
const fichier = join(dossier, `prevensante-${horodatage}-${suffixe}.sql`);

console.log('=== Sauvegarde de l’instance PrevEnSanté ===\n');
console.log(`  instance   : ${masquerUrl(url)}`);
console.log(`  contenu    : ${suffixe}`);
console.log(`  destination: ${fichier}`);

const argumentsDump = ['db', 'dump', '--db-url', url, '--file', fichier];
if (schemaOnly) argumentsDump.push('--schema-only');
if (dataOnly) argumentsDump.push('--data-only');

console.log('\n  Export en cours…\n');
try {
  const { stdout, stderr } = await execFileAsync(binaire, argumentsDump, {
    cwd: RACINE,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (stdout?.trim()) console.log(stdout.trim());
  if (stderr?.trim()) console.error(stderr.trim());
} catch (e) {
  console.error('\n  ECHEC de l’export.');
  console.error(`  ${e?.message ?? 'erreur inconnue'}`);
  if (e?.stdout) console.error(String(e.stdout).trim());
  if (e?.stderr) console.error(String(e.stderr).trim());
  process.exit(1);
}

if (!existsSync(fichier)) {
  console.error(`\n  ECHEC : le fichier ${fichier} n'a pas été produit.`);
  process.exit(1);
}

const contenu = readFileSync(fichier);
const empreinte = createHash('sha256').update(contenu).digest('hex');
const taille = statSync(fichier).size;
const lignes = contenu.toString('utf8').split('\n').length - 1;

const manifeste = {
  genereLe: new Date().toISOString(),
  instance: masquerUrl(url),
  contenu: suffixe,
  fichier: fichier,
  octets: taille,
  lignes,
  sha256: empreinte,
};
const fichierManifeste = join(dossier, `prevensante-${horodatage}-${suffixe}.manifest.json`);
writeFileSync(fichierManifeste, JSON.stringify(manifeste, null, 2), 'utf8');

console.log('\n=== Sauvegarde terminée ===\n');
console.log(`  fichier    : ${fichier}`);
console.log(`  taille     : ${(taille / 1024).toFixed(1)} Kio (${lignes} lignes)`);
console.log(`  sha256     : ${empreinte}`);
console.log(`  manifeste  : ${fichierManifeste}`);
console.log('');
console.log('  À faire ensuite : copier ce fichier vers un stockage hors site');
console.log('  (cloud Drive, NAS de l’entreprise) et vérifier la restauration');
console.log('  au moins une fois par trimestre.');
