import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Parite du mode demonstration et du mode base reelle.
//
// Le defaut que ces tests verrouillent : le perimetre de lecture ne doit
// JAMAIS etre decide a partir du jeu de demonstration quand la base reelle
// est configuree. Les identifiants du jeu local (`site-1`) et ceux de la base
// (`22222222-2222-4222-…`) n'ont rien de commun : chercher un site reel dans
// le jeu local ne le trouve jamais, et la regle de perimetre s'effondre.
//
// Regle SQL de reference (`supabase/migrations/0010_rls_helpers.sql`) :
//   `can_access_site(p_site)` = administrateur
//     OU site de rattachement du profil
//     OU (meme organisation ET role hse_officer / site_director /
//         occupational_physician).

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const { canAccessSite, setSiteDirectory, resetSiteDirectory, getSiteDirectory } = await import(
  pathToFileURL(join(RACINE, 'web', 'src', 'lib', 'rls', 'scope.ts')).href
);

// ── Identifiants reels (migration 0016_seed.sql) ────────────────────────────
const ORG_1 = '11111111-1111-4111-8111-111111111111';
const ORG_2 = '99999999-9999-4999-8999-999999999999';
const SITE_A = '22222222-2222-4222-8222-222222222222';
const SITE_B = '22222222-2222-4222-8222-222222222223';
const SITE_C = '22222222-2222-4222-8222-222222222224';

/** Construit un profil minimal. */
function profil(role, siteId, organizationId) {
  return {
    id: `p-${role}-${siteId ?? 'none'}`,
    full_name: role,
    email: `${role}@test`,
    role,
    organization_id: organizationId,
    site_id: siteId,
    is_medical_authorized: false,
    is_active: true,
  };
}

/** Site du jeu reel, minimaux champs utilises par la regle. */
function site(id, organizationId) {
  return { id, organization_id: organizationId };
}

beforeEach(() => {
  resetSiteDirectory();
});

test('mode demonstration : le perimetre suit les identifiants du jeu local', () => {
  const hse = profil('hse_officer', null, 'org-1');
  assert.equal(canAccessSite(hse, 'site-2'), true, 'site de la meme organisation');
  assert.equal(canAccessSite(hse, 'site-3'), false, 'site d une autre organisation');

  const salarie = profil('worker', 'site-1', 'org-1');
  assert.equal(canAccessSite(salarie, 'site-1'), true, 'son propre site');
  assert.equal(canAccessSite(salarie, 'site-2'), false, 'site d un autre');

  assert.equal(canAccessSite(profil('admin', null, 'org-1'), 'site-3'), true, 'admin partout');
});

test('mode base reelle : le HSE atteint les sites de son organisation', () => {
  // Le repertoire installe par l'application contient les sites que la RLS
  // laisse lire au profil : site A et site B pour l'organisation 1.
  setSiteDirectory([site(SITE_A, ORG_1), site(SITE_B, ORG_1)]);

  const hse = profil('hse_officer', null, ORG_1);
  assert.equal(canAccessSite(hse, SITE_B), true, 'site B de la meme organisation');
  assert.equal(canAccessSite(hse, SITE_A), true, 'site A de la meme organisation');
  assert.equal(canAccessSite(hse, SITE_C), false, 'site d une autre organisation');
});

test('mode base reelle : le salarie reste limite a son site', () => {
  setSiteDirectory([site(SITE_A, ORG_1), site(SITE_B, ORG_1)]);

  const salarie = profil('worker', SITE_A, ORG_1);
  assert.equal(canAccessSite(salarie, SITE_A), true, 'son site');
  assert.equal(canAccessSite(salarie, SITE_B), false, 'un autre site de la meme organisation');
});

test('mode base reelle : le medecin du travail et le directeur suivent la meme regle', () => {
  setSiteDirectory([site(SITE_A, ORG_1), site(SITE_B, ORG_1)]);

  for (const role of ['site_director', 'occupational_physician']) {
    const p = profil(role, null, ORG_1);
    assert.equal(canAccessSite(p, SITE_B), true, `${role} : site de la meme organisation`);
    assert.equal(canAccessSite(p, SITE_C), false, `${role} : site d une autre organisation`);
  }
});

test('mode base reelle : un role hors perimetre organisationnel reste refuse', () => {
  setSiteDirectory([site(SITE_A, ORG_1), site(SITE_B, ORG_1)]);

  for (const role of ['worker', 'supervisor', 'action_owner', 'maintenance_lead']) {
    const p = profil(role, null, ORG_1);
    assert.equal(canAccessSite(p, SITE_B), false, `${role} : pas de couverture organisationnelle`);
  }
});

test('le repertoire se remplace et se reinitialise', () => {
  assert.equal(getSiteDirectory().length > 0, true, 'par defaut : jeu de demonstration');

  setSiteDirectory([site(SITE_A, ORG_1)]);
  assert.equal(getSiteDirectory().length, 1);
  assert.equal(getSiteDirectory()[0].id, SITE_A);

  resetSiteDirectory();
  assert.equal(getSiteDirectory().some((s) => s.id === SITE_A), false, 'retour au jeu local');
});

// ── Invariants de forme : le code ne doit pas rejouer l'erreur ──────────────

test('invariant : canAccessSite ne consulte jamais le jeu de demonstration', () => {
  const source = readFileSync(join(RACINE, 'web', 'src', 'lib', 'rls', 'scope.ts'), 'utf8');
  const debut = source.indexOf('export function canAccessSite');
  assert.notEqual(debut, -1, 'canAccessSite introuvable');
  const corps = source.slice(debut, source.indexOf('\n}', debut));
  assert.equal(
    corps.includes('demoState'),
    false,
    'canAccessSite doit resoudre le site dans le repertoire installe, pas dans le jeu local',
  );
});

test('invariant : chaque fonction de lecture de api.ts a une branche Supabase', () => {
  const source = readFileSync(join(RACINE, 'web', 'src', 'lib', 'api.ts'), 'utf8');

  // Corps de chaque fonction exportee.
  const corps = new Map();
  for (const m of source.matchAll(/export async function (\w+)/g)) {
    const debut = source.indexOf(`export async function ${m[1]}`);
    const suivant = source.indexOf('\nexport ', debut + 1);
    corps.set(m[1], source.slice(debut, suivant === -1 ? undefined : suivant));
  }
  assert.ok(corps.size >= 25, `fonctions attendues, trouvees : ${corps.size}`);

  // Une fonction est « branchee » soit directement, soit par delegation a une
  // fonction branchee (les wrappers deleguent, ils n'ont pas de requete).
  const branchee = (nom, vus = new Set()) => {
    if (vus.has(nom)) return false;
    vus.add(nom);
    const corpsFn = corps.get(nom) ?? '';
    if (corpsFn.includes('if (supabase)')) return true;
    for (const autre of corps.keys()) {
      if (autre === nom) continue;
      if (new RegExp(`\\b${autre}\\s*\\(`).test(corpsFn) && branchee(autre, vus)) return true;
    }
    return false;
  };

  const sansBranche = [...corps.keys()].filter((nom) => !branchee(nom));
  assert.deepEqual(
    sansBranche,
    [],
    'fonctions sans branche Supabase : elles retomberaient sur le jeu de demonstration',
  );
});
