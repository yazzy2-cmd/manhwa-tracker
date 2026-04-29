const CACHE = 'mibiblioteca-v1';
const timers = {};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Receive messages from the app
self.addEventListener('message', e => {
  const { type, id, fireAt, title, body } = e.data || {};

  if (type === 'SCHEDULE') {
    // Clear any existing timer for this id
    if (timers[id]) clearTimeout(timers[id]);

    const delay = fireAt - Date.now();
    if (delay <= 0) {
      // Already due — fire immediately
      fireNotification(title, body);
      return;
    }

    // Schedule for when the tab is open
    timers[id] = setTimeout(() => {
      fireNotification(title, body);
      delete timers[id];
    }, delay);

    // Also store in SW cache so we can check on next activate
    e.waitUntil(
      caches.open(CACHE).then(cache => {
        const pending = { id, fireAt, title, body };
        return cache.put(
          new Request('/_reminder_' + id),
          new Response(JSON.stringify(pending), { headers: { 'Content-Type': 'application/json' } })
        );
      })
    );
  }

  if (type === 'CANCEL') {
    if (timers[id]) { clearTimeout(timers[id]); delete timers[id]; }
    caches.open(CACHE).then(cache => cache.delete(new Request('/_reminder_' + id)));
  }

  if (type === 'NOTIFY') {
    fireNotification(title, body);
  }
});

// On activate: check stored reminders and fire any that are due or schedule future ones
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      const keys = await cache.keys();
      const reminderKeys = keys.filter(k => k.url.includes('/_reminder_'));
      for (const req of reminderKeys) {
        const res = await cache.match(req);
        if (!res) continue;
        const data = await res.json();
        const delay = data.fireAt - Date.now();
        if (delay <= 0) {
          // Overdue — fire now
          fireNotification(data.title, data.body);
          cache.delete(req);
        } else {
          // Reschedule
          timers[data.id] = setTimeout(() => {
            fireNotification(data.title, data.body);
            cache.delete(req);
            delete timers[data.id];
          }, delay);
        }
      }
    })
  );
});

function fireNotification(title, body) {
  self.registration.showNotification(title || '⭐ Mi Biblioteca', {
    body: body || 'Tienes un recordatorio pendiente',
    icon: 'icon-512.png',
    badge: 'icon-512.png',
    vibrate: [200, 100, 200],
    tag: 'mibiblioteca-reminder',
    renotify: true,
  });
}
