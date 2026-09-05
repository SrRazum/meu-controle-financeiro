from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('async function save(){await secureSave(); if(typeof syncNow==="function") await syncNow(false)}','async function save(){await secureSave();}')
s=s.replace('hideLock();render();resetInactivity();queueSync();\n     return;','hideLock();render();resetInactivity();\n     if(__syncReady) syncNow(false);\n     return;')
s=s.replace('hideLock();render();resetInactivity();queueSync();\n     }catch(err){','hideLock();render();resetInactivity();\n       if(__syncReady) syncNow(false);\n     }catch(err){')
s=s.replace('window.__financePassword=p;unlocked=true;hideLock();render();resetInactivity();\n   queueSync();\n };','window.__financePassword=p;unlocked=true;hideLock();render();resetInactivity();\n   if(__syncReady) syncNow(false);\n };')
s=s.replace('initializeSecurity().then(()=>{const v=document.getElementById("appVersion"); if(v)v.textContent="V1.12"; queueSync();});','initializeSecurity().then(()=>{const v=document.getElementById("appVersion"); if(v)v.textContent="V1.12";});')
s=s.replace('if(unlocked)syncNow(false);\n     else maybeOfferCloudRestore();','if(unlocked)syncNow(false);')
s=s.replace('if(session){\n     if(unlocked) await syncNow(false);\n     else await maybeOfferCloudRestore();\n   }','if(session && unlocked){\n     await syncNow(false);\n   }')
s=s.replace('initCloud();','// Supabase is initialized only when the user opens the synchronization UI.\n')
s=s.replace('function openSyncModal(){\n document.getElementById("syncModal").classList.add("show");','async function openSyncModal(){\n await initCloud();\n document.getElementById("syncModal").classList.add("show");')
s=s.replace('async function syncLogin(){\n if(!syncConfigured())','async function syncLogin(){\n await initCloud();\n if(!syncConfigured())')
s=s.replace('async function syncSignup(){\n if(!syncConfigured())','async function syncSignup(){\n await initCloud();\n if(!syncConfigured())')
s=s.replace('async function initCloud(){\n if(!syncConfigured()){setSyncState("err");return}\n try{\n   __supabase=window.supabase.createClient','async function initCloud(){\n if(__supabase) return __syncReady;\n if(!syncConfigured()){setSyncState("err");return false}\n try{\n   __supabase=window.supabase.createClient')
s=s.replace('if(session && unlocked){\n     await syncNow(false);\n   }\n }catch(e){console.warn("Falha ao iniciar sincronização",e);setSyncState("err")}\n}','if(session && unlocked){\n     await syncNow(false);\n   }\n   return __syncReady;\n }catch(e){console.warn("Falha ao iniciar sincronização",e);setSyncState("err");return false}\n}')
s=re.sub(r'/\* Dispara a sincronizacao quando o modulo de nuvem ja estiver carregado\. \*/\nfunction queueSync\(\)\{.*?\n\}\n(?=async function secureSave)', '', s, flags=re.S)
assert s != p.read_text(encoding='utf-8')
assert 'queueSync(' not in s
assert 'if(__syncReady) syncNow(false);' in s
p.write_text(s,encoding='utf-8')
print('ok')
