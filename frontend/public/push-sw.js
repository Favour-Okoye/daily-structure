/* Web Push handlers, imported into the generated service worker. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* plain text payloads fall back to defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Daily Structure ⚓", {
      body: data.body || "Tap what's already true.",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: data.tag || "ds-reminder",
      data: { url: data.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
