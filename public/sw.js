// Service worker minimal pour les notifications push web (audit du
// 2026-09-11, complète les notifications e-mail). Ne fait AUCUN cache
// hors-ligne volontairement — Najarena est un produit de données en
// direct (check-in, bracket, résultats) : mettre en cache une page
// périmée serait pire que pas de cache du tout.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { titre, corps, url } = payload;

  event.waitUntil(
    self.registration.showNotification(titre ?? "Najarena", {
      body: corps ?? "",
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
