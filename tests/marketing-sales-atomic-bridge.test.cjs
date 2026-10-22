const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const modulePromise=import('../scripts/india-pr18-canonical-plan.mjs');
function legacy(){
 const db=new DatabaseSync(':memory:');
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY);CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT);CREATE TABLE india_boq(id TEXT PRIMARY KEY)");
 db.exec(read('migrations/0003_sales_workflow.sql'));
 db.exec(read('migrations/0004_india_sales_isolation.sql'));
 db.exec(read('tests/fixtures/pr18_lead_schema.sql'));
 db.exec(read('tests/fixtures/pr18_integrity.sql'));
 db.exec("DELETE FROM india_schema_migrations WHERE version=3;INSERT INTO india_members(email,role) VALUES('sales@example.test','sales'),('admin@example.test','admin')");
 db.exec("INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,created_by) VALUES('a','defendit360','PT Retained','IND-UAT','sales@example.test');INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,estimated_value_idr,created_by) VALUES('o','defendit360','a','VAPT',100000000,'sales@example.test')");
 db.exec("INSERT INTO india_marketing_leads(id,tenant_id,company_name,contact_name,contact_email,service_interest,lead_source,status,owner_email,converted_account_id,converted_opportunity_id,created_by,updated_at,version) VALUES('l','defendit360','PT Retained','PIC','pic@example.test','VAPT','Referral','converted','sales@example.test','a','o','sales@example.test','2026-10-20 12:00:00',4)");
 db.exec("INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,created_at) VALUES('e','defendit360','l','CONVERT','admin@example.test','2026-10-20 11:59:00')");
 return db;
}
function snapshot(db){
 return db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t=>({
  ...t,rows:/^CREATE TABLE/.test(t.sql||'')?db.prepare('SELECT * FROM "'+t.name+'" ORDER BY 1').all():[]
 }));
}
function atomic(db,statements){
 db.exec('BEGIN IMMEDIATE');
 try{for(const sql of statements)db.exec(sql);db.exec('COMMIT');}
 catch(e){db.exec('ROLLBACK');throw e;}
}
test('complete bridge preserves source data, historical conversion time and immutable archives',async()=>{
 const {buildBridgePlan}=await modulePromise,db=legacy();
 try{
  const plan=buildBridgePlan();assert.equal(plan.atomic_request_required,true);
  assert.match(plan.sha256,/^[a-f0-9]{64}$/);atomic(db,plan.statements);
  const x=db.prepare('SELECT * FROM india_sales_lead_links').get();
  assert.equal(x.customer_id,'a');assert.equal(x.opportunity_id,'o');
  assert.equal(x.converted_by,'admin@example.test');assert.equal(x.converted_at,'2026-10-20 11:59:00');
  assert.equal(db.prepare('SELECT version FROM india_marketing_leads').get().version,4);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_schema_file_manifest').get().n,11);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_schema_migrations WHERE version BETWEEN 3 AND 11').get().n,9);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.throws(()=>db.exec("UPDATE india_marketing_leads_phase18_archive SET company_name='tampered'"),/immutable/);
  assert.throws(()=>db.exec('DELETE FROM india_marketing_lead_events_phase18_archive'),/immutable/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE '_india_bridge_%'").get().n,0);
 }finally{db.close();}
});
test('failure immediately after legacy rename rolls back DDL and all data',async()=>{
 const {buildBridgePlan}=await modulePromise,db=legacy();
 try{
  const before=snapshot(db),s=buildBridgePlan().statements;
  const i=s.findIndex(x=>x.startsWith('ALTER TABLE india_marketing_leads RENAME'));
  s.splice(i+1,0,"INSERT INTO _india_bridge_assertions VALUES('injected',0)");
  assert.throws(()=>atomic(db,s),/CHECK/);assert.deepEqual(snapshot(db),before);
 }finally{db.close();}
});
test('failure after complete data copy rolls back canonical tables, archives and membership changes',async()=>{
 const {buildBridgePlan}=await modulePromise,db=legacy();
 try{
  const before=snapshot(db),s=buildBridgePlan().statements;
  s.splice(s.findIndex(x=>x.includes("'lead_count'")),0,"INSERT INTO _india_bridge_assertions VALUES('late_failure',0)");
  assert.throws(()=>atomic(db,s),/CHECK/);assert.deepEqual(snapshot(db),before);
 }finally{db.close();}
});
test('preflight rejects broken converted lineage before touching source tables',async()=>{
 const {buildBridgePlan}=await modulePromise,db=legacy();
 try{
  db.exec("UPDATE india_marketing_leads SET converted_opportunity_id='missing'");
  const before=snapshot(db);assert.throws(()=>atomic(db,buildBridgePlan().statements),/CHECK/);
  assert.deepEqual(snapshot(db),before);
 }finally{db.close();}
});
test('an unexpected source column and a partial prior bridge both fail closed',async()=>{
 const {buildBridgePlan}=await modulePromise;
 for(const sql of ['ALTER TABLE india_marketing_leads ADD COLUMN unknown TEXT','CREATE TABLE india_sales_lead_links(id TEXT)']){
  const db=legacy();try{
   db.exec(sql);const before=snapshot(db);
   assert.throws(()=>atomic(db,buildBridgePlan().statements),/CHECK/);assert.deepEqual(snapshot(db),before);
  }finally{db.close();}
 }
});
test('post-copy assertion detects silent Customer data changes before commit',async()=>{
 const {buildBridgePlan}=await modulePromise,db=legacy();
 try{
  const before=snapshot(db),s=buildBridgePlan().statements;
  s.splice(s.findIndex(x=>x.includes("'lead_count'")),0,"UPDATE india_sales_accounts SET legal_name='unexpected' WHERE id='a'");
  assert.throws(()=>atomic(db,s),/CHECK/);assert.deepEqual(snapshot(db),before);
 }finally{db.close();}
});
test('a completed bridge cannot be applied again or erase its immutable history',async()=>{
 const {buildBridgePlan}=await modulePromise,db=legacy();
 try{
  atomic(db,buildBridgePlan().statements);const before=snapshot(db);
  assert.throws(()=>atomic(db,buildBridgePlan().statements),/CHECK/);assert.deepEqual(snapshot(db),before);
 }finally{db.close();}
});
test('SQL reader handles comments and literal semicolons without changing statements',async()=>{
 const {splitSql}=await modulePromise;
 assert.deepEqual(splitSql("-- first\nSELECT 'a;b'; /* ; */ SELECT 'it''s';"),["SELECT 'a;b'","SELECT 'it''s'"]);
 assert.throws(()=>splitSql("SELECT 'unfinished"),/Incomplete/);
 assert.throws(()=>splitSql('CREATE TRIGGER unsupported;'),/Trigger/);
});
test('remote runner rejects production and requires a verified backup before network access',async()=>{
 const {main,verifyBackup}=await import('../scripts/india-uat-d1-bridge.mjs');
 await assert.rejects(main(['--apply','unused','0'.repeat(64)],{INDIA_UAT_D1_ID:'8395dd84-1b7d-4eaf-9990-1d8e75a42cb5'}),/DENIED/);
 await assert.rejects(main([],{}),/Usage/);
 assert.throws(()=>verifyBackup('unused','invalid'),/SHA-256/);
});
