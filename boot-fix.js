/*
 * Boot Fix — limpeza definitiva do legado de Service Worker/cache.
 * Este arquivo roda antes da aplicação e NÃO participa da autenticação,
 * criptografia ou sincronização dos dados.
 */
(function () {
  'use strict';

  var KEY = '__mcf_sw_cleanup_v2__';

  function reloadOnceIfNeeded() {
    try {
      if (sessionStorage.getItem(KEY) === '1') return;
      sessionStorage.setItem(KEY, '1');
      var u = new URL(window.location.href);
      u.searchParams.set('_bootfix', String(Date.now()));
      window.location.replace(u.toString());
    } catch (_) {
      window.location.reload();
    }
  }

  async function cleanup() {
    var changed = false;

    try {
      if ('serviceWorker' in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) {
          try {
            changed = (await regs[i].unregister()) || changed;
          } catch (_) {}
        }
      }
    } catch (_) {}

    try {
      if ('caches' in window) {
        var keys = await caches.keys();
        for (var j = 0; j < keys.length; j++) {
          try {
            changed = (await caches.delete(keys[j])) || changed;
          } catch (_) {}
        }
      }
    } catch (_) {}

    // If this document was controlled by a legacy worker, reload once after
    // unregistering it so the application becomes a normal network page.
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        reloadOnceIfNeeded();
      }
    } catch (_) {}
  }

  // Never block the application startup on cleanup.
  cleanup().catch(function () {});
})();
