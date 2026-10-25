const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
function load(path){
 const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports:out,require:id=>id==='./sales-workflow'?{TENANT:'test-tenant'}:require(id),TextDecoder,Uint8Array,crypto});return out;
}
test('outbound AI attempts reserve quota atomically even when provider never succeeds',()=>{
 const {RESERVE_AI_REQUEST_SQL}=load('src/lib/ai-request-budget.ts');
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE india_sales_ai_audit(id TEXT PRIMARY KEY,tenant_id TEXT,opportunity_id TEXT,purpose TEXT,provider_id TEXT,model TEXT,actor_email TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  const reserve=(id,user='user-a')=>db.prepare(RESERVE_AI_REQUEST_SQL).get(id,'test-tenant','analysis',user,'test-tenant',user);
  for(let i=0;i<20;i++)assert.ok(reserve('attempt-'+i));
  for(let i=20;i<50;i++)assert.equal(reserve('attempt-'+i),undefined);
  assert.ok(reserve('different-user','user-b'));
  db.exec("UPDATE india_sales_ai_audit SET created_at=datetime('now','-2 hours') WHERE actor_email='user-a'");
  assert.ok(reserve('new-window'));
 }finally{db.close();}
});
test('chunked oversized JSON is cancelled before the body is buffered in memory',async()=>{
 const {readBoundedJSON}=load('src/lib/bounded-json.ts');let cancelled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('x'.repeat(64)));},cancel(){cancelled=true;}});
 const req=new Request('https://example.invalid',{method:'POST',body:stream,duplex:'half'});
 await assert.rejects(readBoundedJSON(req,100),e=>e.status===413);
 assert.equal(cancelled,true);
 for(const invalid of ['[]','null','"text"'])await assert.rejects(readBoundedJSON(new Request('https://example.invalid',{method:'POST',body:invalid}),100),e=>e.status===400);
});
