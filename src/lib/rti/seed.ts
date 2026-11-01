// Default configuration seed for v3.0-RTI. Everything here is data that is copied into D1 (migrations 0040/0041)
// and can be changed through M02/M20/M24 without a deploy. Tests assert the SQL seed matches these arrays.

export type OrgUnitTypeCode = 'HOLDING' | 'LEGAL_ENTITY' | 'DIRECTORATE' | 'DIVISION' | 'DEPARTMENT' | 'UNIT' | 'TEAM' | 'SQUAD' | 'BRANCH' | 'PROJECT_ORG' | 'PARTNER_ORG';
export type OrgUnitType = { code: OrgUnitTypeCode; allowed_parent_types: OrgUnitTypeCode[]; can_own_budget: boolean; can_be_profit_center: boolean; can_hold_employees: boolean };

export const ORG_UNIT_TYPES: OrgUnitType[] = [
  { code: 'HOLDING', allowed_parent_types: [], can_own_budget: true, can_be_profit_center: true, can_hold_employees: false },
  { code: 'LEGAL_ENTITY', allowed_parent_types: ['HOLDING'], can_own_budget: true, can_be_profit_center: true, can_hold_employees: true },
  { code: 'DIRECTORATE', allowed_parent_types: ['LEGAL_ENTITY'], can_own_budget: true, can_be_profit_center: true, can_hold_employees: true },
  { code: 'DIVISION', allowed_parent_types: ['DIRECTORATE', 'LEGAL_ENTITY'], can_own_budget: true, can_be_profit_center: true, can_hold_employees: true },
  { code: 'DEPARTMENT', allowed_parent_types: ['DIVISION', 'DIRECTORATE'], can_own_budget: true, can_be_profit_center: true, can_hold_employees: true },
  { code: 'UNIT', allowed_parent_types: ['DEPARTMENT', 'DIVISION'], can_own_budget: false, can_be_profit_center: false, can_hold_employees: true },
  { code: 'TEAM', allowed_parent_types: ['UNIT', 'DEPARTMENT', 'DIVISION'], can_own_budget: false, can_be_profit_center: false, can_hold_employees: true },
  { code: 'SQUAD', allowed_parent_types: ['TEAM', 'DEPARTMENT', 'DIVISION'], can_own_budget: false, can_be_profit_center: false, can_hold_employees: true },
  { code: 'BRANCH', allowed_parent_types: ['LEGAL_ENTITY', 'DIRECTORATE'], can_own_budget: true, can_be_profit_center: true, can_hold_employees: true },
  { code: 'PROJECT_ORG', allowed_parent_types: ['DIVISION', 'DEPARTMENT', 'DIRECTORATE'], can_own_budget: true, can_be_profit_center: false, can_hold_employees: false },
  { code: 'PARTNER_ORG', allowed_parent_types: ['DIVISION', 'DEPARTMENT', 'LEGAL_ENTITY'], can_own_budget: false, can_be_profit_center: false, can_hold_employees: false },
];

export type OrgSeed = { code: string; type: OrgUnitTypeCode; parent: string | null; name: string; profit_center?: boolean; business_line?: string };

export const ORG_SEED: OrgSeed[] = [
  { code: 'RTI', type: 'HOLDING', parent: null, name: 'PT Riset Teknologi Indonesia' },
  { code: 'RTI-LE01', type: 'LEGAL_ENTITY', parent: 'RTI', name: 'PT Riset Teknologi Indonesia', profit_center: true },
  { code: 'BOD', type: 'DIRECTORATE', parent: 'RTI-LE01', name: 'Board of Directors / Office of CEO' },
  { code: 'DIR-COM', type: 'DIRECTORATE', parent: 'RTI-LE01', name: 'Commercial & Growth' },
  { code: 'DIV-MKT', type: 'DIVISION', parent: 'DIR-COM', name: 'Marketing & Partnership' },
  { code: 'DIV-SAL', type: 'DIVISION', parent: 'DIR-COM', name: 'Sales & Account Management' },
  { code: 'DIV-BID', type: 'DIVISION', parent: 'DIR-COM', name: 'Presales, Tender & Bid' },
  { code: 'DIR-OPS', type: 'DIRECTORATE', parent: 'RTI-LE01', name: 'Delivery & Operations' },
  { code: 'DIV-CYB', type: 'DIVISION', parent: 'DIR-OPS', name: 'Cybersecurity Services', profit_center: true, business_line: 'CYBERSECURITY' },
  { code: 'DEP-VAPT', type: 'DEPARTMENT', parent: 'DIV-CYB', name: 'VAPT' },
  { code: 'DEP-SOC', type: 'DEPARTMENT', parent: 'DIV-CYB', name: 'SOC/MDR' },
  { code: 'DEP-DFIR', type: 'DEPARTMENT', parent: 'DIV-CYB', name: 'DFIR & CTI' },
  { code: 'DIV-GRC', type: 'DIVISION', parent: 'DIR-OPS', name: 'Governance, Risk & Advisory', profit_center: true, business_line: 'GOVERNANCE' },
  { code: 'DIV-SWE', type: 'DIVISION', parent: 'DIR-OPS', name: 'Software Engineering & Product', profit_center: true, business_line: 'SOFTWARE' },
  { code: 'DIV-ITS', type: 'DIVISION', parent: 'DIR-OPS', name: 'IT Managed Support & Service Desk', profit_center: true, business_line: 'IT_SUPPORT' },
  { code: 'DIV-ACD', type: 'DIVISION', parent: 'DIR-OPS', name: 'Training & Cybersecurity Academy', profit_center: true, business_line: 'TRAINING' },
  { code: 'DIV-PMO', type: 'DIVISION', parent: 'DIR-OPS', name: 'PMO & Resource Management' },
  { code: 'DIR-FIN', type: 'DIRECTORATE', parent: 'RTI-LE01', name: 'Finance, Procurement & Corporate' },
  { code: 'DEP-ACC', type: 'DEPARTMENT', parent: 'DIR-FIN', name: 'Accounting & Tax' },
  { code: 'DEP-TRS', type: 'DEPARTMENT', parent: 'DIR-FIN', name: 'Treasury & Collection' },
  { code: 'DEP-PRC', type: 'DEPARTMENT', parent: 'DIR-FIN', name: 'Procurement & Vendor' },
  { code: 'DEP-HCM', type: 'DEPARTMENT', parent: 'DIR-FIN', name: 'Human Capital' },
  { code: 'DEP-GA', type: 'DEPARTMENT', parent: 'DIR-FIN', name: 'General Affairs & Asset' },
  { code: 'DIR-GOV', type: 'DIRECTORATE', parent: 'RTI-LE01', name: 'Risk, Compliance, Legal & Internal Audit' },
  { code: 'DIR-TEC', type: 'DIRECTORATE', parent: 'RTI-LE01', name: 'Internal IT & Information Security' },
  { code: 'PRT-ADTC', type: 'PARTNER_ORG', parent: 'DIV-ACD', name: 'AD Training Center (partner)' },
];

export const BUSINESS_LINES = [
  { code: 'CYBERSECURITY', label: 'Cybersecurity', color: '#4F46E5' },
  { code: 'GOVERNANCE', label: 'Governance & Advisory', color: '#8B5CF6' },
  { code: 'ADVISORY', label: 'Advisory', color: '#8B5CF6' },
  { code: 'SOFTWARE', label: 'Software Engineering', color: '#3B82F6' },
  { code: 'IT_SUPPORT', label: 'IT Managed Support', color: '#14B8A6' },
  { code: 'TRAINING', label: 'Training Academy', color: '#F59E0B' },
  { code: 'TECH_TRADING', label: 'Technology Trading', color: '#EC4899' },
];

// ---- Access model -------------------------------------------------------------------------------------------
export type Scope = 'own' | 'project' | 'unit' | 'unit_tree' | 'entity' | 'all' | 'own_tenant';
export type RoleTemplate = { code: string; group: string; scope: Scope; mfa: boolean; pam?: boolean; permissions: string[] };

const P = (m: string, r: string, acts: string[], q?: string) => acts.map(a => `${m}.${r}.${a}${q ? ':' + q : ''}`);

export const ROLE_TEMPLATES: RoleTemplate[] = [
  // Executive
  { code: 'CEO', group: 'Executive', scope: 'entity', mfa: true, permissions: [...P('exec', 'cockpit', ['view']), ...P('fin', 'report', ['view', 'export'], 'entity'), ...P('org', 'change', ['approve'], 'entity'), ...P('fin', 'close', ['approve'], 'entity')] },
  { code: 'COO', group: 'Executive', scope: 'entity', mfa: true, permissions: [...P('exec', 'cockpit', ['view']), ...P('psa', 'project', ['view'], 'entity'), ...P('svc', 'ticket', ['view'], 'entity')] },
  { code: 'CFO', group: 'Executive', scope: 'entity', mfa: true, permissions: [...P('exec', 'cockpit', ['view']), ...P('fin', 'report', ['view', 'export'], 'entity'), ...P('fin', 'close', ['approve', 'reopen'], 'entity'), ...P('fin', 'period13', ['approve'], 'entity'), ...P('sys', 'parameter', ['approve'], 'entity'), ...P('hr', 'payroll', ['view'], 'entity')] },
  { code: 'CTO', group: 'Executive', scope: 'entity', mfa: true, permissions: [...P('exec', 'cockpit', ['view']), ...P('swe', 'release', ['approve'], 'entity')] },
  { code: 'CISO', group: 'Executive', scope: 'all', mfa: true, permissions: [...P('sec', 'sod', ['approve'], 'all'), ...P('sec', 'breakglass', ['view'], 'all'), ...P('sec', 'log', ['view'], 'all')] },
  // Commercial
  { code: 'MKT_MGR', group: 'Commercial', scope: 'unit_tree', mfa: false, permissions: P('mkt', 'campaign', ['view', 'create', 'edit', 'approve'], 'unit_tree') },
  { code: 'MKT_OFF', group: 'Commercial', scope: 'own', mfa: false, permissions: P('mkt', 'campaign', ['view', 'create', 'edit'], 'own') },
  { code: 'SALES_MGR', group: 'Commercial', scope: 'unit_tree', mfa: false, permissions: [...P('crm', 'opportunity', ['view', 'edit', 'approve'], 'unit_tree'), ...P('cpq', 'quotation', ['approve'], 'unit_tree')] },
  { code: 'AE', group: 'Commercial', scope: 'own', mfa: false, permissions: [...P('crm', 'opportunity', ['view', 'create', 'edit', 'submit'], 'own'), ...P('cpq', 'quotation', ['create', 'edit', 'submit'], 'own'), ...P('cpq', 'pricing', ['edit'], 'own')] },
  { code: 'PRESALES', group: 'Commercial', scope: 'unit_tree', mfa: false, permissions: P('scp', 'scoping', ['view', 'create', 'edit', 'submit'], 'unit_tree') },
  { code: 'BID_MGR', group: 'Commercial', scope: 'unit_tree', mfa: false, permissions: P('bid', 'tender', ['view', 'create', 'edit', 'submit', 'approve'], 'unit_tree') },
  { code: 'PARTNER_MGR', group: 'Commercial', scope: 'unit_tree', mfa: false, permissions: P('acd', 'partner_agreement', ['view', 'create', 'edit', 'submit'], 'unit_tree') },
  // Delivery
  { code: 'PMO_HEAD', group: 'Delivery', scope: 'unit_tree', mfa: false, permissions: [...P('psa', 'project', ['view', 'approve', 'close'], 'unit_tree'), ...P('psa', 'eac', ['approve'], 'unit_tree')] },
  { code: 'PM', group: 'Delivery', scope: 'project', mfa: false, permissions: [...P('psa', 'project', ['view', 'edit', 'submit'], 'unit'), ...P('psa', 'timesheet', ['approve'], 'unit'), ...P('psa', 'eac', ['submit'], 'unit')] },
  { code: 'DELIVERY_MGR', group: 'Delivery', scope: 'unit_tree', mfa: false, permissions: P('psa', 'project', ['view', 'approve'], 'unit_tree') },
  { code: 'RESOURCE_MGR', group: 'Delivery', scope: 'unit_tree', mfa: false, permissions: P('psa', 'resource', ['view', 'assign'], 'unit_tree') },
  { code: 'TRAINER', group: 'Delivery', scope: 'own', mfa: false, permissions: P('acd', 'attendance', ['view', 'create'], 'own') },
  { code: 'TRAINING_COORD', group: 'Delivery', scope: 'unit_tree', mfa: false, permissions: [...P('acd', 'batch', ['view', 'create', 'edit', 'close'], 'unit_tree'), ...P('acd', 'certificate', ['create'], 'unit_tree')] },
  // Technical
  ...['VAPT_LEAD', 'PENTESTER', 'SOC_MGR', 'SOC_ANALYST', 'DFIR', 'CTI', 'GRC_CONSULTANT', 'SWE_LEAD', 'DEVELOPER', 'QA_ENGINEER', 'SUPPORT_ENGINEER'].map(code => ({
    code, group: 'Technical', scope: 'project' as Scope, mfa: true,
    permissions: [
      ...P('psa', 'timesheet', ['view', 'create', 'submit'], 'own'),
      ...(code === 'PENTESTER' ? P('cyb', 'finding', ['create', 'edit'], 'unit') : []),
      ...(code === 'VAPT_LEAD' || code === 'QA_ENGINEER' ? P('cyb', 'finding', ['approve'], 'unit') : []),
      ...(code === 'DEVELOPER' ? P('swe', 'release', ['deploy'], 'unit') : []),
      ...(code === 'SWE_LEAD' ? P('swe', 'release', ['approve'], 'unit') : []),
      ...(code.startsWith('SOC') ? P('svc', 'incident', ['view', 'edit'], 'unit') : []),
    ],
  })),
  // Corporate
  { code: 'FIN_MGR', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('fin', 'journal', ['view', 'approve', 'post', 'reverse'], 'entity'), ...P('fin', 'period13', ['post'], 'entity'), ...P('fin', 'close', ['submit'], 'entity'), ...P('fin', 'report', ['view', 'export'], 'entity'), ...P('fin', 'posting_rule', ['configure'], 'entity')] },
  { code: 'ACCOUNTANT', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('fin', 'journal', ['view', 'create', 'submit', 'post'], 'entity'), ...P('fin', 'reconciliation', ['create', 'submit'], 'entity'), ...P('fin', 'report', ['view'], 'entity')] },
  { code: 'TAX_OFFICER', group: 'Corporate', scope: 'entity', mfa: true, permissions: P('tax', 'workpaper', ['view', 'create', 'submit'], 'entity') },
  { code: 'TREASURY', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('trs', 'payment', ['view', 'approve'], 'limit:PAYMENT_RELEASE_L1'), ...P('trs', 'bank_recon', ['create'], 'entity')] },
  { code: 'AR_OFFICER', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('ar', 'invoice', ['view', 'create', 'submit'], 'entity')] },
  { code: 'COLLECTION_OFFICER', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('ar', 'cash_receipt', ['view', 'create'], 'entity')] },
  { code: 'AP_OFFICER', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('ap', 'invoice', ['view', 'create', 'submit'], 'entity'), ...P('ap', 'payment', ['create'], 'entity')] },
  { code: 'PROCUREMENT', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('prc', 'po', ['view', 'create', 'submit'], 'entity'), ...P('prc', 'vendor', ['create', 'edit'], 'entity')] },
  { code: 'WAREHOUSE', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('prc', 'goods_receipt', ['create'], 'entity')] },
  { code: 'HR', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('hr', 'employee', ['view', 'create', 'edit'], 'entity'), ...P('org', 'change', ['create', 'submit'], 'entity')] },
  { code: 'PAYROLL', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('hr', 'payroll_master', ['edit'], 'entity'), ...P('hr', 'payroll', ['view', 'create', 'submit'], 'entity')] },
  { code: 'PAYROLL_APPROVER', group: 'Corporate', scope: 'entity', mfa: true, permissions: [...P('hr', 'payroll', ['view', 'approve'], 'entity')] },
  { code: 'ASSET_MGR', group: 'Corporate', scope: 'entity', mfa: true, permissions: P('ast', 'asset', ['view', 'create', 'edit'], 'entity') },
  { code: 'LEGAL', group: 'Corporate', scope: 'entity', mfa: true, permissions: P('ctr', 'contract', ['view', 'edit', 'approve'], 'entity') },
  // Assurance
  { code: 'RISK_MGR', group: 'Assurance', scope: 'all', mfa: true, permissions: P('grc', 'risk', ['view', 'create', 'edit'], 'all') },
  { code: 'COMPLIANCE', group: 'Assurance', scope: 'all', mfa: true, permissions: P('grc', 'compliance', ['view', 'create', 'edit'], 'all') },
  { code: 'INTERNAL_AUDITOR', group: 'Assurance', scope: 'all', mfa: true, permissions: ['*.*.view:all', '*.*.export:all'] },
  { code: 'DPO', group: 'Assurance', scope: 'all', mfa: true, permissions: P('pdp', 'ropa', ['view', 'create', 'edit', 'approve'], 'all') },
  { code: 'INDEPENDENT_APPROVER', group: 'Assurance', scope: 'all', mfa: true, permissions: P('org', 'change', ['approve'], 'all') },
  // Admin
  { code: 'SUPER_ADMIN', group: 'Admin', scope: 'all', mfa: true, pam: true, permissions: ['*.*.*:all'] },
  { code: 'SYS_ADMIN', group: 'Admin', scope: 'all', mfa: true, pam: true, permissions: [...P('sys', 'parameter', ['view', 'create', 'submit'], 'all'), ...P('sys', 'job', ['view', 'configure'], 'all')] },
  { code: 'SEC_ADMIN', group: 'Admin', scope: 'all', mfa: true, pam: true, permissions: [...P('iam', 'role', ['view', 'create', 'edit', 'approve'], 'all'), ...P('iam', 'binding', ['create', 'submit'], 'all')] },
  { code: 'INTEGRATION_ADMIN', group: 'Admin', scope: 'all', mfa: true, pam: true, permissions: P('int', 'connector', ['view', 'configure'], 'all') },
  // External
  ...['CUSTOMER_USER', 'CUSTOMER_APPROVER', 'VENDOR_USER', 'EXTERNAL_CONSULTANT', 'PARTNER_USER'].map(code => ({
    code, group: 'External', scope: 'own_tenant' as Scope, mfa: true,
    permissions: [...P('portal', 'home', ['view'], 'own'), ...(code === 'CUSTOMER_APPROVER' ? P('portal', 'deliverable', ['approve'], 'own') : []), ...(code === 'PARTNER_USER' ? P('acd', 'settlement', ['view'], 'own') : [])],
  })),
];

export type SodRule = { id: string; a: string; b: string; severity: 'Critical' | 'High' | 'Medium'; description: string; same_object: boolean };
export const SOD_RULES: SodRule[] = [
  { id: 'SOD-01', a: 'prc.vendor.create', b: 'trs.payment.approve', severity: 'Critical', description: 'Create vendor master vs approve/release payment', same_object: false },
  { id: 'SOD-02', a: 'prc.po.create', b: 'prc.goods_receipt.create', severity: 'High', description: 'Create PO vs record goods receipt for the same PO', same_object: true },
  { id: 'SOD-03', a: 'fin.journal.post', b: 'fin.close.approve', severity: 'Critical', description: 'Post journal vs approve period close', same_object: false },
  { id: 'SOD-04', a: 'ar.invoice.create', b: 'ar.cash_receipt.create', severity: 'High', description: 'Create customer invoice vs record cash receipt', same_object: false },
  { id: 'SOD-05', a: 'hr.payroll_master.edit', b: 'hr.payroll.approve', severity: 'Critical', description: 'Edit payroll master vs approve payroll run', same_object: false },
  { id: 'SOD-06', a: 'iam.binding.create', b: '*held_role*', severity: 'Critical', description: 'Grant a role vs hold that role', same_object: true },
  { id: 'SOD-07', a: 'cpq.pricing.edit', b: 'cpq.quotation.approve', severity: 'High', description: 'Set pricing/discount vs approve own quotation', same_object: true },
  { id: 'SOD-08', a: 'cyb.finding.edit', b: 'cyb.finding.approve', severity: 'Medium', description: 'Pentester edits finding vs QA approves the same finding', same_object: true },
  { id: 'SOD-09', a: 'swe.release.deploy', b: 'swe.release.approve', severity: 'Critical', description: 'Developer deploys to PROD vs approves release', same_object: true },
];

/** Eight existing login roles (india_members.role) mapped to v3 templates. */
export const LEGACY_ROLE_MAP: Record<string, string[]> = {
  admin: ['SYS_ADMIN'], marketing: ['MKT_OFF'], sales: ['AE'], presales: ['PRESALES'],
  finance: ['ACCOUNTANT'], approver: ['INDEPENDENT_APPROVER'], legal: ['LEGAL'], viewer: [],
};

// ---- Ledger seed ---------------------------------------------------------------------------------------------
export type AccountRole = { role: string; code: string; name: string; category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'; required_dims: string[] };
/** Default 5-digit COA template (SAK EP), keyed by account role. Finance may remap per entity. */
export const ACCOUNT_ROLES: AccountRole[] = [
  { role: 'BANK', code: '11110', name: 'Kas dan Bank', category: 'asset', required_dims: [] },
  { role: 'AR', code: '11210', name: 'Piutang Usaha', category: 'asset', required_dims: ['customer'] },
  { role: 'ECL_ALLOWANCE', code: '11290', name: 'Cadangan Kerugian Piutang', category: 'asset', required_dims: [] },
  { role: 'UNBILLED_REVENUE', code: '11310', name: 'Aset Kontrak (Pendapatan Belum Ditagih)', category: 'asset', required_dims: ['project', 'customer'] },
  { role: 'WIP', code: '11320', name: 'Pekerjaan Dalam Proses', category: 'asset', required_dims: ['project'] },
  { role: 'INVENTORY', code: '11410', name: 'Persediaan', category: 'asset', required_dims: [] },
  { role: 'PREPAID', code: '11510', name: 'Biaya Dibayar Dimuka', category: 'asset', required_dims: [] },
  { role: 'PREPAID_PPH23', code: '11610', name: 'PPh 23 Dibayar Dimuka', category: 'asset', required_dims: ['customer'] },
  { role: 'PPN_IN', code: '11620', name: 'PPN Masukan', category: 'asset', required_dims: ['vendor'] },
  { role: 'IC_RECEIVABLE', code: '11710', name: 'Piutang Antar Perusahaan', category: 'asset', required_dims: ['intercompany_partner'] },
  { role: 'FIXED_ASSET', code: '12110', name: 'Aset Tetap', category: 'asset', required_dims: [] },
  { role: 'ACCUM_DEPRECIATION', code: '12190', name: 'Akumulasi Penyusutan', category: 'asset', required_dims: [] },
  { role: 'AP', code: '21110', name: 'Utang Usaha', category: 'liability', required_dims: ['vendor'] },
  { role: 'GRNI', code: '21120', name: 'Akrual Barang Diterima Belum Ditagih', category: 'liability', required_dims: ['vendor'] },
  { role: 'PARTNER_PAYABLE', code: '21130', name: 'Utang Bagi Hasil Mitra', category: 'liability', required_dims: ['vendor'] },
  { role: 'IC_PAYABLE', code: '21140', name: 'Utang Antar Perusahaan', category: 'liability', required_dims: ['intercompany_partner'] },
  { role: 'ACCRUED_EXPENSE', code: '21210', name: 'Beban Masih Harus Dibayar', category: 'liability', required_dims: [] },
  { role: 'SALARY_PAYABLE', code: '21220', name: 'Utang Gaji', category: 'liability', required_dims: [] },
  { role: 'CONTRACT_LIABILITY', code: '21310', name: 'Liabilitas Kontrak (Pendapatan Diterima Dimuka)', category: 'liability', required_dims: ['customer'] },
  { role: 'PPN_OUT', code: '21410', name: 'PPN Keluaran', category: 'liability', required_dims: ['customer'] },
  { role: 'PPH21_PAYABLE', code: '21420', name: 'Utang PPh 21', category: 'liability', required_dims: [] },
  { role: 'PPH23_PAYABLE', code: '21430', name: 'Utang PPh 23', category: 'liability', required_dims: ['vendor'] },
  { role: 'BPJS_PAYABLE', code: '21440', name: 'Utang BPJS', category: 'liability', required_dims: [] },
  { role: 'ONEROUS_PROVISION', code: '21510', name: 'Provisi Kontrak Merugi', category: 'liability', required_dims: ['project'] },
  { role: 'RETAINED_EARNINGS', code: '31200', name: 'Saldo Laba', category: 'equity', required_dims: [] },
  { role: 'REVENUE', code: '41100', name: 'Pendapatan Jasa', category: 'revenue', required_dims: ['business_line', 'customer'] },
  { role: 'TRAINING_REVENUE', code: '41200', name: 'Pendapatan Pelatihan', category: 'revenue', required_dims: ['business_line', 'customer'] },
  { role: 'REVENUE_CONTRA_SLA', code: '41900', name: 'Pengurang Pendapatan (SLA Credit)', category: 'revenue', required_dims: ['business_line', 'customer'] },
  { role: 'FX_GAIN', code: '71100', name: 'Laba Selisih Kurs Belum Terealisasi', category: 'revenue', required_dims: [] },
  { role: 'PROJECT_COST', code: '51100', name: 'Beban Pokok Proyek', category: 'expense', required_dims: ['project', 'business_line'] },
  { role: 'REVENUE_SHARE_COST', code: '51200', name: 'Beban Bagi Hasil Mitra', category: 'expense', required_dims: ['business_line', 'vendor'] },
  { role: 'PAYROLL_ABSORBED', code: '51900', name: 'Beban Gaji Terserap Proyek (Kontra)', category: 'expense', required_dims: ['cost_center'] },
  { role: 'SALARY_EXPENSE', code: '61100', name: 'Beban Gaji', category: 'expense', required_dims: ['cost_center'] },
  { role: 'BPJS_EXPENSE', code: '61200', name: 'Beban BPJS', category: 'expense', required_dims: ['cost_center'] },
  { role: 'OPEX', code: '62100', name: 'Beban Operasional', category: 'expense', required_dims: ['cost_center'] },
  { role: 'DEPRECIATION_EXPENSE', code: '63100', name: 'Beban Penyusutan', category: 'expense', required_dims: ['cost_center'] },
  { role: 'IMPAIRMENT_EXPENSE', code: '64100', name: 'Beban Penurunan Nilai Piutang', category: 'expense', required_dims: [] },
  { role: 'ONEROUS_EXPENSE', code: '64200', name: 'Beban Kontrak Merugi', category: 'expense', required_dims: ['project'] },
  { role: 'IC_EXPENSE', code: '65100', name: 'Beban Antar Perusahaan', category: 'expense', required_dims: ['intercompany_partner'] },
  { role: 'IC_REVENUE', code: '41800', name: 'Pendapatan Antar Perusahaan', category: 'revenue', required_dims: ['intercompany_partner'] },
  { role: 'FX_LOSS', code: '72100', name: 'Rugi Selisih Kurs Belum Terealisasi', category: 'expense', required_dims: [] },
];
