// Integration UAT of the actual canonical PR12 Marketing API handlers, PR18 CAS rules
// and the consolidated SQL schema. Access identities are MOCKED IN TEST ONLY.
// This does not replace live signed Cloudflare Access JWT / remote D1 UAT.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const tenant='defendit360';
const users={a:'uat.sales.a@india.invalid',b:'uat.sales.b@india.invalid',admin:'uat.admin@india.invalid',viewer:'uat.viewer@india.invalid'};
const q={need:'Annual security assessment',budget_status:'Approved',decision_maker:'CISO',procurement_process:'Direct purchase',contact_phone:'081234567890'};
const customer={industry:'Banking',business_type:'Financial Services',employee_band:'100-500',company_phone:'021000000',hq_address:'UAT synthetic address',hq_province:'DKI Jakarta',hq_postal:'12345'};
class D1Mock{
 constructor(){
  this.sql=new DatabaseSync(':memory:');
  this.sql.exec('PRAGMA foreign_keys=ON; CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
  this.sql.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT)");
  this.sql.exec("CREATE TABLE india_boq(id TEXT PRIMARY KEY)");
  for(const f of ['0003_sales_workflow.sql','0004_india_sales_isolation.sql','0005_marketing_lead_flow.sql',
   '0006_bid_and_requirements.sql','0007_quotation_submission.sql','0008_po_legal_evidence.sql',
   '0009_lead_request_idempotency.sql','0010_marketing_campaigns.sql','0011_marketing_sales_consolidation.sql'])
    this.sql.exec(source('migrations/'+f));
  for(const [key,mail] of Object.entries(users))
    this.sql.prepare("INSERT INTO india_members(email,role,active) VALUES(?,?,1)").run(mail,key==='a'||key==='b'?'sales':key);
 }
 prepare(sql){
  const d=this.sql;
  return {_sql:sql,_args:[],bind(...args){this._args=args;return this;},
   async first(){return d.prepare(this._sql).get(...this._args)||null;},
   async all(){return {success:true,results:d.prepare(this._sql).all(...this._args)};},
   async run(){const r=d.prepare(this._sql).run(...this._args);return {success:true,meta:{changes:r.changes}};}};
 }
 async batch(statements){
  this.sql.exec('BEGIN IMMEDIATE');
  try{
   const results=statements.map(s=>{
    const r=this.sql.prepare(s._sql).run(...s._args);
    return {success:true,meta:{changes:r.changes}};
   });
   this.sql.exec('COMMIT');return results;
  }catch(e){this.sql.exec('ROLLBACK');throw e;}
 }
 close(){this.sql.close();}
}
function loadDomain(name,cache){
 if(cache[name])return cache[name];
 const src=source('src/lib/'+name+'.ts'),mod={exports:{}};
 cache[name]=mod.exports;
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(p=>{
  if(p==='./sales-workflow')return loadDomain('sales-workflow',cache);
  if(p==='./boq-domain')return loadDomain('boq-domain',cache);
  throw Error('Unexpected domain import '+p);
 },mod,mod.exports);
 cache[name]=mod.exports;return mod.exports;
}
function api(db){
 const modules={};
 const sqlRoles=new Map([[users.a,'sales'],[users.b,'sales'],[users.admin,'admin'],[users.viewer,'viewer']]);
 const customRequire=p=>{
  if(p==='@/lib/boq-auth')return {privateHeaders:{'Cache-Control':'no-store'},
   authorizeBoQ:async req=>{
    const email=req.headers.get('x-uat-identity')||'';
    const role=sqlRoles.get(email);
    return role?{ok:true,identity:{email,role,db}}:{ok:false,response:Response.json({success:false},{status:401})};
   }};
  if(p==='@/lib/sales-workflow')return loadDomain('sales-workflow',modules);
  if(p==='@/lib/marketing-lead')return loadDomain('marketing-lead',modules);
  throw Error('Unexpected route import '+p);
 };
 const mod={exports:{}};
 const js=ts.transpileModule(source('src/app/api/marketing/leads/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(customRequire,mod,mod.exports);
 return async (method,actor,data,headerOverrides={})=>{
  const req=new Request('https://india-uat.test/api/marketing/leads',{
   method,
   headers:{Origin:'https://india-uat.test','Content-Type':'application/json','x-uat-identity':actor,
    ...(data?.entity==='convert'?{'x-india-lead-action':'convert'}:{}),...headerOverrides},
   ...(data?{body:JSON.stringify(data)}:{})
  });
  const res=await mod.exports[method](req);
  return {status:res.status,payload:await res.json()};
 };
}
const newLead=(owner,tag)=>({
 entity:'lead',request_key:crypto.randomUUID(),account_name:'PT INDIA TEST '+tag,
 source:'Referral',campaign:'QA',service_family:'VAPT',
 contact_name:'PIC QA',contact_email:'qa-'+tag.toLowerCase()+'@invalid.example',
 assigned_sales_email:owner,estimated_value_idr:150000000,expected_closing_date:'2026-12-20',
 qualification:{}
});
async function createdAndQualified(call,owner,tag){
 const cr=await call('POST',owner,newLead(owner,tag));
 assert.equal(cr.status,201,JSON.stringify(cr.payload));
 const leadId=cr.payload.id;
 const qual=await call('PATCH',owner,{id:leadId,version:1,status:'qualified',qualification:q});
 assert.equal(qual.status,200,JSON.stringify(qual.payload));
 return leadId;
}
test('Sales A conversion through actual API creates one canonical Account, Opportunity, link and Lead audit',async()=>{
 const d=new D1Mock();const call=api(d);
 try{
  const lead=await createdAndQualified(call,users.a,'A');
  const premature=await call('POST',users.a,{entity:'convert',id:lead,version:1,opportunity_title:'UAT VAPT',customer_fields:customer});
  assert.equal(premature.status,409);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM india_sales_accounts').get().n,0);
  const run=await call('POST',users.a,{entity:'convert',id:lead,version:2,opportunity_title:'UAT VAPT',customer_fields:customer});
  assert.equal(run.status,201,JSON.stringify(run.payload));
  const saved=d.sql.prepare('SELECT l.status,l.version,a.created_by account_owner,o.created_by deal_owner, json_extract(a.data_json,\'$.industry\') industry FROM india_marketing_leads l JOIN india_sales_lead_links x ON x.lead_id=l.id JOIN india_sales_accounts a ON a.id=x.customer_id JOIN india_sales_opportunities o ON o.id=x.opportunity_id WHERE l.id=?').get(lead);
  assert.equal(saved.status,'converted');assert.equal(saved.version,3);
  assert.equal(saved.account_owner,users.a);assert.equal(saved.deal_owner,users.a);
  assert.equal(saved.industry,'Banking');
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM india_marketing_lead_events WHERE lead_id=?').get(lead).n,1);
  const retry=await call('POST',users.a,{entity:'convert',id:lead,version:2,opportunity_title:'UAT VAPT'});
  assert.equal(retry.status,200);assert.equal(retry.payload.already_converted,true);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM india_sales_opportunities').get().n,1);
  assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{d.close();}
});
test('Sales B cannot alter Sales A lead, and Admin conversion does not steal Sales B ownership',async()=>{
 const d=new D1Mock(),call=api(d);
 try{
  const lead=await createdAndQualified(call,users.b,'B');
  const wrong=await call('POST',users.a,{entity:'convert',id:lead,version:2,opportunity_title:'Wrong Owner'});
  assert.equal(wrong.status,403);
  const viewer=await call('POST',users.viewer,{entity:'convert',id:lead,version:2,opportunity_title:'Unauthorized'});
  assert.equal(viewer.status,403);
  const admin=await call('POST',users.admin,{entity:'convert',id:lead,version:2,opportunity_title:'UAT SOC',customer_fields:customer});
  assert.equal(admin.status,201,JSON.stringify(admin.payload));
  const acc=d.sql.prepare('SELECT created_by FROM india_sales_accounts').get();
  const opp=d.sql.prepare('SELECT created_by FROM india_sales_opportunities').get();
  assert.equal(acc.created_by,users.b);assert.equal(opp.created_by,users.b);
  const audit=d.sql.prepare("SELECT actor_email FROM india_marketing_lead_events WHERE action='CONVERT'").get();
  assert.equal(audit.actor_email,users.admin);
 }finally{d.close();}
});
test('cross-owner existing Customer collision cannot produce orphan Opportunity or converted Lead',async()=>{
 const d=new D1Mock(),call=api(d);
 try{
  const cr=await call('POST',users.b,newLead(users.b,'SHARED'));
  assert.equal(cr.status,201);
  await call('PATCH',users.b,{id:cr.payload.id,version:1,status:'qualified',qualification:q});
  d.sql.prepare("INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,data_json,created_by) VALUES(?,?,?,?,?,?)")
   .run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',tenant,'PT INDIA TEST SHARED','IND-OLD','{}',users.a);
  const blocked=await call('POST',users.b,{entity:'convert',id:cr.payload.id,version:2,opportunity_title:'Must Not Cross',customer_fields:customer});
  assert.equal(blocked.status,409,JSON.stringify(blocked.payload));
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM india_sales_opportunities').get().n,0);
  assert.equal(d.sql.prepare('SELECT status FROM india_marketing_leads').get().status,'qualified');
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM india_sales_lead_links').get().n,0);
 }finally{d.close();}
});
