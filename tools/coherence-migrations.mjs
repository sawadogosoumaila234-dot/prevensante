// Contrôle sémantique croisé des migrations PrevEnSanté :
//  - tables créées  vs tables référencées dans les politiques/索引 ;
//  - colonnes utilisées dans les politiques vs colonnes réellement créées ;
//  - fonctions app.* appelées vs fonctions définies.
// Aucun accès base : tout est lu dans les fichiers de migration.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = 'C:/Users/Cabinet_prevent/dev/prevensante/supabase/migrations';
const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort();
const sql = fichiers.map((f) => readFileSync(join(DOSSIER, f), 'utf8')).join('\n');

const sansCommentaires = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Tables créées ────────────────────────────────────────────────
const tablesCreees = new Set();
for (const m of sansCommentaires.matchAll(
  /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_]+)\.([a-z_]+)/gi,
)) {
  tablesCreees.add(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
}

// ── Colonnes par table (à partir des blocs CREATE TABLE) ────────
const colonnes = new Map();
for (const m of sansCommentaires.matchAll(
  /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_]+)\.([a-z_]+)\s*\(([\s\S]*?)\n\s*\);/gi,
)) {
  const cle = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  const corps = m[3];
  const liste = new Set();
  // Colonnes de premier niveau : on ignore le contenu des parenthèses imbriquées.
  let profondeur = 0;
  let courant = '';
  for (const c of corps) {
    if (c === '(') profondeur++;
    if (c === ')') profondeur--;
    if (c === ',' && profondeur === 0) {
      liste.add(courant);
      courant = '';
      continue;
    }
    courant += c;
  }
  liste.add(courant);
  for (const def of liste) {
    const d = def.trim().replace(/^--.*$/gm, '').trim();
    if (!d) continue;
    const nom = d.match(/^([a-z_][a-z0-9_]*)\s+/i);
    if (nom) liste.set ? null : null;
    const n = nom && nom[1].toLowerCase();
    if (n) {
      const set = colonnes.get(cle) || new Set();
      set.add(n);
      colonnes.set(cle, set);
    }
  }
}

// ── Colonnes ajoutées par ALTER TABLE ───────────────────────────
for (const m of sansCommentaires.matchAll(
  /alter\s+table\s+(?:only\s+)?([a-z_]+)\.([a-z_]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi,
)) {
  const cle = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  const set = colonnes.get(cle) || new Set();
  set.add(m[3].toLowerCase());
  colonnes.set(cle, set);
}

// ── Fonctions définies ───────────────────────────────────────────
const fonctions = new Set();
for (const m of sansCommentaires.matchAll(
  /create\s+or\s+replace\s+function\s+([a-z_]+)\.([a-z_]+)/gi,
)) {
  fonctions.add(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
}

// ── Politiques RLS ───────────────────────────────────────────────
const politiques = [];
for (const m of sansCommentaires.matchAll(
  /create\s+policy\s+([a-z_][a-z0-9_]*)\s+on\s+([a-z_]+)\.([a-z_]+)\s+for\s+(\w+)\s+using\s*\(([\s\S]*?)\)(?:\s+with\s+check\s*\(([\s\S]*?)\))?\s*;/gi,
)) {
  politiques.push({
    nom: m[1],
    table: `${m[2].toLowerCase()}.${m[3].toLowerCase()}`,
    using: (m[5] || '').trim(),
    check: (m[6] || '').trim(),
  });
}

// ── Contrôles ────────────────────────────────────────────────────
const problemes = [];

for (const p of politiques) {
  if (!tablesCreees.has(p.table)) {
    problemes.push(`POLITIQUE ${p.nom} : table ${p.table} introuvable`);
  }
  // Tables référencées dans la condition
  for (const m of p.using.matchAll(/\b(?:from|join)\s+([a-z_]+)\.([a-z_]+)/gi)) {
    const t = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
    if (!tablesCreees.has(t)) {
      problemes.push(`POLITIQUE ${p.nom} : référence à ${t} qui n'existe pas`);
    }
  }
  for (const m of p.check.matchAll(/\b(?:from|join)\s+([a-z_]+)\.([a-z_]+)/gi)) {
    const t = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
    if (!tablesCreees.has(t)) {
      problemes.push(`POLITIQUE ${p.nom} (with check) : référence à ${t} qui n'existe pas`);
    }
  }
  // Fonctions app.* / medical.* appelées
  for (const cond of [p.using, p.check]) {
    for (const m of cond.matchAll(/\b(app|medical)\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
      const f = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
      // fonctions de rôle connues et non applicatives
      if (!fonctions.has(f) && !f.startsWith('app.est_') && !f.startsWith('app.role_')) {
        problemes.push(`POLITIQUE ${p.nom} : fonction ${f}() non définie`);
      }
    }
  }
}

// ── Index sur tables inexistantes ─────────────────────────────────
for (const m of sansCommentaires.matchAll(
  /create\s+index\s+(?:if\s+not\s+exists\s+)?[a-z_][a-z0-9_]*\s+on\s+([a-z_]+)\.([a-z_]+)/gi,
)) {
  const t = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  if (!tablesCreees.has(t)) problemes.push(`INDEX sur ${t} : table inexistante`);
}

// ── Triggers sur tables inexistantes ─────────────────────────────
for (const m of sansCommentaires.matchAll(
  /create\s+trigger\s+[a-z_][a-z0-9_]*\s+(?:before|after)\s+\w+\s+on\s+([a-z_]+)\.([a-z_]+)/gi,
)) {
  const t = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  if (!tablesCreees.has(t)) problemes.push(`TRIGGER sur ${t} : table inexistante`);
}

// ── Affichage ────────────────────────────────────────────────────
console.log(`Tables creees : ${tablesCreees.size}`);
console.log(`Fonctions definies : ${fonctions.size}`);
console.log(`Politiques RLS : ${politiques.length}`);
console.log('\nTables :');
for (const t of [...tablesCreees].sort()) {
  console.log(`  ${t}  (${(colonnes.get(t) || new Set()).size} colonnes)`);
}
console.log('\nFonctions :');
for (const f of [...fonctions].sort()) console.log(`  ${f}`);

if (problemes.length) {
  console.log(`\n${problemes.length} PROBLEME(S) :`);
  for (const p of problemes) console.log(`  [KO] ${p}`);
  process.exit(1);
}
console.log('\nAucun probleme de coherence detecte.');
