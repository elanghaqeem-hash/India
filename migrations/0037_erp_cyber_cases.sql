-- WP5 cybersecurity operations: case orchestration referencing canonical service projects.
-- This tracks authorized metadata and original Vault evidence; no SIEM, scanner or DFIR engine invented.
CREATE TABLE india_cyber_cases (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('vapt_finding','soc_incident','dfir_incident')),
 external_ref TEXT NOT NULL CHECK(length(external_ref) BETWEEN 3 AND 120),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 8 AND 240),
 severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low','informational')),
 classification TEXT NOT NULL CHECK(classification IN ('confidential','restricted')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','closed','rejected')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by TEXT NOT NULL COLLATE NOCASE,
 reviewer_email TEXT COLLATE NOCASE,review_notes TEXT,
 evidence_document_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,closed_at TEXT,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,project_id,kind,external_ref),
 FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id),
 CHECK(reviewer_email IS NULL OR lower(reviewer_email)!=lower(created_by))
);
CREATE TRIGGER india_cyber_case_scope BEFORE INSERT ON india_cyber_cases
WHEN NOT EXISTS(SELECT 1 FROM india_delivery_projects p WHERE p.tenant_id=NEW.tenant_id
 AND p.id=NEW.project_id AND p.status='active'
 AND ((NEW.kind='vapt_finding' AND p.service_family='VAPT')
 OR (NEW.kind='soc_incident' AND p.service_family='SOC/MDR')
 OR (NEW.kind='dfir_incident' AND p.service_family IN ('DFIR','Incident Response','Managed Security'))))
BEGIN SELECT RAISE(ABORT,'CYBER_PROJECT_NOT_AUTHORIZED'); END;
CREATE TRIGGER india_cyber_case_review BEFORE UPDATE ON india_cyber_cases
BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.project_id IS NOT OLD.project_id
 OR NEW.kind IS NOT OLD.kind OR NEW.external_ref IS NOT OLD.external_ref OR NEW.title IS NOT OLD.title
 OR NEW.severity IS NOT OLD.severity OR NEW.classification IS NOT OLD.classification
 OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
 OR NEW.version!=OLD.version+1 OR NOT (
 (OLD.status='open' AND NEW.status IN ('reviewed','rejected')) OR
 (OLD.status='reviewed' AND NEW.status='closed')
 ) THEN RAISE(ABORT,'CYBER_CASE_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status IN ('reviewed','closed') AND (
 NEW.evidence_document_id IS NULL OR NEW.reviewer_email IS NULL
 OR lower(NEW.reviewer_email)=lower(NEW.created_by) OR coalesce(length(NEW.review_notes),0)<12
 ) THEN RAISE(ABORT,'CYBER_EVIDENCE_REVIEW_REQUIRED') END;
END;
CREATE TRIGGER india_cyber_case_no_delete BEFORE DELETE ON india_cyber_cases BEGIN SELECT RAISE(ABORT,'CYBER_CASE_IMMUTABLE'); END;
CREATE INDEX india_cyber_case_board ON india_cyber_cases(tenant_id,kind,status,severity);
INSERT INTO india_schema_file_manifest(path,source_branch)
VALUES('migrations/0037_erp_cyber_cases.sql','erp-cyber-ops');
INSERT INTO india_schema_migrations(version) VALUES(37);
