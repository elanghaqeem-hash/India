// Versioned formula library (prompt §7). Every financial or KPI number in INDIA must come from one of these entries.
// Money: integer minor units (cents). Ratios: basis points (10000 = 100%). Durations: minutes. Days: hundredths (x100).
import { applyRate, divRound, prorate, rate, ratioBp, toBig, toNum, allocate, type Rate } from './money';

export type FormulaTest = { name: string; inputs: Record<string, unknown>; expected: unknown };
export type Formula = {
  id: string; name: string; version: number; effective_from: string; owner_role: string;
  inputs: string[]; output: string; rounding: string; reference: string; verify: boolean;
  fn: (i: any) => unknown; tests: FormulaTest[];
};

const R = (x: string | Rate) => rate(x);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------- Revenue (§7.1) ----------
export function pocRevenue(i: { contract_price: number; cost_to_date: number; eac: number; revenue_recognized_to_date: number }) {
  if (i.eac <= 0) throw new Error('EAC_INVALID');
  const cost = Math.min(i.cost_to_date, i.eac);
  const cumulative = prorate(i.contract_price, cost, i.eac, 'HALF_UP');
  return cumulative - i.revenue_recognized_to_date;
}
export function contractBalance(i: { revenue_recognized: number; amount_billed: number }) {
  return { contract_asset: Math.max(0, i.revenue_recognized - i.amount_billed), contract_liability: Math.max(0, i.amount_billed - i.revenue_recognized) };
}
export function onerousProvision(i: { contract_price: number; eac: number; provision_to_date: number }) {
  return Math.max(0, i.eac - i.contract_price) - i.provision_to_date;
}
/** Ratable recognition of a service period by days; the final period absorbs rounding so the total is exact. */
export function ratableRevenue(i: { contract_value: number; service_days: number; days_elapsed_to_date: number; recognized_to_date: number }) {
  const d = Math.min(i.days_elapsed_to_date, i.service_days);
  const cumulative = d === i.service_days ? i.contract_value : prorate(i.contract_value, d, i.service_days, 'HALF_UP');
  return cumulative - i.recognized_to_date;
}
/** Bundles: allocate transaction price to performance obligations by relative standalone selling price. */
export function allocateSsp(i: { transaction_price: number; ssp: number[] }) { return allocate(i.transaction_price, i.ssp); }

// ---------- Project & resource (§7.2) ----------
export function costRatePerHour(i: { salary: number; allowances: number; bpjs_employer: number; benefits: number; overhead_loading: number; available_hours: number }) {
  return prorate(i.salary + i.allowances + i.bpjs_employer + i.benefits + i.overhead_loading, 1, i.available_hours, 'HALF_UP');
}
export const eacBottomUp = (i: { actual_cost: number; etc: number }) => i.actual_cost + i.etc;
export function eacCpi(i: { actual_cost: number; bac: number; earned_value: number }) {
  if (i.earned_value <= 0) throw new Error('EV_ZERO');
  return i.actual_cost + prorate(i.bac - i.earned_value, i.actual_cost, i.earned_value, 'HALF_UP');
}
export const earnedValue = (i: { pct_complete_bp: number; bac: number }) => prorate(i.bac, i.pct_complete_bp, 10000, 'HALF_UP');
export const cpiSpi = (i: { ev: number; ac: number; pv: number }) => ({ cpi_bp: ratioBp(i.ev, i.ac), spi_bp: ratioBp(i.ev, i.pv) });
export const projectMargin = (i: { revenue: number; direct_cost: number }) => ratioBp(i.revenue - i.direct_cost, i.revenue);
export const utilization = (i: { billable_hours: number; available_hours: number }) => ratioBp(i.billable_hours, i.available_hours);
export const realization = (i: { billed_value: number; billable_hours: number; standard_rate: number }) => ratioBp(i.billed_value, i.billable_hours * i.standard_rate);
export const backlog = (i: { contract_value: number; revenue_recognized: number }) => i.contract_value - i.revenue_recognized;

// ---------- Finance & treasury (§7.3) ----------
const days100 = (bal: number, flow: number, days: number) => flow === 0 ? null : toNum(divRound(toBig(bal) * BigInt(days) * 100n, toBig(flow)));
export const dso = (i: { avg_ar: number; credit_revenue: number; days: number }) => days100(i.avg_ar, i.credit_revenue, i.days);
export const dpo = (i: { avg_ap: number; credit_purchases: number; days: number }) => days100(i.avg_ap, i.credit_purchases, i.days);
export const ccc = (i: { dso_x100: number; dio_x100: number; dpo_x100: number }) => i.dso_x100 + i.dio_x100 - i.dpo_x100;
export const liquidity = (i: { current_assets: number; current_liabilities: number; cash: number; ar: number }) => ({ current_ratio_bp: ratioBp(i.current_assets, i.current_liabilities), quick_ratio_bp: ratioBp(i.cash + i.ar, i.current_liabilities) });
export const ebitda = (i: { operating_profit: number; depreciation: number; amortization: number }) => i.operating_profit + i.depreciation + i.amortization;
export function eclProvisionMatrix(i: { buckets: { balance: number; loss_rate: string; forward_factor: string }[] }) {
  return sum(i.buckets.map(b => { const r = R(b.loss_rate), f = R(b.forward_factor); return toNum(divRound(toBig(b.balance) * r.num * f.num, r.den * f.den)); }));
}
/** Straight-line schedule; last month absorbs rounding so Σ = depreciable base. */
export function straightLineSchedule(i: { cost: number; residual: number; useful_life_months: number }) {
  const base = i.cost - i.residual; if (base < 0 || i.useful_life_months <= 0) throw new Error('DEPRECIATION_INPUT');
  const m = prorate(base, 1, i.useful_life_months, 'HALF_UP');
  const out = Array.from({ length: i.useful_life_months }, () => m);
  out[out.length - 1] = base - m * (i.useful_life_months - 1);
  return out;
}
/** First depreciation month per policy parameter: acquired on/before cut-off day → same month, else next month. */
export function depreciationStartMonth(i: { acquired: string; cutoff_day: number }) {
  const [y, mo, d] = i.acquired.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + (d > i.cutoff_day ? 1 : 0), 1));
  return dt.toISOString().slice(0, 7);
}
export function cashForecast13w(i: { opening: number; weeks: { ar_due: { amount: number; probability: string }[]; ap_due: number; payroll: number; tax: number; po_commitment: number }[] }) {
  let bal = i.opening; const out: number[] = [];
  for (const w of i.weeks.slice(0, 13)) {
    bal += sum(w.ar_due.map(x => applyRate(x.amount, x.probability))) - w.ap_due - w.payroll - w.tax - w.po_commitment; out.push(bal);
  }
  return out;
}
export function budgetVariance(i: { actual_qty: number; actual_rate: number; budget_qty: number; budget_rate: number }) {
  const actual = i.actual_qty * i.actual_rate, budget = i.budget_qty * i.budget_rate;
  return { variance: actual - budget, rate_variance: (i.actual_rate - i.budget_rate) * i.actual_qty, volume_variance: (i.actual_qty - i.budget_qty) * i.budget_rate };
}
/** FX revaluation of a foreign-currency balance (minor units) to IDR minor units. Rates as decimal strings (IDR per 1 FC). */
export function fxRevaluation(i: { balance_fc: number; closing_rate: string; booked_rate: string }) {
  const c = R(i.closing_rate), b = R(i.booked_rate);
  return toNum(divRound(toBig(i.balance_fc) * (c.num * b.den - b.num * c.den), c.den * b.den));
}

// ---------- Service & commercial (§7.4) ----------
const minutes = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);
export function mtta(i: { cases: { created: string; acknowledged: string }[] }) { return i.cases.length ? Math.round(sum(i.cases.map(c => minutes(c.created, c.acknowledged))) / i.cases.length) : null; }
export function mttr(i: { cases: { created: string; resolved: string }[] }) { return i.cases.length ? Math.round(sum(i.cases.map(c => minutes(c.created, c.resolved))) / i.cases.length) : null; }
/** Business-hours minutes between two instants in a fixed-offset timezone (WIB = +7), excluding weekends and holidays. */
export function businessMinutes(i: { from: string; to: string; start_hour: number; end_hour: number; offset_hours: number; holidays: string[] }) {
  let t = Date.parse(i.from); const end = Date.parse(i.to); let total = 0; const off = i.offset_hours * 3600000;
  while (t < end) {
    const local = new Date(t + off); const day = local.toISOString().slice(0, 10); const dow = local.getUTCDay();
    const dayStart = Date.parse(day + 'T00:00:00Z') - off;
    const open = dayStart + i.start_hour * 3600000, close = dayStart + i.end_hour * 3600000;
    if (dow !== 0 && dow !== 6 && !i.holidays.includes(day)) { const a = Math.max(t, open), b = Math.min(end, close); if (b > a) total += b - a; }
    t = dayStart + 24 * 3600000;
  }
  return Math.round(total / 60000);
}
export const slaCompliance = (i: { met: number; eligible: number }) => ratioBp(i.met, i.eligible);
/** CVSS v4.0 score in tenths (e.g. 9.3 → 93) × asset criticality factor → tenths. */
export const vaptRiskScore = (i: { cvss_tenths: number; criticality_factor: string }) => applyRate(i.cvss_tenths, i.criticality_factor);
export const remediationRate = (i: { closed_verified: number; total: number }) => ratioBp(i.closed_verified, i.total);
export const weightedPipeline = (i: { opportunities: { value: number; probability_pct: number }[] }) => sum(i.opportunities.map(o => prorate(o.value, o.probability_pct, 100)));
export const winRate = (i: { won: number; lost: number }) => ratioBp(i.won, i.won + i.lost);
export function recurring(i: { mrr_start: number; mrr_lost: number; mrr_end: number }) { return { mrr: i.mrr_end, arr: i.mrr_end * 12, churn_bp: ratioBp(i.mrr_lost, i.mrr_start) }; }

// ---------- Academy partnership (§7.4 ACD) ----------
export function netDistributableRevenue(i: { batch_revenue: number; direct_costs: { category: string; amount: number }[]; agreed_categories: string[] }) {
  const unknown = i.direct_costs.filter(c => !i.agreed_categories.includes(c.category));
  if (unknown.length) throw new Error('NDR_COST_NOT_IN_AGREEMENT:' + unknown.map(c => c.category).join(','));
  return i.batch_revenue - sum(i.direct_costs.map(c => c.amount));
}
/** Partner share is rounded; RTI receives the exact remainder so both shares always sum to NDR. Negative NDR is not shared. */
export function revenueShare(i: { ndr: number; partner_share: string; rti_share: string }) {
  const p = R(i.partner_share), r = R(i.rti_share);
  if (p.num * r.den + r.num * p.den !== p.den * r.den) throw new Error('SHARE_NOT_100');
  if (i.ndr <= 0) return { partner: 0, rti: i.ndr, loss_unshared: i.ndr < 0 };
  const partner = applyRate(i.ndr, p, 'HALF_UP');
  return { partner, rti: i.ndr - partner, loss_unshared: false };
}

// ---------- Tax (§7.5, all rates are parameters, VERIFY) ----------
export function ppn(i: { price: number; rate: string; dpp_factor: string }) {
  const dpp = applyRate(i.price, i.dpp_factor, 'HALF_UP');
  return { dpp, ppn: applyRate(dpp, i.rate, 'HALF_UP') };
}
export const pph23 = (i: { gross_service: number; rate: string; has_npwp: boolean; non_npwp_multiplier: string }) =>
  applyRate(i.gross_service, i.has_npwp ? i.rate : (() => { const a = R(i.rate), m = R(i.non_npwp_multiplier); return { num: a.num * m.num, den: a.den * m.den }; })());

export type TerBracket = { up_to: number | null; rate: string };
/** Monthly PPh 21 by TER: bracket rate looked up from the parameterised table for the employee's TER category. */
export function pph21Ter(i: { gross_monthly: number; table: TerBracket[] }) {
  const b = i.table.find(x => x.up_to === null || i.gross_monthly <= x.up_to);
  if (!b) throw new Error('TER_TABLE_INCOMPLETE');
  return applyRate(i.gross_monthly, b.rate, 'DOWN');
}
export type ProgressiveBracket = { up_to: number | null; rate: string };
/** Annual progressive tax on PKP (PKP rounded down to the nearest Rp1.000 = 100000 cents). */
export function progressiveTax(i: { pkp: number; brackets: ProgressiveBracket[] }) {
  const pkp = Math.floor(i.pkp / 100000) * 100000; let prev = 0, tax = 0;
  for (const b of i.brackets) {
    const top = b.up_to === null ? pkp : Math.min(pkp, b.up_to);
    if (top > prev) tax += applyRate(top - prev, b.rate, 'DOWN');
    if (b.up_to === null || pkp <= b.up_to) break; prev = b.up_to;
  }
  return tax;
}
/** December true-up: annual PPh 21 (pasal 17) minus TER withheld January–November. */
export function pph21December(i: { annual_gross: number; employee_pension_contrib: number; ptkp: number; withheld_jan_nov: number; biaya_jabatan_rate: string; biaya_jabatan_cap: number; brackets: ProgressiveBracket[] }) {
  const bj = Math.min(applyRate(i.annual_gross, i.biaya_jabatan_rate, 'DOWN'), i.biaya_jabatan_cap);
  const pkp = Math.max(0, i.annual_gross - bj - i.employee_pension_contrib - i.ptkp);
  return progressiveTax({ pkp, brackets: i.brackets }) - i.withheld_jan_nov;
}
/** Corporate income tax with optional pasal 31E facility. */
export function pphBadan(i: { pkp: number; gross_revenue: number; rate: string; facility: boolean; gross_cap: number; pkp_portion_cap: number; reduction: string }) {
  const pkp = Math.floor(i.pkp / 100000) * 100000;
  if (!i.facility || i.gross_revenue > i.gross_cap || pkp <= 0) return applyRate(Math.max(0, pkp), i.rate, 'DOWN');
  const facilityPkp = i.gross_revenue <= i.pkp_portion_cap ? pkp : prorate(pkp, i.pkp_portion_cap, i.gross_revenue, 'DOWN');
  const r = R(i.rate), red = R(i.reduction);
  const facTax = toNum(divRound(toBig(facilityPkp) * r.num * (red.den - red.num), r.den * red.den, 'DOWN'));
  return facTax + applyRate(pkp - facilityPkp, i.rate, 'DOWN');
}

// ---------- Registry ----------
const F = (id: string, name: string, owner: string, reference: string, verify: boolean, fn: (i: any) => unknown, tests: FormulaTest[], inputs: string[] = [], output = 'value'): Formula =>
  ({ id, name, version: 1, effective_from: '2027-01-01', owner_role: owner, inputs, output, rounding: 'HALF_UP, minor units', reference, verify, fn, tests });

// Synthetic test-only tables (NOT the regulatory TER table, which must be loaded from regulation into tax.pph21_ter_table).
const SYNTH_TER: TerBracket[] = [{ up_to: 500_000_000, rate: '0' }, { up_to: 1_000_000_000, rate: '0.02' }, { up_to: null, rate: '0.05' }];
const PASAL17: ProgressiveBracket[] = [{ up_to: 6_000_000_000, rate: '0.05' }, { up_to: 25_000_000_000, rate: '0.15' }, { up_to: 50_000_000_000, rate: '0.25' }, { up_to: 500_000_000_000, rate: '0.30' }, { up_to: null, rate: '0.35' }];
export const PASAL17_BRACKETS_DEFAULT = PASAL17;

export const FORMULAS: Formula[] = [
  F('FIN-REV-POC-01', 'Revenue POC cost-to-cost', 'FIN_MGR', 'PSAK 115 / SAK EP setara [VERIFY framework]', true, pocRevenue, [
    { name: '40% complete, nothing recognised', inputs: { contract_price: 100_000_000_00, cost_to_date: 24_000_000_00, eac: 60_000_000_00, revenue_recognized_to_date: 0 }, expected: 40_000_000_00 },
    { name: 'second period cumulative 75%', inputs: { contract_price: 100_000_000_00, cost_to_date: 45_000_000_00, eac: 60_000_000_00, revenue_recognized_to_date: 40_000_000_00 }, expected: 35_000_000_00 },
    { name: 'cost overrun capped at 100%', inputs: { contract_price: 100_000_000_00, cost_to_date: 70_000_000_00, eac: 60_000_000_00, revenue_recognized_to_date: 75_000_000_00 }, expected: 25_000_000_00 },
  ], ['contract_price', 'cost_to_date', 'eac', 'revenue_recognized_to_date'], 'revenue_this_period'),
  F('FIN-REV-CA-01', 'Contract asset / liability', 'FIN_MGR', 'PSAK 115', true, contractBalance, [
    { name: 'unbilled', inputs: { revenue_recognized: 75_00, amount_billed: 50_00 }, expected: { contract_asset: 25_00, contract_liability: 0 } },
    { name: 'billed ahead', inputs: { revenue_recognized: 30_00, amount_billed: 50_00 }, expected: { contract_asset: 0, contract_liability: 20_00 } },
  ]),
  F('FIN-REV-ONEROUS-01', 'Onerous contract provision', 'FIN_MGR', 'PSAK 237 / SAK EP', true, onerousProvision, [
    { name: 'EAC exceeds price', inputs: { contract_price: 100_00, eac: 130_00, provision_to_date: 0 }, expected: 30_00 },
    { name: 'no loss', inputs: { contract_price: 100_00, eac: 90_00, provision_to_date: 0 }, expected: 0 },
  ]),
  F('FIN-REV-RATABLE-01', 'Ratable subscription revenue', 'FIN_MGR', 'PSAK 115', true, ratableRevenue, [
    { name: 'January of 365-day contract', inputs: { contract_value: 120_000_000_00, service_days: 365, days_elapsed_to_date: 31, recognized_to_date: 0 }, expected: 1_019_178_082 },
    { name: 'final day absorbs rounding', inputs: { contract_value: 100, service_days: 3, days_elapsed_to_date: 3, recognized_to_date: 67 }, expected: 33 },
  ]),
  F('FIN-REV-SSP-01', 'Bundle allocation by SSP', 'FIN_MGR', 'PSAK 115', true, allocateSsp, [
    { name: 'three obligations', inputs: { transaction_price: 1000, ssp: [500, 300, 300] }, expected: [454, 273, 273] },
  ]),
  F('PRJ-01', 'Cost rate per hour', 'FIN_MGR', 'Internal policy', false, costRatePerHour, [
    { name: 'standard employee', inputs: { salary: 15_000_000_00, allowances: 2_000_000_00, bpjs_employer: 1_200_000_00, benefits: 500_000_00, overhead_loading: 3_300_000_00, available_hours: 160 }, expected: 137_500_00 },
  ]),
  F('PRJ-02', 'EAC bottom-up', 'PM', 'PMBOK', false, eacBottomUp, [{ name: 'basic', inputs: { actual_cost: 40_00, etc: 25_00 }, expected: 65_00 }]),
  F('PRJ-02B', 'EAC CPI method', 'PM', 'PMBOK', false, eacCpi, [{ name: 'CPI 0.8', inputs: { actual_cost: 50_00, bac: 100_00, earned_value: 40_00 }, expected: 125_00 }]),
  F('PRJ-03', 'Earned value', 'PM', 'PMBOK', false, earnedValue, [{ name: '35%', inputs: { pct_complete_bp: 3500, bac: 200_000_00 }, expected: 70_000_00 }]),
  F('PRJ-04', 'CPI / SPI', 'PM', 'PMBOK', false, cpiSpi, [{ name: 'behind and over', inputs: { ev: 40, ac: 50, pv: 80 }, expected: { cpi_bp: 8000, spi_bp: 5000 } }]),
  F('PRJ-05', 'Project gross margin', 'PMO_HEAD', 'Internal', false, projectMargin, [{ name: '30%', inputs: { revenue: 100_00, direct_cost: 70_00 }, expected: 3000 }]),
  F('PRJ-06', 'Billable utilization', 'RESOURCE_MGR', 'Internal', false, utilization, [{ name: '120/160', inputs: { billable_hours: 120, available_hours: 160 }, expected: 7500 }]),
  F('PRJ-07', 'Realization rate', 'PMO_HEAD', 'Internal', false, realization, [{ name: '90%', inputs: { billed_value: 9_000_00, billable_hours: 10, standard_rate: 1_000_00 }, expected: 9000 }]),
  F('PRJ-08', 'Backlog', 'PMO_HEAD', 'Internal', false, backlog, [{ name: 'remaining', inputs: { contract_value: 100_00, revenue_recognized: 35_00 }, expected: 65_00 }]),
  F('FIN-01', 'DSO (days x100)', 'FIN_MGR', 'Internal', false, dso, [{ name: '45 days', inputs: { avg_ar: 150_00, credit_revenue: 100_00, days: 30 }, expected: 4500 }]),
  F('FIN-02', 'DPO (days x100)', 'FIN_MGR', 'Internal', false, dpo, [{ name: '20 days', inputs: { avg_ap: 2_00, credit_purchases: 3_00, days: 30 }, expected: 2000 }]),
  F('FIN-03', 'Cash conversion cycle', 'FIN_MGR', 'Internal', false, ccc, [{ name: 'service co', inputs: { dso_x100: 4500, dio_x100: 0, dpo_x100: 2000 }, expected: 2500 }]),
  F('FIN-04', 'Current / quick ratio', 'FIN_MGR', 'Internal', false, liquidity, [{ name: 'basic', inputs: { current_assets: 300, current_liabilities: 200, cash: 100, ar: 150 }, expected: { current_ratio_bp: 15000, quick_ratio_bp: 12500 } }]),
  F('FIN-05', 'EBITDA', 'FIN_MGR', 'Internal', false, ebitda, [{ name: 'basic', inputs: { operating_profit: 100, depreciation: 20, amortization: 5 }, expected: 125 }]),
  F('FIN-06', 'Receivable impairment provision matrix', 'FIN_MGR', 'PSAK 109 / SAK EP [VERIFY model]', true, eclProvisionMatrix, [
    { name: 'three buckets', inputs: { buckets: [{ balance: 100_000_000_00, loss_rate: '0.01', forward_factor: '1.1' }, { balance: 20_000_000_00, loss_rate: '0.05', forward_factor: '1.1' }, { balance: 5_000_000_00, loss_rate: '0.5', forward_factor: '1' }] }, expected: 1_100_000_00 + 1_100_000_00 + 2_500_000_00 },
  ]),
  F('FIN-07', 'Straight-line depreciation schedule', 'FIN_MGR', 'SAK EP aset tetap', false, straightLineSchedule, [
    { name: '3 months with remainder', inputs: { cost: 1000, residual: 0, useful_life_months: 3 }, expected: [333, 333, 334] },
    { name: 'laptop 48 months', inputs: { cost: 24_000_000_00, residual: 0, useful_life_months: 48 }, expected: Array(48).fill(500_000_00) },
  ]),
  F('FIN-07B', 'Depreciation start month', 'FIN_MGR', 'Kebijakan akuntansi [parameter cut-off]', true, depreciationStartMonth, [
    { name: 'before cut-off', inputs: { acquired: '2027-03-15', cutoff_day: 15 }, expected: '2027-03' },
    { name: 'after cut-off, year roll', inputs: { acquired: '2027-12-20', cutoff_day: 15 }, expected: '2028-01' },
  ]),
  F('FIN-08', '13-week cash forecast', 'FIN_MGR', 'Internal', false, cashForecast13w, [
    { name: 'two weeks', inputs: { opening: 1000, weeks: [{ ar_due: [{ amount: 500, probability: '0.8' }], ap_due: 100, payroll: 200, tax: 0, po_commitment: 0 }, { ar_due: [], ap_due: 0, payroll: 0, tax: 50, po_commitment: 25 }] }, expected: [1100, 1025] },
  ]),
  F('FIN-09', 'Budget variance (rate/volume)', 'FIN_MGR', 'Internal', false, budgetVariance, [
    { name: 'man-day', inputs: { actual_qty: 110, actual_rate: 95, budget_qty: 100, budget_rate: 100 }, expected: { variance: 450, rate_variance: -550, volume_variance: 1000 } },
  ]),
  F('FIN-10', 'FX revaluation', 'FIN_MGR', 'SAK EP valuta asing', true, fxRevaluation, [
    { name: 'USD AR gain', inputs: { balance_fc: 10_000_00, closing_rate: '16250', booked_rate: '16000' }, expected: 2_500_000_00 },
  ]),
  F('SVC-01A', 'MTTA minutes (24x7)', 'SOC_MGR', 'Kontrak SLA', false, mtta, [{ name: 'two cases', inputs: { cases: [{ created: '2027-01-01T00:00:00Z', acknowledged: '2027-01-01T00:10:00Z' }, { created: '2027-01-01T01:00:00Z', acknowledged: '2027-01-01T01:20:00Z' }] }, expected: 15 }]),
  F('SVC-01B', 'MTTR minutes (24x7)', 'SOC_MGR', 'Kontrak SLA', false, mttr, [{ name: 'one case', inputs: { cases: [{ created: '2027-01-01T00:00:00Z', resolved: '2027-01-01T04:00:00Z' }] }, expected: 240 }]),
  F('SVC-01C', 'Business-hours minutes', 'SOC_MGR', 'Kontrak SLA kalender kerja', false, businessMinutes, [
    { name: 'Friday 16:00 to Monday 09:00 WIB', inputs: { from: '2027-01-08T09:00:00Z', to: '2027-01-11T02:00:00Z', start_hour: 8, end_hour: 17, offset_hours: 7, holidays: [] }, expected: 120 },
    { name: 'holiday skipped', inputs: { from: '2027-01-08T09:00:00Z', to: '2027-01-11T02:00:00Z', start_hour: 8, end_hour: 17, offset_hours: 7, holidays: ['2027-01-08'] }, expected: 60 },
  ]),
  F('SVC-02', 'SLA compliance', 'SOC_MGR', 'Kontrak SLA', false, slaCompliance, [{ name: '95%', inputs: { met: 95, eligible: 100 }, expected: 9500 }]),
  F('SVC-03', 'VAPT risk score', 'VAPT_LEAD', 'CVSS v4.0 × criticality parameter', false, vaptRiskScore, [{ name: '9.3 × 1.2', inputs: { cvss_tenths: 93, criticality_factor: '1.2' }, expected: 112 }]),
  F('SVC-04', 'Remediation rate', 'VAPT_LEAD', 'Internal', false, remediationRate, [{ name: '7/8', inputs: { closed_verified: 7, total: 8 }, expected: 8750 }]),
  F('COM-01', 'Weighted pipeline', 'SALES_MGR', 'Internal', false, weightedPipeline, [{ name: 'two opps', inputs: { opportunities: [{ value: 100_00, probability_pct: 50 }, { value: 200_00, probability_pct: 25 }] }, expected: 100_00 }]),
  F('COM-02', 'Win rate', 'SALES_MGR', 'Internal', false, winRate, [{ name: '3 of 4', inputs: { won: 3, lost: 1 }, expected: 7500 }]),
  F('COM-03', 'MRR / ARR / churn', 'FIN_MGR', 'Internal', false, recurring, [{ name: 'basic', inputs: { mrr_start: 100_00, mrr_lost: 5_00, mrr_end: 110_00 }, expected: { mrr: 110_00, arr: 1320_00, churn_bp: 500 } }]),
  F('ACD-01', 'Net Distributable Revenue', 'FIN_MGR', 'Perjanjian kerja sama ADTC [VERIFY klausul biaya]', true, netDistributableRevenue, [
    { name: 'batch 20 peserta', inputs: { batch_revenue: 20 * 5_000_000_00, direct_costs: [{ category: 'trainer', amount: 15_000_000_00 }, { category: 'venue', amount: 10_000_000_00 }, { category: 'konsumsi', amount: 6_000_000_00 }, { category: 'sertifikasi', amount: 9_000_000_00 }], agreed_categories: ['trainer', 'venue', 'konsumsi', 'sertifikasi', 'pajak_final'] }, expected: 60_000_000_00 },
  ]),
  F('ACD-02', 'Revenue share settlement', 'FIN_MGR', 'Perjanjian kerja sama ADTC', true, revenueShare, [
    { name: '60:40', inputs: { ndr: 60_000_000_00, partner_share: '0.40', rti_share: '0.60' }, expected: { partner: 24_000_000_00, rti: 36_000_000_00, loss_unshared: false } },
    { name: 'odd cent goes exact', inputs: { ndr: 101, partner_share: '0.40', rti_share: '0.60' }, expected: { partner: 40, rti: 61, loss_unshared: false } },
    { name: 'loss not shared', inputs: { ndr: -500, partner_share: '0.40', rti_share: '0.60' }, expected: { partner: 0, rti: -500, loss_unshared: true } },
  ]),
  F('TAX-PPN-01', 'PPN with DPP nilai lain', 'TAX_OFFICER', 'UU HPP + PMK DPP nilai lain [VERIFY]', true, ppn, [
    { name: 'Rp100 juta non-mewah → efektif 11%', inputs: { price: 100_000_000_00, rate: '0.12', dpp_factor: '11/12' }, expected: { dpp: 9_166_666_667, ppn: 1_100_000_000 } },
  ]),
  F('TAX-PPH23-01', 'PPh 23 jasa', 'TAX_OFFICER', 'UU PPh pasal 23 [VERIFY]', true, pph23, [
    { name: 'NPWP', inputs: { gross_service: 50_000_000_00, rate: '0.02', has_npwp: true, non_npwp_multiplier: '2' }, expected: 1_000_000_00 },
    { name: 'tanpa NPWP', inputs: { gross_service: 50_000_000_00, rate: '0.02', has_npwp: false, non_npwp_multiplier: '2' }, expected: 2_000_000_00 },
  ]),
  F('TAX-PPH21-TER-01', 'PPh 21 bulanan TER', 'PAYROLL', 'PP 58/2023, PMK 168/2023 [VERIFY tabel TER]', true, pph21Ter, [
    { name: 'synthetic table bracket 2', inputs: { gross_monthly: 8_000_000_00, table: SYNTH_TER }, expected: 160_000_00 },
  ]),
  F('TAX-PPH21-DES-01', 'PPh 21 Desember (pasal 17 − TER Jan–Nov)', 'PAYROLL', 'UU HPP pasal 17 [VERIFY]', true, pph21December, [
    { name: 'TK/0 Rp120 juta/tahun', inputs: { annual_gross: 120_000_000_00, employee_pension_contrib: 2_400_000_00, ptkp: 54_000_000_00, withheld_jan_nov: 3_000_000_00, biaya_jabatan_rate: '0.05', biaya_jabatan_cap: 6_000_000_00, brackets: PASAL17 }, expected: 2_880_000_00 - 3_000_000_00 },
  ]),
  F('TAX-PPHB-01', 'PPh badan dengan fasilitas 31E', 'TAX_OFFICER', 'UU PPh pasal 17 dan 31E [VERIFY]', true, pphBadan, [
    { name: 'peredaran Rp10 M, PKP Rp1 M', inputs: { pkp: 1_000_000_000_00, gross_revenue: 10_000_000_000_00, rate: '0.22', facility: true, gross_cap: 50_000_000_000_00, pkp_portion_cap: 4_800_000_000_00, reduction: '0.5' }, expected: 52_800_000_00 + 114_400_000_00 },
    { name: 'tanpa fasilitas', inputs: { pkp: 1_000_000_000_00, gross_revenue: 60_000_000_000_00, rate: '0.22', facility: true, gross_cap: 50_000_000_000_00, pkp_portion_cap: 4_800_000_000_00, reduction: '0.5' }, expected: 220_000_000_00 },
  ]),
];

export function runFormulaTests(formulas: Formula[] = FORMULAS) {
  const results: { id: string; test: string; pass: boolean; actual: unknown; expected: unknown }[] = [];
  for (const f of formulas) for (const t of f.tests) {
    let actual: unknown; try { actual = f.fn(t.inputs); } catch (e) { actual = String(e); }
    results.push({ id: f.id, test: t.name, pass: JSON.stringify(actual) === JSON.stringify(t.expected), actual, expected: t.expected });
  }
  return results;
}
export const formulaById = (id: string) => FORMULAS.find(f => f.id === id);
