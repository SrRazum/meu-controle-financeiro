// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key pode ser usada no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

// Fallback de login: o modal pode ser usado antes que o cliente Supabase
// termine de inicializar. Nesse caso a função original podia falhar sem
// apresentar uma mensagem ao usuário. Esta versão cria um cliente próprio,
// autentica e recarrega a página para a inicialização normal recuperar a sessão.
(function(){
  function install(){
    if(typeof window.syncLogin!=="function") return false;
    if(window.__syncLoginFallbackInstalled) return true;
    window.__syncLoginFallbackInstalled=true;
    window.syncLogin=async function(){
      const msg=document.getElementById("syncMsg");
      const emailEl=document.getElementById("syncEmail");
      const passEl=document.getElementById("syncPassword");
      const email=(emailEl?.value||"").trim();
      const password=passEl?.value||"";
      if(!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY){
        if(msg)msg.textContent="A sincronização não está configurada.";
        return;
      }
      if(!email||!password){
        if(msg)msg.textContent="Informe e-mail e senha.";
        return;
      }
      if(msg)msg.textContent="Entrando na conta...";
      try{
        const client=window.supabase?.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
        if(!client) throw new Error("O serviço de sincronização ainda não carregou. Aguarde alguns segundos e tente novamente.");
        const result=await client.auth.signInWithPassword({email,password});
        if(result.error) throw result.error;
        if(msg)msg.textContent="Login realizado. Carregando seus dados...";
        if(passEl)passEl.value="";
        setTimeout(()=>location.reload(),250);
      }catch(e){
        if(msg)msg.textContent=(e&&e.message)||"Não foi possível entrar. Verifique o e-mail, a senha e a conexão.";
      }
    };
    return true;
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer)},100);
  setTimeout(()=>clearInterval(timer),15000);
})();
