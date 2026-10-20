const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
const migration=(name)=>fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8');
test('migration 0004 and 0005 executes on SQL UAT baseline without deleting preexisting Admin',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);");
 db.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT);");
 db.prepare("INSERT INTO india_members(email,role,active,created_by) VALUES (?,?,?,?)")
  .run('admin@example.test','admin',1,'system');
 db.prepare("INSERT INTO india_members(email,role,active,created_by) VALUES (?,?,?,?)")
  .run('disabled@example.test','viewer',0,'system');
 db.exec(migration('0004_india_sales_isolation.sql'));
 db.exec(migration('0005_marketing_lead_flow.sql'));
 const original=db.prepare("SELECT email,role,active FROM india_members ORDER BY email").all();
 assert.equal(original.length,2);
 assert.equal(original[0].role,'admin');
 assert.equal(original[1].active,0);
 db.prepare('INSERT INTO india_members(email,role,active) VALUES (?,?,?)').run('marketing@example.test','marketing',1);
 assert.throws(()=>db.prepare("INSERT INTO india_members(email,role,active) VALUES (?,?,?)").run('invalid@example.test','superadmin',1));
 assert.equal(db.prepare("SELECT role FROM india_members WHERE email='marketing@example.test'").get().role,'marketing');
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
 for(const name of ['india_marketing_leads','india_marketing_activities','india_sales_lead_links','india_sales_accounts','india_sales_opportunities'])
  assert.ok(tables.includes(name),'Expected '+name);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 db.close();
});
test('transactional Lead -> Account -> Opportunity link is one-to-one and foreign-key enforced',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY);");
 db.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT);");
 db.exec(migration('0004_india_sales_isolation.sql'));
 db.exec(migration('0005_marketing_lead_flow.sql'));
 db.prepare("INSERT INTO india_marketing_leads(id,tenant_id,lead_number,account_name,source,service_family,assigned_sales_email,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?)")
 .run('lead-1','defendit360','LD-UAT-1','PT Test','Webinar','VAPT','sales@example.test','marketing@example.test','marketing@example.test');
 db.prepare("INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,created_by) VALUES (?,?,?,?,?)")
  .run('customer-1','defendit360','PT Test','IND-TEST-1','sales@example.test');
 db.prepare("INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,created_by) VALUES (?,?,?,?,?,?,?)")
  .run('opp-1','defendit360','customer-1','VAPT TEST','prospecting',120000000,'sales@example.test');
 db.prepare("INSERT INTO india_sales_lead_links(tenant_id,lead_id,customer_id,opportunity_id,converted_by) VALUES (?,?,?,?,?)")
 .run('defendit360','lead-1','customer-1','opp-1','sales@example.test');
 assert.equal(db.prepare("SELECT count(*) AS n FROM india_sales_lead_links").get().n,1);
 assert.throws(()=>db.prepare("INSERT INTO india_sales_lead_links(tenant_id,lead_id,customer_id,opportunity_id,converted_by) VALUES (?,?,?,?,?)")
  .run('defendit360','lead-1','customer-1','opp-1','sales@example.test'));
 assert.throws(()=>db.prepare("INSERT INTO india_sales_lead_links(tenant_id,lead_id,customer_id,opportunity_id,converted_by) VALUES (?,?,?,?,?)")
  .run('defendit360','missing-lead','customer-1','opp-2','sales@example.test'));
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 db.close();
});
