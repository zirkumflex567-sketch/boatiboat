/* Boatiboat Service Worker – macht die Web-App installierbar und offline-fähig. */
const VERSION = "boatiboat-v1";
const SHELL = [
  "./",
  "assets/styles.css",
  "assets/app.js",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "api/questions",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App-Navigation: Netzwerk zuerst, Cache als Fallback
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { cachePut(req, res.clone()); return res; }).catch(() => caches.match("./")));
    return;
  }

  const isCatalog = url.pathname.endsWith("/api/questions") || url.pathname.endsWith("api/questions");
  if (isCatalog) {
    // Katalog: Netzwerk zuerst (aktuell halten), sonst Cache
    e.respondWith(
      fetch(req).then((res) => { cachePut(req, res.clone()); return res; }).catch(() => caches.match(req))
    );
    return;
  }

  // Statische Assets (CSS/JS/Bilder/Icons): Cache zuerst
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => { cachePut(req, res.clone()); return res; }))
  );
});

function cachePut(req, res) {
  if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res)).catch(() => {});
}
