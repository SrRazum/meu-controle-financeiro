/* Autenticação e cadastro — branch de revisão.
 * Este arquivo não altera a rotina de sincronização automática.
 * O e-mail é o identificador da conta no Supabase.
 */
(function(){
  function accountExistsResponse(data,error){
    const msg=String((error&&error.message)||"").toLowerCase();
    const code=String((error&&error.code)||"").toLowerCase();
    if(msg.includes("already registered")||msg.includes("already exists")||code.includes("already")||code.includes("exists"))return true;
    return !!(data&&data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0&&!data.session);
  }

  function showLocalCloudConflict(){
    const title=document.getElementById("lockTitle");
    const desc=document.getElementById("lockDescription");
    const button=document.getElementById("unlockButton");
    const second=document.getElementById("unlockPassword2");
    const cloudBtn=document.getElementById("lockCloudBtn");
    const msg=document.getElementById("lockMsg");
    if(!title||!desc||!button||!cloudBtn||!msg)return;
    title.textContent="Dados locais encontrados";
    desc.textContent="Este navegador já possui dados protegidos por uma senha própria, e a conta conectada também possui dados na nuvem.";
    button.style.display="block";
    button.textContent="Manter dados deste dispositivo";
    if(second){second.style.display="none";second.required=false}
    cloudBtn.style.display="block";
    cloudBtn.textContent="☁️ Usar dados da nuvem neste dispositivo";
    cloudBtn.onclick=useCloudDataOnThisDevice;
    msg.style.color="#7a4b00";
    msg.textContent="Nada foi apagado. Escolha se deseja manter os dados locais ou carregar os dados da nuvem.";
  }

  async function useCloudDataOnThisDevice(){
    const msg=document.getElementById("lockMsg");
    const cloudBtn=document.getElementById("lockCloudBtn");
    const passwordInput=document.getElementById("unlockPassword");
    if(!__supabase){
      if(msg)msg.textContent="Entre na conta de sincronização antes de usar os dados da nuvem.";
      return;
    }
    const p=passwordInput?passwordInput.value:"";
    if(p.length<6){
      if(msg)msg.textContent="Digite a senha de proteção usada para os dados da nuvem no campo acima.";
      if(passwordInput)passwordInput.focus();
      return;
    }
    if(cloudBtn){cloudBtn.disabled=true;cloudBtn.textContent="☁️ Verificando dados da nuvem..."}
    if(msg){msg.style.color="#7a4b00";msg.textContent="Baixando e verificando os dados da conta..."}
    try{
      const raw=await cloudFetchVault();
      if(!raw)throw new Error("NO_CLOUD_DATA");
      const res=await decryptVault(p,raw);
      if(!res.ok){
        if(msg){msg.style.color="#991b1b";msg.textContent="A senha de proteção informada não abre os dados da nuvem. Nada foi alterado.";}
        return;
      }
      const localRaw=localStorage.getItem(SECURE_KEY);
      if(localRaw&&!localStorage.getItem("controle_financeiro_secure_conflict_backup_v1"))localStorage.setItem("controle_financeiro_secure_conflict_backup_v1",localRaw);
      window.__financePassword=p;
      data=Array.isArray(res.value)?res.value:[];
      const newBlob=await encryptData(p,data);
      localStorage.setItem(SECURE_KEY,JSON.stringify(newBlob));
      localStorage.removeItem("controle_financeiro_v1");
      unlocked=true;
      if(typeof hideLock==="function")hideLock();
      if(typeof render==="function")render();
      if(typeof resetInactivity==="function")resetInactivity();
      if(typeof refreshSyncUI==="function")refreshSyncUI();
    }catch(e){
      if(msg){msg.style.color="#991b1b";msg.textContent=e&&e.message==="NO_CLOUD_DATA"?"Não há dados na nuvem para carregar. Nada foi alterado.":"Não foi possível carregar os dados da nuvem agora. Nada foi alterado.";}
    }finally{
      if(cloudBtn){cloudBtn.disabled=false;cloudBtn.textContent="☁️ Usar dados da nuvem neste dispositivo"}
    }
  }

  window.syncLogin=async function(){
    await initCloud();
    const msg=document.getElementById("syncMsg");
    if(!syncConfigured()){msg.textContent="Configure primeiro o arquivo config.js.";return}
    const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
    msg.textContent="";
    if(!email||!password){msg.textContent="Informe e-mail e senha.";return}
    setSyncState("busy");
    const {error}=await __supabase.auth.signInWithPassword({email,password});
    if(error){setSyncState("err");msg.textContent="Não foi possível entrar. A conta pode não existir ou a senha está incorreta. Se ainda não criou a conta, use “Criar conta”.";return}
    setSyncState("ok");
    document.getElementById("syncPassword").value="";
    if(!unlocked){
      if(localStorage.getItem(SECURE_KEY)){
        let cloudHasData=false;
        try{const {row}=await cloudVaultRow("user_id,updated_at");cloudHasData=!!row}catch(e){}
        setSecurityMode("unlock");
        refreshSyncUI();
        closeSyncModal();
        if(cloudHasData)showLocalCloudConflict();
        else msg.textContent="Conta conectada. Este dispositivo já possui dados locais. Desbloqueie-o com a senha de proteção deste navegador para continuar.";
        return;
      }
      const offered=await maybeOfferCloudRestore();
      if(offered){msg.textContent="Conta conectada. Informe a senha de proteção na tela inicial para baixar os lançamentos.";setSecurityMode("restore");}
      else{setSecurityMode("setup");msg.textContent="Conta conectada. Crie a proteção deste dispositivo para começar com os dados desta conta.";}
      refreshSyncUI();closeSyncModal();return;
    }
    msg.textContent="Conta conectada. Sincronizando...";
    await syncNow(true);refreshSyncUI();
  };

  window.syncSignup=async function(){
    await initCloud();
    const msg=document.getElementById("syncMsg");
    if(!syncConfigured()){msg.textContent="Configure primeiro o arquivo config.js.";return}
    const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
    msg.textContent="";
    if(!email||password.length<6){msg.textContent="Informe um e-mail e uma senha com pelo menos 6 caracteres.";return}
    setSyncState("busy");
    const {data,error}=await __supabase.auth.signUp({email,password});
    if(error||accountExistsResponse(data,error)){setSyncState("err");msg.textContent="Esta conta já está cadastrada ou não pôde ser criada. Se você já possui uma conta, use “Entrar”.";return}
    setSyncState("ok");document.getElementById("syncPassword").value="";
    if(data.session){msg.textContent="Conta criada. Seus dados locais serão preservados e sincronizados agora.";await syncNow(true);}
    else msg.textContent="Conta criada. Verifique o e-mail de confirmação. Seus dados locais permanecem neste dispositivo e serão sincronizados depois que você entrar.";
    refreshSyncUI();
  };
})();
