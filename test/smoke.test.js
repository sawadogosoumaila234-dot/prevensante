import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/index.js';

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

test('GET /health renvoie un statut ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.statut, 'ok');
    assert.equal(body.service, 'prevensante');
  });
});

test('GET / renvoie 200', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
  });
});

test('une route inconnue renvoie 404 en JSON', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/inexistant`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.erreur, 'ressource introuvable');
  });
});
