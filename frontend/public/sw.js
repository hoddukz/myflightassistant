// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/public/sw.js

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("[SW] push received", event.data?.text());
  const data = event.data ? event.data.json() : {};
  const title = data.title || "MFA";
  const options = {
    body: data.body || "",
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log("[SW] showNotification OK"))
      .catch((err) => console.error("[SW] showNotification FAILED", err))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
