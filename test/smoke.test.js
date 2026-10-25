import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../server/app.js';
import { createApp } from '../server/index.js';

// --- Tests unitaires du routeur (aucun port, aucun réseau) ---

test('handleRequest : /health renvoie un statut ok', async () => {
  const res = await handleRequest(new Request('http://localhost/health'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.statut, 'ok');
  assert.equal(body.service, 'prevensante');
});

test('handleRequest : / renvoie 200 en texte', async () => {
  const res = await handleRequest(new Request('http://localhost/'));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/plain/);
});

test('handleRequest : route inconnue renvoie 404 JSON', async () => {
  const res = await handleRequest(new Request('http://localhost/inexistant'));
  assert.equal(res.status, 404);
  assert.equal((await res.json()).erreur, 'ressource introuvable');
});

test("handleRequest : aucun fichier du dépôt n'est exposé", async () => {
  // Les documents internes ne doivent jamais être servis, ni en local ni sur
  // Vercel. Ils sont en plus exclus du déploiement par .vercelignore.
  for (const chemin of ['/README.md', '/docs/PRD_PrevEnSante.md', '/package.json', '/.env']) {
    const res = await handleRequest(new Request(`http://localhost${chemin}`));
    assert.equal(res.status, 404, `${chemin} ne doit pas être servi`);
  }
});

// --- Tests d'intégration via le serveur Node local ---

/** Démarre l'application sur un port libre et renvoie son URL de base. */
async function withServer(run) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('serveur local : GET /health renvoie un statut ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).service, 'prevensante');
  });
});

test('serveur local : GET / renvoie 200', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/`)).status, 200);
  });
});

test('serveur local : une route inconnue renvoie 404 en JSON', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/inexistant`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).erreur, 'ressource introuvable');
  });
});

test('serveur local : une requête POST ne casse pas le serveur', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`, { method: 'POST', body: 'x=1' });
    assert.equal(res.status, 200);
  });
});
