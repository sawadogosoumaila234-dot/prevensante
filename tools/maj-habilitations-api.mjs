// Nommer les personnes du site pilote — sans la chaine de connexion.
//
// Pourquoi ce second outil ?
//
// `tools/maj-habilitations.mjs` ecrit en SQL direct : c'est la voie la plus
// complete (elle touche aussi `auth.users`), mais elle exige le mot de passe
// de la base. Ce script passe par l'API de l'application elle-meme : la cle
// publique et le mot de passe du compte administrateur suffisent.
//
// Concretement, pour l'application, les deux voies sont identiques : le nom
// affiche vient de `public.profiles.full_name`, et c'est la seule table que
// l'application lit pour afficher un nom (verifie : aucune occurrence de
// `user_metadata` dans `web/src`). Le profil etant mis a jour, l'application
// affiche le nouveau nom au prochain chargement.
//
// Ce que cette voie ne fait pas, et que la voie SQL fait :
//   - l'adresse de connexion (`auth.users.email`) : elle appartient a l'API
//     d'administration de Supabase, pas a l'API publique ;
//   - le nom de doublon dans `auth.users.raw_user_meta_data` :pareil.
//
// Usage :
//
//   node tools/maj-habilitations-api.mjs --simulation
//   node tools/maj-habilitations-api.mjs --appliquer
//   node tools/maj-habilitations-api.mjs --appliquer --fichier mon-lot.json
//
// Le lot est le meme JSON que pour l'autre outil :
//
//   {
//     "hse":         { "nom": "…", "fonction": "…", "telephone": "…" },
//     "medecin":     { "nom": "…", "fonction": "…", "telephone": "…" },
//     "admin":       { "nom": "…", "fonction": "…", "telephone": "…" },
//     "encadrement": { "nom": "…", "fonction": "…", "telephone": "…" },
//     "superviseur": { "nom": "…", "fonction": "…", "telephone": "…" }
//   }
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { codeTotp, autoControleTotp, mesurerEcart, instantsCandidats } from './totp.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FICHIER_LOT_DEFAUT = join(RACINE, '.env.habilitations.local');
const FICHIER_ENV_WEB = join(RACINE, 'web', '.env.local');
const FICHIER_COMPTES = join(RACINE, '.env.comptes.local');

/** Le site pilote : Usine de Soumbo (SMB). */
const SITE_PILOTE = '22222222-2222-4222-8222-222222222222';

/**
 * Les cinq roles du site pilote, et le role qu'ils portent en base.
 *
 * `encadrement` porte `site_director`, `superviseur` porte `supervisor` :
 * ce sont les noms metier, pas les valeurs de l'enumeration `app_role`.
 */
const CIBLES = [
  { cle: 'hse', libelle: 'HSE', role: 'hse_officer' },
  { cle: 'medecin', libelle: 'Medecin du travail', role: 'occupational_physician' },
  { cle: 'admin', libelle: 'Administrateur', role: 'admin' },
  { cle: 'encadrement', libelle: 'Directeur de site', role: 'site_director' },
  { cle: 'superviseur', libelle: 'Superviseur', role: 'supervisor' },
];

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
    ? args[indexFichier + 1].startsWith('/') || /^[A-Za-z]:/.test(args[indexFichier + 1])
      ? args[indexFichier + 1]
      : join(process.cwd(), args[indexFichier + 1])
    : FICHIER_LOT_DEFAUT;

if (!simulation && !appliquer) {
  console.error('Precisez --simulation (lecture seule) ou --appliquer (ecriture).');
  process.exit(1);
}

if (!existsSync(fichierLot)) {
  console.error(`Lot d'habilitations introuvable : ${fichierLot}`);
  console.error('');
  console.error('Copier .env.habilitations.example en .env.habilitations.local, le completer,');
  console.error('puis relancer. Les cinq roles doivent tous etre nommes.');
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
  console.error('Chaque role du site pilote doit etre nomme avant ecriture.');
  process.exit(1);
}

const env = { ...lireVariables(FICHIER_ENV_WEB), ...lireVariables(FICHIER_COMPTES) };
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const cle = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
const motDePasse = process.env.PREVENSANTE_ADMIN_PASSWORD || env.PREVENSANTE_ADMIN_PASSWORD || '';
const secretMfa = process.env.PREVENSANTE_ADMIN_MFA_SECRET || env.PREVENSANTE_ADMIN_MFA_SECRET || '';

if (!url || !cle || !motDePasse) {
  console.error('Configuration incomplete : cle publique, adresse de l\'instance et mot de passe');
  console.error('administrateur sont requis (web/.env.local et .env.comptes.local).');
  process.exit(1);
}

/**
 * Connexion du compte administrateur, second facteur compris.
 *
 * Le second facteur n'est pas un decor : le compte porte un TOTP enrole, et
 * l'API de l'application verifie le niveau d'authentification de la session.
 * On atteint donc `aal2` — exactement le niveau d'un administrateur reel.
 */
async function connecterAdministrateur() {
  const client = createClient(url, cle, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: 'test.admin@prevensante.test',
    password: motDePasse,
  });
  if (error || !data.user) throw new Error(error?.message ?? 'connexion refusee');

  if (!secretMfa) {
    throw new Error('secret TOTP administrateur absent (.env.comptes.local)');
  }
  const { data: facteurs } = await client.auth.mfa.listFactors();
  const totp = (facteurs?.all ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (!totp) throw new Error('aucun facteur TOTP verifie sur le compte administrateur');

  const ecart = await mesurerEcart(url, cle);
  for (const instant of instantsCandidats(Date.now() + ecart)) {
    const code = codeTotp(secretMfa, instant);
    const { data: challenge, error: erreurChallenge } = await client.auth.mfa.challenge({
      factorId: totp.id,
    });
    if (erreurChallenge || !challenge) continue;
    const { error: erreurVerify } = await client.auth.mfa.verify({
      factorId: totp.id,
      challengeId: challenge.id,
      code,
    });
    if (erreurVerify) continue;
    const { data: niveau } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return { client, aal: niveau?.currentLevel ?? 'inconnu' };
  }
  throw new Error('code TOTP refuse');
}

autoControleTotp();

console.log('=== Mise a jour des habilitations — via l\'API, sans chaine de connexion ===\n');
console.log('  instance   : ' + url);
console.log('  site       : Usine de Soumbo (SMB) — ' + SITE_PILOTE);
console.log('  mode       : ' + (simulation ? 'SIMULATION (lecture seule)' : 'ECRITURE'));
console.log('  lot        : ' + fichierLot + '\n');

let client;
try {
  const connexion = await connecterAdministrateur();
  client = connexion.client;
  console.log(`  session    : administrateur connecte, niveau ${connexion.aal}\n`);

  // ── Etat avant ─────────────────────────────────────────────────────────────
  const { data: profils, error: erreurLecture } = await client
    .from('profiles')
    .select('id, full_name, job_title, phone, role, site_id')
    .eq('site_id', SITE_PILOTE)
    .in('role', CIBLES.map((c) => c.role));
  if (erreurLecture) throw new Error(`lecture impossible : ${erreurLecture.message}`);

  const parRole = new Map((profils ?? []).map((p) => [p.role, p]));

  // ── Ecriture ───────────────────────────────────────────────────────────────
  for (const cible of CIBLES) {
    const info = lot[cible.cle];
    const nom = String(info.nom).trim();
    const fonction = info.fonction ? String(info.fonction).trim() : null;
    const telephone = info.telephone ? String(info.telephone).trim() : null;

    const profil = parRole.get(cible.role);
    if (!profil) {
      console.error(`  [ALERTE] ${cible.libelle} : aucun profil « ${cible.role} » sur le site pilote`);
      continue;
    }

    if (simulation) {
      console.log(
        `  [SIMUL] ${cible.libelle.padEnd(22)} ${(profil.full_name ?? '(vide)').padEnd(24)} -> ${nom}`,
      );
      continue;
    }

    const maj = { full_name: nom, updated_at: new Date().toISOString() };
    if (fonction) maj.job_title = fonction;
    if (telephone) maj.phone = telephone;

    const { data: ecrit, error: erreurEcriture } = await client
      .from('profiles')
      .update(maj)
      .eq('id', profil.id)
      .select('full_name, job_title, phone')
      .maybeSingle();
    if (erreurEcriture) {
      console.error(`  [KO   ] ${cible.libelle} : ${erreurEcriture.message}`);
      continue;
    }
    if (!ecrit) {
      console.error(`  [KO   ] ${cible.libelle} : ecriture refusee (aucune ligne modifiee)`);
      continue;
    }
    console.log(
      `  [OK   ] ${cible.libelle.padEnd(22)} ${(profil.full_name ?? '(vide)').padEnd(24)} -> ${ecrit.full_name}`,
    );
  }

  // ── Etat apres ─────────────────────────────────────────────────────────────
  if (!simulation) {
    const { data: apres } = await client
      .from('profiles')
      .select('full_name, job_title, role')
      .eq('site_id', SITE_PILOTE)
      .in('role', CIBLES.map((c) => c.role));
    console.log('\n  Etat apres :');
    for (const cible of CIBLES) {
      const r = (apres ?? []).find((p) => p.role === cible.role);
      if (r) console.log(`    ${cible.libelle.padEnd(22)} ${r.full_name} — ${r.job_title ?? '(sans fonction)'}`);
    }
    console.log('\n  Ecriture validee.');
    console.log('  L\'application affiche ces noms : elle les lit dans public.profiles.');
  } else {
    console.log('\n  Simulation terminee : rien n\'a ete ecrit.');
  }
} catch (e) {
  console.error(`\n  ECHEC : ${e?.message ?? 'erreur inconnue'}`);
  process.exit(1);
}
