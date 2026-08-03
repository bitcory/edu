// Minimal service worker. Purpose: satisfy PWA installability criteria and keep
// itself fresh. Deliberately does NOT cache PDFs / API / audio (large, dynamic,
// auth-gated) — those always go to the network.
const CACHE = "tbbook-shell-v1";
const SHELL = ["/app-icon.png", "/apple-icon.png", "/favicon-32x32.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for page navigations so content stays fresh; if the network
  // fails, fall back to any cached copy (best-effort offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || Response.error()))
    );
  }
});
