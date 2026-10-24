-- INDIA A-G 0023: Tender evidence must be backed by an immutable encrypted original.
-- Depends on 0015 (Vault), 0016 (clauses), 0021 (Bid Readiness), 0022 (Vault governance).
-- This migration is additive. No prior approvals, documents, or history are rewritten.
CREATE VIEW india_tender_vault_originals AS
 SELECT d.tenant_id,d.opportunity_id,d.kind,d.file_name,
        'library:'||d.id AS evidence_reference,d.sha256,d.id AS document_id
 FROM india_document_library d
 WHERE d.chunk_count>0 AND
       (SELECT count(*) FROM india_document_library_chunks c WHERE c.document_id=d.id)=d.chunk_count;
CREATE TRIGGER india_tender_vault_item_review BEFORE UPDATE OF status ON india_tender_checklist
WHEN NEW.status='ready' AND NEW.mandatory=1
 AND NOT EXISTS(
  SELECT 1 FROM india_tender_vault_originals v
  WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id
   AND v.evidence_reference=NEW.evidence_reference
   AND v.sha256=NEW.evidence_sha256 AND v.file_name=NEW.document_name
 )
BEGIN SELECT RAISE(ABORT,'TENDER_VAULT_EVIDENCE: mandatory checklist requires an uploaded original'); END;
CREATE TRIGGER india_tender_vault_requirement_review BEFORE UPDATE OF status ON india_sales_requirements
WHEN NEW.status='reviewed' AND NEW.compliance_status='compliant'
 AND NEW.kind IN ('rks','kak','rfp','rfq')
 AND NOT EXISTS(
  SELECT 1 FROM india_tender_vault_originals v
  WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id
   AND v.evidence_reference=NEW.file_reference AND v.sha256=NEW.source_content_hash
   AND v.kind=CASE WHEN NEW.kind IN ('rks','kak') THEN NEW.kind ELSE 'supporting' END
 )
BEGIN SELECT RAISE(ABORT,'TENDER_VAULT_EVIDENCE: RKS/KAK source must exist in Document Vault'); END;
CREATE TRIGGER india_tender_vault_clause_review BEFORE UPDATE OF status ON india_tender_compliance_items
WHEN NEW.status='reviewed' AND NEW.mandatory=1
 AND NOT EXISTS(
  SELECT 1 FROM india_tender_vault_originals v
  WHERE v.tenant_id=NEW.tenant_id AND v.opportunity_id=NEW.opportunity_id
   AND v.evidence_reference=NEW.evidence_reference AND v.sha256=NEW.evidence_sha256
 )
BEGIN SELECT RAISE(ABORT,'TENDER_VAULT_EVIDENCE: mandatory clause requires its stored original'); END;
CREATE TRIGGER india_tender_vault_stage BEFORE UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage!=OLD.stage
 AND NEW.stage IN ('commercial_review','quotation_sent','negotiation','pending_po','closed_won')
 AND (EXISTS(SELECT 1 FROM india_sales_bids b WHERE b.tenant_id=NEW.tenant_id AND b.opportunity_id=NEW.id AND b.channel!='direct')
      OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%tender%'
      OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%rfp%'
      OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%rfq%'
      OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%lpse%'
      OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%spse%'
      OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%pengadaan%')
 AND (
   EXISTS(SELECT 1 FROM india_tender_checklist c
          WHERE c.tenant_id=NEW.tenant_id AND c.opportunity_id=NEW.id AND c.mandatory=1
           AND NOT EXISTS(SELECT 1 FROM india_tender_vault_originals v
             WHERE v.tenant_id=c.tenant_id AND v.opportunity_id=c.opportunity_id
             AND v.evidence_reference=c.evidence_reference AND v.sha256=c.evidence_sha256 AND v.file_name=c.document_name))
   OR EXISTS(SELECT 1 FROM india_sales_requirements r
          WHERE r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.id AND r.kind IN ('rks','kak','rfp','rfq')
           AND NOT EXISTS(SELECT 1 FROM india_tender_vault_originals v
             WHERE v.tenant_id=r.tenant_id AND v.opportunity_id=r.opportunity_id
             AND v.evidence_reference=r.file_reference AND v.sha256=r.source_content_hash
             AND v.kind=CASE WHEN r.kind IN ('rks','kak') THEN r.kind ELSE 'supporting' END))
   OR EXISTS(SELECT 1 FROM india_tender_compliance_items c
          WHERE c.tenant_id=NEW.tenant_id AND c.opportunity_id=NEW.id AND c.mandatory=1
           AND NOT EXISTS(SELECT 1 FROM india_tender_vault_originals v
             WHERE v.tenant_id=c.tenant_id AND v.opportunity_id=c.opportunity_id
             AND v.evidence_reference=c.evidence_reference AND v.sha256=c.evidence_sha256))
 )
BEGIN SELECT RAISE(ABORT,'TENDER_VAULT_EVIDENCE: tender originals are missing or mismatched'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch)
 VALUES('migrations/0023_tender_vault_integrity.sql','india-ag-vault-tender-integration');
INSERT INTO india_schema_migrations(version) VALUES(23);
