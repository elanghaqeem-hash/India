// v3.0-RTI wiring: statutory tax tables, policy engine in ERP routes (shadow + enforce), posting worker outbox → GL.
// Synthetic identities and amounts only.
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, won, invoice, operation, project, upload, today, expect, tenant, users } = require('./helpers/service-operations-fixture.cjs');
const { load } = require('./helpers/ts-load.cjs');
const tax = load('src/lib/rti/tax-tables'), seed = load('src/lib/rti/seed');
const LEGAL = 'legal-qa';

async function legacyOrg(h, id = LEGAL, code = 'RTI-LEGAL-QA') {
  await expect(h.call('erp/organization', 'POST', 'admin', { action: 'create_unit', id, code, label: 'RTI QA Legal Entity', kind: 'legal_entity', parent_id: null }), 201);
}
function legacyGrant(h, email, cap, unit = LEGAL) {
  h.sql.prepare("INSERT OR IGNORE INTO india_erp_staff_org(tenant_id,email,unit_id,position_title,created_by,status,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?)")
    .run(tenant, email, unit, 'Synthetic UAT staff affiliation', 'requester@synthetic.invalid', 'checker@synthetic.invalid', 'Synthetic independent organization approval');
  h.sql.prepare("INSERT INTO india_erp_capability_grants(id,tenant_id,email,capability,unit_id,status,requested_by,reviewed_by,review_notes) VALUES(?,?,?,?,?,'approved',?,?,?)")
    .run('grant-' + email + '-' + cap + '-' + unit, tenant, email, cap, unit, 'requester@synthetic.invalid', 'checker@synthetic.invalid', 'Synthetic independent test-only approval');
}
function mapLegacy(h, legacy = LEGAL, le = 'RTI-LE01') {
  h.sql.prepare("INSERT INTO india_org_unit_legacy_map(tenant_id,legacy_unit_id,org_unit_id,legal_entity_id,maker,checker,status) VALUES(?,?,?,?,?,?,'approved')").run(tenant, legacy, le, le, 'sys.admin@synthetic.invalid', 'ciso@synthetic.invalid');
}
function bindUser(h, email, template, unit = 'DEP-ACC', le = 'RTI-LE01') {
  h.sql.prepare("INSERT INTO india_iam_role_bindings(tenant_id,id,template_code,template_version,subject_kind,subject_ref,org_unit_id,legal_entity_id,valid_from,status,granted_by,approved_by,reason) VALUES(?,?,?,1,'user',?,?,?,?,'approved',?,?,?)")
    .run(tenant, 'bind-' + email + '-' + template, template, email, unit, le, '2026-01-01', 'sec.admin@synthetic.invalid', 'ciso@synthetic.invalid', 'Synthetic UAT role binding');
}
function setParam(h, key, value) {
  h.sql.prepare("INSERT INTO india_sys_parameters(id,tenant_id,key,value_json,verify_status,effective_from,version,status,maker,checker,reason) VALUES(?,?,?,?,'VERIFIED','2026-11-01',2,'approved','sec.admin@synthetic.invalid','ciso@synthetic.invalid','Synthetic cut-over parameter change')")
    .run('PRM-T-' + key, tenant, key, JSON.stringify(value));
}
function glSetup(h, legacy = LEGAL, periods = []) {
  for (const a of seed.ACCOUNT_ROLES) h.sql.prepare('INSERT OR IGNORE INTO india_gl_accounts(id,tenant_id,legal_entity_id,code,name,category,created_by) VALUES(?,?,?,?,?,?,?)').run('acc-' + legacy + '-' + a.code, tenant, legacy, a.code, a.name, a.category, users.finance);
  for (const p of periods) h.sql.prepare('INSERT OR IGNORE INTO india_gl_periods(id,tenant_id,legal_entity_id,period,created_by) VALUES(?,?,?,?,?)').run('per-' + legacy + '-' + p, tenant, legacy, p, users.finance);
}
const tb = (h, code) => h.sql.prepare("SELECT coalesce(sum(l.debit_cents),0)-coalesce(sum(l.credit_cents),0) b FROM india_gl_lines l JOIN india_gl_accounts a ON a.id=l.account_id JOIN india_gl_journals j ON j.id=l.journal_id WHERE a.code=? AND j.status='posted'").get(code).b;
const enqueue = (h, event_type, period, amounts, dimensions, source_id, role = 'finance') => h.call('erp/posting', 'POST', role, { action: 'enqueue', event_type, legal_entity_id: 'RTI-LE01', period, amounts, dimensions, source_id });

// ---------------- Statutory tables ----------------
test('TAX: TER A/B/C per PP 58/2023, PTKP, PPh 21 monthly/annual, BPJS caps, PPN 11/12', () => {
  assert.deepEqual([tax.TER_MONTHLY.A.length, tax.TER_MONTHLY.B.length, tax.TER_MONTHLY.C.length], [44, 40, 41]);
  assert.equal(tax.terRate('A', 5_400_000_00), '0'); assert.equal(tax.terRate('A', 5_400_001_00), '0.0025');
  assert.equal(tax.terRate('B', 9_200_000_00), '0.01'); assert.equal(tax.terRate('C', 2_000_000_000_00), '0.34');
  assert.equal(tax.TER_CATEGORY['K/0'], 'A'); assert.equal(tax.TER_CATEGORY['K/1'], 'B'); assert.equal(tax.TER_CATEGORY['K/3'], 'C');
  assert.equal(tax.pph21MonthlyTer({ status: 'TK/0', gross_monthly: 10_000_000_00, has_npwp: true }), 200_000_00);
  assert.equal(tax.pph21MonthlyTer({ status: 'TK/0', gross_monthly: 10_000_000_00, has_npwp: false }), 240_000_00);
  assert.equal(tax.pph21MonthlyTer({ status: 'K/3', gross_monthly: 15_000_000_00, has_npwp: true }), 750_000_00);
  const y = tax.pph21Annual({ status: 'TK/0', annual_gross: 120_000_000_00, annual_employee_jht_jp: 3_600_000_00, months_worked: 12, withheld_before: 2_200_000_00, has_npwp: true });
  assert.deepEqual(y, { biaya_jabatan: 6_000_000_00, net: 110_400_000_00, pkp: 56_400_000_00, annual_tax: 2_820_000_00, final_period_tax: 620_000_00 });
  const b = tax.bpjsContributions({ wage: 15_000_000_00, jkk_class: 1 });
  assert.deepEqual(b.employer, { kesehatan: 480_000_00, jht: 555_000_00, jp: 221_726_00, jkk: 36_000_00, jkm: 45_000_00 });
  assert.deepEqual(b.employee, { kesehatan: 120_000_00, jht: 300_000_00, jp: 110_863_00 });
  assert.deepEqual(tax.ppnNonLuxury(100_000_000_00), { dpp: 9_166_666_667, ppn: 1_100_000_000 });
  // D1 tables mirror the TS source and are immutable
  const h = fixture(); try {
    assert.equal(h.sql.prepare("SELECT count(*) n FROM india_tax_ter_brackets WHERE category='A'").get().n, 44);
    assert.equal(h.sql.prepare("SELECT rate FROM india_tax_ter_brackets WHERE category='B' AND lower_cents<=? AND (upper_cents IS NULL OR upper_cents>=?)").get(9_000_000_00, 9_000_000_00).rate, '0.01');
    assert.equal(h.sql.prepare("SELECT wage_cap_cents c FROM india_payroll_contribution_rates WHERE program='JP' AND party='employer'").get().c, 11_086_300_00);
    assert.throws(() => h.sql.prepare("UPDATE india_tax_ter_brackets SET rate='0.5' WHERE category='A' AND seq=1").run(), /STATUTORY_TABLE_IMMUTABLE/);
    assert.equal(h.sql.prepare("SELECT value_json v FROM india_sys_parameters WHERE key='org.seed_confirmed'").get().v, 'true');
    assert.equal(h.sql.prepare("SELECT count(*) n FROM india_sys_parameters WHERE verify_status='VERIFY'").get().n, 0);
  } finally { h.close(); }
});
test('PAYROLL D1: maker-checker run, line arithmetic, lock after calculation', () => {
  const h = fixture(); try {
    h.sql.prepare("INSERT INTO india_erp_hr_employee_profiles(id,tenant_id,email,employment_status,employee_number,hire_date,created_by) VALUES('emp-1',?,?,'active','RTI-0001','2026-01-02',?)").run(tenant, users.presales, users.admin);
    h.sql.prepare("INSERT INTO india_payroll_runs(tenant_id,id,legal_entity_id,period,maker) VALUES(?,?,?,?,?)").run(tenant, 'run-1', 'RTI-LE01', '2027-01', users.finance);
    assert.throws(() => h.sql.prepare("INSERT INTO india_payroll_lines(tenant_id,run_id,employee_id,cost_center,base_salary_cents,ter_category,ter_rate,pph21_cents,bpjs_employer_cents,bpjs_employee_cents,net_cents,calc_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(tenant, 'run-1', 'emp-1', 'DEP-SOC', 100, 'A', '0', 0, 0, 0, 99, '{}'), /CHECK|constraint/);
    h.sql.prepare("INSERT INTO india_payroll_lines(tenant_id,run_id,employee_id,cost_center,base_salary_cents,ter_category,ter_rate,pph21_cents,bpjs_employer_cents,bpjs_employee_cents,net_cents,calc_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(tenant, 'run-1', 'emp-1', 'DEP-SOC', 100, 'A', '0', 0, 0, 0, 100, '{}');
    h.sql.prepare("UPDATE india_payroll_runs SET status='calculated',gross_cents=100,net_cents=100,version=2 WHERE id='run-1'").run();
    assert.throws(() => h.sql.prepare("INSERT INTO india_payroll_lines(tenant_id,run_id,employee_id,cost_center,base_salary_cents,ter_category,ter_rate,pph21_cents,bpjs_employer_cents,bpjs_employee_cents,net_cents,calc_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(tenant, 'run-1', 'emp-1', 'X', 1, 'A', '0', 0, 0, 0, 1, '{}'), /PAYROLL_RUN_LOCKED|UNIQUE/);
    assert.throws(() => h.sql.prepare("UPDATE india_payroll_runs SET status='approved',approver=?,approval_notes='Self approval attempt',version=3 WHERE id='run-1'").run(users.finance), /CHECK|constraint/);
    h.sql.prepare("UPDATE india_payroll_runs SET status='approved',approver=?,approval_notes='Independent payroll review',version=3 WHERE id='run-1'").run(users.approver);
    assert.equal(h.sql.prepare("SELECT event_type FROM india_accounting_events WHERE source_id='run-1'").get().event_type, 'PAYROLL_POSTED');
  } finally { h.close(); }
});

// ---------------- Policy engine wired into ERP routes ----------------
test('POLICY shadow: legacy ERP flow unchanged, every decision logged', async () => {
  const h = fixture(); try {
    await legacyOrg(h); legacyGrant(h, users.finance, 'finance_gl');
    await expect(h.call('erp/ledger', 'POST', 'finance', { action: 'account', legal_entity_id: LEGAL, code: '1100', name: 'Bank Account', category: 'asset' }), 201);
    const rows = h.sql.prepare("SELECT mode,allow,reason,permission FROM india_policy_decisions WHERE permission='fin.account.create'").all();
    assert.equal(rows.length, 1); assert.equal(rows[0].mode, 'shadow'); assert.equal(rows[0].allow, 0); assert.equal(rows[0].reason, 'LEGACY_UNIT_UNMAPPED');
    assert.ok(h.sql.prepare("SELECT count(*) n FROM india_policy_decisions WHERE permission='org.unit.create'").get().n >= 1);
    assert.throws(() => h.sql.prepare('DELETE FROM india_policy_decisions').run(), /POLICY_LOG_IMMUTABLE/);
  } finally { h.close(); }
});
test('POLICY enforce: GL maker-checker flow passes with bindings; no binding or other entity (IDOR) is denied', async () => {
  const h = fixture(); try {
    await legacyOrg(h); await legacyOrg(h, 'legal-tar', 'RTI-LEGAL-TAR');
    h.sql.prepare("INSERT INTO india_org_units_v(tenant_id,id,version,code,name,type,parent_id,legal_entity_id,cost_center_code,profit_center,valid_from,source) VALUES(?,?,1,?,?,?,?,?,?,1,'2026-11-01','TEST')").run(tenant, 'TAR-LE01', 'TAR-LE01', 'Affiliate entity', 'LEGAL_ENTITY', 'RTI', 'TAR-LE01', 'TAR-LE01');
    mapLegacy(h); mapLegacy(h, 'legal-tar', 'TAR-LE01');
    await legacyOrg(h, 'legal-unmapped', 'RTI-LEGAL-UNMAPPED');
    for (const u of [users.finance, users.approver, users.viewer]) legacyGrant(h, u, 'finance_gl');
    // Separate synthetic Finance holders: legacy staff placement is one unit per person
    users.fin_tar = 'finance.tar@flow.invalid'; users.fin_unmapped = 'finance.unmapped@flow.invalid';
    for (const e of [users.fin_tar, users.fin_unmapped]) h.sql.prepare("INSERT INTO india_members(email,role,active) VALUES(?,'finance',1)").run(e);
    legacyGrant(h, users.fin_tar, 'finance_gl', 'legal-tar'); bindUser(h, users.fin_tar, 'ACCOUNTANT');
    legacyGrant(h, users.fin_unmapped, 'finance_gl', 'legal-unmapped'); bindUser(h, users.fin_unmapped, 'ACCOUNTANT');
    bindUser(h, users.finance, 'ACCOUNTANT'); bindUser(h, users.approver, 'INDEPENDENT_APPROVER', 'DIR-GOV');
    setParam(h, 'security.policy_enforcement', 'enforce');
    const acc = (await expect(h.call('erp/ledger', 'POST', 'finance', { action: 'account', legal_entity_id: LEGAL, code: '11110', name: 'Kas dan Bank', category: 'asset' }), 201)).body.id;
    const rev = (await expect(h.call('erp/ledger', 'POST', 'finance', { action: 'account', legal_entity_id: LEGAL, code: '41100', name: 'Pendapatan Jasa', category: 'revenue' }), 201)).body.id;
    const per = (await expect(h.call('erp/ledger', 'POST', 'finance', { action: 'period', legal_entity_id: LEGAL, period: '2026-11' }), 201)).body.id;
    const j = (await expect(h.call('erp/ledger', 'POST', 'finance', { action: 'journal', legal_entity_id: LEGAL, period_id: per, source_type: 'manual', source_key: 'enf-1', memo: 'Enforced policy manual entry', lines: [{ account_id: acc, debit_cents: 100, credit_cents: 0 }, { account_id: rev, debit_cents: 0, credit_cents: 100 }] }), 201)).body.id;
    await expect(h.call('erp/ledger', 'POST', 'approver', { action: 'review', id: j, version: 1, approve: true, notes: 'Independent review under enforce' }), 200);
    await expect(h.call('erp/ledger', 'POST', 'finance', { action: 'post', id: j, version: 2 }), 200);
    // Viewer: the role/capability matrix (#103) already rejects at the legacy layer
    await expect(h.call('erp/ledger', 'GET', 'viewer', null, '?legal_entity_id=' + LEGAL), 403);
    // Legacy grant valid but the unit is not mapped into the v3 organization → fail closed
    const unmapped = await expect(h.call('erp/ledger', 'GET', 'fin_unmapped', null, '?legal_entity_id=legal-unmapped'), 403);
    assert.match(unmapped.body.message, /LEGACY_UNIT_UNMAPPED/);
    // IDOR: valid legacy grant on the affiliate unit, but the v3 binding is scoped to RTI-LE01
    const idor = await expect(h.call('erp/ledger', 'GET', 'fin_tar', null, '?legal_entity_id=legal-tar'), 403);
    assert.match(idor.body.message, /NO_PERMISSION_IN_SCOPE/);
    assert.equal(h.sql.prepare("SELECT count(*) n FROM india_policy_decisions WHERE mode='enforce' AND allow=0").get().n, 2);
  } finally { delete users.fin_tar; delete users.fin_unmapped; h.close(); }
});

// ---------------- Posting worker ----------------
test('WORKER: manual events → GL; idempotent rerun; exception → requeue; accrual auto-reversal; closed period', async () => {
  const h = fixture(); try {
    await legacyOrg(h); mapLegacy(h); glSetup(h, LEGAL, ['2027-01', '2027-02']);
    await expect(enqueue(h, 'DEPRECIATION_RUN', '2027-01', { amount: 500_000_00 }, { cost_center: 'DEP-GA' }, 'FA-RUN-2027-01'), 201);
    await expect(enqueue(h, 'DEPRECIATION_RUN', '2027-01', { amount: 500_000_00 }, { cost_center: 'DEP-GA' }, 'FA-RUN-2027-01'), 409);
    await expect(enqueue(h, 'PERIOD_ACCRUAL', '2027-01', { amount: 7_500_000_00 }, { cost_center: 'DEP-GA' }, 'ACR-UTIL-2027-01'), 201);
    await expect(enqueue(h, 'DEPRECIATION_RUN', '2027-03', { amount: 1 }, { cost_center: 'DEP-GA' }, 'FA-RUN-2027-03'), 201);
    await expect(enqueue(h, 'DEPRECIATION_RUN', '2027-01', { amount: 1 }, {}, 'FA-RUN-NODIM'), 201);
    await expect(h.call('erp/posting', 'POST', 'viewer', { action: 'run' }), 403);
    let r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.equal(r.posted, 2);
    assert.deepEqual(r.exceptions.map(x => x.code).sort(), ['DIMENSION_REQUIRED', 'PERIOD_NOT_DEFINED']);
    assert.equal(tb(h, '63100'), 500_000_00); assert.equal(tb(h, '12190'), -500_000_00);
    assert.equal(tb(h, '62100'), 7_500_000_00);
    // Auto-reversal event created for 2027-02 and posted on the next run
    r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.equal(r.posted, 1); assert.equal(tb(h, '62100'), 0); assert.equal(tb(h, '21210'), 0);
    assert.equal(h.sql.prepare("SELECT count(*) n FROM india_gl_journal_links WHERE kind='auto_reverse' AND reversal_of_id IS NOT NULL").get().n, 1);
    // Rerun posts nothing new
    r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.equal(r.posted, 0);
    // Fix the cause (open March) and requeue
    glSetup(h, LEGAL, ['2027-03']);
    const ex = h.sql.prepare("SELECT id FROM india_accounting_events WHERE source_id='FA-RUN-2027-03'").get().id;
    await expect(h.call('erp/posting', 'POST', 'finance', { action: 'requeue', event_id: ex }), 200);
    r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.equal(r.posted, 1);
    // Every auto-posted journal is posted, balanced, rule-approved and dimension-tagged
    const js = h.sql.prepare("SELECT j.id,j.status,j.reviewed_by,j.created_by,(SELECT sum(debit_cents)-sum(credit_cents) FROM india_gl_lines l WHERE l.journal_id=j.id) diff,(SELECT count(*) FROM india_gl_line_dimensions d JOIN india_gl_lines l ON l.id=d.line_id WHERE l.journal_id=j.id) dims FROM india_gl_journals j WHERE j.source_type='accounting_event'").all();
    assert.equal(js.length, 4);
    for (const j of js) { assert.equal(j.status, 'posted'); assert.equal(j.diff, 0); assert.match(j.reviewed_by, /^rule:PR-/); assert.ok(j.dims >= 2); }
    // Hard-closed period sends new events to the exception queue
    h.sql.prepare("INSERT INTO india_close_runs(tenant_id,legal_entity_id,period,cycle,status,checklist_json) VALUES(?,?,?,?,?,?)").run(tenant, 'RTI-LE01', '2027-02', 'MONTHLY', 'PRELIMINARY', '{}');
    h.sql.prepare("UPDATE india_close_runs SET status='SOFT_CLOSED',version=2 WHERE period='2027-02'").run();
    await expect(enqueue(h, 'DEPRECIATION_RUN', '2027-02', { amount: 1 }, { cost_center: 'DEP-GA' }, 'FA-RUN-2027-02'), 201);
    r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.deepEqual(r.exceptions.map(x => x.code), ['PERIOD_CLOSED']);
    const q = (await expect(h.call('erp/posting', 'GET', 'finance'), 200)).body;
    assert.ok(q.exceptions.length >= 2 && q.runs.length >= 5);
  } finally { h.close(); }
});
test('WORKER outbox: approved customer invoice and payment post AR/revenue/PPN/bank in the same transaction chain', async () => {
  const h = await won(fixture()); try {
    await legacyOrg(h); mapLegacy(h);
    const p = project(h);
    await expect(h.call('erp/organization', 'POST', 'admin', { action: 'request_project_scope', project_id: p.id, legal_entity_id: LEGAL }), 200);
    await expect(h.call('erp/organization', 'POST', 'approver', { action: 'review_project_scope', project_id: p.id, version: 1, approve: true }), 200);
    const period = today().slice(0, 7); glSetup(h, LEGAL, [period]);
    const inv = await invoice(h, 1_000_000);
    const ev = h.sql.prepare("SELECT event_type,amounts_json,dimensions_json FROM india_accounting_events WHERE source_id=?").get(inv.id);
    assert.equal(ev.event_type, 'INVOICE_ON_ACCEPTANCE');
    assert.deepEqual(JSON.parse(ev.amounts_json), { gross: 111_000_000, net: 100_000_000, ppn: 11_000_000 });
    const pay = await expect(operation(h, 'finance', 'payment', { invoice_id: inv.id, document_id: inv.document, payment_date: today(), reference: 'BANK-REF-' + crypto.randomUUID().slice(0, 8), amount_idr: 1_110_000 }), 201);
    await expect(operation(h, 'approver', 'review_payment', { id: pay.body.id, approve: true, notes: 'Bank statement independently matched' }), 201);
    const r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.equal(r.posted, 2, JSON.stringify({r,ev:h.sql.prepare('SELECT event_type,status,error_code,period FROM india_accounting_events').all()}));
    assert.equal(tb(h, '11210'), 0, 'AR settled');
    assert.equal(tb(h, '41100'), -100_000_000); assert.equal(tb(h, '21410'), -11_000_000); assert.equal(tb(h, '11110'), 111_000_000);
    const dims = JSON.parse(h.sql.prepare("SELECT d.dimensions_json FROM india_gl_line_dimensions d WHERE d.account_role='REVENUE'").get().dimensions_json);
    assert.equal(dims.project, p.id); assert.equal(dims.business_line, 'CYBERSECURITY');
  } finally { h.close(); }
});
test('WORKER outbox: approved payroll run posts salary, BPJS, PPh 21 per statutory tables', async () => {
  const h = fixture(); try {
    await legacyOrg(h); mapLegacy(h); glSetup(h, LEGAL, ['2027-01']);
    const wage = 15_000_000_00, b = tax.bpjsContributions({ wage, jkk_class: 1 });
    const terGross = wage + b.employer.jkk + b.employer.jkm + b.employer.kesehatan;
    const pph = tax.pph21MonthlyTer({ status: 'TK/0', gross_monthly: terGross, has_npwp: true });
    assert.equal(pph, 1_089_270_00);
    const net = wage - pph - b.employee_total;
    h.sql.prepare("INSERT INTO india_erp_hr_employee_profiles(id,tenant_id,email,employment_status,employee_number,hire_date,created_by) VALUES('emp-1',?,?,'active','RTI-0001','2026-01-02',?)").run(tenant, users.presales, users.admin);
    h.sql.prepare("INSERT INTO india_payroll_runs(tenant_id,id,legal_entity_id,period,maker) VALUES(?,?,?,?,?)").run(tenant, 'run-1', 'RTI-LE01', '2027-01', users.finance);
    h.sql.prepare("INSERT INTO india_payroll_lines(tenant_id,run_id,employee_id,cost_center,base_salary_cents,ter_category,ter_rate,pph21_cents,bpjs_employer_cents,bpjs_employee_cents,net_cents,calc_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(tenant, 'run-1', 'emp-1', 'DEP-SOC', wage, 'A', tax.terRate('A', terGross), pph, b.employer_total, b.employee_total, net, JSON.stringify({ terGross, ...b }));
    h.sql.prepare("UPDATE india_payroll_runs SET status='calculated',gross_cents=?,pph21_cents=?,bpjs_employer_cents=?,bpjs_employee_cents=?,net_cents=?,version=2 WHERE id='run-1'").run(wage, pph, b.employer_total, b.employee_total, net);
    h.sql.prepare("UPDATE india_payroll_runs SET status='approved',approver=?,approval_notes='Independent payroll review',version=3 WHERE id='run-1'").run(users.approver);
    const r = (await expect(h.call('erp/posting', 'POST', 'finance', { action: 'run' }), 200)).body;
    assert.equal(r.posted, 1, JSON.stringify(r.exceptions));
    assert.equal(tb(h, '61100'), wage); assert.equal(tb(h, '61200'), b.employer_total);
    assert.equal(tb(h, '21420'), -pph); assert.equal(tb(h, '21220'), -net); assert.equal(tb(h, '21440'), -(b.employer_total + b.employee_total));
  } finally { h.close(); }
});
