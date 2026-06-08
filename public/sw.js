const CACHE_NAME = "foodza-shell-v16";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/restaurants") ||
      url.pathname.startsWith("/menu/") ||
      url.pathname.startsWith("/customer-orders/") ||
      url.pathname.startsWith("/customer") ||
      url.pathname.startsWith("/order-status/") ||
      url.pathname.startsWith("/admin") ||
      url.pathname.startsWith("/delivery") ||
      url.pathname.startsWith("/restaurant-delivery") ||
      url.pathname.startsWith("/restaurant-analytics/") ||
      url.pathname.startsWith("/recommendations/") ||
      url.pathname === "/trending-foods" ||
      url.pathname === "/coupons") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
