// Preuve que l'ecriture des noms fonctionne — et qu'elle se fait sans chaine
// de connexion.
//
// Ce que la preuve etablit, en trois temps :
//
//   1. l'administrateur ecrit un nom temporaire sur un profil du site pilote,
//      par l'API de l'application (aucune chaine de connexion) ;
//   2. la personne concernee se connecte et relit son propre profil par la
//      meme requete que l'application (`SessionProvider`) : elle voit donc le
//      nom ecrit ;
//   3. le nom d'origine est restaure, et la restauration est verifiee.
//
// La restauration est automatique, meme en cas d'echec : le script sort
// toujours par le meme chemin, et il refuse de finir sur un nom temporaire.
//
//   node tools/preuve-ecriture-habilitations.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { codeTotp, autoControleTotp, mesurerEcart, instantsCandidats } from './totp.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FICHIER_ENV_WEB = join(RACINE, 'web', '.env.local');
const FICHIER_COMPTES = join(RACINE, '.env.comptes.local');
const SITE_PILOTE = '22222222-2222-4222-8222-222222222222';

/** Le profil mis a l'epreuve : le superviseur du site pilote. */
const CIBLE = { role: 'supervisor', email: 'test.superviseur@prevensante.test', cle: 'superviseur' };
const NOM_TEMPORAIRE = 'PREUVE TEMPORAIRE — ecriture sans chaine de connexion';

function lireVariables(fichier) {
  if (!existsSync(fichier)) return {};
  const variables = {};
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

const env = { ...lireVariables(FICHIER_ENV_WEB), ...lireVariables(FICHIER_COMPTES) };
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const cle = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
if (!url || !cle) {
  console.error('Instance non configuree.');
  process.exit(1);
}

autoControleTotp();

/** Connexion d'un compte, second facteur compris : la session atteint `aal2`. */
async function connecter(email, motDePasse, secretMfa) {
  const client = createClient(url, cle, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (error || !data.user) throw new Error(`${email} : ${error?.message ?? 'connexion refusee'}`);

  const { data: facteurs } = await client.auth.mfa.listFactors();
  const totp = (facteurs?.all ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (!totp) throw new Error(`${email} : aucun facteur TOTP verifie`);

  const ecart = await mesurerEcart(url, cle);
  for (const instant of instantsCandidats(Date.now() + ecart)) {
    const code = codeTotp(secretMfa, instant);
    const { data: challenge, error: e1 } = await client.auth.mfa.challenge({ factorId: totp.id });
    if (e1 || !challenge) continue;
    const { error: e2 } = await client.auth.mfa.verify({
      factorId: totp.id,
      challengeId: challenge.id,
      code,
    });
    if (e2) continue;
    const { data: niveau } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return { client, aal: niveau?.currentLevel ?? 'inconnu', id: data.user.id };
  }
  throw new Error(`${email} : code TOTP refuse`);
}

const secret = (nom) => process.env[nom] || env[nom];

console.log('=== Preuve : ecrire un nom sans chaine de connexion ===\n');

let original = null;
let restauration = false;
let ecrit = false;

try {
  // ── 1. L'administrateur ────────────────────────────────────────────────────
  const admin = await connecter(
    'test.admin@prevensante.test',
    secret('PREVENSANTE_ADMIN_PASSWORD'),
    secret('PREVENSANTE_ADMIN_MFA_SECRET'),
  );
  console.log(`  [1] administrateur connecte, session ${admin.aal}`);

  const { data: profils, error: e1 } = await admin.client
    .from('profiles')
    .select('id, full_name, job_title, phone, role')
    .eq('site_id', SITE_PILOTE)
    .eq('role', CIBLE.role)
    .maybeSingle();
  if (e1) throw new Error(`lecture du profil impossible : ${e1.message}`);
  if (!profils) throw new Error('aucun profil « supervisor » sur le site pilote');

  original = profils.full_name;
  console.log(`      nom en base avant preuve : ${original}`);

  const { data: maj, error: e2 } = await admin.client
    .from('profiles')
    .update({ full_name: NOM_TEMPORAIRE, updated_at: new Date().toISOString() })
    .eq('id', profils.id)
    .select('full_name')
    .maybeSingle();
  if (e2) throw new Error(`ecriture refusee : ${e2.message}`);
  if (!maj) throw new Error("ecriture refusee : aucune ligne modifiee (politique RLS)");
  ecrit = true;
  console.log(`      ecrit sans chaine de connexion : ${maj.full_name}`);

  // ── 2. La personne concernee ───────────────────────────────────────────────
  const personne = await connecter(
    CIBLE.email,
    secret(`PREVENSANTE_${CIBLE.cle.toUpperCase()}_PASSWORD`),
    secret(`PREVENSANTE_${CIBLE.cle.toUpperCase()}_MFA_SECRET`),
  );
  console.log(`  [2] la personne concernee se connecte, session ${personne.aal}`);

  // La requete exacte de l'application (web/src/app/SessionProvider.tsx).
  const { data: vu, error: e3 } = await personne.client
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', personne.id)
    .maybeSingle();
  if (e3) throw new Error(`lecture du profil impossible : ${e3.message}`);
  console.log(`      l'application affiche : ${vu?.full_name}`);
  if (vu?.full_name !== NOM_TEMPORAIRE) {
    throw new Error('le nom ecrit n\'est pas visible par la personne concernee');
  }

  // ── 3. Restauration ────────────────────────────────────────────────────────
  const { data: restaure, error: e4 } = await admin.client
    .from('profiles')
    .update({ full_name: original, updated_at: new Date().toISOString() })
    .eq('id', profils.id)
    .select('full_name')
    .maybeSingle();
  if (e4) throw new Error(`restauration impossible : ${e4.message}`);
  if (!restaure || restaure.full_name !== original) {
    throw new Error(`restauration incorrecte : ${restaure?.full_name ?? 'inconnue'}`);
  }
  restauration = true;
  console.log(`  [3] nom d'origine restaure : ${restaure.full_name}`);
} catch (e) {
  console.error(`\n  ECHEC : ${e?.message ?? 'erreur inconnue'}`);
} finally {
  // Filet de securite : le nom d'origine doit toujours etre revenu.
  if (ecrit && !restauration && original) {
    console.error('\n  Restauration de secours…');
    try {
      const secours = await connecter(
        'test.admin@prevensante.test',
        secret('PREVENSANTE_ADMIN_PASSWORD'),
        secret('PREVENSANTE_ADMIN_MFA_SECRET'),
      );
      await secours.client
        .from('profiles')
        .update({ full_name: original, updated_at: new Date().toISOString() })
        .eq('role', CIBLE.role)
        .eq('site_id', SITE_PILOTE);
      console.error(`  Nom d'origine restaure : ${original}`);
      restauration = true;
    } catch (e2) {
      console.error(`  RESTAURATION IMPOSSIBLE : ${e2?.message ?? 'erreur inconnue'}`);
      console.error(`  A remettre manuellement sur le profil « ${CIBLE.role} » : ${original}`);
    }
  }
}

console.log('');
if (restauration) {
  console.log('  Preuve reussie : ecriture, visibilite par la personne concernee, restauration.');
  process.exit(0);
}
process.exit(1);
