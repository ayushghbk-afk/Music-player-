const SCOPE = new URL('./', self.location.href);
const CACHE_PREFIX = 'aether-' + encodeURIComponent(SCOPE.pathname) + '-';
const CACHE = CACHE_PREFIX + 'v2';
const ASSETS = ['./', 'index.html', 'manifest.json', 'pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png', 'aether-mark.svg' /* BUILD_ASSETS */].map(file => new URL(file, SCOPE).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname) || url.pathname.startsWith('/api/') || url.pathname.startsWith(SCOPE.pathname + 'api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, response.clone())));
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match(new URL('index.html', SCOPE).href) : undefined) || new Response('Offline asset unavailable', { status: 503 })));
});
