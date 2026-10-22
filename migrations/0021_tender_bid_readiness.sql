-- INDIA 0021: additive tender deadline, bid document checklist, versioned independent reviews.
-- Depends on 0012 and 0016. No dummy data, no existing bid auto-approval.
CREATE TABLE india_tender_deadlines(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 milestone TEXT NOT NULL CHECK(milestone IN ('clarification','aanwijzing','administrative','technical','commercial','submission')),
 due_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by TEXT NOT NULL COLLATE NOCASE,
 reviewed_by TEXT, review_notes TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id,milestone), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 CHECK(status!='approved' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE INDEX india_tender_deadline_due ON india_tender_deadlines(tenant_id,due_at,status);
CREATE TABLE india_tender_checklist(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 item_code TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('administrative','technical','commercial')),
 label TEXT NOT NULL, mandatory INTEGER NOT NULL CHECK(mandatory IN (0,1)),
 document_name TEXT NOT NULL DEFAULT '', evidence_reference TEXT NOT NULL DEFAULT '',
 evidence_sha256 TEXT NOT NULL DEFAULT '', source_clause_id TEXT,
 due_at TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','rejected')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by TEXT NOT NULL COLLATE NOCASE,
 checked_by TEXT, checked_at TEXT, review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id,item_code), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(source_clause_id) REFERENCES india_tender_compliance_items(id),
 CHECK(evidence_sha256='' OR length(evidence_sha256)=64),
 CHECK(status!='ready' OR (
  checked_by IS NOT NULL AND lower(checked_by)!=lower(created_by) AND
  length(evidence_reference)>=8 AND length(evidence_sha256)=64 AND length(document_name)>0))
);
CREATE INDEX india_tender_checklist_opportunity ON india_tender_checklist(tenant_id,opportunity_id,category,status);
CREATE TABLE india_tender_readiness_history(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER india_tender_deadline_history BEFORE UPDATE ON india_tender_deadlines
BEGIN INSERT INTO india_tender_readiness_history(id,tenant_id,opportunity_id,entity_kind,entity_id,snapshot_json)
 VALUES(lower(hex(randomblob(16))),OLD.tenant_id,OLD.opportunity_id,'deadline',OLD.id,
 json_object('milestone',OLD.milestone,'due_at',OLD.due_at,'status',OLD.status,'notes',OLD.notes,'version',OLD.version,
 'created_by',OLD.created_by,'reviewed_by',OLD.reviewed_by,'review_notes',OLD.review_notes)); END;
CREATE TRIGGER india_tender_checklist_history BEFORE UPDATE ON india_tender_checklist
BEGIN INSERT INTO india_tender_readiness_history(id,tenant_id,opportunity_id,entity_kind,entity_id,snapshot_json)
 VALUES(lower(hex(randomblob(16))),OLD.tenant_id,OLD.opportunity_id,'checklist',OLD.id,
 json_object('item_code',OLD.item_code,'category',OLD.category,'label',OLD.label,'mandatory',OLD.mandatory,
 'document_name',OLD.document_name,'evidence_reference',OLD.evidence_reference,'evidence_sha256',OLD.evidence_sha256,
 'source_clause_id',OLD.source_clause_id,'due_at',OLD.due_at,'status',OLD.status,'version',OLD.version,
 'created_by',OLD.created_by,'checked_by',OLD.checked_by,'review_notes',OLD.review_notes)); END;
CREATE TRIGGER india_tender_readiness_history_immutable_update BEFORE UPDATE ON india_tender_readiness_history
BEGIN SELECT RAISE(ABORT,'READINESS_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_tender_readiness_history_immutable_delete BEFORE DELETE ON india_tender_readiness_history
BEGIN SELECT RAISE(ABORT,'READINESS_HISTORY_IMMUTABLE'); END;
-- This second trigger extends the existing 0016 mandatory-clause stage gate; it never weakens it.
CREATE TRIGGER india_tender_package_stage_gate BEFORE UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage!=OLD.stage AND NEW.stage IN ('commercial_review','quotation_sent','negotiation','pending_po','closed_won')
 AND (EXISTS(SELECT 1 FROM india_sales_bids b WHERE b.tenant_id=NEW.tenant_id AND b.opportunity_id=NEW.id AND b.channel!='direct')
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%tender%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%rfp%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%rfq%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%lpse%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%spse%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%pengadaan%')
BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM india_tender_deadlines t WHERE t.tenant_id=NEW.tenant_id AND t.opportunity_id=NEW.id
 AND t.milestone='submission' AND t.status='approved' AND datetime(t.due_at)>datetime('now')
 AND (SELECT count(DISTINCT category) FROM india_tender_checklist c WHERE c.tenant_id=NEW.tenant_id
 AND c.opportunity_id=NEW.id AND c.mandatory=1)=3
 AND NOT EXISTS(SELECT 1 FROM india_tender_checklist c WHERE c.tenant_id=NEW.tenant_id
 AND c.opportunity_id=NEW.id AND c.mandatory=1 AND
 (c.status!='ready' OR length(c.evidence_reference)<8 OR length(c.evidence_sha256)!=64
 OR c.checked_by IS NULL OR lower(c.checked_by)=lower(c.created_by)
 OR (c.due_at IS NOT NULL AND datetime(c.due_at)<datetime('now'))))
 ) THEN RAISE(ABORT,'READINESS_CONFLICT: submission deadline and mandatory bid package must be reviewed') END;
END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch)
 VALUES('migrations/0021_tender_bid_readiness.sql','tender-bid-readiness');
INSERT INTO india_schema_migrations(version) VALUES(21);