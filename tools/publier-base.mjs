// Publication du schema sur l'instance Supabase, avec rapport horodate.
//
// La publication se fait en deux temps, jamais en un :
//   1. `supabase db push --dry-run` : le plan d'application est affiche et
//      relu ;
//   2. `supabase db push` : l'application n'a lieu qu'ensuite, et seulement
//      si le plan a ete valide.
//
// Sans `--confirm`, le script s'arrete a l'etape 3 (simulation). C'est le
// comportement par defaut : la simulation est sans risque, l'application
// modifie la base.
//
// Usage :
//   node tools/publier-base.mjs --ref <project-ref> [--confirm] [--rapport <fichier>] [--e2e]
//   node tools/publier-base.mjs --db-url <url-postgres> [--confirm] [--rapport <fichier>]
//
// Deux facons de publier sur l'instance :
//   - par jeton d'administration (--ref, ou SUPABASE_ACCESS_TOKEN) ;
//   - par connexion directe a la base (--db-url), qui n'exige aucun jeton et
//     reste possible depuis un poste sans IPv6 en passant par le pooler de
//     session de Supabase.
//
// Le jeton d'acces est lu dans SUPABASE_ACCESS_TOKEN. Il ne doit jamais etre
// ecrit dans un fichier du depot, ni figurer dans le rapport.
// La chaine de connexion contient le mot de passe de la base : elle n'est
// ni consignee dans le rapport, ni affichee.
//
// Sortie : 0 si la publication et la verification sont conformes, 1 sinon.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(RACINE, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');

// ── Arguments ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function option(nom, defaut = null) {
  const i = args.indexOf(`--${nom}`);
  if (i === -1) return defaut;
  const valeur = args[i + 1];
  return valeur && !valeur.startsWith('--') ? valeur : true;
}
/** Valeur d'option attendue comme chaine : null si l'option est isolee. */
function optionChaine(nom, defaut = null) {
  const i = args.indexOf(`--${nom}`);
  if (i === -1) return defaut;
  const valeur = args[i + 1];
  return valeur && !valeur.startsWith('--') ? valeur : null;
}
const REF = option('ref', process.env.SUPABASE_PROJECT_REF ?? null);
const DB_URL = optionChaine('db-url', process.env.SUPABASE_DB_URL ?? null);
const CLE_ANNON_OPT = optionChaine('cle-anon', null);
const CONFIRMER = args.includes('--confirm');
const E2E = args.includes('--e2e');
const RAPPORT = option('rapport', null);

// ── Journal horodate ─────────────────────────────────────────────────────────
/** @type {{id:string, phase:string, libelle:string, commande:string, debut:string, fin:string|null, dureeMs:number|null, code:number|null, statut:string, sortie:string}[]} */
const etapes = [];
let phaseCourante = 'A';

/** Horodatage local, lisible et sans ambiguite. */
function horodatage(date = new Date()) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Ne laisse passer aucun secret dans le rapport. */
function assainir(texte) {
  return String(texte ?? '')
    .replace(/sbp_[A-Za-z0-9_-]{10,}/g, 'sbp_[MASQUE]')
    .replace(/sb_publishable_[A-Za-z0-9_-]{10,}/g, 'sb_publishable_[MASQUE]')
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[JWT MASQUE]')
    .replace(/postgresql:\/\/[^\s'"`]+/gi, 'postgresql://[MASQUE]')
    .replace(/(service_role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN)(\s*[=:]\s*)\S+/gi, '$1$2[MASQUE]')
    .replace(/(anon[_ ]?key|VITE_SUPABASE_ANON_KEY)(\s*[=:]\s*)\S+/gi, '$1$2[MASQUE]');
}

/**
 * Extrait le project-ref d'une chaine de connexion Supabase.
 *
 * Deux formes sont rencontrees :
 *   - pooler de session : postgresql://postgres.<ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres
 *   - connexion directe : postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
 */
function extraireRef(url) {
  const texte = String(url ?? '');
  const pooler = texte.match(/postgres\.([a-z]{20})[:@]/);
  if (pooler) return pooler[1];
  const direct = texte.match(/db\.([a-z]{20})\.supabase\./);
  if (direct) return direct[1];
  const libre = texte.match(/([a-z]{20})/);
  return libre ? libre[1] : null;
}

/** Lit une variable d'un fichier .env local (valeur apres le premier =). */
function lireVariableEnvLocal(chemin, nom) {
  if (!existsSync(chemin)) return '';
  for (const ligne of readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const coupe = ligne.trim();
    if (coupe === '' || coupe.startsWith('#')) continue;
    const i = coupe.indexOf('=');
    if (i === -1) continue;
    if (coupe.slice(0, i).trim() === nom) {
      return coupe.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

/** Ne garde que les lignes utiles d'une sortie de commande. */
function resumer(sortie, maxLignes = 40) {
  const lignes = assainir(sortie)
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '');
  return lignes.slice(0, maxLignes).join('\n');
}

/** Enregistre une etape et l'affiche. */
function etape(id, libelle, commande, code, sortie, statut = null, dureeMs = 0) {
  const debut = new Date();
  const e = {
    id,
    phase: phaseCourante,
    libelle,
    commande,
    debut: horodatage(debut),
    fin: horodatage(),
    dureeMs,
    code,
    statut: statut ?? (code === 0 ? 'OK' : 'ÉCHEC'),
    sortie: resumer(sortie),
  };
  etapes.push(e);
  const marque = e.statut === 'OK' ? 'OK   ' : e.statut === 'BLOQUÉ' ? 'BLOC ' : 'ECHEC';
  console.log(`  [${marque}] ${e.debut}  ${libelle}`);
  if (e.statut !== 'OK') {
    for (const ligne of e.sortie.split('\n').slice(0, 6)) console.log(`          ${ligne}`);
  }
  return e;
}

/** Lance une commande et renvoie { code, sortie }. */
function lancer(commande, args, env = {}) {
  const resultat = spawnSync(commande, args, {
    cwd: RACINE,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    code: resultat.status ?? 1,
    sortie: `${resultat.stdout ?? ''}${resultat.stderr ?? ''}`,
  };
}

/**
 * Retrouve la cle publique « anon » dans la sortie JSON du CLI.
 *
 * Cette cle est publique par nature : elle est livree dans le bundle du
 * navigateur. Seule la cle `service_role` est un secret, et elle n'est jamais
 * demandee ici.
 */
function trouverCleAnon(valeur) {
  if (Array.isArray(valeur)) {
    for (const item of valeur) {
      const trouvee = trouverCleAnon(item);
      if (trouvee) return trouvee;
    }
    return null;
  }
  if (!valeur || typeof valeur !== 'object') return null;
  const etiquette = [valeur.name, valeur.type, valeur.key, valeur.id, valeur.role]
    .filter(Boolean)
    .join(' ');
  if (/anon/i.test(etiquette)) {
    for (const v of Object.values(valeur)) {
      if (typeof v === 'string' && v.startsWith('eyJ')) return v;
    }
  }
  for (const v of Object.values(valeur)) {
    const trouvee = trouverCleAnon(v);
    if (trouvee) return trouvee;
  }
  return null;
}

// ── Phase A : chaine de validation locale ────────────────────────────────────
console.log('=== Phase A — Chaine de validation locale ===');
phaseCourante = 'A';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const validations = [
  ['A1', 'Typage du front', [npm, '--prefix', 'web', 'run', 'typecheck']],
  ['A2', 'Build de production', [npm, '--prefix', 'web', 'run', 'build']],
  ['A3', 'Tests hors navigateur', [npm, 'test']],
  ['A4', 'Analyse des migrations', [npm, 'run', 'migrations:parse']],
  ['A5', 'Coherence des migrations', [npm, 'run', 'migrations:coherence']],
  ['A6', 'Colonnes des politiques RLS', [npm, 'run', 'migrations:colonnes']],
  ['A7', 'Application des migrations (PGlite)', [npm, 'run', 'migrations:run']],
  ['A8', 'Tests fonctionnels SQL (RLS, triggers)', [npm, 'run', 'db:test']],
  ['A9', 'Controle de la configuration de deploiement', [npm, 'run', 'deploiement:verifier']],
  ['A10', 'Audit des dependances', [npm, 'audit', '--audit-level=high']],
];
if (E2E) {
  validations.push(['A11', 'Recette E2E (bureau + mobile)', [npm, 'exec', '--prefix', 'web', '--', 'playwright', 'test', '--reporter=list']]);
}

let validationKo = false;
for (const [id, libelle, commande] of validations) {
  const t0 = Date.now();
  const { code, sortie } = lancer(commande[0], commande.slice(1));
  if (code !== 0) validationKo = true;
  etape(id, libelle, commande.join(' '), code, sortie, null, Date.now() - t0);
}

// ── Phase B : prerequis distants ─────────────────────────────────────────────
console.log('\n=== Phase B — Prerequis distants ===');
phaseCourante = 'B';

// Deux facons de s'authentifier, et une seule suffit :
//   - la variable SUPABASE_ACCESS_TOKEN dans l'environnement ;
//   - les identifiants deja enregistres par le CLI (« supabase login »).
//
// Le CLI 2.122 ecrit son jeton dans ~/.supabase/profile ; les versions
// precedentes utilisaient ~/.supabase/access-token. On regarde les deux.
// Le jeton n'est jamais lu, ni affiche, ni consigne : le CLI s'en charge.
const token = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const dossierSupabase = join(homedir(), '.supabase');
const jetonCLI = ['profile', 'access-token'].some((nom) => existsSync(join(dossierSupabase, nom)));
const envSupabase = token ? { SUPABASE_ACCESS_TOKEN: token } : {};

// Mode « connexion directe » : la chaine de connexion est fournie par
// --db-url (ou SUPABASE_DB_URL). Aucun jeton d'administration n'est alors
// requis : c'est le mode qui fonctionne depuis un poste sans IPv6, en
// passant par le pooler de session de Supabase.
const modeDirect = Boolean(DB_URL);
const refDirect = modeDirect ? extraireRef(DB_URL) : null;

const auth = { token: token || null, jetonCLI, projets: null };
if (!modeDirect && (token || jetonCLI)) {
  const liste = lancer(CLI, ['projects', 'list', '--output-format', 'json'], envSupabase);
  if (liste.code === 0) {
    try {
      auth.projets = JSON.parse(liste.sortie);
    } catch {
      auth.projets = [];
    }
  }
}

// Resultat de la sonde de connexion, reutilise en C1.
let sondeMigrations = null;

if (modeDirect) {
  const t0 = Date.now();
  sondeMigrations = lancer(CLI, ['migration', 'list', '--db-url', DB_URL], {});
  const ok = sondeMigrations.code === 0;
  etape(
    'B1',
    'Connexion directe a l’instance (sans jeton d’administration)',
    'supabase migration list --db-url [MASQUE]',
    sondeMigrations.code,
    ok ? 'Connexion etablie : la chaine de connexion fournie est acceptee.' : sondeMigrations.sortie,
    ok ? null : 'BLOQUÉ',
    Date.now() - t0,
  );
} else if (auth.projets) {
  etape('B1', 'Authentification du CLI Supabase', 'supabase projects list', 0, `${auth.projets.length} projet(s) accessible(s) au compte connecte.`);
} else if (token) {
  etape('B1', 'Authentification du CLI Supabase', 'SUPABASE_ACCESS_TOKEN', 0, 'jeton present dans l\u2019environnement (valeur non consignee)');
} else {
  etape(
    'B1',
    'Authentification du CLI Supabase',
    'supabase login',
    1,
    "Aucune session. Dans un terminal : « npx supabase login » (le CLI ouvre la page de jeton d\u2019acces), puis relancer ce script.",
    'BLOQUÉ',
  );
}

// Le project-ref est decouvert depuis la liste des projets : l'utilisateur
// n'a pas a le recopier.
let ref = typeof REF === 'string' ? REF : null;
let origineRef = '--ref';
if (!ref && modeDirect && refDirect) {
  ref = refDirect;
  origineRef = 'extrait de la chaine de connexion';
}
if (!ref && auth.projets) {
  if (auth.projets.length === 1) {
    ref = auth.projets[0].id;
    origineRef = 'decouverte (projet unique)';
  } else if (auth.projets.length === 0) {
    etape(
      'B2',
      'Reference du projet (project-ref)',
      'supabase projects list',
      1,
      'Aucun projet sur ce compte. Creer un projet depuis le tableau de bord, puis relancer.',
      'BLOQUÉ',
    );
  } else {
    const liste = auth.projets
      .map((p) => `  ${p.id}  ${p.name ?? ''}  ${p.region ?? ''}  ${p.status ?? ''}`)
      .join('\n');
    etape(
      'B2',
      'Reference du projet (project-ref)',
      '--ref <project-ref>',
      1,
      `Plusieurs projets : choisir avec --ref. Projectes disponibles :\n${liste}`,
      'BLOQUÉ',
    );
  }
}
if (ref) {
  etape('B2', 'Reference du projet (project-ref)', origineRef, 0, ref);
} else if (modeDirect) {
  etape(
    'B2',
    'Reference du projet (project-ref)',
    'extrait de --db-url',
    0,
    'Reference non extraite de la chaine de connexion : elle n’est pas necessaire a la publication.',
  );
} else if (!auth.projets) {
  etape(
    'B2',
    'Reference du projet (project-ref)',
    'supabase projects list',
    1,
    "Reference non obtenue : la decouverte passe par « supabase projects list », qui exige l\u2019authentification (B1).",
    'BLOQUÉ',
  );
}

// ── Phase C : etat, simulation, application ─────────────────────────────────
console.log('\n=== Phase C — Migration de l\u2019instance ===');
phaseCourante = 'C';
const authentifie = Boolean(auth.projets) || Boolean(token);
// En mode direct, la chaine de connexion suffit : ni jeton ni project-ref
// ne sont requis pour pousser les migrations.
const pret = modeDirect ? true : Boolean(authentifie && ref);

if (!pret) {
  etape('C1', 'Etat des migrations distantes', 'supabase migration list', 1, 'Prerequis manquants : B1/B2.', 'BLOQUÉ');
  etape('C2', 'Simulation (db push --dry-run)', 'supabase db push --dry-run', 1, 'Prerequis manquants : B1/B2.', 'BLOQUÉ');
  etape(
    'C3',
    'Application (db push)',
    'supabase db push',
    1,
    CONFIRMER
      ? 'Prerequis manquants : B1/B2.'
      : 'Prerequis manquants : B1/B2 (et --confirm serait requis de toute facon).',
    'BLOQUÉ',
  );
} else {
  if (modeDirect) {
    etape(
      'C1',
      'Etat des migrations distantes',
      'supabase migration list --db-url [MASQUE]',
      sondeMigrations?.code ?? 1,
      sondeMigrations?.sortie ?? '',
      null,
      0,
    );
  } else {
    const lister = lancer(CLI, ['migration', 'list', '--linked', '--project-ref', ref], envSupabase);
    etape('C1', 'Etat des migrations distantes', 'supabase migration list --linked', lister.code, lister.sortie, null, 0);
  }

  const argsPush = modeDirect
    ? ['db', 'push', '--db-url', DB_URL]
    : ['db', 'push', '--linked', '--project-ref', ref];
  const envPush = modeDirect ? {} : envSupabase;
  const libellePush = modeDirect
    ? 'supabase db push --db-url [MASQUE]'
    : 'supabase db push';

  const t1 = Date.now();
  const simulation = lancer(CLI, [...argsPush, '--dry-run'], envPush);
  etape('C2', 'Simulation (db push --dry-run)', `${libellePush} --dry-run`, simulation.code, simulation.sortie, null, Date.now() - t1);

  if (!CONFIRMER) {
    etape(
      'C3',
      'Application (db push)',
      libellePush,
      1,
      'Arret sur demande : le plan ci-dessus doit etre relu, puis relance avec --confirm pour appliquer.',
      'BLOQUÉ',
      0,
    );
  } else {
    const t2 = Date.now();
    const application = lancer(CLI, argsPush, envPush);
    etape('C3', 'Application (db push)', libellePush, application.code, application.sortie, null, Date.now() - t2);
  }
}

// ── Phase D : verification de l'instance ─────────────────────────────────────
console.log('\n=== Phase D — Verification de l\u2019instance ===');
phaseCourante = 'D';
if (!pret) {
  etape('D1', 'Verification RLS sur l\u2019instance', 'node tools/verifier-base.mjs', 1, 'Prerequis manquants : B1/B2.', 'BLOQUÉ');
} else {
  // L'URL et la cle publique (anon) viennent de l'environnement, puis de
  // web/.env.local. En mode direct, le CLI n'est pas interroge : aucun jeton
  // d'administration n'est requis. La cle `service_role` n'est jamais
  // demandee : elle n'a rien a faire dans un controle de lecture, et elle ne
  // doit jamais quitter le serveur.
  let urlInstance = process.env.VITE_SUPABASE_URL ?? '';
  let cleAnnon =
    process.env.VITE_SUPABASE_ANON_KEY ??
    (typeof CLE_ANNON_OPT === 'string' ? CLE_ANNON_OPT : '');
  if (modeDirect) {
    const envLocal = join(RACINE, 'web', '.env.local');
    if (!urlInstance) {
      urlInstance =
        lireVariableEnvLocal(envLocal, 'VITE_SUPABASE_URL') ||
        (ref ? `https://${ref}.supabase.co` : '');
    }
    if (!cleAnnon) cleAnnon = lireVariableEnvLocal(envLocal, 'VITE_SUPABASE_ANON_KEY');
  } else if (!urlInstance || !cleAnnon) {
    const cles = lancer(
      CLI,
      ['projects', 'api-keys', '--project-ref', ref, '--output-format', 'json'],
      envSupabase,
    );
    if (cles.code === 0) {
      try {
        const liste = JSON.parse(cles.sortie);
        const trouvee = trouverCleAnon(liste);
        if (trouvee) cleAnnon = trouvee;
      } catch {
        /* format inattendu : on continue avec les variables d'environnement */
      }
    }
    if (!urlInstance) urlInstance = `https://${ref}.supabase.co`;
  }
  if (!cleAnnon) {
    etape(
      'D1',
      'Verification RLS sur l\u2019instance',
      'node tools/verifier-base.mjs',
      1,
      "Cle publique (anon) introuvable. La renseigner dans VITE_SUPABASE_ANON_KEY, ou la recuperer depuis le tableau de bord (Project Settings > API).",
      'BLOQUÉ',
    );
  } else {
    const verification = lancer(process.execPath, [join('tools', 'verifier-base.mjs')], {
      VITE_SUPABASE_URL: urlInstance,
      VITE_SUPABASE_ANON_KEY: cleAnnon,
    });
    etape('D1', 'Verification RLS sur l\u2019instance', 'node tools/verifier-base.mjs', verification.code, verification.sortie);

    // Ecriture du .env.local du front : l'application bascule alors sur la
    // base reelle. Le fichier est versionne par git (.gitignore) et n'est pas
    // transmis a Vercel (.vercelignore).
    if (option('ecriture-env')) {
      const cheminEnv = join(RACINE, 'web', '.env.local');
      mkdirSync(dirname(cheminEnv), { recursive: true });
      writeFileSync(
        cheminEnv,
        `# Genere par tools/publier-base.mjs le ${horodatage()}\n` +
          `# Fichier local, ignore par git et par Vercel.\n` +
          `VITE_SUPABASE_URL=${urlInstance}\n` +
          `VITE_SUPABASE_ANON_KEY=${cleAnnon}\n`,
        'utf8',
      );
      etape('D2', 'Configuration du front pour la base reelle', 'web/.env.local', 0, 'ecrit (fichier local, non versionne)');
    }
  }
}

// ── Phase E : rapport horodate ───────────────────────────────────────────────
phaseCourante = 'E';
const horodatageDebut = etapes[0]?.debut ?? horodatage();
const horodatageFin = horodatage();
const nomRapport =
  typeof RAPPORT === 'string'
    ? RAPPORT
    : join('docs', 'rapports', `PUBLICATION-${horodatageDebut.replace(/[: ]/g, '-').slice(0, 16)}.md`);
const cheminRapport = join(RACINE, nomRapport);
mkdirSync(dirname(cheminRapport), { recursive: true });

const nbOk = etapes.filter((e) => e.statut === 'OK').length;
const nbBloque = etapes.filter((e) => e.statut === 'BLOQUÉ').length;
const nbEchec = etapes.filter((e) => e.statut === 'ÉCHEC').length;
const publie = etapes.find((e) => e.id === 'C3')?.statut === 'OK';

const lignes = [];
lignes.push('# Rapport de publication — PrevEnSanté');
lignes.push('');
lignes.push('| | |');
lignes.push('|---|---|');
lignes.push(`| Début | ${horodatageDebut} |`);
lignes.push(`| Fin | ${horodatageFin} |`);
lignes.push(`| Durée | ${etapes.reduce((s, e) => s + (e.dureeMs ?? 0), 0) >= 1000 ? `${Math.round(etapes.reduce((s, e) => s + (e.dureeMs ?? 0), 0) / 1000)} s` : '< 1 s'} |`);
lignes.push(`| Instance | ${ref ?? '— (project-ref non fourni)'} |`);
lignes.push(`| Commande | \`node tools/publier-base.mjs${modeDirect ? ' --db-url [MASQUE]' : ''}${CONFIRMER ? ' --confirm' : ''}\` |`);
lignes.push(`| Publication appliquée | ${publie ? '**oui**' : '**non**'} |`);
lignes.push(`| Résultat | ${nbEchec === 0 && nbBloque === 0 ? 'conforme' : nbEchec > 0 ? 'échec' : 'incomplet (étapes bloquées)'} — ${nbOk} OK, ${nbBloque} bloquée(s), ${nbEchec} en échec |`);
lignes.push('');
lignes.push('> Aucun jeton, clé ni mot de passe ne figure dans ce rapport : les sorties sont assainies');
lignes.push('> avant d\u2019être consignées.');
lignes.push('');
lignes.push('## Déroulé des étapes');
lignes.push('');
lignes.push('| # | Phase | Étape | Début | Durée | Commande | Statut |');
lignes.push('|---|---|---|---|---|---|---|');
for (const e of etapes) {
  const marque = e.statut === 'OK' ? 'OK' : e.statut === 'BLOQUÉ' ? '**bloquée**' : '**échec**';
  lignes.push(
    `| ${e.id} | ${e.phase} | ${e.libelle} | ${e.debut} | ${e.dureeMs ?? 0} ms | \`${e.commande.replace(/\|/g, '\\|')}\` | ${marque} |`,
  );
}
lignes.push('');
lignes.push('## Détail des sorties');
for (const e of etapes) {
  lignes.push('');
  lignes.push(`### ${e.id} — ${e.libelle} (${e.debut})`);
  lignes.push('');
  lignes.push('```');
  lignes.push(e.sortie || '(aucune sortie)');
  lignes.push('```');
}
lignes.push('');
lignes.push('## Règles appliquées');
lignes.push('');
lignes.push('- `supabase db push --dry-run` **puis** `supabase db push` : jamais l\'inverse.');
lignes.push('- Aucune commande destructrice (`db reset`, `db pull`, `db diff`, `db dump`) n\'est employée.');
lignes.push('- Les migrations restent immuables : une correction passe par un nouveau fichier `00xx_*.sql`.');
lignes.push('- Aucun secret n\'est écrit dans le dépôt ni dans ce rapport.');
if (modeDirect) {
  lignes.push('- Publication par connexion directe (`--db-url`) : aucun jeton d\'administration n\'a été requis ni demandé.');
  lignes.push('- La chaîne de connexion, qui contient le mot de passe de la base, est masquée dans ce rapport.');
}
lignes.push('');

writeFileSync(cheminRapport, lignes.join('\n'), 'utf8');
console.log(`\n=== Rapport ===`);
console.log(`  ${cheminRapport}`);
console.log(`  ${nbOk} etape(s) OK, ${nbBloque} bloquee(s), ${nbEchec} en echec`);
console.log(`  Publication appliquee : ${publie ? 'oui' : 'non'}`);

process.exit(nbEchec > 0 || nbBloque > 0 || validationKo ? 1 : 0);
