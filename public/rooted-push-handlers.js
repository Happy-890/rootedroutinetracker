// Messaging only: no fetch interception, app-shell cache or private account data.
self.addEventListener("push", event => {
  let message = { title: "Rooted", body: "Build what matters, daily." };
  try { if (event.data) message = event.data.json(); } catch { /* Display the default message. */ }
  event.waitUntil(self.registration.showNotification(typeof message.title === "string" && message.title.trim() ? message.title.slice(0, 80) : "Daily Check-In", {
    body: typeof message.body === "string" ? message.body.slice(0, 200) : "Build what matters, daily.",
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: typeof message.tag === "string" ? message.tag : "rooted-reminder",
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.focus(); return; }
    await self.clients.openWindow("/");
  })());
});
// Never cache navigations, credentials, API responses or private account data.
// Public app assets are precached by Workbox; offline navigation gets a public fallback.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || event.request.mode !== "navigate" ||
      url.origin !== self.location.origin || url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/reset-password") || url.search) return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match("/offline.html", { ignoreSearch: true })) ?? Response.error()));
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all(["rooted-shell-v1", "rooted-assets-v1"].map(name => caches.delete(name))));
});
