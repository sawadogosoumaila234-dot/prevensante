/* PrevEnSanté — service worker minimal (cache applicatif, mode hors ligne) */
const CACHE = 'prevensante-v1';
const ASSETS = [
  './',
  'index.html',
  'signaler.html',
  'signalements.html',
  'actions.html',
  'pilotage.html',
  'assistant.html',
  'notifications.html',
  'sites.html',
  'profil.html',
  'assets/app.css',
  'assets/app.js',
  'assets/icon.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
