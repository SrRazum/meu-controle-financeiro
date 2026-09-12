const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../sync-store.js');
const rec=(id,value)=>({id,valor:value});
test('JSON object key order does not create a false conflict',()=>{
  assert.equal(S.equal({id:'a',valor:1},{valor:1,id:'a'}),true);
});
test('new offline writes survive JSON roundtrip and coalesce without losing original base',()=>{
  let s=S.queue(S.empty(),[],[rec('a',1)]);
  s=JSON.parse(JSON.stringify(s));
  S.queue(s,[rec('a',1)],[rec('a',2)]);
  assert.equal(s.pending.a.base,null);assert.equal(s.pending.a.value.valor,2);
});
test('acknowledgement never drops an edit made during upload',()=>{
  let s=S.queue(S.empty(),[],[rec('a',1)]),sent=S.copy(Object.values(s.pending));
  S.queue(s,[rec('a',1)],[rec('a',2)]);
  S.acknowledge(s,sent,{accepted:[sent[0].opId],conflicts:{},records:[rec('a',1)]});
  assert.equal(s.records[0].valor,2);assert.equal(s.pending.a.base.valor,1);
});
test('conflicts preserve both versions and keep the outbox pending',()=>{
  const s=S.queue(S.empty(),[],[rec('a',2)]),sent=Object.values(s.pending);
  S.acknowledge(s,sent,{accepted:[],conflicts:{a:{remote:rec('a',3)}},records:[rec('a',3)]});
  assert.equal(s.records[0].valor,2);assert.equal(s.conflicts.a.remote.valor,3);assert.ok(s.pending.a);
});
test('stale tab cannot silently overwrite another tab',()=>{
  const s=S.queue(S.empty(),[],[rec('a',2)]);
  assert.throws(()=>S.queue(s,[],[rec('a',3)]),/outra aba/);
});
test('ack removes exactly sent writes and keeps tombstones indefinitely',()=>{
  const tomb={id:'a',deleted:true,deletedAt:'2000-01-01'};
  const s=S.queue(S.empty(),[],[tomb]);const sent=Object.values(s.pending);
  S.acknowledge(s,sent,{accepted:[sent[0].opId],conflicts:{},records:[tomb]});
  assert.equal(Object.keys(s.pending).length,0);assert.deepEqual(s.records,[tomb]);
});
test('independent remote records merge alongside offline changes',()=>{
  const s=S.queue(S.empty(),[],[rec('a',2)]);
  S.acknowledge(s,[],{accepted:[],conflicts:{},records:[rec('b',3)]});
  assert.equal(s.records.length,2);assert.ok(s.pending.a);
});
