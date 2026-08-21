const CACHE_VERSION = "kd-app-shell-v4";
const CORE_CACHE = `${CACHE_VERSION}-core`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Only cache public, non-customer-specific application shell resources.
// Restaurant data lives in the tenant-scoped IndexedDB offline store.
const CORE_ASSETS = [
  "/orders/new",
  "/login",
  "/manifest.json",
  "/kd-icon-192.png",
  "/kd-icon-512.png",
];

const SAFE_NAVIGATION_PATHS = new Set(["/", "/login", "/orders/new"]);

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isSafeNavigation(url) {
  return SAFE_NAVIGATION_PATHS.has(url.pathname);
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;

  // Cache only the app's own install icons outside Next's immutable static tree.
  // Do not cache arbitrary same-origin images because they may be tenant/menu data.
  if (url.pathname === "/kd-icon-192.png" || url.pathname === "/kd-icon-512.png") {
    return true;
  }

  return false;
}

function responseMayBeCached(response) {
  if (!response || !response.ok || response.type === "opaque") return false;

  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return false;

  // Never persist responses that establish/change an authenticated session.
  if (response.headers.has("set-cookie")) return false;
  return true;
}

async function cacheResponse(cacheName, request, response) {
  if (!responseMayBeCached(response)) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function navigationResponse(request, url) {
  try {
    const response = await fetch(request);
    if (isSafeNavigation(url)) {
      void cacheResponse(CORE_CACHE, request, response);
    }
    return response;
  } catch {
    const exact = isSafeNavigation(url) ? await caches.match(request) : null;
    if (exact) return exact;

    // The POS shell is deliberately public and performs authorization from the
    // locally persisted lease. It is therefore a safe offline entry point.
    const posShell = await caches.match("/orders/new");
    if (posShell) return posShell;

    const login = await caches.match("/login");
    if (login) return login;

    return new Response(
      "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Kitchen Diaries Offline</title></head><body><main><h1>Kitchen Diaries is offline</h1><p>Reopen the installed POS after it has completed one successful online activation.</p></main></body></html>",
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}

async function staticAssetResponse(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    void cacheResponse(STATIC_CACHE, request, response);
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CORE_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || !isSameOrigin(url) || isApiRequest(url)) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(navigationResponse(request, url));
    return;
  }

  // Do not cache arbitrary Next.js RSC/data requests. Only immutable/static
  // browser assets are persisted; tenant data remains in IndexedDB.
  if (isStaticAsset(request, url)) {
    event.respondWith(staticAssetResponse(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "CLEAR_APP_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }
});
