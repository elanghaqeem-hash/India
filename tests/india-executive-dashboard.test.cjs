const test=require('node:test'),assert=require('node:assert/strict');
const {Harness,users,tenant,expect}=require('./helpers/sales-flow-harness.cjs');
const month=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,7);
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const get=(h,role='sales',query='')=>h.call('sales/executive','GET',role,null,'?period='+month()+query);
const post=(h,role,p={},headers={})=>h.call('sales/executive','POST',role,{period:month(),owner_email:users.sales,amount_idr:2000000,version:0,rationale:'Approved commercial target for UAT',...p},'',headers);
function fixture(){
 const h=new Harness().seed();
 for(const email of [users.sales,users.other]){
  h.sql.prepare("INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,'sales',1)").run(email);
 }
 h.sql.prepare("UPDATE india_sales_opportunities SET data_json=json_set(data_json,'$.expected_closing_date',?) WHERE id='opp-qa'").run(today());
 return h;
}
test('D1 migration 0024 is additive and has no fabricated monthly targets',async()=>{
 const h=fixture();try{
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_targets').get().n,0);
  assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
  const r=await expect(get(h),200);
  assert.equal(r.body.totals.target_idr,null);
  assert.equal(r.body.totals.weighted_pipeline_idr,350000);
  assert.equal(r.body.totals.booked_idr,0);
  assert.equal(r.body.totals.win_rate_pct,null);
  assert.equal(r.body.totals.proposal_conversion_pct,null);
  assert.equal(r.body.totals.target_required,1);
  assert.equal(r.body.totals.target_defined,0);
  assert.equal(r.body.by_service[0].service,'VAPT');
 }finally{h.close();}
});
test('Access roles, ownership, owner filters, input validation and no cross-owner disclosure',async()=>{
 const h=fixture();try{
  for(const role of ['viewer','presales','legal'])await expect(get(h,role),403);
  // Registered Marketing fixtures remain forbidden from financial executive data.
  await expect(get(h,'marketing'),403);
  const other=await expect(get(h,'other'),200);
  assert.equal(other.body.totals.open_pipeline_idr,0);
  assert.equal(other.body.by_owner.length,1);
  assert.equal(other.body.by_owner[0].owner,users.other);
  await expect(get(h,'other','&owner='+encodeURIComponent(users.sales)),403);
  await expect(get(h,'sales','&owner='+encodeURIComponent(users.other)),403);
  const admin=await expect(get(h,'admin'),200);
  assert.equal(admin.body.by_owner.length,2);
  assert.equal(admin.body.totals.target_required,2);
  await expect(get(h,'finance','&owner='+encodeURIComponent(users.other)),200);
  await expect(h.call('sales/executive','GET','admin',null,'?period=2026-13'),422);
  await expect(h.call('sales/executive','GET','admin',null,'?period='+month()+'&format=xlsx'),422);
 }finally{h.close();}
});
test('Admin D1 target: role checks, CAS updates, immutable version/audit, correct attainment',async()=>{
 const h=fixture();try{
  await expect(post(h,'sales'),403);
  await expect(post(h,'finance'),403);
  await expect(post(h,'admin',{owner_email:users.admin}),422);
  await expect(post(h,'admin',{amount_idr:-10}),422);
  await expect(post(h,'admin',{amount_idr:NaN}),422);
  await expect(post(h,'admin',{rationale:'short'}),422);
  await expect(post(h,'admin',{}, {Origin:'https://forged.invalid'}),403);
  await expect(post(h,'admin'),201);
  await expect(post(h,'admin'),409);
  const d=await expect(get(h),200);
  assert.equal(d.body.totals.target_idr,2000000);
  assert.equal(d.body.totals.target_defined,1);
  assert.equal(d.body.totals.attainment_pct,0);
  assert.equal(d.body.totals.target_gap_idr,2000000);
  await expect(post(h,'admin',{version:1,amount_idr:2500000,rationale:'Quarterly target approved revision'}),201);
  assert.equal(h.sql.prepare('SELECT version FROM india_sales_targets').get().version,2);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_target_events').get().n,2);
  assert.throws(()=>h.sql.exec("UPDATE india_sales_target_events SET amount_idr=1"),/IMMUTABLE/);
  assert.throws(()=>h.sql.exec("DELETE FROM india_sales_target_events"),/IMMUTABLE/);
 }finally{h.close();}
});
test('Synthetic stale target guard and audit failure rollback preserve previous version',async()=>{
 const h=fixture();try{
  await expect(post(h,'admin'),201);
  h.beforeBatch=()=>h.sql.prepare("UPDATE india_sales_targets SET version=version+1").run();
  await expect(post(h,'admin',{version:1,amount_idr:9999999}),409);
  assert.equal(h.sql.prepare('SELECT amount_idr FROM india_sales_targets').get().amount_idr,2000000);
  h.sql.exec("CREATE TRIGGER injected_target_audit_failure BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  await expect(post(h,'admin',{version:2,amount_idr:3000000}),503);
  assert.equal(h.sql.prepare('SELECT amount_idr FROM india_sales_targets').get().amount_idr,2000000);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_target_events').get().n,1);
 }finally{h.close();}
});
test('Completed tasks count only actual performance, aging bins and verified proposal denominator',async()=>{
 const h=fixture();try{
  const completed=new Date().toISOString(),start=new Date(Date.now()-3600000).toISOString(),due=new Date(Date.now()+3600000).toISOString();
  for(const [id,kind,status] of [['task-1','call','completed'],['task-2','meeting','planned'],['task-3','visit','completed']]){
   h.sql.prepare("INSERT INTO india_sales_activity_tasks(id,tenant_id,opportunity_id,owner_email,kind,subject,start_at,due_at,reminder_at,status,completed_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id,tenant,'opp-qa',users.sales,kind,'QA visit or call',start,due,start,status,status==='completed'?completed:null,users.sales);
  }
  const r=await expect(get(h),200);
  assert.equal(r.body.totals.completed_activities,2);
  assert.equal(r.body.by_owner[0].calls,1);
  assert.equal(r.body.by_owner[0].visits,1);
  assert.equal(r.body.by_owner[0].meetings,0);
  assert.equal(r.body.totals.open_all,1);
  assert.equal(r.body.aging.reduce((x,b)=>x+b.count,0),1);
  assert.equal(r.body.totals.proposals_verified_period,0);
  assert.equal(r.body.totals.proposal_conversion_pct,null);
 }finally{h.close();}
});
test('Authenticated API uses approved PO Won and reviewed revenue only; proposal closure ratio is explicit',async()=>{
 const h=fixture();try{
  await h.awarded();
  await expect(h.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);
  await expect(h.stage('closed_won'),200);
  let r=await expect(get(h),200);
  assert.equal(r.body.totals.booked_idr,1000000);
  assert.equal(r.body.totals.recognized_revenue_idr,0);
  assert.equal(r.body.totals.won,1);
  assert.equal(r.body.totals.proposal_conversion_pct,100);
  assert.equal(r.body.totals.win_rate_pct,100);
  const revenue=await expect(h.call('sales/revenue','POST','finance',{opportunity_id:'opp-qa',flow_version:h.deal().flow_version,action:'record',recognition_date:today(),amount_before_vat:600000,ledger_reference:'GL-EXEC-DASH',invoice_reference:'INV-EXEC-DASH',acceptance_reference:'BAST-EXEC-DASH',evidence_sha256:'a'.repeat(64),notes:'GL invoice and BAST verified source'}),201);
  r=await expect(get(h),200);assert.equal(r.body.totals.recognized_revenue_idr,0);
  await expect(h.call('sales/revenue','POST','approver',{opportunity_id:'opp-qa',flow_version:h.deal().flow_version,action:'review',id:revenue.body.id,approve:true,review_notes:'Finance invoice and BAST reconciled independently'}),201);
  r=await expect(get(h),200);
  assert.equal(r.body.totals.recognized_revenue_idr,600000);
  assert.equal(r.body.by_service[0].revenue_idr,600000);
 }finally{h.close();}
});
test('CSV response is private and does not expose cross-owner data',async()=>{
 const h=fixture();try{
  const handler=h.load('src/app/api/sales/executive/route.ts');
  const req=new Request('https://flow.invalid/api/sales/executive?period='+month()+'&format=csv',{headers:{Origin:'https://flow.invalid','x-test-role':'other'}});
  const r=await handler.GET(req),body=await r.text();
  assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/no-store/);
  assert.ok(!body.includes(users.sales));
  assert.ok(body.includes(users.other));
 }finally{h.close();}
});
