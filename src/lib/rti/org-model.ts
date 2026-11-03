// Organization-as-Data (WP01, prompt §2). Pure functions; persistence is in migration 0040 tables
// india_org_units_v (versioned), india_org_closure, india_org_positions, india_org_assignments, india_org_change_requests.
import type { OrgUnitType, OrgUnitTypeCode } from './seed';

export type OrgUnit = {
  id: string; code: string; name: string; type: OrgUnitTypeCode; parent_id: string | null;
  legal_entity_id: string | null; cost_center_code: string | null; profit_center: boolean;
  valid_from: string; valid_to: string | null; version: number; status: 'active' | 'closed';
};
export type Closure = { ancestor: string; descendant: string; depth: number };
export type Position = { id: string; org_unit_id: string; title: string; reports_to_position_id: string | null; is_head: boolean };
export type Assignment = { position_id: string; email: string; valid_from: string; valid_to: string | null; kind: 'DEFINITIVE' | 'ACTING' | 'PLT' | 'CONCURRENT' };

export class OrgError extends Error {}

export function activeOn(units: OrgUnit[], date: string): OrgUnit[] {
  return units.filter(u => u.status === 'active' && u.valid_from <= date && (!u.valid_to || u.valid_to > date));
}

export function validateHierarchy(units: OrgUnit[], types: OrgUnitType[]): void {
  const byId = new Map(units.map(u => [u.id, u]));
  const typeMap = new Map(types.map(t => [t.code, t]));
  const codes = new Set<string>();
  for (const u of units) {
    if (codes.has(u.code)) throw new OrgError('ORG_CODE_DUPLICATE:' + u.code);
    codes.add(u.code);
    const t = typeMap.get(u.type);
    if (!t) throw new OrgError('ORG_TYPE_UNKNOWN:' + u.type);
    if (u.profit_center && !t.can_be_profit_center) throw new OrgError('ORG_PROFIT_CENTER_NOT_ALLOWED:' + u.code);
    if (u.parent_id === null) { if (t.allowed_parent_types.length) throw new OrgError('ORG_PARENT_REQUIRED:' + u.code); continue; }
    const p = byId.get(u.parent_id);
    if (!p) throw new OrgError('ORG_PARENT_MISSING:' + u.code);
    if (!t.allowed_parent_types.includes(p.type)) throw new OrgError('ORG_PARENT_TYPE_INVALID:' + u.code + '<' + p.type);
  }
  // Cycle detection
  for (const u of units) {
    const seen = new Set<string>(); let cur: OrgUnit | undefined = u;
    while (cur && cur.parent_id) { if (seen.has(cur.id)) throw new OrgError('ORG_CYCLE:' + u.code); seen.add(cur.id); cur = byId.get(cur.parent_id); }
  }
}

/** Closure table: every (ancestor, descendant, depth) pair including self at depth 0. */
export function buildClosure(units: OrgUnit[]): Closure[] {
  const byId = new Map(units.map(u => [u.id, u]));
  const out: Closure[] = [];
  for (const u of units) {
    let cur: OrgUnit | undefined = u; let depth = 0;
    while (cur) { out.push({ ancestor: cur.id, descendant: u.id, depth }); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; depth++; if (depth > 64) throw new OrgError('ORG_DEPTH'); }
  }
  return out;
}

export function descendants(closure: Closure[], id: string): string[] { return closure.filter(c => c.ancestor === id).map(c => c.descendant); }
export function ancestors(closure: Closure[], id: string): string[] { return closure.filter(c => c.descendant === id).sort((a, b) => a.depth - b.depth).map(c => c.ancestor); }

/** §2.3 derived objects. */
export function costCenterOf(units: OrgUnit[], id: string, types: OrgUnitType[]): string {
  const byId = new Map(units.map(u => [u.id, u])); const typeMap = new Map(types.map(t => [t.code, t]));
  let cur = byId.get(id);
  while (cur) {
    if (typeMap.get(cur.type)?.can_own_budget) return cur.cost_center_code || cur.code;
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  throw new OrgError('ORG_NO_COST_CENTER:' + id);
}
export function profitCenterOf(units: OrgUnit[], id: string): string {
  const byId = new Map(units.map(u => [u.id, u]));
  let cur = byId.get(id);
  while (cur) { if (cur.profit_center) return cur.code; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
  throw new OrgError('ORG_NO_PROFIT_CENTER:' + id);
}
export function legalEntityOf(units: OrgUnit[], id: string): string {
  const byId = new Map(units.map(u => [u.id, u]));
  let cur = byId.get(id);
  while (cur) { if (cur.type === 'LEGAL_ENTITY') return cur.id; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
  throw new OrgError('ORG_NO_LEGAL_ENTITY:' + id);
}

/** Approval line from the submitter's position upward, skipping vacant positions; snapshot is stored on the transaction. */
export function resolveApprovalLine(positions: Position[], assignments: Assignment[], fromPositionId: string, date: string, levels: number): { position_id: string; email: string; acting: boolean }[] {
  const byId = new Map(positions.map(p => [p.id, p]));
  const holder = (pid: string) => assignments
    .filter(a => a.position_id === pid && a.valid_from <= date && (!a.valid_to || a.valid_to > date))
    .sort((a, b) => (a.kind === 'DEFINITIVE' ? -1 : 1) - (b.kind === 'DEFINITIVE' ? -1 : 1))[0];
  const line: { position_id: string; email: string; acting: boolean }[] = [];
  let cur = byId.get(fromPositionId)?.reports_to_position_id ?? null;
  const submitter = holder(fromPositionId)?.email;
  while (cur && line.length < levels) {
    const h = holder(cur);
    if (h && h.email !== submitter) line.push({ position_id: cur, email: h.email, acting: h.kind !== 'DEFINITIVE' });
    cur = byId.get(cur)?.reports_to_position_id ?? null;
  }
  if (line.length < levels) throw new OrgError('APPROVAL_LINE_INCOMPLETE');
  return line;
}

// ---- Reorganisation (§2.4) -----------------------------------------------------------------------------------
export type OrgChange =
  | { op: 'create'; unit: Omit<OrgUnit, 'version' | 'valid_from' | 'valid_to' | 'status'> }
  | { op: 'rename'; id: string; name: string }
  | { op: 'move'; id: string; new_parent_id: string }
  | { op: 'close'; id: string }
  | { op: 'merge'; id: string; into_id: string };

export type ImpactInput = {
  units: OrgUnit[]; positions: Position[]; assignments: Assignment[];
  bindings: { id: string; org_unit_id: string }[]; openTransactions: { id: string; org_unit_id: string; type: string }[];
};
export type Impact = { affected_units: string[]; affected_users: string[]; role_bindings: string[]; open_transactions: string[]; touches_cost_or_profit_center: boolean; approvers: string[] };

export function impactAnalysis(change: OrgChange, input: ImpactInput, date: string): Impact {
  const closure = buildClosure(activeOn(input.units, date));
  const root = change.op === 'create' ? change.unit.parent_id! : change.id;
  const affected = change.op === 'create' ? [] : descendants(closure, root);
  const posIds = new Set(input.positions.filter(p => affected.includes(p.org_unit_id)).map(p => p.id));
  const users = [...new Set(input.assignments.filter(a => posIds.has(a.position_id) && (!a.valid_to || a.valid_to > date)).map(a => a.email))];
  const unit = input.units.find(u => u.id === root);
  const touches = change.op !== 'rename' && (!!unit?.profit_center || change.op === 'create' || change.op === 'merge' || change.op === 'close');
  const approvers = ['HEAD_OF_AFFECTED_UNIT', ...(touches ? ['CFO'] : []), 'CEO'];
  return {
    affected_units: affected, affected_users: users,
    role_bindings: input.bindings.filter(b => affected.includes(b.org_unit_id)).map(b => b.id),
    open_transactions: input.openTransactions.filter(t => affected.includes(t.org_unit_id)).map(t => t.id),
    touches_cost_or_profit_center: touches, approvers,
  };
}

/** Apply an approved change on its effective date: closes the old version and opens a new one; never mutates history. */
export function applyChange(units: OrgUnit[], change: OrgChange, effective: string, types: OrgUnitType[]): OrgUnit[] {
  const next = units.map(u => ({ ...u }));
  const current = (id: string) => {
    const u = next.find(x => x.id === id && x.status === 'active' && x.valid_from <= effective && (!x.valid_to || x.valid_to > effective));
    if (!u) throw new OrgError('ORG_UNIT_NOT_ACTIVE:' + id); return u;
  };
  const supersede = (u: OrgUnit, patch: Partial<OrgUnit>) => {
    u.valid_to = effective;
    const nv: OrgUnit = { ...u, ...patch, version: u.version + 1, valid_from: effective, valid_to: null };
    next.push(nv);
    return nv;
  };
  if (change.op === 'create') {
    if (next.some(u => u.code === change.unit.code && u.status === 'active' && !u.valid_to)) throw new OrgError('ORG_CODE_DUPLICATE:' + change.unit.code);
    const parent = current(change.unit.parent_id!);
    const le = parent.type === 'LEGAL_ENTITY' ? parent.id : parent.legal_entity_id;
    next.push({ ...change.unit, legal_entity_id: change.unit.legal_entity_id ?? le, version: 1, valid_from: effective, valid_to: null, status: 'active' });
  } else if (change.op === 'rename') supersede(current(change.id), { name: change.name });
  else if (change.op === 'move') {
    const target = current(change.new_parent_id);
    const closure = buildClosure(activeOn(next, effective));
    if (descendants(closure, change.id).includes(target.id)) throw new OrgError('ORG_CYCLE');
    supersede(current(change.id), { parent_id: target.id, legal_entity_id: target.type === 'LEGAL_ENTITY' ? target.id : target.legal_entity_id });
  } else if (change.op === 'close' || change.op === 'merge') {
    const u = current(change.id);
    const closure = buildClosure(activeOn(next, effective));
    const kids = descendants(closure, u.id).filter(d => d !== u.id);
    if (change.op === 'close' && kids.length) throw new OrgError('ORG_CLOSE_HAS_CHILDREN');
    if (change.op === 'merge') {
      const into = current(change.into_id);
      for (const k of next.filter(x => x.parent_id === u.id && !x.valid_to && x.status === 'active')) supersede(k, { parent_id: into.id });
    }
    u.valid_to = effective;
  }
  validateHierarchy(activeOn(next, effective), types);
  return next;
}

/** "as-was" lookup: the unit version that was valid when a transaction was created. */
export function unitAsOf(units: OrgUnit[], id: string, date: string): OrgUnit | undefined {
  return units.find(u => u.id === id && u.valid_from <= date && (!u.valid_to || u.valid_to > date));
}

export function seedUnits(seed: { code: string; type: OrgUnitTypeCode; parent: string | null; name: string; profit_center?: boolean }[], validFrom: string): OrgUnit[] {
  const units: OrgUnit[] = seed.map(s => ({ id: s.code, code: s.code, name: s.name, type: s.type, parent_id: s.parent, legal_entity_id: null, cost_center_code: s.code, profit_center: !!s.profit_center, valid_from: validFrom, valid_to: null, version: 1, status: 'active' }));
  for (const u of units) { try { u.legal_entity_id = u.type === 'LEGAL_ENTITY' ? u.id : legalEntityOf(units, u.id); } catch { u.legal_entity_id = null; } }
  return units;
}
