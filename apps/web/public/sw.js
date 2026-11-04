// Zeal Service Worker v3 — optimized shell cache + stale-while-revalidate for API + prefetch
const CACHE_VERSION = "zeal-sw-v3";
const SHELL_CACHE = `zeal-shell-${CACHE_VERSION}`;
const API_CACHE = `zeal-api-${CACHE_VERSION}`;
const FONT_CACHE = `zeal-font-${CACHE_VERSION}`;
const IMAGE_CACHE = `zeal-img-${CACHE_VERSION}`;

const SHELL_URLS = [
  "/",
  "/offline",
  "/chat",
  "/explore",
  "/services",
];

// Prefetch likely navigation targets on idle
const PREFETCH_URLS = [
  "/services/tarot",
  "/services/kundali",
  "/services/horoscope",
  "/services/numerology",
];

const MAX_API_CACHE = 80;
const API_CACHE_TTL = 10 * 60 * 1000;
const MAX_FONT_CACHE = 20;
const MAX_IMAGE_CACHE = 100;

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
          .filter((k) => k.startsWith("zeal-") && k !== SHELL_CACHE && k !== API_CACHE && k !== FONT_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Prefetch on idle after load
self.addEventListener("message", (event) => {
  if (event.data === "PREFETCH") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        for (const url of PREFETCH_URLS) {
          try {
            const existing = await cache.match(url);
            if (!existing) {
              await cache.add(url);
            }
          } catch { /* prefetch failure is non-critical */ }
        }
      })()
    );
  }
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Immutable static assets — cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/media/")) {
    event.respondWith(cacheFirstImmutable(request, SHELL_CACHE));
    return;
  }

  // Fonts — cache first with separate cache
  if (url.pathname.startsWith("/_next/font/") || url.pathname.endsWith(".woff2") || url.pathname.endsWith(".woff")) {
    event.respondWith(cacheFirstImmutable(request, FONT_CACHE));
    return;
  }

  // Images — cache first with separate cache + size limit
  if (url.pathname.match(/\.(webp|jpg|jpeg|png|gif|svg|avif)$/i) || url.pathname.startsWith("/_next/image")) {
    event.respondWith(cacheFirstImmutable(request, IMAGE_CACHE));
    return;
  }

  // API calls — network first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkThenCache(request));
    return;
  }

  // HTML pages — network first with offline fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  // Everything else — stale while revalidate
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
    return new Response("Offline — Zeal", { status: 503, headers: { "Content-Type": "text/plain" } });
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
    return new Response(JSON.stringify({ error: "offline", message: "You are offline. Some features may be unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstImmutable(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(cacheName);
      if (cacheName === IMAGE_CACHE) {
        await trimCache(cache, MAX_IMAGE_CACHE);
      }
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
