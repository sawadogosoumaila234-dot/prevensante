import { test } from 'node:test';
import assert from 'node:assert/strict';

// La fonction serverless Vercel est le seul point d'entree HTTP en
// production. La reecriture `/api/:path*` ne retire pas le prefixe de l'URL :
// la fonction doit le faire elle-meme, sinon aucune route du routeur n'est
// reconnue et le point de sante repond 404.

const { default: handler } = await import('../api/index.js');

test('fonction Vercel : /api/health est reconnu comme /health', async () => {
  const res = await handler.fetch(new Request('http://localhost/api/health'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.statut, 'ok');
  assert.equal(body.service, 'prevensante');
});

test('fonction Vercel : /health reste accessible sans prefixe', async () => {
  const res = await handler.fetch(new Request('http://localhost/health'));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).statut, 'ok');
});

test('fonction Vercel : /api ramene la racine', async () => {
  const res = await handler.fetch(new Request('http://localhost/api'));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /PrevEnSant/);
});

test('fonction Vercel : une route inconnue renvoie 404 JSON', async () => {
  const res = await handler.fetch(new Request('http://localhost/api/inconnu'));
  assert.equal(res.status, 404);
  assert.equal((await res.json()).erreur, 'ressource introuvable');
});

test('fonction Vercel : aucun document interne n est servi', async () => {
  for (const chemin of ['/README.md', '/docs/PRD_PrevEnSante.md', '/package.json', '/.env']) {
    const res = await handler.fetch(new Request(`http://localhost/api${chemin}`));
    assert.equal(res.status, 404, `${chemin} ne doit pas etre servi`);
  }
});
