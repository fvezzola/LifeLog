const CACHE = 'lifelog-v6';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'js/app.js',
  'js/state.js',
  'js/ui.js',
  'js/ai.js',
  'js/voice.js',
  'js/reminders.js',
  'js/data.js',
  'js/settings.js',
  'js/sync.js',
  'js/api.js',
  'js/config.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=IBM+Plex+Mono:ital,wght@0,300;0,400;1,300&display=swap'
];

// Install: cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache the static PWA shell, let everything else go to network.
// We intentionally don't intercept cross-origin requests (LifeLog API,
// AI providers, Deepgram, etc.) — they need fresh data, auth cookies,
// and SSE streams that caching would break.
const SAME_ORIGIN = self.location.origin;
const CACHEABLE_CROSS_ORIGIN = new Set([
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === SAME_ORIGIN;
  const cacheableCrossOrigin = CACHEABLE_CROSS_ORIGIN.has(url.origin);

  if (!sameOrigin && !cacheableCrossOrigin) return;            // passthrough
  if (e.request.method !== 'GET')             return;          // never cache mutations
  // Backend API + realtime stream — must always hit the network.
  // Caching /api/me would serve stale auth state; caching /api/entries
  // would serve stale data; caching /api/stream would break SSE entirely.
  if (sameOrigin && url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    }).catch(() => sameOrigin ? caches.match('index.html') : undefined)
  );
});

// Push notifications (from server, future feature)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'LifeLog', body: "Log something right now." };
  e.waitUntil(
    self.registration.showNotification(data.title || 'LifeLog', {
      body: data.body || "What's on your mind?",
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: './' }
    })
  );
});

// Notification click: open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || './'));
});
