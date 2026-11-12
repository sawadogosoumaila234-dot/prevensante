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
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { trouverChaine, normaliserPourPg, masquerUrl } from './chain-connexion.mjs';

const execFileAsync = promisify(execFile);

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FICHIER_ENV = join(RACINE, '.env.sauvegarde.local');
const DOSSIER_PAR_DEFAUT = join(homedir(), 'prevensante-sauvegardes');

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

const chaine = trouverChaine({ racine: RACINE, positionnel });
const url = chaine ? normaliserPourPg(chaine.url) : '';

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
  console.error('  - ou dans supabase/.env.local (jamais versionné).');
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

// La CLI est lancee par le script lui-meme, avec l'interpreteur Node du
// depot : sous Windows, un executable `.cmd` refuse d'etre lance par
// `execFile` sans interpréteur de commandes (« spawn EINVAL »). Passer par le
// script JS evite ce detour, et evite aussi de passer la chaine de connexion
// (qui contient un mot de passe) par une ligne de commande Shell.
const binaire = join(RACINE, 'node_modules', 'supabase', 'dist', 'supabase.js');
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

console.log('\n  Export en cours…\n');
try {
  // Deux exports, toujours : la structure d'un cote, les donnees de l'autre.
  //
  // Constat du 12/11/2026 : `supabase db dump --db-url` ne produit que la
  // structure — le fichier obtenu ne contenait ni une seule ligne de donnees
  // (aucun bloc COPY, aucun INSERT). Une sauvegarde sans les donnees ne sert
  // a rien le jour ou la base est a reconstruire. La CLI est donc appelee deux
  // fois : une fois pour la structure, une fois pour les donnees, et les deux
  // fichiers sont reunis en un seul dump restaurable.
  const fichiers = [];
  const dumps = dataOnly ? [['donnees', ['--data-only']]] : schemaOnly
    ? [['schema', []]]
    : [
        ['schema', []],
        ['donnees', ['--data-only']],
      ];

  for (const [nom, options] of dumps) {
    const cible = dumps.length === 1 ? fichier : join(dossier, `prevensante-${horodatage}-${nom}.sql`);
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [binaire, 'db', 'dump', '--db-url', url, '--file', cible, ...options],
      {
        cwd: RACINE,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      },
    );
    if (stdout?.trim()) console.log(stdout.trim());
    if (stderr?.trim()) console.error(stderr.trim());
    if (!existsSync(cible)) {
      throw new Error(`la CLI n'a produit aucun fichier pour l'export « ${nom} »`);
    }
    fichiers.push(cible);
  }

  if (fichiers.length > 1) {
    const parties = fichiers.map((f) => readFileSync(f, 'utf8'));
    writeFileSync(fichier, parties.join('\n\n'), 'utf8');
    for (const f of fichiers) {
      if (f !== fichier) unlinkSync(f);
    }
  }
} catch (e) {
  const sortie = `${e?.stdout ?? ''}\n${e?.stderr ?? ''}`;
  if (/docker: command not found|podman also not found/i.test(sortie)) {
    console.error('\n  L’export local exige Docker (ou Podman) : la CLI Supabase lance');
    console.error('  `pg_dump` dans un conteneur. Aucun conteneur n’est installé sur ce poste.');
    console.error('');
    console.error('  Ce n’est pas bloquant : l’export hebdomadaire est fait par le workflow');
    console.error('  « Sauvegarde hebdomadaire », sur un runner où Docker est présent.');
    console.error('  Pour un export immédiat, l’export peut aussi être demandé sur GitHub.');
    console.error('');
  }
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

/**
 * Export « structure seule ».
 *
 * La CLI Supabase de cette version ne sait pas produire une export de la seule
 * structure (`--schema-only` n'existe pas). On obtient donc l'export complet,
 * puis on en retire les donnees : les blocs `COPY ... FROM stdin;` et les
 * instructions `INSERT` sont ecartes, tout le reste — creation des tables,
 * index, politiques, fonctions, triggers — est conserve.
 *
 * Le resultat est verifie avant d'etre ecrit : il doit contenir la structure,
 * et ne doit plus contenir de donnees.
 */
function retirerLesDonnees(dump) {
  const lignes = dump.split('\n');
  const gardees = [];
  let dansCopy = false;
  let dansInsert = false;

  for (const ligne of lignes) {
    if (dansCopy) {
      if (ligne.trim() === '\\.') dansCopy = false;
      continue;
    }
    if (dansInsert) {
      if (ligne.trimEnd().endsWith(';')) dansInsert = false;
      continue;
    }
    if (/^COPY\s/i.test(ligne) && /FROM stdin;/.test(ligne)) {
      dansCopy = true;
      continue;
    }
    if (/^INSERT INTO\s/i.test(ligne)) {
      dansInsert = !ligne.trimEnd().endsWith(';');
      continue;
    }
    gardees.push(ligne);
  }
  return gardees.join('\n');
}

if (schemaOnly) {
  const dump = readFileSync(fichier, 'utf8');
  const structure = retirerLesDonnees(dump);
  if (!/CREATE TABLE/i.test(structure)) {
    console.error("\n  ECHEC : l'export de structure est vide — le dump n'a pas etre lu correctement.");
    process.exit(1);
  }
  if (/^COPY\s/i.test(structure) || /^INSERT INTO\s/im.test(structure)) {
    console.error("\n  ECHEC : des donnees subsistent dans l'export de structure.");
    process.exit(1);
  }
  writeFileSync(fichier, structure, 'utf8');
  console.log('\n  Export de structure : donnees retirees, structure conservee.');
}

// Un export « complet » qui ne contiendrait aucune donnee ne permettrait pas de
// reconstruire la base : il est donc refuse, plutot que publie en silence.
if (!schemaOnly && !dataOnly) {
  const dump = readFileSync(fichier, 'utf8');
  const contientDonnees = /^COPY\s/im.test(dump) || /^INSERT INTO\s/im.test(dump);
  if (!contientDonnees) {
    console.error('');
    console.error('  ECHEC : export sans aucune donnee.');
    console.error('  Une sauvegarde sans les lignes de la base ne sert a rien le jour');
    console.error('  ou la base est a reconstruire : elle est refusee, pas publiee.');
    process.exit(1);
  }
  const tables = new Set([...dump.matchAll(/^COPY\s+([\w".]+)\./gim)].map((m) => m[1]));
  console.log('');
  console.log(`  Export complet : structure et donnees reunies (${tables.size} table(s) peuplees).`);
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
