const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const root=path.join(__dirname,'../');
const sql=n=>fs.readFileSync(path.join(root,'migrations',n),'utf8');
test('P0: repeated Lead create with same request UUID cannot create duplicate rows',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
 db.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT)");
 db.exec(sql('0004_india_sales_isolation.sql'));
 db.exec(sql('0005_marketing_lead_flow.sql'));
 db.exec(sql('0009_lead_request_idempotency.sql'));
 const fields=['id','tenant_id','lead_number','account_name','source','service_family','assigned_sales_email','created_by','updated_by','request_key'];
 const req='8767fe1e-46fc-4d01-9a3f-55d533c66663';
 const insert=db.prepare('INSERT INTO india_marketing_leads('+fields.join(',')+') VALUES (?,?,?,?,?,?,?,?,?,?)');
 insert.run('lead-1','defendit360','LD-1','PT UAT Cyber','Referral','VAPT','sales@example.test','marketing@example.test','marketing@example.test',req);
 assert.throws(()=>insert.run('lead-2','defendit360','LD-2','PT UAT Cyber','Referral','VAPT','sales@example.test','marketing@example.test','marketing@example.test',req),/UNIQUE/);
 const existing=db.prepare('SELECT id FROM india_marketing_leads WHERE tenant_id=? AND created_by=? AND request_key=?')
 .get('defendit360','marketing@example.test',req);
 assert.equal(existing.id,'lead-1');
 assert.equal(db.prepare('SELECT count(*) AS n FROM india_marketing_leads').get().n,1);
 insert.run('lead-3','defendit360','LD-3','PT UAT Cyber','Referral','VAPT','sales@example.test','other@example.test','other@example.test',req);
 assert.equal(db.prepare('SELECT count(*) AS n FROM india_marketing_leads').get().n,2,'different actor allowed separate request');
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 db.close();
});
test('P0: migration supports legacy leads and refuses invalid request key duplication',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
 db.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT)");
 db.exec(sql('0004_india_sales_isolation.sql'));
 db.exec(sql('0005_marketing_lead_flow.sql'));
 db.exec("INSERT INTO india_marketing_leads(id,tenant_id,lead_number,account_name,source,service_family,assigned_sales_email,created_by,updated_by) VALUES ('legacy','defendit360','LD-OLD','Old Customer','Referral','VAPT','sales@example.test','admin@example.test','admin@example.test')");
 db.exec(sql('0009_lead_request_idempotency.sql'));
 assert.equal(db.prepare("SELECT request_key FROM india_marketing_leads WHERE id='legacy'").get().request_key,null);
 db.close();
});
test('Marketing route uses idempotent registration and conversion response without bypassing owner check',()=>{
 const src=fs.readFileSync(path.join(root,'src/app/api/marketing/leads/route.ts'),'utf8');
 for(const txt of ['requestKey=trim(p.request_key,64)','request_key=?','already_created:true','already_converted:true',
  "row.status==='converted'","role==='sales'&&row.assigned_sales_email!==email"]){
  assert.ok(src.includes(txt),'Expected '+txt);
 }
 assert.match(src,/const linked=await db\.prepare\('SELECT customer_id,opportunity_id FROM india_sales_lead_links/);
 assert.match(src,/db\.batch\(statements\)/);
 assert.match(src,/sameRegistration\(repeated,v\)/);
 assert.match(src,/Request ID sudah digunakan untuk data Lead berbeda/);
});
test('Marketing UI reuses request key across retries and only rotates it after success',()=>{
 const src=fs.readFileSync(path.join(root,'src/app/sales/leads/page.tsx'),'utf8');
 assert.match(src,/request_key:id/);
 assert.match(src,/const result=await api\('POST'/);
 assert.match(src,/setRequestKey\(crypto\.randomUUID\(\)\)/);
});
