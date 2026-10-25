/**
 * Fonction serverless Vercel.
 *
 * Vercel transforme chaque fichier de `api/` en fonction. Ce fichier réutilise
 * le routeur de l'application (`src/app.js`) : en local comme en production,
 * c'est le même code qui répond.
 *
 * `vercel.json` route toutes les requêtes vers cette fonction.
 */
import { handleRequest } from '../src/app.js';

export default {
  async fetch(request) {
    return handleRequest(request);
  },
};
