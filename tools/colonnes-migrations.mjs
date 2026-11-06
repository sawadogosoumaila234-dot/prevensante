// Vérifie que chaque colonne citée dans une politique RLS existe réellement,
// en tenant compte des sous-requêtes (extraction des parenthèses équilibrées).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Chemin resolu depuis l'emplacement du module : l'outillage doit fonctionner
// sur n'importe quelle machine et sur une CI, pas seulement sur le poste qui
// a ecrit le script.
const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DOSSIER = join(RACINE, 'supabase', 'migrations');
const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort();
const sql = fichiers.map((f) => readFileSync(join(DOSSIER, f), 'utf8')).join('\n');
const sans = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const colonnes = new Map();
function col(cle, nom) {
  if (!colonnes.has(cle)) colonnes.set(cle, new Set());
  colonnes.get(cle).add(nom.toLowerCase());
}
for (const m of sans.matchAll(
  /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_]+)\.([a-z_]+)\s*\(([\s\S]*?)\n\s*\);/gi,
)) {
  const cle = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  let prof = 0, cur = '';
  const parts = [];
  for (const c of m[3]) {
    if (c === '(') prof++;
    if (c === ')') prof--;
    if (c === ',' && prof === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  for (const def of parts) {
    const nom = def.trim().match(/^([a-z_][a-z0-9_]*)\s+/i);
    if (nom) col(cle, nom[1]);
  }
}
for (const m of sans.matchAll(
  /alter\s+table\s+(?:only\s+)?([a-z_]+)\.([a-z_]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi,
)) {
  col(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`, m[3]);
}

// Tables fournies par Supabase (auth.*, storage.*) : hors DDL versionne,
// leurs colonnes ne sont pas verifiables ici.
const TABLES_SUPABASE = new Set(['auth.users', 'storage.buckets', 'storage.objects']);
const tablesCreees = new Set([...colonnes.keys(), ...TABLES_SUPABASE]);

function extrairePolitiques(source) {
  const resultats = [];
  const re = /create\s+policy\s+([a-z_][a-z0-9_]*)\s+on\s+([a-z_]+)\.([a-z_]+)([\s\S]*?);/gi;
  for (const m of source.matchAll(re)) {
    const nom = m[1];
    const table = `${m[2].toLowerCase()}.${m[3].toLowerCase()}`;
    const corps = m[4];
    const cond = [];
    const re2 = /(using|with\s+check)\s*\(/gi;
    for (const c of corps.matchAll(re2)) {
      const debut = c.index + c[0].length;
      let i = debut - 1, prof = 0;
      for (; i < corps.length; i++) {
        if (corps[i] === '(') prof++;
        else if (corps[i] === ')') {
          prof--;
          if (prof === 0) break;
        }
      }
      cond.push(corps.slice(debut, i));
    }
    resultats.push({ nom, table, cond });
  }
  return resultats;
}

function aliasDe(source) {
  const out = new Map();
  const interdits = ['where','on','join','group','order','limit','and','or','set','select','using','with','as','for','from'];
  for (const m of source.matchAll(/\bfrom\s+([a-z_]+)\.([a-z_]+)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?/gi)) {
    const [, sch, tab, alb] = m;
    if (alb && !interdits.includes(alb.toLowerCase())) {
      out.set(alb.toLowerCase(), `${sch.toLowerCase()}.${tab.toLowerCase()}`);
    }
  }
  return out;
}

const MOTS_CLES = new Set([
  'select','from','where','and','or','not','exists','using','check','true','false','null','any',
  'all','in','is','as','on','for','with','case','when','then','else','end','cast','coalesce',
  'current_user','current_role','uid','now','session_user','between','like','ilike','distinct',
  'asc','desc','limit','offset','union','intersect','except','inner','left','right','full','outer',
  'join','group','by','order','having','returning','set','values','into','do','begin','if',
]);

const problemes = [];
let verif = 0;
const politiques = extrairePolitiques(sans);

for (const p of politiques) {
  if (!tablesCreees.has(p.table)) {
    problemes.push(`POLITIQUE ${p.nom} : table ${p.table} inexistante`);
    continue;
  }
  if (TABLES_SUPABASE.has(p.table)) continue;
  const colonnesTable = colonnes.get(p.table);
  const alias = aliasDe(p.cond.join(' '));

  for (const cond of p.cond) {
    for (const c of cond.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi)) {
      const [, alb, nomCol] = c;
      if (MOTS_CLES.has(nomCol.toLowerCase())) continue;
      if (['auth','app','medical','public'].includes(alb.toLowerCase())) continue;
      const tableLiee = alias.get(alb.toLowerCase());
      if (!tableLiee) continue;
      verif++;
      const setLie = colonnes.get(tableLiee);
      if (setLie && !setLie.has(nomCol.toLowerCase())) {
        problemes.push(`POLITIQUE ${p.nom} : « ${alb}.${nomCol} » absent de ${tableLie}`);
      }
    }

    for (const c of cond.matchAll(/\b([a-z_][a-z0-9_]*)\s*(?:=|<>|!=|>=|<=|>|<|\bis\b|\bin\b)/gi)) {
      const nomCol = c[1].toLowerCase();
      if (MOTS_CLES.has(nomCol)) continue;
      if (['auth','app','medical'].includes(nomCol)) continue;
      verif++;
      if (!colonnesTable.has(nomCol)) {
        const ailleurs = [...colonnes.values()].some((s) => s.has(nomCol));
        if (!ailleurs) {
          problemes.push(`POLITIQUE ${p.nom} : colonne « ${nomCol} » absente de ${p.table} et du schéma`);
        }
      }
    }
  }
}

console.log(`Colonnes verifiees : ${verif}`);
console.log(`Politiques analysees : ${politiques.length}`);

if (problemes.length) {
  console.log(`\n${problemes.length} PROBLEME(S) :`);
  for (const p of problemes) console.log(`  [KO] ${p}`);
  process.exit(1);
}
console.log('\nToutes les colonnes citees existent.');
