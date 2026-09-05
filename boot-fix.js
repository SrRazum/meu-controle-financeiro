// Correção de inicialização e fluxo de sincronização do Meu Controle Financeiro.
(function(){
  function forceRestoreOrUnlock(){
    try{
      const secure=!!localStorage.getItem('controle_financeiro_secure_v1');
      if(typeof window.showLock==='function') window.showLock(secure?'unlock':'setup');
      else document.getElementById('lockScreen')?.classList.remove('hidden');
    }catch(err){ console.warn('Falha ao abrir proteção:',err); }
  }

  function patchSync(){
    try{
      if(typeof window.syncNow!=='function' || window.__syncNowPatched) return;
      const original=window.syncNow;
      window.syncNow=async function(manual){
        // Se a conta já está autenticada, mas o aplicativo ainda está bloqueado,
        // não deixar o usuário preso no modal de sincronização.
        if(manual && !window.unlocked){
          const msg=document.getElementById('syncMsg');
          if(msg) msg.textContent='Desbloqueie o aplicativo para concluir a sincronização.';
          forceRestoreOrUnlock();
          return;
        }
        return original.apply(this,arguments);
      };
      window.__syncNowPatched=true;
    }catch(err){ console.warn('Patch de sincronização:',err); }
  }

  function boot(){
    try{
      const form=document.getElementById('unlockForm');
      const cloudBtn=document.getElementById('lockCloudBtn');
      if(form){
        if(typeof window.initializeSecurity==='function' && typeof form.onsubmit!=='function'){
          window.initializeSecurity().catch(function(err){ console.warn('Falha ao inicializar proteção:',err); });
        }
        if(cloudBtn){
          cloudBtn.style.display='block';
          cloudBtn.style.visibility='visible';
          cloudBtn.hidden=false;
        }
      }
      patchSync();
    }catch(err){ console.warn('Boot de recuperação:',err); }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  setTimeout(boot,300);
  setTimeout(boot,800);
  setTimeout(boot,1500);
  setTimeout(boot,2500);
})();
