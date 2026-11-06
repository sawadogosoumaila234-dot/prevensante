/**
 * Fonction serverless Vercel.
 *
 * Vercel transforme chaque fichier de `api/` en fonction. Ce fichier réutilise
 * le routeur de l'application (`server/app.js`) : en local comme en production,
 * c'est le même code qui répond.
 *
 * `vercel.json` route `/api/*` vers cette fonction : la réécriture ne retire
 * pas le préfixe de l'URL, la fonction reçoit donc `/api/health`. On le retire
 * ici, sans quoi le routeur ne reconnaîtrait aucune de ses routes et le point
 * de santé répondrait 404.
 */
import { handleRequest } from '../server/app.js';

/** Retire le préfixe `/api` du chemin d'une requête Vercel. */
function sansPrefixeApi(url) {
  const chemin = url.pathname;
  if (chemin === '/api') return '/';
  if (chemin.startsWith('/api/')) return chemin.slice(4);
  return chemin;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const chemin = sansPrefixeApi(url);
    if (chemin === url.pathname) return handleRequest(request);

    // La requête est réécrite : on reconstruit une URL équivalente, chemin
    // seul conservé, pour que le routeur voie la route qu'il attend.
    const cible = new URL(url);
    cible.pathname = chemin;
    return handleRequest(new Request(cible, request));
  },
};
