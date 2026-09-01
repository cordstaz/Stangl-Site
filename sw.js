// Stangl Stash service worker
// Caches the app shell (this page + logo + manifest) so the installed app
// opens instantly and still shows something useful with no connection.
// Photo uploads/downloads always go straight to Firebase over the network,
// never through this cache, so your data is always current.

const CACHE_NAME = 'stangl-stash-v2';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './stangl-stash-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Firebase Storage requests (photos) or Firestore/API calls -
  // those must always be fresh.
  if (url.hostname.includes('firebasestorage') || url.hostname.includes('googleapis')) {
    return;
  }

  // Only handle GET requests for same-origin app shell files.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      // Serve cached immediately if we have it (fast load), update cache in background.
      return cached || networkFetch;
    })
  );
});
