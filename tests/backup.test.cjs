const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../sync-store.js'),B=require('../backup.js');
const rec={id:'a',valor:7.89,descricao:'Fictício',categoria:'Outros',data:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'};
const make=()=>B.create(S.queue(S.empty(),[],[rec]),'alice','https://test.invalid');
test('backup preserves outbox and conflicts and rejects incompatible restore',()=>{
 const backup=make();backup.state.conflicts.a={remote:{...rec,valor:9}};
 assert.deepEqual(B.restore(S.empty(),JSON.parse(JSON.stringify(backup)),'alice','https://test.invalid'),backup.state);
 assert.throws(()=>B.validate(backup,'bob',backup.project),/outra conta/);
 assert.throws(()=>B.validate(backup,'alice','https://other.invalid'),/outra conta/);
 assert.deepEqual(B.restore(backup.state,backup,'alice',backup.project),backup.state);
});
test('backup refuses malformed or inconsistent snapshots before writing',()=>{
 for(const corrupt of [b=>b.state.records.push(rec),b=>b.state.pending.a.value.valor=20,b=>b.state.pending.a.base=undefined,b=>b.state.pending.a.opId='invalid',b=>b.state.conflicts.missing={remote:null},b=>b.state.conflicts.a={remote:{...rec,id:'wrong'}},b=>b.session='must not be present',b=>b.version=999]){
 const b=make();corrupt(b);assert.throws(()=>B.validate(b,'alice',b.project));
 }
 const b=make();b.state.pending=JSON.parse('{"__proto__":{}}');assert.throws(()=>B.validate(b,'alice',b.project));
});

test('restore preserves current synced records and local pending work',()=>{
 const b=make();b.state.pending={};
 const newer={...rec,valor:100};
 const current=S.queue({records:[newer],pending:{},conflicts:{}},[newer],[newer,{...rec,id:'local',valor:50}]);
 assert.deepEqual(B.restore(current,b,'alice',b.project),current);
});
test('backup pending edit against changed current value becomes an explicit conflict',()=>{
 const b=make();b.state.pending.a.base={...rec,valor:5};
 const current={records:[{...rec,valor:20},{...rec,id:'retained',valor:100}],pending:{},conflicts:{}};
 const result=B.restore(current,b,'alice',b.project);
 assert.equal(result.conflicts.a.remote.valor,20);assert.equal(result.pending.a.value.valor,7.89);
 assert.equal(result.records.find(x=>x.id==='retained').valor,100);
 assert.equal(current.records[0].valor,20);
});
test('incompatible pending edits reject whole restore without mutating current',()=>{
 const b=make(),current=S.queue(S.empty(),[],[{...rec,valor:80}]),before=JSON.stringify(current);
 assert.throws(()=>B.restore(current,b,'alice',b.project),/pendentes diferentes/);
 assert.equal(JSON.stringify(current),before);
});
test('old backup cannot resurrect a known deletion or silently recreate missing server records',()=>{
 const b=make();b.state.pending={};
 const current={records:[{...rec,deleted:true}],pending:{},conflicts:{}};
 assert.deepEqual(B.restore(current,b,'alice',b.project),current);
 const restored=B.restore(S.empty(),b,'alice',b.project);
 assert.deepEqual(restored.pending.a.base,rec);
 const ack=S.acknowledge(restored,Object.values(restored.pending),{records:[],accepted:[],conflicts:{a:{remote:null}}});
 assert.equal(ack.conflicts.a.remote,null);assert.deepEqual(ack.pending.a.value,rec);
});
test('already synced pending value is not queued again',()=>{
 const b=make(),current={records:[rec],pending:{},conflicts:{}};
 assert.deepEqual(B.restore(current,b,'alice',b.project),current);
});
