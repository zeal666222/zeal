// Zeal Service Worker — offline-first shell cache + stale-while-revalidate for API
const CACHE_VERSION = "zeal-sw-v1";
const SHELL_CACHE = `zeal-shell-${CACHE_VERSION}`;
const API_CACHE = `zeal-api-${CACHE_VERSION}`;

const SHELL_URLS = [
  "/",
  "/offline",
];

const MAX_API_CACHE = 50;
const API_CACHE_TTL = 5 * 60 * 1000;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("zeal-") && k !== SHELL_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstHTML(request));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkThenCache(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstHTML(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function networkThenCache(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(API_CACHE);
      await trimCache(cache, MAX_API_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      const cachedTime = await getCacheTimestamp(cached);
      if (cachedTime && Date.now() - cachedTime < API_CACHE_TTL) {
        return cached;
      }
    }
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstImmutable(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await fetchPromise) || new Response("", { status: 503 });
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
  }
}

async function getCacheTimestamp(response) {
  const date = response.headers.get("date");
  return date ? new Date(date).getTime() : null;
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
