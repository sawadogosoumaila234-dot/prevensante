// Tableau des habilitations du site pilote — role, site, MFA.
//
// La case « Les habilitations du site pilote sont nommees (role + site + MFA) » du
// § 7 du PV de recette demande trois informations par personne : le role porte,
// le site de rattachement, et l'etat du double facteur. Ce script les releve sur
// l'instance, comptes de recette reels : il ne se contente pas de la seed.
//
//   node tools/tableau-habilitations.mjs
//   node tools/tableau-habilitations.mjs --markdown   # tableau pret a coller
//
// Les mots de passe sont lus dans `.env.comptes.local` (racine du depot, ignore
// par git) ou dans l'environnement (`PREVENSANTE_<ROLE>_PASSWORD`). Aucun mot de
// passe n'est affiche.
//
// Sortie : 0 si tous les comptes se connectent, 1 sinon.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { codeTotp, mesurerEcart, instantsCandidats } from './totp.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const EN_MARKDOWN = process.argv.includes('--markdown');

/** Lit un fichier `cle=valeur`, sans dependance externe. */
function lireVariables(fichier) {
  if (!existsSync(fichier)) return {};
  const source = readFileSync(fichier, 'utf8');
  const variables = {};
  for (const ligne of source.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

/** Les huit comptes du seed 0016, dans l'ordre de la fiche d'arbitrage. */
const COMPTES = [
  { libelle: 'HSE', email: 'test.hse@prevensante.test', variable: 'PREVENSANTE_HSE_PASSWORD' },
  { libelle: 'Medecin du travail', email: 'test.medecin@prevensante.test', variable: 'PREVENSANTE_MEDECIN_PASSWORD' },
  { libelle: 'Administrateur', email: 'test.admin@prevensante.test', variable: 'PREVENSANTE_ADMIN_PASSWORD' },
  { libelle: 'Encadrement (directeur de site)', email: 'test.encadrement@prevensante.test', variable: 'PREVENSANTE_ENCADREMENT_PASSWORD' },
  { libelle: 'Superviseur', email: 'test.superviseur@prevensante.test', variable: 'PREVENSANTE_SUPERVISEUR_PASSWORD' },
  { libelle: 'Salarie site A', email: 'test.worker@prevensante.test', variable: 'PREVENSANTE_WORKER_PASSWORD' },
  { libelle: 'Salarie site B', email: 'test.worker.b@prevensante.test', variable: 'PREVENSANTE_WORKER_B_PASSWORD' },
  { libelle: 'Salarie sans site', email: 'test.sanssite@prevensante.test', variable: 'PREVENSANTE_SANSSITE_PASSWORD' },
];

const env = { ...lireVariables(join(RACINE, 'web', '.env.local')), ...lireVariables(join(RACINE, '.env.comptes.local')) };

const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const cle = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
if (!url || !cle) {
  console.error(
    'Instance non configuree : renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ' +
      '(environnement ou web/.env.local).',
  );
  process.exit(1);
}

const lignes = [];
let echecs = 0;

/**
 * Connexion avec reprise : l'API Auth refuse parfois une requete pour une
 * raison reseau (« fetch failed ») alors que la suivante passe. Trois tentatives
 * espacees suffisent ; au-dela, c'est une panne et non une anecdote.
 */
async function connecter(client, email, motDePasse) {
  let dernier = null;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: motDePasse });
      if (!error && data?.user) return { data, error: null };
      dernier = error?.message ?? 'aucun utilisateur';
    } catch (e) {
      dernier = e?.message ?? 'erreur reseau';
    }
    if (essai < 3) await new Promise((r) => setTimeout(r, 1500 * essai));
  }
  return { data: null, error: dernier };
}

/**
 * Decrit le second facteur d'un compte.
 *
 * « Enrole » ne suffit pas : ce qui compte pour le PV est que la session
 * atteigne `aal2`. On le prouve donc en rejouant le challenge TOTP avec le
 * secret local — et le temps du serveur, car un code calcule sur une horloge
 * decalee est refuse.
 */
async function decrireSecondFacteur(client, facteurs, compte) {
  const verifies = facteurs.filter((f) => f.status === 'verified');
  if (verifies.length === 0) return 'non enrole — aucun second facteur';

  // Le secret du second facteur porte le meme prefixe que le mot de passe.
  const nomSecret = compte.variable.replace(/_PASSWORD$/, '_MFA_SECRET');
  const secret = process.env[nomSecret] || env[nomSecret];
  if (!secret) {
    return `enrole (${verifies.map((f) => f.factor_type).join(', ')}) — secret absent du poste, session aal2 non verifiable ici`;
  }
  const ecart = await mesurerEcart(url, cle);
  for (const instant of instantsCandidats(Date.now() + ecart)) {
    const { data: challenge, error: erreurChallenge } = await client.auth.mfa.challenge({
      factorId: verifies[0].id,
    });
    if (erreurChallenge || !challenge) continue;
    const { error } = await client.auth.mfa.verify({
      factorId: verifies[0].id,
      challengeId: challenge.id,
      code: codeTotp(secret, instant),
    });
    if (error) continue;
    const { data: niveau } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return `actif — session ${niveau?.currentLevel ?? 'inconnue'} atteinte`;
  }
  return 'enrole mais session aal2 non atteinte — le code est refuse';
}

for (const compte of COMPTES) {
  const motDePasse = process.env[compte.variable] || env[compte.variable];
  if (!motDePasse) {
    console.error(`Mot de passe absent pour ${compte.email} (${compte.variable}) : compte ignore.`);
    echecs++;
    continue;
  }
  const client = createClient(url, cle, { auth: { persistSession: false } });
  const { data, error } = await connecter(client, compte.email, motDePasse);
  if (error || !data?.user) {
    console.error(`Connexion impossible pour ${compte.email} : ${error}`);
    echecs++;
    continue;
  }
  const { data: profil } = await client
    .from('profiles')
    .select('full_name, role, site_id, is_medical_authorized, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  const { data: site } = await client
    .from('sites')
    .select('name, code, is_pilot')
    .eq('id', profil?.site_id ?? '')
    .maybeSingle();
  // Le double facteur se lit sur le compte lui-meme : `factors` vide signifie
  // qu'aucun second facteur n'est enrole (et non « on ne sait pas »).
  const { data: info } = await client.auth.getUser();
  const facteurs = info?.user?.factors ?? [];
  const mfa = await decrireSecondFacteur(client, facteurs, compte);
  lignes.push({
    libelle: compte.libelle,
    email: compte.email,
    nom: profil?.full_name || compte.libelle,
    role: profil?.role ?? '—',
    site: site ? `${site.name} (${site.code})${site.is_pilot ? ' — site pilote' : ''}` : 'aucun site',
    medical: profil?.is_medical_authorized ? 'oui' : 'non',
    actif: profil?.is_active ? 'oui' : 'non',
    mfa,
  });
}

if (EN_MARKDOWN) {
  console.log('| Personne | Compte | Role | Site | Double facteur (MFA) | Dossiers medicaux | Actif |');
  console.log('|---|---|---|---|---|---|---|');
  for (const l of lignes) {
    console.log(`| ${l.nom} | \`${l.email}\` | \`${l.role}\` | ${l.site} | ${l.mfa} | ${l.medical} | ${l.actif} |`);
  }
} else {
  console.log('\n=== Habilitations relevees sur l instance ===');
  for (const l of lignes) {
    console.log(`  ${l.nom} — ${l.libelle}`);
    console.log(`    ${l.email}`);
    console.log(`    role : ${l.role}   site : ${l.site}`);
    console.log(`    MFA : ${l.mfa}`);
    console.log(`    dossiers medicaux : ${l.medical}   actif : ${l.actif}`);
  }
  console.log('');
}

process.exit(echecs > 0 ? 1 : 0);
