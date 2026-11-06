/**
 * Routeur de l'application, en API Web standard (Request -> Response).
 *
 * Volontairement sans dépendance : ce module tourne aussi bien dans le serveur
 * Node local (`server/index.js`) que dans une fonction serverless Vercel
 * (`api/index.js`). Aucun framework n'est imposé.
 */

const SERVICE = 'prevensante';
const VERSION = '0.1.0';

/** Réponse JSON normalisée (UTF-8). */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Réponse texte brut normalisée (UTF-8). */
export function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Point d'entrée unique. Prend une `Request`, renvoie une `Response`.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleRequest(request) {
  const { pathname } = new URL(request.url);

  if (pathname === '/health') {
    return json({ statut: 'ok', service: SERVICE, version: VERSION });
  }

  if (pathname === '/') {
    return text('PrevEnSanté — socle applicatif opérationnel.\n');
  }

  return json({ erreur: 'ressource introuvable', chemin: pathname }, 404);
}
