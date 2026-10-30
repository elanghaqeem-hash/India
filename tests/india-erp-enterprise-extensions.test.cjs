const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,won,upload,project,expect,tenant,users}=require('./helpers/service-operations-fixture.cjs');
const legal='entity-extensions';
async function setup(h){
 await expect(h.call('erp/organization','POST','admin',{action:'create_unit',id:legal,code:'TCH-EXT',label:'Technotama Enterprise QA',kind:'legal_entity',parent_id:null}),201);
}
function grant(h,email,cap){
 h.sql.prepare("INSERT OR IGNORE INTO india_erp_staff_org(tenant_id,email,unit_id,position_title,created_by,status,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?)")
 .run(tenant,email,legal,'Synthetic QA Enterprise user','requester@synthetic.invalid','checker@synthetic.invalid','Independent test-only staff affiliation');
 h.sql.prepare("INSERT OR IGNORE INTO india_erp_capability_grants(id,tenant_id,email,capability,unit_id,status,requested_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?,?)")
 .run(crypto.randomUUID(),tenant,email,cap,legal,'requester@synthetic.invalid','checker@synthetic.invalid','Independent synthetic test-only grant');
}
async function legalScope(h,type,id){
 await expect(h.call('erp/organization','POST','admin',{action:'request_'+type+'_scope',[type+'_id']:id,legal_entity_id:legal}),200);
 await expect(h.call('erp/organization','POST','approver',{action:'review_'+type+'_scope',[type+'_id']:id,version:1,approve:true}),200);
}
test('0038-0043 D1 migrations apply without seeded live data; foreign keys and role matrix enforce policy',()=>{
 const h=fixture(43);try{
 for(const n of [38,39,40,41,42,43])assert.equal(h.sql.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=?').get(n).n,1);
 assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
 assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 for(const t of ['india_treasury_payments','india_hr_employees','india_security_connectors','india_procurement_requisitions','india_erp_access_change_requests'])
  assert.equal(h.sql.prepare('SELECT count(*) n FROM '+t).get().n,0);
 assert.throws(()=>h.sql.prepare("UPDATE india_erp_role_capability_matrix SET allowed=0 WHERE role='finance' AND capability='finance_gl'").run(),/ROLE_POLICY_CHANGE_REQUIRED/);
 }finally{h.close();}
});
test('WP2 independent role matrix change and approved grant revoke stop access immediately',async()=>{
 const h=fixture(43);try{
 await setup(h);grant(h,users.finance,'finance_gl');
 await expect(h.call('erp/ledger','GET','finance',null,'?legal_entity_id='+legal),200);
 const proposed=(await expect(h.call('erp/organization','POST','admin',{action:'request_policy_change',id:crypto.randomUUID(),policy_role:'finance',capability:'finance_gl',allowed:false,reason:'Temporarily halt finance GL access for independent role review'}),201)).body.id;
 await expect(h.call('erp/organization','POST','admin',{action:'review_policy_change',id:proposed,version:1,approve:true,notes:'Self review forbidden'}),403);
 await expect(h.call('erp/organization','POST','approver',{action:'review_policy_change',id:proposed,version:1,approve:true,notes:'Independent role-policy risk acceptance'}),200);
 await expect(h.call('erp/ledger','GET','finance',null,'?legal_entity_id='+legal),403);
 // An existing grant is also individually revocable.
 const grantId=h.sql.prepare('SELECT id FROM india_erp_capability_grants WHERE tenant_id=? AND email=? AND capability=?').get(tenant,users.finance,'finance_gl').id;
 const revoke=(await expect(h.call('erp/organization','POST','admin',{action:'request_revoke',id:crypto.randomUUID(),grant_id:grantId,reason:'Segregation of duties violation necessitates grant revocation'}),201)).body.id;
 await expect(h.call('erp/organization','POST','approver',{action:'review_revoke',id:revoke,version:1,approve:true,notes:'Independent revoke authorization'}),200);
 assert.equal(h.sql.prepare('SELECT status FROM india_erp_capability_grants WHERE id=?').get(grantId).status,'revoked');
 await expect(h.call('erp/organization','POST','approver',{action:'review_revoke',id:revoke,version:1,approve:true,notes:'Replay denied'}),409);
 }finally{h.close();}
});
test('WP6 posted journal reverses exactly once, close rejects pending journals and independently closes balanced period',async()=>{
 const h=fixture(43);try{
 await setup(h);grant(h,users.finance,'finance_gl');grant(h,users.approver,'finance_gl');
 const a=(await expect(h.call('erp/ledger','POST','finance',{action:'account',legal_entity_id:legal,code:'10001',name:'Bank for tests',category:'asset'}),201)).body.id;
 const r=(await expect(h.call('erp/ledger','POST','finance',{action:'account',legal_entity_id:legal,code:'40001',name:'Service revenue',category:'revenue'}),201)).body.id;
 const period=(await expect(h.call('erp/ledger','POST','finance',{action:'period',legal_entity_id:legal,period:'2026-10'}),201)).body.id;
 const j=(await expect(h.call('erp/ledger','POST','finance',{action:'journal',legal_entity_id:legal,period_id:period,source_type:'manual',source_key:'manual-ext-one',memo:'QA enterprise posted journal',lines:[{account_id:a,debit_cents:500000,credit_cents:0},{account_id:r,debit_cents:0,credit_cents:500000}]}),201)).body.id;
 await expect(h.call('erp/ledger','POST','approver',{action:'review',id:j,version:1,approve:true,notes:'Independently reviewed journal support'}),200);
 await expect(h.call('erp/ledger','POST','finance',{action:'post',id:j,version:2}),200);
 const reverse=(await expect(h.call('erp/ledger','POST','finance',{action:'reverse',original_journal_id:j,period_id:period,memo:'Reverse previously posted source with documented correction'}),201)).body.id;
 await expect(h.call('erp/ledger','POST','finance',{action:'reverse',original_journal_id:j,period_id:period,memo:'Double reversal should fail safely'}),409);
 await expect(h.call('erp/ledger','POST','finance',{action:'request_close',period_id:period,notes:'Attempt close with pending reversal'}),409);
 await expect(h.call('erp/ledger','POST','approver',{action:'review',id:reverse,version:1,approve:true,notes:'Independently verified equal opposite journal'}),200);
 await expect(h.call('erp/ledger','POST','finance',{action:'post',id:reverse,version:2}),200);
 const close=(await expect(h.call('erp/ledger','POST','finance',{action:'request_close',period_id:period,notes:'Original and reversal reconciled to zero balance'}),201)).body.id;
 await expect(h.call('erp/ledger','POST','finance',{action:'review_close',id:close,version:1,approve:true,notes:'Self closing denied'}),403);
 await expect(h.call('erp/ledger','POST','approver',{action:'review_close',id:close,version:1,approve:true,notes:'Independent balanced period reconciliation'}),200);
 assert.equal(h.sql.prepare('SELECT status FROM india_gl_periods WHERE id=?').get(period).status,'closed');
 assert.throws(()=>h.sql.prepare("UPDATE india_gl_periods SET status='open' WHERE id=?").run(period),/GL_PERIOD_IMMUTABLE/);
 assert.equal(h.sql.prepare('SELECT count(*) n FROM india_gl_reversal_links').get().n,1);
 }finally{h.close();}
});
test('WP7 budget→requisition→canonical vendor PO approval commit guards amount and SoD',async()=>{
 const h=await won(fixture(43));try{
 await setup(h);await legalScope(h,'opportunity','opp-qa');
 for(const [email,cap] of [[users.finance,'finance_ap'],[users.approver,'finance_ap'],[users.admin,'procurement'],[users.approver,'procurement']])grant(h,email,cap);
 const budget=(await expect(h.call('erp/procurement','POST','finance',{action:'budget',legal_entity_id:legal,period:'2026-10',code:'CYBER-OEM',limit_cents:200000000}),201)).body.id;
 await expect(h.call('erp/procurement','POST','finance',{action:'approve_budget',id:budget}),403);
 await expect(h.call('erp/procurement','POST','approver',{action:'approve_budget',id:budget}),200);
 const req=(await expect(h.call('erp/procurement','POST','admin',{action:'requisition',opportunity_id:'opp-qa',budget_id:budget,request_number:'REQ-EXT-01',title:'SIEM license vendor sourcing',qty:1,ceiling_cents:60000000}),201)).body.id;
 await expect(h.call('erp/procurement','POST','approver',{action:'approve_requisition',id:req,version:1,approve:true,notes:'Independent approved budget and scope'}),200);
 h.sql.prepare("INSERT INTO india_vendors(id,tenant_id,legal_name,registration_number,contact_email,capabilities,capacity_units,capacity_unit,evidence_reference,evidence_sha256,valid_until,status,created_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,?,?,?,?,? ,?,'validated',?,?,?)")
 .run('vendor-ext',tenant,'PT Approved Partner','V-EXT','vendor@synthetic.invalid','SIEM',5,'license','vault/approved-vendor','a'.repeat(64),'2030-12-31',users.presales,users.finance,'Independent validation evidence');
 h.sql.prepare("INSERT INTO india_vendor_offers(id,tenant_id,opportunity_id,vendor_id,scope,quantity,unit,unit_price_idr,capacity_confirmed,valid_until,evidence_reference,evidence_sha256,status,created_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'validated',?,?,?)")
 .run('offer-ext',tenant,'opp-qa','vendor-ext','SIEM license',1,'license',500000,1,'2030-12-31','vault/offer-ext','b'.repeat(64),users.presales,users.finance,'Independent offer evidence');
 const po=(await expect(h.call('erp/procurement','POST','admin',{action:'create_po',offer_id:'offer-ext',po_number:'PO-EXT',qty:1,requisition_id:req}),201)).body.id;
 assert.equal(h.sql.prepare('SELECT po_id FROM india_procurement_commitments WHERE requisition_id=?').get(req).po_id,po);
 assert.equal(h.sql.prepare('SELECT committed_cents FROM india_procurement_budget_usage WHERE budget_id=?').get(budget).committed_cents,60000000);
 }finally{h.close();}
});
test('HR onboarding, leave policy and custodial asset return before offboarding',async()=>{
 const h=fixture(43);try{
 await setup(h);for(const [email,cap] of [[users.admin,'hr'],[users.approver,'hr']])grant(h,email,cap);
 // Person under test receives an independently approved staff affiliation.
 h.sql.prepare("INSERT INTO india_erp_staff_org(tenant_id,email,unit_id,position_title,created_by,status,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?)")
 .run(tenant,users.finance,legal,'Finance employee test','requester@synthetic.invalid','checker@synthetic.invalid','Independent staff assignment');
 await expect(h.call('erp/hr','POST','admin',{action:'onboard',email:users.finance,employment_type:'permanent',start_date:'2026-01-01'}),201);
 await expect(h.call('erp/hr','POST','approver',{action:'activate',email:users.finance,version:1,reason:'Independent verification of employment onboarding'}),200);
 const policy=(await expect(h.call('erp/hr','POST','admin',{action:'leave_policy',legal_entity_id:legal,leave_type:'annual',calendar_year:2026,days_entitlement:12}),201)).body.id;
 await expect(h.call('erp/hr','POST','approver',{action:'approve_policy',id:policy}),200);
 const leave=(await expect(h.call('erp/hr','POST','finance',{action:'leave_request',policy_id:policy,from_date:'2026-11-02',to_date:'2026-11-03',notes:'Annual leave request'}),201)).body.id;
 await expect(h.call('erp/hr','POST','approver',{action:'review_leave',id:leave,version:1,approve:true,notes:'Leave balance validated independently'}),200);
 const asset=(await expect(h.call('erp/hr','POST','admin',{action:'asset_register',legal_entity_id:legal,tag:'LAP-EXT-001',category:'laptop',model:'Managed Enterprise Laptop'}),201)).body.id;
 await expect(h.call('erp/hr','POST','admin',{action:'asset_assign',id:asset,email:users.finance}),200);
 await expect(h.call('erp/hr','POST','approver',{action:'offboard',email:users.finance,version:2,end_date:'2026-12-31',reason:'Confirmed employee lifecycle separation'}),409);
 await expect(h.call('erp/hr','POST','admin',{action:'asset_return',id:asset}),200);
 await expect(h.call('erp/hr','POST','approver',{action:'offboard',email:users.finance,version:2,end_date:'2026-12-31',reason:'Confirmed employee lifecycle separation'}),200);
 assert.equal(h.sql.prepare('SELECT active FROM india_members WHERE email=?').get(users.finance).active,0);
 assert.equal(h.sql.prepare('SELECT status FROM india_hr_assets WHERE id=?').get(asset).status,'available');
 }finally{h.close();}
});
test('Cyber connector requires allowlisted secret and independent approval, delivering no source credentials',async()=>{
 const h=await won(fixture(43));const previous=globalThis.fetch;try{
 await setup(h);const p=project(h);h.sql.prepare("UPDATE india_delivery_projects SET status='active',start_date='2026-10-01',end_date='2026-12-31',version=version+1 WHERE id=?").run(p.id);
 await legalScope(h,'project',p.id);
 grant(h,users.admin,'cyber_ops');grant(h,users.approver,'cyber_ops');
 const finding=(await expect(h.call('erp/cyber-operations','POST','admin',{action:'open',project_id:p.id,kind:'vapt_finding',external_ref:'EXT-VAPT-001',title:'Approved VAPT event to SIEM',severity:'high',classification:'restricted'}),201)).body.id;
 const evidence=(await expect(upload(h,'supporting','finance'),201)).body.id;
 await expect(h.call('erp/cyber-operations','POST','approver',{action:'review',id:finding,version:1,approve:true,notes:'Evidence verified against assessment',document_id:evidence}),200);
 await expect(h.call('erp/security-integrations','POST','admin',{action:'register',legal_entity_id:legal,name:'Private SIEM adapter',kind:'siem',endpoint:'https://events.technotama.invalid/ingest'}),503);
 h.securityEnv={INDIA_SECURITY_ALLOWED_HOSTS:'events.technotama.invalid',INDIA_SIEM_OUTBOUND_TOKEN:'synthetic-no-live-secret-1234567890'};
 await expect(h.call('erp/security-integrations','POST','admin',{action:'register',legal_entity_id:legal,name:'Blocked SSRF',kind:'siem',endpoint:'https://127.0.0.1/ingest'}),403);
 const connector=(await expect(h.call('erp/security-integrations','POST','admin',{action:'register',legal_entity_id:legal,name:'Private SIEM adapter',kind:'siem',endpoint:'https://events.technotama.invalid/ingest'}),201)).body.id;
 await expect(h.call('erp/security-integrations','POST','approver',{action:'enable',id:connector,version:1,notes:'Independent controlled integration approval'}),200);
 const dispatch=(await expect(h.call('erp/security-integrations','POST','admin',{action:'queue',connector_id:connector,case_id:finding}),201)).body.id;
 let sent=null;
 globalThis.fetch=async (url,opts)=>{sent={url,opts};return new Response('',{status:202});};
 const result=await expect(h.call('erp/security-integrations','POST','admin',{action:'send',id:dispatch}),200);
 assert.equal(result.body.status,'delivered');assert.equal(sent.url,'https://events.technotama.invalid/ingest');
 assert.equal(sent.opts.headers['Idempotency-Key'],dispatch);
 assert.doesNotMatch(sent.opts.body,/token|client_secret|password/i);
 assert.equal(h.sql.prepare('SELECT status,attempts FROM india_security_dispatches WHERE id=?').get(dispatch).attempts,1);
 await expect(h.call('erp/security-integrations','POST','admin',{action:'send',id:dispatch}),409);
 }finally{globalThis.fetch=previous;h.close();}
});
