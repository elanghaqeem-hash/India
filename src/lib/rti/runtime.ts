// D1 runtime adapter for the v3 policy engine (WP01 wiring). Loads the policy context and the caller's role bindings
// from D1, resolves legacy ERP units to the v3 organization model and records every decision in india_policy_decisions.
// Mode is the parameter security.policy_enforcement: 'shadow' logs only, 'enforce' blocks (legacy grants still apply).
import type { D1DB } from '../boq-auth';
import { DEFAULT_PARAMETERS } from './parameters';
import { authorize, DEFAULT_ABAC, type AbacRule, type Binding, type Decision, type PolicyContext, type Resource, type Subject } from './policy-engine';
import { ROLE_TEMPLATES, SOD_RULES, type RoleTemplate, type SodRule } from './seed';
import type { Closure } from './org-model';

export type PolicyMode = 'shadow' | 'enforce';
export class PolicyDenied extends Error { constructor(public decision: Decision) { super('POLICY_DENIED:' + decision.reason); } }

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

async function tableExists(db: D1DB, name: string) {
  return !!(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first());
}

export async function readParameter<T>(db: D1DB, tenant: string, key: string, fallback: T, onDate = today()): Promise<T> {
  try {
    const row = await db.prepare("SELECT value_json FROM india_sys_parameters WHERE tenant_id=? AND key=? AND status='approved' AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) ORDER BY effective_from DESC,version DESC LIMIT 1")
      .bind(tenant, key, onDate, onDate).first<{ value_json: string }>();
    return row ? (JSON.parse(row.value_json) as T) : fallback;
  } catch { return fallback; }
}

export async function loadPolicyContext(db: D1DB, tenant: string): Promise<PolicyContext> {
  const [tpl, clo, sod, abac] = await Promise.all([
    db.prepare("SELECT t.code,t.group_name,t.scope,t.mfa,t.pam,t.permissions_json FROM india_iam_role_templates t WHERE t.status='approved' AND t.version=(SELECT max(version) FROM india_iam_role_templates x WHERE x.code=t.code AND x.status='approved')").all<{ code: string; group_name: string; scope: RoleTemplate['scope']; mfa: number; pam: number; permissions_json: string }>(),
    db.prepare('SELECT ancestor,descendant,depth FROM india_org_closure WHERE tenant_id=?').bind(tenant).all<Closure>(),
    db.prepare('SELECT id,conflict_a a,conflict_b b,severity,same_object,description FROM india_iam_sod_rules').all<{ id: string; a: string; b: string; severity: SodRule['severity']; same_object: number; description: string }>(),
    db.prepare("SELECT policy_json FROM india_iam_abac_policies p WHERE status='approved' AND version=(SELECT max(version) FROM india_iam_abac_policies x WHERE x.id=p.id AND x.status='approved')").all<{ policy_json: string }>(),
  ]);
  const limits = await readParameter<Record<string, number>>(db, tenant, 'approval_limits', DEFAULT_PARAMETERS.approval_limits as unknown as Record<string, number>);
  return {
    templates: tpl.results.length ? tpl.results.map(t => ({ code: t.code, group: t.group_name, scope: t.scope, mfa: !!t.mfa, pam: !!t.pam, permissions: JSON.parse(t.permissions_json) })) : ROLE_TEMPLATES,
    closure: clo.results,
    sod: sod.results.length ? sod.results.map(r => ({ id: r.id, a: r.a, b: r.b, severity: r.severity, same_object: !!r.same_object, description: r.description })) : SOD_RULES,
    abac: abac.results.length ? abac.results.map(r => JSON.parse(r.policy_json) as AbacRule) : DEFAULT_ABAC,
    limits, today: today(), mfaRequiredGroups: ['Executive', 'Corporate', 'Admin'],
  };
}

export async function resolveLegacyUnit(db: D1DB, tenant: string, legacyUnitId: string | null | undefined) {
  if (!legacyUnitId) return null;
  return db.prepare("SELECT org_unit_id,legal_entity_id FROM india_org_unit_legacy_map WHERE tenant_id=? AND legacy_unit_id=? AND status='approved'")
    .bind(tenant, legacyUnitId).first<{ org_unit_id: string; legal_entity_id: string }>();
}

/** Approved bindings for the user directly, through currently held positions, and (optionally) the legacy role map. */
export async function loadBindings(db: D1DB, tenant: string, email: string, legacyRole: string, legacyFallback: boolean): Promise<Binding[]> {
  const d = today();
  const direct = await db.prepare(`SELECT b.id,b.template_code template,b.org_unit_id,b.legal_entity_id,b.valid_from,b.valid_to,b.status FROM india_iam_role_bindings b
    WHERE b.tenant_id=? AND b.status='approved' AND b.valid_from<=? AND (b.valid_to IS NULL OR b.valid_to>?)
    AND ((b.subject_kind='user' AND lower(b.subject_ref)=lower(?)) OR (b.subject_kind='position' AND b.subject_ref IN (
      SELECT a.position_id FROM india_org_assignments a WHERE a.tenant_id=b.tenant_id AND lower(a.email)=lower(?) AND a.status='approved' AND a.valid_from<=? AND (a.valid_to IS NULL OR a.valid_to>?))))`)
    .bind(tenant, d, d, email, email, d, d).all<Binding>();
  if (direct.results.length || !legacyFallback) return direct.results;
  // Legacy fallback: template from the login role, scoped to the approved staff unit mapped into the v3 model.
  const rows = await db.prepare(`SELECT r.template_code template,m.org_unit_id,m.legal_entity_id FROM india_iam_legacy_role_map r
    JOIN india_erp_staff_org s ON s.tenant_id=? AND lower(s.email)=lower(?) AND s.status='approved'
    JOIN india_org_unit_legacy_map m ON m.tenant_id=s.tenant_id AND m.legacy_unit_id=s.unit_id AND m.status='approved'
    WHERE r.legacy_role=?`).bind(tenant, email, legacyRole).all<{ template: string; org_unit_id: string; legal_entity_id: string }>();
  return rows.results.map(r => ({ id: 'legacy:' + legacyRole + ':' + r.template + '@' + r.org_unit_id, template: r.template, org_unit_id: r.org_unit_id, legal_entity_id: r.legal_entity_id, valid_from: d, valid_to: null, status: 'approved' as const }));
}

export type PolicyRequest = { permission: string; legacyUnitId?: string | null; resource?: Partial<Resource> };

/**
 * Evaluate a v3 permission for the current identity. In shadow mode the decision is logged and never blocks; in
 * enforce mode a deny throws PolicyDenied. If the v3 schema is not present (older databases) the check is skipped
 * and recorded as such by the caller's legacy controls.
 */
export async function policyCheck(db: D1DB, tenant: string, identity: { email: string; role: string }, req: PolicyRequest): Promise<Decision & { mode: PolicyMode }> {
  if (!(await tableExists(db, 'india_policy_decisions'))) return { allow: true, masked: false, reason: 'V3_SCHEMA_ABSENT', mode: 'shadow' };
  const mode = await readParameter<PolicyMode>(db, tenant, 'security.policy_enforcement', DEFAULT_PARAMETERS.security.policy_enforcement as PolicyMode);
  const fallback = await readParameter<boolean>(db, tenant, 'security.legacy_role_fallback', DEFAULT_PARAMETERS.security.legacy_role_fallback);
  const mfa = await readParameter<boolean>(db, tenant, 'security.mfa_enforced_at_edge', DEFAULT_PARAMETERS.security.mfa_enforced_at_edge);
  const [module, resource, action] = req.permission.split('.');
  const unit = await resolveLegacyUnit(db, tenant, req.legacyUnitId);
  const ctx = await loadPolicyContext(db, tenant);
  const subject: Subject = { email: identity.email, mfa, environment: 'PROD', bindings: await loadBindings(db, tenant, identity.email, identity.role, fallback) };
  const res: Resource = { module, resource, ...(unit ? { org_unit_id: unit.org_unit_id, legal_entity_id: unit.legal_entity_id } : {}), ...req.resource };
  let decision: Decision = req.legacyUnitId && !unit
    ? { allow: false, masked: false, reason: 'LEGACY_UNIT_UNMAPPED' }
    : authorize(subject, action, res, ctx);
  await db.prepare('INSERT INTO india_policy_decisions(tenant_id,id,email,permission,resource_json,mode,allow,reason,binding_id,sod_rule) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(tenant, crypto.randomUUID(), identity.email, req.permission, JSON.stringify({ legacy_unit: req.legacyUnitId ?? null, ...res }), mode, decision.allow ? 1 : 0, decision.reason, decision.binding ?? null, decision.sod ?? null).run();
  if (mode === 'enforce' && !decision.allow) throw new PolicyDenied(decision);
  return { ...decision, mode };
}
