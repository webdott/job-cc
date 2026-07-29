// Custom service worker chunk, auto-compiled and importScript-ed into the
// generated Workbox sw.js by next-pwa (see customWorkerDir in next.config.mjs).
// Workbox's GenerateSW output has no push/notificationclick handling on its
// own, so without this file, subscriptions succeed but nothing ever displays.
self.addEventListener("push", (event) => {
  let payload = { title: "Job Command Center", body: "" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  const { title, body, icon, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).pathname === url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
