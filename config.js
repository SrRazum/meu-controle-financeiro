// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

/*
 * V1.13 — encerramento seguro da sessão / troca de conta.
 *
 * O cofre local continua criptografado, mas deixa de ficar disponível em
 * memória e a chave local é retirada enquanto nenhuma conta estiver aberta.
 * Uma cópia do envelope criptografado é mantida por conta para permitir
 * voltar à conta anterior sem misturar os dados entre contas.
 *
 * A alteração é aplicada aqui para preservar o index.html validado da branch
 * de revisão e manter a main completamente intocada.
 */
(function () {
  const SECURE_KEY = "controle_financeiro_secure_v1";
  const BACKUP_PREFIX = "controle_financeiro_backup_v1_";
  const SWITCH_FLAG = "controle_financeiro_account_switch_pending";

  function accountKey(email) {
    return BACKUP_PREFIX + encodeURIComponent(String(email || "").trim().toLowerCase());
  }

  function rememberLocalVault(email) {
    if (!email) return;
    const raw = localStorage.getItem(SECURE_KEY);
    if (raw) localStorage.setItem(accountKey(email), raw);
  }

  function hideLocalVault() {
    localStorage.removeItem(SECURE_KEY);
    if (typeof window.data !== "undefined") window.data = [];
    window.__financePassword = null;
    window.unlocked = false;
    if (window.inactivityTimer) clearTimeout(window.inactivityTimer);
  }

  window.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("unlockForm");
    if (form && !form.__accountSwitchWrapped) {
      const originalSubmit = form.onsubmit;
      form.onsubmit = async function (event) {
        if (localStorage.getItem(SWITCH_FLAG) === "1") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof window.openSyncModal === "function") await window.openSyncModal();
          return false;
        }
        return originalSubmit ? originalSubmit.call(form, event) : true;
      };
      form.__accountSwitchWrapped = true;
    }

    const originalLogout = window.syncLogout;
    if (typeof originalLogout !== "function" || originalLogout.__safeSwitchWrapped) return;

    async function safeLogout() {
      let email = "";
      try {
        if (window.__supabase) {
          const result = await window.__supabase.auth.getUser();
          email = result && result.data && result.data.user ? result.data.user.email || "" : "";
        }
      } catch (e) {}

      /* Preserva o cofre criptografado da conta que acabou de sair. */
      rememberLocalVault(email);
      localStorage.setItem(SWITCH_FLAG, "1");

      try {
        await originalLogout();
      } catch (e) {}

      /* Logout não significa apagar os dados: apenas retirá-los da sessão. */
      hideLocalVault();
      if (typeof window.render === "function") window.render();

      const modal = document.getElementById("syncModal");
      if (modal) modal.classList.remove("show");

      if (typeof window.showLock === "function") window.showLock("unlock");
      const title = document.getElementById("lockTitle");
      const desc = document.getElementById("lockDescription");
      const button = document.getElementById("unlockButton");
      const second = document.getElementById("unlockPassword2");
      const cloudBtn = document.getElementById("lockCloudBtn");
      const msg = document.getElementById("lockMsg");

      if (title) title.textContent = "Sessão encerrada";
      if (desc) desc.textContent = "Entre com uma conta para acessar seus dados financeiros.";
      if (button) button.textContent = "Entrar na conta";
      if (second) {
        second.style.display = "none";
        second.required = false;
      }
      if (cloudBtn) {
        cloudBtn.style.display = "block";
        cloudBtn.textContent = "☁️ Entrar / trocar de conta";
      }
      if (msg) msg.textContent = "Sessão encerrada. Os dados desta conta continuam protegidos e não estão visíveis.";

      /* Abre diretamente a tela de autenticação, sem mostrar os dados locais. */
      if (typeof window.openSyncModal === "function") await window.openSyncModal();
    }

    safeLogout.__safeSwitchWrapped = true;
    window.syncLogout = safeLogout;
  });

  /* Quando a conta é autenticada após uma troca, o cofre local antigo não
     deve voltar automaticamente. Se houver cofre remoto, o fluxo existente
     de restauração será usado; se não houver, o usuário poderá criar a nova
     proteção local para a nova conta. */
  window.addEventListener("DOMContentLoaded", function () {
    const originalLogin = window.syncLogin;
    if (typeof originalLogin !== "function" || originalLogin.__safeSwitchWrapped) return;

    async function safeLogin() {
      const switching = localStorage.getItem(SWITCH_FLAG) === "1";
      if (!switching) return originalLogin.apply(this, arguments);

      /* Remove qualquer cofre local remanescente antes da autenticação para
         que maybeOfferCloudRestore não confunda a conta anterior com a nova. */
      localStorage.removeItem(SECURE_KEY);
      if (typeof window.data !== "undefined") window.data = [];
      window.__financePassword = null;
      window.unlocked = false;

      await originalLogin.apply(this, arguments);

      if (!window.__syncReady) return;

      /* A autenticação foi aceita. A partir daqui esta sessão pertence à nova
         conta; o fluxo original decidirá entre restauração ou nova proteção. */
      localStorage.removeItem(SWITCH_FLAG);

      if (typeof window.securityMode !== "undefined" && window.securityMode !== "restore") {
        if (typeof window.setSecurityMode === "function") window.setSecurityMode("setup");
        if (typeof window.showLock === "function") window.showLock("setup");
      }
    }

    safeLogin.__safeSwitchWrapped = true;
    window.syncLogin = safeLogin;
  });
})();
