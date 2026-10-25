/**
 * PrevEnSanté — point d'entrée de l'application.
 *
 * Node simple, aucune dépendance applicative : le socle technique n'impose
 * aucun framework (voir README du projet d'environnement).
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const DEFAULT_PORT = 3000;

/** Charge un .env local s'il existe, sans dépendance externe (Node >= 20). */
function loadLocalEnv() {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Aucun .env : on se contente des variables déjà présentes.
  }
}

/**
 * Construit le serveur HTTP de l'application.
 * Exporté pour permettre les tests sans ouvrir de port fixe.
 */
export function createApp() {
  return createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ statut: 'ok', service: 'prevensante', version: '0.1.0' }));
      return;
    }

    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('PrevEnSanté — socle applicatif opérationnel.\n');
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ erreur: 'ressource introuvable', chemin: url.pathname }));
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
