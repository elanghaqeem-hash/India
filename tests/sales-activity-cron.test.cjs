const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 sql.exec(`CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE india_members(email TEXT PRIMARY KEY,role TEXT,active INTEGER);
 CREATE TABLE india_marketing_leads(id TEXT PRIMARY KEY,tenant_id TEXT,account_name TEXT,lead_number TEXT,assigned_sales_email TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE india_sales_opportunities(id TEXT PRIMARY KEY,tenant_id TEXT);
 INSERT INTO india_members VALUES('sales-a@example.test','sales',1),('sales-b@example.test','sales',1),('manager@example.test','admin',1),('backup@example.test','admin',1);
 INSERT INTO india_marketing_leads(id,tenant_id,account_name,lead_number,assigned_sales_email,status,created_at)
 VALUES('lead-old','defendit360','Customer X','LD-OLD','sales-a@example.test','new',datetime('now','-4 hours')); `);
 sql.exec(fs.readFileSync('migrations/0013_sales_activity_orchestration.sql','utf8'));
 return sql;
}
function adapter(sql){
 return {prepare(query){const statement=sql.prepare(query);
  return {bind(...args){statement.bind(...args);return this;},async run(){return statement.run();},async first(){return statement.get()||null;}};
 },async batch(statements){
  sql.exec('BEGIN');
  try{for(const statement of statements)await statement.run();sql.exec('COMMIT');}
  catch(e){sql.exec('ROLLBACK');throw e;}
 }};
}
async function runCron(sql){
 const mod=await import(pathToFileURL(path.resolve('automation/sales-cron/src/index.js')).href+'?v=1');
 const pending=[];
 await mod.default.scheduled({}, {INDIA_DB:adapter(sql)}, {waitUntil(p){pending.push(p);}});
 await Promise.all(pending);
}
function task(sql,id,owner,minutesAgo=120){
 sql.prepare(`INSERT INTO india_sales_activity_tasks(id,tenant_id,opportunity_id,owner_email,kind,subject,start_at,due_at,reminder_at,created_by)
 VALUES (?,'defendit360','opp-1',?,'call','Call customer',strftime('%Y-%m-%dT%H:%M:%SZ','now',?),strftime('%Y-%m-%dT%H:%M:%SZ','now',?),strftime('%Y-%m-%dT%H:%M:%SZ','now',?),?)`)
 .run(id,owner,'-'+(minutesAgo+30)+' minutes','-'+minutesAgo+' minutes','-'+(minutesAgo+45)+' minutes',owner);
}
test('migration 0013 preserves prior leads and records SLA only for actual responders',()=>{
 const d=fixture();try{
  assert.equal(d.prepare('SELECT version FROM india_schema_migrations WHERE version=13').get().version,13);
  assert.equal(d.prepare('SELECT count(*) n FROM india_marketing_leads').get().n,1);
  assert.equal(d.prepare('SELECT count(*) n FROM india_sales_lead_sla').get().n,1);
  d.prepare("INSERT INTO india_marketing_leads(id,tenant_id,account_name,lead_number,assigned_sales_email,status) VALUES('lead-new','defendit360','Client B','LD-NEW','sales-b@example.test','new')").run();
  assert.equal(d.prepare("SELECT owner_email FROM india_sales_lead_sla WHERE lead_id='lead-new'").get().owner_email,'sales-b@example.test');
  d.prepare("UPDATE india_marketing_leads SET assigned_sales_email='sales-a@example.test' WHERE id='lead-new'").run();
  assert.equal(d.prepare("SELECT owner_email FROM india_sales_lead_sla WHERE lead_id='lead-new'").get().owner_email,'sales-a@example.test');
  assert.equal(d.prepare("SELECT first_response_at FROM india_sales_lead_sla WHERE lead_id='lead-new'").get().first_response_at,null);
 }finally{d.close();}
});
test('cron generates owner overdue and lead SLA plus manager escalation without duplicates',async()=>{
 const d=fixture();try{
  d.prepare("INSERT INTO india_sales_opportunities VALUES ('opp-1','defendit360')").run();
  d.prepare("INSERT INTO india_sales_team_managers(tenant_id,sales_email,manager_email,assigned_by) VALUES('defendit360','sales-a@example.test','manager@example.test','backup@example.test')").run();
  task(d,'task-overdue','sales-a@example.test');
  // Expire the UAT fixture SLA deliberately; historic production leads receive grace after migration.
  d.prepare("UPDATE india_sales_lead_sla SET response_due_at=strftime('%Y-%m-%dT%H:%M:%SZ','now','-120 minutes') WHERE lead_id='lead-old'").run();
  await runCron(d);const once=d.prepare('SELECT count(*) n FROM india_sales_activity_alerts').get().n;
  assert.equal(once,4);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE recipient_email='manager@example.test'").get().n,2);
  await runCron(d);assert.equal(d.prepare('SELECT count(*) n FROM india_sales_activity_alerts').get().n,once);
  assert.deepEqual(d.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{d.close();}
});
test('unassigned manager goes to active Admin inbox; completed tasks do not get new alerts',async()=>{
 const d=fixture();try{
  d.prepare("INSERT INTO india_sales_opportunities VALUES ('opp-1','defendit360')").run();
  task(d,'task-unmapped','sales-b@example.test');
  task(d,'task-done','sales-b@example.test');
  d.prepare("UPDATE india_sales_activity_tasks SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id='task-done'").run();
  await runCron(d);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE task_id='task-done'").get().n,0);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE task_id='task-unmapped' AND alert_type='unassigned_manager'").get().n,2);
 }finally{d.close();}
});
test('activity events immutable and failed audit rolls back a task modification',()=>{
 const d=fixture();try{
  d.prepare("INSERT INTO india_sales_opportunities VALUES ('opp-1','defendit360')").run();
  task(d,'task-secure','sales-a@example.test',10);
  d.prepare("INSERT INTO india_sales_activity_events(id,tenant_id,task_id,action,actor_email) VALUES('event-1','defendit360','task-secure','scheduled','sales-a@example.test')").run();
  assert.throws(()=>d.prepare("DELETE FROM india_sales_activity_events WHERE id='event-1'").run(),/IMMUTABLE/);
  d.exec("BEGIN");
  try{
   d.prepare("UPDATE india_sales_activity_tasks SET status='completed' WHERE id='task-secure'").run();
   d.prepare("UPDATE india_sales_activity_events SET detail='tampered' WHERE id='event-1'").run();
   d.exec('COMMIT');
  }catch{d.exec('ROLLBACK');}
  assert.equal(d.prepare("SELECT status FROM india_sales_activity_tasks WHERE id='task-secure'").get().status,'planned');
 }finally{d.close();}
});


test('nurture due reminders require 0014, use WIB dates and remain idempotent across Cron retries',async()=>{
 const d=fixture();try{
  // Mirror PR #22's required columns without making PR #21 depend on 0014's file.
  d.exec(`CREATE TABLE india_lead_nurture_plans(
   lead_id TEXT PRIMARY KEY REFERENCES india_marketing_leads(id),tenant_id TEXT NOT NULL,
   state TEXT NOT NULL CHECK(state IN ('active','paused','completed','cancelled')),
   cadence_days INTEGER NOT NULL,channel TEXT NOT NULL,next_touch_at TEXT NOT NULL,
   version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,updated_by TEXT NOT NULL);
   CREATE TABLE india_lead_disqualifications(lead_id TEXT PRIMARY KEY REFERENCES india_marketing_leads(id),
   tenant_id TEXT NOT NULL,reason_code TEXT NOT NULL,reason_text TEXT NOT NULL,active INTEGER NOT NULL,changed_by TEXT NOT NULL)`);
  d.prepare("INSERT INTO india_lead_nurture_plans(lead_id,tenant_id,state,cadence_days,channel,next_touch_at,created_by,updated_by) VALUES('lead-old','defendit360','active',14,'follow_up',date('now','+7 hours','-1 day'),'qa','qa')").run();
  await runCron(d);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE alert_key LIKE 'lead:nurture:%'").get().n,1);
  assert.equal(d.prepare("SELECT recipient_email FROM india_sales_activity_alerts WHERE alert_key LIKE 'lead:nurture:%'").get().recipient_email,'sales-a@example.test');
  await runCron(d);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE alert_key LIKE 'lead:nurture:%'").get().n,1);
  // Updating the plan creates a new versioned reminder, preserving the old audit alert.
  d.prepare("UPDATE india_lead_nurture_plans SET version=version+1,next_touch_at=date('now','+7 hours') WHERE lead_id='lead-old'").run();
  await runCron(d);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE alert_key LIKE 'lead:nurture:%'").get().n,2);
  // An alert emitted by the previous Cron must not be delivered again after upgrade.
  d.exec("UPDATE india_lead_nurture_plans SET version=3 WHERE lead_id='lead-old'");
  d.exec("INSERT INTO india_sales_activity_alerts(alert_key,tenant_id,lead_id,recipient_email,alert_type,message) VALUES('nurture:lead-old:3','defendit360','lead-old','sales-a@example.test','reminder','Previously delivered by legacy Cron')");
  await runCron(d);
  assert.equal(d.prepare("SELECT count(*) n FROM india_sales_activity_alerts WHERE alert_key LIKE 'lead:nurture:%'").get().n,2);
  assert.deepEqual(d.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{d.close();}
});
test('hard disqualified, completed, converted and unmapped recipients do not receive nurturing alerts',async()=>{
 const d=fixture();try{
  // Mirror PR #22's required columns without making PR #21 depend on 0014's file.
  d.exec(`CREATE TABLE india_lead_nurture_plans(
   lead_id TEXT PRIMARY KEY REFERENCES india_marketing_leads(id),tenant_id TEXT NOT NULL,
   state TEXT NOT NULL CHECK(state IN ('active','paused','completed','cancelled')),
   cadence_days INTEGER NOT NULL,channel TEXT NOT NULL,next_touch_at TEXT NOT NULL,
   version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,updated_by TEXT NOT NULL);
   CREATE TABLE india_lead_disqualifications(lead_id TEXT PRIMARY KEY REFERENCES india_marketing_leads(id),
   tenant_id TEXT NOT NULL,reason_code TEXT NOT NULL,reason_text TEXT NOT NULL,active INTEGER NOT NULL,changed_by TEXT NOT NULL)`);
  const cases=[['hard','disqualified','NO_FIT','active'],['closed','converted',null,'active'],['paused','assigned',null,'paused'],['invalid-owner','assigned',null,'active'],['soft','disqualified','TIMING_LATER','active']];
  for(const [id,status,reason,state] of cases){
   d.prepare("INSERT INTO india_marketing_leads(id,tenant_id,account_name,lead_number,assigned_sales_email,status) VALUES(?,'defendit360',?,? ,?,?)")
    .run(id,id,'LD-'+id,id==='invalid-owner'?'missing@example.test':'sales-a@example.test',status);
   d.prepare("INSERT INTO india_lead_nurture_plans(lead_id,tenant_id,state,cadence_days,channel,next_touch_at,created_by,updated_by) VALUES(?,'defendit360',?,14,'email',date('now','+7 hours','-1 day'),'qa','qa')")
    .run(id,state);
   if(reason)d.prepare("INSERT INTO india_lead_disqualifications(lead_id,tenant_id,reason_code,reason_text,active,changed_by) VALUES(?,'defendit360',?, 'UAT reason',1,'qa')").run(id,reason);
  }
  await runCron(d);
  const ids=d.prepare("SELECT lead_id FROM india_sales_activity_alerts WHERE alert_key LIKE 'lead:nurture:%'").all().map(x=>x.lead_id);
  assert.deepEqual(ids,['soft']);
 }finally{d.close();}
});
