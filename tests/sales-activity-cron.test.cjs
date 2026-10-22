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
  return {bind(...args){statement.bind(...args);return this;},async run(){return statement.run();}};
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
