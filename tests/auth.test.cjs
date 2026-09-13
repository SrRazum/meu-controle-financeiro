const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Store=require('../sync-store.js');
const record=(id,valor)=>({id,valor,descricao:'Teste',categoria:'Outros',data:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
 const accounts=new Map(),storage=new Map(),elements=new Map(),listeners={};
 const element=()=>({style:{},value:'',textContent:'',classList:{add(){},remove(){}},replaceChildren(){},reset(){},append(){}});
 const context=vm.createContext({
   console,crypto,AbortController,JSON,Date,Object,Math,Promise,Array,Error,
   localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
   navigator:{onLine:true,storage:{persist:()=>Promise.resolve(true)}},
   document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(){}},
   window:{addEventListener:(event,fn)=>listeners[event]=fn},setTimeout(){return 1;},clearTimeout(){},setInterval(){},
   data:[],unlocked:false,render(){},closeEdit(){},limparForm(){},alert(){},confirm:()=>true,
   FinanceStore:{...Store,read:async uid=>Store.copy(accounts.get(uid)||Store.empty()),update:async(uid,fn)=>{const state=fn(Store.copy(accounts.get(uid)||Store.empty()));accounts.set(uid,Store.copy(state));return Store.copy(state);}}
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../auth.js'),'utf8'),context);
 const run=code=>vm.runInContext(code,context);
 const login=uid=>run(`activate({user:{id:${JSON.stringify(uid)},email:${JSON.stringify(uid+'@test')}}})`);
 return {context,accounts,storage,elements,run,login};
}
test('late upload response never displays another account data',async()=>{
 const h=harness(),response=deferred(),started=deferred();
 h.accounts.set('alice',Store.queue(Store.empty(),[],[record('a',1)]));
 await h.login('alice');
 h.context.client={rpc(){started.resolve();return {abortSignal:()=>response.promise};}};
 h.run('__supabase=client');const upload=h.run('syncNow(true)');await started.promise;
 await h.login('bob');
 response.resolve({data:{records:[record('a',1)],conflicts:{},accepted:[h.accounts.get('alice').pending.a.opId]}});await upload;
 assert.equal(h.run('account.id'),'bob');assert.equal(h.context.data.length,0);assert.ok(h.accounts.get('alice').pending.a);
});
test('failed-save recovery cannot restore the previous account after a switch',async()=>{
 const h=harness(),read=deferred(),recovering=deferred();
 h.accounts.set('alice',{...Store.empty(),records:[record('a',1)]});await h.login('alice');
 h.context.FinanceStore.update=async()=>{throw Error('Quota exceeded');};
 h.context.FinanceStore.read=uid=>uid==='alice'?(recovering.resolve(),read.promise):Promise.resolve(Store.empty());
 h.context.data[0].valor=2;const save=h.run('save()').catch(e=>e.message);await recovering.promise;
 await h.login('bob');read.resolve(h.accounts.get('alice'));await save;
 assert.equal(h.run('account.id'),'bob');assert.equal(h.context.data.length,0);
});
test('changes saved during upload remain queued against the acknowledged base',async()=>{
 const h=harness(),response=deferred(),started=deferred();
 h.accounts.set('alice',Store.queue(Store.empty(),[],[record('a',1)]));await h.login('alice');
 const opId=h.accounts.get('alice').pending.a.opId;
 h.context.client={rpc(){started.resolve();return {abortSignal:()=>response.promise};}};
 h.run('__supabase=client');const upload=h.run('syncNow(true)');await started.promise;
 h.context.data[0].valor=2;await h.run('save()');
 response.resolve({data:{records:[record('a',1)],conflicts:{},accepted:[opId]}});await upload;
 assert.equal(h.context.data[0].valor,2);assert.equal(h.accounts.get('alice').pending.a.base.valor,1);
});
test('offline cached access ends on explicit logout, while the outbox survives',async()=>{
 const h=harness();h.accounts.set('alice',Store.queue(Store.empty(),[],[record('a',1)]));
 h.run("usableSession({user:{id:'alice',email:'alice@test'}})");
 h.context.navigator.onLine=false;assert.equal(h.run('usableSession(null).user.id'),'alice');await h.login('alice');
 h.context.client={auth:{signOut:async()=>({})}};h.run('__supabase=client');await h.run('syncLogout()');
 assert.equal(h.run('usableSession(null)'),null);assert.ok(h.accounts.get('alice').pending.a);assert.equal(h.context.data.length,0);
});
test('the real vendored SDK cannot restore tokens after offline logout',async()=>{
 globalThis.self=globalThis;
 const {createClient}=require('../vendor/supabase.js');
 const h=harness();let remoteLogouts=0;
 const uid='00000000-0000-4000-8000-000000000001';
 h.context.SUPABASE_URL=h.context.window.SUPABASE_URL='https://test.invalid';
 h.context.SUPABASE_PUBLISHABLE_KEY=h.context.window.SUPABASE_PUBLISHABLE_KEY='test';
 h.context.window.supabase={createClient:(url,key,options)=>createClient(url,key,{
   ...options,auth:{...options.auth,storage:h.context.localStorage,autoRefreshToken:false,detectSessionInUrl:false},
   global:{fetch:async url=>{
     if(String(url).includes('/logout')){remoteLogouts++;throw Error('No connection');}
     assert.ok(String(url).includes('/token'));
     return new Response(JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user:{id:uid,email:'alice@test'}}),{status:200,headers:{'Content-Type':'application/json'}});
   }}
 })};
 await h.run('initCloud()');h.context.document.getElementById('syncEmail').value='alice@test';h.context.document.getElementById('syncPassword').value='secret123';await h.run('syncLogin()');
 assert.equal(h.run('account.id'),uid);assert.ok(h.storage.has('finance-auth-v2'));
 h.context.navigator.onLine=false;await h.run('syncLogout()');
 assert.equal((await h.run('__supabase.auth.getSession()')).data.session,null);
 assert.equal(h.storage.has('finance-auth-v2'),false);assert.equal(h.run('usableSession(null)'),null);assert.equal(remoteLogouts,0);
});

test('encrypted legacy import rejects wrong password, preserves vault, and reimports without duplication',async()=>{
 const h=harness();
 Object.assign(h.context,{TextEncoder,TextDecoder,Uint8Array,btoa,atob});
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 h.run('const SECURE_KEY="controle_financeiro_secure_v1", LEGACY_KEY="controle_financeiro_v1";');
 h.run(html.slice(html.indexOf('async function deriveKey('),html.indexOf('const cats=')));
 h.context.fixture=[record('legacy_test_20260912',12.34)];
 const raw=JSON.stringify(await h.run('encryptData("Cofre-Ficticio-2026!",fixture)'));
 h.storage.set('controle_financeiro_secure_v1',raw);
 await h.login('alice');h.context.navigator.onLine=false;
 h.elements.get('syncRecoverPassword').value='senha-incorreta';
 await h.run('importLegacy("local")');
 assert.equal(h.accounts.has('alice'),false);
 assert.match(h.elements.get('syncMsg').textContent,/Importação não concluída/);
 assert.equal(h.storage.get('controle_financeiro_secure_v1'),raw);
 h.elements.get('syncRecoverPassword').value='Cofre-Ficticio-2026!';
 await h.run('importLegacy("local")');
 assert.deepEqual(h.accounts.get('alice').records,h.context.fixture);
 assert.equal(Object.keys(h.accounts.get('alice').pending).length,1);
 const queued=JSON.stringify(h.accounts.get('alice'));
 h.elements.get('syncRecoverPassword').value='Cofre-Ficticio-2026!';
 await h.run('importLegacy("local")');
 assert.equal(JSON.stringify(h.accounts.get('alice')),queued);
 assert.equal(h.storage.get('controle_financeiro_secure_v1'),raw);
 assert.equal(h.elements.get('syncRecoverPassword').value,'');
 h.accounts.get('alice').records[0].valor=99;
 const before=JSON.stringify(h.accounts.get('alice'));
 h.elements.get('syncRecoverPassword').value='Cofre-Ficticio-2026!';
 await h.run('importLegacy("local")');
 assert.equal(JSON.stringify(h.accounts.get('alice')),before);
 assert.match(h.elements.get('syncMsg').textContent,/mesmo ID/);
});

test('real SDK invalid refresh ends session without losing pending data; reauthentication sends it once',async()=>{
 globalThis.self=globalThis;
 const {createClient}=require('../vendor/supabase.js');
 const h=harness();let rejectRefresh=false,uploads=0;
 const uid='00000000-0000-4000-8000-000000000003';
 h.context.SUPABASE_URL=h.context.window.SUPABASE_URL='https://test.invalid';
 h.context.SUPABASE_PUBLISHABLE_KEY=h.context.window.SUPABASE_PUBLISHABLE_KEY='test';
 h.context.window.supabase={createClient:(url,key,options)=>createClient(url,key,{
  ...options,auth:{...options.auth,storage:h.context.localStorage,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async(url,options)=>{
   if(String(url).includes('/rpc/')){
    uploads++;const body=JSON.parse(options.body);
    assert.equal(body.expected_user,uid);
    return new Response(JSON.stringify({records:body.operations.map(x=>x.value),accepted:body.operations.map(x=>x.opId),conflicts:{}}),{status:200,headers:{'Content-Type':'application/json'}});
   }
   if(String(url).includes('grant_type=refresh_token')&&rejectRefresh)return new Response(JSON.stringify({code:'refresh_token_not_found',message:'Invalid Refresh Token: Refresh Token Not Found'}),{status:400,headers:{'Content-Type':'application/json'}});
   assert.ok(String(url).includes('/token'));
   return new Response(JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user:{id:uid,email:'alice@test'}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}
 })};
 await h.run('initCloud()');
 h.context.document.getElementById('syncEmail').value='alice@test';
 h.context.document.getElementById('syncPassword').value='secret123';await h.run('syncLogin()');
 h.context.navigator.onLine=false;
 h.context.data.push(record('pending_expiration',7.89));await h.run('save()');
 const pending=JSON.stringify(h.accounts.get(uid));
 h.context.navigator.onLine=true;rejectRefresh=true;
 const refresh=await h.run('__supabase.auth.refreshSession()');
 assert.ok(refresh.error);
 assert.equal(h.run('account'),null);assert.equal(h.context.unlocked,false);
 assert.equal(h.context.data.length,0);assert.equal(JSON.stringify(h.accounts.get(uid)),pending);
 assert.equal(uploads,0);
 rejectRefresh=false;
 h.context.document.getElementById('syncPassword').value='secret123';await h.run('syncLogin()');
 await h.run('syncNow(true)');
 assert.equal(h.run('account.id'),uid);
 assert.equal(h.context.data[0].valor,7.89);
 assert.equal(Object.keys(h.accounts.get(uid).pending).length,0);
 assert.equal(uploads,1);
});

test('import result survives background sync and clears when switching accounts',async()=>{
 const h=harness();await h.login('alice');
 h.context.client={from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:null,error:null})};}};}};},rpc(){return {abortSignal:async()=>({data:{records:[],accepted:[],conflicts:{}}})};}};
 h.run('__supabase=client');
 await h.run('importLegacy("cloud")');
 const message=h.elements.get('syncRecoverResult').textContent;
 assert.match(message,/Nenhum cofre antigo encontrado/);
 await h.run('syncNow(true)');
 assert.equal(h.elements.get('syncRecoverResult').textContent,message);
 assert.equal(h.elements.get('syncMsg').textContent,'Sincronizado com a nuvem.');
 await h.login('bob');assert.equal(h.elements.get('syncRecoverResult').textContent,'');
});

test('migration rehearsal preserves mixed records, tombstones, and independently specified totals',async()=>{
 const h=harness();Object.assign(h.context,{TextEncoder,TextDecoder,Uint8Array,btoa,atob});
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 h.run('const SECURE_KEY="controle_financeiro_secure_v1", LEGACY_KEY="controle_financeiro_v1";');
 h.run(html.slice(html.indexOf('async function deriveKey('),html.indexOf('const cats=')));
 const rows=[
  {...record('salary',1250.50),categoria:'Salário'},
  {...record('expense',200.25),tipo:'saida',categoria:'Compras'},
  {...record('pending_in',80),status:'pendente',vencimento:'2026-10-01'},
  {...record('pending_out',30),tipo:'saida',status:'pendente',vencimento:'2026-09-01'},
  {...record('sales',300.10),controle:'restaurante',categoria:'Vendas'},
  {...record('ingredients',40.05),controle:'restaurante',tipo:'saida',categoria:'Ingredientes'},
  {...record('deleted_sale',999),deleted:true},
  {...record('old_date',10),data:'2024-02-29',descricao:'Acentuação & <texto> preservados'}
 ];
 h.context.fixture=rows;
 const original=JSON.stringify(await h.run('encryptData("Ensaio-Ficticio-2026!",fixture)'));
 h.storage.set('controle_financeiro_secure_v1',original);await h.login('alice');h.context.navigator.onLine=false;
 h.elements.get('syncRecoverPassword').value='Ensaio-Ficticio-2026!';await h.run('importLegacy("local")');
 assert.deepEqual(h.accounts.get('alice').records,rows);
 function totals(records){const out={pessoal:{paid:0,receivable:0,payable:0},restaurante:{paid:0,receivable:0,payable:0}};
 for(const x of records){if(x.deleted)continue;const cents=Math.round(x.valor*100),a=out[x.controle];if(x.status==='pago')a.paid+=x.tipo==='entrada'?cents:-cents;else a[x.tipo==='entrada'?'receivable':'payable']+=cents;}return out;}
 const expected={pessoal:{paid:106025,receivable:8000,payable:3000},restaurante:{paid:26005,receivable:0,payable:0}};
 assert.deepEqual(totals(h.accounts.get('alice').records),expected);
 let uploaded;
 h.context.client={rpc(name,args){uploaded=Store.copy(args.operations);return {abortSignal:async()=>({data:{records:uploaded.map(x=>x.value),accepted:uploaded.map(x=>x.opId),conflicts:{}}})};}};
 h.run('__supabase=client');h.context.navigator.onLine=true;await h.run('syncNow(true)');
 assert.deepEqual(uploaded.map(x=>x.value),rows);assert.equal(Object.keys(h.accounts.get('alice').pending).length,0);
 assert.deepEqual(totals(h.accounts.get('alice').records),expected);
 h.elements.get('syncRecoverPassword').value='Ensaio-Ficticio-2026!';h.context.navigator.onLine=false;await h.run('importLegacy("local")');
 assert.deepEqual(h.accounts.get('alice').records,rows);assert.equal(Object.keys(h.accounts.get('alice').pending).length,0);
 assert.equal(h.storage.get('controle_financeiro_secure_v1'),original);
});
