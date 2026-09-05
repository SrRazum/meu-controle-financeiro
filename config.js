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
      // Usa um cliente próprio para garantir que a autenticação seja concluída
      // mesmo quando a versão do index.html em cache não expõe o cliente lexical.
      const client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
      const result=await client.auth.signInWithPassword({email,password});
      if(result.error) throw result.error;
      await client.auth.getSession();

      // Recria o cliente interno do aplicativo para que __syncReady e os
      // listeners de autenticação estejam alinhados com a sessão recém-criada.
      await window.initCloud();
      document.getElementById("syncPassword").value="";

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
