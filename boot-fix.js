// Correção de compatibilidade para inicialização e sincronização.
//
// IMPORTANTE: o fluxo de restauração da nuvem já é implementado por
// initializeSecurity() no index.html. Este arquivo NÃO deve interceptar o
// submit de unlockForm, pois isso impede que o estado lexical "unlocked"
// seja atualizado e causa o ciclo Restaurar -> Criar proteção -> Restaurar.
//
// Também evitamos chamadas assíncronas do Supabase dentro de
// onAuthStateChange(). O Supabase recomenda que o callback de autenticação
// não faça chamadas assíncronas adicionais, pois isso pode causar deadlock.
(function(){
  function patchRefreshSyncUI(){
    try{
      if(typeof window.refreshSyncUI !== 'function' || window.__refreshSyncUIPatched) return;
      window.__refreshSyncUIPatched = true;

      window.refreshSyncUI = function(){
        const logged=document.getElementById('syncLogged');
        const intro=document.getElementById('syncIntro');
        const user=document.getElementById('syncUser');
        if(!logged) return;

        // NÃO chamar auth.getUser() aqui. Esta função também é chamada pelo
        // callback de onAuthStateChange e uma chamada Supabase dentro desse
        // callback pode bloquear a fila interna de autenticação.
        const ready=!!window.__syncReady;
        if(ready){
          logged.style.display='block';
          const email=(document.getElementById('syncEmail')?.value || '').trim();
          if(user) user.textContent='Conta conectada'+(email?': '+email:'');
          if(intro) intro.textContent='Sua conta está conectada. Os lançamentos podem ser sincronizados entre seus dispositivos.';
        }else{
          logged.style.display='none';
          if(intro) intro.textContent='Entre com sua conta para usar os mesmos lançamentos no celular e no computador.';
        }
      };
    }catch(err){ console.warn('Patch refreshSyncUI:',err); }
  }

  function patchCloudRestoreCheck(){
    try{
      if(typeof window.maybeOfferCloudRestore !== 'function' || window.__cloudRestoreCheckPatched) return;
      window.__cloudRestoreCheckPatched=true;
      const original=window.maybeOfferCloudRestore;

      // Quando chamado pelo callback de autenticação, adia a consulta ao banco
      // para o próximo ciclo do event loop. Assim o callback do Supabase termina
      // antes de qualquer chamada de banco/autenticação adicional.
      window.maybeOfferCloudRestore=function(){
        return new Promise(resolve=>{
          setTimeout(()=>{
            Promise.resolve(original.apply(this,arguments))
              .then(resolve)
              .catch(()=>resolve(false));
          },0);
        });
      };
    }catch(err){ console.warn('Patch restauração da nuvem:',err); }
  }

  function patchSyncNow(){
    try{
      if(typeof window.syncNow !== 'function' || window.__syncNowPatched) return;
      window.__syncNowPatched=true;
      const original=window.syncNow;

      // O callback de autenticação pode chamar syncNow(). Adiar TODAS as
      // execuções é seguro porque syncNow já é assíncrona e os chamadores
      // continuam podendo fazer await normalmente.
      window.syncNow=function(){
        const args=arguments;
        return new Promise((resolve,reject)=>{
          setTimeout(()=>{
            Promise.resolve(original.apply(this,args)).then(resolve,reject);
          },0);
        });
      };
    }catch(err){ console.warn('Patch syncNow:',err); }
  }

  function removeLegacyRestoreInterception(){
    // Versões anteriores deste boot-fix instalavam um listener de submit em
    // unlockForm e chamavam recoverCloudVault() enquanto o aplicativo ainda
    // estava bloqueado. recoverCloudVault() exige unlocked=true, portanto esse
    // listener criava o loop observado pelo usuário.
    //
    // Não instalamos nenhum listener aqui. O handler oficial de
    // initializeSecurity() deve controlar setup, unlock e restore.
  }

  function patch(){
    patchRefreshSyncUI();
    patchCloudRestoreCheck();
    patchSyncNow();
    removeLegacyRestoreInterception();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',patch,{once:true});
  }else{
    patch();
  }

  // As funções do index.html são declaradas antes deste arquivo, mas os
  // navegadores/Service Worker podem alterar a ordem de inicialização. Tente
  // novamente algumas vezes sem instalar listeners concorrentes.
  setTimeout(patch,100);
  setTimeout(patch,500);
  setTimeout(patch,1000);
})();
