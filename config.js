// Configuração segura do Meu Controle Financeiro.
// A conexão com a nuvem só é inicializada DEPOIS que o aplicativo for
// desbloqueado/criado. Isso impede que uma sessão Supabase existente
// altere a tela de segurança durante o boot e elimina o ciclo
// proteção -> restauração -> proteção.
(function () {
  'use strict';
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

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    startCloudAfterUnlock();
    if (started || tries >= 3600) clearInterval(timer);
  }, 100);
})();
