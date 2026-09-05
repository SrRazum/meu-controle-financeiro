// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

/* V1.13 — troca de conta.
   O logout remove o cofre local da sessão e recarrega a aplicação.
   Isso garante que os dados e a senha da sessão anterior saiam da memória.
   O cofre remoto não é apagado. */
(function () {
  const SECURE_KEY = "controle_financeiro_secure_v1";
  const SWITCH_FLAG = "controle_financeiro_account_switch_pending";
  let logoutWrapped = false;

  function setupSwitchScreen() {
    const switching = localStorage.getItem(SWITCH_FLAG) === "1";
    const hasLocalVault = !!localStorage.getItem(SECURE_KEY);
    if (!switching && hasLocalVault) return;

    const title = document.getElementById("lockTitle");
    const desc = document.getElementById("lockDescription");
    const button = document.getElementById("unlockButton");
    const second = document.getElementById("unlockPassword2");
    const cloudBtn = document.getElementById("lockCloudBtn");
    const msg = document.getElementById("lockMsg");

    if (switching) {
      if (title) title.textContent = "Sessão encerrada";
      if (desc) desc.textContent = "Entre com uma conta para acessar seus dados financeiros.";
      if (button) {
        button.style.display = "block";
        button.textContent = "Criar proteção neste dispositivo";
      }
      if (second) { second.style.display = "block"; second.required = true; }
      if (msg) msg.textContent = "Sessão encerrada. Os dados da conta anterior não estão visíveis.";
    }

    /* Se não há cofre local, também oferecemos a entrada na nuvem.
       Isso evita prender o usuário na tela de criação de proteção quando
       a aplicação foi aberta em um dispositivo/sessão sem cofre local. */
    if (cloudBtn) {
      cloudBtn.style.display = "block";
      cloudBtn.textContent = "☁️ Entrar / trocar de conta";
    }
  }

  function attachCloudButton() {
    const cloudBtn = document.getElementById("lockCloudBtn");
    if (!cloudBtn) return;
    cloudBtn.style.display = "block";
    cloudBtn.textContent = "☁️ Entrar / trocar de conta";
    cloudBtn.onclick = function () {
      if (typeof window.openSyncModal === "function") window.openSyncModal();
    };
  }

  function wrapLogoutWhenReady() {
    if (logoutWrapped) return;
    const originalLogout = window.syncLogout;
    if (typeof originalLogout !== "function" || originalLogout.__safeSwitchWrapped) return;

    async function safeLogout() {
      try { await originalLogout.apply(this, arguments); } catch (e) {}

      /* Não apagar os dados remotos. Remove somente o cofre local da sessão. */
      localStorage.removeItem(SECURE_KEY);
      localStorage.setItem(SWITCH_FLAG, "1");

      /* Recarregar elimina da memória os dados e a senha da sessão anterior. */
      location.reload();
    }

    safeLogout.__safeSwitchWrapped = true;
    window.syncLogout = safeLogout;
    logoutWrapped = true;
  }

  window.addEventListener("DOMContentLoaded", function () {
    setupSwitchScreen();
    attachCloudButton();

    /* A reconstrução da V1.13 pode declarar syncLogout depois deste listener.
       Tentamos novamente por alguns segundos para garantir que o logout seja
       sempre encapsulado antes de o usuário poder acioná-lo. */
    wrapLogoutWhenReady();
    let attempts = 0;
    const timer = setInterval(function () {
      wrapLogoutWhenReady();
      attempts += 1;
      if (logoutWrapped || attempts >= 100) clearInterval(timer);
    }, 100);
  });
})();