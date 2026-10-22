const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const canonical=['0005_marketing_lead_flow.sql','0006_bid_and_requirements.sql',
 '0007_quotation_submission.sql','0008_po_legal_evidence.sql',
 '0009_lead_request_idempotency.sql','0010_marketing_campaigns.sql',
 '0011_marketing_sales_consolidation.sql'];
const IDs={
 a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 b:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 account:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 opportunity:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 event:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
};
function base(){
 const d=new DatabaseSync(':memory:');
 d.exec('PRAGMA foreign_keys=ON');
 d.exec('CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
 d.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT)");
 d.exec("INSERT INTO india_members(email,role) VALUES('uat.admin@india.invalid','admin'),('uat.sales.a@india.invalid','sales'),('uat.sales.b@india.invalid','sales')");
 d.exec('CREATE TABLE india_boq(id TEXT PRIMARY KEY)');
 d.exec(read('migrations/0003_sales_workflow.sql'));
 d.exec(read('migrations/0004_india_sales_isolation.sql'));
 return d;
}
function legacy(){
 const d=base();
 d.exec(read('tests/fixtures/pr18_lead_schema.sql'));
 d.exec(read('tests/fixtures/pr18_integrity.sql'));
 const tenant='defendit360',sales='uat.sales.a@india.invalid';
 d.prepare('INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,data_json,created_by) VALUES(?,?,?,?,?,?)')
  .run(IDs.account,tenant,'PT UAT PR18 Retained','IND-PR18-UAT','{}',sales);
 d.prepare("INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,data_json,created_by) VALUES(?,?,?,?,'prospecting',?,?,?)")
  .run(IDs.opportunity,tenant,IDs.account,'UAT Legacy Project',110000000,JSON.stringify({source_lead_id:IDs.a}),sales);
 d.prepare("INSERT INTO india_marketing_leads(id,tenant_id,company_name,contact_name,contact_email,contact_phone,service_interest,lead_source,campaign_code,qualification_notes,budget_status,decision_authority,requirement_summary,target_date,status,owner_email,converted_account_id,converted_opportunity_id,created_by,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
  .run(IDs.a,tenant,'PT UAT PR18 Retained','PIC Legacy','pic@invalid.example','081200000055','VAPT','Referral','CAM-OLD','Legacy discovery','Approved','CISO','Annual VAPT','2026-12-20','converted',sales,IDs.account,IDs.opportunity,sales,4);
 d.prepare("INSERT INTO india_marketing_leads(id,tenant_id,company_name,contact_name,contact_email,service_interest,lead_source,qualification_notes,budget_status,decision_authority,requirement_summary,target_date,status,owner_email,created_by,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
  .run(IDs.b,tenant,'PT UAT PR18 Pending','PIC Pending','pending@invalid.example','SOC/MDR','Event','Qualified previously','Available','CFO','SOC proposal','2026-12-31','qualified','uat.sales.b@india.invalid','uat.sales.b@india.invalid',2);
 d.prepare("INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,from_status,to_status,detail) VALUES(?,?,?,?,?,?,?,?)")
  .run(IDs.event,tenant,IDs.a,'CONVERT','uat.admin@india.invalid','qualified','converted','PR18 legacy conversion');
 return d;
}
test('canonical greenfield schema has campaigns, 1:1 Lead lineage, versioned Lead and independent audit',()=>{
 const db=base();
 try{
  for(const f of canonical)db.exec(read('migrations/'+f));
  const cols=db.prepare('PRAGMA table_info(india_marketing_leads)').all().map(x=>x.name);
  for(const col of ['version','lead_number','campaign_id','request_key','assigned_sales_email'])
   assert.ok(cols.includes(col),col);
  for(const table of ['india_marketing_lead_events','india_marketing_campaigns','india_sales_lead_links','india_sales_bids','india_sales_submissions','india_sales_award_documents','india_schema_file_manifest'])
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name=?").get(table).n,1,table);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
test('PR18 UAT can be bridged without dropping historical Lead, Sales, account, opportunity or audit',()=>{
 const db=legacy();
 try{
  const before=db.prepare('SELECT COUNT(*) n FROM india_sales_opportunities').get().n;
  db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(read('scripts/india-pr18-to-canonical-pre.sql'));
   for(const f of canonical)db.exec(read('migrations/'+f));
   db.exec(read('scripts/india-pr18-to-canonical-post.sql'));
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_sales_opportunities').get().n,before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_leads').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_leads_phase18_archive').get().n,2);
  const converted=db.prepare('SELECT lead_number,status,version,assigned_sales_email FROM india_marketing_leads WHERE id=?').get(IDs.a);
  assert.equal(converted.status,'converted');
  assert.equal(converted.version,4);
  assert.equal(converted.assigned_sales_email,'uat.sales.a@india.invalid');
  assert.match(converted.lead_number,/LD-PR18-/);
  const pending=db.prepare('SELECT status,version,qualification_json FROM india_marketing_leads WHERE id=?').get(IDs.b);
  assert.equal(pending.status,'assigned'); // PR18 had no procurement verification
  assert.equal(pending.version,2);
  assert.equal(JSON.parse(pending.qualification_json).procurement_process,'');
  const linked=db.prepare('SELECT customer_id,opportunity_id,converted_by FROM india_sales_lead_links WHERE lead_id=?').get(IDs.a);
  assert.equal(linked.customer_id,IDs.account);
  assert.equal(linked.opportunity_id,IDs.opportunity);
  assert.equal(linked.converted_by,'uat.admin@india.invalid');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_lead_events WHERE lead_id=?').get(IDs.a).n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_lead_events_phase18_archive').get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM india_schema_file_manifest WHERE source_branch='phase18-pr18'").get().n,2);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
test('conversion API guards every multi-table insertion with successful Lead version-CAS update',()=>{
 const src=read('src/app/api/marketing/leads/route.ts');
 const block=src.slice(src.indexOf("if(p.entity==='convert')"),src.indexOf("return fail('Aksi Marketing tidak terdaftar')"));
 assert.match(block,/version=version\+1/);
 assert.match(block,/version=\?/);
 assert.match(block,/await db\.batch\(statements\)/);
 assert.match(block,/x-india-lead-action/);
 assert.match(block,/existing\.created_by\.toLowerCase\(\)/);
 const guarded=[...block.matchAll(/INSERT INTO india_(sales_accounts|sales_opportunities|sales_lead_links|marketing_lead_events|sales_audit).*?WHERE tenant_id=\? AND id=\? AND status='converted' AND version=\?/gs)];
 assert.equal(guarded.length,6,'Every conversion insert must be guarded');
 assert.match(block,/row\.assigned_sales_email/);
 const ui=read('src/app/sales/leads/page.tsx');
 assert.match(ui,/version:selected\.lead\.version/);
 assert.match(ui,/x-india-lead-action/);
 assert.match(ui,/customer_fields:customerProfile/);
});
