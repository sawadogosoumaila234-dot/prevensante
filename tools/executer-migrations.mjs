// Exécute réellement les migrations PrevEnSanté dans PGlite
// (PostgreSQL 16 compilé en WebAssembly — un vrai moteur, pas un simple parseur).
//
// ⚠️ ÉMULATION LOCALE UNIQUEMENT (rien de tout cela n'est versionné dans les
//    migrations) : PGlite ne fournit pas les schémas `auth` et `storage` de
//    Supabase, ni les extensions `pg_cron` / `pg_net`. Voir tools/pglite-prelude.mjs.
import { demarrerPGlite, appliquerMigrations, accorderDroits } from './pglite-prelude.mjs';

const db = await demarrerPGlite({ pgtap: false });

const resultat = await appliquerMigrations(db, {
  onInstruction: (e) => {
    if (e.type === 'debut') console.log(`\n=== ${e.fichier} (${e.total} instructions) ===`);
    else if (e.type === 'ignore') {
      console.log(`  [IGN] #${e.n} : extension "${e.extension}" indisponible dans PGlite — ignorée localement`);
    } else if (e.type === 'ko') {
      console.log(`  [KO] #${e.n} : ${e.msg}`);
      console.log(`        ${e.extrait.slice(0, 160).replace(/\s+/g, ' ')}`);
    }
  },
});

console.log('\n===================');
console.log(`Total reussi : ${resultat.ok}`);
console.log(`Total en echec : ${resultat.echecs.length}`);
console.log(`Extensions ignorees (indisponibles dans PGlite) : ${resultat.ignorees.length}`);

if (resultat.echecs.length === 0) {
  await accorderDroits(db);

  console.log('\n--- Verification de la base ---');
  for (const q of [
    ['Tables metier (public)', `select count(*)::int n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`],
    ['Enums (public)', `select count(*)::int n from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype='e' and n.nspname='public'`],
    ['Sequences (public)', `select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='S' and n.nspname='public'`],
    ['Politiques RLS (public)', `select count(*)::int n from pg_policies where schemaname='public'`],
    ['Politiques RLS (storage)', `select count(*)::int n from pg_policies where schemaname='storage'`],
    ['Fonctions (public)', `select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`],
    ['Vues (public)', `select count(*)::int n from pg_views where schemaname='public'`],
    ['Triggers', `select count(*)::int n from pg_trigger where not tgisinternal`],
    ['Tables RLS actif (public)', `select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relrowsecurity and n.nspname='public'`],
  ]) {
    const r = await db.query(q[1]);
    console.log(`${q[0]} : ${r.rows[0].n}`);
  }
}

process.exit(resultat.echecs.length > 0 ? 1 : 0);
