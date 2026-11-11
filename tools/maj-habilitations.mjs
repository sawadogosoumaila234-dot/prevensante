// Mise à jour des habilitations du site pilote.
//
// Le PV de recette (§ 7) exige, pour chaque rôle qui porte la charge : nom,
// rôle, site et double facteur enrôlé. Le double facteur est en place et
// prouvé (cf. tools/enroller-mfa.mjs). Il reste le nom des personnes.
//
// Ce script écrit ces noms dans la base : `public.profiles` (nom affiché,
// fonction, téléphone) et `auth.users` (nom de l'utilisateur et, en option,
// adresse de connexion). Il ne touche ni au rôle, ni au site, ni au second
// facteur : il ne fait que nommer.
//
//   node tools/maj-habilitations.mjs --simulation      # lecture seule
//   node tools/maj-habilitations.mjs --appliquer       # écriture
//   node tools/maj-habilitations.mjs --simulation --fichier mon-lot.json
//
// Source des informations : un fichier JSON, hors dépôt (jamais versionné) :
//
//   {
//     "hse":         { "nom": "…", "fonction": "…", "telephone": "…", "email": "…" },
//     "medecin":     { "nom": "…", "fonction": "…", "telephone": "…" },
//     "admin":       { "nom": "…", "fonction": "…", "telephone": "…" },
//     "encadrement": { "nom": "…", "fonction": "…", "telephone": "…" },
//     "superviseur": { "nom": "…", "fonction": "…", "telephone": "…" }
//   }
//
// La chaîne de connexion vient de SUPABASE_DB_URL, de `.env.sauvegarde.local`,
// ou du premier argument.
//
// Règle d'or du projet : on relit avant d'écrire. Le script affiche donc
// l'état avant et après, et refuse d'écrire si un rôle n'a pas été nommé.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FICHIER_ENV = join(RACINE, '.env.sauvegarde.local');
const FICHIER_LOT_DEFAUT = join(RACINE, '.env.habilitations.local');

/** Le site pilote : Usine de Soumbo (SMB). */
const SITE_PILOTE = '22222222-2222-4222-8222-222222222222';

/**
 * Les cinq rôles du site pilote, et le rôle qu'ils portent en base.
 *
 * `encadrement` porte `site_director`, `superviseur` porte `supervisor` :
 * ce sont les noms métier, pas les valeurs de l'énumération `app_role`.
 */
const CIBLES = [
  { cle: 'hse', libelle: 'HSE', role: 'hse_officer' },
  { cle: 'medecin', libelle: 'Médecin du travail', role: 'occupational_physician' },
  { cle: 'admin', libelle: 'Administrateur', role: 'admin' },
  { cle: 'encadrement', libelle: 'Directeur de site', role: 'site_director' },
  { cle: 'superviseur', libelle: 'Superviseur', role: 'supervisor' },
];

/** Retire le mot de passe d'une chaine de connexion avant toute affichage. */
function masquerUrl(url) {
  return url.replace(/\/\/([^:@/]+):([^@]*)@/, '//$1:***@');
}

function lireVariables(fichier) {
  if (!existsSync(fichier)) return {};
  const variables = {};
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

const args = process.argv.slice(2);
const simulation = args.includes('--simulation');
const appliquer = args.includes('--appliquer');
const indexFichier = args.indexOf('--fichier');
const fichierLot =
  indexFichier !== -1 && args[indexFichier + 1]
    ? resolveAbsolute(args[indexFichier + 1])
    : FICHIER_LOT_DEFAUT;

function resolveAbsolute(p) {
  return p.startsWith('/') || /^[A-Za-z]:/.test(p) ? p : join(process.cwd(), p);
}

if (!simulation && !appliquer) {
  console.error('Précisez --simulation (lecture seule) ou --appliquer (écriture).');
  process.exit(1);
}

const variables = { ...lireVariables(FICHIER_ENV) };
const positionnel = args.filter(
  (a, i) => !a.startsWith('--') && !(indexFichier !== -1 && i === indexFichier + 1),
);
const url = process.env.SUPABASE_DB_URL || variables.SUPABASE_DB_URL || positionnel[0] || '';

if (!url) {
  console.error('Aucune chaine de connexion. Renseigner SUPABASE_DB_URL.');
  process.exit(1);
}

if (!existsSync(fichierLot)) {
  console.error(`Lot d'habilitations introuvable : ${fichierLot}`);
  console.error('');
  console.error('Créer ce fichier (jamais versionné) avec le contenu :');
  console.error('');
  console.error('{');
  for (const cible of CIBLES) {
    console.error(`  "${cible.cle}": { "nom": "…", "fonction": "…", "telephone": "…", "email": "…" },`);
  }
  console.error('}');
  process.exit(1);
}

let lot;
try {
  lot = JSON.parse(readFileSync(fichierLot, 'utf8'));
} catch (e) {
  console.error(`Lot illisible : ${e.message}`);
  process.exit(1);
}

const manquants = CIBLES.filter((c) => !lot[c.cle]?.nom);
if (manquants.length > 0) {
  console.error('Nom manquant pour : ' + manquants.map((c) => c.libelle).join(', '));
  console.error('Chaque rôle du site pilote doit être nommé avant écriture.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

console.log('=== Mise à jour des habilitations du site pilote ===\n');
console.log(`  instance   : ${masquerUrl(url)}`);
console.log(`  site       : Usine de Soumbo (SMB) — ${SITE_PILOTE}`);
console.log(`  mode       : ${simulation ? 'SIMULATION (lecture seule)' : 'ÉCRITURE'}`);
console.log(`  lot        : ${fichierLot}\n`);

try {
  await client.connect();
  await client.query('begin');

  // ── État avant ─────────────────────────────────────────────────────────────
  const avant = {};
  for (const cible of CIBLES) {
    const { rows } = await client.query(
      `select p.id, p.full_name, p.job_title, p.phone, u.email
         from public.profiles p
         join auth.users u on u.id = p.id
        where p.role = $1 and p.site_id = $2`,
      [cible.role, SITE_PILOTE],
    );
    avant[cible.cle] = rows[0] ?? null;
  }

  // ── Écriture ───────────────────────────────────────────────────────────────
  for (const cible of CIBLES) {
    const info = lot[cible.cle];
    const nom = String(info.nom).trim();
    const fonction = info.fonction ? String(info.fonction).trim() : null;
    const telephone = info.telephone ? String(info.telephone).trim() : null;
    const email = info.email ? String(info.email).trim() : null;

    const { rows: cibles } = await client.query(
      `select id from public.profiles where role = $1 and site_id = $2`,
      [cible.role, SITE_PILOTE],
    );
    if (cibles.length === 0) {
      console.error(`  [ALERTE] ${cible.libelle} : aucun profil « ${cible.role} » sur le site pilote`);
      continue;
    }
    if (cibles.length > 1) {
      console.error(
        `  [ALERTE] ${cible.libelle} : ${cibles.length} profils « ${cible.role} » sur le site pilote — écriture ignorée pour ce rôle`,
      );
      continue;
    }

    if (simulation) {
      console.log(
        `  [SIMUL] ${cible.libelle.padEnd(22)} ${(avant[cible.cle]?.full_name ?? '(vide)').padEnd(24)} → ${nom}`,
      );
      continue;
    }

    const id = cibles[0].id;
    await client.query(
      `update public.profiles
          set full_name = $1,
              job_title = coalesce($2, job_title),
              phone = coalesce($3, phone),
              updated_at = now()
        where id = $4`,
      [nom, fonction, telephone, id],
    );
    await client.query(
      `update auth.users
          set raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb($1::text), true)
        where id = $2`,
      [nom, id],
    );
    if (email) {
      // L'adresse de connexion n'est modifiable que si elle est disponible.
      const { rowCount } = await client.query(
        `update auth.users set email = $1 where id = $2 and not exists (select 1 from auth.users u2 where u2.email = $1 and u2.id <> $2)`,
        [email, id],
      );
      if (rowCount === 0) {
        console.error(`  [ALERTE] ${cible.libelle} : adresse ${email} déjà prise ou non modifiable — nom seul appliqué`);
      }
    }
    console.log(`  [OK   ] ${cible.libelle.padEnd(22)} ${(avant[cible.cle]?.full_name ?? '(vide)').padEnd(24)} → ${nom}`);
  }

  // ── État après ─────────────────────────────────────────────────────────────
  if (!simulation) {
    console.log('\n  État après :');
    for (const cible of CIBLES) {
      const { rows } = await client.query(
        `select p.full_name, p.job_title, u.email
           from public.profiles p join auth.users u on u.id = p.id
          where p.role = $1 and p.site_id = $2`,
        [cible.role, SITE_PILOTE],
      );
      const r = rows[0];
      if (r) {
        console.log(`    ${cible.libelle.padEnd(22)} ${r.full_name} — ${r.job_title ?? '(sans fonction)'} — ${r.email}`);
      }
    }
  }

  if (simulation) {
    await client.query('rollback');
    console.log('\n  Simulation terminée : rien n’a été écrit.');
  } else {
    await client.query('commit');
    console.log('\n  Écriture validée.');
    console.log('  Rappel : le second facteur est lié au compte, pas au nom —');
    console.log('  il reste actif (cf. tools/enroller-mfa.mjs --verifier).');
  }
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error(`\n  ECHEC : ${e?.message ?? 'erreur inconnue'}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
