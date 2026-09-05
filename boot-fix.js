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

      // A opção de entrar na conta existente precisa ficar visível mesmo
      // quando a inicialização secundária do aplicativo falhar.
      if(cloudBtn){
        cloudBtn.style.display='block';
        cloudBtn.style.visibility='visible';
        cloudBtn.hidden=false;
      }
    }catch(err){
      console.warn('Boot de recuperação:',err);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  setTimeout(boot,800);
  setTimeout(boot,2000);
})();
