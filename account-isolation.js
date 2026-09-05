/* V1.13 TESTE — isolamento de contas no mesmo navegador. */
(()=>{
  const ACCOUNT_KEY="controle_financeiro_account_v1";
  let switching=false;
  let pendingAccountId="";
  const setMsg=t=>{const e=document.getElementById("syncMsg");if(e)e.textContent=t||""};
  const currentBound=()=>localStorage.getItem(ACCOUNT_KEY)||"";
  const bind=id=>{if(id)localStorage.setItem(ACCOUNT_KEY,id)};
  const clearRuntime=()=>{
    try{data=[];}catch(e){}
    try{window.__financePassword=null;}catch(e){}
    try{unlocked=false;}catch(e){}
    try{clearTimeout(inactivityTimer);}catch(e){}
  };
  const lockForSwitch=()=>{
    clearRuntime();
    try{showLock("unlock");}catch(e){}
  };

  async function safeLogin(){
    await initCloud();
    if(!syncConfigured()){setMsg("Configure primeiro o arquivo config.js.");return}
    const email=document.getElementById("syncEmail").value.trim();
    const password=document.getElementById("syncPassword").value;
    if(!email||!password){setMsg("Informe e-mail e senha.");return}
    if(switching)return;
    switching=true;setSyncState("busy");setMsg("");
    try{
      const {data:auth,error}=await __supabase.auth.signInWithPassword({email,password});
      if(error||!auth?.user)throw new Error("LOGIN");
      const user=auth.user;
      const bound=currentBound();
      const {row}=await cloudVaultRow("payload,updated_at");
      document.getElementById("syncPassword").value="";

      /* Conta diferente: nunca envia o cofre local para a nova conta. */
      if(bound && bound!==user.id){
        pendingAccountId=user.id;
        clearRuntime();
        if(row){
          setSecurityMode("restore");
          showLock("restore");
          setRecoverVisible(false);
          setSyncState("ok");
          setMsg("");
          closeSyncModal();
          refreshSyncUI();
          return;
        }
        setSyncState("ok");
        setSecurityMode("unlock");
        showLock("unlock");
        document.getElementById("lockMsg").textContent="Esta conta ainda não possui dados na nuvem. Nenhum dado local foi enviado para ela, para evitar mistura entre contas.";
        refreshSyncUI();
        closeSyncModal();
        return;
      }

      /* Primeiro vínculo: uma conta que já possui cofre remoto deve ser
         restaurada explicitamente; nunca recebe automaticamente os dados locais. */
      if(!bound){
        if(row){
          pendingAccountId=user.id;
          clearRuntime();
          setSecurityMode("restore");
          showLock("restore");
          setRecoverVisible(false);
          setSyncState("ok");
          setMsg("");
          closeSyncModal();
          refreshSyncUI();
          return;
        }
        bind(user.id);
      }

      setSyncState("ok");
      if(!unlocked){
        const offered=await maybeOfferCloudRestore();
        setMsg(offered
          ?"Conta conectada. Informe a senha de proteção para baixar os lançamentos."
          :"Conta conectada. Desbloqueie o aplicativo para sincronizar.");
        refreshSyncUI();
        if(offered)closeSyncModal();
        return;
      }
      await syncNow(true);
      refreshSyncUI();
    }catch(e){
      setSyncState("err");
      setMsg(e?.message==="LOGIN"?"Não foi possível entrar. Verifique os dados da conta.":"Não foi possível conectar à conta agora.");
    }finally{switching=false}
  }

  async function safeLogout(){
    if(!__supabase)return;
    try{await __supabase.auth.signOut();}
    finally{
      __syncReady=false;__cloudMismatch=false;setRecoverVisible(false);setSyncState("");
      pendingAccountId="";
      clearRuntime();
      try{showLock("unlock");}catch(e){}
      const m=document.getElementById("lockMsg");if(m)m.textContent="Você saiu da conta. Entre novamente para acessar os dados da conta correspondente.";
      refreshSyncUI();
    }
  }

  /* O fluxo original de restauração já faz a criptografia e só grava após
     validar a senha. Aqui apenas vinculamos o cofre local à conta restaurada
     depois que a restauração realmente desbloquear o aplicativo. */
  const form=document.getElementById("unlockForm");
  if(form&&typeof form.onsubmit==="function"){
    const originalSubmit=form.onsubmit;
    form.onsubmit=async e=>{
      const wasLocked=!unlocked;
      await originalSubmit(e);
      if(wasLocked&&unlocked&&pendingAccountId){bind(pendingAccountId);pendingAccountId="";}
    };
  }

  window.syncLogin=safeLogin;
  window.syncLogout=safeLogout;
})();
