const APP_VERSION = "financeiro-v1.17";
const CACHE_NAME = `meu-controle-${APP_VERSION}`;
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./logo.png", "./boot-fix.js"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith("meu-controle-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function freshNavigation(request) {
  const response = await fetch(request, { cache: "no-store" });
  const html = await response.text();
  const marker = '<script src="./boot-fix.js"></script>';
  const injected = html.includes(marker) ? html : html.replace(/<\/body>/i, marker + "</body>");
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      freshNavigation(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
        return response;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (url.pathname.endsWith("/boot-fix.js")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, copy));
      return response;
    }))
  );
});
