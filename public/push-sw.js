/* global self, clients */
// Custom service-worker additions imported by the generated Workbox SW.
// Handles Web Push notifications, notification clicks, and background sync events.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "TaskHive", body: event.data?.text() || "" }; }
  const title = data.title || "TaskHive";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.png",
    badge: data.badge || "/favicon.png",
    tag: data.tag,
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(target); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

// Allow page to trigger a manual background sync registration
self.addEventListener("message", (event) => {
  if (event.data?.type === "REQUEST_SYNC" && "sync" in self.registration) {
    self.registration.sync.register(event.data.tag || "supabase-write-queue").catch(() => {});
  }
});