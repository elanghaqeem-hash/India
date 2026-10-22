const test=require('node:test'),assert=require('node:assert/strict');
const {Harness,expect,users,tenant}=require('./helpers/sales-flow-harness.cjs');
const api=(h,role,p)=>h.call('sales/feasibility','POST',role,{opportunity_id:'opp-qa',flow_version:h.deal().flow_version,...p});
const get=(h,role='sales')=>h.call('sales/feasibility','GET',role,null,'?opportunity_id=opp-qa');
const start='2026-11-01',end='2026-11-30';
const plan={action:'plan',service_line:'VAPT',start_date:start,end_date:end,months:1,asset_count:2,pd_per_asset:3,retest_pct:20,
 coordination_pd:1,base_pd:0,coverage_hours:0,staffing:0,coverage_days:0,target_margin_pct:25};
async function setup(h){
 await expect(api(h,'presales',plan),201);
 const person=await expect(api(h,'finance',{action:'resource',display_name:'Certified Red Team Engineer',
  email:'vapt@flow.invalid',skills:'OSCP; Mobile; API',capacity_pd_month:10,daily_cost_idr:10000}),201);
 const allocation=await expect(api(h,'presales',{action:'allocate',person_id:person.body.id,allocation_month:'2026-11',
  work_role:'Lead Pentester',person_days:8.2}),201);
 return {personId:person.body.id,allocationId:allocation.body.id};
}
test('0025 SQLite migration is additive and has FK/history protections',()=>{
 const h=new Harness().seed();
 try{
  assert.equal(h.sql.prepare('SELECT version FROM india_schema_migrations WHERE version=25').get().version,25);
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
  const mod=h.load('src/lib/solution-feasibility.ts');
  assert.equal(mod.requiredPersonDays(plan),8.2);
  assert.equal(mod.requiredPersonDays({...plan,service_line:'SOC/MDR',months:12,coverage_hours:24,staffing:2,coverage_days:30}),2161);
  assert.equal(mod.monthCount('2026-11-01','2027-02-28'),4);
  assert.equal(mod.isoDate('2026-02-30'),false);
  assert.throws(()=>mod.validatePlan({...plan,months:2}),/bulan/);
 }finally{h.close();}
});
test('authenticated roles, independent review, readiness and onward stage are D1 backed',async()=>{
 const h=new Harness().seed();
 try{
  await expect(api(h,'sales',plan),403);
  await expect(api(h,'presales',{...plan,start_date:'2026-02-30'}),422);
  await setup(h);
  let r=await expect(get(h,'finance'),200);
  assert.equal(r.body.report.required_pd,8.2);
  assert.equal(r.body.report.approval_ready,true);
  assert.equal(r.body.report.internal_cost_idr,82000);
  r=await expect(get(h,'sales'),200);
  assert.equal(r.body.report.internal_cost_idr,null);
  assert.equal(r.body.people[0].daily_cost_idr,undefined);
  await expect(get(h,'other'),403);
  const version=h.sql.prepare('SELECT version FROM india_feasibility_plans').get().version;
  await expect(api(h,'presales',{action:'review',version,decision:'approved',review_notes:'Self approval cannot be permitted here'}),403);
  await expect(h.flow('scope','presales'),201);
  await expect(h.flow('propose','sales',{proposal_reference:'archive/proposal/QA-01',proposal_sha256:'a'.repeat(64)}),200);
  await expect(h.flow('approve','approver'),200);
  await expect(h.stage('solution_design'),200);
  await expect(h.stage('commercial_review'),409);
  await expect(api(h,'approver',{action:'review',version,decision:'approved',review_notes:'Independent engineering capacity and gross margin verified'}),201);
  r=await expect(get(h,'finance'),200);
  assert.equal(r.body.report.ready,true);
  await expect(h.stage('commercial_review'),200);
 }finally{h.close();}
});
test('cross-Opportunity overbooking and negative financial input reject atomically',async()=>{
 const h=new Harness().seed();
 try{
  const {personId}=await setup(h);
  await expect(api(h,'presales',{action:'allocate',person_id:personId,allocation_month:'2026-11',work_role:'Repeat',person_days:1}),409);
  const cost=await api(h,'sales',{action:'cost',cost_type:'license',description:'Should be denied',sku:'SKU-1',unit:'seat',quantity:1,periods:1,unit_price_idr:100});
  assert.equal(cost.status,403);
  await expect(api(h,'finance',{action:'cost',cost_type:'license',description:'Invalid infinity',sku:'SKU-1',unit:'seat',quantity:1,periods:1,unit_price_idr:-1}),422);
  h.sql.prepare('INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,data_json,created_by) VALUES (?,?,?,?,?,?,?,?)')
   .run('opp-b',tenant,'account-qa','Other QA Project','discovery',500000,'{}',users.other);
  assert.throws(()=>h.sql.prepare("INSERT INTO india_resource_allocations(id,tenant_id,opportunity_id,person_id,allocation_month,work_role,person_days,daily_cost_snapshot,created_by) VALUES (?,?,?,?,?,?,?,?,?)")
   .run('cross-alloc',tenant,'opp-b',personId,'2026-11','Other Project',2,10000,users.other),/RESOURCE_CAPACITY_CONFLICT/);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_resource_allocations WHERE status='active'").get().n,1);
 }finally{h.close();}
});
test('supplier licensing with expiry and vendor offer capacity is fail closed',async()=>{
 const h=new Harness().seed();
 try{
  await expect(api(h,'presales',{...plan,service_line:'FortiSIEM',asset_count:0,pd_per_asset:0,retest_pct:0,base_pd:5,coordination_pd:1}),201);
  const e=await expect(api(h,'finance',{action:'resource',display_name:'FortiSIEM Engineer',email:'siem@flow.invalid',skills:'Fortinet SIEM',capacity_pd_month:20,daily_cost_idr:10000}),201);
  await expect(api(h,'presales',{action:'allocate',person_id:e.body.id,allocation_month:'2026-11',work_role:'SIEM Engineer',person_days:6}),201);
  const vendor='valid-vendor',offer='valid-offer',sha='a'.repeat(64);
  h.sql.prepare(`INSERT INTO india_vendors(id,tenant_id,legal_name,registration_number,contact_email,capabilities,capacity_units,capacity_unit,evidence_reference,evidence_sha256,valid_until,status,created_by,reviewed_by)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(vendor,tenant,'Certified Fortinet Reseller','REG-SIEM','reseller@flow.invalid','FortiSIEM implementation licensing',20,'license','archive/vendor/license',sha,'2027-01-30','validated',users.sales,users.finance);
  h.sql.prepare(`INSERT INTO india_vendor_offers(id,tenant_id,opportunity_id,vendor_id,scope,quantity,unit,unit_price_idr,capacity_confirmed,valid_until,evidence_reference,evidence_sha256,status,created_by,reviewed_by)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(offer,tenant,'opp-qa',vendor,'FortiSIEM license procurement',10,'license',1000,10,'2026-10-01','archive/vendor/quote',sha,'validated',users.sales,users.finance);
  await expect(api(h,'finance',{action:'cost',cost_type:'license',description:'FortiSIEM 10 seats',sku:'FT-SIEM-10',unit:'license',quantity:10,periods:1,unit_price_idr:1000,supplier_offer_id:offer}),409);
  h.sql.prepare("UPDATE india_vendor_offers SET valid_until='2027-01-30' WHERE id=?").run(offer);
  await expect(api(h,'finance',{action:'cost',cost_type:'license',description:'FortiSIEM 10 seats',sku:'FT-SIEM-10',unit:'license',quantity:10,periods:1,unit_price_idr:999,supplier_offer_id:offer}),409);
  await expect(api(h,'finance',{action:'cost',cost_type:'license',description:'FortiSIEM 10 seats',sku:'FT-SIEM-10',unit:'license',quantity:10,periods:1,unit_price_idr:1000,supplier_offer_id:offer}),201);
  const approved=await expect(get(h,'finance'),200);assert.equal(approved.body.report.approval_ready,true);
  const version=h.sql.prepare('SELECT version FROM india_feasibility_plans').get().version;
  await expect(api(h,'approver',{action:'review',version,decision:'approved',review_notes:'Licenses, supplier evidence and vendor expiry reviewed'}),201);
  h.sql.prepare("UPDATE india_vendor_offers SET valid_until='2026-10-01' WHERE id=?").run(offer);
  const stale=await expect(get(h,'finance'),200);assert.equal(stale.body.report.ready,false);
  assert.match(stale.body.report.gaps.join(' '),/kedaluwarsa/);
 }finally{h.close();}
});
test('changing cost or allocation invalidates approval, preserves immutable history and sales export gate',async()=>{
 const h=new Harness().seed();
 try{
  const {personId,allocationId}=await setup(h);
  let version=h.sql.prepare('SELECT version FROM india_feasibility_plans').get().version;
  await expect(api(h,'approver',{action:'review',version,decision:'approved',review_notes:'Capacity and resource plan independently approved'}),201);
  await expect(api(h,'presales',{action:'cancel_allocation',id:allocationId}),201);
  const p=h.sql.prepare('SELECT status,version FROM india_feasibility_plans').get();
  assert.equal(p.status,'draft');assert.ok(p.version>version);
  const audit=h.sql.prepare('SELECT count(*) n FROM india_feasibility_history').get().n;
  assert.ok(audit>=3);
  assert.throws(()=>h.sql.exec('DELETE FROM india_feasibility_history'),/FEASIBILITY_HISTORY_IMMUTABLE/);
  const x=await expect(get(h,'admin'),200);
  assert.equal(x.body.report.ready,false);
  assert.ok(x.body.report.gaps.some(s=>/Person-days/.test(s)));
  await expect(api(h,'presales',{action:'allocate',person_id:personId,allocation_month:'2026-11',work_role:'Replacement',person_days:8.2}),201);
  const g=h.load('src/lib/solution-feasibility-gate.ts');
  assert.equal(await g.feasibilityReady(h,'opp-qa'),false);
 }finally{h.close();}
});
