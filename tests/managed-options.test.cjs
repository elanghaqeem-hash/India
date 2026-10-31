const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Harness,expect}=require('./helpers/sales-flow-harness.cjs');
const {LEAD_SOURCES,PROCUREMENT_PROCESSES,SERVICE_FAMILIES}=require('../src/lib/sales-workflow.ts');
const source=p=>fs.readFileSync(p,'utf8');

test('expanded PR64 catalog preserves legacy services and managed option catalogs',()=>{
 assert.equal(LEAD_SOURCES.length,22);
 assert.equal(new Set(LEAD_SOURCES).size,22);
 assert.equal(PROCUREMENT_PROCESSES.length,15);
 assert.equal(new Set(PROCUREMENT_PROCESSES).size,15);
 assert.equal(SERVICE_FAMILIES.length,35);
 assert.equal(new Set(SERVICE_FAMILIES).size,35);
 for(const legacy of ['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other']) assert.ok(SERVICE_FAMILIES.includes(legacy));
});
test('Lead, Qualification and Pipeline use the same Admin-managed authenticated dropdown',()=>{
 const widget=source('src/components/sales/ManagedOptionSelect.tsx');
 const lead=source('src/app/sales/leads/page.tsx');
 const pipeline=source('src/app/sales/pipeline/page.tsx');
 assert.match(widget,/\/api\/reference\/options\?group=/);
 assert.match(widget,/credentials:'same-origin'/);
 assert.match(widget,/new Map<string,string>/);
 assert.match(widget,/data sebelumnya/);
 assert.match(widget,/if\(current&&!choices.has\(current\)\)/);
 assert.match(lead,/group="lead_source"/);
 assert.match(lead,/group="procurement_process"/);
 assert.match(lead,/disabled=\{selected.lead.status==='converted'\}/);
 assert.match(pipeline,/key==='lead_source'\|\|key==='procurement_process'/);
 assert.doesNotMatch(widget,/\/api\/admin\/options/);
});
test('Staff reads active D1 options and updates are Admin-only with audit and optimistic concurrency',async()=>{
 const h=new Harness(true,true).seed();
 const p={action:'save',group_key:'lead_source',option_value:'partner_referral',option_label:'Referral Partner',description:'Disetujui Admin',sort_order:10,active:true,version:0};
 try{
  await expect(h.call('admin/options','POST','sales',p),403);
  await expect(h.call('admin/options','POST','admin',p),201);
  const r=await expect(h.call('reference/options','GET','sales',null,'?group=lead_source'),200);
  assert.deepEqual(r.body.items,[{value:p.option_value,label:p.option_label}]);
  await expect(h.call('admin/options','POST','admin2',{...p,version:1,active:false}),200);
  const r2=await expect(h.call('reference/options','GET','sales',null,'?group=lead_source'),200);
  assert.deepEqual(r2.body.items,[]);
 }finally{h.close();}
});
