// Configuração do Supabase para o Meu Controle Financeiro.
// A Publishable key é apropriada para uso no navegador; mantenha RLS habilitado no banco.
window.SUPABASE_URL = "https://prrgajnjkknstsaokgwy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8baHLkc8XLw8x0TDHBXe6Q_yZf6Std9";

/*
 * Correção de inicialização da sincronização.
 *
 * O index.html carrega o config.js ANTES da biblioteca supabase-js e chama
 * initCloud() no final do documento. Se a biblioteca ainda não estiver
 * disponível naquele instante, a primeira inicialização falha e __supabase
 * permanece nulo. O botão "Entrar", por sua vez, tentava usar esse cliente
 * nulo e o clique terminava sem mensagem útil.
 *
 * Este bootstrap espera a biblioteca e o initCloud do aplicativo ficarem
 * disponíveis, executa a inicialização novamente e só então envolve o login.
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

  function wrapLogin(){
    if(wrapped || typeof window.syncLogin!=="function") return false;
    const original=window.syncLogin;
    window.syncLogin=async function(){
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
        await original();
      }catch(e){
        console.error("Erro no login da sincronização:",e);
        message(e&&e.message ? e.message : "Não foi possível entrar. Verifique os dados da conta.");
      }
    };
    wrapped=true;
    return true;
  }

  function tick(){
    attempts++;
    if(!booted && window.supabase && typeof window.initCloud==="function") bootCloud();
    wrapLogin();
    if((!booted || !wrapped) && attempts<200) setTimeout(tick,100);
    else if(!booted && attempts>=200) console.warn("Supabase não ficou disponível após 20 segundos.");
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",tick,{once:true});
  }else{
    tick();
  }
})();
