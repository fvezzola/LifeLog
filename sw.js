const CACHE = 'lifelog-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
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

// Fetch: cache-first for own assets, network-first for API calls
self.addEventListener('fetch', e => {
  // Never intercept Anthropic API calls
  let host = '';
  try { host = new URL(e.request.url).hostname; } catch (_) {}
  if (host === 'api.anthropic.com' || host.endsWith('.anthropic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // Cache successful same-origin GET responses
        if (resp.ok && e.request.method === 'GET' && host !== 'fonts.googleapis.com' && host !== 'fonts.gstatic.com') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// Push notifications (from server, future feature)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'LifeLog', body: "Log something right now." };
  e.waitUntil(
    self.registration.showNotification(data.title || 'LifeLog', {
      body: data.body || "What's on your mind?",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: '/' }
    })
  );
});

// Notification click: open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
