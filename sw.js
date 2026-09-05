const APP_VERSION = "financeiro-v1.13-test-20260905c";
const CACHE_NAME = `meu-controle-${APP_VERSION}`;
const ISOLATION_SCRIPT = `./account-isolation.js?v=${APP_VERSION}`;
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./logo.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("meu-controle-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // O isolamento de contas nunca deve ser servido de um JS antigo.
  // A versão é colocada na URL e o script é buscado sempre pela rede.
  if (url.pathname.endsWith("/account-isolation.js")) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(async response => {
          const text = await response.clone().text();
          const injected = text.replace(
            /<\/body>/i,
            `<script src="${ISOLATION_SCRIPT}"></script></body>`
          );
          const headers = new Headers(response.headers);
          headers.delete("content-length");
          const out = new Response(injected, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
          caches.open(CACHE_NAME).then(cache => cache.put(request, out.clone()));
          return out;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
    )
  );
});
