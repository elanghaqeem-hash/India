// Close calendar and reporting cycles (prompt §6). Working days exclude weekends and the configured holiday list.
export type Cycle = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type ReportStatus = 'PRELIMINARY' | 'SOFT_CLOSED' | 'HARD_CLOSED' | 'AUDITED' | 'RESTATED';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isWorkday = (d: Date, holidays: Set<string>) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidays.has(iso(d));

/** WD+n after period end: WD0 = last working day of the period, WD+1 = first working day after it. */
export function workdayAfterPeriodEnd(period: string, n: number, holidays: string[]): string {
  const [y, m] = period.split('-').map(Number);
  const hs = new Set(holidays);
  let d = new Date(Date.UTC(y, m, 0)); // last calendar day
  while (!isWorkday(d, hs)) d = new Date(d.getTime() - 86400000);
  let count = 0;
  while (count < n) { d = new Date(d.getTime() + 86400000); if (isWorkday(d, hs)) count++; }
  return iso(d);
}

export type CloseParams = { monthly_soft_close_wd: number; monthly_hard_close_wd: number; quarterly_hard_close_wd: number; semiannual_hard_close_wd: number; annual_hard_close_wd: number; audit_ready_days_after_ye: number };

export function cycleOf(period: string): Cycle {
  const m = Number(period.slice(5, 7));
  return m === 12 ? 'ANNUAL' : m === 6 ? 'SEMIANNUAL' : m % 3 === 0 ? 'QUARTERLY' : 'MONTHLY';
}

export function closeDeadlines(period: string, p: CloseParams, holidays: string[]) {
  const cycle = cycleOf(period);
  const hardWd = cycle === 'ANNUAL' ? p.annual_hard_close_wd : cycle === 'SEMIANNUAL' ? p.semiannual_hard_close_wd : cycle === 'QUARTERLY' ? p.quarterly_hard_close_wd : p.monthly_hard_close_wd;
  const ye = cycle === 'ANNUAL' ? new Date(Date.UTC(Number(period.slice(0, 4)), 11, 31 + p.audit_ready_days_after_ye)) : null;
  return {
    cycle,
    cutoff_reminder: workdayAfterPeriodEnd(period, 0, holidays), // reminder issued WD-2 is computed by scheduler; WD0 lock date here
    soft_close: workdayAfterPeriodEnd(period, p.monthly_soft_close_wd, holidays),
    hard_close: workdayAfterPeriodEnd(period, hardWd, holidays),
    audit_ready: ye ? iso(ye) : null,
  };
}

export type ChecklistItem = { wd: number; task: string; owner: string; control: string; system: boolean };
export const MONTHLY_CHECKLIST: ChecklistItem[] = [
  { wd: -2, task: 'Cut-off reminder (timesheet, GR, BAST, invoice vendor)', owner: 'FIN_MGR', control: 'Notifikasi otomatis', system: true },
  { wd: 0, task: 'Timesheet lock, payroll posted', owner: 'HR,PM', control: 'Timesheet compliance >= 98%', system: false },
  { wd: 1, task: 'Depresiasi, amortisasi, deferred revenue, POC', owner: 'SYSTEM,ACCOUNTANT', control: 'Exception queue kosong', system: true },
  { wd: 1, task: 'Bank reconciliation semua rekening', owner: 'TREASURY', control: 'Selisih = 0 atau dijelaskan', system: false },
  { wd: 2, task: 'Accrual (GRNI, utilitas, bonus, cuti), ECL, FX reval', owner: 'ACCOUNTANT', control: 'Review FIN_MGR', system: false },
  { wd: 2, task: 'IC matching dan konfirmasi', owner: 'ACCOUNTANT', control: 'Selisih IC = 0', system: false },
  { wd: 3, task: 'Soft close: subledger AR/AP/Asset/Payroll/Inventory vs GL', owner: 'SYSTEM', control: 'Selisih = 0', system: true },
  { wd: 3, task: 'Project review: EAC, loss provision kontrak merugi', owner: 'PMO_HEAD,FIN_MGR', control: 'Sign-off PM', system: false },
  { wd: 4, task: 'Flux analysis', owner: 'ACCOUNTANT', control: 'Variance > threshold wajib commentary', system: false },
  { wd: 4, task: 'Pajak masa PPN, PPh 21/23/4(2) workpaper', owner: 'TAX_OFFICER', control: 'Rekonsiliasi ke GL', system: false },
  { wd: 5, task: 'Review, approval, hard close, lock periode', owner: 'FIN_MGR,CFO', control: 'Preparer != approver', system: false },
  { wd: 5, task: 'Publish Management Pack dan dashboard periode', owner: 'SYSTEM', control: 'Status HARD_CLOSED', system: true },
];

/** Flux analysis rule: commentary is required when |Δ| exceeds both the % and the absolute threshold (parameters). */
export function fluxRequiresCommentary(current: number, prior: number, pctBp: number, absCents: number): boolean {
  const delta = Math.abs(current - prior);
  if (delta <= absCents) return false;
  if (prior === 0) return true;
  return delta * 10000 > Math.abs(prior) * pctBp;
}

export type CloseState = { status: ReportStatus; items: Record<string, 'open' | 'done'>; preparer?: string; approver?: string; reopened_by?: string; reason?: string };
export function hardClose(state: CloseState, approver: string): CloseState {
  if (Object.values(state.items).some(v => v !== 'done')) throw new Error('CLOSE_CHECKLIST_INCOMPLETE');
  if (state.preparer && state.preparer.toLowerCase() === approver.toLowerCase()) throw new Error('SOD_PREPARER_APPROVER');
  return { ...state, status: 'HARD_CLOSED', approver };
}
export function reopen(state: CloseState, actor: { email: string; templates: string[] }, reason: string): CloseState {
  if (!actor.templates.includes('CFO')) throw new Error('REOPEN_CFO_ONLY');
  if (!reason || reason.length < 20) throw new Error('REOPEN_REASON_REQUIRED');
  return { ...state, status: 'RESTATED', reopened_by: actor.email, reason };
}
