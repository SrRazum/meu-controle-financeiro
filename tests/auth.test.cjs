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
