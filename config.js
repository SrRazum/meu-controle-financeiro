// Boot seguro do Meu Controle Financeiro.
// O Supabase fica bloqueado durante o boot inicial e só é liberado
// depois que o aplicativo estiver efetivamente desbloqueado.
(function () {
  'use strict';

  var URL_VALUE = "https://prrgajnjkknstsaokgwy.supabase.co";
  var KEY_VALUE = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";
  var realSupabase = null;
  var cloudUnlocked = false;
  var eventSent = false;

  // O CDN do Supabase é carregado depois deste arquivo. Capturamos a
  // instância quando ele fizer window.supabase = ... e, enquanto o app
  // estiver bloqueado, impedimos createClient de iniciar a nuvem.
  try {
    var descriptor = Object.getOwnPropertyDescriptor(window, 'supabase');
    if (!descriptor || descriptor.configurable !== false) {
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        enumerable: true,
        get: function () {
          if (realSupabase && cloudUnlocked) return realSupabase;
          return {
            createClient: function () {
              throw new Error('SUPABASE_BOOT_BLOCKED');
            }
          };
        },
        set: function (value) {
          realSupabase = value;
        }
      });
    }
  } catch (_) {}

  // Limpa Service Workers/cache de versões antigas. O app não depende mais
  // de Service Worker para funcionar.
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) {
          try { return reg.unregister(); } catch (_) { return false; }
        }));
      }).catch(function () {});
    }
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) {
          try { return caches.delete(key); } catch (_) { return false; }
        }));
      }).catch(function () {});
    }
  } catch (_) {}

  function startCloudAfterUnlock() {
    if (cloudUnlocked || !window.unlocked) return;
    if (typeof window.initCloud !== 'function') return;

    cloudUnlocked = true;
    window.SUPABASE_URL = URL_VALUE;
    window.SUPABASE_PUBLISHABLE_KEY = KEY_VALUE;

    try { window.initCloud(); } catch (_) {}
  }

  window.startCloudAfterUnlock = startCloudAfterUnlock;
  window.addEventListener('finance:unlocked', startCloudAfterUnlock);

  // Compatibilidade com a versão atual do index.html: como ela ainda chama
  // initCloud() no final do script, observamos o desbloqueio e só então
  // liberamos a instância real e iniciamos a nuvem uma única vez.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (window.unlocked && !eventSent) {
      eventSent = true;
      try { window.dispatchEvent(new Event('finance:unlocked')); } catch (_) { startCloudAfterUnlock(); }
    }
    if (cloudUnlocked || tries >= 3600) clearInterval(timer);
  }, 100);
})();
