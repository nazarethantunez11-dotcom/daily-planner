const CACHE_NAME = 'the-day-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (Google Fonts) hit the network normally

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
