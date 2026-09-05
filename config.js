// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key é apropriada para uso no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

// Fallback para versões parcialmente carregadas/em cache.
if (typeof window.unlocked === "undefined") window.unlocked = false;

/*
 * Bootstrap do Supabase e correção do login.
 * O login não chama a implementação antiga de syncLogin, pois ela depende
 * do binding lexical `unlocked` do index.html. Isso causava o erro
 * "unlocked is not defined" em versões parcialmente atualizadas do app.
 * Após autenticar, apenas verificamos se existem dados na nuvem e, havendo,
 * colocamos a tela de proteção no modo de restauração. A senha dos dados
 * continua sendo a senha de proteção do aplicativo, não a senha da conta.
 */
(function(){
  let booted=false;
  let wrapped=false;
  let attempts=0;

  function message(text){
    const el=document.getElementById("syncMsg");
    if(el) el.textContent=text;
  }

  async function bootCloud(){
    if(booted) return true;
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

  async function login(){
    if(!window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY){
      message("Configure primeiro o acesso ao serviço de sincronização.");
      return;
    }
    const email=(document.getElementById("syncEmail")?.value||"").trim();
    const password=document.getElementById("syncPassword")?.value||"";
    if(!email || !password){
      message("Informe e-mail e senha.");
      return;
    }

    message("Conectando ao serviço de sincronização...");
    const ok=await bootCloud();
    if(!ok){
      message("Não foi possível iniciar a sincronização. Atualize a página e tente novamente.");
      return;
    }

    try{
      // Usa o cliente já criado por initCloud, quando disponível.
      const client=window.__syncClient || null;
      let result;
      if(client){
        result=await client.auth.signInWithPassword({email,password});
      }else if(window.supabase && typeof window.supabase.createClient==="function"){
        const fallback=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
        result=await fallback.auth.signInWithPassword({email,password});
      }else{
        throw new Error("Cliente de autenticação indisponível.");
      }
      if(result.error) throw result.error;

      document.getElementById("syncPassword").value="";
      message("Conta conectada. Verificando os dados guardados na nuvem...");

      // Se a implementação principal estiver disponível, ela possui o cliente
      // lexical já autenticado. cloudFetchVault é usado apenas para decidir se
      // há dados a restaurar; não baixamos nem alteramos nada nesta etapa.
      let hasCloud=false;
      if(typeof window.cloudFetchVault==="function"){
        try{ hasCloud=!!(await window.cloudFetchVault()); }catch(e){ console.warn("Verificação da nuvem:",e); }
      }

      if(hasCloud && typeof window.setSecurityMode==="function"){
        window.setSecurityMode("restore");
        if(typeof window.closeSyncModal==="function") window.closeSyncModal();
        const lockMsg=document.getElementById("lockMsg");
        if(lockMsg) lockMsg.textContent="Conta conectada. Digite a senha de proteção usada neste aplicativo para restaurar os lançamentos.";
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
