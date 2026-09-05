// Inicialização segura e compatibilidade de bootstrap.
// Este arquivo NÃO altera localStorage, IndexedDB, dados criptografados ou sessão do Supabase.
(function () {
  'use strict';
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.register) {
      navigator.serviceWorker.register = function () {
        return Promise.reject(new Error('Service Worker desativado pelo aplicativo.'));
      };
    }
  } catch (_) {}
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) {
          try { return reg.unregister(); } catch (_) { return false; }
        }));
      }).catch(function () {});
    }
  } catch (_) {}
  try {
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) {
          try { return caches.delete(key); } catch (_) { return false; }
        }));
      }).catch(function () {});
    }
  } catch (_) {}

  // Não faça restauração automática da nuvem durante o boot.
  // O usuário cria/desbloqueia a proteção local primeiro; a reconciliação
  // com os dados da nuvem continua disponível pela tela de sincronização.
  window.__MCF_DISABLE_AUTO_CLOUD_RESTORE = true;

  // As funções do index.html são declaradas depois deste arquivo. Quando
  // maybeOfferCloudRestore aparecer, neutralizamos apenas o convite automático.
  // Isso evita o ciclo proteção -> restauração -> proteção.
  (function guardAutoRestore() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      try {
        if (typeof window.maybeOfferCloudRestore === 'function') {
          window.maybeOfferCloudRestore = async function () { return false; };
          clearInterval(timer);
          return;
        }
      } catch (_) {}
      if (attempts >= 600) clearInterval(timer);
    }, 10);
  })();
})();

// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";
