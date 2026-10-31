const test=require('node:test');const assert=require('node:assert/strict');const {fixture,tenant,users}=require('./helpers/service-operations-fixture.cjs');
test('enterprise migrations 0038/0039 preserve original D1 constraints and contain no fabricated operational entries',()=>{
 const h=fixture();try{
  for(const v of [33,34,35,36,37,38,39])assert.equal(h.sql.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=?').get(v).n,1);
  assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
  for(const table of ['india_erp_access_changes','india_erp_treasury_payment_requests','india_erp_hr_employee_profiles','india_erp_security_ingestion_events','india_gl_close_requests','india_gl_reversal_requests']){
   assert.equal(h.sql.prepare('SELECT count(*) n FROM '+table).get().n,0,table+' must not be seeded');
  }
 }finally{h.close();}
});
test('access change requests require active member, independent reviewer and immutable final disposition',()=>{
 const h=fixture();try{
  h.sql.prepare("INSERT INTO india_erp_org_units(id,tenant_id,code,label,kind,created_by) VALUES(?,?,?,?,?,?)").run('entity-ctrl',tenant,'CTRL-LEGAL','QA legal entity','legal_entity',users.admin);
  const sql="INSERT INTO india_erp_access_changes(id,tenant_id,email,capability,unit_id,operation,requested_by,reason) VALUES(?,?,?,?,?,?,?,?)";
  assert.throws(()=>h.sql.prepare(sql).run('missing',tenant,'absent@example.invalid','finance_gl','entity-ctrl','revoke',users.admin,'Independent incident review'),/ACCESS_CHANGE_UNKNOWN_USER_OR_UNIT/);
  h.sql.prepare(sql).run('rev-1',tenant,users.finance,'finance_gl','entity-ctrl','revoke',users.admin,'Revocation due to controlled role transition');
  assert.throws(()=>h.sql.prepare("UPDATE india_erp_access_changes SET status='approved',reviewed_by=? WHERE id='rev-1'").run(users.admin),/constraint|CHECK|IMMUTABLE/i);
  h.sql.prepare("UPDATE india_erp_access_changes SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id='rev-1'").run(users.approver);
  assert.throws(()=>h.sql.prepare("UPDATE india_erp_access_changes SET status='rejected' WHERE id='rev-1'").run(),/ACCESS_CHANGE_IMMUTABLE/);
  assert.throws(()=>h.sql.prepare("DELETE FROM india_erp_access_changes WHERE id='rev-1'").run(),/ACCESS_CHANGE_IMMUTABLE/);
 }finally{h.close();}
});
test('HR leave composite foreign key and financial/payment prerequisite guards fail closed',()=>{
 const h=fixture();try{
  h.sql.prepare("INSERT INTO india_erp_hr_employee_profiles(id,tenant_id,email,employment_status,employee_number,hire_date,created_by) VALUES(?,?,?,?,?,?,?)").run('emp-qa',tenant,users.finance,'active','EMP-2026-QA','2026-01-10',users.admin);
  h.sql.prepare("INSERT INTO india_erp_hr_leave_requests(id,tenant_id,employee_id,start_date,end_date,leave_type,requested_by) VALUES(?,?,?,?,?,?,?)").run('leave-qa',tenant,'emp-qa','2026-11-01','2026-11-02','annual',users.finance);
  assert.throws(()=>h.sql.prepare("INSERT INTO india_erp_hr_leave_requests(id,tenant_id,employee_id,start_date,end_date,leave_type,requested_by) VALUES(?,?,?,?,?,?,?)").run('foreign-emp',tenant,'wrong-emp','2026-11-01','2026-11-02','annual',users.finance),/FOREIGN KEY|constraint/i);
  assert.throws(()=>h.sql.prepare("INSERT INTO india_gl_close_requests(id,tenant_id,period_id,legal_entity_id,requested_by,reason) VALUES(?,?,?,?,?,?)").run('close-missing',tenant,'missing','missing',users.finance,'Monthly reconciled financial close'),/GL_CLOSE_UNPOSTED_JOURNALS/);
  assert.throws(()=>h.sql.prepare("INSERT INTO india_gl_reversal_requests(id,tenant_id,original_journal_id,reversal_period_id,requested_by,reason) VALUES(?,?,?,?,?,?)").run('reversal-missing',tenant,'missing','missing',users.finance,'Original journal needs reversal'),/REVERSAL_SOURCE_OR_PERIOD_INVALID/);
  assert.throws(()=>h.sql.prepare("INSERT INTO india_erp_treasury_payment_requests(id,tenant_id,ap_invoice_id,amount_cents,beneficiary_reference,bank_account_token,requested_by,bank_idempotency_key) VALUES(?,?,?,?,?,?,?,?)").run('payment-missing',tenant,'missing',100,'verified supplier','secure-token',users.finance,'idemp-qa'),/PAYMENT_AP_NOT_APPROVED/);
 }finally{h.close();}
});
