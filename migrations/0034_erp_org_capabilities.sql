-- WP2 canonical organizational scopes and dual-controlled ERP capabilities.
-- Additive, no identities or grants seeded. Existing memberships remain the login authority.
CREATE TABLE india_erp_org_units (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, code TEXT NOT NULL,
 label TEXT NOT NULL CHECK(length(label) BETWEEN 3 AND 160),
 kind TEXT NOT NULL CHECK(kind IN ('legal_entity','division','department','team','cost_center')),
 parent_id TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,code),
 FOREIGN KEY(tenant_id,parent_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(parent_id IS NULL OR parent_id!=id)
);
CREATE TRIGGER india_erp_org_parent BEFORE INSERT ON india_erp_org_units
BEGIN
 SELECT CASE WHEN NEW.kind='legal_entity' AND NEW.parent_id IS NOT NULL THEN RAISE(ABORT,'ERP_ORG_PARENT') END;
 SELECT CASE WHEN NEW.kind!='legal_entity' AND NOT EXISTS(
  SELECT 1 FROM india_erp_org_units p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.parent_id AND p.active=1
  AND ( (NEW.kind='division' AND p.kind='legal_entity')
     OR (NEW.kind='department' AND p.kind='division')
     OR (NEW.kind='team' AND p.kind='department')
     OR (NEW.kind='cost_center' AND p.kind IN ('division','department')) )
 ) THEN RAISE(ABORT,'ERP_ORG_PARENT') END;
END;
CREATE TRIGGER india_erp_org_no_delete BEFORE DELETE ON india_erp_org_units BEGIN SELECT RAISE(ABORT,'ERP_ORG_ARCHIVE_ONLY'); END;
CREATE TRIGGER india_erp_org_frozen BEFORE UPDATE ON india_erp_org_units
WHEN NEW.tenant_id IS NOT OLD.tenant_id OR NEW.id IS NOT OLD.id OR NEW.parent_id IS NOT OLD.parent_id OR NEW.kind IS NOT OLD.kind OR NEW.code IS NOT OLD.code OR NEW.created_by IS NOT OLD.created_by
BEGIN SELECT RAISE(ABORT,'ERP_ORG_IMMUTABLE'); END;
CREATE TABLE india_erp_staff_org (
 tenant_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, unit_id TEXT NOT NULL,
 position_title TEXT NOT NULL CHECK(length(position_title) BETWEEN 3 AND 120),
 created_by TEXT NOT NULL COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,reviewed_by TEXT COLLATE NOCASE,review_notes TEXT,
 PRIMARY KEY(tenant_id,email), FOREIGN KEY(email) REFERENCES india_members(email),
 FOREIGN KEY(tenant_id,unit_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(reviewed_by IS NULL OR (lower(reviewed_by)!=lower(created_by) AND lower(reviewed_by)!=lower(email))),
 CHECK(status='pending' OR (reviewed_by IS NOT NULL AND length(review_notes)>=12))
);
CREATE TRIGGER india_erp_staff_review BEFORE UPDATE ON india_erp_staff_org
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected')
 OR NEW.version!=OLD.version+1 OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.email IS NOT OLD.email OR NEW.unit_id IS NOT OLD.unit_id
 OR NEW.position_title IS NOT OLD.position_title OR NEW.created_by IS NOT OLD.created_by
 OR lower(NEW.reviewed_by)=lower(OLD.created_by) OR lower(NEW.reviewed_by)=lower(OLD.email)
BEGIN SELECT RAISE(ABORT,'ERP_STAFF_IMMUTABLE'); END;
CREATE TRIGGER india_erp_staff_no_delete BEFORE DELETE ON india_erp_staff_org BEGIN SELECT RAISE(ABORT,'ERP_STAFF_IMMUTABLE'); END;
CREATE TABLE india_erp_capability_grants (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE,
 capability TEXT NOT NULL CHECK(capability IN ('finance_gl','finance_ap','procurement','cyber_ops','resource','hr','audit')),
 unit_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 requested_by TEXT NOT NULL COLLATE NOCASE,
 reviewed_by TEXT COLLATE NOCASE, review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,email,capability,unit_id),
 FOREIGN KEY(email) REFERENCES india_members(email),
 FOREIGN KEY(tenant_id,unit_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(reviewed_by IS NULL OR (lower(reviewed_by)!=lower(requested_by) AND lower(reviewed_by)!=lower(email))),
 CHECK(status NOT IN ('approved','rejected','revoked') OR (reviewed_by IS NOT NULL AND length(review_notes)>=12))
);
CREATE INDEX india_erp_capability_access ON india_erp_capability_grants(tenant_id,email,capability,status);
CREATE TRIGGER india_erp_grants_no_delete BEFORE DELETE ON india_erp_capability_grants
BEGIN SELECT RAISE(ABORT,'ERP_GRANT_IMMUTABLE'); END;
CREATE TRIGGER india_erp_grants_review BEFORE UPDATE ON india_erp_capability_grants
BEGIN
 SELECT CASE WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected')
 OR NEW.version!=OLD.version+1 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.email IS NOT OLD.email OR NEW.capability IS NOT OLD.capability
 OR NEW.unit_id IS NOT OLD.unit_id OR NEW.requested_by IS NOT OLD.requested_by
 OR NEW.created_at IS NOT OLD.created_at OR lower(NEW.reviewed_by)=lower(OLD.requested_by)
 OR lower(NEW.reviewed_by)=lower(OLD.email)
 THEN RAISE(ABORT,'ERP_GRANT_IMMUTABLE') END;
END;
-- Projects receive a separately approved legal-entity scope; no automatic defaults.
CREATE TABLE india_erp_project_scopes (
 tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,project_id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by))
);
CREATE TRIGGER india_erp_project_scope_guard BEFORE INSERT ON india_erp_project_scopes
WHEN NOT EXISTS(SELECT 1 FROM india_erp_org_units u WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.legal_entity_id AND u.kind='legal_entity' AND u.active=1)
BEGIN SELECT RAISE(ABORT,'ERP_PROJECT_SCOPE_INVALID'); END;
CREATE TRIGGER india_erp_project_scope_review BEFORE UPDATE ON india_erp_project_scopes
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.project_id IS NOT OLD.project_id
 OR NEW.legal_entity_id IS NOT OLD.legal_entity_id OR NEW.requested_by IS NOT OLD.requested_by
 OR lower(NEW.reviewed_by)=lower(OLD.requested_by)
BEGIN SELECT RAISE(ABORT,'ERP_PROJECT_SCOPE_IMMUTABLE'); END;
CREATE TRIGGER india_erp_project_scope_no_delete BEFORE DELETE ON india_erp_project_scopes BEGIN SELECT RAISE(ABORT,'ERP_PROJECT_SCOPE_IMMUTABLE'); END;

CREATE TABLE india_erp_opportunity_scopes (
 tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,opportunity_id),FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by))
);
CREATE TRIGGER india_erp_opp_scope_guard BEFORE INSERT ON india_erp_opportunity_scopes
WHEN NOT EXISTS(SELECT 1 FROM india_erp_org_units u WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.legal_entity_id AND u.kind='legal_entity' AND u.active=1)
BEGIN SELECT RAISE(ABORT,'ERP_OPPORTUNITY_SCOPE_INVALID'); END;
CREATE TRIGGER india_erp_opp_scope_review BEFORE UPDATE ON india_erp_opportunity_scopes
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.opportunity_id IS NOT OLD.opportunity_id
 OR NEW.legal_entity_id IS NOT OLD.legal_entity_id OR NEW.requested_by IS NOT OLD.requested_by
 OR lower(NEW.reviewed_by)=lower(OLD.requested_by)
BEGIN SELECT RAISE(ABORT,'ERP_OPPORTUNITY_SCOPE_IMMUTABLE'); END;
CREATE TRIGGER india_erp_opp_scope_no_delete BEFORE DELETE ON india_erp_opportunity_scopes BEGIN SELECT RAISE(ABORT,'ERP_OPPORTUNITY_SCOPE_IMMUTABLE'); END;

INSERT INTO india_schema_file_manifest(path,source_branch)
VALUES('migrations/0034_erp_org_capabilities.sql','erp-wp2');
INSERT INTO india_schema_migrations(version) VALUES(34);
