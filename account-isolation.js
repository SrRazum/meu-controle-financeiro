/* V1.13 TESTE — isolamento seguro de contas no mesmo navegador. */
(()=>{
  const SECURE_KEY="controle_financeiro_secure_v1";
  const ACCOUNT_KEY="controle_financeiro_account_v1";
  const vaultKey=id=>id?`${SECURE_KEY}__account__${id}`:"";
  let switching=false;
  let pendingAccountId="";
  const msg=t=>{const e=document.getElementById("syncMsg");if(e)e.textContent=t||""};
  const lockMsg=t=>{const e=document.getElementById("lockMsg");if(e)e.textContent=t||""};
  const bound=()=>localStorage.getItem(ACCOUNT_KEY)||"";
  const bind=id=>{if(id)localStorage.setItem(ACCOUNT_KEY,id)};
  function preserveCurrentVault(id){const raw=localStorage.getItem(SECURE_KEY);if(id&&raw)localStorage.setItem(vaultKey(id),raw)}
  function loadVaultFor(id){const raw=id&&localStorage.getItem(vaultKey(id));if(!raw)return false;localStorage.setItem(SECURE_KEY,raw);return true}
  function hideCurrentVault(){localStorage.removeItem(SECURE_KEY)}
  function clearRuntime(){try{data=[]}catch(e){}try{window.__financePassword=null}catch(e){}try{unlocked=false}catch(e){}try{clearTimeout(inactivityTimer)}catch(e){}}
  async function identifyInitialAccount(){try{await initCloud();if(!__supabase||!__syncReady)return;const {data:r}=await __supabase.auth.getUser();if(r?.user){const id=r.user.id;if(!bound())bind(id);if(!localStorage.getItem(vaultKey(id))&&localStorage.getItem(SECURE_KEY))preserveCurrentVault(id)}}catch(e){}}
  async function safeLogin(){
    await initCloud();if(!syncConfigured()){msg("Configure primeiro o arquivo config.js.");return}
    const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
    if(!email||!password){msg("Informe e-mail e senha.");return}if(switching)return;
    switching=true;setSyncState("busy");msg("");
    try{
      const {data:auth,error}=await __supabase.auth.signInWithPassword({email,password});if(error||!auth?.user)throw new Error("LOGIN");
      const user=auth.user,oldId=bound(),newId=user.id;
      if(oldId&&oldId!==newId)preserveCurrentVault(oldId);
      const {row}=await cloudVaultRow("payload,updated_at");document.getElementById("syncPassword").value="";
      if(oldId!==newId){
        pendingAccountId=newId;clearRuntime();hideCurrentVault();
        if(row){setSecurityMode("restore");showLock("restore");lockMsg("Esta conta possui dados na nuvem. Informe a senha de proteção dessa conta para restaurá-los neste dispositivo.");}
        else{setSecurityMode("setup");showLock("setup");lockMsg("Esta conta ainda não possui dados neste dispositivo. Crie a proteção desta conta para começar.");}
        setSyncState("ok");refreshSyncUI();closeSyncModal();return;
      }
      bind(newId);loadVaultFor(newId);setSyncState("ok");
      if(!unlocked){const offered=await maybeOfferCloudRestore();msg(offered?"Conta conectada. Informe a senha de proteção para baixar os lançamentos.":"Conta conectada. Desbloqueie o aplicativo para sincronizar.");refreshSyncUI();if(offered)closeSyncModal();return}
      await syncNow(true);refreshSyncUI();
    }catch(e){setSyncState("err");msg(e?.message==="LOGIN"?"Não foi possível entrar. Verifique os dados da conta.":"Não foi possível conectar à conta agora.");}
    finally{switching=false}
  }
  async function safeLogout(){
    if(!__supabase)return;
    try{const {data:r}=await __supabase.auth.getUser();const id=r?.user?.id||bound();if(id)preserveCurrentVault(id);await __supabase.auth.signOut()}
    finally{__syncReady=false;__cloudMismatch=false;setRecoverVisible(false);setSyncState("");pendingAccountId="";clearRuntime();hideCurrentVault();showLock("unlock");lockMsg("Você saiu da conta. Entre novamente para acessar os dados da conta correspondente.");refreshSyncUI()}
  }
  const form=document.getElementById("unlockForm");
  if(form&&typeof form.onsubmit==="function"){const original=form.onsubmit;form.onsubmit=async e=>{const before=unlocked;await original(e);if(!before&&unlocked&&pendingAccountId){bind(pendingAccountId);const active=pendingAccountId;pendingAccountId="";preserveCurrentVault(active)}}}
  window.syncLogin=safeLogin;window.syncLogout=safeLogout;identifyInitialAccount();
})();
