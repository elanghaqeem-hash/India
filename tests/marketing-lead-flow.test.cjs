const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.join(__dirname,'../src/lib');
const mods=new Map();
function load(name){
 if(mods.has(name))return mods.get(name);
 const src=fs.readFileSync(path.join(root,name+'.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const mod={exports:{}};mods.set(name,mod.exports);
 new Function('require','module','exports',js)(s=>{
  if(s==='./sales-workflow')return load('sales-workflow');
  if(s==='./boq-domain')return load('boq-domain');
  throw Error('Unexpected dependency '+s);
 },mod,mod.exports);
 mods.set(name,mod.exports);return mod.exports;
}
const lead=load('marketing-lead'),link=load('sales-boq-link');
const input={account_name:'PT UAT Cybersecurity',source:'Webinar',campaign:'FSI October',
 service_family:'VAPT',contact_name:'PIC UAT',contact_email:'pic@example.test',
 assigned_sales_email:'sales@example.test',estimated_value_idr:200000000,
 expected_closing_date:'2026-11-30',qualification:{
  need:'Annual VAPT',budget_status:'Available',decision_maker:'CISO',
  procurement_process:'RFQ',discovery_notes:'Two web apps',contact_phone:'081234567890'
 }};
test('01 Marketing Lead accepts source, campaign, owner, qualified fields with no fabricated defaults',()=>{
 const validated=lead.validateLead(input);
 assert.equal(validated.account_name,input.account_name);
 assert.equal(validated.source,'Webinar');
 assert.equal(validated.qualification.need,'Annual VAPT');
 assert.equal(validated.estimated_value_idr,200000000);
});
test('02 lead validation rejects missing company, malformed value and bad owner identity',()=>{
 for(const [key,v] of [['account_name',''],['assigned_sales_email','not-an-email'],['service_family','firewall unknown'],['estimated_value_idr',-1]])
  assert.throws(()=>lead.validateLead({...input,[key]:v}),Error);
 assert.throws(()=>lead.validateLead({...input,qualification:{secret_ignored:'X'}}),Error);
});
test('03 Lead MQL/SQL stage gate enforces BANT qualification before conversion',()=>{
 assert.deepEqual(lead.leadTransition('new','assigned',{}),[]);
 assert.deepEqual(lead.leadTransition('new','qualified',{}).sort(),
  ['budget_status','decision_maker','need','procurement_process'].sort());
 assert.deepEqual(lead.leadTransition('assigned','qualified',input.qualification),[]);
 assert.match(lead.leadTransition('assigned','converted',input.qualification).join(' '),/Qualified/);
 assert.deepEqual(lead.leadTransition('qualified','converted',input.qualification),[]);
 assert.deepEqual(lead.leadTransition('qualified','disqualified',{}),['disqualification_reason']);
 assert.ok(lead.leadTransition('converted','qualified',input.qualification).length>0);
});
test('04 source fields transfer to prospecting Opportunity without default PO or approval',()=>{
 const v=lead.toOpportunityFields(lead.validateLead(input),'LD-TEST001');
 assert.equal(v.lead_source,'Webinar');
 assert.equal(v.sales_owner,'sales@example.test');
 assert.equal(v.client_need,'Annual VAPT');
 assert.equal(v.estimated_value,undefined);
 assert.equal(v.boq_id,undefined);
 assert.equal(v.po_number,undefined);
 assert.match(v.opportunity_notes,/LD-TEST001/);
});
test('05 BoQ and Sales must match Opportunity ID, company, project, service family and creator',()=>{
 const data={opportunity_id:'TEST-DEAL',customer_name:'PT UAT Cybersecurity',project_name:'VAPT UAT',
  quotation_number:'TEST-Q001',service_type:'VAPT',payment_terms:'50-50',vat_rate:0.11,
  line_items:[{description:'VAPT',quantity:1,unit:'service',unit_price:200000000,service_type:'VAPT'}]};
 const d={id:'TEST-DEAL',company_id:'TEST-ACCT',title:'VAPT UAT',stage:'discovery',created_by:'sales@example.test',data_json:JSON.stringify({service_family:'VAPT'})};
 const a={id:'TEST-ACCT',legal_name:'PT UAT Cybersecurity'};
 assert.equal(link.checkBoqLink(data,d,a,'sales','sales@example.test'),null);
 assert.match(link.checkBoqLink({...data,opportunity_id:null},d,a,'sales','sales@example.test'),/wajib/);
 assert.match(link.checkBoqLink(data,d,a,'sales','other@example.test'),/sendiri/);
 assert.match(link.checkBoqLink({...data,project_name:'Other Project'},d,a,'admin','admin@example.test'),/proyek/);
 assert.match(link.checkBoqLink({...data,customer_name:'Wrong Entity'},d,a,'finance','finance@example.test'),/perusahaan/);
 assert.match(link.checkBoqLink({...data,service_type:'SOC'},d,a,'admin','admin@example.test'),/Jenis layanan/);
 assert.match(link.checkBoqLink(data,{...d,stage:'closed_won'},a,'admin','admin@example.test'),/ditutup/);
});
test('06 Lead conversion is atomic D1 batch with dedupe, immutable link and Cloudflare Access role checks',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/marketing/leads/route.ts'),'utf8');
 for(const str of ['authorizeBoQ(req)','india_sales_accounts','india_sales_opportunities','india_sales_lead_links','db.batch(statements)','role===\'sales\'','row.status===\'converted\'']){
  assert.ok(route.includes(str),'Missing conversion gate '+str);
 }
 const sql=fs.readFileSync(path.join(__dirname,'../migrations/0005_marketing_lead_flow.sql'),'utf8');
 assert.match(sql,/UNIQUE\(tenant_id,lead_number\)/);
 assert.match(sql,/opportunity_id TEXT NOT NULL UNIQUE/);
 assert.match(sql,/CHECK\(status IN \('new','assigned','qualified','disqualified','converted'\)\)/);
});
test('07 authenticated Marketing route is allowlisted without enabling demo APIs',()=>{
 const mid=fs.readFileSync(path.join(__dirname,'../src/middleware.ts'),'utf8');
 assert.match(mid,/\/api\/marketing\/leads/);
 assert.match(mid,/API demo nonpersisten dinonaktifkan/);
 const auth=fs.readFileSync(path.join(root,'boq-auth.ts'),'utf8');
 assert.match(auth,/\['admin','marketing','finance'/);
});
