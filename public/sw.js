const CACHE_NAME = 'alice-farma-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/site.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignorar requisições de desenvolvimento para evitar conflitos com o Vite
  if (event.request.url.includes('localhost') || 
      event.request.url.includes('@vite') || 
      event.request.url.includes('src/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Fallback silencioso se a rede falhar
          return new Response('Network error occurred', { status: 408 });
        });
      })
  );
});
