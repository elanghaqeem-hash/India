-- 0043 WP2: versioned matrix change control; no direct admin privilege grant.
CREATE TABLE india_erp_role_policy_changes(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','marketing','sales','presales','finance','approver','legal','viewer')),
 capability TEXT NOT NULL CHECK(capability IN ('finance_gl','finance_ap','procurement','cyber_ops','resource','hr','audit')),
 from_allowed INTEGER NOT NULL CHECK(from_allowed IN (0,1)),
 to_allowed INTEGER NOT NULL CHECK(to_allowed IN (0,1)),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 12 AND 800),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,requested_by TEXT NOT NULL COLLATE NOCASE,
 reviewed_by TEXT COLLATE NOCASE,review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),CHECK(from_allowed!=to_allowed),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by)),
 CHECK(status='pending' OR (reviewed_by IS NOT NULL AND coalesce(length(review_notes),0)>=12))
);
CREATE TRIGGER india_erp_policy_change_review BEFORE UPDATE ON india_erp_role_policy_changes
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.role IS NOT OLD.role
 OR NEW.capability IS NOT OLD.capability OR NEW.from_allowed IS NOT OLD.from_allowed
 OR NEW.to_allowed IS NOT OLD.to_allowed OR NEW.reason IS NOT OLD.reason
 OR NEW.requested_by IS NOT OLD.requested_by OR lower(NEW.reviewed_by)=lower(OLD.requested_by)
BEGIN SELECT RAISE(ABORT,'ROLE_POLICY_CHANGE_IMMUTABLE'); END;
CREATE TRIGGER india_erp_policy_change_no_delete BEFORE DELETE ON india_erp_role_policy_changes
BEGIN SELECT RAISE(ABORT,'ROLE_POLICY_CHANGE_IMMUTABLE'); END;
DROP TRIGGER india_erp_role_matrix_no_update;
CREATE TRIGGER india_erp_role_matrix_versioned BEFORE UPDATE ON india_erp_role_capability_matrix
WHEN NOT EXISTS(SELECT 1 FROM india_erp_role_policy_changes x
 WHERE x.role=OLD.role AND x.capability=OLD.capability AND x.to_allowed=NEW.allowed AND x.from_allowed=OLD.allowed
 AND x.status='approved')
BEGIN SELECT RAISE(ABORT,'ROLE_POLICY_CHANGE_REQUIRED'); END;
CREATE TRIGGER india_erp_policy_change_apply AFTER UPDATE OF status ON india_erp_role_policy_changes
WHEN NEW.status='approved' AND OLD.status='pending'
BEGIN
 SELECT CASE WHEN coalesce((SELECT allowed FROM india_erp_role_capability_matrix
 WHERE role=NEW.role AND capability=NEW.capability),0)!=NEW.from_allowed
 THEN RAISE(ABORT,'ROLE_POLICY_STALE') END;
 INSERT INTO india_erp_role_capability_matrix(role,capability,allowed) VALUES(NEW.role,NEW.capability,NEW.to_allowed)
 ON CONFLICT(role,capability) DO UPDATE SET allowed=excluded.allowed,updated_at=CURRENT_TIMESTAMP;
END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0043_erp_role_policy_change.sql','erp-extensions');
INSERT INTO india_schema_migrations(version) VALUES(43);
