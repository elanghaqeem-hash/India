const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const apiFile='src/app/api/sales/approval-queue/route.ts';
const code=fs.readFileSync(path.join(root,apiFile),'utf8');
const ui=fs.readFileSync(path.join(root,'src/app/approvals/page.tsx'),'utf8');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={};
const authModule={authorizeBoQ:async()=>({ok:false,response:{status:401}}),privateHeaders:{'Cache-Control':'private, no-store'}};
vm.runInNewContext(js,{exports:exp,require:n=>{
 if(n==='@/lib/boq-auth')return authModule;
 if(n==='@/lib/sales-workflow')return {TENANT:'defendit360'};
 throw Error('Unexpected dependency '+n);
},Response:{json:(body,opts)=>({body,status:opts?.status||200})}},{filename:apiFile});
const get=exp.GET;
test('unverified request is denied by the real auth integration point',async()=>{
 assert.equal((await get({})).status,401);
 assert.match(code,/await authorizeBoQ\(req\)/);
 assert.doesNotMatch(code,/appStore|mock|dummy/);
});
test('read-only queue never invents pending data on missing tables or D1 errors',async()=>{
 authModule.authorizeBoQ=async()=>({ok:true,identity:{
  role:'approver',email:'checker@example.test',db:{prepare:()=>({bind:()=>({all:async()=>{throw Error('missing migration')}})})}
 }});
 const r=await get({});
 assert.equal(r.status,503);
 assert.equal(r.body.success,false);
 assert.doesNotMatch(JSON.stringify(r.body),/"items":\[\]/);
});
test('role-specific queries exclude maker and are read-only',async()=>{
 const sqls=[];
 authModule.authorizeBoQ=async()=>({ok:true,identity:{
  role:'legal',email:'legal@example.test',db:{prepare:sql=>{sqls.push(sql);return {bind:(...a)=>{
   assert.equal(a[0],'defendit360');
   assert.equal(a[1],'legal@example.test');
   return {all:async()=>({success:true,results:[]})};
  }}}}
 }});
 const r=await get({});
 assert.equal(r.body.success,true);
 assert.equal(r.body.items.length,0);
 assert.equal(sqls.length,1);
 assert.match(sqls[0],/legal_reviewed_by IS NULL/);
 assert.match(sqls[0],/lower\(a\.created_by\)!=\?/);
 assert.doesNotMatch(sqls[0],/UPDATE |DELETE |INSERT /);
});
test('reviewer sees only eligible D1 items and links to canonical module',async()=>{
 const sqls=[];
 authModule.authorizeBoQ=async()=>({ok:true,identity:{
  role:'approver',email:'checker@example.test',db:{prepare:sql=>{sqls.push(sql);return {bind:(...args)=>({all:async()=>({success:true,results:sql.includes("FROM india_boq")?[{id:'boq-001',kind:'boq',opportunity_id:'opp-42',title:'BoQ · Q-42',created_by:'maker@example.test',created_at:'2026-10-24 01:00:00'}]:[]})})}}}
 }});
 const r=await get({});
 assert.equal(r.status,200);
 assert.equal(r.body.items.length,1);
 assert.equal(r.body.items[0].href,'/boq?opportunity_id=opp-42');
 assert.ok(sqls.every(s=>s.includes('lower(')||s.includes('FROM india_billing')));
 assert.ok(sqls.some(s=>s.includes('FROM india_flexguard_wallets w')));
});
test('approval browser loads real queue, never treats failures as zero pending',()=>{
 assert.match(ui,/fetch\('\/api\/sales\/identity'/);
 assert.match(ui,/fetch\('\/api\/sales\/approval-queue'/);
 assert.match(ui,/Antrian tidak dapat dibaca/);
 assert.match(ui,/STATIONS\.filter\(s=>role&&s\.roles\.includes\(role\)\)/);
 assert.doesNotMatch(ui,/appStore/);
});
