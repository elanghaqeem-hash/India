const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {Harness,users,tenant,expect}=require('./helpers/sales-flow-harness.cjs');
const root=path.resolve(__dirname,'..');
const seed=(h,id,owner=users.sales,source='Referral',status='assigned')=>{
 h.sql.prepare(`INSERT INTO india_marketing_leads
 (id,tenant_id,lead_number,account_name,source,service_family,contact_name,contact_email,
 assigned_sales_email,estimated_value_idr,expected_closing_date,qualification_json,status,created_by,updated_by)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,tenant,'LD-'+id,'PT '+id,source,'VAPT','PIC '+id,
 'pic@qa.invalid',owner,50000000,'2026-12-31',JSON.stringify({
 need:'Annual VAPT and managed SOC',budget_status:'Approved',decision_maker:'CISO',procurement_process:'RFQ'
 }),status,owner,owner);
 return h.sql.prepare('SELECT * FROM india_marketing_leads WHERE id=?').get(id);
};
const post=(h,role,id,version,action,extra={})=>h.call('marketing/lead-intelligence','POST',role,{id,version,action,...extra});
const day=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const scoring=()=>new Harness();
test('scoring deterministic 100 cap, BANT readiness and budget negation without AI intent',()=>{
 const h=scoring();
 try{
  const d=h.load('src/lib/lead-intelligence.ts');
  const full={qualification:{need:'Annual VAPT',budget_status:'Approved',decision_maker:'CISO',procurement_process:'RFQ'},
   service_family:'VAPT',contact_email:'pic@qa.invalid',estimated_value_idr:50000,expected_closing_date:'2026-12-31',
   status:'assigned',meetings:30,calls:300,emails:200,follow_ups:100};
  assert.deepEqual(d.computeLeadScore(full).breakdown,{bant:60,fit:25,engagement:15});
  assert.equal(d.computeLeadScore(full).score,100);
  assert.equal(d.computeLeadScore(full).temperature,'Hot');
  assert.equal(d.computeLeadScore({...full,qualification:{need:'Annual VAPT',budget_status:'No budget',decision_maker:'CISO',procurement_process:'RFQ'},meetings:0,calls:0,emails:0,follow_ups:0}).breakdown.bant,45);
  assert.equal(d.computeLeadScore({...full,qualification:{},contact_email:'',estimated_value_idr:0,expected_closing_date:'',meetings:0,calls:0,emails:0,follow_ups:0}).temperature,'Cold');
  assert.equal(d.canReactivate('NO_FIT'),false);assert.equal(d.canReactivate('TIMING_LATER'),true);
  assert.equal(d.validISODate('2026-02-30'),false);
  assert.equal(d.advanceDate('2026-12-30',7),'2027-01-06');
 }finally{h.close();}
});
test('0014 additive schema preserves existing Lead and immutable lifecycle events',()=>{
 const h=scoring();try{
  seed(h,'lead-preserve');assert.equal(h.sql.prepare("SELECT version FROM india_schema_migrations WHERE version=14").get().version,14);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_lead_nurture_plans').get().n,0);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_lead_disqualifications').get().n,0);
  h.sql.prepare("INSERT INTO india_lead_intelligence_events(id,tenant_id,lead_id,event_type,actor_email,detail) VALUES(?,?,?,?,?,?)")
   .run('evt-qa',tenant,'lead-preserve','PLAN',users.sales,'Plan created');
  assert.throws(()=>h.sql.exec("UPDATE india_lead_intelligence_events SET detail='mutated'"),/immutable/);
  assert.throws(()=>h.sql.exec("DELETE FROM india_lead_intelligence_events"),/immutable/);
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{h.close();}
});
test('role isolation: viewer and Sales B cannot read or change Sales A lead',async()=>{
 const h=scoring();try{
  seed(h,'lead-owner');
  assert.equal((await post(h,'viewer','lead-owner',1,'disqualify',{reason_code:'TIMING_LATER',reason_text:'Not ready'})).status,403);
  assert.equal((await post(h,'other','lead-owner',1,'disqualify',{reason_code:'TIMING_LATER',reason_text:'Not ready'})).status,403);
  assert.equal((await h.call('marketing/lead-intelligence','GET','other',null,'?mode=detail&id=lead-owner')).status,403);
  const q=await expect(h.call('marketing/lead-intelligence','GET','other',null,'?mode=queue'),200);
  assert.equal(q.body.leads.length,0);
 }finally{h.close();}
});
test('soft disqualification creates reason-coded plan and immutable audit in one batch',async()=>{
 const h=scoring();try{
  seed(h,'lead-soft');
  const out=await expect(post(h,'sales','lead-soft',1,'disqualify',{reason_code:'TIMING_LATER',reason_text:'Decision in Q1'}),200);
  assert.equal(out.body.status,'disqualified');assert.equal(out.body.nurture,'active');
  assert.equal(h.sql.prepare("SELECT status,version FROM india_marketing_leads WHERE id='lead-soft'").get().version,2);
  assert.equal(h.sql.prepare("SELECT reason_code FROM india_lead_disqualifications WHERE lead_id='lead-soft'").get().reason_code,'TIMING_LATER');
  assert.equal(h.sql.prepare("SELECT state FROM india_lead_nurture_plans WHERE lead_id='lead-soft'").get().state,'active');
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_lead_intelligence_events WHERE lead_id='lead-soft'").get().n,1);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE entity_id='lead-soft' AND action='DISQUALIFY'").get().n,1);
  assert.equal((await post(h,'sales','lead-soft',1,'disqualify',{reason_code:'TIMING_LATER',reason_text:'Repeated'})).status,409);
 }finally{h.close();}
});
test('nurture plan touch advances date, records real activity and rejects stale retry',async()=>{
 const h=scoring();try{
  seed(h,'lead-touch');
  const x=await expect(post(h,'sales','lead-touch',1,'plan',{cadence_days:7,channel:'call',next_touch_at:day()}),200);
  assert.equal(x.body.plan_version,1);
  const first=await expect(post(h,'sales','lead-touch',1,'touch',{plan_version:1,cadence_days:7,channel:'call',next_touch_at:day(),summary:'Spoke to prospect about Q4'}),200);
  assert.equal(first.body.plan_version,2);
  assert.equal(h.sql.prepare("SELECT touch_count FROM india_lead_nurture_plans WHERE lead_id='lead-touch'").get().touch_count,1);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_marketing_activities WHERE lead_id='lead-touch'").get().n,1);
  assert.equal((await post(h,'sales','lead-touch',1,'touch',{plan_version:1,cadence_days:7,channel:'call',next_touch_at:day(),summary:'Duplicate attempt'})).status,409);
  assert.equal(h.sql.prepare("SELECT touch_count FROM india_lead_nurture_plans WHERE lead_id='lead-touch'").get().touch_count,1);
 }finally{h.close();}
});
test('reactivation on eligible reason returns to assigned without duplicate Customer',async()=>{
 const h=scoring();try{
  seed(h,'lead-reactivate');
  await expect(post(h,'sales','lead-reactivate',1,'disqualify',{reason_code:'NO_BUDGET',reason_text:'Budget next quarter'}),200);
  await expect(post(h,'sales','lead-reactivate',2,'reactivate'),200);
  assert.equal(h.sql.prepare("SELECT status,version FROM india_marketing_leads WHERE id='lead-reactivate'").get().status,'assigned');
  assert.equal(h.sql.prepare("SELECT active FROM india_lead_disqualifications WHERE lead_id='lead-reactivate'").get().active,0);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_lead_links').get().n,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_lead_intelligence_events WHERE lead_id='lead-reactivate'").get().n,2);
 }finally{h.close();}
});
test('permanent disqualification cannot be reactivated',async()=>{
 const h=scoring();try{
  seed(h,'lead-no-fit');
  await expect(post(h,'sales','lead-no-fit',1,'disqualify',{reason_code:'NO_FIT',reason_text:'Only hardware acquisition'}),200);
  assert.equal(h.sql.prepare("SELECT state FROM india_lead_nurture_plans WHERE lead_id='lead-no-fit'").get().state,'cancelled');
  assert.equal((await post(h,'sales','lead-no-fit',2,'reactivate')).status,409);
  assert.equal(h.sql.prepare("SELECT status FROM india_marketing_leads WHERE id='lead-no-fit'").get().status,'disqualified');
 }finally{h.close();}
});
test('conversion gate: qualifying an active nurtured Lead completes schedule via trigger',async()=>{
 const h=scoring();try{
  seed(h,'lead-qualify');
  await expect(post(h,'sales','lead-qualify',1,'plan',{cadence_days:14,channel:'meeting',next_touch_at:day()}),200);
  const x=await expect(h.call('marketing/leads','PATCH','sales',{id:'lead-qualify',version:1,status:'qualified',qualification:{
   need:'Annual VAPT and managed SOC',budget_status:'Approved',decision_maker:'CISO',procurement_process:'RFQ'
  }}),200);
  assert.equal(x.body.status,'qualified');
  assert.equal(h.sql.prepare("SELECT state FROM india_lead_nurture_plans WHERE lead_id='lead-qualify'").get().state,'completed');
 }finally{h.close();}
});
test('audit injection rolls back disqualification, reason and nurture plan',async()=>{
 const h=scoring();try{
  seed(h,'lead-audit');
  h.sql.exec("CREATE TRIGGER inject_lead_intelligence_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  assert.equal((await post(h,'sales','lead-audit',1,'disqualify',{reason_code:'NO_RESPONSE',reason_text:'No response after follow-up'})).status,503);
  assert.equal(h.sql.prepare("SELECT status,version FROM india_marketing_leads WHERE id='lead-audit'").get().status,'assigned');
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_lead_disqualifications").get().n,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_lead_nurture_plans").get().n,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_lead_intelligence_events").get().n,0);
 }finally{h.close();}
});
test('analytics counts full visible cohort and excludes cross-owner private Leads',async()=>{
 const h=scoring();try{
  seed(h,'lead-conv-a',users.sales,'Webinar');
  seed(h,'lead-conv-b',users.other,'Referral');
  await expect(post(h,'other','lead-conv-b',1,'disqualify',{reason_code:'NO_FIT',reason_text:'Wrong service'}),200);
  const onlyA=await expect(h.call('marketing/lead-intelligence','GET','sales',null,'?mode=analytics'),200);
  const admin=await expect(h.call('marketing/lead-intelligence','GET','admin',null,'?mode=analytics'),200);
  assert.equal(onlyA.body.overall.total,1);assert.equal(onlyA.body.overall.disqualified,0);
  assert.equal(admin.body.overall.total,2);assert.equal(admin.body.overall.disqualified,1);
  assert.equal(admin.body.by_reason[0].label,'NO_FIT');
  assert.equal(admin.body.by_campaign.reduce((n,x)=>n+x.total,0),2);
 }finally{h.close();}
});
test('legacy PATCH disqualification bypass is rejected: reason code only through lifecycle',async()=>{
 const h=scoring();try{
  seed(h,'lead-legacy');
  const x=await h.call('marketing/leads','PATCH','sales',{id:'lead-legacy',version:1,status:'disqualified',
   qualification:{disqualification_reason:'Legacy bypass'}});
  assert.equal(x.status,422);
  assert.equal(h.sql.prepare("SELECT status FROM india_marketing_leads WHERE id='lead-legacy'").get().status,'assigned');
 }finally{h.close();}
});

test('stale disqualification CAS rolls back all reason, nurture, event and audit writes',async()=>{
 const h=scoring();try{
  seed(h,'lead-race');
  h.beforeBatch=()=>h.sql.prepare("UPDATE india_marketing_leads SET version=version+1 WHERE id='lead-race'").run();
  const r=await post(h,'sales','lead-race',1,'disqualify',{reason_code:'NO_BUDGET',reason_text:'Concurrent review'});
  assert.equal(r.status,409,JSON.stringify(r));
  assert.equal(h.sql.prepare("SELECT status FROM india_marketing_leads WHERE id='lead-race'").get().status,'assigned');
  for(const table of ['india_lead_disqualifications','india_lead_nurture_plans','india_lead_intelligence_events'])
   assert.equal(h.sql.prepare('SELECT count(*) n FROM '+table).get().n,0,table);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE entity_id='lead-race'").get().n,0);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_tx_guards').get().n,0);
 }finally{h.close();}
});
test('stale nurture version fails closed without duplicate touch or audit events',async()=>{
 const h=scoring();try{
  seed(h,'lead-race-plan');
  await expect(post(h,'sales','lead-race-plan',1,'plan',{cadence_days:7,channel:'call',next_touch_at:day()}),200);
  h.beforeBatch=()=>h.sql.prepare("UPDATE india_lead_nurture_plans SET version=version+1 WHERE lead_id='lead-race-plan'").run();
  const r=await post(h,'sales','lead-race-plan',1,'touch',{plan_version:1,cadence_days:7,channel:'call',next_touch_at:day(),summary:'Stale touch attempt'});
  assert.equal(r.status,409,JSON.stringify(r));
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_marketing_activities WHERE lead_id='lead-race-plan'").get().n,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_lead_intelligence_events WHERE lead_id='lead-race-plan' AND event_type='TOUCH'").get().n,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_sales_tx_guards").get().n,0);
 }finally{h.close();}
});
