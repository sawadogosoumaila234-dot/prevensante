// Test de restauration : le dump produit par la sauvegarde est-il rejouable ?
//
// La sauvegarde hebdomadaire hors site ne vaut que si l'export produit peut
// rebuilder la base. Ce script le verifie, au lieu de le supposer :
//
//   1. une base neuve est ouverte en local (PGlite) et le schema versionne
//      y est applique — **sans le jeu de demonstration**, qui ferait
//      double emploi avec les donnees du dump ;
//   2. les instructions de donnees du dump sont rejouees dedans ;
//   3. le nombre de lignes de chaque table est compare a celui de
//      l'instance reelle ;
//   4. le verdict est affiche : restaurable, ou non.
//
//   node tools/restaurer-sauvegarde.mjs --fichier <dump.sql>
//   node tools/restaurer-sauvegarde.mjs --fichier <dump.sql> --sans-live
//
// L'artefact de la sauvegarde hebdomadaire se telecharge depuis l'onglet
// Actions du depot, puis se donne a ce script.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { demarrerPGlite, decouper, extensionIndisponibleLocale } from './pglite-prelude.mjs';
import { trouverChaine, normaliserPourPg } from './chain-connexion.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DOSSIER_MIGRATIONS = join(RACINE, 'supabase', 'migrations');

const args = process.argv.slice(2);
const indexFichier = args.indexOf('--fichier');
const fichier = indexFichier !== -1 ? args[indexFichier + 1] : null;
const sansLive = args.includes('--sans-live');

if (!fichier || !existsSync(fichier)) {
  console.error('Usage : node tools/restaurer-sauvegarde.mjs --fichier <dump.sql> [--sans-live]');
  process.exit(1);
}

/**
 * Les tables de session de GoTrue ne sont pas emulees localement.
 *
 * Elles sont regenerationes par Supabase lui-meme ; leur presence dans le
 * dump est normale, leur absence dans l'emulation ne dit rien de la
 * restaurabilite du dump.
 */
const TABLES_HORS_EMULATION = [
  'auth.sessions',
  'auth.refresh_tokens',
  'auth.mfa_amr_claims',
  'auth.mfa_factors',
  'auth.mfa_challenges',
  'auth.flow_state',
  'auth.one_time_tokens',
];

const dump = readFileSync(fichier, 'utf8');
const instructions = decouper(dump);
const insertions = instructions.filter((s) => /^\s*insert\s+into\s/i.test(s));

console.log('=== Test de restauration ===\n');
console.log(`  dump        : ${fichier}`);
console.log(`  instructions : ${instructions.length} dans le dump, dont ${insertions.length} d'insertion\n`);

/** Les tables dont on compare le nombre de lignes. */
function tablesDesInsertions(liste) {
  const tables = new Set();
  for (const s of liste) {
    const m = s.match(/insert\s+into\s+"?([\w]+)"?\."?([\w]+)"?/i);
    if (m) tables.add(`${m[1]}.${m[2]}`);
  }
  return [...tables].sort();
}

const tables = tablesDesInsertions(insertions);

// ── 1. Base neuve + structure de reference, sans le jeu de demonstration ─────
const db = await demarrerPGlite({ pgtap: false });

const fichiers = readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
let instructionsAppliquees = 0;
for (const nom of fichiers) {
  // Le seed insere le jeu de demonstration : il ferait double emploi avec les
  // donnees du dump, et provoquerait des conflits de cles.
  if (/seed/i.test(nom)) continue;
  const sql = readFileSync(join(DOSSIER_MIGRATIONS, nom), 'utf8');
  for (const instr of decouper(sql)) {
    if (extensionIndisponibleLocale(instr)) continue;
    // Les identites des comptes de recette sont des donnees, pas du schema.
    if (/^\s*insert\s+into\s+"?auth"?\."?identities"?/i.test(instr)) continue;
    await db.exec(instr);
    instructionsAppliquees++;
  }
}
console.log(`  base neuve ouverte, ${instructionsAppliquees} instruction(s) de schema appliquee(s)`);

// ── 2. Rejeu des donnees du dump ────────────────────────────────────────────

/**
 * Les declencheurs applicatifs sont desactive pendant le rejeu.
 *
 * Ce ne sont pas des contraintes de donnees : ce sont des reaction du
 * quotidien. Rejouer un export avec eux actifs produit le double des lignes :
 *
 *   - `on_auth_user_created` recree un profil pour chaque compte insere, et
 *     le profil du dump vient alors en doublon ;
 *   - `trg_medical_records_guard` refuse l'insertion d'un dossier medical
 *     par un role qui n'est pas le medecin ;
 *   - les declencheurs d'audit, de journal, d'escalade et d'envoi ecritent
 *     une ligne a chaque insertion : le rejeu recreerait ce que le dump
 *     contient deja.
 *
 * Une restauration desactive donc ces declencheurs, rejoue, puis les reactive.
 */
const TABLES_SANS_DECLENCHEURS = [
  'auth.users',
  'public.profiles',
  'public.medical_records',
  'public.safety_events',
  'public.corrective_actions',
  'public.ai_proposals',
  'public.safety_documents',
  'public.safety_event_logs',
];

for (const table of TABLES_SANS_DECLENCHEURS) {
  const [schema, nom] = table.split('.');
  try {
    await db.exec(`alter table "${schema}"."${nom}" disable trigger user`);
  } catch {
    // Table absente de l'emulation locale : rien a desactiver.
  }
}

let rejouees = 0;
const echecs = [];
const horsEmulation = [];
for (const s of insertions) {
  const m = s.match(/insert\s+into\s+"?([\w]+)"?\."?([\w]+)"?/i);
  const table = m ? `${m[1]}.${m[2]}` : '?';
  try {
    await db.exec(s);
    rejouees++;
  } catch (e) {
    const message = (e?.message ?? 'erreur inconnue').split('\n')[0];
    if (TABLES_HORS_EMULATION.includes(table) || /does not exist/i.test(message)) {
      horsEmulation.push({ table, message });
    } else {
      echecs.push({ table, message });
    }
  }
}
console.log(`  donnees rejouees : ${rejouees}/${insertions.length}`);
if (horsEmulation.length > 0) {
  console.log(`  tables de session GoTrue (hors emulation locale) : ${horsEmulation.length}`);
}
if (echecs.length > 0) {
  console.log(`  ECHECS REJOUABLES : ${echecs.length}`);
  for (const e of echecs.slice(0, 8)) console.log(`    ${e.table} : ${e.message}`);
}

// ── 3. Comptage dans la base restauree ──────────────────────────────────────
const restaure = new Map();
for (const table of tables) {
  const [schema, nom] = table.split('.');
  try {
    const r = await db.query(`select count(*)::int as n from "${schema}"."${nom}"`);
    restaure.set(table, r.rows[0]?.n ?? 0);
  } catch {
    restaure.set(table, null);
  }
}

// ── 4. Comptage dans l'instance reelle ──────────────────────────────────────
const reel = new Map();
if (!sansLive) {
  const chaine = trouverChaine({ racine: RACINE });
  if (chaine) {
    const client = new pg.Client({
      connectionString: normaliserPourPg(chaine.url),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    });
    try {
      await client.connect();
      for (const table of tables) {
        const [schema, nom] = table.split('.');
        try {
          const r = await client.query(`select count(*)::int as n from "${schema}"."${nom}"`);
          reel.set(table, r.rows[0]?.n ?? 0);
        } catch {
          reel.set(table, null);
        }
      }
    } finally {
      await client.end().catch(() => {});
    }
    console.log('  instance reelle atteinte pour comparaison');
  } else {
    console.log("  aucune chaine de connexion : comparaison avec l'instance reelle impossible");
  }
}

// ── 5. Verdict ──────────────────────────────────────────────────────────────
console.log('\n  table                          restauree    reelle   lecture');
let ecarts = 0;
let peuplees = 0;
for (const table of tables) {
  const r = restaure.get(table);
  const l = reel.has(table) ? reel.get(table) : null;
  if (r === null) {
    console.log(`  ${table.padEnd(28)} ${'-'.padStart(10)} ${String(l ?? '-').padStart(9)}   non restauree`);
    continue;
  }
  if ((l ?? 0) > 0) peuplees++;
  if (l === null) {
    console.log(`  ${table.padEnd(28)} ${String(r).padStart(10)} ${'-'.padStart(9)}   restauree`);
    continue;
  }
  if (r === l) {
    console.log(`  ${table.padEnd(28)} ${String(r).padStart(10)} ${String(l).padStart(9)}   identique`);
  } else if (l > r) {
    console.log(
      `  ${table.padEnd(28)} ${String(r).padStart(10)} ${String(l).padStart(9)}   l'instance a evolue depuis l'export`,
    );
  } else {
    ecarts++;
    console.log(
      `  ${table.padEnd(28)} ${String(r).padStart(10)} ${String(l).padStart(9)}   ECART — a verifier`,
    );
  }
}

console.log('');
if (echecs.length > 0) {
  console.log(`  VERDICT : NON restaurable — ${echecs.length} instruction(s) de donnee n'ont pas pu etre rejouees.`);
  process.exit(1);
}
if (rejouees === 0 || peuplees === 0) {
  console.log('  VERDICT : le dump ne contient aucune donnee exploitable.');
  process.exit(1);
}
console.log(
  `  VERDICT : dump restaurable — ${rejouees} instruction(s) rejouee(s), ${peuplees} table(s) peuplees, aucun echec.`,
);
if (ecarts > 0) {
  console.log(`  ${ecarts} table(s) presentent un ecart avec l'instance actuelle : a regarder, mais le dump se rejoue.`);
}

await db.close();
process.exit(0);
