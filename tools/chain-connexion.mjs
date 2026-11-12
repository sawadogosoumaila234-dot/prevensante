// Ou se trouve la chaine de connexion de l'instance — et comment l'utiliser.
//
// Le point important : personne n'a rien a recopier. La chaine est deja
// presente sur la machine, dans les fichiers locaux du depot. Ces fichiers ne
// sont jamais versionnes (voir .gitignore) et ne sont jamais envoyes sur le
// serveur (voir .vercelignore).
//
// Ordre de recherche, le premier qui trouve gagne :
//
//   1. l'environnement          — SUPABASE_DB_URL
//   2. `.env.sauvegarde.local`  — racine du depot, reserve a la sauvegarde
//   3. `supabase/.env.local`    — ou la chaine a ete posee a la creation
//
// Un second point, learned the hard way : la chaine contient `?sslmode=require`.
// Sur les versions recentes de `pg`, ce parametre est traite comme un alias de
// `verify-full` : la verification du certificat devient stricte, et la
// connexion echoue sur « self-signed certificate in certificate chain », meme
// quand le code demande explicitement `ssl: { rejectUnauthorized: false }`.
// Le parametre est donc retire de la chaine transmise a `pg`, qui applique
// alors sa propre regle : TLS, sans verification stricte du certificat.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Les fichiers ou une chaine de connexion peut se trouver, par ordre de priorite. */
export const FICHIERS_CHAINE = ['.env.sauvegarde.local', join('supabase', '.env.local')];

/** Lit un fichier `.env` : un couple `CLE=valeur` par ligne. */
export function lireVariables(fichier) {
  if (!existsSync(fichier)) return {};
  const variables = {};
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

/** Retire le mot de passe d'une chaine de connexion avant toute affichage. */
export function masquerUrl(url) {
  return String(url).replace(/\/\/([^:@/]+):([^@]*)@/, '//$1:***@');
}

/**
 * Retire `sslmode` de la chaine : `pg` applique alors `ssl: { rejectUnauthorized: false }`,
 * ce qui evite l'echec de verification de certificat (cf. en-tete du module).
 */
export function normaliserPourPg(url) {
  return String(url).replace(/([?&])sslmode=[^&]*(&|$)/, (tout, debut, fin) =>
    fin === '&' ? debut : '',
  ).replace(/[?&]$/, '');
}

/**
 * Cherche la chaine de connexion.
 *
 * @param {object} options
 * @param {string} options.racine       racine du depot
 * @param {NodeJS.ProcessEnv} options.env environnement du processus
 * @param {string[]} options.positionnels arguments positionnels de la ligne de commande
 * @returns {{url: string, source: string}|null}
 */
export function trouverChaine({ racine, env = process.env, positionnels = [] }) {
  const depuisEnv = env.SUPABASE_DB_URL;
  if (depuisEnv) return { url: depuisEnv, source: "l'environnement (SUPABASE_DB_URL)" };

  for (const relatif of FICHIERS_CHAINE) {
    const fichier = join(racine, relatif);
    const variables = lireVariables(fichier);
    if (variables.SUPABASE_DB_URL) {
      return { url: variables.SUPABASE_DB_URL, source: relatif };
    }
  }

  const fournie = positionnels.find((a) => a.startsWith('postgres'));
  if (fournie) return { url: fournie, source: 'la ligne de commande' };

  return null;
}
