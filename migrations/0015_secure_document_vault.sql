-- Independent of reserved migrations 0013 (activities) and 0014 (Lead intelligence).
-- Originals are encrypted by the Worker before entering D1. No plaintext file bytes.
CREATE TABLE india_document_vault(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,
 release_id TEXT NOT NULL REFERENCES india_sales_releases(id),
 kind TEXT NOT NULL CHECK(kind IN ('proposal','submission','negotiation','po','spk','contract','award_letter')),
 file_name TEXT NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),media_type TEXT NOT NULL,
 byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 8388608),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),iv TEXT NOT NULL CHECK(length(iv)=16),
 chunk_count INTEGER NOT NULL CHECK(chunk_count BETWEEN 1 AND 33),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE INDEX idx_india_document_opportunity ON india_document_vault(tenant_id,opportunity_id,release_id);
CREATE TABLE india_document_chunks(
 document_id TEXT NOT NULL REFERENCES india_document_vault(id),part INTEGER NOT NULL CHECK(part BETWEEN 0 AND 32),
 ciphertext TEXT NOT NULL CHECK(length(ciphertext) BETWEEN 4 AND 349528),PRIMARY KEY(document_id,part)
);
CREATE TRIGGER india_document_parent BEFORE INSERT ON india_document_vault
WHEN NOT EXISTS(SELECT 1 FROM india_sales_releases WHERE id=NEW.release_id AND tenant_id=NEW.tenant_id AND opportunity_id=NEW.opportunity_id AND status!='superseded')
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: document release mismatch'); END;
CREATE TRIGGER india_document_chunk_parent BEFORE INSERT ON india_document_chunks
WHEN NOT EXISTS(SELECT 1 FROM india_document_vault WHERE id=NEW.document_id AND NEW.part<chunk_count)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: document chunk mismatch'); END;
CREATE VIEW india_document_evidence AS SELECT d.*,'vault:'||d.id AS reference FROM india_document_vault d
WHERE (SELECT count(*) FROM india_document_chunks c WHERE c.document_id=d.id)=d.chunk_count;
CREATE TRIGGER india_document_vault_update BEFORE UPDATE ON india_document_vault
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_document_vault_delete BEFORE DELETE ON india_document_vault
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_document_chunks_update BEFORE UPDATE ON india_document_chunks
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_document_chunks_delete BEFORE DELETE ON india_document_chunks
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_document_gate_0 BEFORE UPDATE OF status ON india_sales_releases
WHEN (NEW.status IN ('proposed','approved')) AND NOT EXISTS(SELECT 1 FROM india_document_evidence v WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id AND v.release_id=NEW.id AND v.kind='proposal' AND v.reference=NEW.proposal_reference AND v.sha256=NEW.proposal_sha256)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stored original document required'); END;
CREATE TRIGGER india_document_gate_1 BEFORE INSERT ON india_sales_submissions
WHEN (1) AND NOT EXISTS(SELECT 1 FROM india_document_evidence v WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id AND v.release_id=NEW.release_id AND v.kind='submission' AND v.reference=NEW.evidence_reference AND v.sha256=NEW.evidence_sha256)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stored original document required'); END;
CREATE TRIGGER india_document_gate_2 BEFORE UPDATE OF status ON india_sales_submissions
WHEN (NEW.status='verified') AND NOT EXISTS(SELECT 1 FROM india_document_evidence v WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id AND v.release_id=NEW.release_id AND v.kind='submission' AND v.reference=NEW.evidence_reference AND v.sha256=NEW.evidence_sha256)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stored original document required'); END;
CREATE TRIGGER india_document_gate_3 BEFORE INSERT ON india_sales_negotiations
WHEN (1) AND NOT EXISTS(SELECT 1 FROM india_document_evidence v WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id AND v.release_id=NEW.release_id AND v.kind='negotiation' AND v.reference=NEW.evidence_reference AND v.sha256=NEW.evidence_sha256)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stored original document required'); END;
CREATE TRIGGER india_document_gate_4 BEFORE INSERT ON india_sales_award_documents
WHEN (1) AND NOT EXISTS(SELECT 1 FROM india_document_evidence v WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id AND v.release_id=NEW.release_id AND v.kind=NEW.document_kind AND v.reference=NEW.archive_reference AND v.sha256=NEW.original_sha256)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stored original document required'); END;
CREATE TRIGGER india_document_gate_5 BEFORE UPDATE OF finance_reviewed_by,legal_reviewed_by ON india_sales_award_documents
WHEN (1) AND NOT EXISTS(SELECT 1 FROM india_document_evidence v WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id AND v.release_id=NEW.release_id AND v.kind=NEW.document_kind AND v.reference=NEW.archive_reference AND v.sha256=NEW.original_sha256)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stored original document required'); END;
CREATE TRIGGER india_document_won_gate BEFORE UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage='closed_won' AND OLD.stage!='closed_won'
BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM india_sales_releases r
 JOIN india_document_evidence p ON p.reference=r.proposal_reference AND p.sha256=r.proposal_sha256 AND p.kind='proposal' AND p.release_id=r.id
 JOIN india_sales_submissions s ON s.release_id=r.id AND s.status='verified'
 JOIN india_document_evidence m ON m.reference=s.evidence_reference AND m.sha256=s.evidence_sha256 AND m.kind='submission' AND m.release_id=r.id
 JOIN india_sales_negotiations n ON n.release_id=r.id AND n.decision='approved' AND n.rowid=(SELECT max(n2.rowid) FROM india_sales_negotiations n2 WHERE n2.release_id=r.id)
 JOIN india_document_evidence e ON e.reference=n.evidence_reference AND e.sha256=n.evidence_sha256 AND e.kind='negotiation' AND e.release_id=r.id
 JOIN india_sales_po_checks c ON c.release_id=r.id AND c.opportunity_id=NEW.id
 JOIN india_sales_award_documents a ON a.id=c.award_id AND a.release_id=r.id
 JOIN india_document_evidence o ON o.reference=a.archive_reference AND o.sha256=a.original_sha256 AND o.kind=a.document_kind AND o.release_id=r.id
 WHERE r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.id AND r.status='approved'
 AND p.tenant_id=r.tenant_id AND m.tenant_id=r.tenant_id AND e.tenant_id=r.tenant_id AND o.tenant_id=r.tenant_id
 AND p.opportunity_id=NEW.id AND m.opportunity_id=NEW.id AND e.opportunity_id=NEW.id AND o.opportunity_id=NEW.id)
 THEN RAISE(ABORT,'FLOW_CONFLICT: Won requires all four stored originals of current release') END;
END;
-- Reopen only legacy open offers. Closed history remains unchanged and readable.
INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary)
 SELECT lower(hex(randomblob(16))),r.tenant_id,'deal',r.opportunity_id,'DOCUMENT_REVALIDATION_REQUIRED','schema-migration-0015','Original offer and approvals retained; upload original files and revalidate a new release'
 FROM india_sales_releases r JOIN india_sales_opportunities o ON o.id=r.opportunity_id AND o.tenant_id=r.tenant_id
 WHERE r.status!='superseded' AND o.stage NOT IN ('closed_won','closed_lost');
UPDATE india_sales_opportunities SET stage='solution_design' WHERE stage NOT IN ('closed_won','closed_lost')
 AND id IN (SELECT opportunity_id FROM india_sales_releases WHERE status!='superseded');
DELETE FROM india_sales_po_checks WHERE opportunity_id IN(SELECT id FROM india_sales_opportunities WHERE stage NOT IN ('closed_won','closed_lost'));
UPDATE india_sales_submissions SET status='superseded' WHERE status IN ('reported','verified') AND opportunity_id IN(SELECT id FROM india_sales_opportunities WHERE stage NOT IN ('closed_won','closed_lost'));
UPDATE india_sales_releases SET status='superseded' WHERE status!='superseded' AND opportunity_id IN(SELECT id FROM india_sales_opportunities WHERE stage NOT IN ('closed_won','closed_lost'));
INSERT INTO india_schema_migrations(version) VALUES(15);
