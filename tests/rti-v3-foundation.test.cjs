// v3.0-RTI WP01 + WP06 foundation tests: ORG-01..03, RBAC-01, GL-01..03, FML-01, ACD-01, close cycle, parameter center.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { load, root } = require('./helpers/ts-load.cjs');
const seed = load('src/lib/rti/seed'), params = load('src/lib/rti/parameters'), org = load('src/lib/rti/org-model');
const pol = load('src/lib/rti/policy-engine'), fx = load('src/lib/rti/formulas'), pe = load('src/lib/rti/posting-engine');
const close = load('src/lib/rti/close-calendar'), money = load('src/lib/rti/money');
const TENANT = params.DEFAULT_PARAMETERS.company.tenant_key;

function db(max = 41) {
  const d = new DatabaseSync(':memory:'); d.exec('PRAGMA foreign_keys=ON');
  for (const f of fs.readdirSync(path.join(root, 'migrations')).sort().filter(f => Number(f.slice(0, 4)) <= max)) d.exec(fs.readFileSync(path.join(root, 'migrations', f), 'utf8'));
  return d;
}
const units0 = () => org.seedUnits(seed.ORG_SEED, '2026-11-01');
const ctx = (closure, extra = {}) => ({ templates: seed.ROLE_TEMPLATES, closure, abac: pol.DEFAULT_ABAC, sod: seed.SOD_RULES, limits: params.DEFAULT_PARAMETERS.approval_limits, today: '2027-01-15', mfaRequiredGroups: ['Executive', 'Corporate', 'Admin'], ...extra });
const bind = (template, unit, le = 'RTI-LE01', id = template + '@' + unit) => ({ id, template, org_unit_id: unit, legal_entity_id: le, valid_from: '2026-11-01', valid_to: null, status: 'approved' });

// ---------------- Parameter Center ----------------
test('PARAM: defaults validate with no BLOCKER, all statutory keys VERIFIED with legal basis, exact DPP 11/12', () => {
  const f = params.validateParameters();
  assert.equal(f.filter(x => x.severity === 'BLOCKER').length, 0);
  assert.equal(f.filter(x => x.severity === 'HIGH').length, 0);
  const flat = params.flattenParameters();
  assert.equal(flat.filter(p => p.verify === 'VERIFY').length, 0);
  for (const [k, re] of [['tax.ppn_rate', /HPP/], ['tax.ppn_dpp_factor', /PMK 131\/2024/], ['tax.pph21_ter_table', /PP 58\/2023/], ['payroll.bpjs_tk', /PP 45\/2015/], ['accounting.framework', /SAK EP/], ['approval_limits', /L1\/L2\/L3/]])
    assert.match(flat.find(p => p.key === k).source, re, k);
  assert.equal(params.DEFAULT_PARAMETERS.security.policy_enforcement, 'shadow');
  const bad = structuredClone(params.DEFAULT_PARAMETERS); bad.tax.ppn_dpp_factor = '0.9166667'; bad.company.partners[0].partner_share = '0.45';
  const fb = params.validateParameters(bad);
  assert.ok(fb.some(x => x.key === 'tax.ppn_dpp_factor' && x.severity === 'HIGH'));
  assert.ok(fb.some(x => x.key === 'company.partners.ADTC' && x.severity === 'BLOCKER'));
});
test('PARAM: effective-dated lookup picks latest approved row, ignores pending', () => {
  const rows = [
    { key: 'tax.ppn_rate', value_json: '"0.11"', effective_from: '2022-04-01', effective_to: '2025-01-01', status: 'approved' },
    { key: 'tax.ppn_rate', value_json: '"0.12"', effective_from: '2025-01-01', effective_to: null, status: 'approved' },
    { key: 'tax.ppn_rate', value_json: '"0.15"', effective_from: '2026-01-01', effective_to: null, status: 'pending' },
  ];
  assert.equal(params.effectiveParameter(rows, 'tax.ppn_rate', '2024-06-30'), '0.11');
  assert.equal(params.effectiveParameter(rows, 'tax.ppn_rate', '2027-01-01'), '0.12');
  assert.equal(params.effectiveParameter([], 'company.brand', '2027-01-01'), 'Risetin');
});
test('PARAM D1: maker-checker, approved value immutable, no delete', () => {
  const d = db(40);
  const ins = d.prepare("INSERT INTO india_sys_parameters(id,tenant_id,key,value_json,verify_status,effective_from,maker,reason) VALUES(?,?,?,?,?,?,?,?)");
  ins.run('P1', TENANT, 'close_calendar.monthly_hard_close_wd', '6', 'VERIFIED', '2027-02-01', 'fin@x.invalid', 'Perpanjang hard close bulanan');
  assert.throws(() => d.prepare("UPDATE india_sys_parameters SET status='approved',checker='fin@x.invalid' WHERE id='P1'").run(), /CHECK|constraint/);
  d.prepare("UPDATE india_sys_parameters SET status='approved',checker='cfo@x.invalid' WHERE id='P1'").run();
  assert.throws(() => d.prepare("UPDATE india_sys_parameters SET value_json='7' WHERE id='P1'").run(), /PARAMETER_IMMUTABLE/);
  d.prepare("UPDATE india_sys_parameters SET status='superseded',effective_to='2027-06-01' WHERE id='P1'").run();
  assert.throws(() => d.prepare("DELETE FROM india_sys_parameters WHERE id='P1'").run(), /PARAMETER_IMMUTABLE/);
});

// ---------------- Migrations integrity ----------------
test('0040/0041 are generated from TS seed and apply cleanly on the full chain', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/rti/build-migrations.cjs'), '--check'], { stdio: 'pipe' });
  const d = db();
  assert.equal(d.prepare('PRAGMA quick_check').get().quick_check, 'ok');
  assert.deepEqual(d.prepare('PRAGMA foreign_key_check').all(), []);
  for (const v of [40, 41]) assert.equal(d.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=?').get(v).n, 1);
  assert.equal(d.prepare('SELECT count(*) n FROM india_org_units_v').get().n, seed.ORG_SEED.length);
  assert.equal(d.prepare('SELECT count(*) n FROM india_iam_role_templates').get().n, seed.ROLE_TEMPLATES.length);
  assert.equal(d.prepare('SELECT count(*) n FROM india_iam_sod_rules').get().n, 9);
  assert.equal(d.prepare('SELECT count(*) n FROM india_formula_registry').get().n, fx.FORMULAS.length);
  // No identities seeded
  for (const t of ['india_org_assignments', 'india_iam_role_bindings', 'india_accounting_events', 'india_gl_journals']) assert.equal(d.prepare('SELECT count(*) n FROM ' + t).get().n, 0, t);
});

// ---------------- ORG ----------------
test('ORG seed: valid hierarchy, closure, derived cost/profit centers', () => {
  const u = units0(); org.validateHierarchy(u, seed.ORG_UNIT_TYPES);
  const c = org.buildClosure(u);
  assert.ok(org.descendants(c, 'DIR-OPS').includes('DEP-SOC'));
  assert.deepEqual(org.ancestors(c, 'DEP-SOC'), ['DEP-SOC', 'DIV-CYB', 'DIR-OPS', 'RTI-LE01', 'RTI']);
  assert.equal(org.profitCenterOf(u, 'DEP-VAPT'), 'DIV-CYB');
  assert.equal(org.costCenterOf(u, 'DEP-VAPT', seed.ORG_UNIT_TYPES), 'DEP-VAPT');
  assert.equal(org.costCenterOf(u, 'PRT-ADTC', seed.ORG_UNIT_TYPES), 'DIV-ACD');
  assert.equal(org.legalEntityOf(u, 'PRT-ADTC'), 'RTI-LE01');
});
test('ORG-01: new division under DIR-OPS gets cost center, scope and approval line without deploy', () => {
  const types = seed.ORG_UNIT_TYPES; let u = units0();
  const change = { op: 'create', unit: { id: 'DIV-CLD', code: 'DIV-CLD', name: 'Cloud Security Services', type: 'DIVISION', parent_id: 'DIR-OPS', legal_entity_id: null, cost_center_code: 'DIV-CLD', profit_center: true } };
  const impact = org.impactAnalysis(change, { units: u, positions: [], assignments: [], bindings: [], openTransactions: [] }, '2027-01-01');
  assert.deepEqual(impact.approvers, ['HEAD_OF_AFFECTED_UNIT', 'CFO', 'CEO']);
  u = org.applyChange(u, change, '2027-01-01', types);
  const c = org.buildClosure(org.activeOn(u, '2027-01-01'));
  assert.ok(org.descendants(c, 'DIR-OPS').includes('DIV-CLD'));
  assert.equal(org.profitCenterOf(u, 'DIV-CLD'), 'DIV-CLD');
  assert.equal(org.legalEntityOf(u, 'DIV-CLD'), 'RTI-LE01');
  // Delivery manager bound to DIR-OPS automatically sees the new unit through the closure
  const s = { email: 'dm@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('DELIVERY_MGR', 'DIR-OPS')] };
  assert.equal(pol.authorize(s, 'view', { module: 'psa', resource: 'project', org_unit_id: 'DIV-CLD', legal_entity_id: 'RTI-LE01' }, ctx(c)).allow, true);
  // Approval line from positions
  const positions = [{ id: 'P-CEO', org_unit_id: 'BOD', title: 'CEO', reports_to_position_id: null, is_head: true }, { id: 'P-COO', org_unit_id: 'DIR-OPS', title: 'COO', reports_to_position_id: 'P-CEO', is_head: true }, { id: 'P-CLD', org_unit_id: 'DIV-CLD', title: 'Head Cloud', reports_to_position_id: 'P-COO', is_head: true }, { id: 'P-ENG', org_unit_id: 'DIV-CLD', title: 'Engineer', reports_to_position_id: 'P-CLD', is_head: false }];
  const asg = [{ position_id: 'P-CEO', email: 'ceo@x.invalid', valid_from: '2026-01-01', valid_to: null, kind: 'DEFINITIVE' }, { position_id: 'P-COO', email: 'coo@x.invalid', valid_from: '2026-01-01', valid_to: null, kind: 'DEFINITIVE' }, { position_id: 'P-CLD', email: 'plt@x.invalid', valid_from: '2027-01-01', valid_to: null, kind: 'PLT' }, { position_id: 'P-ENG', email: 'eng@x.invalid', valid_from: '2027-01-01', valid_to: null, kind: 'DEFINITIVE' }];
  assert.deepEqual(org.resolveApprovalLine(positions, asg, 'P-ENG', '2027-01-15', 2), [{ position_id: 'P-CLD', email: 'plt@x.invalid', acting: true }, { position_id: 'P-COO', email: 'coo@x.invalid', acting: false }]);
  // D1: same change persisted as a new unit version; invalid parent type rejected by trigger
  const d = db(40);
  const ins = d.prepare("INSERT INTO india_org_units_v(tenant_id,id,version,code,name,type,parent_id,legal_entity_id,cost_center_code,profit_center,valid_from,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
  ins.run(TENANT, 'DIV-CLD', 1, 'DIV-CLD', 'Cloud Security Services', 'DIVISION', 'DIR-OPS', 'RTI-LE01', 'DIV-CLD', 1, '2027-01-01', 'CR-1');
  assert.throws(() => ins.run(TENANT, 'TEAM-X', 1, 'TEAM-X', 'Bad team', 'TEAM', 'RTI-LE01', 'RTI-LE01', null, 0, '2027-01-01', 'CR-2'), /ORG_PARENT_TYPE_INVALID/);
  assert.throws(() => ins.run(TENANT, 'TEAM-Y', 1, 'TEAM-Y', 'Profit team', 'TEAM', 'DEP-SOC', 'RTI-LE01', null, 1, '2027-01-01', 'CR-3'), /ORG_PROFIT_CENTER_NOT_ALLOWED/);
  assert.throws(() => ins.run(TENANT, 'DIV-DUP', 1, 'DIV-CLD', 'Duplicate code', 'DIVISION', 'DIR-OPS', 'RTI-LE01', null, 0, '2027-01-01', 'CR-4'), /UNIQUE/);
});
test('ORG-02: move department with effective date; bindings follow; history preserved as-was', () => {
  const types = seed.ORG_UNIT_TYPES; const before = units0();
  const after = org.applyChange(before, { op: 'move', id: 'DEP-DFIR', new_parent_id: 'DIV-GRC' }, '2027-03-01', types);
  assert.equal(org.unitAsOf(after, 'DEP-DFIR', '2027-02-15').parent_id, 'DIV-CYB');
  assert.equal(org.unitAsOf(after, 'DEP-DFIR', '2027-03-01').parent_id, 'DIV-GRC');
  assert.equal(org.unitAsOf(after, 'DEP-DFIR', '2027-03-01').version, 2);
  const s = { email: 'grc@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('PMO_HEAD', 'DIV-GRC')] };
  const cBefore = org.buildClosure(org.activeOn(after, '2027-02-15')), cAfter = org.buildClosure(org.activeOn(after, '2027-03-01'));
  const r = { module: 'psa', resource: 'project', org_unit_id: 'DEP-DFIR', legal_entity_id: 'RTI-LE01' };
  assert.equal(pol.authorize(s, 'view', r, ctx(cBefore)).allow, false);
  assert.equal(pol.authorize(s, 'view', r, ctx(cAfter)).allow, true);
  assert.throws(() => org.applyChange(after, { op: 'move', id: 'DIV-CYB', new_parent_id: 'DEP-VAPT' }, '2027-04-01', types), /ORG_CYCLE|ORG_PARENT_TYPE_INVALID/);
  assert.throws(() => org.applyChange(after, { op: 'close', id: 'DIV-CYB' }, '2027-04-01', types), /ORG_CLOSE_HAS_CHILDREN/);
  const merged = org.applyChange(after, { op: 'merge', id: 'DIV-ITS', into_id: 'DIV-SWE' }, '2027-05-01', types);
  assert.equal(org.unitAsOf(merged, 'DIV-ITS', '2027-05-01'), undefined);
  // D1: history rows cannot be rewritten
  const d = db(40);
  assert.throws(() => d.prepare("UPDATE india_org_units_v SET parent_id='DIV-GRC',valid_to='2027-03-01' WHERE id='DEP-DFIR'").run(), /ORG_HISTORY_IMMUTABLE/);
  d.prepare("UPDATE india_org_units_v SET valid_to='2027-03-01' WHERE id='DEP-DFIR'").run();
  d.prepare("INSERT INTO india_org_units_v(tenant_id,id,version,code,name,type,parent_id,legal_entity_id,cost_center_code,profit_center,valid_from,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(TENANT, 'DEP-DFIR', 2, 'DEP-DFIR', 'DFIR & CTI', 'DEPARTMENT', 'DIV-GRC', 'RTI-LE01', 'DEP-DFIR', 0, '2027-03-01', 'CR-MOVE');
  assert.throws(() => d.prepare("DELETE FROM india_org_units_v WHERE id='DEP-DFIR'").run(), /ORG_HISTORY_IMMUTABLE/);
  // Change request: maker cannot approve
  d.prepare("INSERT INTO india_org_change_requests(tenant_id,id,op,payload_json,effective_date,maker,reason) VALUES(?,?,?,?,?,?,?)").run(TENANT, 'CR-MOVE', 'move', '{"id":"DEP-DFIR"}', '2027-03-01', 'hr@x.invalid', 'Realignment DFIR ke GRC advisory');
  assert.throws(() => d.prepare(`UPDATE india_org_change_requests SET approvals_json='[{"by":"hr@x.invalid","role":"CEO"}]',status='approved' WHERE id='CR-MOVE'`).run(), /ORG_CHANGE_INVALID/);
  d.prepare(`UPDATE india_org_change_requests SET approvals_json='[{"by":"ceo@x.invalid","role":"CEO"}]',status='approved' WHERE id='CR-MOVE'`).run();
});
test('ORG-03: user of unit A cannot open unit B transaction by changing the ID (IDOR)', () => {
  const c = org.buildClosure(units0());
  const pm = { email: 'pm.soc@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('PM', 'DEP-SOC')] };
  assert.equal(pol.authorize(pm, 'view', { module: 'psa', resource: 'project', id: 'PRJ-1', org_unit_id: 'DEP-SOC', legal_entity_id: 'RTI-LE01' }, ctx(c)).allow, true);
  const denied = pol.authorize(pm, 'view', { module: 'psa', resource: 'project', id: 'PRJ-2', org_unit_id: 'DEP-VAPT', legal_entity_id: 'RTI-LE01' }, ctx(c));
  assert.equal(denied.allow, false); assert.equal(denied.reason, 'NO_PERMISSION_IN_SCOPE');
  const acc = { email: 'acc@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('ACCOUNTANT', 'DEP-ACC')] };
  assert.equal(pol.authorize(acc, 'view', { module: 'fin', resource: 'journal', legal_entity_id: 'TAR-LE01' }, ctx(c)).allow, false, 'cross legal entity');
  const sf = pol.scopeFilter(pm, { module: 'psa', resource: 'project', action: 'view' }, ctx(c));
  assert.deepEqual(sf, { all: false, units: ['DEP-SOC'], entities: [], ownOnly: false });
});

// ---------------- RBAC / SoD ----------------
test('RBAC-01: binding that triggers SOD-01 is reported Critical; self-grant and grant-of-held-role denied', () => {
  const conflicts = pol.bindingConflicts(seed.ROLE_TEMPLATES, ['PROCUREMENT'], 'TREASURY', seed.SOD_RULES);
  assert.deepEqual(conflicts.map(c => [c.rule, c.severity]), [['SOD-01', 'Critical']]);
  assert.deepEqual(pol.bindingConflicts(seed.ROLE_TEMPLATES, ['ACCOUNTANT'], 'CFO', seed.SOD_RULES).map(c => c.rule), ['SOD-03']);
  assert.deepEqual(pol.bindingConflicts(seed.ROLE_TEMPLATES, ['PAYROLL'], 'PAYROLL_APPROVER', seed.SOD_RULES).map(c => c.rule), ['SOD-05']);
  assert.deepEqual(pol.bindingConflicts(seed.ROLE_TEMPLATES, ['AR_OFFICER'], 'COLLECTION_OFFICER', seed.SOD_RULES).map(c => c.rule), ['SOD-04']);
  assert.deepEqual(pol.bindingConflicts(seed.ROLE_TEMPLATES, ['AE'], 'PRESALES', seed.SOD_RULES), []);
  // No single default template is internally conflicted (except break-glass SUPER_ADMIN and read-only auditor)
  for (const t of seed.ROLE_TEMPLATES.filter(t => !['SUPER_ADMIN', 'INTERNAL_AUDITOR'].includes(t.code)))
    assert.deepEqual(pol.bindingConflicts(seed.ROLE_TEMPLATES, [], t.code, seed.SOD_RULES), [], t.code);
  assert.equal(pol.grantAllowed({ email: 'sec@x.invalid', heldTemplates: ['SEC_ADMIN'] }, 'sec@x.invalid', 'FIN_MGR').reason, 'SOD-06_SELF_GRANT');
  assert.equal(pol.grantAllowed({ email: 'sec@x.invalid', heldTemplates: ['SEC_ADMIN', 'FIN_MGR'] }, 'b@x.invalid', 'FIN_MGR').reason, 'SOD-06_GRANTOR_HOLDS_ROLE');
  // D1: binding approver must differ from granter and subject
  const d = db(40);
  const ins = d.prepare("INSERT INTO india_iam_role_bindings(tenant_id,id,template_code,template_version,subject_kind,subject_ref,org_unit_id,legal_entity_id,valid_from,status,granted_by,approved_by,reason) VALUES(?,?,?,1,'user',?,?,?,?,?,?,?,?)");
  assert.throws(() => ins.run(TENANT, 'B1', 'TREASURY', 'a@x.invalid', 'DEP-TRS', 'RTI-LE01', '2027-01-01', 'approved', 'sec@x.invalid', 'sec@x.invalid', 'Treasury officer onboarding'), /CHECK|constraint/);
  assert.throws(() => ins.run(TENANT, 'B2', 'TREASURY', 'a@x.invalid', 'DEP-TRS', 'RTI-LE01', '2027-01-01', 'approved', 'a@x.invalid', 'c@x.invalid', 'Treasury officer onboarding'), /CHECK|constraint/);
  ins.run(TENANT, 'B3', 'TREASURY', 'a@x.invalid', 'DEP-TRS', 'RTI-LE01', '2027-01-01', 'approved', 'sec@x.invalid', 'ciso@x.invalid', 'Treasury officer onboarding');
});
test('Policy: MFA, approval limit, maker-checker, same-object SoD, ABAC posted/restricted, masking', () => {
  const c = org.buildClosure(units0());
  const trs = { email: 't@x.invalid', mfa: false, environment: 'PROD', bindings: [bind('TREASURY', 'DEP-TRS')] };
  const pay = a => ({ module: 'trs', resource: 'payment', legal_entity_id: 'RTI-LE01', amount_cents: a, maker: 'ap@x.invalid' });
  assert.equal(pol.authorize(trs, 'approve', pay(100), ctx(c)).allow, false, 'MFA required');
  trs.mfa = true;
  assert.equal(pol.authorize(trs, 'approve', pay(params.DEFAULT_PARAMETERS.approval_limits.PAYMENT_RELEASE_L1), ctx(c)).allow, true);
  assert.equal(pol.authorize(trs, 'approve', pay(params.DEFAULT_PARAMETERS.approval_limits.PAYMENT_RELEASE_L1 + 1), ctx(c)).allow, false, 'over limit');
  assert.equal(pol.authorize(trs, 'approve', pay(100), ctx(c, { limits: {} })).allow, false, 'missing limit parameter fails closed');
  assert.equal(pol.authorize(trs, 'approve', { ...pay(100), maker: 't@x.invalid' }, ctx(c)).reason, 'SOD_MAKER_CHECKER');
  const qa = { email: 'qa@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('QA_ENGINEER', 'DEP-VAPT'), bind('PENTESTER', 'DEP-VAPT')] };
  const finding = t => ({ module: 'cyb', resource: 'finding', org_unit_id: 'DEP-VAPT', legal_entity_id: 'RTI-LE01', touched_by: t });
  assert.equal(pol.authorize(qa, 'approve', finding([{ email: 'other@x.invalid', permission: 'cyb.finding.edit' }]), ctx(c)).allow, true);
  const sod8 = pol.authorize(qa, 'approve', finding([{ email: 'qa@x.invalid', permission: 'cyb.finding.edit' }]), ctx(c));
  assert.equal(sod8.allow, false); assert.equal(sod8.sod, 'SOD-08');
  const acc = { email: 'acc@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('FIN_MGR', 'DEP-ACC')] };
  assert.equal(pol.authorize(acc, 'edit', { module: 'fin', resource: 'journal', legal_entity_id: 'RTI-LE01', status: 'POSTED' }, ctx(c)).allow, false);
  const aud = { email: 'ia@x.invalid', mfa: true, environment: 'UAT_SIM', bindings: [bind('INTERNAL_AUDITOR', 'DIR-GOV')] };
  assert.equal(pol.authorize(aud, 'view', { module: 'fin', resource: 'journal', legal_entity_id: 'TAR-LE01' }, ctx(c)).allow, true, 'auditor read all');
  assert.equal(pol.authorize(aud, 'edit', { module: 'fin', resource: 'journal', legal_entity_id: 'RTI-LE01' }, ctx(c)).allow, false, 'auditor read-only');
  assert.equal(pol.authorize(aud, 'view', { module: 'cyb', resource: 'evidence', classification: 'RESTRICTED', project_members: ['pt@x.invalid'] }, ctx(c)).reason, 'ABAC-RESTRICTED-MEMBERS');
  assert.equal(pol.maskValue('1234567890123456'), '************3456');
  for (const t of seed.ROLE_TEMPLATES) for (const p of t.permissions) pol.parsePermission(p);
  assert.throws(() => pol.parsePermission('fin.journal.fly:entity'), /ACTION_UNKNOWN/);
});

// ---------------- FML-01 ----------------
test('FML-01: every formula has id, version, owner, effective date and passing test cases', () => {
  const ids = new Set();
  for (const f of fx.FORMULAS) {
    assert.ok(!ids.has(f.id), 'duplicate ' + f.id); ids.add(f.id);
    assert.ok(f.version >= 1 && f.owner_role && /^\d{4}-\d{2}-\d{2}$/.test(f.effective_from) && f.tests.length >= 1, f.id);
  }
  const failed = fx.runFormulaTests().filter(r => !r.pass);
  assert.deepEqual(failed, []);
  for (const id of ['FIN-REV-POC-01', 'PRJ-01', 'PRJ-08', 'FIN-01', 'FIN-10', 'SVC-01A', 'SVC-04', 'COM-01', 'COM-03', 'ACD-01', 'ACD-02', 'TAX-PPN-01', 'TAX-PPH23-01', 'TAX-PPHB-01']) assert.ok(fx.formulaById(id), id);
  assert.deepEqual(money.allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(money.applyRate(5, '0.5'), 3); assert.equal(money.applyRate(-5, '0.5'), -3);
  assert.throws(() => money.applyRate(0.5, '1'), /SAFE_INTEGER/);
});

// ---------------- Posting engine ----------------
const roleMap = { 'RTI-LE01': pe.defaultRoleMap(seed.ACCOUNT_ROLES) };
const pctx = (periods = { 'RTI-LE01:2027-01': 'open', 'RTI-LE01:2027-02': 'open', 'RTI-LE01:2027-13': 'open' }, actor) => ({ rules: pe.POSTING_RULES, roleMap, accounts: seed.ACCOUNT_ROLES, periods, postedKeys: new Set(), actor });
const dims = { project: 'PRJ-VAPT-01', customer: 'CUST-BANK-A', business_line: 'CYBERSECURITY', cost_center: 'DEP-VAPT', org_unit: 'DEP-VAPT' };
let seq = 0;
const ev = (event_type, amounts, extra = {}) => ({ id: 'EV-' + (++seq), event_type, legal_entity_id: 'RTI-LE01', period: '2027-01', occurred_on: '2027-01-31', currency: 'IDR', amounts, dimensions: { ...dims }, idempotency_key: event_type + ':' + seq, source_type: 'test', source_id: 'SRC-' + seq, ...extra });

test('GL-01: timesheet → WIP → POC revenue → invoice → cash + PPh 23, balanced and drillable', () => {
  const c = pctx(); const J = [];
  const price = 100_000_000_00, eac = 60_000_000_00;
  const cost = fx.costRatePerHour({ salary: 15_000_000_00, allowances: 2_000_000_00, bpjs_employer: 1_200_000_00, benefits: 500_000_00, overhead_loading: 3_300_000_00, available_hours: 160 }) * 160 * 2; // two engineers × one month
  J.push(...pe.postEvent(ev('TIMESHEET_APPROVED', { cost }, { source_type: 'timesheet', source_id: 'TS-2027-01' }), c));
  const revenue = fx.pocRevenue({ contract_price: price, cost_to_date: cost, eac, revenue_recognized_to_date: 0 });
  assert.equal(revenue, 73_333_333_33);
  J.push(...pe.postEvent(ev('PROJECT_PROGRESS_RECOGNIZED', { revenue, cost }), c));
  const t = fx.ppn({ price: 50_000_000_00, rate: params.DEFAULT_PARAMETERS.tax.ppn_rate, dpp_factor: params.DEFAULT_PARAMETERS.tax.ppn_dpp_factor });
  J.push(...pe.postEvent(ev('MILESTONE_INVOICED', { gross: 50_000_000_00 + t.ppn, from_unbilled: 50_000_000_00, to_contract_liability: 0, ppn: t.ppn }, { source_type: 'ar_invoice', source_id: 'INV-001' }), c));
  const w = fx.pph23({ gross_service: 50_000_000_00, rate: '0.02', has_npwp: true, non_npwp_multiplier: '2' });
  J.push(...pe.postEvent(ev('CASH_RECEIVED', { cash: 50_000_000_00 + t.ppn - w, pph23: w, settled: 50_000_000_00 + t.ppn }, { source_type: 'bank_statement', source_id: 'MT940-0131' }), c));
  for (const j of J) pe.assertBalanced(j.lines);
  const tb = pe.trialBalance(J); const bal = code => { const x = tb.get(code) || { debit: 0, credit: 0 }; return x.debit - x.credit; };
  assert.equal(bal('11210'), 0, 'AR fully settled');
  assert.equal(bal('11310'), revenue - 50_000_000_00, 'unbilled = recognised − billed');
  assert.equal(bal('11320'), 0, 'WIP released to cost');
  assert.equal(bal('41100'), -revenue);
  assert.equal(bal('21410'), -t.ppn); assert.equal(bal('11610'), w);
  assert.equal([...tb.values()].reduce((s, x) => s + x.debit - x.credit, 0), 0);
  const trail = pe.drill(J, '51100');
  assert.equal(trail.length, 1); assert.match(trail[0].rule, /^PR-POC@v1$/);
  const wipTrail = pe.drill(J, '11320').map(x => x.source);
  assert.ok(wipTrail.includes('timesheet:TS-2027-01'), 'drill reaches timesheet source');
  assert.equal(pe.reconcileSubledger(0, J, '11210').ok, true);
});
test('GL-02: same event twice produces one journal; D1 enforces idempotency too', () => {
  const c = pctx(); const e = ev('DEPRECIATION_RUN', { amount: 500_000_00 });
  assert.equal(pe.postEvent(e, c).length, 1);
  assert.throws(() => pe.postEvent({ ...e, id: 'EV-replay' }, c), /DUPLICATE_EVENT/);
  const d = db();
  const ins = d.prepare("INSERT INTO india_accounting_events(tenant_id,id,event_type,legal_entity_id,period,occurred_on,amounts_json,dimensions_json,source_type,source_id,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  ins.run(TENANT, 'E1', 'DEPRECIATION_RUN', 'RTI-LE01', '2027-01', '2027-01-31', '{"amount":50000000}', '{}', 'asset_run', 'R1', 'DEP:2027-01:R1');
  assert.throws(() => ins.run(TENANT, 'E2', 'DEPRECIATION_RUN', 'RTI-LE01', '2027-01', '2027-01-31', '{"amount":50000000}', '{}', 'asset_run', 'R1', 'DEP:2027-01:R1'), /UNIQUE/);
  d.prepare("UPDATE india_accounting_events SET status='posted',journal_id='J1' WHERE id='E1'").run();
  assert.throws(() => d.prepare("UPDATE india_accounting_events SET status='pending' WHERE id='E1'").run(), /ACCOUNTING_EVENT_IMMUTABLE/);
  // Missing dimension and unbalanced/negative input go to the exception queue (throw), never silently post
  assert.throws(() => pe.postEvent(ev('CASH_RECEIVED', { cash: 1, pph23: 0, settled: 1 }, { dimensions: {} }), pctx()), /DIMENSION_REQUIRED/);
  assert.throws(() => pe.postEvent(ev('CASH_RECEIVED', { cash: 1, pph23: 0, settled: 2 }), pctx()), /UNBALANCED/);
  assert.throws(() => pe.postEvent(ev('PAYMENT_RELEASED', { amount: -1 }), pctx()), /AMOUNT_INVALID/);
});
test('GL-03: closed period rejected; P13 only FIN_MGR with CFO approval; reopen CFO-only and RESTATED', () => {
  assert.throws(() => pe.postEvent(ev('DEPRECIATION_RUN', { amount: 1 }), pctx({ 'RTI-LE01:2027-01': 'hard_closed' })), /PERIOD_CLOSED/);
  assert.throws(() => pe.postEvent(ev('DEPRECIATION_RUN', { amount: 1 }), pctx({ 'RTI-LE01:2027-01': 'soft_closed' })), /PERIOD_CLOSED/);
  const p13 = e => ({ ...e, period: '2027-13' });
  assert.throws(() => pe.postEvent(p13(ev('DEPRECIATION_RUN', { amount: 1 })), pctx(undefined, { email: 'acc@x.invalid', templates: ['ACCOUNTANT'] })), /P13_ROLE_REQUIRED/);
  assert.throws(() => pe.postEvent(p13(ev('DEPRECIATION_RUN', { amount: 1 })), pctx(undefined, { email: 'fm@x.invalid', templates: ['FIN_MGR'] })), /P13_CFO_APPROVAL_REQUIRED/);
  assert.equal(pe.postEvent(p13(ev('DEPRECIATION_RUN', { amount: 1 })), pctx(undefined, { email: 'fm@x.invalid', templates: ['FIN_MGR'], cfo_approval_ref: 'APR-CFO-1' }))[0].period, '2027-13');
  const st = { status: 'SOFT_CLOSED', items: { a: 'done', b: 'done' }, preparer: 'acc@x.invalid' };
  assert.throws(() => close.hardClose(st, 'acc@x.invalid'), /SOD_PREPARER_APPROVER/);
  const hc = close.hardClose(st, 'cfo@x.invalid'); assert.equal(hc.status, 'HARD_CLOSED');
  assert.throws(() => close.reopen(hc, { email: 'fm@x.invalid', templates: ['FIN_MGR'] }, 'Koreksi accrual material setelah close'), /REOPEN_CFO_ONLY/);
  assert.equal(close.reopen(hc, { email: 'cfo@x.invalid', templates: ['CFO'] }, 'Koreksi accrual material setelah close').status, 'RESTATED');
  // D1 close-run state machine
  const d = db();
  d.prepare("INSERT INTO india_close_runs(tenant_id,legal_entity_id,period,cycle,checklist_json,preparer) VALUES(?,?,?,?,?,?)").run(TENANT, 'RTI-LE01', '2027-01', 'MONTHLY', '{"bank_recon":"open"}', 'acc@x.invalid');
  d.prepare("UPDATE india_close_runs SET status='SOFT_CLOSED',version=2 WHERE period='2027-01'").run();
  assert.throws(() => d.prepare("UPDATE india_close_runs SET status='HARD_CLOSED',approver='cfo@x.invalid',version=3 WHERE period='2027-01'").run(), /CLOSE_TRANSITION_INVALID/);
  assert.throws(() => d.prepare("UPDATE india_close_runs SET status='HARD_CLOSED',checklist_json='{\"bank_recon\":\"done\"}',approver='acc@x.invalid',version=3 WHERE period='2027-01'").run(), /CHECK|constraint/);
  d.prepare("UPDATE india_close_runs SET status='HARD_CLOSED',checklist_json='{\"bank_recon\":\"done\"}',approver='cfo@x.invalid',version=3 WHERE period='2027-01'").run();
  assert.throws(() => d.prepare("UPDATE india_close_runs SET status='RESTATED',version=4 WHERE period='2027-01'").run(), /CHECK|constraint/);
  d.prepare("UPDATE india_close_runs SET status='RESTATED',reopened_by='cfo@x.invalid',reopen_reason='Koreksi accrual material setelah close',version=4 WHERE period='2027-01'").run();
});
test('Reversal and accrual auto-reversal keep originals immutable and net to zero', () => {
  const c = pctx(); const [acc, rev] = pe.postEvent(ev('PERIOD_ACCRUAL', { amount: 7_500_000_00 }), c);
  assert.equal(acc.auto_reverse_in, '2027-02'); assert.equal(rev.period, '2027-02'); assert.equal(rev.reversal_of_id, acc.id);
  const tb = pe.trialBalance([acc, rev]); for (const v of tb.values()) assert.equal(v.debit - v.credit, 0);
  assert.throws(() => pe.reverseJournal(acc, '2027-02', 'short'), /REVERSAL_REASON_REQUIRED/);
  assert.equal(pe.nextPeriod('2027-12'), '2028-01');
});

// ---------------- ACD-01 ----------------
test('ACD-01: batch 20 peserta — revenue at completion, NDR and 60:40 share, partner statement postings', () => {
  const p = params.DEFAULT_PARAMETERS.company.partners.find(x => x.code === 'ADTC');
  const fee = 5_000_000_00, n = 20, revenue = fee * n;
  const c = pctx(); const J = [];
  const t = fx.ppn({ price: revenue, rate: '0.12', dpp_factor: '11/12' });
  J.push(...pe.postEvent(ev('ADVANCE_INVOICED', { gross: revenue + t.ppn, net: revenue, ppn: t.ppn }, { dimensions: { ...dims, business_line: 'TRAINING', customer: 'PUBLIC-BATCH-01' } }), c));
  let tb = pe.trialBalance(J); assert.equal(tb.get('41200'), undefined, 'no revenue before batch completes');
  J.push(...pe.postEvent(ev('TRAINING_BATCH_COMPLETED', { revenue }, { dimensions: { ...dims, business_line: 'TRAINING', customer: 'PUBLIC-BATCH-01' }, source_type: 'acd_batch', source_id: 'BATCH-2027-01' }), c));
  const ndr = fx.netDistributableRevenue({ batch_revenue: revenue, direct_costs: [{ category: 'trainer', amount: 15_000_000_00 }, { category: 'venue', amount: 10_000_000_00 }, { category: 'konsumsi', amount: 6_000_000_00 }, { category: 'sertifikasi', amount: 9_000_000_00 }], agreed_categories: ['trainer', 'venue', 'konsumsi', 'sertifikasi', 'pajak_final'] });
  const share = fx.revenueShare({ ndr, partner_share: p.partner_share, rti_share: p.rti_share });
  assert.deepEqual(share, { partner: 24_000_000_00, rti: 36_000_000_00, loss_unshared: false });
  J.push(...pe.postEvent(ev('PARTNER_SHARE_ACCRUED', { partner_share: share.partner }, { dimensions: { ...dims, business_line: 'TRAINING', vendor: 'PRT-ADTC' }, source_type: 'acd_settlement', source_id: 'SET-BATCH-2027-01' }), c));
  tb = pe.trialBalance(J);
  assert.equal(tb.get('41200').credit, revenue);
  assert.equal(tb.get('21310').debit - tb.get('21310').credit, 0, 'contract liability released');
  assert.equal(tb.get('21130').credit, 24_000_000_00);
  assert.throws(() => fx.netDistributableRevenue({ batch_revenue: 1, direct_costs: [{ category: 'marketing', amount: 1 }], agreed_categories: ['trainer'] }), /NDR_COST_NOT_IN_AGREEMENT/);
});

// ---------------- Close calendar ----------------
test('Close calendar: WD+3 soft / WD+5 hard close, quarterly WD+10, holidays respected, flux rule', () => {
  const p = params.DEFAULT_PARAMETERS.close_calendar;
  // Oct 2026 ends on Saturday → WD0 = Fri 30 Oct
  assert.deepEqual(close.closeDeadlines('2026-10', p, []), { cycle: 'MONTHLY', cutoff_reminder: '2026-10-30', soft_close: '2026-11-04', hard_close: '2026-11-06', audit_ready: null });
  assert.equal(close.closeDeadlines('2026-10', p, ['2026-11-02']).soft_close, '2026-11-05');
  assert.equal(close.closeDeadlines('2027-03', p, []).cycle, 'QUARTERLY');
  assert.equal(close.closeDeadlines('2027-03', p, []).hard_close, '2027-04-14');
  assert.equal(close.closeDeadlines('2026-12', p, []).audit_ready, '2027-03-01');
  assert.equal(close.fluxRequiresCommentary(120_000_000_00, 100_000_000_00, 1000, 50_000_000_00), false, '20% but below Rp50jt');
  assert.equal(close.fluxRequiresCommentary(1_200_000_000_00, 1_000_000_000_00, 1000, 50_000_000_00), true);
});

// ---------------- DoD 21 ----------------
test('Tenant key: storage key equals Parameter Center value; no legacy brand labels in UI source', () => {
  assert.equal(params.DEFAULT_PARAMETERS.company.tenant_key, 'rti');
  assert.equal(load('src/lib/sales-workflow').TENANT, params.DEFAULT_PARAMETERS.company.tenant_key);
  for (const m of ['src/lib/tenant', 'src/lib/sales-transactions', 'src/lib/tender-readiness']) assert.equal(load(m).TENANT_KEY, params.DEFAULT_PARAMETERS.company.tenant_key, m);
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(path.join(root, 'src')).filter(f => /\.tsx?$/.test(f) && !f.includes('/lib/rti/'))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /Technotama|TECHNOTAMA|DefendIT ?360/, f);
    assert.doesNotMatch(src.replace("const LEGACY_TENANT_AAD='defendit360';", ''), /defendit360/i, f);
  }
});
test('DoD-21: no company names, tax rates or thresholds hardcoded in rti engine modules', () => {
  const dir = path.join(root, 'src/lib/rti');
  for (const f of ['org-model.ts', 'policy-engine.ts', 'posting-engine.ts', 'close-calendar.ts', 'money.ts']) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /Technotama|DefendIT|Risetin|Riset Teknologi|ICOP/i, f);
    assert.doesNotMatch(src, /0\.12|0\.11|0\.02\b|0\.22/, f);
  }
});
