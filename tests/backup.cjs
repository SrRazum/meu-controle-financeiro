/* Isolated disaster-recovery rehearsal. Fictitious data only; not a user-facing restore tool. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Backup rehearsal</title>');});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try{
 const source=await browser.newContext(),destination=await browser.newContext();
 const a=await source.newPage(),b=await destination.newPage();
 for(const page of [a,b]){await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../sync-store.js'),'utf8')});}
 const snapshot=await a.evaluate(async()=>{
  const rec=(id,valor)=>({id,valor,descricao:'Fictício',categoria:'Outros',data:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'});
  const base=rec('edited',10),deletedBase=rec('deleted',30);
  let state={records:[base,deletedBase],pending:{},conflicts:{}};
  state=FinanceStore.queue(state,state.records,[rec('edited',20),{...deletedBase,deleted:true},rec('new',40)]);
  state.conflicts.edited={remote:rec('edited',15)};
  await FinanceStore.update('fictitious-account-A',()=>state);
  await FinanceStore.update('fictitious-account-B',()=>({records:[rec('other',999)],pending:{},conflicts:{}}));
  return JSON.stringify({format:'rehearsal-account-snapshot',version:1,project:'fictitious-project',uid:'fictitious-account-A',state:await FinanceStore.read('fictitious-account-A')});
 });
 // JSON serialization represents a file roundtrip; no credentials are included.
 const backup=JSON.parse(snapshot);
 assert.equal(snapshot.includes('other'),false);
 const restore=async(uid,project)=>b.evaluate(async({backup,uid,project})=>{
  if(backup.uid!==uid||backup.project!==project)throw Error('Wrong account or project');
  await FinanceStore.update(uid,current=>{
   if(current.records.length||Object.keys(current.pending).length||Object.keys(current.conflicts).length)throw Error('Destination is not empty');
   return backup.state;
  });
 },{backup,uid,project});
 await assert.rejects(restore('fictitious-account-B','fictitious-project'),/Wrong account/);
 await assert.rejects(restore(backup.uid,'another-project'),/Wrong account/);
 await restore(backup.uid,backup.project);
 await b.reload();await b.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../sync-store.js'),'utf8')});
 const recovered=await b.evaluate(uid=>FinanceStore.read(uid),backup.uid);
 assert.deepEqual(recovered,backup.state);
 await assert.rejects(restore(backup.uid,backup.project),/not empty/);
 const S=require('../sync-store.js');
 // Remote changes made after backup must conflict; they must not be overwritten.
 const sent=Object.values(recovered.pending).filter(x=>!recovered.conflicts[x.value.id]);
 const newer={...recovered.pending.new.value,valor:45};
 const merged=S.acknowledge(S.copy(recovered),sent,{accepted:[recovered.pending.deleted.opId],conflicts:{new:{remote:newer}},records:[newer,recovered.pending.deleted.value]});
 assert.equal(merged.pending.new.value.valor,40);assert.equal(merged.conflicts.new.remote.valor,45);
 assert.ok(merged.conflicts.edited);assert.ok(merged.records.find(x=>x.id==='deleted').deleted);
 assert.equal(merged.pending.deleted,undefined);
 await source.close();await destination.close();
 console.log('PASS: real IndexedDB backup roundtrip across isolated profiles preserves records, pending op IDs/bases, tombstones and conflicts; wrong account/project and nonempty restore rejected; newer remote changes remain conflicts.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
