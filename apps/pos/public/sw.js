const CACHE = "lingo-pos-shell-v3";

self.addEventListener("install", (event) => {
  // Next.js App Router documents contain per-response CSP nonces and
  // React Server Component payloads. Caching those HTML documents in a
  // service worker can replay stale nonces/RSC streams and break hydration.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Do not intercept Next.js internals, RSC requests, API responses, or
  // navigation documents. Authenticated/API responses are never cached.
  // Static assets remain handled by the browser/Next.js cache.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    request.headers.has("RSC") ||
    url.searchParams.has("_rsc") ||
    request.mode === "navigate"
  )
    return;
});
