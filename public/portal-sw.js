/*
 * KCPL customer portal service worker.
 *
 * Deliberately small. It does two jobs and declines a third.
 *
 *   1. It receives web push and shows the notification. The payload is
 *      already decrypted by the browser by the time it arrives here.
 *   2. It focuses an existing portal tab on click rather than opening a
 *      fourth one, because a customer who taps three notifications should
 *      not end up with three windows.
 *
 * The job it declines is caching. A freight portal's value is that it is
 * current: a cached shipment status is a wrong shipment status, and telling
 * someone their cargo is in transit when it was delivered yesterday is worse
 * than telling them the page will not load. So there is no fetch handler and
 * no offline copy of any record.
 */

self.addEventListener("install", () => {
  // Nothing to precache; take over as soon as the old worker releases.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push that is not our JSON is not worth guessing at.
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "Kapileshwor Cargo";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: "/images/brand/kcpl-logo-mark.png",
    badge: "/images/brand/kcpl-gateway-k.svg",
    lang: typeof payload.lang === "string" ? payload.lang : "en",
    // The delivery key, so the same fact arriving twice replaces the first
    // notification instead of stacking a duplicate on the lock screen.
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url: typeof payload.url === "string" ? payload.url : "/portal" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/portal";

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.includes("/portal") && "focus" in client) {
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
