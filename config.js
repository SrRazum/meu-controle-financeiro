// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

/* V1.13 — filtro de relatórios.
   Mantém o aplicativo-base intacto e acrescenta somente a opção
   "Todos os períodos" e a atualização dinâmica dos meses disponíveis. */
(function () {
  const SWITCH_FLAG = "controle_financeiro_account_switch_pending";
  const SECURE_KEY = "controle_financeiro_secure_v1";

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
    if (button) { button.style.display = "block"; button.textContent = "Criar proteção neste dispositivo"; }
    if (second) { second.style.display = "block"; second.required = true; }
    if (cloudBtn) { cloudBtn.style.display = "block"; cloudBtn.textContent = "☁️ Entrar / trocar de conta"; }
    if (msg) msg.textContent = "Sessão encerrada. Os dados da conta anterior não estão visíveis.";
  }

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

    const desired = old === "__ALL__" ? "__ALL__" : old;
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

    select.value = months.includes(desired) || desired === "__ALL__" ? desired : "__ALL__";
  }

  function calculateAllPeriods() {
    const arr = getData();
    const ent = arr.filter(x => x.tipo === "entrada").reduce((s, x) => s + Number(x.valor || 0), 0);
    const sai = arr.filter(x => x.tipo === "saida").reduce((s, x) => s + Number(x.valor || 0), 0);
    const pend = arr.filter(x => x.status === "pendente").reduce((s, x) => s + Number(x.valor || 0), 0);
    const moneyFn = typeof brl === "function" ? brl : (v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    const cards = document.getElementById("reportCards");
    if (cards) cards.innerHTML = [["Entradas", ent, "green"], ["Saídas", sai, "red"], ["Resultado", ent - sai, ent - sai >= 0 ? "green" : "red"], ["Contas pendentes", pend, "orange"]]
      .map(x => `<div class="card"><div class="label">${x[0]}</div><div class="value ${x[2]}">${moneyFn(x[1])}</div></div>`).join("");

    const map = {};
    arr.forEach(x => {
      const k = x.categoria || "Sem categoria";
      map[k] ??= { e: 0, s: 0 };
      map[k][x.tipo === "entrada" ? "e" : "s"] += Number(x.valor || 0);
    });
    const body = document.getElementById("catBody");
    if (body) body.innerHTML = Object.entries(map)
      .map(([k, v]) => `<tr><td>${k}</td><td class="green">${moneyFn(v.e)}</td><td class="red">${moneyFn(v.s)}</td></tr>`)
      .join("") || '<tr><td colspan="3" class="empty">Sem dados registrados.</td></tr>';
  }

  function installReportFilter() {
    const input = document.getElementById("reportMonth");
    if (!input) return false;

    let select = input;
    if (input.tagName !== "SELECT") {
      select = document.createElement("select");
      select.id = "reportMonth";
      input.replaceWith(select);
    }
    select.dataset.allPeriodsReady = "1";

    refreshReportPeriods();

    const originalRender = window.render;
    if (typeof originalRender !== "function") return true;
    if (originalRender.__reportAllWrapped) return true;

    function renderWithAllPeriods() {
      const el = document.getElementById("reportMonth");
      const period = el ? el.value : "__ALL__";
      if (period !== "__ALL__") return originalRender();

      /* O render original exige um mês. Executamos somente para estruturar
         a tela e depois substituímos os totais pelos dados completos. */
      const current = new Date().toISOString().slice(0, 7);
      if (el) el.value = current;
      originalRender();
      if (el) el.value = "__ALL__";
      calculateAllPeriods();
    }

    renderWithAllPeriods.__reportAllWrapped = true;
    window.render = renderWithAllPeriods;
    select.onchange = function () { window.render(); };
    select.value = "__ALL__";
    window.render();
    return true;
  }

  function watchReportData() {
    let lastSignature = "";
    let attempts = 0;
    const timer = setInterval(function () {
      const select = document.getElementById("reportMonth");
      const data = getData();
      const signature = data.map(x => `${x.id || ""}|${x.data || ""}`).join(";");
      if (select && select.tagName === "SELECT" && signature !== lastSignature) {
        const current = select.value || "__ALL__";
        refreshReportPeriods(current);
        lastSignature = signature;
      }
      attempts++;
      if (attempts >= 300) clearInterval(timer);
    }, 200);
  }

  window.addEventListener("DOMContentLoaded", function () {
    setupSwitchScreen();

    const cloudBtn = document.getElementById("lockCloudBtn");
    if (cloudBtn && localStorage.getItem(SWITCH_FLAG) === "1") {
      cloudBtn.onclick = async function () {
        if (typeof window.openSyncModal === "function") await window.openSyncModal();
      };
    }

    const originalLogout = window.syncLogout;
    if (typeof originalLogout === "function" && !originalLogout.__safeSwitchWrapped) {
      async function safeLogout() {
        try { await originalLogout(); } catch (e) {}
        localStorage.removeItem(SECURE_KEY);
        localStorage.setItem(SWITCH_FLAG, "1");
        location.reload();
      }
      safeLogout.__safeSwitchWrapped = true;
      window.syncLogout = safeLogout;
    }

    installReportFilter();
    watchReportData();
  });
})();
