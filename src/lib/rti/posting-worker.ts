// Posting worker (WP06 wiring): drains india_accounting_events (transactional outbox) into the existing general ledger
// tables india_gl_journals / india_gl_lines (0035) with india_gl_journal_links + india_gl_line_dimensions (0041/0043).
// Each event is posted in ONE D1 batch (journal draft → lines → approved under the approved posting rule → posted →
// link → event posted), so a failure leaves nothing half-written; the event then moves to the exception queue.
import type { D1DB, D1Prepared } from '../boq-auth';
import { DEFAULT_PARAMETERS } from './parameters';
import { postEvent, PostingError, nextPeriod, type AccountingEvent, type Journal, type JournalLine, type PeriodState, type PostingRule } from './posting-engine';
import type { AccountRole } from './seed';
import { readParameter } from './runtime';

export type WorkerResult = { run_id: string; picked: number; posted: number; exceptions: { event_id: string; code: string }[]; journals: string[] };
type EventRow = { id: string; event_type: string; legal_entity_id: string; period: string; occurred_on: string; currency: string; amounts_json: string; dimensions_json: string; source_type: string; source_id: string; idempotency_key: string; attempts: number };

async function legacyEntity(db: D1DB, tenant: string, entity: string) {
  const row = await db.prepare("SELECT legacy_unit_id FROM india_org_unit_legacy_map WHERE tenant_id=? AND legal_entity_id=? AND org_unit_id=? AND status='approved' LIMIT 1")
    .bind(tenant, entity, entity).first<{ legacy_unit_id: string }>();
  if (!row) throw new PostingError('ENTITY_NOT_MAPPED_TO_LEDGER', entity);
  return row.legacy_unit_id;
}

async function periodState(db: D1DB, tenant: string, entity: string, legacy: string, period: string): Promise<{ state: PeriodState | undefined; period_id: string | null }> {
  const p = await db.prepare('SELECT id,status FROM india_gl_periods WHERE tenant_id=? AND legal_entity_id=? AND period=?').bind(tenant, legacy, period).first<{ id: string; status: string }>();
  if (!p) return { state: undefined, period_id: null };
  if (p.status !== 'open') return { state: 'hard_closed', period_id: p.id };
  const close = await db.prepare('SELECT status FROM india_close_runs WHERE tenant_id=? AND legal_entity_id=? AND period=?').bind(tenant, entity, period).first<{ status: string }>();
  const st: PeriodState = !close || close.status === 'PRELIMINARY' || close.status === 'RESTATED' ? 'open' : close.status === 'SOFT_CLOSED' ? 'soft_closed' : 'hard_closed';
  return { state: st, period_id: p.id };
}

async function roleMap(db: D1DB, tenant: string, entity: string, legacy: string, onDate: string, roles: AccountRole[]) {
  const mapped = await db.prepare('SELECT role,account_code FROM india_account_role_map WHERE tenant_id=? AND legal_entity_id=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>?)')
    .bind(tenant, entity, onDate, onDate).all<{ role: string; account_code: string }>();
  const accounts = await db.prepare('SELECT id,code FROM india_gl_accounts WHERE tenant_id=? AND legal_entity_id=? AND active=1').bind(tenant, legacy).all<{ id: string; code: string }>();
  const byCode = new Map(accounts.results.map(a => [a.code, a.id]));
  const codeOf: Record<string, string> = {}, idOf: Record<string, string> = {};
  for (const r of roles) {
    const code = mapped.results.find(m => m.role === r.role)?.account_code ?? r.code;
    const id = byCode.get(code);
    if (id) { codeOf[r.role] = code; idOf[code] = id; }
  }
  return { codeOf, idOf };
}

function journalStatements(db: D1DB, tenant: string, j: Journal, legacy: string, periodId: string, idOf: Record<string, string>, actor: string, rule: { id: string; version: number }, link: { event_id: string; kind: 'primary' | 'auto_reverse'; reversal_of?: string; reason?: string }) {
  const jid = crypto.randomUUID();
  const memo = (j.memo.length >= 12 ? j.memo : j.memo + ' (auto-posted)').slice(0, 500);
  const st: D1Prepared[] = [db.prepare('INSERT INTO india_gl_journals(id,tenant_id,legal_entity_id,period_id,source_type,source_key,memo,created_by) VALUES(?,?,?,?,?,?,?,?)')
    .bind(jid, tenant, legacy, periodId, 'accounting_event', j.idempotency_key, memo, actor)];
  for (const l of j.lines) {
    const lid = crypto.randomUUID();
    st.push(db.prepare('INSERT INTO india_gl_lines(id,tenant_id,journal_id,account_id,debit_cents,credit_cents,description) VALUES(?,?,?,?,?,?,?)').bind(lid, tenant, jid, idOf[l.account_code], l.debit, l.credit, l.account_role));
    st.push(db.prepare('INSERT INTO india_gl_line_dimensions(tenant_id,line_id,account_role,dimensions_json) VALUES(?,?,?,?)').bind(tenant, lid, l.account_role, JSON.stringify(l.dimensions)));
  }
  const reviewer = `rule:${rule.id}@v${rule.version}`;
  st.push(db.prepare("UPDATE india_gl_journals SET status='approved',version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?")
    .bind(reviewer, `Auto-approved under maker-checker approved posting rule ${rule.id} v${rule.version}`, tenant, jid));
  st.push(db.prepare("UPDATE india_gl_journals SET status='posted',version=version+1,posted_by=?,posted_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(actor, tenant, jid));
  st.push(db.prepare('INSERT INTO india_gl_journal_links(tenant_id,journal_id,event_id,kind,rule_id,rule_version,reversal_of_id,reason) VALUES(?,?,?,?,?,?,?,?)')
    .bind(tenant, jid, link.event_id, link.kind, rule.id, rule.version, link.reversal_of ?? null, link.reason ?? null));
  return { jid, st };
}

export async function runPostingBatch(db: D1DB, tenant: string, opts: { actor?: string; trigger: 'manual' | 'schedule' | 'test'; limit?: number; legalEntityId?: string }): Promise<WorkerResult> {
  const actor = opts.actor || DEFAULT_PARAMETERS.posting.system_actor;
  const maxAttempts = await readParameter<number>(db, tenant, 'posting.max_attempts', DEFAULT_PARAMETERS.posting.max_attempts);
  const limit = Math.min(opts.limit ?? await readParameter<number>(db, tenant, 'posting.worker_batch_size', DEFAULT_PARAMETERS.posting.worker_batch_size), 200);
  const runId = crypto.randomUUID();
  await db.prepare('INSERT INTO india_posting_worker_runs(tenant_id,id,trigger,actor) VALUES(?,?,?,?)').bind(tenant, runId, opts.trigger, actor).run();
  const events = await db.prepare(`SELECT id,event_type,legal_entity_id,period,occurred_on,currency,amounts_json,dimensions_json,source_type,source_id,idempotency_key,attempts
    FROM india_accounting_events WHERE tenant_id=? AND status='pending' AND attempts<?${opts.legalEntityId ? ' AND legal_entity_id=?' : ''} ORDER BY created_at,id LIMIT ?`)
    .bind(...[tenant, maxAttempts, ...(opts.legalEntityId ? [opts.legalEntityId] : []), limit]).all<EventRow>();
  const rules = (await db.prepare("SELECT rule_json FROM india_posting_rules WHERE status='approved'").all<{ rule_json: string }>()).results.map(r => JSON.parse(r.rule_json) as PostingRule);
  const roles = (await db.prepare('SELECT role,default_code code,name,category,required_dims_json FROM india_account_roles').all<{ role: string; code: string; name: string; category: AccountRole['category']; required_dims_json: string }>())
    .results.map(r => ({ role: r.role, code: r.code, name: r.name, category: r.category, required_dims: JSON.parse(r.required_dims_json) as string[] }));
  const out: WorkerResult = { run_id: runId, picked: events.results.length, posted: 0, exceptions: [], journals: [] };
  for (const e of events.results) {
    try {
      const legacy = await legacyEntity(db, tenant, e.legal_entity_id);
      const per = await periodState(db, tenant, e.legal_entity_id, legacy, e.period);
      const { codeOf, idOf } = await roleMap(db, tenant, e.legal_entity_id, legacy, e.occurred_on, roles);
      const ev: AccountingEvent = { id: e.id, event_type: e.event_type, legal_entity_id: e.legal_entity_id, period: e.period, occurred_on: e.occurred_on, currency: e.currency, amounts: JSON.parse(e.amounts_json), dimensions: JSON.parse(e.dimensions_json), idempotency_key: e.idempotency_key, source_type: e.source_type, source_id: e.source_id };
      const stmts: D1Prepared[] = [];
      if (e.event_type === 'AUTO_REVERSAL') {
        if (per.state !== 'open') throw new PostingError(per.state ? 'PERIOD_CLOSED' : 'PERIOD_NOT_DEFINED', e.period);
        const origId = ev.dimensions.reversal_of_journal;
        const orig = await db.prepare("SELECT l.account_id,l.debit_cents,l.credit_cents,l.description,d.dimensions_json FROM india_gl_lines l LEFT JOIN india_gl_line_dimensions d ON d.tenant_id=l.tenant_id AND d.line_id=l.id WHERE l.tenant_id=? AND l.journal_id=?").bind(tenant, origId).all<{ account_id: string; debit_cents: number; credit_cents: number; description: string; dimensions_json: string | null }>();
        if (!orig.results.length) throw new PostingError('REVERSAL_SOURCE_MISSING', origId);
        const codeById = Object.fromEntries(Object.entries(idOf).map(([c, id]) => [id, c]));
        const lines: JournalLine[] = orig.results.map(l => ({ account_code: codeById[l.account_id], account_role: l.description, debit: l.credit_cents, credit: l.debit_cents, currency: e.currency, dimensions: l.dimensions_json ? JSON.parse(l.dimensions_json) : {} }));
        const link = await db.prepare('SELECT rule_id,rule_version FROM india_gl_journal_links WHERE tenant_id=? AND journal_id=?').bind(tenant, origId).first<{ rule_id: string; rule_version: number }>();
        const j: Journal = { id: e.id, legal_entity_id: e.legal_entity_id, period: e.period, event_id: e.id, idempotency_key: e.idempotency_key, rule_id: link?.rule_id || 'AUTO_REVERSAL', rule_version: link?.rule_version || 1, source_type: e.source_type, source_id: e.source_id, memo: 'AUTO-REVERSAL of journal ' + origId, lines };
        const w = journalStatements(db, tenant, j, legacy, per.period_id!, idOf, actor, { id: j.rule_id, version: j.rule_version }, { event_id: e.id, kind: 'auto_reverse', reversal_of: origId, reason: 'Auto-reversal accrual pada periode berikutnya' });
        stmts.push(...w.st); out.journals.push(w.jid);
        stmts.push(db.prepare("UPDATE india_accounting_events SET status='posted',journal_id=?,posted_at=CURRENT_TIMESTAMP,attempts=attempts+1,error_code=NULL WHERE tenant_id=? AND id=? AND status='pending'").bind(w.jid, tenant, e.id));
      } else {
        const periods: Record<string, PeriodState> = per.state ? { [`${e.legal_entity_id}:${e.period}`]: per.state } : {};
        const journals = postEvent(ev, { rules, roleMap: { [e.legal_entity_id]: codeOf }, accounts: roles, periods, postedKeys: new Set() });
        const primary = journals[0];
        const rule = rules.find(r => r.id === primary.rule_id && r.version === primary.rule_version)!;
        const w = journalStatements(db, tenant, primary, legacy, per.period_id!, idOf, actor, { id: rule.id, version: rule.version }, { event_id: e.id, kind: 'primary' });
        stmts.push(...w.st); out.journals.push(w.jid);
        if (rule.auto_reverse) {
          const np = nextPeriod(e.period);
          stmts.push(db.prepare('INSERT INTO india_accounting_events(tenant_id,id,event_type,legal_entity_id,period,occurred_on,currency,amounts_json,dimensions_json,source_type,source_id,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(tenant, e.id + '-REV', 'AUTO_REVERSAL', e.legal_entity_id, np, np + '-01', e.currency, e.amounts_json, JSON.stringify({ ...ev.dimensions, reversal_of_journal: w.jid }), e.source_type, e.source_id, e.idempotency_key + ':REV'));
        }
        stmts.push(db.prepare("UPDATE india_accounting_events SET status='posted',journal_id=?,posted_at=CURRENT_TIMESTAMP,attempts=attempts+1,error_code=NULL WHERE tenant_id=? AND id=? AND status='pending'").bind(w.jid, tenant, e.id));
      }
      await db.batch(stmts);
      out.posted++;
    } catch (err) {
      const code = err instanceof PostingError ? err.code : /UNIQUE/i.test(String(err)) ? 'DUPLICATE_EVENT' : /GL_PERIOD_CLOSED/.test(String(err)) ? 'PERIOD_CLOSED' : /GL_UNBALANCED/.test(String(err)) ? 'UNBALANCED' : 'POSTING_FAILED';
      out.exceptions.push({ event_id: e.id, code });
      await db.prepare("UPDATE india_accounting_events SET status='exception',error_code=?,attempts=attempts+1 WHERE tenant_id=? AND id=? AND status='pending'").bind(code + (err instanceof PostingError ? '' : ':' + String(err).slice(0, 160)), tenant, e.id).run();
    }
  }
  await db.prepare('UPDATE india_posting_worker_runs SET finished_at=CURRENT_TIMESTAMP,picked=?,posted=?,exceptions=? WHERE tenant_id=? AND id=?').bind(out.picked, out.posted, out.exceptions.length, tenant, runId).run();
  return out;
}

/** Return an exception to the queue after the cause (mapping, period, account) has been fixed. */
export async function requeueEvent(db: D1DB, tenant: string, id: string) {
  const r = await db.prepare("UPDATE india_accounting_events SET status='pending',error_code=NULL WHERE tenant_id=? AND id=? AND status='exception'").bind(tenant, id).run() as { meta?: { changes?: number } };
  return (r.meta?.changes ?? 0) > 0;
}
