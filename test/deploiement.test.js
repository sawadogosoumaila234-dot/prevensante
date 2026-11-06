import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Le controleur de deploiement doit etre lui-meme verifie : un script qui
// validerait n'importe quoi ne prouverait rien. On rejoue donc le script sur
// des depots de synthese, conformes puis volontairement degrades.

const RACINE_PROJET = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(RACINE_PROJET, 'tools', 'verifier-deploiement.mjs');

/**
 * Construit un depot de synthese proche de la structure reelle du projet.
 * @param {{vercel?: object, vercelignore?: string, api?: string, extra?: Record<string,string>}} options
 */
function creerFixture(options = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'prevensante-deploiement-'));
  const ecrire = (chemin, contenu) => {
    mkdirSync(join(racine, ...chemin.split('/').slice(0, -1)), { recursive: true });
    writeFileSync(join(racine, ...chemin.split('/')), contenu);
  };

  ecrire(
    'vercel.json',
    JSON.stringify(
      options.vercel ?? {
        framework: null,
        buildCommand: 'npm --prefix web run build',
        outputDirectory: 'web/dist',
        installCommand: 'npm install && npm --prefix web install',
        rewrites: [
          { source: '/api/:path*', destination: '/api/index' },
          { source: '/((?!api/).*)', destination: '/index.html' },
        ],
      },
      null,
      2,
    ),
  );
  ecrire('.vercelignore', options.vercelignore ?? 'docs/\n.env\n.env.*\nweb/dist/\n');
  ecrire('package.json', JSON.stringify({ name: 'fixture', type: 'module', scripts: { build: 'npm --prefix web run build' } }));
  ecrire('web/package.json', JSON.stringify({ name: 'fixture-web', type: 'module', scripts: { build: 'tsc -b && vite build' } }));
  ecrire('web/package-lock.json', '{}');
  ecrire('web/index.html', '<!doctype html><html><body><div id="root"></div></body></html>');
  ecrire('web/vite.config.ts', 'export default {};');
  ecrire('web/tsconfig.json', '{"include":["src"]}');
  ecrire('web/src/main.tsx', "import { client } from './supabase/client';\nexport const main = () => client;\n");
  ecrire('web/src/supabase/client.ts', 'export const client = {};\n');
  ecrire('web/dist/index.html', '<!doctype html><html><body></body></html>');
  ecrire('api/index.js', options.api ?? "import { handleRequest } from '../server/app.js';\nexport default { fetch: handleRequest };\n");
  ecrire('server/app.js', 'export function handleRequest() { return new Response("ok"); }\n');
  for (const [chemin, contenu] of Object.entries(options.extra ?? {})) ecrire(chemin, contenu);

  return racine;
}

/** Execute le controleur sur une racine donnee et renvoie son resultat. */
function controler(racine) {
  const resultat = spawnSync(process.execPath, [SCRIPT, racine], { encoding: 'utf8' });
  return { code: resultat.status, sortie: `${resultat.stdout}${resultat.stderr}` };
}

test('deploiement : un depot conforme ne declenche aucune alerte', () => {
  const racine = creerFixture();
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 0, `sortie inattendue :\n${sortie}`);
    assert.match(sortie, /aucune alerte/);
    assert.match(sortie, /repli SPA present/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : un import local non resolu est signale', () => {
  const racine = creerFixture({ api: "import { handleRequest } from '../server/absent.js';\nexport default { fetch: handleRequest };\n" });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /fichier introuvable/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : un fichier requis exclu de l\u2019archive est signale', () => {
  const racine = creerFixture({ vercelignore: 'docs/\nweb/src/\nweb/dist/\n' });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /exclu de l'archive Vercel/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : un document interne transmis est signale', () => {
  const racine = creerFixture({
    vercelignore: '.env\n.env.*\nweb/dist/\n',
    extra: { 'docs/PRD.md': '# PRD\n' },
  });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /documentation interne/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : l\u2019absence de repli SPA est signalee', () => {
  const racine = creerFixture({
    vercel: {
      framework: null,
      buildCommand: 'npm --prefix web run build',
      outputDirectory: 'web/dist',
      rewrites: [{ source: '/api/:path*', destination: '/api/index' }],
    },
  });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /reecriture SPA vers index\.html/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : une commande de build inconnue est signalee', () => {
  const racine = creerFixture({
    vercel: {
      framework: null,
      buildCommand: 'npm --prefix web run build-inexistant',
      outputDirectory: 'web/dist',
      rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
    },
  });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /ne correspond a aucun script/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : un document interne dans le bundle servi est signale', () => {
  const racine = creerFixture({ extra: { 'web/dist/NOTES.md': '# notes internes\n' } });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /servi publiquement/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : une mention de cle service_role dans le bundle est signalee', () => {
  const racine = creerFixture({ extra: { 'web/dist/app.js': 'const k = "SUPABASE_SERVICE_ROLE_KEY";\n' } });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /mention de cle service_role/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : une exclusion trop large du graphe d import du front est signalee', () => {
  // Le motif « supabase/ » n est pas ancre : il attrape aussi
  // web/src/supabase/, et le build Vercel echoue alors sur un import manquant.
  const racine = creerFixture({ vercelignore: 'supabase/\nweb/dist/\n' });
  try {
    const { code, sortie } = controler(racine);
    assert.equal(code, 1);
    assert.match(sortie, /requis par le build du front mais exclu/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deploiement : le depot reel du projet est conforme', () => {
  const { code, sortie } = controler(RACINE_PROJET);
  assert.equal(code, 0, `sortie inattendue :\n${sortie}`);
});
