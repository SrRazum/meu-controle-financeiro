/* Integration tests use a fake auth/sync transport; no real accounts or cloud writes.
 * Run with Playwright installed: node tests/browser.cjs
 * Optional BROWSER_PATH points to an installed Chromium/Edge executable.
 */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const remote=new Map();let calls=0;
const fakeSDK=`window.supabase={createClient(){
let cb;const session=()=>JSON.parse(localStorage.getItem('test-session')||'null');
return {auth:{onAuthStateChange(f){cb=f;return{}},async getSession(){return {data:{session:session()}}},
async signInWithPassword({email}){const s={user:{id:email,email}};localStorage.setItem('test-session',JSON.stringify(s));cb('SIGNED_IN',s);return {data:{session:s}}},
async signOut(){localStorage.removeItem('test-session');cb('SIGNED_OUT',null);return{};}},
rpc(name,args){return {async abortSignal(signal){const r=await fetch('/sync',{method:'POST',signal,body:JSON.stringify({...args,user:session()?.user.id})});return {data:await r.json()}}}},
from(){throw Error('Legacy API disabled in test');}}}};`;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/sync'){
   let raw='';for await(const chunk of req)raw+=chunk;
   const body=JSON.parse(raw);assert.equal(body.user,body.expected_user);calls++;
   const rows=remote.get(body.user)||new Map();remote.set(body.user,rows);
   const accepted=[],conflicts={};
   const S=require('../sync-store.js');
   for(const op of body.operations){const old=rows.get(op.value.id)||null;
     if(S.equal(old,op.value)||S.equal(old,op.base)){rows.set(op.value.id,op.value);accepted.push(op.opId);}
     else conflicts[op.value.id]={remote:old};
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({accepted,conflicts,records:[...rows.values()]}));return;
 }
 const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');
 if(file.endsWith('config.js'))res.end(fs.readFileSync(file,'utf8')+'\nwindow.SUPABASE_URL="https://test.invalid";window.SUPABASE_PUBLISHABLE_KEY="test";');
 else if(file.endsWith(path.join('vendor','supabase.js')))res.end(fakeSDK);
 else res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 const watchdog=setTimeout(()=>{console.error('Browser test exceeded 240 seconds');void browser.close();},240000);watchdog.unref();
 page.setDefaultTimeout(20000);
 console.log('Browser launched');
 const until=async fn=>{for(let i=0;i<450;i++){if(await page.evaluate(fn))return;await new Promise(r=>setTimeout(r,100));}throw Error('Async condition timed out: '+await page.locator('#syncMsg').textContent());};
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const url='http://127.0.0.1:'+server.address().port;
 await page.goto(url);await page.waitForFunction(()=>typeof syncLogin==='function');
 await page.getByRole('button',{name:'Entrar / criar conta',exact:true}).click();
 await page.locator('#syncEmail').fill('alice@test');await page.locator('#syncPassword').fill('secret123');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.waitForFunction(()=>unlocked);
 console.log('Login completed; waiting for service worker');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller, null, {timeout:20000});
 console.log('Service worker ready');
 // Initial controller claim must not interrupt the onboarding form.
 await page.waitForFunction(()=>unlocked&&navigator.serviceWorker.controller);
 await context.setOffline(true);
 await page.evaluate(async()=>{data.push(stampRecord({id:'a',descricao:'Offline',tipo:'entrada',controle:'pessoal',categoria:'Outros',valor:12,data:'2026-09-11',vencimento:'2026-09-11',status:'pago'}));await save();});
 console.log('Reloading offline');
 await page.reload();await page.waitForFunction(()=>unlocked);
 console.log('Reloaded');
 assert.equal(await page.evaluate(()=>data[0].descricao),'Offline');
 assert.equal(await page.evaluate(async()=>Object.keys((await FinanceStore.read('alice@test')).pending).length),1);
 await context.setOffline(false);await page.evaluate(()=>syncNow());
 await until(async()=>Object.keys((await FinanceStore.read('alice@test')).pending).length===0);
 assert.equal(remote.get('alice@test').get('a')?.valor,12,JSON.stringify({remote:[...remote.get('alice@test')],local:await page.evaluate(()=>FinanceStore.read('alice@test'))}));
 // Divergent edits must become a visible conflict, not a silent last-write-wins.
 await context.setOffline(true);
 await page.evaluate(async()=>{data[0].valor=13;await save();});
 remote.get('alice@test').set('a',{...remote.get('alice@test').get('a'),valor:99});
 await context.setOffline(false);await page.evaluate(()=>syncNow());
 await until(async()=>!!(await FinanceStore.read('alice@test')).conflicts.a);
 await page.evaluate(()=>openSyncModal());
 await page.getByRole('button',{name:'Usar versão da nuvem',exact:true}).click();
 await page.waitForFunction(()=>data[0].valor===99);
 // Logout retains offline queue; another account sees none of it.
 await context.setOffline(true);await page.evaluate(async()=>{data[0].valor=100;await save();await syncLogout();});
 assert.equal(await page.evaluate(()=>data.length),0);
 await context.setOffline(false);await page.evaluate(()=>openSyncModal());
 await page.locator('#syncEmail').fill('bob@test');await page.locator('#syncPassword').fill('secret123');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForFunction(()=>unlocked);
 assert.equal(await page.evaluate(()=>data.length),0);
 assert.equal(await page.evaluate(async()=>Object.keys((await FinanceStore.read('alice@test')).pending).length),1);
 assert.equal(remote.get('bob@test')?.size||0,0);
 // Exercise the actual entry form; descriptions must remain text, not executable HTML.
 await context.setOffline(true);
 await page.locator('nav button[data-view="lancamento"]').click();
 await page.locator('#descricao').fill('<img src=x onerror="window.injected=true">');
 await page.locator('#valor').fill('25.50');await page.locator('#data').fill('2026-09-12');
 await page.locator('#form button[type="submit"]').click();
 await until(()=>data.length===1);
 assert.equal(await page.evaluate(()=>data[0].valor),25.5);
 assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.locator('nav button[data-view="movimentacoes"]').click();
 assert.equal(await page.locator('#tbody img').count(),0);
 await page.locator('#tbody .btn-edit').click();
 await page.locator('#eValor').fill('26.50');
 await page.locator('#editForm button[type="submit"]').click();
 await until(()=>data[0].valor===26.5);
 await page.locator('#tbody .btn-delete').click();await until(()=>data[0].deleted===true);
 console.log('Reloading offline');
 await page.reload();await page.waitForFunction(()=>unlocked);
 console.log('Reloaded');
 assert.equal(await page.evaluate(()=>activeData().length),0);
 assert.equal(await page.evaluate(async()=>Object.keys((await FinanceStore.read('bob@test')).pending).length),1);
 await context.setOffline(false);await until(async()=>Object.keys((await FinanceStore.read('bob@test')).pending).length===0);
 assert.equal([...remote.get('bob@test').values()][0].deleted,true);
 // Import an encrypted fictitious vault through the real UI in this isolated context.
 console.log('Starting vault test');
 const vault=await page.evaluate(async()=>{
   const raw=JSON.stringify(await encryptData('Cofre-Ficticio-2026!',[{id:'legacy_ui_test',descricao:'TESTE MIGRACAO COFRE - ficticio',valor:12.34,categoria:'Outros',data:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'}]));
   if(localStorage.getItem(SECURE_KEY)||localStorage.getItem(LEGACY_KEY))throw Error('Unexpected existing legacy vault');
   localStorage.setItem(SECURE_KEY,raw);return raw;
 });
 await page.getByRole('button',{name:'☁️ Sincronizar',exact:true}).click();
 await page.locator('#syncRecoverPassword').fill('senha-incorreta');
 await page.getByRole('button',{name:'Importar cofre antigo deste dispositivo',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('syncMsg').textContent.includes('Importação não concluída'));
 assert.equal(await page.evaluate(()=>data.some(x=>x.id==='legacy_ui_test')),false);
 await context.setOffline(true);
 await page.locator('#syncRecoverPassword').fill('Cofre-Ficticio-2026!');
 await page.getByRole('button',{name:'Importar cofre antigo deste dispositivo',exact:true}).click();
 await until(()=>data.some(x=>x.id==='legacy_ui_test'));
 assert.equal(await page.evaluate(()=>localStorage.getItem(SECURE_KEY)),vault);
 console.log('Reloading offline');
 await page.reload();await page.waitForFunction(()=>unlocked);
 console.log('Reloaded');
 assert.equal(await page.evaluate(()=>data.find(x=>x.id==='legacy_ui_test').valor),12.34);
 await context.setOffline(false);
 await until(async()=>Object.keys((await FinanceStore.read('bob@test')).pending).length===0);
 assert.equal(remote.get('bob@test').get('legacy_ui_test').valor,12.34);
 await page.getByRole('button',{name:'☁️ Sincronizar',exact:true}).click();
 await page.locator('#syncRecoverPassword').fill('Cofre-Ficticio-2026!');
 await page.getByRole('button',{name:'Importar cofre antigo deste dispositivo',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('syncRecoverPassword').value==='');
 assert.equal(await page.evaluate(()=>data.filter(x=>x.id==='legacy_ui_test').length),1);
 assert.equal(await page.evaluate(()=>localStorage.getItem(SECURE_KEY)),vault);
 assert.deepEqual(errors,[]);
 console.log('PASS: legacy import UI rejects wrong password, persists offline, uploads on reconnect to mock server, reimports without duplicates, preserves original vault.');
 console.log('PASS: browser startup, IndexedDB offline reload, reconnect upload, conflict resolution, logout queue retention, account isolation, create/edit/delete forms, safe text rendering; '+calls+' mock sync requests.');
 await context.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
