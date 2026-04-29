// Mi Biblioteca — Service Worker for reminder notifications
// Keeps scheduled timers alive in the background

const scheduled = {}; // id -> timeoutId

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE') {
    const { id, fireAt, title, body } = e.data;
    // Clear any existing timer for this id
    if (scheduled[id]) clearTimeout(scheduled[id]);
    const delay = fireAt - Date.now();
    if (delay <= 0) {
      // Already due — fire immediately
      self.registration.showNotification(title, {
        body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'reminder-' + id,
        renotify: true
      });
      delete scheduled[id];
    } else {
      scheduled[id] = setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'reminder-' + id,
          renotify: true
        });
        delete scheduled[id];
      }, Math.min(delay, 2147483647));
    }
  }

  if (e.data.type === 'CANCEL') {
    const { id } = e.data;
    if (scheduled[id]) { clearTimeout(scheduled[id]); delete scheduled[id]; }
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

// Keep SW alive on install/activate
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
