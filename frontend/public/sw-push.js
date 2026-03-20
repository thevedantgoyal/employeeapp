// Push notification service worker
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  if (!event.data) {
    console.log("[SW] No push data");
    return;
  }

  try {
    const data = event.data.json();
    console.log("[SW] Push data:", data);

    const options = {
      body: data.body,
      icon: data.icon || "/pwa-192x192.png",
      badge: data.badge || "/pwa-192x192.png",
      tag: data.tag || "default",
      data: {
        url: data.url || "/",
        timestamp: data.timestamp,
      },
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        { action: "open", title: "Open" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error("[SW] Error processing push:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window if none found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription changed");
  // The subscription has expired or was revoked
  // The app should resubscribe when the user opens it next
});
