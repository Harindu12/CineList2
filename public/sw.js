const CACHE_NAME = 'cinelist-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A minimal fetch handler is required by Chrome to pass the PWA installability criteria.
  // We'll just respond over network, and if offline, fail gracefully.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline - Please reconnect to the internet.');
    })
  );
});
