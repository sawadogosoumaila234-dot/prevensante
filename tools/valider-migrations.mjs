// Valide les migrations SQL de PrevEnSanté avec le vrai parseur PostgreSQL
// (libpg_query compilé en WebAssembly via pgsql-parser).
// Chaque instruction est découpée puis parsée ; les erreurs sont listées.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseSync, loadModule } = require('pgsql-parser');
const DOSSIER = 'C:/Users/Cabinet_prevent/dev/prevensante/supabase/migrations';

const TAG_DOLLAR = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/;

/**
 * Découpe un script SQL en instructions, en ignorant :
 *  - les commentaires de ligne (`--`) et de bloc ;
 *  - les point-virgules à l'intérieur des chaînes ('...') ;
 *  - les point-virgules à l'intérieur des corps dollar-quotés ($$...$$).
 */
function decouper(sql) {
  const sansCommentaires = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const instructions = [];
  let courant = '';
  let dansChaine = false;
  let tagActif = null;

  for (let i = 0; i < sansCommentaires.length; i++) {
    const c = sansCommentaires[i];
    const reste = sansCommentaires.slice(i);

    if (!dansChaine && !tagActif) {
      const m = reste.match(TAG_DOLLAR);
      if (m) {
        tagActif = m[0];
        courant += tagActif;
        i += tagActif.length - 1;
        continue;
      }
      if (c === "'") {
        dansChaine = true;
        courant += c;
        continue;
      }
      if (c === ';') {
        if (courant.trim()) instructions.push(courant.trim());
        courant = '';
        continue;
      }
      courant += c;
      continue;
    }

    if (dansChaine) {
      courant += c;
      if (c === "'") {
        if (sansCommentaires[i + 1] === "'") {
          courant += "'";
          i++;
        } else {
          dansChaine = false;
        }
      }
      continue;
    }

    if (reste.startsWith(tagActif)) {
      courant += tagActif;
      i += tagActif.length - 1;
      tagActif = null;
      continue;
    }
    courant += c;
  }

  if (courant.trim()) instructions.push(courant.trim());
  return instructions;
}

await loadModule();

let total = 0;
let echecs = 0;
const parFichier = [];

for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort()) {
  const chemin = join(DOSSIER, fichier);
  const sql = readFileSync(chemin, 'utf8');
  const instructions = decouper(sql);
  let ko = 0;

  for (const [i, instr] of instructions.entries()) {
    total++;
    try {
      const res = parseSync(instr);
      const stmt = res && res.stmts && res.stmts[0];
      if (!stmt || !stmt.stmt) {
        console.log(`  [KO] ${fichier} #${i + 1} : aucune instruction analysee`);
        console.log(`        ${instr.slice(0, 140).replace(/\s+/g, ' ')}`);
        ko++;
        echecs++;
      }
    } catch (e) {
      const msg = (e && e.message ? e.message : String(e)).split('\n')[0];
      console.log(`  [KO] ${fichier} #${i + 1} : ${msg}`);
      console.log(`        ${instr.slice(0, 140).replace(/\s+/g, ' ')}`);
      ko++;
      echecs++;
    }
  }

  parFichier.push({ fichier, instructions: instructions.length, ko });
  console.log(`${fichier} : ${instructions.length} instructions, ${ko} echec(s)`);
}

console.log('\n---');
for (const f of parFichier) {
  console.log(`${f.fichier} : ${f.instructions} instructions, ${f.ko} erreur(s)`);
}
console.log(`TOTAL : ${total} instructions, ${echecs} erreur(s) de parsing`);
process.exit(echecs > 0 ? 1 : 0);
