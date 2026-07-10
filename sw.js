const CACHE_PREFIX = "campus-question-bank";
const CORE_CACHE = `${CACHE_PREFIX}-core-v16`;
const DATA_CACHE = `${CACHE_PREFIX}-data-v16`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-v16`;
const CORE_ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icon.svg"];

function sameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isDataRequest(url) {
  return url.pathname.includes("/data/") && url.pathname.endsWith(".json");
}

function isQuestionChunk(url) {
  return url.pathname.includes("/data/chunks/") && url.pathname.endsWith(".json");
}

function isQuestionImage(url) {
  return url.pathname.includes("/assets/questions/");
}

async function cachePut(cacheName, request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function networkFirst(request, cacheName, fallbackUrl = null) {
  try {
    const response = await fetch(request);
    await cachePut(cacheName, request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw new Error("No network response or cache entry available.");
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await cachePut(cacheName, request, response);
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![CORE_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request)) return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, CORE_CACHE, "./index.html"));
    return;
  }

  if (isQuestionChunk(url)) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (isQuestionImage(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, CORE_CACHE));
});
