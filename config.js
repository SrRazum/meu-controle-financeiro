// Configuração segura do Meu Controle Financeiro.
// A nuvem NÃO é inicializada durante o boot. O aplicativo primeiro
// estabelece/desbloqueia a proteção local e somente depois dispara
// o evento finance:unlocked. Isso evita o ciclo proteção -> nuvem -> restauração.
(function () {
  'use strict';

  // Limpa Service Workers e caches antigos deixados por versões anteriores.
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

  var URL_VALUE = "https://prrgajnjkknstsaokgwy.supabase.co";
  var KEY_VALUE = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";
  var started = false;

  function startCloudAfterUnlock() {
    if (started || !window.unlocked || typeof window.initCloud !== 'function') return;
    started = true;
    window.SUPABASE_URL = URL_VALUE;
    window.SUPABASE_PUBLISHABLE_KEY = KEY_VALUE;
    try { window.initCloud(); } catch (_) {}
  }

  // Exposto para o aplicativo chamar explicitamente depois de desbloquear.
  window.startCloudAfterUnlock = startCloudAfterUnlock;

  // Também aceita o evento disparado pelo núcleo de segurança.
  window.addEventListener('finance:unlocked', startCloudAfterUnlock);
})();
