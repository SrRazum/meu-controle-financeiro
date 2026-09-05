/* Service Worker desativado.
   O aplicativo não usa mais cache offline. Este arquivo existe apenas para
   aposentar versões antigas que ainda estejam registradas no navegador. */
self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll({type:'window'}).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({type:'DISABLE_OLD_SW'});
        });
      });
    })
  );
});
self.addEventListener('fetch', function(event) {
  // Sempre deixa a rede responder; nunca serve conteúdo armazenado.
  event.respondWith(fetch(event.request));
});
