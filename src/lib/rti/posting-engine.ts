// Operations-to-Ledger engine (WP06, prompt §5). Pure: accounting_event + configured posting rules → balanced journal.
// Persistence: india_accounting_events (outbox), india_posting_rules, india_account_role_map (migration 0041) and the
// existing india_gl_journals / india_gl_lines (migration 0035). Operational users never author journals.
import type { AccountRole } from './seed';

export type Side = 'D' | 'C';
export type RuleLine = { side: Side; role: string; amount: string; when?: string };
export type PostingRule = { id: string; event_type: string; version: number; effective_from: string; effective_to?: string | null; condition?: Record<string, string>; lines: RuleLine[]; auto_reverse?: boolean; note?: string };

export type AccountingEvent = {
  id: string; event_type: string; legal_entity_id: string; period: string; occurred_on: string; currency: string;
  amounts: Record<string, number>; dimensions: Record<string, string>; idempotency_key: string;
  source_type: string; source_id: string; fx_rate_id?: string;
};
export type JournalLine = { account_code: string; account_role: string; debit: number; credit: number; currency: string; dimensions: Record<string, string> };
export type Journal = { id: string; legal_entity_id: string; period: string; event_id: string; idempotency_key: string; rule_id: string; rule_version: number; source_type: string; source_id: string; memo: string; lines: JournalLine[]; reversal_of_id?: string; auto_reverse_in?: string };

export type PeriodState = 'open' | 'soft_closed' | 'hard_closed';
export type PostingContext = {
  rules: PostingRule[];
  roleMap: Record<string, Record<string, string>>; // legal entity → account role → account code
  accounts: AccountRole[]; // dimension requirements by role
  periods: Record<string, PeriodState>; // `${entity}:${period}`
  postedKeys: Set<string>;
  actor?: { email: string; templates: string[]; cfo_approval_ref?: string };
};

export class PostingError extends Error { constructor(public code: string, detail = '') { super(code + (detail ? ':' + detail : '')); } }

export const POSTING_RULES: PostingRule[] = [
  { id: 'PR-TIMESHEET', event_type: 'TIMESHEET_APPROVED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'WIP', amount: 'cost' }, { side: 'C', role: 'PAYROLL_ABSORBED', amount: 'cost' }], note: 'Tarif = cost rate karyawan berlaku (PRJ-01)' },
  { id: 'PR-POC', event_type: 'PROJECT_PROGRESS_RECOGNIZED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'UNBILLED_REVENUE', amount: 'revenue' }, { side: 'C', role: 'REVENUE', amount: 'revenue' }, { side: 'D', role: 'PROJECT_COST', amount: 'cost' }, { side: 'C', role: 'WIP', amount: 'cost' }], note: 'POC input cost-to-cost (FIN-REV-POC-01); WIP dilepas ke COGS' },
  { id: 'PR-MILESTONE-INV', event_type: 'MILESTONE_INVOICED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'AR', amount: 'gross' }, { side: 'C', role: 'UNBILLED_REVENUE', amount: 'from_unbilled' }, { side: 'C', role: 'CONTRACT_LIABILITY', amount: 'to_contract_liability' }, { side: 'C', role: 'PPN_OUT', amount: 'ppn' }] },
  { id: 'PR-ADVANCE-INV', event_type: 'ADVANCE_INVOICED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'AR', amount: 'gross' }, { side: 'C', role: 'CONTRACT_LIABILITY', amount: 'net' }, { side: 'C', role: 'PPN_OUT', amount: 'ppn' }] },
  { id: 'PR-SUBSCRIPTION', event_type: 'SUBSCRIPTION_PERIOD_ELAPSED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'CONTRACT_LIABILITY', amount: 'revenue' }, { side: 'C', role: 'REVENUE', amount: 'revenue' }] },
  { id: 'PR-CASH', event_type: 'CASH_RECEIVED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'BANK', amount: 'cash' }, { side: 'D', role: 'PREPAID_PPH23', amount: 'pph23' }, { side: 'C', role: 'AR', amount: 'settled' }] },
  { id: 'PR-GR', event_type: 'GOODS_RECEIVED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'INVENTORY', amount: 'inventory' }, { side: 'D', role: 'OPEX', amount: 'expense' }, { side: 'D', role: 'FIXED_ASSET', amount: 'asset' }, { side: 'C', role: 'GRNI', amount: 'total' }] },
  { id: 'PR-VENDOR-INV', event_type: 'VENDOR_INVOICE_MATCHED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'GRNI', amount: 'net' }, { side: 'D', role: 'PPN_IN', amount: 'ppn' }, { side: 'C', role: 'AP', amount: 'payable' }, { side: 'C', role: 'PPH23_PAYABLE', amount: 'pph23' }] },
  { id: 'PR-PAYMENT', event_type: 'PAYMENT_RELEASED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'AP', amount: 'amount' }, { side: 'C', role: 'BANK', amount: 'amount' }] },
  { id: 'PR-PAYROLL', event_type: 'PAYROLL_POSTED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'SALARY_EXPENSE', amount: 'gross_salary' }, { side: 'D', role: 'BPJS_EXPENSE', amount: 'bpjs_employer' }, { side: 'C', role: 'SALARY_PAYABLE', amount: 'net_pay' }, { side: 'C', role: 'PPH21_PAYABLE', amount: 'pph21' }, { side: 'C', role: 'BPJS_PAYABLE', amount: 'bpjs_total' }] },
  { id: 'PR-DEPRECIATION', event_type: 'DEPRECIATION_RUN', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'DEPRECIATION_EXPENSE', amount: 'amount' }, { side: 'C', role: 'ACCUM_DEPRECIATION', amount: 'amount' }] },
  { id: 'PR-PREPAID', event_type: 'PREPAID_AMORTIZED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'OPEX', amount: 'amount' }, { side: 'C', role: 'PREPAID', amount: 'amount' }] },
  { id: 'PR-TRAINING', event_type: 'TRAINING_BATCH_COMPLETED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'CONTRACT_LIABILITY', amount: 'revenue' }, { side: 'C', role: 'TRAINING_REVENUE', amount: 'revenue' }] },
  { id: 'PR-PARTNER-SHARE', event_type: 'PARTNER_SHARE_ACCRUED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'REVENUE_SHARE_COST', amount: 'partner_share' }, { side: 'C', role: 'PARTNER_PAYABLE', amount: 'partner_share' }], note: 'Berdasarkan NDR (ACD-01/ACD-02)' },
  { id: 'PR-SLA-CREDIT', event_type: 'SLA_CREDIT_ISSUED', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'REVENUE_CONTRA_SLA', amount: 'amount' }, { side: 'C', role: 'AR', amount: 'amount' }] },
  { id: 'PR-ECL', event_type: 'ECL_PROVISION', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'IMPAIRMENT_EXPENSE', amount: 'increase' }, { side: 'C', role: 'ECL_ALLOWANCE', amount: 'increase' }] },
  { id: 'PR-ONEROUS', event_type: 'ONEROUS_PROVISION', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'ONEROUS_EXPENSE', amount: 'amount' }, { side: 'C', role: 'ONEROUS_PROVISION', amount: 'amount' }] },
  { id: 'PR-FX', event_type: 'FX_REVALUATION', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'AR', amount: 'gain' }, { side: 'C', role: 'FX_GAIN', amount: 'gain' }, { side: 'D', role: 'FX_LOSS', amount: 'loss' }, { side: 'C', role: 'AR', amount: 'loss' }] },
  { id: 'PR-IC', event_type: 'INTERCOMPANY_CHARGE', version: 1, effective_from: '2027-01-01', lines: [{ side: 'D', role: 'IC_RECEIVABLE', amount: 'amount' }, { side: 'C', role: 'IC_REVENUE', amount: 'amount' }], note: 'Dieliminasi saat konsolidasi' },
  { id: 'PR-ACCRUAL', event_type: 'PERIOD_ACCRUAL', version: 1, effective_from: '2027-01-01', auto_reverse: true, lines: [{ side: 'D', role: 'OPEX', amount: 'amount' }, { side: 'C', role: 'ACCRUED_EXPENSE', amount: 'amount' }] },
];

const isP13 = (period: string) => /^\d{4}-13$/.test(period);
export function nextPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (m >= 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function selectRule(rules: PostingRule[], ev: AccountingEvent): PostingRule {
  const candidates = rules.filter(r => r.event_type === ev.event_type && r.effective_from <= ev.occurred_on && (!r.effective_to || r.effective_to > ev.occurred_on)
    && Object.entries(r.condition || {}).every(([k, v]) => ev.dimensions[k] === v));
  if (!candidates.length) throw new PostingError('NO_ACTIVE_RULE', ev.event_type);
  // Most specific condition wins, then most recent version.
  return candidates.sort((a, b) => Object.keys(b.condition || {}).length - Object.keys(a.condition || {}).length || b.version - a.version)[0];
}

export function checkPeriod(ctx: PostingContext, entity: string, period: string) {
  const st = ctx.periods[`${entity}:${period}`];
  if (!st) throw new PostingError('PERIOD_NOT_DEFINED', period);
  if (st !== 'open') throw new PostingError('PERIOD_CLOSED', period);
  if (isP13(period)) {
    if (!ctx.actor?.templates.includes('FIN_MGR')) throw new PostingError('P13_ROLE_REQUIRED');
    if (!ctx.actor.cfo_approval_ref) throw new PostingError('P13_CFO_APPROVAL_REQUIRED');
  }
}

export function postEvent(ev: AccountingEvent, ctx: PostingContext): Journal[] {
  if (!ev.idempotency_key) throw new PostingError('IDEMPOTENCY_KEY_REQUIRED');
  if (ctx.postedKeys.has(ev.idempotency_key)) throw new PostingError('DUPLICATE_EVENT', ev.idempotency_key);
  for (const [k, v] of Object.entries(ev.amounts)) if (!Number.isSafeInteger(v) || v < 0) throw new PostingError('AMOUNT_INVALID', k);
  checkPeriod(ctx, ev.legal_entity_id, ev.period);
  const rule = selectRule(ctx.rules, ev);
  const map = ctx.roleMap[ev.legal_entity_id];
  if (!map) throw new PostingError('COA_MAPPING_MISSING', ev.legal_entity_id);
  const lines: JournalLine[] = [];
  for (const rl of rule.lines) {
    const amt = ev.amounts[rl.amount] ?? 0;
    if (amt === 0) continue;
    const code = map[rl.role];
    if (!code) throw new PostingError('ACCOUNT_ROLE_UNMAPPED', rl.role);
    const meta = ctx.accounts.find(a => a.role === rl.role);
    for (const d of meta?.required_dims || []) if (!ev.dimensions[d]) throw new PostingError('DIMENSION_REQUIRED', rl.role + '.' + d);
    lines.push({ account_code: code, account_role: rl.role, debit: rl.side === 'D' ? amt : 0, credit: rl.side === 'C' ? amt : 0, currency: ev.currency, dimensions: { ...ev.dimensions } });
  }
  assertBalanced(lines);
  const journal: Journal = {
    id: 'JRN-' + ev.idempotency_key, legal_entity_id: ev.legal_entity_id, period: ev.period, event_id: ev.id, idempotency_key: ev.idempotency_key,
    rule_id: rule.id, rule_version: rule.version, source_type: ev.source_type, source_id: ev.source_id,
    memo: `${ev.event_type} ${ev.source_type}:${ev.source_id} via ${rule.id}@v${rule.version}`, lines,
  };
  const out = [journal];
  if (rule.auto_reverse) {
    const np = nextPeriod(ev.period);
    journal.auto_reverse_in = np;
    out.push(reverseJournal(journal, np, 'Auto-reversal accrual ' + ev.period));
  }
  ctx.postedKeys.add(ev.idempotency_key);
  return out;
}

export function assertBalanced(lines: JournalLine[]) {
  if (lines.length < 2) throw new PostingError('JOURNAL_TOO_FEW_LINES');
  const by = new Map<string, number>();
  for (const l of lines) by.set(l.currency, (by.get(l.currency) || 0) + l.debit - l.credit);
  for (const [c, v] of by) if (v !== 0) throw new PostingError('UNBALANCED', c + ':' + v);
}

/** Corrections are reversal + new journal; the original posted journal is never edited. */
export function reverseJournal(original: Journal, period: string, reason: string): Journal {
  if (!reason || reason.length < 12) throw new PostingError('REVERSAL_REASON_REQUIRED');
  return {
    ...original, id: original.id + '-REV', period, idempotency_key: original.idempotency_key + ':REV', reversal_of_id: original.id,
    memo: 'REVERSAL of ' + original.id + ': ' + reason, auto_reverse_in: undefined,
    lines: original.lines.map(l => ({ ...l, debit: l.credit, credit: l.debit })),
  };
}

/** Trial balance by account code from posted journals. */
export function trialBalance(journals: Journal[]) {
  const tb = new Map<string, { debit: number; credit: number }>();
  for (const j of journals) for (const l of j.lines) { const x = tb.get(l.account_code) || { debit: 0, credit: 0 }; x.debit += l.debit; x.credit += l.credit; tb.set(l.account_code, x); }
  return tb;
}

/** Drill-down chain FS line → account → journal → event → source document (prompt §5.4). */
export function drill(journals: Journal[], accountCode: string) {
  return journals.flatMap(j => j.lines.filter(l => l.account_code === accountCode).map(l => ({ journal: j.id, event: j.event_id, source: `${j.source_type}:${j.source_id}`, rule: `${j.rule_id}@v${j.rule_version}`, debit: l.debit, credit: l.credit })));
}

/** Nightly subledger → GL control account reconciliation (prompt §5.1 step 5). */
export function reconcileSubledger(subledgerTotal: number, journals: Journal[], controlCode: string) {
  const tb = trialBalance(journals).get(controlCode) || { debit: 0, credit: 0 };
  const gl = tb.debit - tb.credit;
  return { gl, subledger: subledgerTotal, difference: subledgerTotal - gl, ok: subledgerTotal === gl };
}

export function defaultRoleMap(accounts: AccountRole[]): Record<string, string> { return Object.fromEntries(accounts.map(a => [a.role, a.code])); }
