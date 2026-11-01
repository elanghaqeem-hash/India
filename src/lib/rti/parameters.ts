// Parameter Center (WP01). Single source of configuration defaults for prompt v3.0-RTI.
// Production values live in D1 table india_sys_parameters (migration 0040) under maker-checker with effective dates;
// these defaults only seed DEV/INT/UAT_SIM and are the fallback when no approved row exists.
import { rate } from './money';

export type VerifyStatus = 'VERIFIED' | 'VERIFY';
export type ParameterDef = { key: string; value: unknown; verify: VerifyStatus; source?: string; note?: string };

export const PROMPT_VERSION = '3.0-RTI';

export const DEFAULT_PARAMETERS = {
  system: { code: 'INDIA', name: 'Integrated Cybersecurity & IT Enterprise ERP + PSA', repository: 'https://github.com/elanghaqeem-hash/india', main_branch: 'main' },
  company: {
    holding_code: 'RTI', legal_name: 'PT Riset Teknologi Indonesia', brand: 'Risetin', domain: 'risetin.co.id',
    hq_address: 'Graha Mustika Ratu Lt. 7, Jl. Jend. Gatot Subroto Kav. 74-75, Menteng Dalam, Tebet, Jakarta Selatan',
    business_lines: ['ADVISORY', 'SOFTWARE', 'IT_SUPPORT', 'GOVERNANCE', 'CYBERSECURITY', 'TRAINING', 'TECH_TRADING'],
    affiliated_entities: [{ code: 'TAR', legal_name: 'PT Technotama Artha Raya', status: 'onboarding' }],
    partners: [{ code: 'ADTC', name: 'AD Training Center', scheme: 'revenue_share', rti_share: '0.60', partner_share: '0.40', base: 'net_distributable_revenue' }],
    // Legacy D1 tenant key. Renaming it is a data migration, not a label change (see WP00 audit C-03).
    tenant_key: 'defendit360',
  },
  accounting: {
    framework: 'SAK_EP', functional_currency: 'IDR', reporting_currencies: ['IDR', 'USD'],
    fiscal_year_start_month: 1, period_type: 'monthly', adjustment_period: 13,
    rounding: { mode: 'HALF_UP', minor_units: 2 }, fx_rate_source: 'BI_JISDOR',
    // SAK EP follows the SME approach: development cost capitalisation is not assumed. Finance/auditor must confirm.
    dev_cost_capitalization_allowed: false,
    receivable_impairment_model: 'PROVISION_MATRIX',
    flux_threshold_pct: '0.10', flux_threshold_amount_cents: 5_000_000_000,
  },
  tax: {
    ppn_rate: '0.12',
    // Prompt value 0.9166667 is a rounded approximation; the exact DPP nilai lain factor is the fraction 11/12.
    ppn_dpp_factor: '11/12',
    pph23_service_rate: '0.02', pph21_method: 'TER', pph_badan_rate: '0.22',
    pph_badan_31e_facility: true, pph_badan_31e_gross_cap_cents: 5_000_000_000_000, pph_badan_31e_pkp_portion_cents: 480_000_000_000, pph_badan_31e_reduction: '0.5',
    pph23_non_npwp_multiplier: '2', pph21_non_npwp_multiplier: '1.2', pph21_ter_table: 'PP58_2023',
    e_invoice_platform: 'CORETAX',
  },
  payroll: {
    bpjs_kesehatan: { employer: '0.04', employee: '0.01', wage_cap_cents: 1_200_000_000 },
    bpjs_tk: { jkk: 'by_risk_class', jkk_default_class: 1, jkm: '0.003', jht_er: '0.037', jht_ee: '0.02', jp_er: '0.02', jp_ee: '0.01', jp_wage_cap_cents: 1_108_630_000, jp_cap_effective_from: '2026-03-01' },
  },
  reporting_cycles: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'],
  close_calendar: { monthly_soft_close_wd: 3, monthly_hard_close_wd: 5, quarterly_hard_close_wd: 10, semiannual_hard_close_wd: 15, annual_hard_close_wd: 30, audit_ready_days_after_ye: 60 },
  timezone: 'Asia/Jakarta',
  holiday_calendar: 'ID_NATIONAL + company_collective_leave',
  environments: ['DEV', 'INT', 'UAT_SIM', 'STAGING', 'PROD'],
  ui: { theme: 'INDIA Vivid', default_mode: 'light', language: ['id-ID', 'en-US'] },
  security: {
    asvs_level: 2, mfa_required_roles: ['EXEC', 'FIN', 'ADMIN', 'SEC', 'PRIVILEGED'], session_idle_min: 30, session_absolute_hours: 12,
    // Dual-run cut-over (industry practice): 'shadow' evaluates and logs every ERP decision without blocking;
    // 'enforce' blocks. Flip to enforce once every active user has an approved role binding (access review evidence).
    policy_enforcement: 'shadow',
    // Cloudflare Access policy must require MFA for the INDIA application; the edge assertion is then trusted.
    mfa_enforced_at_edge: true,
    // Until bindings are provisioned, legacy login roles map to v3 templates through india_iam_legacy_role_map.
    legacy_role_fallback: true,
  },
  posting: { worker_batch_size: 50, max_attempts: 5, system_actor: 'system:posting-worker' },
  approval_limits: {
    // Cents. Tiered delegation of authority approved by the Business Owner on 2026-11-01 (L1 manager, L2 director, L3 BOD).
    PO_APPROVAL_L1: 5_000_000_000, PO_APPROVAL_L2: 50_000_000_000, PO_APPROVAL_L3: 250_000_000_000,
    PAYMENT_RELEASE_L1: 10_000_000_000, PAYMENT_RELEASE_L2: 100_000_000_000,
  },
} as const;

/** Legal or governance basis for every parameter that encodes a statutory or management decision. */
export const PARAMETER_BASIS: { key: string; basis: string; confirmed_by: string }[] = [
  { key: 'accounting.framework', basis: 'SAK EP (berlaku 1 Jan 2025) untuk entitas tanpa akuntabilitas publik signifikan', confirmed_by: 'Business Owner 2026-11-01' },
  { key: 'accounting.dev_cost_capitalization_allowed', basis: 'SAK EP: biaya riset dan pengembangan dibebankan', confirmed_by: 'Business Owner 2026-11-01' },
  { key: 'accounting.receivable_impairment_model', basis: 'Provision matrix atas umur piutang (praktik umum SAK EP dan PSAK 109)', confirmed_by: 'Business Owner 2026-11-01' },
  { key: 'accounting.fx_rate_source', basis: 'Kurs JISDOR BI untuk USD/IDR; kurs tengah BI untuk mata uang lain; kurs pajak KMK mingguan untuk faktur', confirmed_by: 'Business Owner 2026-11-01' },
  { key: 'tax.ppn_rate', basis: 'UU 7/2021 (HPP) Pasal 7', confirmed_by: 'Regulasi' },
  { key: 'tax.ppn_dpp_factor', basis: 'PMK 131/2024 Pasal 3', confirmed_by: 'Regulasi' },
  { key: 'tax.pph23_service_rate', basis: 'UU PPh Pasal 23 ayat (1) huruf c', confirmed_by: 'Regulasi' },
  { key: 'tax.pph23_non_npwp_multiplier', basis: 'UU PPh Pasal 23 ayat (1a); PMK 112/2022 NIK sebagai NPWP', confirmed_by: 'Regulasi' },
  { key: 'tax.pph21_method', basis: 'PP 58/2023; PMK 168/2023', confirmed_by: 'Regulasi' },
  { key: 'tax.pph21_ter_table', basis: 'Lampiran PP 58/2023 (tabel di india_tax_ter_brackets, migrasi 0042)', confirmed_by: 'Regulasi' },
  { key: 'tax.pph21_non_npwp_multiplier', basis: 'UU PPh Pasal 21 ayat (5a)', confirmed_by: 'Regulasi' },
  { key: 'tax.pph_badan_rate', basis: 'UU 7/2021 (HPP) Pasal 17 ayat (1) huruf b', confirmed_by: 'Regulasi' },
  { key: 'tax.pph_badan_31e_facility', basis: 'UU PPh Pasal 31E', confirmed_by: 'Regulasi' },
  { key: 'tax.e_invoice_platform', basis: 'PMK 81/2024 (Coretax)', confirmed_by: 'Regulasi' },
  { key: 'payroll.bpjs_kesehatan', basis: 'Perpres 82/2018 jo. Perpres 64/2020', confirmed_by: 'Regulasi' },
  { key: 'payroll.bpjs_tk', basis: 'PP 44/2015, PP 45/2015, PP 46/2015; SE BPJS Ketenagakerjaan B/1226/022026 (batas upah JP)', confirmed_by: 'Regulasi' },
  { key: 'approval_limits', basis: 'Delegation of authority bertingkat L1/L2/L3', confirmed_by: 'Business Owner 2026-11-01' },
  { key: 'security.policy_enforcement', basis: 'Dual-run shadow → enforce (OWASP ASVS V8, ISO 27001:2022 A.5.15/A.5.18)', confirmed_by: 'Business Owner 2026-11-01' },
];
/** Keys still awaiting external confirmation. Empty after the 2026-11-01 decisions; kept so future regulatory changes can be flagged. */
export const VERIFY_KEYS: { key: string; authority: string; why: string }[] = [];

/** Flatten nested defaults into dotted keys for D1 storage. Arrays and leaf objects are stored as JSON values. */
export function flattenParameters(obj: Record<string, unknown> = DEFAULT_PARAMETERS as unknown as Record<string, unknown>, prefix = ''): ParameterDef[] {
  const out: ParameterDef[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    const isLeafObject = v && typeof v === 'object' && !Array.isArray(v) && ['payroll.bpjs_kesehatan', 'payroll.bpjs_tk', 'accounting.rounding', 'approval_limits'].includes(key);
    if (v && typeof v === 'object' && !Array.isArray(v) && !isLeafObject) out.push(...flattenParameters(v as Record<string, unknown>, key));
    else out.push({ key, value: v, verify: VERIFY_KEYS.some(x => key === x.key || key.startsWith(x.key + '.')) ? 'VERIFY' : 'VERIFIED', source: PARAMETER_BASIS.find(x => key === x.key || key.startsWith(x.key + '.'))?.basis });
  }
  return out;
}

export type ParameterFinding = { severity: 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'INFO'; key: string; message: string };

/** Static validation of parameter values. Repo/DB conflicts are reported by the WP00 audit. */
export function validateParameters(p: typeof DEFAULT_PARAMETERS = DEFAULT_PARAMETERS): ParameterFinding[] {
  const f: ParameterFinding[] = [];
  for (const pr of p.company.partners) {
    const s = rate(pr.rti_share), t = rate(pr.partner_share);
    if (s.num * t.den + t.num * s.den !== s.den * t.den) f.push({ severity: 'BLOCKER', key: 'company.partners.' + pr.code, message: 'rti_share + partner_share harus = 1' });
  }
  const dpp = rate(p.tax.ppn_dpp_factor);
  if (!(dpp.num === 11n && dpp.den === 12n)) f.push({ severity: 'HIGH', key: 'tax.ppn_dpp_factor', message: 'Gunakan pecahan eksak 11/12, bukan desimal pembulatan' });
  if (p.accounting.framework === 'SAK_EP' && p.accounting.dev_cost_capitalization_allowed)
    f.push({ severity: 'HIGH', key: 'accounting.dev_cost_capitalization_allowed', message: 'Kapitalisasi biaya pengembangan tidak diasumsikan di SAK EP; konfirmasi auditor' });
  const cc = p.close_calendar;
  if (!(cc.monthly_soft_close_wd < cc.monthly_hard_close_wd && cc.monthly_hard_close_wd <= cc.quarterly_hard_close_wd && cc.quarterly_hard_close_wd <= cc.semiannual_hard_close_wd && cc.semiannual_hard_close_wd <= cc.annual_hard_close_wd))
    f.push({ severity: 'BLOCKER', key: 'close_calendar', message: 'Urutan hari kerja close tidak konsisten' });
  if (p.security.session_idle_min > 60) f.push({ severity: 'MEDIUM', key: 'security.session_idle_min', message: 'Idle timeout di atas 60 menit' });
  for (const v of VERIFY_KEYS) f.push({ severity: 'INFO', key: v.key, message: 'VERIFY ke ' + v.authority + ': ' + v.why });
  return f;
}

/** Resolve the approved parameter value effective on a date; falls back to defaults. */
export type ParameterRow = { key: string; value_json: string; effective_from: string; effective_to: string | null; status: string };
export function effectiveParameter<T = unknown>(rows: ParameterRow[], key: string, onDate: string): T | undefined {
  const hit = rows
    .filter(r => r.key === key && r.status === 'approved' && r.effective_from <= onDate && (!r.effective_to || r.effective_to > onDate))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
  if (hit) return JSON.parse(hit.value_json) as T;
  const def = flattenParameters().find(d => d.key === key);
  return def?.value as T | undefined;
}
