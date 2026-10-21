/**
 * HTTP route-handler simulation against SQLite schema identical to UAT migrations.
 * Cloudflare Access authorization is MOCKED ONLY in this Node test harness.
 * Production code always uses verified Cloudflare Access JWT.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const source=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const tenant='defendit360';
function load(sourcePath){
 const mod={exports:{}};
 const js=ts.transpileModule(source(sourcePath),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText;
 new Function('module','exports','require',js)(mod,mod.exports,require);
 return mod.exports;
}

const qa={
 salesA:'uat.sales.a@india.invalid',
 salesB:'uat.sales.b@india.invalid',
 admin:'uat.admin@india.invalid',
 viewer:'uat.viewer@india.invalid',
 finance:'uat.finance@india.invalid',
};
class D1Simulator{
 constructor(){
  this.db=new DatabaseSync(':memory:');
  this.db.exec('PRAGMA foreign_keys=ON');
  this.db.exec('CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
  for(const migration of ['0003_sales_workflow','0004_india_sales_isolation','0005_india_lead_management','0006_india_lead_conversion_integrity'])
   this.db.exec(source('migrations/'+migration+'.sql'));
  this.db.exec('CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1)');
  for(const [role,email] of Object.entries({sales:qa.salesA,admin:qa.admin,viewer:qa.viewer,finance:qa.finance}))
   this.db.prepare('INSERT INTO india_members(email,role) VALUES(?,?)').run(email,role);
  this.db.prepare('INSERT INTO india_members(email,role) VALUES(?,?)').run(qa.salesB,'sales');
 }
 prepare(sql){
  const db=this.db;
  return {
   _sql:sql,
   _args:[],
   bind(...args){this._args=args;return this;},
   async first(){return db.prepare(this._sql).get(...this._args)||null;},
   async all(){return {results:db.prepare(this._sql).all(...this._args),success:true};},
   async run(){const r=db.prepare(this._sql).run(...this._args);return {success:true,meta:{changes:r.changes}};}
  };
 }
 async batch(statements){
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const result=[];
   for(const stmt of statements){
    const r=this.db.prepare(stmt._sql).run(...stmt._args);
    result.push({success:true,meta:{changes:r.changes}});
   }
   this.db.exec('COMMIT');
   return result;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 close(){this.db.close();}
}
function context(db){
 const roleModule=load('src/lib/lead-workflow.ts');
 const salesModule=load('src/lib/sales-workflow.ts');
 function requireMock(name){
  if(name==='next/server')return {NextResponse:{json:(data,opt={})=>Response.json(data,{status:opt.status||200,headers:opt.headers})}};
  if(name==='@/lib/boq-auth')return {
   privateHeaders:{'Cache-Control':'no-store'},
   authorizeBoQ:async(req)=>{
    const email=req.headers.get('x-test-actor')||'';
    const member=db.db.prepare('SELECT email,role,active FROM india_members WHERE email=?').get(email);
    return member?.active===1?
     {ok:true,identity:{email:member.email,role:member.role,db}}:
     {ok:false,response:Response.json({success:false,message:'Unauthorized test identity'},{status:403})};
   }
  };
  if(name==='@/lib/lead-workflow')return roleModule;
  if(name==='@/lib/sales-workflow')return salesModule;
  if(name==='@/lib/sales-access')return load('src/lib/sales-access.ts');
  if(name==='@/lib/boq-domain')return load('src/lib/boq-domain.ts');
  throw Error('Unexpected import '+name);
 }
 function loadRoute(p){
  const mod={exports:{}};
  const js=ts.transpileModule(source(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('module','exports','require',js)(mod,mod.exports,requireMock);
  return mod.exports;
 }
 const leads=loadRoute('src/app/api/leads/route.ts');
 const convert=loadRoute('src/app/api/leads/convert/route.ts');
 const sales=loadRoute('src/app/api/sales/route.ts');
 async function req(route,method,actor,payload,url){
  const headers={'origin':'https://india-uat.test','x-test-actor':actor};
  if(method!=='GET')headers['content-type']='application/json';
  if(route==='convert')headers['x-india-lead-action']='convert';
  const request=new Request(url||'https://india-uat.test/api/'+route,{method,headers,...(payload===undefined?{}:{body:JSON.stringify(payload)})});
  const handler=route==='convert'?convert:route==='sales'?sales:leads;
  const response=await handler[method](request);
  return {status:response.status,body:await response.json()};
 }
 return {req};
}
const defaultLead=(suffix='Alpha')=>({
 company_name:'PT UAT HTTP '+suffix,contact_name:'PIC '+suffix,
 contact_email:'pic-'+suffix.toLowerCase()+'@invalid.example',contact_phone:'081200000055',
 service_interest:'VAPT',lead_source:'Marketing event',campaign_code:'UAT-202610',
 requirement_summary:'Penetration testing 2 aplikasi',budget_status:'Disetujui',
 decision_authority:'Head of IT',qualification_notes:'Anggaran dan kebutuhan disepakati',
 target_date:'2026-12-20'
});
const customer={
 industry:'IT',business_type:'Layanan Teknologi Informasi',
 employee_band:'100-500',company_phone:'0212345678',hq_address:'Fictional test only',
 hq_province:'DKI Jakarta',hq_postal:'12345'
};
async function qualify(api,actor,id,version=1){
 let r=await api.req('leads','PATCH',actor,{id,version,status:'contacted'});
 assert.equal(r.status,200,JSON.stringify(r.body));
 r=await api.req('leads','PATCH',actor,{id,version:version+1,status:'qualified'});
 assert.equal(r.status,200,JSON.stringify(r.body));
 return version+2;
}
test('HTTP: Sales creates lead, qualifies, converts and sees account/deal in Sales D1 API',async()=>{
 const db=new D1Simulator(),api=context(db);
 try{
  const created=await api.req('leads','POST',qa.salesA,defaultLead());
  assert.equal(created.status,201,JSON.stringify(created.body));
  const leadId=created.body.id;
  const version=await qualify(api,qa.salesA,leadId);
  const converted=await api.req('convert','POST',qa.salesA,{
   lead_id:leadId,version,customer,project_title:'UAT HTTP Multirole VAPT',
   estimated_value:110000000,contract_model:'One-Time'
  });
  assert.equal(converted.status,201,JSON.stringify(converted.body));
  assert.equal(converted.body.stage,'prospecting');
  const lead=await api.req('leads','GET',qa.salesA,undefined,'https://india-uat.test/api/leads?id='+encodeURIComponent(leadId));
  assert.equal(lead.body.lead.status,'converted');
  assert.equal(lead.body.lead.converted_opportunity_id,converted.body.opportunity_id);
  const deal=await api.req('sales','GET',qa.salesA,undefined,'https://india-uat.test/api/sales?entity=deals');
  assert.equal(deal.status,200);
  assert.equal(deal.body.deals.length,1);
  assert.equal(deal.body.deals[0].id,converted.body.opportunity_id);
  assert.equal(deal.body.deals[0].company_name,'PT UAT HTTP Alpha');
  const salesB=await api.req('sales','GET',qa.salesB,undefined,'https://india-uat.test/api/sales?entity=deals');
  assert.equal(salesB.body.deals.length,0);
  const admin=await api.req('sales','GET',qa.admin,undefined,'https://india-uat.test/api/sales?entity=deals');
  assert.equal(admin.body.deals.length,1);
  const duplicate=await api.req('convert','POST',qa.salesA,{
   lead_id:leadId,version,customer,project_title:'Second UAT',estimated_value:110000000
  });
  assert.equal(duplicate.status,409);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM india_sales_accounts').get().n,1);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM india_sales_opportunities').get().n,1);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM india_sales_audit WHERE action=?').get('LEAD_CONVERSION').n,1);
 }finally{db.close();}
});
test('HTTP: duplicate lead and cross-owner Sales or Viewer operations are denied',async()=>{
 const db=new D1Simulator(),api=context(db);
 try{
  const first=await api.req('leads','POST',qa.salesA,defaultLead('Beta'));
  assert.equal(first.status,201);
  const duplicated=await api.req('leads','POST',qa.salesA,defaultLead('Beta'));
  assert.equal(duplicated.status,409);
  const cross=await api.req('leads','PATCH',qa.salesB,{id:first.body.id,version:1,status:'contacted'});
  assert.equal(cross.status,403);
  const view=await api.req('leads','GET',qa.salesB);
  assert.equal(view.body.leads.length,0);
  const viewer=await api.req('leads','POST',qa.viewer,defaultLead('Gamma'));
  assert.equal(viewer.status,403);
  const finance=await api.req('leads','GET',qa.finance);
  assert.equal(finance.status,403);
  const admin=await api.req('leads','GET',qa.admin);
  assert.equal(admin.body.leads.length,1);
  const unqualifiedConvert=await api.req('convert','POST',qa.salesA,{
   lead_id:first.body.id,version:1,customer,project_title:'Unqualified',estimated_value:1
  });
  assert.equal(unqualifiedConvert.status,409);
 }finally{db.close();}
});
test('HTTP: Admin converts qualified Sales B lead without stealing ownership',async()=>{
 const db=new D1Simulator(),api=context(db);
 try{
  const created=await api.req('leads','POST',qa.salesB,defaultLead('Delta'));
  assert.equal(created.status,201);
  const v=await qualify(api,qa.salesB,created.body.id);
  const noOtherSales=await api.req('convert','POST',qa.salesA,{
   lead_id:created.body.id,version:v,customer,project_title:'Wrong Sales',estimated_value:24000000
  });
  assert.equal(noOtherSales.status,403);
  const converted=await api.req('convert','POST',qa.admin,{
   lead_id:created.body.id,version:v,customer,project_title:'UAT Admin Conversion',estimated_value:24000000
  });
  assert.equal(converted.status,201,JSON.stringify(converted.body));
  assert.equal(converted.body.owner_email,qa.salesB);
  const opp=db.db.prepare('SELECT created_by FROM india_sales_opportunities').get();
  assert.equal(opp.created_by,qa.salesB);
  const b=await api.req('sales','GET',qa.salesB,undefined,'https://india-uat.test/api/sales?entity=deals');
  assert.equal(b.body.deals.length,1);
  const a=await api.req('sales','GET',qa.salesA,undefined,'https://india-uat.test/api/sales?entity=deals');
  assert.equal(a.body.deals.length,0);
 }finally{db.close();}
});
test('HTTP: qualified records locked; justified reopen is auditable',async()=>{
 const db=new D1Simulator(),api=context(db);
 try{
  const created=await api.req('leads','POST',qa.salesA,defaultLead('Epsilon'));
  const v=await qualify(api,qa.salesA,created.body.id);
  const locked=await api.req('leads','PATCH',qa.salesA,{
   id:created.body.id,version:v,fields:{budget_status:'Changed silently'}
  });
  assert.equal(locked.status,409);
  const noReason=await api.req('leads','PATCH',qa.salesA,{
   id:created.body.id,version:v,status:'contacted'
  });
  assert.equal(noReason.status,422);
  const reopened=await api.req('leads','PATCH',qa.salesA,{
   id:created.body.id,version:v,status:'contacted',reason:'Customer revised budget after meeting'
  });
  assert.equal(reopened.status,200,JSON.stringify(reopened.body));
  const event=db.db.prepare('SELECT action,detail FROM india_marketing_lead_events WHERE action=?').get('REOPEN');
  assert.equal(event.action,'REOPEN');
  assert.match(event.detail,/revised budget/);
 }finally{db.close();}
});
