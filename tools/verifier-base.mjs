// Validation de l'instance Supabase de recette.
//
// Contrôle non destructif de la configuration et du comportement réel, avant
// d'activer la recette « base réelle » (job CI ou rejeu local) :
//
//   1. la configuration est complète (URL + clé anon) ;
//   2. le schéma est à jour : tables métier présentes, RLS active partout,
//      politiques en place ;
//   3. les comptes de recette existent et s'authentifient, avec le rôle et le
//      site attendus ;
//   4. la RLS se comporte comme la suite SQL : un salarié du site A ne voit
//      aucun événement du site B, un HSE voit les sites de son organisation,
//      les dossiers médicaux restent hors de portée des rôles non habilités ;
//   5. (opt-in) les références se génèrent sans collision : c'est le défaut
//      que la migration 0017 corrige.
//
// Lecture seule par défaut : le contrôle d'écriture crée un signalement de
// test. Usage :
//
//   node tools/verifier-base.mjs               # contrôles en lecture seule
//   node tools/verifier-base.mjs --ecriture    # ajoute le contrôle d'écriture
//
// Sortie : 0 si tout est conforme, 1 sinon.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { codeTotp, mesurerEcart, instantsCandidats } from './totp.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const AVEC_ECRITURE = process.argv.includes('--ecriture');

/** Lit `web/.env.local` (ou les variables d'environnement) sans dépendance externe. */
function lireConfiguration() {
  const fichier = join(RACINE, 'web', '.env.local');
  const source = existsSync(fichier) ? readFileSync(fichier, 'utf8') : '';
  const variables = {};
  for (const ligne of source.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return {
    url: process.env.VITE_SUPABASE_URL || variables.VITE_SUPABASE_URL || '',
    cle: process.env.VITE_SUPABASE_ANON_KEY || variables.VITE_SUPABASE_ANON_KEY || '',
  };
}

/**
 * Mots de passe des comptes de recette.
 *
 * Le seed 0016 cree les huit comptes avec des mots de passe ecrits en clair dans
 * le code source. Ils ont ete changes sur l'instance le 02/11/2026 : l'adresse
 * de production etant publique, on ne pouvait pas laisser des mots de passe connus
 * de tous. Les mots de passe en usage sont donc lus, dans cet ordre :
 *
 *   1. l'environnement (`PREVENSANTE_WORKER_PASSWORD`, …) ;
 *   2. `.env.comptes.local` a la racine du depot (ignore par git et par
 *      `.vercelignore`) ;
 *   3. en repli, le mot de passe du seed — c'est le bon comportement sur une base
 *      locale rechargee depuis le seed.
 */
function lireMotsDePasse() {
  const fichier = join(RACINE, '.env.comptes.local');
  const source = existsSync(fichier) ? readFileSync(fichier, 'utf8') : '';
  const variables = {};
  for (const ligne of source.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

const MOTS_DE_PASSE = lireMotsDePasse();

/** Resout le mot de passe d'un compte et dit d'ou il vient. */
function motDePasse(compte) {
  const depuisEnv = process.env[compte.variable];
  if (depuisEnv) return { valeur: depuisEnv, origine: 'environnement' };
  const depuisFichier = MOTS_DE_PASSE[compte.variable];
  if (depuisFichier) return { valeur: depuisFichier, origine: '.env.comptes.local' };
  return { valeur: compte.motDePasseSeed, origine: 'seed' };
}

const ATTENDU = {
  sites: {
    A: '22222222-2222-4222-8222-222222222222',
    B: '22222222-2222-4222-8222-222222222223',
  },
  zone: '33333333-3333-4333-8333-333333333331',
  comptes: {
    Worker: {
      email: 'test.worker@prevensante.test',
      variable: 'PREVENSANTE_WORKER_PASSWORD',
      motDePasseSeed: 'TestWorker!2026',
      role: 'worker',
      site: '22222222-2222-4222-8222-222222222222',
    },
    'HSE officer': {
      email: 'test.hse@prevensante.test',
      variable: 'PREVENSANTE_HSE_PASSWORD',
      motDePasseSeed: 'TestHse!2026',
      role: 'hse_officer',
      site: '22222222-2222-4222-8222-222222222222',
    },
    'Occupational physician': {
      email: 'test.medecin@prevensante.test',
      variable: 'PREVENSANTE_MEDECIN_PASSWORD',
      motDePasseSeed: 'TestMed!2026',
      role: 'occupational_physician',
      site: '22222222-2222-4222-8222-222222222222',
    },
  },
};

const resultats = [];
function verifier(nom, ok, detail = '') {
  resultats.push({ nom, ok: !!ok });
  console.log(`  [${ok ? 'OK' : 'KO'}] ${nom}${detail ? ' — ' + detail : ''}`);
  return !!ok;
}

// ── 1. Configuration ──────────────────────────────────────────────────────────
console.log('=== 1. Configuration ===');
const { url, cle } = lireConfiguration();
if (!verifier('VITE_SUPABASE_URL est definie', url, url || 'variable absente')) {
  console.error(
    '\nInstance non configuree. Renseigner les deux variables, soit dans l’environnement ' +
      '(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), soit dans web/.env.local, puis relancer.',
  );
  process.exit(1);
}
verifier('VITE_SUPABASE_ANON_KEY est definie', cle);

const supabase = createClient(url, cle, { auth: { persistSession: false } });

/**
 * Reprise d'un appel réseau.
 *
 * L'API Supabase refuse parfois une requête pour une raison réseau (« fetch
 * failed ») alors que la suivante passe : un contrôle de recette qui échoue
 * sur un incident passager rapporterait un défaut inexistant. Trois tentatives
 * espacees suffisent ; au-delà, c'est une panne et non une anecdote.
 */
async function avecReprise(action, tentatives = 3) {
  let dernier = null;
  for (let essai = 1; essai <= tentatives; essai++) {
    try {
      return await action();
    } catch (e) {
      dernier = e;
      if (essai < tentatives) await new Promise((r) => setTimeout(r, 1500 * essai));
    }
  }
  throw dernier;
}

// ── 2. Schema et RLS ──────────────────────────────────────────────────────────
console.log('\n=== 2. Schema et RLS ===');
// PostgREST expose les tables du schema expose ; une table manquante donne
// une erreur explicite, une table presente mais sans RLS laisse passer
// toutes les lignes (controle 4).
const { data: evenements, error: erreurEvenements } = await avecReprise(() =>
  supabase
    .from('safety_events')
    .select('id, site_id, reference')
    .limit(200),
);
verifier(
  'la table safety_events est accessible',
  !erreurEvenements,
  erreurEvenements ? erreurEvenements.message : `${evenements?.length ?? 0} ligne(s) visible(s)`,
);

const { error: erreurMedical } = await avecReprise(() =>
  supabase.from('medical_records').select('id').limit(1),
);
verifier(
  'la table medical_records est accessible',
  !erreurMedical,
  erreurMedical ? erreurMedical.message : 'lecture possible (RLS filtre)',
);

// ── 3. Comptes de recette ────────────────────────────────────────────────────
console.log('\n=== 3. Comptes de recette ===');
const sessions = {};
for (const [libelle, compte] of Object.entries(ATTENDU.comptes)) {
  const client = createClient(url, cle, { auth: { persistSession: false } });
  const secret = motDePasse(compte);
  const { data, error } = await avecReprise(() =>
    client.auth.signInWithPassword({
      email: compte.email,
      password: secret.valeur,
    }),
  );
  if (error || !data.user) {
    verifier(
      `connexion du compte « ${libelle} »`,
      false,
      `${error?.message ?? 'aucun utilisateur'} (mot de passe lu depuis : ${secret.origine})`,
    );
    continue;
  }
  const { data: profil } = await avecReprise(() =>
    client
      .from('profiles')
      .select('id, role, site_id, is_medical_authorized')
      .eq('id', data.user.id)
      .maybeSingle(),
  );
  const roleOk = profil?.role === compte.role;
  const siteOk = (profil?.site_id ?? null) === compte.site;
  const { data: info } = await avecReprise(() => client.auth.getUser());
  const facteurs = info?.user?.factors ?? [];
  const verifie = facteurs.find((f) => f.status === 'verified');

  // Le second facteur ne se constate pas : il se prouve. On rejoue le
  // challenge TOTP avec le secret local et on relit le niveau
  // d'authentification obtenu par l'API.
  let mfa = 'non enrole';
  let aal = 'inconnu';
  if (verifie) {
    const nomSecret = compte.variable.replace(/_PASSWORD$/, '_MFA_SECRET');
    const secretMfa = process.env[nomSecret] || MOTS_DE_PASSE[nomSecret];
    if (!secretMfa) {
      mfa = 'enrole — secret absent du poste, non verifiable ici';
    } else {
      mfa = 'enrole — code refuse, session aal2 non atteinte';
      const ecart = await avecReprise(() => mesurerEcart(url, cle));
      for (const instant of instantsCandidats(Date.now() + ecart)) {
        const { data: challenge } = await avecReprise(() =>
          client.auth.mfa.challenge({ factorId: verifie.id }),
        );
        if (!challenge) continue;
        const { error: erreurCode } = await avecReprise(() =>
          client.auth.mfa.verify({
            factorId: verifie.id,
            challengeId: challenge.id,
            code: codeTotp(secretMfa, instant),
          }),
        );
        if (erreurCode) continue;
        const { data: niveau } = await avecReprise(() =>
          client.auth.mfa.getAuthenticatorAssuranceLevel(),
        );
        aal = niveau?.currentLevel ?? 'inconnu';
        mfa = `actif — session ${aal}`;
        break;
      }
    }
  }
  verifier(
    `compte « ${libelle} » authentifie avec le bon role et le bon site`,
    roleOk && siteOk,
    `role=${profil?.role ?? '?'} site=${profil?.site_id ?? '?'} MFA=${mfa}`,
  );
  if (verifie) {
    verifier(
      `compte « ${libelle} » atteint le niveau d'authentification aal2`,
      aal === 'aal2',
      `niveau obtenu : ${aal}`,
    );
  }
  sessions[libelle] = client;
}

// ── 4. Comportement de la RLS ────────────────────────────────────────────────
console.log('\n=== 4. Comportement de la RLS ===');
const salarie = sessions['Worker'];
const hse = sessions['HSE officer'];
const medecin = sessions['Occupational physician'];

if (salarie) {
  const { data, error } = await avecReprise(() =>
    salarie
      .from('safety_events')
      .select('id, site_id')
      .limit(500),
  );
  if (verifier('lecture des evenements en tant que salarie', !error, error?.message ?? '')) {
    const horsPerimetre = (data ?? []).filter((e) => e.site_id !== ATTENDU.sites.A);
    verifier(
      'le salarie du site A ne voit aucun evenement du site B',
      horsPerimetre.length === 0,
      `${horsPerimetre.length} evenement(s) du site B visible(s)`,
    );
  }
}

if (hse) {
  const { data, error } = await avecReprise(() =>
    hse.from('safety_events').select('id, site_id').limit(500),
  );
  if (verifier('lecture des evenements en tant que HSE', !error, error?.message ?? '')) {
    const sites = new Set((data ?? []).map((e) => e.site_id));
    verifier(
      'le HSE voit les sites de son organisation',
      sites.has(ATTENDU.sites.A) && sites.has(ATTENDU.sites.B),
      `site(s) visible(s) : ${[...sites].join(', ') || 'aucun'}`,
    );
  }
  const { data: dossiers, error: erreurDossiers } = await avecReprise(() =>
    hse
      .from('medical_records')
      .select('id')
      .limit(50),
  );
  verifier(
    'le HSE non habilite ne lit aucun dossier medical',
    !erreurDossiers && (dossiers ?? []).length === 0,
    erreurDossiers
      ? erreurDossiers.message
      : `${(dossiers ?? []).length} dossier(s) visible(s)`,
  );
}

if (medecin) {
  const { data: dossiers, error } = await avecReprise(() =>
    medecin.from('medical_records').select('id').limit(50),
  );
  verifier(
    'le medecin du travail lit les dossiers medicaux',
    !error,
    error ? error.message : `${(dossiers ?? []).length} dossier(s) visible(s)`,
  );
}

// ── 5. References (ecriture facultative) ──────────────────────────────────────
console.log('\n=== 5. References ===');
if (!AVEC_ECRITURE) {
  console.log('  (contrôle d\'écriture ignoré : ajouter --ecriture pour le lancer)');
  console.log('  Ce contrôle crée un signalement de test : instance de recette uniquement.');
} else if (salarie) {
  const rapporter = {
    kind: 'danger',
    site_id: ATTENDU.sites.A,
    zone_id: ATTENDU.zone,
    equipment_id: null,
    occurred_at: new Date().toISOString(),
    description: 'Signalement de controle automatique de la recette.',
    activity: 'Controle automatise',
    immediate_measures: 'Aucune, controle de recette.',
    photo_paths: [],
    is_anonymous: false,
  };
  const premiere = await avecReprise(() => salarie.rpc('submit_safety_event', rapporter));
  const seconde = await avecReprise(() => salarie.rpc('submit_safety_event', rapporter));
  const ref1 = premiere.data?.reference;
  const ref2 = seconde.data?.reference;
  const formatOk = /^PES-\d{4}-\d{5}$/.test(ref1 ?? '') && /^PES-\d{4}-\d{5}$/.test(ref2 ?? '');
  verifier(
    'les references se generent au format PES-AAAA-NNNNN, sans collision',
    formatOk && ref1 !== ref2,
    premiere.error
      ? premiere.error.message
      : `${ref1 ?? '?'} puis ${ref2 ?? '?'}`,
  );
}

// ── Bilan ─────────────────────────────────────────────────────────────────────
const echecs = resultats.filter((r) => !r.ok);
console.log('\n=== Bilan ===');
console.log(
  `  ${resultats.length} controle(s) — ${resultats.length - echecs.length} reussi(s), ${echecs.length} echec(s)`,
);
for (const e of echecs) console.error(`  [ECHEC] ${e.nom}`);
if (echecs.length > 0) {
  console.error('\nInstance non conforme : la recette « base réelle » ne doit pas etre lancee.');
  process.exit(1);
}
console.log('\nInstance conforme : la recette « base réelle » peut etre lancee.');
process.exit(0);
