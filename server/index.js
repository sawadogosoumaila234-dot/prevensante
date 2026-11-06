/**
 * Adaptateur Node HTTP -> API Web standard, et serveur de développement local.
 *
 * Le routeur (`server/app.js`) ne connaît que `Request`/`Response`. Ce fichier fait
 * la traduction pour un serveur `node:http` classique, afin de développer et
 * tester en local exactement le code déployé sur Vercel (`api/index.js`).
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { handleRequest } from './app.js';

const DEFAULT_PORT = 3000;

/** Charge un .env local s'il existe, sans dépendance externe (Node >= 20). */
function loadLocalEnv() {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Aucun .env : on se contente des variables déjà présentes.
  }
}

/** Convertit une requête `node:http` en `Request` standard. */
async function toWebRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';
  const init = { method, headers: req.headers };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  return new Request(url, init);
}

/** Écrit une `Response` standard sur un flux `node:http`. */
async function writeWebResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * Construit le serveur HTTP de l'application.
 * Exporté pour permettre les tests sans ouvrir de port fixe.
 */
export function createApp() {
  return createServer(async (req, res) => {
    try {
      await writeWebResponse(res, await handleRequest(await toWebRequest(req)));
    } catch (erreur) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ erreur: 'erreur interne', detail: String(erreur?.message ?? erreur) }));
    }
  });
}

/** Démarre le serveur sur le port demandé. */
export function start(port = DEFAULT_PORT) {
  const server = createApp();
  server.listen(port, () => {
    console.log(`PrevEnSanté à l'écoute sur http://localhost:${port}`);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  loadLocalEnv();
  const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  start(port);
}
