import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

/**
 * Helpers partages par les 7 tests E2E (un par critere de reception).
 */

/** Racine du depot : le fichier des comptes est deux niveaux au-dessus de `web/`. */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Lit un fichier `cle=valeur`, sans dependance externe. */
function lireVariables(fichier: string): Record<string, string> {
  if (!existsSync(fichier)) return {};
  const source = readFileSync(fichier, 'utf8');
  const variables: Record<string, string> = {};
  for (const ligne of source.split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    variables[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return variables;
}

/**
 * Comptes de recette de la base Supabase (supabase/migrations/0016_seed.sql).
 *
 * Utilises uniquement quand l'application est branchee sur la vraie base :
 * en mode demonstration, on choisit un profil local (aucun mot de passe).
 *
 * Les mots de passe ne sont plus ecrits en clair ici : ils ont ete rotates sur
 * l'instance de recette. Chaque compte est donc resolu dans cet ordre :
 *
 *   1. la variable d'environnement `PREVENSANTE_<ROLE>_PASSWORD` ;
 *   2. le fichier `.env.comptes.local` a la racine du depot (ignore par git) ;
 *   3. en repli, le mot de passe du seed — c'est le bon comportement sur une
 *      base locale rechargee depuis le seed.
 */
export interface CompteRecette {
  email: string;
  variable: string;
  motDePasseSeed: string;
}

export const COMPTES_REQUIS = {
  'Worker': {
    email: 'test.worker@prevensante.test',
    variable: 'PREVENSANTE_WORKER_PASSWORD',
    motDePasseSeed: 'TestWorker!2026',
  },
  'HSE officer': {
    email: 'test.hse@prevensante.test',
    variable: 'PREVENSANTE_HSE_PASSWORD',
    motDePasseSeed: 'TestHse!2026',
  },
  'Occupational physician': {
    email: 'test.medecin@prevensante.test',
    variable: 'PREVENSANTE_MEDECIN_PASSWORD',
    motDePasseSeed: 'TestMed!2026',
  },
  'Administrator': {
    email: 'test.admin@prevensante.test',
    variable: 'PREVENSANTE_ADMIN_PASSWORD',
    motDePasseSeed: 'TestAdmin!2026',
  },
  'Supervisor': {
    email: 'test.superviseur@prevensante.test',
    variable: 'PREVENSANTE_SUPERVISEUR_PASSWORD',
    motDePasseSeed: 'TestHse!2026',
  },
  'Site director': {
    email: 'test.encadrement@prevensante.test',
    variable: 'PREVENSANTE_ENCADREMENT_PASSWORD',
    motDePasseSeed: 'TestHse!2026',
  },
} as const satisfies Record<string, CompteRecette>;

export type RoleLabel = keyof typeof COMPTES_REQUIS;

const VARIABLES = lireVariables(join(RACINE, '.env.comptes.local'));
const ENV_WEB = lireVariables(join(RACINE, 'web', '.env.local'));

/** Resout le mot de passe d'un compte de recette (voir la note ci-dessus). */
function motDePasse(compte: CompteRecette): string {
  const depuisEnv = process.env[compte.variable];
  if (depuisEnv) return depuisEnv;
  const depuisFichier = VARIABLES[compte.variable];
  if (depuisFichier) return depuisFichier;
  return compte.motDePasseSeed;
}

/**
 * Resout le secret du second facteur d'un compte.
 *
 * Il porte le meme prefixe que le mot de passe : `PREVENSANTE_HSE_PASSWORD`
 * devient `PREVENSANTE_HSE_MFA_SECRET`.
 */
function secretSecondFacteur(compte: CompteRecette): string {
  const variable = compte.variable.replace(/_PASSWORD$/, '_MFA_SECRET');
  return process.env[variable] || VARIABLES[variable] || '';
}

/** Decodage base32 (RFC 4648, sans remplissage) vers un tampon binaire. */
function base32Decoder(secret: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const propre = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valeur = 0;
  const sortie: number[] = [];
  for (const caractere of propre) {
    const index = alphabet.indexOf(caractere);
    if (index === -1) continue;
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      sortie.push((valeur >>> bits) & 0xff);
      // Sans ce masque, `valeur` continuerait de croitre et le decalage
      // deborderait au bout de quelques caracteres.
      valeur &= (1 << bits) - 1;
    }
  }
  return new Uint8Array(sortie);
}

/** Code TOTP (HMAC-SHA1, fenetre de 30 s, 6 chiffres) — RFC 6238. */
function codeTotp(secret: string, instant: number): string {
  const compteur = Math.floor(instant / 1000 / 30);
  const tampon = new Uint8Array(8);
  let reste = compteur;
  for (let i = 7; i >= 0; i--) {
    tampon[i] = reste % 256;
    reste = Math.floor(reste / 256);
  }
  const hmac = createHmac('sha1', base32Decoder(secret)).update(tampon).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  const binaire =
    ((hmac[decalage] & 0x7f) << 24) |
    (hmac[decalage + 1] << 16) |
    (hmac[decalage + 2] << 8) |
    hmac[decalage + 3];
  return String(binaire % 1000000).padStart(6, '0');
}

/**
 * Ecart entre l'horloge du poste et celle du serveur, en millisecondes.
 *
 * Un code TOTP calcule sur une horloge decalee est refuse : l'ecart est donc
 * mesure sur l'en-tete `Date` de l'instance, comme le fait `tools/totp.mjs`.
 */
async function ecartServeur(): Promise<number> {
  const url = process.env.VITE_SUPABASE_URL || ENV_WEB.VITE_SUPABASE_URL || '';
  const cle = process.env.VITE_SUPABASE_ANON_KEY || ENV_WEB.VITE_SUPABASE_ANON_KEY || '';
  if (!url) return 0;
  try {
    const reponse = await fetch(`${url}/auth/v1/health`, { headers: { apikey: cle } });
    const date = reponse.headers.get('date');
    if (!date) return 0;
    return new Date(date).getTime() - Date.now();
  } catch {
    return 0;
  }
}

/**
 * Se connecter avec un profil de demonstration (mode demo hors ligne) ou avec
 * un compte de recette (mode Supabase).
 *
 * Le mode est deduit de la page : en mode demonstration, `/login` propose un
 * bouton par profil ; en mode Supabase, ces boutons sont masques et la
 * connexion se fait par adresse et mot de passe.
 */
export async function loginAs(page: Page, roleLabel: string): Promise<void> {
  await page.goto('/login');

  // La page de connexion est chargee paresseusement : on attend le
  // formulaire, present dans les deux modes. Le bloc de profils de
  // demonstration est rendu dans la meme passe de rendu, le compte est donc
  // fiable une fois le formulaire visible.
  await page
    .getByRole('button', { name: 'Sign in' })
    .waitFor({ state: 'visible', timeout: 15_000 });

  const profilDemo = page.getByRole('button', { name: roleLabel, exact: true });
  if ((await profilDemo.count()) > 0) {
    // Mode demonstration : un profil local suffit.
    await profilDemo.click();
  } else {
    // Mode Supabase : authentification reelle avec les comptes de recette.
    const compte = COMPTES_REQUIS[roleLabel as RoleLabel];
    if (!compte) {
      throw new Error(
        `Aucun compte de recette pour le role « ${roleLabel} » : ` +
          `ajouter un compte dans supabase/migrations/0016_seed.sql`,
      );
    }
    await page.locator('#email').fill(compte.email);
    await page.locator('#password').fill(motDePasse(compte));
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Second facteur : depuis l'enrolement MFA, la session n'est authentifiee
    // qu'apres validation du code. La page de connexion le demande alors dans
    // le champ « #code » ; sans second facteur, la navigation suit la connexion.
    const champCode = page.locator('#code');
    const etape = await Promise.race([
      champCode.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'code' as const),
      page
        .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
        .then(() => 'arrive' as const)
        .catch(() => 'echec' as const),
    ]);
    if (etape === 'code') {
      const secret = secretSecondFacteur(compte);
      if (!secret) {
        throw new Error(
          `Le compte « ${roleLabel} » a un second facteur enrole, mais aucun secret ` +
            `n'est disponible sur ce poste : renseigner ` +
            `${compte.variable.replace(/_PASSWORD$/, '_MFA_SECRET')}.`,
        );
      }
      // Un code TOTP calcule sur une horloge decalee est refuse. L'ecart est
      // mesure sur l'instance, mais la mesure et la verification sont
      // separees par le reseau : le code peut donc tomber juste avant le
      // basculement de la fenetre de 30 secondes. Les trois instants voisins
      // sont donc essayes, comme le fait `tools/totp.mjs`.
      const ecart = await ecartServeur();
      const base = Date.now() + ecart;
      for (const instant of [base, base - 30_000, base + 30_000]) {
        await champCode.fill(codeTotp(secret, instant));
        await page.getByRole('button', { name: 'Verify' }).click();
        const suite = await Promise.race([
          page
            .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 5_000 })
            .then(() => 'arrive' as const)
            .catch(() => 'refuse' as const),
          page.waitForTimeout(2_000).then(() => 'reste' as const),
        ]);
        if (suite === 'arrive') break;
      }
    } else if (etape === 'echec') {
      throw new Error(
        `Connexion impossible pour le compte « ${roleLabel} » (${compte.email}) : ` +
          `identifiants refuses, ou second facteur exige sans secret disponible.`,
      );
    }
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  await expect(page.getByRole('banner')).toBeVisible();
}

/** Se deconnecter. */
export async function logout(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}

/**
 * Remplir le formulaire de signalement et envoyer jusqu'a l'etape de confirmation.
 * Renvoie la reference generee (format PES-2026-xxxxx).
 */
export async function submitReport(
  page: Page,
  opts: {
    description: string;
    immediate?: boolean;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    activity?: string;
    site?: string;
  },
): Promise<string> {
  const activity = opts.activity ?? 'Manual handling of sacks on the production line';
  const description = opts.description ?? 'A sack fell from the pallet and blocked the marked pedestrian aisle.';
  const severity = opts.severity ?? 'medium';

  await page.goto('/report/danger');
  await expect(page.getByRole('heading', { name: 'Report a hazard' })).toBeVisible();

  // Etape 1 — Where
  if (opts.site) {
    await page.locator('#site_id').selectOption(opts.site);
  } else {
    await page.locator('#site_id').selectOption({ index: 1 });
  }
  await page.locator('#zone_id').selectOption({ index: 1 });
  await page.locator('#occurred_at').fill('2026-10-20T09:30');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Etape 2 — What
  await page.locator('#severity').selectOption(severity);
  await page.locator('#activity').fill(activity);
  await page.locator('#description').fill(description);
  await page.locator('#immediate_measures').fill('Isolated the aisle and placed a warning sign.');
  await page.locator('#reported_consequences').fill('No injury, the aisle was briefly obstructed.');
  if (opts.immediate) {
    await page.getByText('The situation is an immediate danger.').click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();

  // Etape 3 — Evidence
  await page.getByRole('button', { name: 'Continue' }).click();

  // Etape 4 — Confirmation
  // Le bouton de soumission n'apparait qu'a la derniere etape : on attend
  // son affichage avant de cliquer, sinon on perd la course avec la
  // navigation vers l'ecran de confirmation.
  const submit = page.getByRole('button', { name: 'Submit report' });
  await expect(submit).toBeVisible({ timeout: 15_000 });
  await submit.click();

  // Le bouton disparait avec la soumission : on attend la navigation vers
  // l'ecran de confirmation plutot que de relire le bouton.
  await page.waitForURL('**/report/success');
  await expect(page).toHaveURL(/\/report\/success$/);

  await expect(page.getByRole('heading', { name: 'Report recorded' })).toBeVisible({
    timeout: 20_000,
  });
  const body = await page.locator('#root').innerText();
  const match = body.match(/PES-\d{4}-\d{4,5}/);
  return match ? match[0] : '';
}

/**
 * Texte du contenu metier de la page (zone `main`), hors en-tete, hors
 * navigation et hors pied de page de debug qui affiche la route courante.
 */
export async function pageText(page: Page): Promise<string> {
  const main = page.locator('#main-content');
  await main.waitFor({ state: 'visible', timeout: 20_000 });
  // Le contenu est charge en lazy (React.lazy) : on attend qu'il soit stable.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#main-content');
      if (!el) return false;
      const t = (el as HTMLElement).innerText || '';
      const trimmed = t.trim();
      return trimmed.length > 20 && !/^loading/i.test(trimmed);
    },
    undefined,
    { timeout: 20_000 },
  );
  return (await main.innerText()) ?? '';
}

/** Verifier qu'un element depasse du viewport horizontalement. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
