// Configuração do Supabase para o Meu Controle Financeiro.
// Esta configuração é usada somente na branch de teste V1.13.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

(function () {
  const SWITCH_FLAG = "controle_financeiro_account_switch_pending";
  const SECURE_KEY = "controle_financeiro_secure_v1";
  const LEGACY_KEY = "controle_financeiro_v1";
  const BOUND_ACCOUNT_KEY = "controle_financeiro_bound_account_v1";

  function getData() {
    try { return typeof activeData === "function" ? (activeData() || []) : []; }
    catch (e) { return []; }
  }

  function monthLabel(v) {
    const [y, mo] = v.split("-");
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
      .format(new Date(Number(y), Number(mo) - 1, 1));
  }

  function refreshReportPeriods(keepValue) {
    const select = document.getElementById("reportMonth");
    if (!select || select.tagName !== "SELECT") return;
    const old = keepValue || select.value || "__ALL__";
    const months = [...new Set(getData()
      .map(x => x && x.data ? String(x.data).slice(0, 7) : "")
      .filter(v => /^\d{4}-\d{2}$/.test(v)))]
      .sort().reverse();
    select.innerHTML = "";
    const all = document.createElement("option");
    all.value = "__ALL__";
    all.textContent = "Todos os períodos";
    select.appendChild(all);
    months.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = monthLabel(v);
      select.appendChild(opt);
    });
    select.value = months.includes(old) || old === "__ALL__" ? old : "__ALL__";
  }

  function calculateAllPeriods() {
    const arr = getData();
    const ent = arr.filter(x => x.tipo === "entrada").reduce((s, x) => s + Number(x.valor || 0), 0);
    const sai = arr.filter(x => x.tipo === "saida").reduce((s, x) => s + Number(x.valor || 0), 0);
    const pend = arr.filter(x => x.status === "pendente").reduce((s, x) => s + Number(x.valor || 0), 0);
    const money = typeof brl === "function" ? brl : (v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    const cards = document.getElementById("reportCards");
    if (cards) cards.innerHTML = [["Entradas", ent, "green"], ["Saídas", sai, "red"], ["Resultado", ent - sai, ent - sai >= 0 ? "green" : "red"], ["Contas pendentes", pend, "orange"]]
      .map(x => `<div class="card"><div class="label">${x[0]}</div><div class="value ${x[2]}">${money(x[1])}</div></div>`).join("");
    const map = {};
    arr.forEach(x => {
      const k = x.categoria || "Sem categoria";
      map[k] ??= { e: 0, s: 0 };
      map[k][x.tipo === "entrada" ? "e" : "s"] += Number(x.valor || 0);
    });
    const body = document.getElementById("catBody");
    if (body) body.innerHTML = Object.entries(map)
      .map(([k, v]) => `<tr><td>${k}</td><td class="green">${money(v.e)}</td><td class="red">${money(v.s)}</td></tr>`).join("")
      || '<tr><td colspan="3" class="empty">Sem dados registrados.</td></tr>';
  }

  function installReportFilter() {
    let el = document.getElementById("reportMonth");
    if (!el) return;
    if (el.tagName !== "SELECT") {
      const select = document.createElement("select");
      select.id = "reportMonth";
      el.replaceWith(select);
      el = select;
    }
    refreshReportPeriods();
    const originalRender = window.render;
    if (typeof originalRender !== "function") return;
    if (!originalRender.__reportAllWrapped) {
      function renderWithAllPeriods() {
        const current = document.getElementById("reportMonth");
        const period = current ? current.value : "__ALL__";
        if (period !== "__ALL__") return originalRender();
        const saved = current ? current.value : "__ALL__";
        const month = new Date().toISOString().slice(0, 7);
        if (current) current.value = month;
        originalRender();
        if (current) current.value = saved;
        calculateAllPeriods();
      }
      renderWithAllPeriods.__reportAllWrapped = true;
      window.render = renderWithAllPeriods;
    }
    el.onchange = () => window.render();
    el.value = "__ALL__";
    window.render();
  }

  function showSwitchScreen() {
    if (localStorage.getItem(SWITCH_FLAG) !== "1") return;
    const title = document.getElementById("lockTitle");
    const desc = document.getElementById("lockDescription");
    const button = document.getElementById("unlockButton");
    const second = document.getElementById("unlockPassword2");
    const cloudBtn = document.getElementById("lockCloudBtn");
    const msg = document.getElementById("lockMsg");
    if (title) title.textContent = "Sessão encerrada";
    if (desc) desc.textContent = "Entre com uma conta para acessar seus dados financeiros.";
    if (button) { button.style.display = "block"; button.textContent = "Criar proteção neste dispositivo"; }
    if (second) { second.style.display = "block"; second.required = true; }
    if (cloudBtn) { cloudBtn.style.display = "block"; cloudBtn.textContent = "☁️ Entrar / trocar de conta"; }
    if (msg) msg.textContent = "Sessão encerrada. Os dados da conta anterior não estão visíveis.";
  }

  function clearLocalAccountState() {
    try { localStorage.removeItem(SECURE_KEY); } catch (e) {}
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
    try { localStorage.removeItem(BOUND_ACCOUNT_KEY); } catch (e) {}
    try { if (Array.isArray(window.data)) window.data = []; } catch (e) {}
  }

  function installLogoutGuard() {
    const original = window.syncLogout;
    if (typeof original !== "function" || original.__safeSwitchWrappedV2) return false;
    async function safeLogout() {
      await original();
      clearLocalAccountState();
      localStorage.setItem(SWITCH_FLAG, "1");
      location.reload();
    }
    safeLogout.__safeSwitchWrappedV2 = true;
    window.syncLogout = safeLogout;
    return true;
  }

  function installAccountBindingGuard() {
    const originalLogin = window.syncLogin;
    if (typeof originalLogin !== "function" || originalLogin.__accountBindingWrapped) return false;
    async function guardedLogin() {
      try {
        if (window.__supabase && window.unlocked) {
          const { data: r } = await window.__supabase.auth.getUser();
          if (r && r.user) {
            const email = (document.getElementById("syncEmail")?.value || "").trim().toLowerCase();
            if (email && r.user.email && email !== r.user.email.toLowerCase()) {
              localStorage.setItem(SWITCH_FLAG, "1");
              clearLocalAccountState();
              window.__financePassword = null;
              window.unlocked = false;
              await window.__supabase.auth.signOut();
              location.reload();
              return;
            }
          }
        }
      } catch (e) {}
      return originalLogin();
    }
    guardedLogin.__accountBindingWrapped = true;
    window.syncLogin = guardedLogin;
    return true;
  }

  window.addEventListener("DOMContentLoaded", function () {
    installLogoutGuard();
    installAccountBindingGuard();
    showSwitchScreen();
    installReportFilter();
    setTimeout(showSwitchScreen, 50);
    setTimeout(showSwitchScreen, 250);
    setTimeout(showSwitchScreen, 750);
    let lastSignature = "";
    let attempts = 0;
    const timer = setInterval(function () {
      const select = document.getElementById("reportMonth");
      const signature = getData().map(x => `${x.id || ""}|${x.data || ""}`).join(";");
      if (select && select.tagName === "SELECT" && signature !== lastSignature) {
        const current = select.value || "__ALL__";
        refreshReportPeriods(current);
        lastSignature = signature;
      }
      if (++attempts >= 300) clearInterval(timer);
    }, 200);
  });
})();

// Carrega a tela Sobre de forma isolada, sem alterar a lógica principal do aplicativo.
(function () {
  const script = document.createElement("script");
  script.src = "about.js";
  script.defer = true;
  document.head.appendChild(script);
})();
