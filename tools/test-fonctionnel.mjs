// Test fonctionnel du schéma PrevEnSanté dans PGlite (PostgreSQL en WASM).
//  1. RLS : visibilité par rôle ;
//  2. trigger de référence : SIG-YYYY-NNNN auto-généré ;
//  3. trigger de clôture : un non-HSE ne peut pas clôturer une action ;
//  4. trigger de protection du rôle ;
//  5. séparation du schéma medical.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const { vector } = require('@electric-sql/pglite-pgvector');
const { postgis } = require('@electric-sql/pglite-postgis');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');

const DOSSIER = 'C:/Users/Cabinet_prevent/dev/prevensante/supabase/migrations';

function decouper(sql) {
  const s = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let cur = '', ch = false, tag = null;
  const TAG = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], reste = s.slice(i);
    if (!ch && !tag) {
      const m = reste.match(TAG);
      if (m) { tag = m[0]; cur += tag; i += tag.length - 1; continue; }
      if (c === "'") { ch = true; cur += c; continue; }
      if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
      cur += c; continue;
    }
    if (ch) { cur += c; if (c === "'") { if (s[i + 1] === "'") { cur += "'"; i++; } else ch = false; } continue; }
    if (reste.startsWith(tag)) { cur += tag; i += tag.length - 1; tag = null; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const db = await PGlite.create({ extensions: { vector, postgis, pgcrypto, pg_trgm } });

await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to authenticated, anon, service_role;
`);

for (const f of readdirSync(DOSSIER).filter((x) => x.endsWith('.sql')).sort()) {
  for (const instr of decouper(readFileSync(join(DOSSIER, f), 'utf8'))) {
    await db.exec(instr);
  }
}

const uHse = '11111111-1111-1111-1111-111111111111';
const uMedecin = '22222222-2222-2222-2222-222222222222';
const uAdmin = '33333333-3333-3333-3333-333333333333';
const uTravailleur = '44444444-4444-4444-4444-444444444444';
const SITE_A = 'bbbbbbbb-0000-0000-0000-000000000001';
const SITE_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const ZONE_A = 'cccccccc-0000-0000-0000-000000000001';

try {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${uHse}', 'hse@exemple.bf'),
      ('${uMedecin}', 'medecin@exemple.bf'),
      ('${uAdmin}', 'admin@exemple.bf'),
      ('${uTravailleur}', 'ouvrier@exemple.bf');

    insert into app.secteurs (id, code, libelle, description) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'MIN', 'Mines', 'Exploitation miniere');

    insert into app.sites (id, secteur_id, code, nom, localisation) values
      ('${SITE_A}', 'aaaaaaaa-0000-0000-0000-000000000001', 'POU', 'Mine de Poura',
        ST_SetSRID(ST_MakePoint(0,0),4326)::geography),
      ('${SITE_B}', 'aaaaaaaa-0000-0000-0000-000000000001', 'KOS', 'Cimenterie de Kossodo',
        ST_SetSRID(ST_MakePoint(1,1),4326)::geography);

    insert into app.zones (id, site_id, code, nom) values
      ('${ZONE_A}', '${SITE_A}', 'Z1', 'Front de taille');

    insert into app.profiles (id, nom, prenom, role_acteur) values
      ('${uHse}', 'Herve', 'Kone', 'responsable_hse'),
      ('${uMedecin}', 'Mariam', 'Ouedraogo', 'medecin_du_travail'),
      ('${uAdmin}', 'Amina', 'Zongo', 'administrateur'),
      ('${uTravailleur}', 'Ibrahim', 'Sawadogo', 'travailleur');

    insert into app.profile_sites (profile_id, site_id) values
      ('${uHse}', '${SITE_A}'),
      ('${uMedecin}', '${SITE_A}'),
      ('${uAdmin}', '${SITE_A}'),
      ('${uAdmin}', '${SITE_B}'),
      ('${uTravailleur}', '${SITE_A}');
  `);
} catch (e) {
  console.log('ECHEC SEED : ' + (e && e.message ? e.message : String(e)));
  process.exit(2);
}

const resultats = [];
function verifier(nom, condition, detail = '') {
  resultats.push({ nom, ok: !!condition, detail });
  console.log(`${condition ? '  [OK]' : '  [KO]'} ${nom}${detail ? ' — ' + detail : ''}`);
}

console.log('\n=== 1. Generation automatique de la reference ===');
await db.exec(`
  insert into app.signalements (type_evenement, titre, description, site_id, zone_id, auteur_id, categorie)
  values ('danger', 'Sol huileux au concasseur', 'Glissade possible', '${SITE_A}', '${ZONE_A}',
          '${uTravailleur}', 'environnement');
`);
const reference = (await db.query('select reference from app.signalements limit 1')).rows[0]?.reference;
verifier('reference generee au format SIG-YYYY-NNNN', /^SIG-\d{4}-\d{4}$/.test(reference || ''), reference);

await db.exec(`
  insert into app.signalements (type_evenement, titre, description, site_id, auteur_id, categorie)
  values ('incident', 'Eclairage defaillant', 'Passage sombre', '${SITE_A}', '${uTravailleur}', 'mecanique');
`);
const reference2 = (await db.query('select reference from app.signalements order by created_at desc limit 1')).rows[0]?.reference;
verifier('reference incrementee et unique', reference2 !== reference && !!reference2, `${reference} -> ${reference2}`);

console.log('\n=== 2. Trigger de cloture : un non-HSE ne peut pas cloturer ===');
await db.exec(`
  insert into app.actions_correctives (signalement_id, titre, site_id, responsable_id, statut, echeance_at, avancement)
  select id, 'Nettoyer le sol', site_id, '${uTravailleur}', 'en_cours', current_date - 5, 50
  from app.signalements limit 1;
`);
const actionId = (await db.query('select id from app.actions_correctives limit 1')).rows[0].id;

let clotureRefusee = false;
try {
  await db.exec(`
    update app.actions_correctives set statut = 'cloturee', cloturee_at = now() where id = '${actionId}';
  `);
} catch (e) {
  clotureRefusee = /comp[ée]tente/i.test(e.message || '');
}
verifier('cloture par un non-HSE refusee', clotureRefusee);

let clotureHseOk = false;
try {
  await db.exec(`set request.jwt.claim.sub = '${uHse}'`);
  await db.exec(`
    update app.actions_correctives set statut = 'cloturee', cloturee_at = now(),
      cloturee_par = '${uHse}', verification = 'Verifie sur site'
    where id = '${actionId}';
  `);
  clotureHseOk = true;
} catch (e) {
  console.log('  (detail cloture HSE : ' + (e && e.message ? e.message : String(e)) + ')');
}
const st = (await db.query('select statut from app.actions_correctives where id = $1', [actionId])).rows[0];
verifier('cloture par un HSE acceptee', clotureHseOk && st?.statut === 'cloturee', st?.statut);

await db.exec(`set request.jwt.claim.sub = ''`);

console.log('\n=== 3. Trigger de protection du role ===');
let roleBloque = false;
try {
  await db.exec(`set request.jwt.claim.sub = '${uTravailleur}'`);
  await db.exec(`update app.profiles set role_acteur = 'administrateur' where id = '${uTravailleur}'`);
} catch (e) {
  roleBloque = true;
  console.log('  (detail role : ' + (e && e.message ? e.message : String(e)) + ')');
}
verifier('auto-promotion en administrateur refusee', roleBloque);

console.log('\n=== 4. RLS : visibilite par role ===');
async function enRole(role, sql, params = []) {
  await db.exec(`set role ${role}`);
  try {
    const r = await db.query(sql, params);
    return r.rows;
  } finally {
    await db.exec('reset role');
  }
}
try {
  await db.exec(`set request.jwt.claim.sub = '${uHse}'`);
  await db.exec(`set role authenticated`);
  await db.exec(`reset role`);
  const hse = await enRole('authenticated', 'select count(*)::int n from app.signalements');
  verifier('HSE voit les signalements de son site', hse[0].n === 2, `${hse[0].n} lignes`);

  const sitesHse = await enRole('authenticated', 'select count(*)::int n from app.sites');
  verifier('HSE ne voit que son site', sitesHse[0].n === 1, `${sitesHse[0].n} site(s)`);

  const medicalHse = await enRole('authenticated', 'select count(*)::int n from medical.dossiers');
  verifier('HSE n accede pas au schema medical', medicalHse[0].n === 0, `${medicalHse[0].n} dossier(s)`);

  await db.exec(`set request.jwt.claim.sub = '${uAdmin}'`);
  const sitesAdmin = await enRole('authenticated', 'select count(*)::int n from app.sites');
  verifier('administrateur voit tous les sites', sitesAdmin[0].n === 2, `${sitesAdmin[0].n} sites`);

  await db.exec(`set request.jwt.claim.sub = '${uMedecin}'`);
  const dossiersMedecin = await enRole(
    'authenticated',
    `insert into medical.dossiers (site_id, type_dossier, observations) values ('${SITE_A}', 'visite_medicale', 'test') returning id`,
  );
  verifier('medecin du travail peut creer un dossier medical', dossiersMedecin.length === 1);

  const dossiersMedecinB = await enRole(
    'authenticated',
    `insert into medical.dossiers (site_id, type_dossier, observations) values ('${SITE_B}', 'visite_medicale', 'hors perimetre')`,
  ).then(() => false).catch(() => true);
  verifier('medecin ne peut pas ecrire hors de son perimetre de sites', dossiersMedecinB);

  await db.exec(`set request.jwt.claim.sub = '${uHse}'`);
  let hseCree = true;
  try {
    await enRole(
      'authenticated',
      `insert into medical.dossiers (site_id, type_dossier, observations) values ('${SITE_A}', 'visite_medicale', 'test')`,
    );
  } catch (e) {
    hseCree = false;
  }
  verifier('HSE ne peut pas creer de dossier medical', !hseCree);

  await db.exec(`set request.jwt.claim.sub = '${uTravailleur}'`);
  const sitesTrav = await enRole('authenticated', 'select count(*)::int n from app.sites');
  verifier('travailleur ne voit que son site', sitesTrav[0].n === 1, `${sitesTrav[0].n} site(s)`);
} catch (e) {
  verifier('execution des tests RLS', false, e.message);
}

console.log('\n=== 5. Journal d\'audit ===');
const journal = (await db.query('select count(*)::int n from app.journal_modifications')).rows[0].n;
verifier('journal des modifications alimente par trigger', journal >= 2, `${journal} entrees`);

console.log('\n=== 6. Separation du schema medical ===');
const medicalCols = (await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'medical' and table_name = 'dossiers'
`)).rows;
verifier('table medical.dossiers creee', medicalCols.length > 0, `${medicalCols.length} colonnes`);
const medicalPolicy = (await db.query(`
  select count(*)::int n from pg_policies where schemaname = 'medical'
`)).rows[0].n;
verifier('politiques RLS presentes sur medical', medicalPolicy > 0, `${medicalPolicy} politiques`);
const medicalGrant = (await db.query(`
  select count(*)::int n from information_schema.role_table_grants
  where table_schema = 'medical' and table_name = 'dossiers' and grantee = 'authenticated'
`)).rows[0].n;
verifier('droits de lecture Accordes sur medical.dossiers (filtres par RLS)', medicalGrant > 0, `${medicalGrant} droits`);

const anonGrant = (await db.query(`
  select count(*)::int n from information_schema.role_table_grants
  where table_schema in ('app','medical') and grantee = 'anon'
`)).rows[0].n;
verifier('aucun droit pour le role anon sur app et medical', anonGrant === 0, `${anonGrant} droits`);

console.log('\n===================');
const ko = resultats.filter((r) => !r.ok);
console.log(`${resultats.length - ko.length}/${resultats.length} tests fonctionnels reussis`);
if (ko.length) {
  console.log('ECHECS :');
  for (const k of ko) console.log(`  - ${k.nom} ${k.detail}`);
}
process.exit(ko.length ? 1 : 0);