
// Minimal service worker - development mode, no caching
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass all requests directly to network without caching
  event.respondWith(fetch(event.request));
});

// ---------- Web Push ----------
// Nhận thông báo đẩy từ server (edge function push-web) rồi hiển thị lên máy.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Thông báo', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Thông báo';
  const options = {
    body: data.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [80, 40, 80],
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { link: data.link || '' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Bấm vào thông báo -> mở app đúng module (dùng link/tab).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        if (link) c.postMessage({ type: 'NOTIF_NAV', link });
        return;
      }
    }
    // Không có tab nào đang mở -> mở tab mới kèm ?tab= để app tự điều hướng
    const url = link ? `/?tab=${encodeURIComponent(link)}` : '/';
    await self.clients.openWindow(url);
  })());
});
