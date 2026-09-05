// Correção de inicialização e sincronização do Meu Controle Financeiro.
// Compatibiliza o estado lexical `unlocked` do index.html com window.unlocked,
// evitando o erro "unlocked is not defined" em versões/cache antigos.
(function(){
  function isAppUnlocked(){
    const screen=document.getElementById('lockScreen');
    return !!screen && screen.classList.contains('hidden');
  }

  function syncUnlockedFlag(){
    try{ window.unlocked=isAppUnlocked(); }catch(err){}
  }

  function forceProtectionScreen(){
    try{
      syncUnlockedFlag();
      const secure=!!localStorage.getItem('controle_financeiro_secure_v1');
      if(typeof window.showLock==='function') window.showLock(secure?'unlock':'setup');
      else document.getElementById('lockScreen')?.classList.remove('hidden');
      window.unlocked=false;
    }catch(err){ console.warn('Falha ao abrir proteção:',err); }
  }

  function patchSync(){
    try{
      if(typeof window.syncNow!=='function' || window.__syncNowPatched) return;
      const original=window.syncNow;
      window.syncNow=async function(manual){
        syncUnlockedFlag();
        if(manual && !window.unlocked){
          const msg=document.getElementById('syncMsg');
          if(msg) msg.textContent='Desbloqueie o aplicativo para concluir a sincronização.';
          forceProtectionScreen();
          return;
        }
        return original.apply(this,arguments);
      };
      window.__syncNowPatched=true;
    }catch(err){ console.warn('Patch de sincronização:',err); }
  }

  function patchLockState(){
    syncUnlockedFlag();
    // O index.html usa uma variável local (`let unlocked`) que não fica em
    // window. Observamos a tela de bloqueio para manter a API global usada
    // pelo config.js coerente com o estado visual real.
    const screen=document.getElementById('lockScreen');
    if(screen && !screen.__unlockObserver){
      const observer=new MutationObserver(syncUnlockedFlag);
      observer.observe(screen,{attributes:true,attributeFilter:['class']});
      screen.__unlockObserver=true;
    }
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
      patchLockState();
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
