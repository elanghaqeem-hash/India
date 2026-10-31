-- 0042 Cyber operation outbound integration: allowlisted destinations and immutable delivery record.
-- No credentials or personal customer event contents kept in connector configuration.
CREATE TABLE india_security_connectors(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 120),
 kind TEXT NOT NULL CHECK(kind IN ('siem','edr')),
 endpoint TEXT NOT NULL CHECK(endpoint LIKE 'https://%'),
 status TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('disabled','enabled')),
 created_by TEXT NOT NULL COLLATE NOCASE,
 reviewed_by TEXT COLLATE NOCASE,
 review_notes TEXT,version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,legal_entity_id,name),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(status='disabled' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by) AND coalesce(length(review_notes),0)>=12))
);
CREATE TRIGGER india_security_connector_review BEFORE UPDATE ON india_security_connectors
WHEN OLD.status!='disabled' OR NEW.status!='enabled' OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.legal_entity_id IS NOT OLD.legal_entity_id
 OR NEW.name IS NOT OLD.name OR NEW.kind IS NOT OLD.kind OR NEW.endpoint IS NOT OLD.endpoint
 OR NEW.created_by IS NOT OLD.created_by OR lower(NEW.reviewed_by)=lower(OLD.created_by)
BEGIN SELECT RAISE(ABORT,'CONNECTOR_IMMUTABLE'); END;
CREATE TABLE india_security_dispatches(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,connector_id TEXT NOT NULL,case_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','delivered','retryable','rejected')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 last_http_code INTEGER,requested_by TEXT NOT NULL COLLATE NOCASE,
 last_attempt_at TEXT,delivered_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,connector_id,case_id),
 FOREIGN KEY(tenant_id,connector_id) REFERENCES india_security_connectors(tenant_id,id),
 FOREIGN KEY(tenant_id,case_id) REFERENCES india_cyber_cases(tenant_id,id)
);
CREATE TRIGGER india_security_dispatch_guard BEFORE INSERT ON india_security_dispatches
WHEN NOT EXISTS(SELECT 1 FROM india_security_connectors k JOIN india_cyber_cases c
 ON c.tenant_id=k.tenant_id
 JOIN india_erp_project_scopes s ON s.tenant_id=c.tenant_id AND s.project_id=c.project_id
 WHERE k.id=NEW.connector_id AND k.tenant_id=NEW.tenant_id AND k.status='enabled'
 AND c.id=NEW.case_id AND c.status IN ('reviewed','closed')
 AND c.evidence_document_id IS NOT NULL AND s.status='approved' AND s.legal_entity_id=k.legal_entity_id)
BEGIN SELECT RAISE(ABORT,'CONNECTOR_CASE_SCOPE'); END;
CREATE TRIGGER india_security_dispatch_update BEFORE UPDATE ON india_security_dispatches
WHEN NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.connector_id IS NOT OLD.connector_id OR NEW.case_id IS NOT OLD.case_id
 OR NEW.requested_by IS NOT OLD.requested_by OR NEW.created_at IS NOT OLD.created_at
 OR NOT(
 (OLD.status IN ('pending','retryable') AND NEW.status='sending' AND NEW.attempts=OLD.attempts+1 AND OLD.attempts<5)
 OR (OLD.status='sending' AND NEW.status='sending' AND NEW.attempts=OLD.attempts+1 AND OLD.attempts<5
 AND OLD.last_attempt_at<=datetime('now','-15 minutes'))
 OR (OLD.status='sending' AND NEW.status IN ('retryable','delivered','rejected') AND NEW.attempts=OLD.attempts)
 )
BEGIN SELECT RAISE(ABORT,'DISPATCH_IMMUTABLE'); END;
CREATE TRIGGER india_security_dispatch_no_delete BEFORE DELETE ON india_security_dispatches BEGIN SELECT RAISE(ABORT,'DISPATCH_IMMUTABLE'); END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0044_erp_siem_edr_connectors.sql','erp-extensions');
INSERT INTO india_schema_migrations(version) VALUES(44);
