// Synchronisation Plane (PrevEnSanté) — instance auto-hebergee plane.ulia.site
//
// Usage :
//   node tools/plane-sync.mjs etats                     liste les etats du projet
//   node tools/plane-sync.mjs backlog                   liste le backlog
//   node tools/plane-sync.mjs etat <issue_id> <state>   change l'etat d'une issue
//   node tools/plane-sync.mjs commentaire <issue_id> <fichier_html>   poste un commentaire
//
// Le jeton API est lu dans PLANE_API_KEY (variable d'environnement ou fichier .plane/.env).
// Il n'est JAMAIS écrit dans le depot.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.PLANE_API_BASE || 'https://plane.ulia.site/api/v1';
const WS = process.env.PLANE_WORKSPACE_SLUG || 'iltic';
const PROJECT = process.env.PLANE_PROJECT_ID || '9757fbec-904e-4187-b3b0-6f6ea9ee187a';

function apiKey() {
  if (process.env.PLANE_API_KEY) return process.env.PLANE_API_KEY;
  const candidates = [
    join(process.cwd(), '.plane', '.env'),
    join(process.cwd(), '..', '.plane', '.env'),
    join(process.cwd(), '..', '..', '.plane', '.env'),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/PLANE_API_KEY\s*=\s*"?([^"\n\r]+)"?/);
    if (m) return m[1].trim();
  }
  console.error('PLANE_API_KEY introuvable (variable d\'environnement ou .plane/.env)');
  process.exit(2);
}

const KEY = apiKey();
const issueUrl = (id) => `${BASE}/workspaces/${WS}/projects/${PROJECT}/issues/${id}/`;

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${method} ${url}\n${text.slice(0, 500)}`);
    process.exit(1);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'etats') {
  const states = await call('GET', `${BASE}/workspaces/${WS}/projects/${PROJECT}/states/`);
  for (const s of states.results || states) console.log(`${s.id}  ${s.name}`);
} else if (cmd === 'backlog') {
  const issues = await call('GET', `${BASE}/workspaces/${WS}/projects/${PROJECT}/issues/`);
  for (const i of issues.results || issues) {
    console.log(`${i.id}  ${i.state}  ${i.parent ? 'TACHE ' : 'EPIC  '}${i.name}`);
  }
} else if (cmd === 'etat') {
  const [id, state] = args;
  const r = await call('PATCH', issueUrl(id), { state });
  console.log(`${r.name} -> ${r.state}`);
} else if (cmd === 'commentaire') {
  const [id, file] = args;
  const comment_html = readFileSync(file, 'utf8');
  const r = await call('POST', `${issueUrl(id)}comments/`, { comment_html });
  console.log(`commentaire posté sur ${id} (${r?.id || 'ok'})`);
} else {
  console.error('Usage : plane-sync.mjs etats | backlog | etat <id> <state> | commentaire <id> <fichier.html>');
  process.exit(2);
}
