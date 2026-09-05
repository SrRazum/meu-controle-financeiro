// Correção de inicialização e sincronização do Meu Controle Financeiro.
// Mantém o estado de restauração separado do estado de desbloqueio local.
(function(){
  function isRestoreMode(){
    return window.__restoreFromCloud === true || window.__securityMode === 'restore';
  }

  function isAppUnlocked(){
    const screen=document.getElementById('lockScreen');
    return !!screen && screen.classList.contains('hidden');
  }

  function syncUnlockedFlag(){
    try{ window.unlocked=isAppUnlocked(); }catch(err){}
  }

  function forceProtectionScreen(){
    // Durante a restauração da nuvem, NÃO podemos chamar showLock('setup') ou
    // initializeSecurity(): isso substitui "Restaurar dados" por "Criar proteção"
    // e inicia novamente o loop.
    if(isRestoreMode()) return;
    try{
      syncUnlockedFlag();
      const secure=!!localStorage.getItem('controle_financeiro_secure_v1');
      if(typeof window.showLock==='function') window.showLock(secure?'unlock':'setup');
      else document.getElementById('lockScreen')?.classList.remove('hidden');
      window.unlocked=false;
    }catch(err){ console.warn('Falha ao abrir proteção:',err); }
  }

  function patchRestoreForm(){
    const form=document.getElementById('unlockForm');
    if(!form || form.__restoreHandlerInstalled) return;

    // Captura o submit antes do onsubmit criado por initializeSecurity().
    // Assim, quando a tela estiver em modo restore, o handler de criação de
    // proteção nunca poderá sobrescrever o fluxo.
    form.addEventListener('submit', async function(event){
      if(!isRestoreMode()) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const password=(document.getElementById('unlockPassword')?.value || '');
      const msg=document.getElementById('lockMsg');
      if(!password){
        if(msg) msg.textContent='Informe a senha de proteção usada nos dados da nuvem.';
        return;
      }

      const recoverInput=document.getElementById('syncRecoverPassword');
      if(recoverInput) recoverInput.value=password;

      if(typeof window.recoverCloudVault!=='function'){
        if(msg) msg.textContent='A rotina de restauração ainda não foi carregada. Atualize a página e tente novamente.';
        return;
      }

      if(msg) msg.textContent='Descriptografando e restaurando os dados da nuvem...';
      try{
        const result=await window.recoverCloudVault();
        // A rotina de recuperação é a responsável por criar/restaurar o cofre
        // local. Só saímos do modo restore depois que ela terminar sem erro.
        if(result !== false){
          window.__restoreFromCloud=false;
          window.__securityMode=null;
          syncUnlockedFlag();
        }
      }catch(err){
        console.error('Erro ao restaurar dados da nuvem:',err);
        if(msg) msg.textContent=err?.message || 'Não foi possível restaurar os dados da nuvem.';
      }
    }, true);

    form.__restoreHandlerInstalled=true;
  }

  function patchSync(){
    try{
      if(typeof window.syncNow!=='function' || window.__syncNowPatched) return;
      const original=window.syncNow;
      window.syncNow=async function(manual){
        syncUnlockedFlag();
        if(manual && !window.unlocked){
          // Em modo restore, a ação correta é a restauração pelo formulário;
          // nunca redirecionar para a criação de uma nova proteção.
          if(isRestoreMode()) return;
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
    const screen=document.getElementById('lockScreen');
    if(screen && !screen.__unlockObserver){
      const observer=new MutationObserver(function(){
        syncUnlockedFlag();
        patchRestoreForm();
      });
      observer.observe(screen,{attributes:true,attributeFilter:['class']});
      screen.__unlockObserver=true;
    }
  }

  function boot(){
    try{
      const form=document.getElementById('unlockForm');
      const cloudBtn=document.getElementById('lockCloudBtn');
      if(form){
        patchRestoreForm();

        // A inicialização normal só pode ocorrer quando não estamos restaurando.
        // Se o usuário acabou de autenticar na nuvem, nunca recrie a proteção.
        if(!isRestoreMode() && typeof window.initializeSecurity==='function' && typeof form.onsubmit!=='function'){
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
  setInterval(function(){
    patchRestoreForm();
    patchSync();
  },500);
})();
