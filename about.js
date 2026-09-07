/* Tela Sobre — somente apresentação, sem alterar as funcionalidades do aplicativo. */
window.addEventListener("DOMContentLoaded", function () {
  const style = document.createElement("style");
  style.textContent = `
    .about-btn{background:transparent;color:#fff;border:1px solid #ffffff44;padding:7px 10px;font-size:12px}
    #aboutModal{position:fixed;inset:0;background:#0008;z-index:120;display:none;align-items:center;justify-content:center;padding:18px}
    #aboutModal.show{display:flex}
    .about-box{width:min(500px,100%);background:#fff;border-radius:16px;padding:24px;box-shadow:0 18px 60px #0004;text-align:center}
    .about-logo{width:76px;height:76px;object-fit:contain;border-radius:50%;margin-bottom:10px}
    .about-box h2{margin:4px 0 2px;color:#6d2b22}
    .about-version{font-weight:700;color:#d85a2b;margin-bottom:18px}
    .about-box p{font-size:13px;color:#76685f;line-height:1.5;margin:7px 0}
    .about-credits{margin:16px 0;padding:12px;border:1px solid #ead9ca;border-radius:10px;background:#fffaf5;text-align:left}
    .about-credits strong{color:#4a211d}
  `;
  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.id = "aboutModal";
  modal.innerHTML = `
    <div class="about-box">
      <img class="about-logo" src="logo.png" alt="Logo Meu Controle Financeiro">
      <h2>Meu Controle Financeiro</h2>
      <div class="about-version">V1.13</div>
      <p><strong>Proprietário / Desenvolvedor</strong><br>SrRazum</p>
      <p>© 2026 SrRazum. Todos os direitos reservados.</p>
      <div class="about-credits">
        <strong>Tecnologias e serviços</strong>
        <p>HTML5, CSS3 e JavaScript — estrutura, apresentação e lógica da aplicação.</p>
        <p>Web Crypto API — criptografia dos dados armazenados localmente.</p>
        <p>Supabase — autenticação, armazenamento e sincronização dos dados.</p>
        <p>Progressive Web App (PWA) / Service Worker — instalação e funcionamento como aplicativo web.</p>
        <p>GitHub Pages — hospedagem da aplicação.</p>
        <p>Supabase JavaScript Client — comunicação com o serviço Supabase.</p>
      </div>
      <button class="primary" type="button" id="aboutClose">Fechar</button>
    </div>`;
  document.body.appendChild(modal);

  function openAbout(){ modal.classList.add("show"); }
  function closeAbout(){ modal.classList.remove("show"); }
  window.openAbout = openAbout;
  window.closeAbout = closeAbout;
  modal.querySelector("#aboutClose").addEventListener("click", closeAbout);
  modal.addEventListener("click", function(e){ if(e.target === modal) closeAbout(); });

  const headerControls = document.querySelector("header .topbar > div:last-child");
  if (headerControls) {
    const btn = document.createElement("button");
    btn.className = "about-btn";
    btn.type = "button";
    btn.textContent = "ℹ️ Sobre";
    btn.addEventListener("click", openAbout);
    headerControls.insertBefore(btn, headerControls.firstChild);
  }
});

/*
 * Revisão de autenticação — branch de teste.
 * Mantém a sincronização automática intacta e corrige somente a comunicação
 * dos fluxos Entrar/Criar conta. O e-mail continua sendo o identificador da
 * conta; contas duplicadas não são criadas pelo Auth do Supabase.
 */
(function(){
  function accountExistsResponse(data,error){
    const msg=String((error&&error.message)||"").toLowerCase();
    const code=String((error&&error.code)||"").toLowerCase();
    if(msg.includes("already registered")||msg.includes("already exists")||code.includes("already")||code.includes("exists"))return true;
    /* Com confirmação de e-mail habilitada, o Supabase pode devolver um
       usuário ofuscado para um e-mail já cadastrado. Um novo cadastro
       normalmente possui a identidade de e-mail; identities vazias indicam
       a resposta ofuscada descrita pela API. */
    return !!(data&&data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0&&!data.session);
  }

  window.syncLogin=async function(){
    await initCloud();
    if(!syncConfigured()){document.getElementById("syncMsg").textContent="Configure primeiro o arquivo config.js.";return}
    const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
    const msg=document.getElementById("syncMsg");msg.textContent="";
    if(!email||!password){msg.textContent="Informe e-mail e senha.";return}
    setSyncState("busy");
    const {error}=await __supabase.auth.signInWithPassword({email,password});
    if(error){
      setSyncState("err");
      msg.textContent="Não foi possível entrar. A conta pode não existir ou a senha está incorreta. Se ainda não criou a conta, use “Criar conta”.";
      return;
    }
    setSyncState("ok");
    document.getElementById("syncPassword").value="";
    if(!unlocked){
      if(localStorage.getItem(SECURE_KEY)){
        setSecurityMode("unlock");
        msg.textContent="Conta conectada. Desbloqueie o aplicativo com sua senha de proteção para continuar.";
        refreshSyncUI();
        closeSyncModal();
        return;
      }
      const offered=await maybeOfferCloudRestore();
      if(offered){
        msg.textContent="Conta conectada. Informe a senha de proteção na tela inicial para baixar os lançamentos.";
        setSecurityMode("restore");
      }else{
        setSecurityMode("setup");
        msg.textContent="Conta conectada. Crie a proteção deste dispositivo para começar com os dados desta conta.";
      }
      refreshSyncUI();
      closeSyncModal();
      return;
    }
    msg.textContent="Conta conectada. Sincronizando...";
    await syncNow(true);refreshSyncUI();
  };

  window.syncSignup=async function(){
    await initCloud();
    if(!syncConfigured()){document.getElementById("syncMsg").textContent="Configure primeiro o arquivo config.js.";return}
    const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
    const msg=document.getElementById("syncMsg");msg.textContent="";
    if(!email||password.length<6){msg.textContent="Informe um e-mail e uma senha com pelo menos 6 caracteres.";return}
    setSyncState("busy");
    const {data,error}=await __supabase.auth.signUp({email,password});
    if(error||accountExistsResponse(data,error)){
      setSyncState("err");
      msg.textContent="Esta conta já está cadastrada. Use “Entrar” para acessar e sincronizar seus dados.";
      return;
    }
    setSyncState("ok");
    document.getElementById("syncPassword").value="";
    if(data.session){
      msg.textContent="Conta criada. Seus dados locais serão preservados e sincronizados agora.";
      await syncNow(true);
    }else{
      msg.textContent="Conta criada. Verifique o e-mail de confirmação. Seus dados locais permanecem neste dispositivo e serão sincronizados depois que você entrar.";
    }
    refreshSyncUI();
  };
})();