// Enrollement du double facteur (TOTP) sur les comptes qui en portent la
// charge, et preuve que le second facteur fonctionne.
//
// Le PV de recette (§ 7) exige, pour les roles HSE, medecin du travail,
// directeur de site, administrateur et superviseur : nom, role, site **et
// double facteur enrole**. Ce script enrole le TOTP (Supabase Auth), verifie
// que la session atteint bien `aal2`, et conserve les secrets dans
// `.env.comptes.local`.
//
//   node tools/enroller-mfa.mjs              # enrole ce qui manque
//   node tools/enroller-mfa.mjs --code hse   # code TOTP du moment
//   node tools/enroller-mfa.mjs --verifier   # preuve aal2, sans enroller
//
// ── Le temps du serveur fait foi ───────────────────────────────────────────────
//
// Un code TOTP est un HMAC du temps : si l'horloge du poste qui l'emet est
// decalee de celle du serveur, le code est refuse — meme s'il est
// parfaitement calcule. C'est ce que constatait cette machine : son horloge
// avait une heure de retard sur celle de Supabase. Le code est donc toujours
// calcule sur le temps du serveur (lu dans son en-tete `Date`), et l'instant
// voisin est tente en secours.
//
// Les secrets TOTP sont des mots de passe : ils ne quittent jamais la
// machine. Aucun n'est affiche par ce script, a part l'URI otpauth (qui les
// contient) — a diffuser a la personne concernee via un canal sur.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { codeTotp, autoControleTotp, mesurerEcart, instantsCandidats } from './totp.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FICHIER_COMPTES = join(RACINE, '.env.comptes.local');

/**
 * Les cinq roles qui portent la charge du double facteur (§ 7 du PV).
 *
 * Le superviseur y figure pour une raison qui n'est pas de convenience : la
 * base le traite comme le HSE — `is_hse()` liste `supervisor`, et
 * `can_manage_site` lui donne la gestion de son site. Sa portee sur le site
 * pilote est celle du HSE ; son second facteur doit l'etre aussi.
 */
const CIBLES = [
  { cle: 'hse', libelle: 'HSE', email: 'test.hse@prevensante.test', variable: 'PREVENSANTE_HSE_PASSWORD' },
  { cle: 'medecin', libelle: 'Medecin du travail', email: 'test.medecin@prevensante.test', variable: 'PREVENSANTE_MEDECIN_PASSWORD' },
  { cle: 'admin', libelle: 'Administrateur', email: 'test.admin@prevensante.test', variable: 'PREVENSANTE_ADMIN_PASSWORD' },
  { cle: 'encadrement', libelle: 'Directeur de site', email: 'test.encadrement@prevensante.test', variable: 'PREVENSANTE_ENCADREMENT_PASSWORD' },
  { cle: 'superviseur', libelle: 'Superviseur', email: 'test.superviseur@prevensante.test', variable: 'PREVENSANTE_SUPERVISEUR_PASSWORD' },
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

autoControleTotp();

const env = {
  ...lireVariables(join(RACINE, 'web', '.env.local')),
  ...lireVariables(FICHIER_COMPTES),
};
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const cle = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
if (!url || !cle) {
  console.error('Instance non configuree : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis.');
  process.exit(1);
}

/** Ecart entre l horloge du serveur et celle de la machine, en millisecondes. */
let ecartServeur = null;
async function tempsServeur() {
  if (ecartServeur === null) ecartServeur = await mesurerEcart(url, cle);
  return Date.now() + ecartServeur;
}

/** Ecrit (ou remplace) une variable dans `.env.comptes.local`. */
function ecrireVariable(nom, valeur) {
  const lignes = existsSync(FICHIER_COMPTES)
    ? readFileSync(FICHIER_COMPTES, 'utf8').split(/\r?\n/)
    : [];
  const ligne = `${nom}=${valeur}`;
  const index = lignes.findIndex((l) => l.trim().startsWith(`${nom}=`));
  if (index === -1) {
    while (lignes.length > 0 && lignes[lignes.length - 1].trim() === '') lignes.pop();
    lignes.push('', '# ── Second facteur (TOTP) — ne jamais versionner ni transmettre ──', ligne, '');
  } else {
    lignes[index] = ligne;
  }
  writeFileSync(FICHIER_COMPTES, lignes.join('\n'), 'utf8');
}

/** Connexion par mot de passe (facteur 1). */
async function connecter(email, motDePasse) {
  const client = createClient(url, cle, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (error || !data.user) throw new Error(error?.message ?? 'connexion refusee');
  return client;
}

/**
 * Valide un code TOTP contre un facteur.
 *
 * Un challenge consomme est invalide : chaque tentative doit donc ouvrir son
 * propre challenge. On essaie l instant du serveur, puis ses voisins.
 *
 * Le niveau d'authentification est relu par l'API elle-meme
 * (`getAuthenticatorAssuranceLevel`) : c'est la seule preuve directe, l'objet
 * session ne portant pas la revendication.
 */
async function validerCode(client, factorId, secret) {
  const base = await tempsServeur();
  let dernier = null;
  for (const instant of instantsCandidats(base)) {
    const code = codeTotp(secret, instant);
    const { data: challenge, error: erreurChallenge } = await client.auth.mfa.challenge({ factorId });
    if (erreurChallenge || !challenge) {
      dernier = erreurChallenge?.message ?? 'challenge refuse';
      continue;
    }
    const { error } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) {
      dernier = error.message;
      continue;
    }
    const { data: niveau } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return { ok: true, aal: niveau?.currentLevel ?? 'inconnu', code };
  }
  return { ok: false, erreur: dernier ?? 'code refuse' };
}

const args = process.argv.slice(2);
const modeCode = args.includes('--code') ? args[args.indexOf('--code') + 1] : null;
const seulementVerifier = args.includes('--verifier');

if (modeCode) {
  const cible = CIBLES.find((c) => c.cle === modeCode);
  if (!cible) {
    console.error(`Cle inconnue : ${modeCode}. Disponibles : ${CIBLES.map((c) => c.cle).join(', ')}`);
    process.exit(1);
  }
  const nom = `PREVENSANTE_${cible.cle.toUpperCase()}_MFA_SECRET`;
  const secret = process.env[nom] || env[nom];
  if (!secret) {
    console.error(`Aucun secret TOTP enregistre pour « ${cible.libelle} ». Lancez d'abord l enrollement.`);
    process.exit(1);
  }
  console.log(codeTotp(secret, await tempsServeur()));
  process.exit(0);
}

console.log('=== Second facteur (TOTP) — comptes portant la charge ===\n');
let echecs = 0;

for (const cible of CIBLES) {
  const motDePasse = process.env[cible.variable] || env[cible.variable];
  if (!motDePasse) {
    console.error(`  [KO   ] ${cible.libelle} : mot de passe absent (${cible.variable})`);
    echecs++;
    continue;
  }
  try {
    const client = await connecter(cible.email, motDePasse);
    const { data: facteurs } = await client.auth.mfa.listFactors();
    // `listFactors` range les facteurs non verifies dans `all` ; `totp` ne
    // contient que ceux qui sont verifies. Il faut donc lire `all`.
    const tous = facteurs?.all ?? [];
    const existant = tous.find((f) => f.factor_type === 'totp' && f.status === 'verified');

    let factorId = existant?.id;
    let secret = env[`PREVENSANTE_${cible.cle.toUpperCase()}_MFA_SECRET`];

    if (existant) {
      if (!secret) {
        console.error(`  [KO   ] ${cible.libelle} : facteur deja enrole mais secret absent de .env.comptes.local`);
        echecs++;
        continue;
      }
      const { ok, aal, erreur } = await validerCode(client, factorId, secret);
      if (!ok) {
        console.error(`  [KO   ] ${cible.libelle} — code refuse : ${erreur}`);
        echecs++;
        continue;
      }
      console.log(`  [DEJA ] ${cible.libelle} — TOTP enrole, session aal2 prouvee (${aal})`);
      continue;
    }

    // Un facteur TOTP non verifie est un enrolement interrompu : son secret
    // n'est plus connu, il ne peut donc plus etre valide. Il occupe aussi le
    // nom, et refuse un nouvel enrolement. On le retire avant de recommencer.
    const residuel = tous.find((f) => f.factor_type === 'totp' && f.status !== 'verified');
    if (residuel) {
      const { error: erreurRetrait } = await client.auth.mfa.unenroll({ factorId: residuel.id });
      if (erreurRetrait) {
        console.error(`  [KO   ] ${cible.libelle} — retrait du facteur residuel impossible : ${erreurRetrait.message}`);
        echecs++;
        continue;
      }
      console.log(`  [NETTOI] ${cible.libelle} — facteur TOTP non verifie retire avant reenrolement`);
    }

    if (seulementVerifier) {
      console.log(`  [KO   ] ${cible.libelle} — aucun facteur TOTP enrole`);
      echecs++;
      continue;
    }

    const { data: enrolement, error: erreurEnrolement } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `PrevEnSanté — ${cible.libelle}`,
    });
    if (erreurEnrolement || !enrolement) {
      throw new Error(erreurEnrolement?.message ?? 'enrollement refuse');
    }
    factorId = enrolement.id;
    secret = enrolement.totp?.secret;
    if (!secret) throw new Error("l'enrolement n'a pas rendu de secret TOTP");

    const { ok, aal, erreur } = await validerCode(client, factorId, secret);
    if (!ok) throw new Error(erreur);

    ecrireVariable(`PREVENSANTE_${cible.cle.toUpperCase()}_MFA_SECRET`, secret);
    if (enrolement.totp?.uri) {
      ecrireVariable(`PREVENSANTE_${cible.cle.toUpperCase()}_MFA_URI`, enrolement.totp.uri);
    }

    // Preuve independante : une nouvelle connexion doit atteindre aal2.
    const frais = await connecter(cible.email, motDePasse);
    const preuve = await validerCode(frais, factorId, secret);
    if (!preuve.ok) throw new Error(`session aal2 non prouvee : ${preuve.erreur}`);

    console.log(`  [OK   ] ${cible.libelle} — TOTP enrole et verifie, session aal2 prouvee (${preuve.aal})`);
    if (enrolement.totp?.uri) console.log(`          otpauth : ${enrolement.totp.uri}`);
  } catch (e) {
    console.error(`  [KO   ] ${cible.libelle} — ${e?.message ?? 'erreur inconnue'}`);
    echecs++;
  }
}

console.log('');
process.exit(echecs > 0 ? 1 : 0);
