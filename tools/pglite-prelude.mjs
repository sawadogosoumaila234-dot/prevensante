// Prelude local PGlite pour PrevEnSante.
//
// ⚠️ ÉMULATION LOCALE UNIQUEMENT — aucun de ces objets n'est versionné dans
//    les migrations. PGlite (PostgreSQL en WebAssembly) ne fournit pas les
//    schémas `auth` et `storage` de Supabase, ni les extensions `pg_cron`,
//    `pg_net`, ni pgTAP. On les émule pour que les migrations de la spec et
//    les tests RLS s'exécutent tels quels.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  SQL_ENVIRONNEMENT_LOCAL,
  extensionIndisponibleLocale,
  MESSAGE_EXTENSION_IGNOREE,
} from './environnement-local.mjs';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const { vector } = require('@electric-sql/pglite-pgvector');
const { postgis } = require('@electric-sql/pglite-postgis');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');

export { extensionIndisponibleLocale, MESSAGE_EXTENSION_IGNOREE } from './environnement-local.mjs';

// Chemins resolus depuis l'emplacement du module : l'outillage doit
// fonctionner sur n'importe quelle machine et sur une CI, pas seulement
// sur le poste qui a ecrit le script.
const RACINE = fileURLToPath(new URL('..', import.meta.url));

export const DOSSIER = join(RACINE, 'supabase', 'migrations');
export const DOSSIER_TESTS = join(RACINE, 'supabase', 'tests');

export function decouper(sql) {
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



// ── Shim pgTAP local (PGlite ne fournit pas l'extension pgTAP) ────────────
// Mêmes signatures que pgTAP (plan(), ok(), is(), isnt(), throws_ok(),
// finish()). `supabase/tests/rls.sql` utilise aujourd'hui ses propres
// assertions `pg_temp.rls_assert` / `pg_temp.rls_record` : ce shim reste
// disponible pour les fichiers de test écrits à la manière pgTAP.
const PGTAP_LOCAL = `
  create schema if not exists pgtap;
  create table if not exists pgtap.results (
    id serial primary key,
    ok boolean not null,
    description text,
    kind text not null default 'test'
  );
  create or replace function pgtap.plan(n integer) returns text language plpgsql as $$
  begin
    delete from pgtap.results;
    return '1..' || n::text;
  end $$;
  create or replace function pgtap.no_plan() returns text language plpgsql as $$
  begin
    delete from pgtap.results;
    return 'no plan';
  end $$;
  create or replace function pgtap.ok(cond boolean, description text default null) returns text
    language plpgsql as $$
  declare n integer; r text;
  begin
    insert into pgtap.results (ok, description) values (coalesce(cond, false), description)
      returning id into n;
    r := (case when coalesce(cond, false) then 'ok' else 'not ok' end) || ' ' || n::text
         || ' - ' || coalesce(description, '');
    raise notice '%', r;
    return r;
  end $$;
  create or replace function pgtap.is(found anyelement, wanted anyelement, description text default null)
    returns text language plpgsql as $$
  begin
    return pgtap.ok(found IS NOT DISTINCT FROM wanted,
      coalesce(description, '') || ' (trouve: ' || coalesce(found::text, 'null')
      || ', attendu: ' || coalesce(wanted::text, 'null') || ')');
  end $$;
  create or replace function pgtap.isnt(found anyelement, unwanted anyelement, description text default null)
    returns text language plpgsql as $$
  begin
    return pgtap.ok(found IS DISTINCT FROM unwanted,
      coalesce(description, '') || ' (trouve: ' || coalesce(found::text, 'null') || ')');
  end $$;
  create or replace function pgtap.throws_ok(sql text, errcode text, description text default null)
    returns text language plpgsql as $$
  declare msg text; state text;
  begin
    begin
      execute sql;
      msg := 'aucune exception levee';
      state := null;
    exception when others then
      msg := sqlerrm;
      state := SQLSTATE;
    end;
    if state = errcode then
      return pgtap.ok(true, coalesce(description, '') || ' (' || msg || ')');
    end if;
    return pgtap.ok(false, coalesce(description, '')
      || ' — attendu ' || errcode || ', obtenu ' || coalesce(state, 'aucune exception')
      || ' (' || msg || ')');
  end $$;
  create or replace function pgtap.finish() returns text language plpgsql as $$
  declare total integer; ko integer;
  begin
    select count(*), count(*) filter (where not ok) into total, ko from pgtap.results;
    return format('%s test(s), %s echec(s)', total, ko);
  end $$;
  grant usage on schema pgtap to authenticated, anon, service_role;
  grant all on pgtap.results to authenticated, anon, service_role;
`;

export async function demarrerPGlite({ pgtap = true } = {}) {
  const db = await PGlite.create({ extensions: { vector, postgis, pgcrypto, pg_trgm } });
  await db.exec(SQL_ENVIRONNEMENT_LOCAL);
  if (pgtap) await db.exec(PGTAP_LOCAL);
  return db;
}

// Droits « Supabase-like » : Supabase accorde par défaut les droits de table
// aux rôles anon / authenticated / service_role dans le schéma public.
export async function accorderDroits(db) {
  await db.exec(`
    grant all on all tables in schema public to authenticated, anon, service_role;
    grant all on all sequences in schema public to authenticated, anon, service_role;
    grant all on all functions in schema public to authenticated, anon, service_role;
    grant all on all tables in schema storage to authenticated, anon, service_role;
    grant all on all functions in schema storage to authenticated, anon, service_role;
    alter table storage.objects enable row level security;
  `);
}

// Applique les migrations du dossier, dans l'ordre lexicographique.
export async function appliquerMigrations(db, { onInstruction, surErreur } = {}) {
  let ok = 0;
  const echecs = [];
  const ignorees = [];
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort();

  for (const fichier of fichiers) {
    const sql = readFileSync(join(DOSSIER, fichier), 'utf8');
    const instructions = decouper(sql);
    let koFichier = 0;
    let ignFichier = 0;
    onInstruction?.({ fichier, type: 'debut', total: instructions.length });

    for (const [i, instr] of instructions.entries()) {
      const absente = extensionIndisponibleLocale(instr);
      if (absente) {
        ignorees.push({ fichier, extension: absente });
        ignFichier++;
        onInstruction?.({ fichier, type: 'ignore', extension: absente, n: i + 1, message: MESSAGE_EXTENSION_IGNOREE });
        continue;
      }
      try {
        await db.exec(instr);
        ok++;
        onInstruction?.({ fichier, type: 'ok', n: i + 1 });
      } catch (e) {
        koFichier++;
        const msg = (e && e.message ? e.message : String(e)).split('\n')[0];
        echecs.push({ fichier, n: i + 1, msg, extrait: instr.slice(0, 160).replace(/\s+/g, ' ') });
        onInstruction?.({ fichier, type: 'ko', n: i + 1, msg, extrait: instr });
        surErreur?.(echecs[echecs.length - 1]);
      }
    }
    onInstruction?.({ fichier, type: 'fin', ok: instructions.length - koFichier - ignFichier, ko: koFichier, ign: ignFichier });
  }
  return { ok, echecs, ignorees, fichiers };
}
