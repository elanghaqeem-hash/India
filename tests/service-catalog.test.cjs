// Real handlers + SQLite/D1 adapter with synthetic test identities, never live Access UAT.
const test=require('node:test'),assert=require('node:assert/strict');
const {Harness,users,expect}=require('./helpers/sales-flow-harness.cjs');
test('each catalog service persists through Lead registration, conversion, BoQ validation and Post-PO',async()=>{
 const h=new Harness();
 try{
  h.sql.prepare("INSERT INTO india_members(email,role,active) VALUES(?,'sales',1)").run(users.sales);
  const catalog=h.load('src/lib/sales-workflow.ts');
  const lead=h.load('src/lib/marketing-lead.ts');
  const boq=h.load('src/lib/boq-domain.ts');
  const link=h.load('src/lib/sales-boq-link.ts');
  const post=h.load('src/lib/sales-to-post-po.ts');
  const q={need:'Synthetic scoped need',budget_status:'Approved',decision_maker:'Synthetic sponsor',procurement_process:'Direct purchase'};
  assert.equal(catalog.SERVICE_CATALOG.length,new Set(catalog.SERVICE_FAMILIES).size);
  for(const [index,service] of catalog.SERVICE_CATALOG.entries()){
   const qualification={...q,procurement_process:catalog.PROCUREMENT_PROCESSES[index%catalog.PROCUREMENT_PROCESSES.length]};
   assert.ok(service.name.length<=60);
   assert.ok(service.guidance.length>20);
   const input={entity:'lead',request_key:crypto.randomUUID(),account_name:'Synthetic catalog client '+index,source:catalog.LEAD_SOURCES[index%catalog.LEAD_SOURCES.length],service_family:service.name,assigned_sales_email:users.sales,estimated_value_idr:1000000,expected_closing_date:'2026-12-31',contact_name:'Synthetic PIC',qualification};
   const created=await expect(h.call('marketing/leads','POST','marketing',input),201);
   const stored=h.sql.prepare('SELECT * FROM india_marketing_leads WHERE id=?').get(created.body.id);
   assert.equal(stored.service_family,service.name);
   assert.equal(stored.source,input.source);
   assert.equal(JSON.parse(stored.qualification_json).procurement_process,qualification.procurement_process);
   const validated=lead.validateLead(input);
   await expect(h.call('marketing/leads','PATCH','sales',{id:stored.id,version:stored.version,status:'qualified',qualification}),200);
   const qualified=h.sql.prepare('SELECT version FROM india_marketing_leads WHERE id=?').get(stored.id);
   const converted=await expect(h.call('marketing/leads','POST','sales',{entity:'convert',id:stored.id,version:qualified.version,opportunity_title:'Synthetic service '+index},'',{'x-india-lead-action':'convert'}),201);
   const row=h.sql.prepare('SELECT * FROM india_sales_opportunities WHERE id=?').get(converted.body.opportunity_id);
   const acct=h.sql.prepare('SELECT * FROM india_sales_accounts WHERE id=?').get(converted.body.customer_id);
   const fields=JSON.parse(row.data_json);
   assert.equal(fields.service_family,service.name);
   assert.equal(fields.lead_source,input.source);
   assert.equal(fields.procurement_process,qualification.procurement_process);
   assert.equal(lead.toOpportunityFields(validated,stored.id).service_family,fields.service_family);
   const account={...acct,fields:JSON.parse(acct.data_json)};
   const deal={...row,fields};
   const packet=post.prefillFromSales(account,deal,false);
   assert.equal(packet.project.serviceFamily,service.name);
   for(const type of service.boq){
    const payload=boq.validateBoQ({customer_name:account.legal_name,project_name:deal.title,quotation_number:'SYNTHETIC-'+index,service_type:type,vat_rate:0,payment_terms:'100',opportunity_id:deal.id,line_items:[{description:service.name,quantity:1,unit:'Paket',unit_price:1000000,service_type:type}]});
    assert.equal(link.checkBoqLink(payload,{...deal,data_json:JSON.stringify(fields)},account,'sales',users.sales),null);
   }
   assert.ok(service.boq.includes(catalog.defaultBoqService(service.name)));
  }
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_marketing_leads').get().n,catalog.SERVICE_CATALOG.length);
 }finally{h.close();}
});
test('catalog retains legacy services and rejects unknown Lead categories',()=>{
 const h=new Harness();try{
  const c=h.load('src/lib/sales-workflow.ts'),lead=h.load('src/lib/marketing-lead.ts');
  for(const name of ['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other'])assert.ok(c.isServiceFamily(name));
  assert.equal(c.isServiceFamily('Unknown injected category'),false);
  assert.throws(()=>lead.validateLead({account_name:'Synthetic client',source:'Test',service_family:'Unknown injected category',assigned_sales_email:users.sales}),/layanan wajib/);
  assert.equal(c.defaultBoqService('Other'),'Lainnya');
 }finally{h.close();}
});
