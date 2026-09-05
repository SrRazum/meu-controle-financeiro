// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

/* V1.13 — troca de conta e filtro de relatórios.
   O mecanismo de autenticação/proteção abaixo é mantido como no estado validado.
   A extensão do Relatórios é independente da autenticação. */
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

  function setupReportPeriodFilter() {
    const input = document.getElementById("reportMonth");
    if (!input || input.dataset.allPeriodsReady === "1") return;

    const select = document.createElement("select");
    select.id = "reportMonth";
    select.dataset.allPeriodsReady = "1";

    const all = document.createElement("option");
    all.value = "__ALL__";
    all.textContent = "Todos os períodos";
    select.appendChild(all);

    const months = [...new Set((typeof activeData === "function" ? activeData() : []).map(x => x.data?.slice(0,7)).filter(Boolean))].sort().reverse();
    months.forEach(v => {
      const [y, mo] = v.split("-");
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = new Intl.DateTimeFormat("pt-BR", {month:"long", year:"numeric"}).format(new Date(Number(y), Number(mo)-1, 1));
      select.appendChild(opt);
    });

    input.replaceWith(select);

    const originalRender = window.render;
    if (typeof originalRender !== "function" || originalRender.__reportAllWrapped) return;

    function renderWithAllPeriods() {
      const el = document.getElementById("reportMonth");
      const period = el ? el.value : "__ALL__";
      if (period !== "__ALL__") {
        return originalRender();
      }

      /* O render original exige um mês. Damos a ele o mês atual apenas
         durante sua execução e depois substituímos os números pelo cálculo
         de todos os períodos. Nenhuma rotina de autenticação é tocada. */
      const current = new Date().toISOString().slice(0,7);
      if (el) el.value = current;
      originalRender();
      if (el) el.value = "__ALL__";

      const arr = typeof activeData === "function" ? activeData() : [];
      const ent = arr.filter(x=>x.tipo==="entrada").reduce((s,x)=>s + Number(x.valor||0),0);
      const sai = arr.filter(x=>x.tipo==="saida").reduce((s,x)=>s + Number(x.valor||0),0);
      const pend = arr.filter(x=>x.status==="pendente").reduce((s,x)=>s + Number(x.valor||0),0);
      const moneyFn = typeof brl === "function" ? brl : (v => Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}));
      const cards = document.getElementById("reportCards");
      if (cards) cards.innerHTML = [["Entradas",ent,"green"],["Saídas",sai,"red"],["Resultado",ent-sai,ent-sai>=0?"green":"red"],["Contas pendentes",pend,"orange"]].map(x=>`<div class="card"><div class="label">${x[0]}</div><div class="value ${x[2]}">${moneyFn(x[1])}</div></div>`).join("");
      const map={};
      arr.forEach(x=>{const k=x.categoria||"Sem categoria";map[k]??={e:0,s:0};map[k][x.tipo==="entrada"?"e":"s"]+=Number(x.valor||0)});
      const body=document.getElementById("catBody");
      if (body) body.innerHTML=Object.entries(map).map(([k,v])=>`<tr><td>${k}</td><td class="green">${moneyFn(v.e)}</td><td class="red">${moneyFn(v.s)}</td></tr>`).join("")||'<tr><td colspan="3" class="empty">Sem dados registrados.</td></tr>';
    }
    renderWithAllPeriods.__reportAllWrapped = true;
    window.render = renderWithAllPeriods;
    select.onchange = window.render;

    /* O estado inicial solicitado para o relatório é sem filtro. */
    select.value = "__ALL__";
    window.render();
  }

  window.addEventListener("DOMContentLoaded", function () {
    setupSwitchScreen();

    const originalOpenSync = window.openSyncModal;
    const cloudBtn = document.getElementById("lockCloudBtn");
    if (cloudBtn && localStorage.getItem(SWITCH_FLAG) === "1") {
      cloudBtn.onclick = async function () {
        if (typeof originalOpenSync === "function") await originalOpenSync();
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

    setupReportPeriodFilter();
  });
})();
