// ─── Tuatha Pro — Service Worker ───
// Provides: offline-first caching, API response cache, sync queue, push notifications.

const STATIC_CACHE = "tuatha-static-v2";
const API_CACHE = "tuatha-api-v1";
const OFFLINE_URL = "/offline";

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/TuathaPro.png",
];

// API routes to cache (GET only) — network-first with cache fallback
const CACHEABLE_API = [
  "/api/messagerie/conversations",
  "/api/reseau/messages",
  "/api/reseau/contacts",
  "/api/reseau/connections",
  "/api/auth/me",
  "/api/athletes",
  "/api/notifications",
  "/api/facturation",
  "/api/programmes",
];

// Max age for cached API responses (5 minutes)
const API_CACHE_MAX_AGE = 5 * 60 * 1000;

function isCacheableAPI(pathname) {
  return CACHEABLE_API.some((route) => pathname.startsWith(route));
}

// ─── Install: pre-cache critical assets ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ───
self.addEventListener("activate", (event) => {
  const keepCaches = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Push: display notification from server ───
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/icon-192.png",
      tag: payload.tag || "tuatha-default",
      data: { url: payload.url || "/", ...payload.data },
      vibrate: [100, 50, 100],
      renotify: !!payload.tag,
    };
    event.waitUntil(self.registration.showNotification(payload.title || "Tuatha Pro", options));
  } catch {
    event.waitUntil(
      self.registration.showNotification("Tuatha Pro", {
        body: event.data.text(),
        icon: "/icon-192.png",
      })
    );
  }
});

// ─── Notification click: open or focus the app ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── Background Sync: replay queued mutations ───
self.addEventListener("sync", (event) => {
  if (event.tag === "tuatha-sync-queue") {
    event.waitUntil(replayQueueFromSW());
  }
});

async function replayQueueFromSW() {
  // Notify client to replay (IndexedDB is accessible from SW, but we delegate to the client for simplicity)
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "REPLAY_SYNC_QUEUE" });
  }
}

// ─── Fetch: offline-first strategy ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Skip non-GET for caching (mutations handled client-side via offlineFetch)
  if (request.method !== "GET") return;

  // Skip Next.js HMR/internals & streaming endpoints
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.includes("/stream")) return;
  if (url.pathname.startsWith("/api/push/")) return;

  // ─── API GET: Network first, cache fallback ───
  if (url.pathname.startsWith("/api/") && isCacheableAPI(url.pathname)) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // ─── Navigation: network first, offline fallback page ───
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // ─── Static assets: cache first, then network ───
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script"
  ) {
    event.respondWith(cacheFirstStatic(request));
  }
});

// ─── Network-first for API responses ───
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      // Store response with a timestamp header for staleness checks
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set("x-sw-cached-at", Date.now().toString());
      const cachedResponse = new Response(await cloned.blob(), {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    // Offline — try cache
    const cached = await caches.match(request);
    if (cached) {
      // Check staleness (optional — return stale data is better than nothing)
      return cached;
    }
    // No cache — return offline JSON
    return new Response(
      JSON.stringify({ offline: true, error: "Pas de connexion" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ─── Cache-first for static assets ───
async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Silently fail for static assets
    return new Response("", { status: 408 });
  }
}
