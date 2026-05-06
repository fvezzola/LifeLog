const CACHE = 'lifelog-v4';
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

// Fetch: cache-first for own assets, network passthrough for AI/sync APIs
self.addEventListener('fetch', e => {
  let host = '';
  try { host = new URL(e.request.url).hostname; } catch (_) {}
  if (host === 'api.anthropic.com' || host.endsWith('.anthropic.com')) return;
  if (host === 'generativelanguage.googleapis.com')                   return;
  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) return;
  if (host === 'api.deepgram.com')                                    return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET' && host !== 'fonts.googleapis.com' && host !== 'fonts.gstatic.com') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    }).catch(() => caches.match('index.html'))
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
