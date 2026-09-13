const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../sync-store.js'),B=require('../backup.js');
const rec={id:'a',valor:7.89,descricao:'Fictício',categoria:'Outros',data:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'};
const make=()=>B.create(S.queue(S.empty(),[],[rec]),'alice','https://test.invalid');
test('backup preserves outbox and conflicts and rejects incompatible restore',()=>{
 const backup=make();backup.state.conflicts.a={remote:{...rec,valor:9}};
 assert.deepEqual(B.restore(S.empty(),JSON.parse(JSON.stringify(backup)),'alice','https://test.invalid'),backup.state);
 assert.throws(()=>B.validate(backup,'bob',backup.project),/outra conta/);
 assert.throws(()=>B.validate(backup,'alice','https://other.invalid'),/outra conta/);
 assert.throws(()=>B.restore(backup.state,backup,'alice',backup.project),/já contém/);
});
test('backup refuses malformed or inconsistent snapshots before writing',()=>{
 for(const corrupt of [b=>b.state.records.push(rec),b=>b.state.pending.a.value.valor=20,b=>b.state.pending.a.base=undefined,b=>b.state.pending.a.opId='invalid',b=>b.state.conflicts.missing={remote:null},b=>b.state.conflicts.a={remote:{...rec,id:'wrong'}},b=>b.session='must not be present',b=>b.version=999]){
 const b=make();corrupt(b);assert.throws(()=>B.validate(b,'alice',b.project));
 }
 const b=make();b.state.pending=JSON.parse('{"__proto__":{}}');assert.throws(()=>B.validate(b,'alice',b.project));
});
