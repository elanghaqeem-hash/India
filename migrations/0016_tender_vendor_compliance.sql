-- 0015 is reserved for the separate secure-vault workstream. No seed or approval backfill.
CREATE TABLE india_vendors(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, legal_name TEXT NOT NULL, registration_number TEXT NOT NULL,
 contact_email TEXT NOT NULL, capabilities TEXT NOT NULL, capacity_units REAL NOT NULL CHECK(capacity_units>0 AND capacity_units<1e9),
 capacity_unit TEXT NOT NULL, evidence_reference TEXT NOT NULL, evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 valid_until TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','validated','rejected','suspended')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL COLLATE NOCASE, reviewed_by TEXT, review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,registration_number),
 CHECK(status!='validated' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE TABLE india_vendor_offers(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL, vendor_id TEXT NOT NULL,
 scope TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity>0 AND quantity<1e9), unit TEXT NOT NULL,
 unit_price_idr REAL NOT NULL CHECK(unit_price_idr>0 AND unit_price_idr<1e14),
 capacity_confirmed REAL NOT NULL CHECK(capacity_confirmed>=quantity AND capacity_confirmed<1e9),
 valid_until TEXT NOT NULL, evidence_reference TEXT NOT NULL, evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','validated','rejected')), version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL COLLATE NOCASE, reviewed_by TEXT, review_notes TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,vendor_id) REFERENCES india_vendors(tenant_id,id),
 CHECK(status!='validated' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE INDEX india_vendor_offers_opportunity ON india_vendor_offers(tenant_id,opportunity_id,status,valid_until);
CREATE TABLE india_tender_compliance_items(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL, requirement_id TEXT NOT NULL REFERENCES india_sales_requirements(id),
 clause_reference TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('administrative','technical','commercial','security','vendor')),
 requirement_text TEXT NOT NULL, mandatory INTEGER NOT NULL CHECK(mandatory IN (0,1)), response_text TEXT NOT NULL,
 evidence_reference TEXT NOT NULL, evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 vendor_offer_id TEXT, compliance_status TEXT NOT NULL DEFAULT 'pending' CHECK(compliance_status IN ('pending','compliant','partial','non_compliant','not_applicable')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed')), version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL COLLATE NOCASE, reviewed_by TEXT, review_notes TEXT, reviewed_at TEXT,
 UNIQUE(tenant_id,requirement_id,clause_reference),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,vendor_offer_id) REFERENCES india_vendor_offers(tenant_id,id),
 CHECK(status!='reviewed' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by))),
 CHECK(category!='vendor' OR vendor_offer_id IS NOT NULL), CHECK(mandatory=0 OR compliance_status!='not_applicable')
);
CREATE INDEX india_compliance_opportunity ON india_tender_compliance_items(tenant_id,opportunity_id,requirement_id,status);
CREATE TABLE india_procurement_history(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TRIGGER india_vendor_history BEFORE UPDATE ON india_vendors
BEGIN INSERT INTO india_procurement_history VALUES(lower(hex(randomblob(16))),OLD.tenant_id,'vendor',OLD.id,json_object('legal_name',OLD.legal_name,'registration_number',OLD.registration_number,'contact_email',OLD.contact_email,'capabilities',OLD.capabilities,'capacity_units',OLD.capacity_units,'capacity_unit',OLD.capacity_unit,'evidence_reference',OLD.evidence_reference,'evidence_sha256',OLD.evidence_sha256,'valid_until',OLD.valid_until,'version',OLD.version,'status',OLD.status,'created_by',OLD.created_by,'reviewed_by',OLD.reviewed_by,'review_notes',OLD.review_notes),CURRENT_TIMESTAMP); END;
CREATE TRIGGER india_clause_history BEFORE UPDATE ON india_tender_compliance_items
BEGIN INSERT INTO india_procurement_history VALUES(lower(hex(randomblob(16))),OLD.tenant_id,'clause',OLD.id,json_object('requirement_id',OLD.requirement_id,'clause_reference',OLD.clause_reference,'category',OLD.category,'mandatory',OLD.mandatory,'requirement_text',OLD.requirement_text,'response_text',OLD.response_text,'evidence_reference',OLD.evidence_reference,'evidence_sha256',OLD.evidence_sha256,'vendor_offer_id',OLD.vendor_offer_id,'version',OLD.version,'status',OLD.status,'compliance_status',OLD.compliance_status,'created_by',OLD.created_by,'reviewed_by',OLD.reviewed_by,'review_notes',OLD.review_notes),CURRENT_TIMESTAMP); END;
CREATE TRIGGER india_requirement_history BEFORE UPDATE ON india_sales_requirements
BEGIN INSERT INTO india_procurement_history VALUES(lower(hex(randomblob(16))),OLD.tenant_id,'requirement',OLD.id,json_object('status',OLD.status,'compliance_status',OLD.compliance_status,'reviewed_by',OLD.reviewed_by,'review_notes',OLD.review_notes,'reviewed_at',OLD.reviewed_at),CURRENT_TIMESTAMP); END;
CREATE TRIGGER india_procurement_history_update BEFORE UPDATE ON india_procurement_history BEGIN SELECT RAISE(ABORT,'COMPLIANCE_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_procurement_history_delete BEFORE DELETE ON india_procurement_history BEGIN SELECT RAISE(ABORT,'COMPLIANCE_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_compliance_source BEFORE INSERT ON india_tender_compliance_items
WHEN NOT EXISTS(SELECT 1 FROM india_sales_requirements r WHERE r.id=NEW.requirement_id AND r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.opportunity_id AND r.status='draft')
BEGIN SELECT RAISE(ABORT,'COMPLIANCE_CONFLICT: source requirement must be draft'); END;
CREATE TRIGGER india_compliance_parent_review BEFORE UPDATE OF status ON india_sales_requirements
WHEN NEW.status='reviewed' AND NEW.compliance_status='compliant' AND EXISTS(SELECT 1 FROM india_tender_compliance_items c WHERE c.requirement_id=NEW.id)
 AND EXISTS(SELECT 1 FROM india_tender_compliance_items c WHERE c.requirement_id=NEW.id AND c.mandatory=1 AND (c.status!='reviewed' OR c.compliance_status!='compliant'))
BEGIN SELECT RAISE(ABORT,'COMPLIANCE_CONFLICT: mandatory clauses not compliant'); END;
-- Recheck capacity, price evidence and expiry at each forward tender gate.
CREATE VIEW india_tender_compliance_gaps AS
 SELECT c.*,CASE WHEN c.status!='reviewed' OR c.compliance_status!='compliant' THEN 1
 WHEN c.category='vendor' AND NOT EXISTS(SELECT 1 FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id
 WHERE o.id=c.vendor_offer_id AND o.tenant_id=c.tenant_id AND o.opportunity_id=c.opportunity_id AND o.status='validated' AND v.status='validated'
 AND date(o.valid_until)>=date('now','+7 hours') AND date(v.valid_until)>=date('now','+7 hours') AND o.unit=v.capacity_unit
 AND o.capacity_confirmed>=o.quantity AND v.capacity_units>=o.capacity_confirmed) THEN 1 ELSE 0 END AS is_gap
 FROM india_tender_compliance_items c;
CREATE TRIGGER india_tender_matrix_gate BEFORE UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage!=OLD.stage AND NEW.stage IN ('commercial_review','quotation_sent','negotiation','pending_po','closed_won')
 AND (EXISTS(SELECT 1 FROM india_sales_bids b WHERE b.tenant_id=NEW.tenant_id AND b.opportunity_id=NEW.id AND b.channel!='direct')
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%tender%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%rfp%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%rfq%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%lpse%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%spse%'
 OR lower(coalesce(json_extract(NEW.data_json,'$.procurement_process'),'')) LIKE '%pengadaan%')
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_sales_requirements r WHERE r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.id
 AND r.kind IN ('rks','kak','rfp','rfq') AND r.status='reviewed' AND r.compliance_status='compliant'
 AND EXISTS(SELECT 1 FROM india_tender_compliance_items c WHERE c.requirement_id=r.id AND c.mandatory=1)
 AND NOT EXISTS(SELECT 1 FROM india_tender_compliance_gaps c WHERE c.requirement_id=r.id AND c.mandatory=1 AND c.is_gap=1))
 THEN RAISE(ABORT,'COMPLIANCE_CONFLICT: reviewed clause matrix and current vendor validation required') END;
END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0016_tender_vendor_compliance.sql','p1-p2-integration');
INSERT INTO india_schema_migrations(version) VALUES(16);
