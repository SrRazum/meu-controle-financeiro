// Boot seguro do Meu Controle Financeiro.
// REGRA: o Supabase fica bloqueado durante todo o boot inicial.
// A conexão só é liberada depois que o núcleo de segurança define
// window.unlocked = true e dispara finance:unlocked.
(function () {
  'use strict';

  var URL_VALUE = "https://prrgajnjkknstsaokgwy.supabase.co";
  var KEY_VALUE = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";
  var realSupabase = null;
  var cloudUnlocked = false;

  // Captura a instância criada pelo CDN. Antes do desbloqueio, qualquer
  // tentativa de createClient feita pelo código legado falha de propósito.
  // Isso neutraliza chamadas prematuras de initCloud() sem quebrar o CDN.
  try {
    var descriptor = Object.getOwnPropertyDescriptor(window, 'supabase');
    if (!descriptor || descriptor.configurable !== false) {
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        enumerable: true,
        get: function () {
          if (realSupabase) return realSupabase;
          if (cloudUnlocked && window.__supabaseReal) return window.__supabaseReal;
          return {
            createClient: function () {
              throw new Error('SUPABASE_BOOT_BLOCKED');
            }
          };
        },
        set: function (value) {
          realSupabase = value;
          window.__supabaseReal = value;
        }
      });
    }
  } catch (_) {}

  function clearOldServiceWorkersAndCaches() {
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
  }
  clearOldServiceWorkersAndCaches();

  function startCloudAfterUnlock() {
    if (cloudUnlocked || !window.unlocked) return;
    if (typeof window.initCloud !== 'function') return;

    cloudUnlocked = true;
    window.SUPABASE_URL = URL_VALUE;
    window.SUPABASE_PUBLISHABLE_KEY = KEY_VALUE;

    try {
      if (realSupabase) window.__supabaseReal = realSupabase;
      window.initCloud();
    } catch (_) {}
  }

  window.startCloudAfterUnlock = startCloudAfterUnlock;
  window.addEventListener('finance:unlocked', startCloudAfterUnlock);
})();
