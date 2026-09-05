// Correção de inicialização do Meu Controle Financeiro.
// Garante que a tela de proteção seja inicializada mesmo se uma etapa
// secundária do aplicativo falhar durante o carregamento.
(function(){
  function boot(){
    try{
      const form=document.getElementById('unlockForm');
      const cloudBtn=document.getElementById('lockCloudBtn');
      if(!form) return;

      // Se o script principal foi carregado mas a inicialização não chegou
      // a registrar o formulário, tenta executá-la novamente.
      if(typeof window.initializeSecurity==='function' && typeof form.onsubmit!=='function'){
        window.initializeSecurity().catch(function(err){
          console.warn('Falha ao inicializar proteção:',err);
        });
      }

      // Em uma instalação nova, deixe explícita a opção de entrar na conta
      // existente sem obrigar o usuário a criar uma nova proteção.
      if(cloudBtn && typeof window.openSyncModal==='function'){
        cloudBtn.style.display='block';
      }
    }catch(err){
      console.warn('Boot de recuperação:',err);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  setTimeout(boot,800);
})();
