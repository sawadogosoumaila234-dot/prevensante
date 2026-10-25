/* PrevEnSanté — service worker (mode hors ligne)
 *
 * Stratégie : cache-first sur les ressources statiques (build Vite + assets),
 * network-first sur les requêtes API, et repli sur index.html pour la navigation.
 */

const CACHE = 'prevensante-v2';
const RESSOURCES = ['/', '/index.html', '/manifest.webmanifest', '/assets/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(RESSOURCES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // API : réseau d'abord, cache en secours.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE).then((c) => c.put(requete, copie));
          return reponse;
        })
        .catch(() => caches.match(requete)),
    );
    return;
  }

  // Navigation : réseau d'abord, repli sur l'index (SPA).
  if (requete.mode === 'navigate') {
    event.respondWith(fetch(requete).catch(() => caches.match('/index.html')));
    return;
  }

  // Ressources statiques : cache d'abord.
  event.respondWith(
    caches.match(requete).then(
      (cache) =>
        cache ||
        fetch(requete).then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE).then((c) => c.put(requete, copie));
          return reponse;
        }),
    ),
  );
});
