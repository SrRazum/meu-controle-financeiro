// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

/* V1.13 — troca de conta.
   Ao sair, a aplicação remove o cofre local da sessão e recarrega a página.
   Isso garante que os dados e a senha da sessão anterior saiam da memória.
   O cofre remoto não é apagado. */
(function () {
  const SECURE_KEY = "controle_financeiro_secure_v1";
  const SWITCH_FLAG = "controle_financeiro_account_switch_pending";

  function setupSwitchScreen() {
    if (localStorage.getItem(SWITCH_FLAG) !== "1") return;

    const title = document.getElementById("lockTitle");
    const desc = document.getElementById("lockDescription");
    const button = document.getElementById("unlockButton");
    const second = document.getElementById("unlockPassword2");
    const cloudBtn = document.getElementById("lockCloudBtn");
    const msg = document.getElementById("lockMsg");

    if (title) title.textContent = "Sessão encerrada";
    if (desc) desc.textContent = "Entre com uma conta para acessar seus dados financeiros.";
    if (button) {
      button.style.display = "block";
      button.textContent = "Criar proteção neste dispositivo";
    }
    if (second) { second.style.display = "block"; second.required = true; }
    if (cloudBtn) {
      cloudBtn.style.display = "block";
      cloudBtn.textContent = "☁️ Entrar / trocar de conta";
    }
    if (msg) msg.textContent = "Sessão encerrada. Os dados da conta anterior não estão visíveis.";
  }

  window.addEventListener("DOMContentLoaded", function () {
    setupSwitchScreen();

    /* A V1.13 precisa iniciar o mecanismo de proteção depois que o HTML e
       as funções do aplicativo estiverem carregados. */
    if (typeof window.initializeSecurity === "function") {
      window.initializeSecurity().catch(function (err) {
        console.error("Falha ao inicializar a proteção do aplicativo:", err);
      });
    }

    const cloudBtn = document.getElementById("lockCloudBtn");
    if (cloudBtn && localStorage.getItem(SWITCH_FLAG) === "1") {
      cloudBtn.onclick = async function () {
        if (typeof window.openSyncModal === "function") await window.openSyncModal();
      };
    }

    const originalLogout = window.syncLogout;
    if (typeof originalLogout !== "function" || originalLogout.__safeSwitchWrapped) return;

    async function safeLogout() {
      try { await originalLogout(); } catch (e) {}
      localStorage.removeItem(SECURE_KEY);
      localStorage.setItem(SWITCH_FLAG, "1");
      location.reload();
    }

    safeLogout.__safeSwitchWrapped = true;
    window.syncLogout = safeLogout;
  });
})();
