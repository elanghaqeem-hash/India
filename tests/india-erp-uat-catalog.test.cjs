const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/INDIA_UAT_210_CATALOG.json'),'utf8'));
const newer=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/INDIA_ERP_UAT_210_CATALOG.json'),'utf8'));
const groups={GL:35,P2P:35,OPS:45,HR:30,E2E:30,SEC:35};
test('historical 210 cases retained and 210 new ERP cases defined, never asserted passed',()=>{
 assert.equal(old.cases.length,210);
 assert.equal(newer.cases.length,210);
 assert.equal(newer.cases.every(x=>x.status==='NOT_RUN'&&x.run===null),true);
 assert.equal(newer.release_gate,'BLOCKED');
 assert.deepEqual(newer.counts,groups);
 const ids=newer.cases.map(x=>x.id);
 assert.equal(new Set(ids).size,210);
 assert.equal(ids.some(x=>old.cases.some(y=>y.id===x)),false);
});
test('all new cases specify executable steps, role, invariant, negative or positive path and required evidence',()=>{
 const required=['environment','source_sha','actor','executed_at','api_or_browser_trace','db_before_after','audit_event','document_or_ledger_reference'];
 for(const c of newer.cases){
  assert.match(c.id,/^ERP-(GL|P2P|OPS|HR|E2E|SEC)-\\d{3}$/);
  assert.ok(c.workflow&&c.actor&&c.scenario&&c.preconditions&&c.expected);
  assert.ok(c.steps.length>=2);
  assert.ok(['positive','negative'].includes(c.kind));
  assert.deepEqual(c.evidence_required,required);
  assert.equal(c.priority,'P0');
 }
});
test('seven mandatory end-to-end journeys and independent negative paths are represented',()=>{
 for(let j=1;j<=7;j++){
  const matches=newer.cases.filter(x=>x.journey==='J'+j);
  assert.equal(matches.length,4);
  assert.equal(matches.some(x=>x.kind==='positive'),true);
  assert.equal(matches.some(x=>x.kind==='negative'),true);
 }
 for(const prefix of Object.keys(groups))assert.ok(newer.cases.filter(x=>x.id.startsWith('ERP-'+prefix+'-')).some(x=>x.kind==='negative'));
});
