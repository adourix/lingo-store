const CACHE = "lingo-pos-shell-v2";
const SHELL = [
  "/",
  "/login",
  "/enroll",
  "/sales",
  "/shift",
  "/customers",
  "/terminal",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept Next.js internals or React Server Component requests.
  // App Router RSC responses are streamed payloads, not normal HTML documents;
  // returning a cached document for an RSC request can corrupt the stream and
  // surface as "Uncaught Error: Connection closed" in the browser.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    request.headers.has("RSC") ||
    url.searchParams.has("_rsc") ||
    request.mode !== "navigate"
  )
    return;

  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});
