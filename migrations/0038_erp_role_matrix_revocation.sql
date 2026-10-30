-- 0038 WP2: tenant scoped role matrix, append-only entitlement change requests and revocation.
-- Existing eight login roles remain canonical; no real identities seeded.
CREATE TABLE india_erp_role_capability_matrix (
 role TEXT NOT NULL, capability TEXT NOT NULL,
 allowed INTEGER NOT NULL CHECK(allowed IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(role,capability),
 CHECK(role IN ('admin','marketing','sales','presales','finance','approver','legal','viewer')),
 CHECK(capability IN ('finance_gl','finance_ap','procurement','cyber_ops','resource','hr','audit'))
);
INSERT INTO india_erp_role_capability_matrix(role,capability,allowed) VALUES
 ('finance','finance_gl',1),('finance','finance_ap',1),
 ('approver','finance_gl',1),('approver','finance_ap',1),
 ('approver','procurement',1),('approver','cyber_ops',1),
 ('presales','procurement',1),('presales','cyber_ops',1),
 ('admin','procurement',1),('admin','cyber_ops',1),
 ('admin','resource',1),('admin','hr',1),
 ('approver','hr',1),('admin','audit',1),('approver','audit',1);
CREATE TRIGGER india_erp_role_matrix_no_delete BEFORE DELETE ON india_erp_role_capability_matrix
BEGIN SELECT RAISE(ABORT,'ROLE_POLICY_VERSIONED_CHANGE_REQUIRED'); END;
CREATE TRIGGER india_erp_role_matrix_no_update BEFORE UPDATE ON india_erp_role_capability_matrix
BEGIN SELECT RAISE(ABORT,'ROLE_POLICY_VERSIONED_CHANGE_REQUIRED'); END;
CREATE TABLE india_erp_access_change_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,grant_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action='revoke'),reason TEXT NOT NULL CHECK(length(reason) BETWEEN 12 AND 800),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 review_notes TEXT,requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,grant_id,action),
 FOREIGN KEY(tenant_id,grant_id) REFERENCES india_erp_capability_grants(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by)),
 CHECK(status='pending' OR (reviewed_by IS NOT NULL AND coalesce(length(review_notes),0)>=12))
);
CREATE TRIGGER india_erp_access_change_guard BEFORE INSERT ON india_erp_access_change_requests
WHEN NOT EXISTS(SELECT 1 FROM india_erp_capability_grants g WHERE g.id=NEW.grant_id AND g.tenant_id=NEW.tenant_id AND g.status='approved')
BEGIN SELECT RAISE(ABORT,'ERP_GRANT_NOT_ACTIVE'); END;
CREATE TRIGGER india_erp_access_change_review BEFORE UPDATE ON india_erp_access_change_requests
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.grant_id IS NOT OLD.grant_id
 OR NEW.action IS NOT OLD.action OR NEW.reason IS NOT OLD.reason OR NEW.requested_by IS NOT OLD.requested_by
 OR lower(NEW.reviewed_by)=lower(OLD.requested_by)
BEGIN SELECT RAISE(ABORT,'ERP_ACCESS_CHANGE_IMMUTABLE'); END;
CREATE TRIGGER india_erp_access_change_immut_del BEFORE DELETE ON india_erp_access_change_requests
BEGIN SELECT RAISE(ABORT,'ERP_ACCESS_CHANGE_IMMUTABLE'); END;
DROP TRIGGER india_erp_grants_review;
CREATE TRIGGER india_erp_grants_review BEFORE UPDATE ON india_erp_capability_grants
BEGIN
 SELECT CASE WHEN NEW.version!=OLD.version+1 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.email IS NOT OLD.email OR NEW.capability IS NOT OLD.capability OR NEW.unit_id IS NOT OLD.unit_id
 OR NEW.requested_by IS NOT OLD.requested_by OR NEW.created_at IS NOT OLD.created_at
 OR NOT (
 (OLD.status='pending' AND NEW.status IN ('approved','rejected') AND lower(NEW.reviewed_by)!=lower(OLD.requested_by) AND lower(NEW.reviewed_by)!=lower(OLD.email))
 OR (OLD.status='approved' AND NEW.status='revoked' AND EXISTS(
 SELECT 1 FROM india_erp_access_change_requests c WHERE c.grant_id=OLD.id AND c.tenant_id=OLD.tenant_id
 AND c.status='approved' AND lower(c.reviewed_by)=lower(NEW.reviewed_by)
 AND lower(c.reviewed_by)!=lower(OLD.email)))
 ) THEN RAISE(ABORT,'ERP_GRANT_IMMUTABLE') END;
END;
CREATE TRIGGER india_erp_access_change_apply AFTER UPDATE OF status ON india_erp_access_change_requests
WHEN NEW.status='approved' AND OLD.status='pending'
BEGIN
 UPDATE india_erp_capability_grants
 SET status='revoked',version=version+1,reviewed_by=NEW.reviewed_by,
 review_notes=NEW.review_notes,reviewed_at=CURRENT_TIMESTAMP
 WHERE id=NEW.grant_id AND tenant_id=NEW.tenant_id AND status='approved';
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'ERP_REVOKE_CONFLICT') END;
END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0038_erp_role_matrix_revocation.sql','erp-extensions');
INSERT INTO india_schema_migrations(version) VALUES(38);
