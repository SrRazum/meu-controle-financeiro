const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
const rec=(id,valor)=>({id,valor,descricao:'Teste',categoria:'Outros',data:'2026-09-12',vencimento:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'});
const op=(id,value,base=null)=>({opId:id,base,value});
test('PostgreSQL migration and account access controls',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as
 $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 insert into auth.users values('${alice}'),('${bob}');
 create table public.finance_vault(user_id uuid primary key,payload jsonb);
 insert into public.finance_vault values('${alice}','{"sentinel":"unchanged"}');`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609120001_account_sync.sql'),'utf8'));
 async function asUser(uid,fn,role='authenticated'){
   await db.exec('set role '+role);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
   try{return await fn();}finally{await db.exec('reset role');}
 }
 async function sync(uid,operations=[]){return (await db.query('select public.finance_sync_v2($1,$2::jsonb) as result',[uid,JSON.stringify(operations)])).rows[0].result;}
 await t.test('creates one record and retries idempotently',async()=>asUser(alice,async()=>{
   const operation=op('create-a',rec('a',10));
   assert.deepEqual((await sync(alice,[operation])).accepted,['create-a']);
   const again=await sync(alice,[operation]);assert.equal(again.records.length,1);assert.equal(again.records[0].valor,10);
 }));
 await t.test('another user cannot read or impersonate the owner',async()=>asUser(bob,async()=>{
   assert.equal((await db.query('select * from public.finance_records_v2')).rows.length,0);
   assert.equal((await sync(bob)).records.length,0);
   await assert.rejects(sync(alice),/Authentication required/);
 }));
 await t.test('authenticated users cannot bypass the synchronization function',async()=>asUser(alice,async()=>{
   await assert.rejects(db.query("update public.finance_records_v2 set value='{}'"),/permission denied/);
   await assert.rejects(db.query('delete from public.finance_records_v2'),/permission denied/);
   await assert.rejects(db.query('insert into public.finance_records_v2 values($1,$2,$3)',[alice,'other',rec('other',1)]),/permission denied/);
 }));
 await t.test('anonymous calls and missing identity fail',async()=>{
   await asUser(null,()=>assert.rejects(sync(alice),/permission denied/),'anon');
   await asUser(null,()=>assert.rejects(sync(alice),/Authentication required/));
 });
 await t.test('a stale edit returns both versions without overwriting the server',async()=>asUser(alice,async()=>{
   await sync(alice,[op('edit-a',rec('a',20),rec('a',10))]);
   const stale=await sync(alice,[op('stale-a',rec('a',30),rec('a',10))]);
   assert.deepEqual(stale.accepted,[]);assert.equal(stale.conflicts.a.remote.valor,20);assert.equal(stale.records[0].valor,20);
 }));
 await t.test('deletions cannot be resurrected by stale clients',async()=>asUser(alice,async()=>{
   const tomb={id:'a',deleted:true,deletedAt:'2000-01-01'};
   await sync(alice,[op('delete-a',tomb,rec('a',20))]);
   const stale=await sync(alice,[op('stale-create',rec('a',30))]);
   assert.equal(stale.conflicts.a.remote.deleted,true);assert.equal(stale.records[0].deleted,true);
 }));
 await t.test('a late invalid operation rolls back the entire batch',async()=>asUser(alice,async()=>{
   await assert.rejects(sync(alice,[op('valid-b',rec('b',1)),op('bad',rec('__proto__',1))]),/Invalid record/);
   assert.equal((await sync(alice)).records.some(x=>x.id==='b'),false);
 }));
 await t.test('malformed records and null operation lists are rejected',async()=>asUser(alice,async()=>{
   await assert.rejects(sync(alice,null));
   await assert.rejects(sync(alice,[op('broken',{id:'broken'})]));
   await assert.rejects(sync(alice,[op('number-id',{...rec('x',1),id:123})]));
 }));
 await t.test('legacy vault remains unchanged',async()=>{
   assert.deepEqual((await db.query('select payload from public.finance_vault')).rows,[{payload:{sentinel:'unchanged'}}]);
 });
 }finally{await db.close();}
});
