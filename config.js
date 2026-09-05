// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key é apropriada para uso no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

// Fallback para versões parcialmente carregadas/em cache.
if (typeof window.unlocked === "undefined") window.unlocked = false;

(function(){
  let booted=false;
  let wrapped=false;
  let attempts=0;

  function message(text){
    const el=document.getElementById("syncMsg");
    if(el) el.textContent=text;
  }

  async function bootCloud(){
    if(!window.supabase || typeof window.supabase.createClient!=="function") return false;
    if(typeof window.initCloud!=="function") return false;
    try{
      await window.initCloud();
      booted=true;
      return true;
    }catch(e){
      console.warn("Falha ao inicializar o Supabase:",e);
      return false;
    }
  }

  // Depois do login, verifica diretamente a existência do cofre da conta.
  // Não usa cloudFetchVault(), pois essa rotina depende da senha de proteção
  // local e pode retornar vazio antes de o usuário informar essa senha.
  async function cloudVaultExists(client){
    try{
      const { data, error } = await client
        .from("finance_vault")
        .select("*")
        .limit(1);
      if(error){
        console.warn("Não foi possível consultar finance_vault:",error);
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    }catch(e){
      console.warn("Falha na consulta do cofre:",e);
      return false;
    }
  }

  function enterRestoreMode(){
    // Caminho normal: usa a rotina de segurança do aplicativo.
    if(typeof window.setSecurityMode==="function"){
      try{
        window.setSecurityMode("restore");
      }catch(e){
        console.warn("setSecurityMode falhou:",e);
      }
    }

    // Fallback visual para versões parcialmente carregadas.
    const title=document.getElementById("lockTitle");
    const description=document.getElementById("lockDescription");
    const button=document.getElementById("unlockButton");
    const confirm=document.getElementById("unlockPassword2");
    const cloudBtn=document.getElementById("lockCloudBtn");
    const msg=document.getElementById("lockMsg");
    const form=document.getElementById("unlockForm");

    if(title) title.textContent="Restaurar dados da nuvem";
    if(description) description.textContent="Digite a senha de proteção usada anteriormente neste aplicativo para descriptografar e restaurar seus lançamentos.";
    if(button) button.textContent="Restaurar dados";
    if(confirm){confirm.style.display="none";confirm.required=false;}
    if(cloudBtn) cloudBtn.style.display="none";
    if(msg) msg.textContent="Conta conectada. Digite a senha de proteção usada para os dados da nuvem.";

    // Marca explicitamente o modo de restauração para as versões em que o
    // código principal usa essa variável na submissão do formulário.
    window.__securityMode="restore";
    window.__restoreFromCloud=true;

    // IMPORTANTE: não chamar initializeSecurity() aqui.
    // Essa função recria o formulário e, quando não existe uma senha local,
    // executa showLock("setup"), sobrescrevendo o modo restore e causando o
    // loop: Sincronização -> Restaurar dados -> Criar proteção.
    // O handler do formulário já é instalado pela inicialização normal do app
    // e setSecurityMode("restore") acima é suficiente para direcioná-lo.
    if(form) form.reset;
  }

  async function login(){
    const email=(document.getElementById("syncEmail")?.value||"").trim();
    const password=document.getElementById("syncPassword")?.value||"";
    if(!email || !password){ message("Informe e-mail e senha."); return; }
    message("Conectando ao serviço de sincronização...");

    if(!await bootCloud()){
      message("Não foi possível iniciar a sincronização. Atualize a página e tente novamente.");
      return;
    }

    try{
      // Cliente dedicado para garantir que a autenticação ocorra mesmo quando
      // uma versão anterior do index.html estiver parcialmente em cache.
      const client=window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_PUBLISHABLE_KEY,
        {auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}
      );
      const result=await client.auth.signInWithPassword({email,password});
      if(result.error) throw result.error;
      const sessionResult=await client.auth.getSession();
      if(sessionResult.error || !sessionResult.data?.session) throw new Error("A autenticação foi concluída, mas a sessão não foi estabelecida.");

      // Deixa o cliente autenticado disponível para o restante do aplicativo.
      window.__syncClient=client;
      await window.initCloud();
      document.getElementById("syncPassword").value="";

      message("Conta conectada. Verificando os lançamentos guardados na nuvem...");
      const hasCloud=await cloudVaultExists(client);

      if(hasCloud){
        enterRestoreMode();
        if(typeof window.closeSyncModal==="function") window.closeSyncModal();
      }else{
        message("Conta conectada. Nenhum lançamento foi encontrado na nuvem para esta conta.");
        if(typeof window.refreshSyncUI==="function") window.refreshSyncUI();
      }
    }catch(e){
      console.error("Erro no login da sincronização:",e);
      message(e&&e.message ? e.message : "Não foi possível entrar. Verifique os dados da conta.");
    }
  }

  function wrapLogin(){
    if(wrapped || typeof window.syncLogin!=="function") return false;
    window.syncLogin=login;
    wrapped=true;
    return true;
  }

  function tick(){
    attempts++;
    if(!booted && window.supabase && typeof window.initCloud==="function") bootCloud();
    wrapLogin();
    if((!booted || !wrapped) && attempts<200) setTimeout(tick,100);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",tick,{once:true});
  else tick();
})();
