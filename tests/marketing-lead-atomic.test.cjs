const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const source=(p)=>fs.readFileSync(path.join(root,p),'utf8');
function load(sourcePath){
 const mod={exports:{}};
 const transformed=ts.transpileModule(source(sourcePath),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('module','exports','require',transformed)(mod,mod.exports,require);
 return mod.exports;
}
const role=load('src/lib/lead-workflow.ts');
const sales=load('src/lib/sales-workflow.ts');
const route=source('src/app/api/leads/convert/route.ts');
const leadRoute=source('src/app/api/leads/route.ts');
const sqlStmts=[...route.matchAll(/db\.prepare\("([^"]+)"\)/g)].map(x=>x[1]);
const conversion=sqlStmts.filter(q=>/^(UPDATE india_marketing_leads|INSERT INTO india_sales_accounts|INSERT INTO india_sales_opportunities|INSERT INTO india_marketing_lead_events|INSERT INTO india_sales_audit)/.test(q));
const T='defendit360';
const A='uat.sales.a@india.invalid',B='uat.sales.b@india.invalid',ADMIN='uat.admin@india.invalid';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
 for(const v of ['0003_sales_workflow','0004_india_sales_isolation','0005_india_lead_management','0006_india_lead_conversion_integrity']){
  db.exec(source('migrations/'+v+'.sql'));
 }
 const leadId='11111111-1111-4111-8111-111111111111';
 db.prepare('INSERT INTO india_marketing_leads(id,tenant_id,company_name,contact_name,contact_email,contact_phone,service_interest,lead_source,campaign_code,qualification_notes,budget_status,decision_authority,requirement_summary,target_date,status,owner_email,created_by,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
 .run(leadId,T,'PT UAT Conversion Only','QA Sales Contact','qa-lead@invalid.example','081200000010','VAPT','Referral','UAT','Qualification confirmed','Approved','Head of IT','VAPT test application','2026-12-20','qualified',A,A,3);
 return {db,leadId};
}
const ids={
 account:'22222222-2222-4222-8222-222222222222',
 opp:'33333333-3333-4333-8333-333333333333',
 event:'44444444-4444-4444-8444-444444444444',
 audit:'55555555-5555-4555-8555-555555555555'
};
const profile={
 industry:'Technology',business_type:'IT Services',employee_band:'100-500',company_phone:'0219999999',
 hq_address:'UAT only address',hq_province:'DKI Jakarta',hq_postal:'12345',
 primary_name:'QA Sales Contact',primary_phone:'081200000010',primary_email:'qa-lead@invalid.example'
};
const dealFields={lead_source:'Referral',sales_owner:A,service_family:'VAPT',client_need:'VAPT test application',
 expected_closing_date:'2026-12-20',source_lead_id:'11111111-1111-4111-8111-111111111111'};
function applyConversion(db,id=ids,version=3){
 const binds=[
 [id.account,id.opp,T,'11111111-1111-4111-8111-111111111111',version,A],
 [id.account,'IND-'+id.account.slice(0,8).toUpperCase(),JSON.stringify(profile),T,'11111111-1111-4111-8111-111111111111',version+1,id.account,id.opp],
 [id.opp,id.account,'UAT Project VAPT',120000000,JSON.stringify(dealFields),T,'11111111-1111-4111-8111-111111111111',version+1,id.account,id.opp],
 [id.event,ADMIN,'Account '+id.account+' / Opportunity '+id.opp,T,'11111111-1111-4111-8111-111111111111',version+1,id.account,id.opp],
 [id.audit,id.opp,ADMIN,'Lead to Customer & Opportunity',T,'11111111-1111-4111-8111-111111111111',version+1,id.opp],
 ];
 const changes=[];
 db.exec('BEGIN IMMEDIATE');
 try{
  for(let i=0;i<conversion.length;i++)changes.push(db.prepare(conversion[i]).run(...binds[i]).changes);
  if(changes.some(c=>c!==1)){db.exec('ROLLBACK');return {ok:false,changes};}
  db.exec('COMMIT');return {ok:true,changes};
 }catch(e){db.exec('ROLLBACK');return {ok:false,changes,error:e};}
}
test('P0: real conversion route uses 5 guarded D1 batch SQL statements',()=>{
 assert.equal(conversion.length,5);
 assert.match(route,/await db\.batch\(statements\)/);
 assert.match(route,/canEditLead\(role,email,lead\.owner_email\)/);
 assert.match(route,/lead\.status!=='qualified'/);
 assert.match(route,/lead\.version!==expectedVersion/);
 assert.match(route,/results\.some\(x=>x\.meta\?\.changes!==1\)/);
 assert.match(route,/req\.headers\.get\('x-india-lead-action'\)/);
});
test('P0: Sales ownership and Admin override, forbidden finance, approver, viewer',()=>{
 assert.equal(role.canCreateLead('sales'),true);
 assert.equal(role.canCreateLead('admin'),true);
 for(const r of ['presales','finance','approver','viewer'])assert.equal(role.canCreateLead(r),false);
 assert.equal(role.canEditLead('sales',A,A),true);
 assert.equal(role.canEditLead('sales',B,A),false);
 assert.equal(role.canEditLead('admin',ADMIN,A),true);
 assert.equal(sales.validateAccount({legal_name:'PT UAT Conversion Only',fields:profile}).length,0);
});
test('P0: status machine forbids illegal stage jumps and converted mutation',()=>{
 assert.equal(role.canTransition('new','contacted'),true);
 assert.equal(role.canTransition('new','qualified'),false);
 assert.equal(role.canTransition('contacted','qualified'),true);
 assert.equal(role.canTransition('qualified','converted'),true);
 assert.equal(role.canTransition('converted','contacted'),false);
});
test('P0: qualified lead converts atomically into one customer and one opportunity, with 2 audit events',()=>{
 const {db,leadId}=fixture();
 const result=applyConversion(db);
 assert.equal(result.ok,true,JSON.stringify(result.changes));
 assert.deepEqual(result.changes,[1,1,1,1,1]);
 const lead=db.prepare('SELECT status,version,converted_account_id,converted_opportunity_id FROM india_marketing_leads WHERE id=?').get(leadId);
 assert.equal(lead.status,'converted');assert.equal(lead.version,4);
 assert.equal(lead.converted_account_id,ids.account);assert.equal(lead.converted_opportunity_id,ids.opp);
 const cust=db.prepare('SELECT id,created_by,legal_name FROM india_sales_accounts').get();
 assert.equal(cust.id,ids.account);assert.equal(cust.created_by,A);
 const opp=db.prepare('SELECT company_id,created_by,stage,estimated_value_idr,data_json FROM india_sales_opportunities').get();
 assert.equal(opp.company_id,cust.id);assert.equal(opp.created_by,A);
 assert.equal(opp.stage,'prospecting');assert.equal(opp.estimated_value_idr,120000000);
 assert.equal(JSON.parse(opp.data_json).source_lead_id,leadId);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_lead_events WHERE action=?').get('CONVERT').n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM india_sales_audit WHERE action=?').get('LEAD_CONVERSION').n,1);
 assert.deepEqual([...db.prepare('PRAGMA foreign_key_check').all()],[]);
 db.close();
});
test('P0: duplicate POST / stale version cannot make another account, deal or audit',()=>{
 const {db}=fixture();assert.equal(applyConversion(db).ok,true);
 const another={
 account:'66666666-6666-4666-8666-666666666666',
 opp:'77777777-7777-4777-8777-777777777777',
 event:'88888888-8888-4888-8888-888888888888',
 audit:'99999999-9999-4999-8999-999999999999'};
 const result=applyConversion(db,another,3);
 assert.equal(result.ok,false);assert.equal(result.changes[0],0);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM india_sales_accounts').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM india_sales_opportunities').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_lead_events WHERE action=?').get('CONVERT').n,1);
 db.close();
});
test('P0: duplicate customer normalized name fails and rolls back qualified lead',()=>{
 const {db,leadId}=fixture();
 db.prepare('INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,data_json,created_by) VALUES (?,?,?,?,?,?)')
 .run('aaa11111-1111-4111-8111-111111111111',T,'  pt uat conversion only ','IND-OLD','{}',B);
 const result=applyConversion(db);
 assert.equal(result.ok,false);assert.ok(result.error);
 assert.match(String(result.error),/UNIQUE/);
 const lead=db.prepare('SELECT status,version,converted_account_id FROM india_marketing_leads WHERE id=?').get(leadId);
 assert.equal(lead.status,'qualified');assert.equal(lead.version,3);assert.equal(lead.converted_account_id,null);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM india_sales_opportunities').get().n,0);
 db.close();
});
test('P0: new Marketing UI, middleware, backend audit and Sales pipeline are all reachable',()=>{
 const middleware=source('src/middleware.ts');
 assert.match(middleware,/path==='\/api\/leads'/);
 assert.match(middleware,/path==='\/api\/sales'/);
 assert.match(leadRoute,/canEditLead\(role,email,current\.owner_email\)/);
 assert.match(leadRoute,/const changes=await db\.batch/);
 const ui=source('src/app/marketing/leads/page.tsx');
 assert.match(ui,/Konversi Atomik/);assert.match(ui,/\/api\/leads\/convert/);
 assert.match(ui,/sm:grid-cols-2/);assert.match(ui,/rounded-t-2xl/);
 assert.match(source('src/app/api/sales/route.ts'),/india_sales_opportunities/);
 assert.match(source('src/components/layout/Sidebar.tsx'),/\/marketing\/leads/);
 assert.match(source('src/components/layout/MobileNav.tsx'),/\/marketing\/leads/);
});

test('P0: qualified Lead requires valid PIC phone and target closing date',()=>{
 const complete={budget_status:'Tersedia',decision_authority:'Direktur TI',
  requirement_summary:'Uji keamanan',target_date:'2026-11-30',
  qualification_notes:'Disepakati',contact_phone:'081200000010'};
 assert.deepEqual(role.validateQualification(complete),[]);
 assert.ok(role.validateQualification({...complete,contact_phone:''}).includes('contact_phone'));
 assert.ok(role.validateQualification({...complete,target_date:'tomorrow'}).includes('target_date (format YYYY-MM-DD)'));
 assert.ok(role.validateQualification({...complete,contact_phone:'123'}).includes('contact_phone (format)'));
});
test('P0: re-open qualification requires business justification; UI has gated path',()=>{
 assert.equal(role.canTransition('qualified','contacted'),true);
 assert.equal(role.canTransition('converted','contacted'),false);
 assert.match(leadRoute,/current\.status==='qualified'&&entries\.length>0/);
 assert.match(leadRoute,/reopenReason\.length<10/);
 assert.match(leadRoute,/REOPEN/);
 const page=source('src/app/marketing/leads/page.tsx');
 assert.match(page,/Buka ulang kualifikasi/);
 assert.match(page,/reason=response\.trim\(\)/);
});
