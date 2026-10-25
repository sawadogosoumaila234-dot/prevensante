// Exécute réellement les migrations PrevEnSanté dans PGlite
// (PostgreSQL 16 compilé en WebAssembly — un vrai moteur, pas un simple parseur).
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
  const sansCommentaires = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const instructions = [];
  let courant = '';
  let dansChaine = false;
  let tagActif = null;
  const TAG = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/;

  for (let i = 0; i < sansCommentaires.length; i++) {
    const c = sansCommentaires[i];
    const reste = sansCommentaires.slice(i);
    if (!dansChaine && !tagActif) {
      const m = reste.match(TAG);
      if (m) { tagActif = m[0]; courant += tagActif; i += tagActif.length - 1; continue; }
      if (c === "'") { dansChaine = true; courant += c; continue; }
      if (c === ';') { if (courant.trim()) instructions.push(courant.trim()); courant = ''; continue; }
      courant += c; continue;
    }
    if (dansChaine) {
      courant += c;
      if (c === "'") {
        if (sansCommentaires[i + 1] === "'") { courant += "'"; i++; } else dansChaine = false;
      }
      continue;
    }
    if (reste.startsWith(tagActif)) { courant += tagActif; i += tagActif.length - 1; tagActif = null; continue; }
    courant += c;
  }
  if (courant.trim()) instructions.push(courant.trim());
  return instructions;
}

const db = await PGlite.create({ extensions: { vector, postgis, pgcrypto, pg_trgm } });

// ── Emulation de ce que fournit Supabase ────────────────────────
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

// ── Application des migrations ──────────────────────────────────
let ok = 0;
const echecs = [];

for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(DOSSIER, fichier), 'utf8');
  const instructions = decouper(sql);
  let koFichier = 0;
  console.log(`\n=== ${fichier} (${instructions.length} instructions) ===`);

  for (const [i, instr] of instructions.entries()) {
    try {
      await db.exec(instr);
      ok++;
    } catch (e) {
      koFichier++;
      const msg = (e && e.message ? e.message : String(e)).split('\n')[0];
      echecs.push({ fichier, n: i + 1, msg, extrait: instr.slice(0, 160).replace(/\s+/g, ' ') });
      console.log(`  [KO] #${i + 1} : ${msg}`);
      console.log(`        ${instr.slice(0, 160).replace(/\s+/g, ' ')}`);
    }
  }
  console.log(`  -> ${instructions.length - koFichier} ok, ${koFichier} echec(s)`);
}

console.log('\n===================');
console.log(`Total reussi : ${ok}`);
console.log(`Total en echec : ${echecs.length}`);

if (echecs.length === 0) {
  // ── Vérification de l'état final en base ─────────────────────
  console.log('\n--- Verification de la base ---');
  for (const q of [
    ['Tables app', `select count(*)::int n from information_schema.tables where table_schema='app'`],
    ['Tables medical', `select count(*)::int n from information_schema.tables where table_schema='medical'`],
    ['Types enum', `select count(*)::int n from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype='e' and n.nspname in ('app','medical')`],
    ['Politiques RLS', `select count(*)::int n from pg_policies where schemaname in ('app','medical')`],
    ['Fonctions', `select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','medical')`],
    ['Triggers', `select count(*)::int n from pg_trigger where not tgisinternal`],
    ['Tables RLS actif', `select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relrowsecurity and n.nspname in ('app','medical')`],
  ]) {
    const r = await db.query(q[1]);
    console.log(`${q[0]} : ${r.rows[0].n}`);
  }
}

process.exit(echecs.length > 0 ? 1 : 0);
