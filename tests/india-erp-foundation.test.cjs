const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,won,project,upload,expect,tenant,users}=require('./helpers/service-operations-fixture.cjs');
const legal='legal-qa';
async function org(h){
 await expect(h.call('erp/organization','POST','admin',{action:'create_unit',id:legal,code:'TCH-LEGAL',label:'Technotama QA Legal Entity',kind:'legal_entity',parent_id:null}),201);
}
function grant(h,email,cap){
 h.sql.prepare("INSERT OR IGNORE INTO india_erp_staff_org(tenant_id,email,unit_id,position_title,created_by,status,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?)")
  .run(tenant,email,legal,'Synthetic UAT staff affiliation','requester@synthetic.invalid','checker@synthetic.invalid','Synthetic independent organization approval');
 h.sql.prepare("INSERT INTO india_erp_capability_grants(id,tenant_id,email,capability,unit_id,status,requested_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?,?)")
  .run('grant-'+email+'-'+cap,tenant,email,cap,legal,'requester@synthetic.invalid','checker@synthetic.invalid','Synthetic independent test-only approval');
}
async function scope(h,entity,id){
 await expect(h.call('erp/organization','POST','admin',{action:'request_'+entity+'_scope',[entity+'_id']:id,legal_entity_id:legal}),200);
 await expect(h.call('erp/organization','POST','approver',{action:'review_'+entity+'_scope',[entity+'_id']:id,version:1,approve:true}),200);
}
test('0034–0045 apply without dummy ERP postings, maintain foreign keys and immutable audit',()=>{
 const h=fixture(45);try{
  for(const n of [33,34,35,36,37,38,39,40,41,42,43,44,45])assert.equal(h.sql.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=?').get(n).n,1);
  for(const t of ['india_erp_org_units','india_erp_capability_grants','india_gl_journals','india_ap_supplier_invoices','india_cyber_cases'])
   assert.equal(h.sql.prepare('SELECT count(*) n FROM '+t).get().n,0);
  assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{h.close();}
});
test('WP2 API requires independent grant review and legal entity scope',async()=>{
 const h=fixture(45);try{
  await org(h);
  await expect(h.call('erp/organization','POST','admin',{action:'assign_staff',email:users.finance,unit_id:legal,position_title:'Finance Analyst'}),200);
  await expect(h.call('erp/organization','POST','finance',{action:'review_staff',email:users.finance,version:1,approve:true,notes:'Self approval is forbidden'}),403);
  await expect(h.call('erp/organization','POST','approver',{action:'review_staff',email:users.finance,version:1,approve:true,notes:'Independent Finance staff unit review'}),200);
  assert.equal(h.sql.prepare('SELECT status FROM india_erp_staff_org WHERE email=?').get(users.finance).status,'approved');
  const id='grant-erp-review';
  await expect(h.call('erp/organization','POST','admin',{action:'request_grant',id,email:users.finance,capability:'finance_gl',unit_id:legal}),201);
  await expect(h.call('erp/organization','POST','finance',{action:'review_grant',id,version:1,approve:true,notes:'Wrong role reviewer'}),403);
  await expect(h.call('erp/organization','POST','approver',{action:'review_grant',id,version:1,approve:true,notes:'Independently approved finance grant'}),200);
  await expect(h.call('erp/organization','POST','approver',{action:'review_grant',id,version:1,approve:false,notes:'Replay should conflict'}),409);
  const rows=h.sql.prepare('SELECT status,reviewed_by FROM india_erp_capability_grants WHERE id=?').get(id);
  assert.equal(rows.status,'approved');assert.equal(rows.reviewed_by,users.approver);
  await expect(h.call('erp/organization','POST','viewer',{action:'create_unit',id:'not-allowed',code:'DENY',label:'Denied Org',kind:'legal_entity',parent_id:null}),403);
 }finally{h.close();}
});
test('WP6 GL double entry: denied draft, balanced approval, one immutable posting, duplicate source key rejected',async()=>{
 const h=fixture(45);try{
  await org(h);grant(h,users.finance,'finance_gl');grant(h,users.approver,'finance_gl');
  await expect(h.call('erp/ledger','POST','viewer',{action:'period',legal_entity_id:legal,period:'2026-10'}),403);
  const a=(await expect(h.call('erp/ledger','POST','finance',{action:'account',legal_entity_id:legal,code:'1100',name:'Bank Account',category:'asset'}),201)).body.id;
  const b=(await expect(h.call('erp/ledger','POST','finance',{action:'account',legal_entity_id:legal,code:'4100',name:'Service Revenue',category:'revenue'}),201)).body.id;
  const period=(await expect(h.call('erp/ledger','POST','finance',{action:'period',legal_entity_id:legal,period:'2026-10'}),201)).body.id;
  const v={action:'journal',legal_entity_id:legal,period_id:period,source_type:'manual',source_key:'qa-entry-01',memo:'Approved manual QA revenue entry',lines:[{account_id:a,debit_cents:20000000,credit_cents:0},{account_id:b,debit_cents:0,credit_cents:20000000}]};
  await expect(h.call('erp/ledger','POST','finance',{...v,source_key:'imbalanced',lines:[{account_id:a,debit_cents:100,credit_cents:0},{account_id:b,debit_cents:0,credit_cents:90}]}),422);
  const id=(await expect(h.call('erp/ledger','POST','finance',v),201)).body.id;
  assert.throws(()=>h.sql.prepare("UPDATE india_gl_journals SET status='approved',version=version+1,reviewed_by=?,review_notes=NULL WHERE id=?").run(users.approver,id),/constraint|CHECK/i);
  await expect(h.call('erp/ledger','POST','finance',{action:'review',id,version:1,approve:true,notes:'Finance self-review denied'}),403);
  await expect(h.call('erp/ledger','POST','approver',{action:'review',id,version:1,approve:true,notes:'Reviewed balanced source and evidence'}),200);
  await expect(h.call('erp/ledger','POST','finance',{action:'post',id,version:2}),200);
  assert.equal(h.sql.prepare('SELECT status FROM india_gl_journals WHERE id=?').get(id).status,'posted');
  assert.throws(()=>h.sql.prepare('UPDATE india_gl_lines SET debit_cents=1 WHERE journal_id=?').run(id),/IMMUTABLE/);
  await expect(h.call('erp/ledger','POST','finance',{action:'post',id,version:2}),409);
  await expect(h.call('erp/ledger','POST','finance',v),409);
  assert.equal(h.sql.prepare('SELECT sum(debit_cents) d,sum(credit_cents) c FROM india_gl_lines WHERE journal_id=?').get(id).d,20000000);
 }finally{h.close();}
});
test('WP7 P2P canonical offer -> approved PO -> independent receipt -> matched supplier invoice',async()=>{
 const h=await won(fixture(45));try{
  await org(h);await scope(h,'opportunity','opp-qa');
  for(const [email,cap] of [[users.admin,'procurement'],[users.presales,'procurement'],[users.approver,'procurement'],[users.finance,'finance_ap'],[users.approver,'finance_ap']])grant(h,email,cap);
  h.sql.prepare("INSERT INTO india_vendors(id,tenant_id,legal_name,registration_number,contact_email,capabilities,capacity_units,capacity_unit,evidence_reference,evidence_sha256,valid_until,status,created_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,?,?,?,?,? ,?,'validated',?,?,?)")
   .run('vendor-qa',tenant,'PT Approved Cyber Supplier','REG-ERP-QA','vendor@flow.invalid','SOC license',10,'license','vault/vendor/qa','a'.repeat(64),'2030-12-31',users.sales,users.finance,'Independent QA vendor validation');
  h.sql.prepare("INSERT INTO india_vendor_offers(id,tenant_id,opportunity_id,vendor_id,scope,quantity,unit,unit_price_idr,capacity_confirmed,valid_until,evidence_reference,evidence_sha256,status,created_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'validated',?,?,?)")
   .run('offer-qa',tenant,'opp-qa','vendor-qa','Cybersecurity license',1,'license',500000,1,'2030-12-31','vault/offer/qa','b'.repeat(64),users.presales,users.finance,'Independently reviewed offer');
  const p=(await expect(h.call('erp/procurement','POST','admin',{action:'create_po',offer_id:'offer-qa',po_number:'TCH-PO-QA',qty:1}),201)).body.id;
  await expect(h.call('erp/procurement','POST','admin',{action:'review_po',po_id:p,version:1,approve:true,notes:'No self approval'}),403);
  await expect(h.call('erp/procurement','POST','approver',{action:'review_po',po_id:p,version:1,approve:true,notes:'Independent purchasing approval'}),200);
  const d=(await expect(upload(h,'supporting','finance'),201)).body.id;
  await expect(h.call('erp/procurement','POST','presales',{action:'receipt',po_id:p,qty:1,document_id:d}),201);
  await expect(h.call('erp/procurement','POST','presales',{action:'receipt',po_id:p,qty:1,document_id:d}),409);
  const d2=(await expect(upload(h,'supporting','finance'),201)).body.id;
  const inv=(await expect(h.call('erp/procurement','POST','finance',{action:'supplier_invoice',po_id:p,supplier_invoice_number:'SUP-ERP-01',qty:1,due_date:'2026-12-31',document_id:d2}),201)).body.id;
  await expect(h.call('erp/procurement','POST','approver',{action:'review_invoice',id:inv,version:1,approve:true,notes:'Matched original PO receipt and supplier invoice'}),200);
  assert.equal(h.sql.prepare('SELECT status,amount_cents FROM india_ap_supplier_invoices WHERE id=?').get(inv).amount_cents,50000000);
  assert.equal(h.sql.prepare('SELECT status FROM india_ap_supplier_invoices WHERE id=?').get(inv).status,'approved');
 }finally{h.close();}
});
test('WP5 VAPT case project isolation and original Vault evidence for independent QA and close',async()=>{
 const h=await won(fixture(45));try{
  await org(h);const p=project(h);
  h.sql.prepare("UPDATE india_delivery_projects SET status='active',start_date='2026-10-01',end_date='2026-12-31',version=version+1 WHERE id=?").run(p.id);
  await scope(h,'project',p.id);
  grant(h,users.admin,'cyber_ops');grant(h,users.approver,'cyber_ops');
  const created=(await expect(h.call('erp/cyber-operations','POST','admin',{action:'open',project_id:p.id,kind:'vapt_finding',external_ref:'VAPT-0001',title:'Broken access control evidence',severity:'high',classification:'restricted'}),201)).body.id;
  await expect(h.call('erp/cyber-operations','GET','viewer',null,'?project_id='+p.id),403);
  await expect(h.call('erp/cyber-operations','POST','admin',{action:'review',id:created,version:1,approve:true,notes:'Cannot self review',document_id:'fake'}),403);
  const d=(await expect(upload(h,'supporting','finance'),201)).body.id;
  await expect(h.call('erp/cyber-operations','POST','approver',{action:'review',id:created,version:1,approve:true,notes:'Technical QA and retest evidence accepted',document_id:d}),200);
  await expect(h.call('erp/cyber-operations','POST','admin',{action:'close',id:created,version:2}),200);
  assert.equal(h.sql.prepare('SELECT status FROM india_cyber_cases WHERE id=?').get(created).status,'closed');
  assert.throws(()=>h.sql.prepare('DELETE FROM india_cyber_cases WHERE id=?').run(created),/IMMUTABLE/);
 }finally{h.close();}
});

test('ERP grant is inactive until the same staff member has independently approved org affiliation',async()=>{
 const h=fixture(45);try{
  await org(h);
  h.sql.prepare("INSERT INTO india_erp_capability_grants(id,tenant_id,email,capability,unit_id,status,requested_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?,?)")
   .run('grant-without-staff',tenant,users.finance,'finance_gl',legal,'requester@synthetic.invalid','checker@synthetic.invalid','QA approval without staff assignment');
  await expect(h.call('erp/ledger','GET','finance',null,'?legal_entity_id='+legal),403);
  await expect(h.call('erp/organization','POST','admin',{action:'assign_staff',email:users.finance,unit_id:legal,position_title:'Finance Analyst'}),200);
  await expect(h.call('erp/ledger','GET','finance',null,'?legal_entity_id='+legal),403);
  await expect(h.call('erp/organization','POST','approver',{action:'review_staff',email:users.finance,version:1,approve:true,notes:'Signed independent organizational appointment'}),200);
  await expect(h.call('erp/ledger','GET','finance',null,'?legal_entity_id='+legal),200);
 }finally{h.close();}
});
