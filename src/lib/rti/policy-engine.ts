// Central RBAC + ABAC + SoD policy engine (WP01, prompt §3, §10.1). Pure decision function; route handlers must call
// authorize() and the data layer must apply scopeFilter(). UI visibility only mirrors these decisions.
import type { Closure } from './org-model';
import type { RoleTemplate, SodRule } from './seed';

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'submit', 'approve', 'reject', 'post', 'reverse', 'close', 'reopen', 'export', 'import', 'assign', 'configure', 'impersonate', 'deploy'] as const;
export type Action = typeof ACTIONS[number];
export type Permission = { module: string; resource: string; action: string; qualifier: string | null };

export class PolicyError extends Error {}

export function parsePermission(s: string): Permission {
  const m = /^([a-z*][a-z0-9_]*|\*)\.([a-z*][a-z0-9_]*|\*)\.([a-z*][a-z0-9_]*|\*)(?::([a-z_]+(?::[A-Z0-9_]+)?))?$/.exec(s);
  if (!m) throw new PolicyError('PERMISSION_GRAMMAR:' + s);
  if (m[3] !== '*' && !(ACTIONS as readonly string[]).includes(m[3])) throw new PolicyError('PERMISSION_ACTION_UNKNOWN:' + s);
  const q = m[4] ?? null;
  if (q && !/^(own|project|unit|unit_tree|entity|all|masked|limit:[A-Z0-9_]+)$/.test(q)) throw new PolicyError('PERMISSION_QUALIFIER_UNKNOWN:' + s);
  return { module: m[1], resource: m[2], action: m[3], qualifier: q };
}
const key = (p: Permission) => `${p.module}.${p.resource}.${p.action}`;
const matches = (granted: Permission, want: { module: string; resource: string; action: string }) =>
  (granted.module === '*' || granted.module === want.module) && (granted.resource === '*' || granted.resource === want.resource) && (granted.action === '*' || granted.action === want.action);

export type Binding = { id: string; template: string; org_unit_id: string; legal_entity_id: string; valid_from: string; valid_to: string | null; status: 'approved' | 'pending' | 'revoked' };
export type Subject = { email: string; mfa: boolean; bindings: Binding[]; environment: string; breakGlass?: boolean };
export type Resource = {
  module: string; resource: string; id?: string; org_unit_id?: string; legal_entity_id?: string; owner?: string;
  project_members?: string[]; classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'; status?: string;
  amount_cents?: number; maker?: string; touched_by?: { email: string; permission: string }[];
};
export type AbacRule = { id: string; effect: 'deny'; when: Cond[]; unless?: Cond[]; message: string };
export type Cond = { attr: string; op: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'exists' | 'subject_in'; value?: unknown };

export type PolicyContext = { templates: RoleTemplate[]; closure: Closure[]; abac: AbacRule[]; sod: SodRule[]; limits: Record<string, number>; today: string; mfaRequiredGroups: string[] };
export type Decision = { allow: boolean; masked: boolean; reason: string; binding?: string; sod?: string };

function attr(path: string, s: Subject, r: Resource, action: string): unknown {
  const [root, ...rest] = path.split('.');
  let v: unknown = root === 'subject' ? s : root === 'resource' ? r : root === 'action' ? action : undefined;
  for (const k of rest) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
  return v;
}
function test(c: Cond, s: Subject, r: Resource, action: string): boolean {
  const v = attr(c.attr, s, r, action);
  switch (c.op) {
    case 'eq': return v === c.value; case 'ne': return v !== c.value;
    case 'in': return Array.isArray(c.value) && c.value.includes(v); case 'nin': return Array.isArray(c.value) && !c.value.includes(v);
    case 'gt': return typeof v === 'number' && v > Number(c.value); case 'lt': return typeof v === 'number' && v < Number(c.value);
    case 'exists': return v !== undefined && v !== null;
    case 'subject_in': return Array.isArray(v) && v.includes(s.email);
  }
}

/** Default declarative ABAC rules (§3.2). Stored in india_abac_policies and editable with approval. */
export const DEFAULT_ABAC: AbacRule[] = [
  { id: 'ABAC-POSTED-IMMUTABLE', effect: 'deny', when: [{ attr: 'resource.status', op: 'in', value: ['POSTED', 'posted', 'HARD_CLOSED'] }, { attr: 'action', op: 'in', value: ['edit', 'delete'] }], message: 'Dokumen POSTED tidak dapat diubah; gunakan reversal' },
  { id: 'ABAC-RESTRICTED-MEMBERS', effect: 'deny', when: [{ attr: 'resource.classification', op: 'eq', value: 'RESTRICTED' }], unless: [{ attr: 'resource.project_members', op: 'subject_in' }], message: 'Data RESTRICTED hanya untuk member engagement' },
  { id: 'ABAC-PROD-NO-IMPERSONATE', effect: 'deny', when: [{ attr: 'subject.environment', op: 'eq', value: 'PROD' }, { attr: 'action', op: 'eq', value: 'impersonate' }], message: 'Impersonation dilarang di PROD' },
];

function inScope(scope: string, b: Binding, s: Subject, r: Resource, closure: Closure[]): boolean {
  switch (scope) {
    case 'all': return true;
    case 'entity': return !!r.legal_entity_id && r.legal_entity_id === b.legal_entity_id;
    case 'unit': return !!r.org_unit_id && r.org_unit_id === b.org_unit_id;
    case 'unit_tree': return !!r.org_unit_id && closure.some(c => c.ancestor === b.org_unit_id && c.descendant === r.org_unit_id);
    case 'own': return !!r.owner && r.owner.toLowerCase() === s.email.toLowerCase();
    case 'project': return !!r.project_members?.includes(s.email);
    default: return false;
  }
}

export function authorize(s: Subject, action: string, r: Resource, ctx: PolicyContext): Decision {
  const want = { module: r.module, resource: r.resource, action };
  const active = s.bindings.filter(b => b.status === 'approved' && b.valid_from <= ctx.today && (!b.valid_to || b.valid_to > ctx.today));
  let granted: { b: Binding; p: Permission; t: RoleTemplate } | null = null;
  let masked = false;
  for (const b of active) {
    const t = ctx.templates.find(x => x.code === b.template);
    if (!t) continue;
    if ((t.mfa || ctx.mfaRequiredGroups.includes(t.group)) && !s.mfa) continue;
    for (const ps of t.permissions) {
      const p = parsePermission(ps);
      if (!matches(p, want)) continue;
      const q = p.qualifier;
      if (q === 'masked') { if (inScope(t.scope, b, s, r, ctx.closure)) { masked = true; granted ??= { b, p, t }; } continue; }
      if (q?.startsWith('limit:')) {
        const lim = ctx.limits[q.slice(6)];
        if (lim === undefined) continue; // fail closed when the parameter is missing
        if (r.amount_cents === undefined || r.amount_cents > lim) continue;
        if (!inScope(t.scope === 'all' ? 'all' : 'entity', b, s, r, ctx.closure)) continue;
        granted = { b, p, t }; masked = false; break;
      }
      const scope = q && q !== 'masked' ? q : t.scope;
      if (inScope(scope, b, s, r, ctx.closure)) { granted = { b, p, t }; masked = false; break; }
    }
    if (granted && !masked) break;
  }
  if (!granted) return { allow: false, masked: false, reason: 'NO_PERMISSION_IN_SCOPE' };
  for (const rule of ctx.abac) {
    if (rule.when.every(c => test(c, s, r, action)) && !(rule.unless?.every(c => test(c, s, r, action))))
      return { allow: false, masked: false, reason: rule.id, binding: granted.b.id };
  }
  // Transaction-level SoD: the approver cannot be the maker, nor someone who performed the conflicting step on the same object.
  if (['approve', 'post', 'reverse', 'close'].includes(action) && r.maker && r.maker.toLowerCase() === s.email.toLowerCase())
    return { allow: false, masked: false, reason: 'SOD_MAKER_CHECKER', binding: granted.b.id };
  const thisPerm = key({ ...want, qualifier: null });
  for (const rule of ctx.sod.filter(x => x.same_object)) {
    const other = rule.a === thisPerm ? rule.b : rule.b === thisPerm ? rule.a : null;
    if (other && r.touched_by?.some(t => t.email.toLowerCase() === s.email.toLowerCase() && t.permission === other))
      return { allow: false, masked: false, reason: 'SOD_SAME_OBJECT', sod: rule.id, binding: granted.b.id };
  }
  return { allow: true, masked, reason: masked ? 'ALLOW_MASKED' : 'ALLOW', binding: granted.b.id };
}

/** Permissions effectively held by a set of templates (wildcards expanded only against the given catalog). */
export function permissionSet(templates: RoleTemplate[], codes: string[]): Set<string> {
  const out = new Set<string>();
  for (const c of codes) for (const ps of templates.find(t => t.code === c)?.permissions || []) { const p = parsePermission(ps); out.add(key(p)); }
  return out;
}

export type SodConflict = { rule: string; severity: string; a: string; b: string };
/** Binding-time SoD (§3.4 checkpoint 1). Returns conflicts; Critical/High must be denied or mitigated with CISO approval. */
export function bindingConflicts(templates: RoleTemplate[], heldTemplates: string[], newTemplate: string, sod: SodRule[]): SodConflict[] {
  const held = permissionSet(templates, heldTemplates), add = permissionSet(templates, [newTemplate]);
  const all = new Set([...held, ...add]);
  const has = (set: Set<string>, perm: string) => set.has(perm) || [...set].some(x => { const [m, r, a] = x.split('.'); const [pm, pr, pa] = perm.split('.'); return (m === '*' || m === pm) && (r === '*' || r === pr) && (a === '*' || a === pa); });
  const out: SodConflict[] = [];
  for (const rule of sod) {
    if (rule.b === '*held_role*') continue;
    if (rule.same_object) continue; // enforced per transaction
    if ((has(add, rule.a) || has(add, rule.b)) && has(all, rule.a) && has(all, rule.b)) out.push({ rule: rule.id, severity: rule.severity, a: rule.a, b: rule.b });
  }
  return out;
}

/** SOD-06: a grantor may not grant a role they themselves hold, nor grant to themselves. */
export function grantAllowed(grantor: { email: string; heldTemplates: string[] }, grantee: string, template: string): { allow: boolean; reason: string } {
  if (grantor.email.toLowerCase() === grantee.toLowerCase()) return { allow: false, reason: 'SOD-06_SELF_GRANT' };
  if (grantor.heldTemplates.includes(template)) return { allow: false, reason: 'SOD-06_GRANTOR_HOLDS_ROLE' };
  return { allow: true, reason: 'OK' };
}

/** Data-layer scope (§10.1 point 4): returns the org unit ids a subject may read for a permission. null = all. */
export function scopeFilter(s: Subject, perm: { module: string; resource: string; action: string }, ctx: PolicyContext): { all: boolean; units: string[]; entities: string[]; ownOnly: boolean } {
  const units = new Set<string>(), entities = new Set<string>(); let all = false, own = false;
  for (const b of s.bindings.filter(b => b.status === 'approved' && b.valid_from <= ctx.today && (!b.valid_to || b.valid_to > ctx.today))) {
    const t = ctx.templates.find(x => x.code === b.template); if (!t) continue;
    if ((t.mfa || ctx.mfaRequiredGroups.includes(t.group)) && !s.mfa) continue;
    for (const ps of t.permissions) {
      const p = parsePermission(ps); if (!matches(p, perm)) continue;
      const scope = p.qualifier && !p.qualifier.startsWith('limit:') && p.qualifier !== 'masked' ? p.qualifier : t.scope;
      if (scope === 'all') all = true;
      else if (scope === 'entity') entities.add(b.legal_entity_id);
      else if (scope === 'unit') units.add(b.org_unit_id);
      else if (scope === 'unit_tree') ctx.closure.filter(c => c.ancestor === b.org_unit_id).forEach(c => units.add(c.descendant));
      else own = true;
    }
  }
  return { all, units: [...units], entities: [...entities], ownOnly: !all && !units.size && !entities.size && own };
}

export function maskValue(v: string | null | undefined, keep = 4): string {
  if (!v) return '';
  return v.length <= keep ? '*'.repeat(v.length) : '*'.repeat(v.length - keep) + v.slice(-keep);
}
