/* Autenticação e cadastro — branch de revisão.
 * Este arquivo não altera a rotina de sincronização automática.
 * O e-mail é o identificador da conta no Supabase.
 */
(function(){
  function accountExistsResponse(data,error){
    const msg=String((error&&error.message)||"").toLowerCase();
    const code=String((error&&error.code)||"").toLowerCase();
    if(msg.includes("already registered")||msg.includes("already exists")||code.includes("already")||code.includes("exists"))return true;
    /* Com confirmação de e-mail habilitada, o Supabase pode retornar um
       usuário sem identidades para um e-mail já cadastrado, sem revelar
       diretamente a existência da conta. */
    return !!(data&&data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0&&!data.session);
  }

  window.syncLogin=async function(){
    await initCloud();
    const msg=document.getElementById("syncMsg");
    if(!syncConfigured()){msg.textContent="Configure primeiro o arquivo config.js.";return}
    const email=document.getElementById("syncEmail").value.trim();
    const password=document.getElementById("syncPassword").value;
    msg.textContent="";
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
    await syncNow(true);
    refreshSyncUI();
  };

  window.syncSignup=async function(){
    await initCloud();
    const msg=document.getElementById("syncMsg");
    if(!syncConfigured()){msg.textContent="Configure primeiro o arquivo config.js.";return}
    const email=document.getElementById("syncEmail").value.trim();
    const password=document.getElementById("syncPassword").value;
    msg.textContent="";
    if(!email||password.length<6){msg.textContent="Informe um e-mail e uma senha com pelo menos 6 caracteres.";return}
    setSyncState("busy");
    const {data,error}=await __supabase.auth.signUp({email,password});
    if(error||accountExistsResponse(data,error)){
      setSyncState("err");
      msg.textContent="Esta conta já está cadastrada ou não pôde ser criada. Se você já possui uma conta, use “Entrar”.";
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
