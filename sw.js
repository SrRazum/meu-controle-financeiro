// Service Worker desativado deliberadamente.
// O aplicativo não deve manter cópias antigas do index.html,
// pois isso pode reabrir estados antigos de inicialização/sincronização.
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: "SW_DISABLED" }));
  })());
});

self.addEventListener("fetch", () => {
  // Sem interceptação: o navegador usa diretamente a rede.
});
