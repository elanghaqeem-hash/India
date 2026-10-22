-- INDIA 0012: versioned Presales -> Proposal -> Submission -> Negotiation -> PO.
-- Existing evidence is retained, but is not grandfathered into a new approved release.
ALTER TABLE india_sales_opportunities ADD COLUMN flow_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE india_sales_submissions ADD COLUMN release_id TEXT REFERENCES india_sales_releases(id);
ALTER TABLE india_sales_award_documents ADD COLUMN release_id TEXT REFERENCES india_sales_releases(id);
ALTER TABLE india_sales_award_documents ADD COLUMN po_data_json TEXT;
ALTER TABLE india_sales_po_checks ADD COLUMN release_id TEXT REFERENCES india_sales_releases(id);
ALTER TABLE india_sales_po_checks ADD COLUMN award_id TEXT REFERENCES india_sales_award_documents(id);
CREATE TABLE india_sales_tx_guards(id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE india_sales_releases(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),
 status TEXT NOT NULL CHECK(status IN ('scoped','proposed','approved','superseded')),
 scope_snapshot TEXT NOT NULL CHECK(json_valid(scope_snapshot)),account_snapshot TEXT NOT NULL CHECK(json_valid(account_snapshot)),
 scope_notes TEXT NOT NULL,scoped_by TEXT NOT NULL,scoped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 proposal_snapshot TEXT CHECK(proposal_snapshot IS NULL OR json_valid(proposal_snapshot)),
 proposal_reference TEXT,proposal_sha256 TEXT,proposal_notes TEXT,proposed_by TEXT,proposed_at TEXT,
 boq_id TEXT REFERENCES india_boq(id),boq_version INTEGER,boq_edit_seq INTEGER,
 approved_by TEXT,approved_at TEXT,approval_notes TEXT,
 CHECK(status NOT IN ('proposed','approved') OR (proposed_by IS NOT NULL AND proposal_reference IS NOT NULL AND length(proposal_sha256)=64 AND boq_id IS NOT NULL AND boq_version IS NOT NULL AND boq_edit_seq IS NOT NULL)),
 CHECK(status!='approved' OR (approved_by IS NOT NULL AND lower(trim(approved_by))!=lower(trim(proposed_by)))),
 UNIQUE(tenant_id,opportunity_id,version),UNIQUE(tenant_id,boq_id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE UNIQUE INDEX idx_india_release_current ON india_sales_releases(tenant_id,opportunity_id) WHERE status!='superseded';
CREATE TABLE india_sales_negotiations(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,release_id TEXT NOT NULL REFERENCES india_sales_releases(id),
 submission_id TEXT NOT NULL REFERENCES india_sales_submissions(id),
 decision TEXT NOT NULL CHECK(decision IN ('pending','approved','rejected','revision_required')),
 amount_before_vat REAL NOT NULL CHECK(amount_before_vat>0 AND amount_before_vat<1e14),
 notes TEXT NOT NULL,evidence_reference TEXT NOT NULL,evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE INDEX idx_india_negotiation_release ON india_sales_negotiations(tenant_id,opportunity_id,release_id);
CREATE TRIGGER india_flow_version AFTER UPDATE OF title,estimated_value_idr,data_json,stage,company_id ON india_sales_opportunities
BEGIN UPDATE india_sales_opportunities SET flow_version=OLD.flow_version+1 WHERE id=NEW.id; END;
CREATE TRIGGER india_flow_material AFTER UPDATE OF title,estimated_value_idr,data_json,company_id ON india_sales_opportunities
WHEN OLD.stage NOT IN ('closed_won','closed_lost') AND (
 OLD.title!=NEW.title OR OLD.company_id!=NEW.company_id OR OLD.estimated_value_idr!=NEW.estimated_value_idr OR json_array(coalesce(json_extract(OLD.data_json,'$.service_family'),''),coalesce(json_extract(OLD.data_json,'$.contract_model'),''),coalesce(json_extract(OLD.data_json,'$.client_need'),''),coalesce(json_extract(OLD.data_json,'$.discovery_notes'),''),coalesce(json_extract(OLD.data_json,'$.technical_scope'),''),coalesce(json_extract(OLD.data_json,'$.technical_specifications'),''),coalesce(json_extract(OLD.data_json,'$.scope_quantity'),''),coalesce(json_extract(OLD.data_json,'$.service_level'),''),coalesce(json_extract(OLD.data_json,'$.delivery_model'),''),coalesce(json_extract(OLD.data_json,'$.resourcing_model'),''),coalesce(json_extract(OLD.data_json,'$.deliverables'),''),coalesce(json_extract(OLD.data_json,'$.project_site'),''),coalesce(json_extract(OLD.data_json,'$.project_province'),''),coalesce(json_extract(OLD.data_json,'$.project_postal'),''),coalesce(json_extract(OLD.data_json,'$.project_pic_name'),''),coalesce(json_extract(OLD.data_json,'$.project_pic_phone'),''),coalesce(json_extract(OLD.data_json,'$.project_pic_email'),''),coalesce(json_extract(OLD.data_json,'$.implementation_timeline'),''),coalesce(json_extract(OLD.data_json,'$.contract_duration'),''),coalesce(json_extract(OLD.data_json,'$.license_or_sku'),''),coalesce(json_extract(OLD.data_json,'$.asset_profile'),''),coalesce(json_extract(OLD.data_json,'$.boq_id'),''),coalesce(json_extract(OLD.data_json,'$.quotation_number'),''),coalesce(json_extract(OLD.data_json,'$.quotation_sent_at'),''),coalesce(json_extract(OLD.data_json,'$.quotation_valid_days'),''),coalesce(json_extract(OLD.data_json,'$.quotation_valid_until'),''),coalesce(json_extract(OLD.data_json,'$.quotation_terms'),''),coalesce(json_extract(OLD.data_json,'$.quotation_payment_notes'),''),coalesce(json_extract(OLD.data_json,'$.end_user'),''),coalesce(json_extract(OLD.data_json,'$.quotation_to_pic'),''),coalesce(json_extract(OLD.data_json,'$.quotation_sender_name'),''),coalesce(json_extract(OLD.data_json,'$.quotation_sender_title'),''),coalesce(json_extract(OLD.data_json,'$.methodology'),''),coalesce(json_extract(OLD.data_json,'$.exclusions'),''),coalesce(json_extract(OLD.data_json,'$.team_composition'),''),coalesce(json_extract(OLD.data_json,'$.payment_terms'),''),coalesce(json_extract(OLD.data_json,'$.payment_va'),''),coalesce(json_extract(OLD.data_json,'$.payment_milestones'),''))!=json_array(coalesce(json_extract(NEW.data_json,'$.service_family'),''),coalesce(json_extract(NEW.data_json,'$.contract_model'),''),coalesce(json_extract(NEW.data_json,'$.client_need'),''),coalesce(json_extract(NEW.data_json,'$.discovery_notes'),''),coalesce(json_extract(NEW.data_json,'$.technical_scope'),''),coalesce(json_extract(NEW.data_json,'$.technical_specifications'),''),coalesce(json_extract(NEW.data_json,'$.scope_quantity'),''),coalesce(json_extract(NEW.data_json,'$.service_level'),''),coalesce(json_extract(NEW.data_json,'$.delivery_model'),''),coalesce(json_extract(NEW.data_json,'$.resourcing_model'),''),coalesce(json_extract(NEW.data_json,'$.deliverables'),''),coalesce(json_extract(NEW.data_json,'$.project_site'),''),coalesce(json_extract(NEW.data_json,'$.project_province'),''),coalesce(json_extract(NEW.data_json,'$.project_postal'),''),coalesce(json_extract(NEW.data_json,'$.project_pic_name'),''),coalesce(json_extract(NEW.data_json,'$.project_pic_phone'),''),coalesce(json_extract(NEW.data_json,'$.project_pic_email'),''),coalesce(json_extract(NEW.data_json,'$.implementation_timeline'),''),coalesce(json_extract(NEW.data_json,'$.contract_duration'),''),coalesce(json_extract(NEW.data_json,'$.license_or_sku'),''),coalesce(json_extract(NEW.data_json,'$.asset_profile'),''),coalesce(json_extract(NEW.data_json,'$.boq_id'),''),coalesce(json_extract(NEW.data_json,'$.quotation_number'),''),coalesce(json_extract(NEW.data_json,'$.quotation_sent_at'),''),coalesce(json_extract(NEW.data_json,'$.quotation_valid_days'),''),coalesce(json_extract(NEW.data_json,'$.quotation_valid_until'),''),coalesce(json_extract(NEW.data_json,'$.quotation_terms'),''),coalesce(json_extract(NEW.data_json,'$.quotation_payment_notes'),''),coalesce(json_extract(NEW.data_json,'$.end_user'),''),coalesce(json_extract(NEW.data_json,'$.quotation_to_pic'),''),coalesce(json_extract(NEW.data_json,'$.quotation_sender_name'),''),coalesce(json_extract(NEW.data_json,'$.quotation_sender_title'),''),coalesce(json_extract(NEW.data_json,'$.methodology'),''),coalesce(json_extract(NEW.data_json,'$.exclusions'),''),coalesce(json_extract(NEW.data_json,'$.team_composition'),''),coalesce(json_extract(NEW.data_json,'$.payment_terms'),''),coalesce(json_extract(NEW.data_json,'$.payment_va'),''),coalesce(json_extract(NEW.data_json,'$.payment_milestones'),'')))
BEGIN
 UPDATE india_sales_releases SET status='superseded' WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id AND (status IN ('proposed','approved') OR (status='scoped' AND (OLD.title!=NEW.title OR OLD.company_id!=NEW.company_id OR json_array(coalesce(json_extract(OLD.data_json,'$.service_family'),''),coalesce(json_extract(OLD.data_json,'$.contract_model'),''),coalesce(json_extract(OLD.data_json,'$.client_need'),''),coalesce(json_extract(OLD.data_json,'$.discovery_notes'),''),coalesce(json_extract(OLD.data_json,'$.technical_scope'),''),coalesce(json_extract(OLD.data_json,'$.technical_specifications'),''),coalesce(json_extract(OLD.data_json,'$.scope_quantity'),''),coalesce(json_extract(OLD.data_json,'$.service_level'),''),coalesce(json_extract(OLD.data_json,'$.delivery_model'),''),coalesce(json_extract(OLD.data_json,'$.resourcing_model'),''),coalesce(json_extract(OLD.data_json,'$.deliverables'),''),coalesce(json_extract(OLD.data_json,'$.project_site'),''),coalesce(json_extract(OLD.data_json,'$.project_province'),''),coalesce(json_extract(OLD.data_json,'$.project_postal'),''),coalesce(json_extract(OLD.data_json,'$.project_pic_name'),''),coalesce(json_extract(OLD.data_json,'$.project_pic_phone'),''),coalesce(json_extract(OLD.data_json,'$.project_pic_email'),''),coalesce(json_extract(OLD.data_json,'$.implementation_timeline'),''),coalesce(json_extract(OLD.data_json,'$.contract_duration'),''),coalesce(json_extract(OLD.data_json,'$.license_or_sku'),''),coalesce(json_extract(OLD.data_json,'$.asset_profile'),''),coalesce(json_extract(OLD.data_json,'$.end_user'),''),coalesce(json_extract(OLD.data_json,'$.methodology'),''),coalesce(json_extract(OLD.data_json,'$.exclusions'),''),coalesce(json_extract(OLD.data_json,'$.team_composition'),''))!=json_array(coalesce(json_extract(NEW.data_json,'$.service_family'),''),coalesce(json_extract(NEW.data_json,'$.contract_model'),''),coalesce(json_extract(NEW.data_json,'$.client_need'),''),coalesce(json_extract(NEW.data_json,'$.discovery_notes'),''),coalesce(json_extract(NEW.data_json,'$.technical_scope'),''),coalesce(json_extract(NEW.data_json,'$.technical_specifications'),''),coalesce(json_extract(NEW.data_json,'$.scope_quantity'),''),coalesce(json_extract(NEW.data_json,'$.service_level'),''),coalesce(json_extract(NEW.data_json,'$.delivery_model'),''),coalesce(json_extract(NEW.data_json,'$.resourcing_model'),''),coalesce(json_extract(NEW.data_json,'$.deliverables'),''),coalesce(json_extract(NEW.data_json,'$.project_site'),''),coalesce(json_extract(NEW.data_json,'$.project_province'),''),coalesce(json_extract(NEW.data_json,'$.project_postal'),''),coalesce(json_extract(NEW.data_json,'$.project_pic_name'),''),coalesce(json_extract(NEW.data_json,'$.project_pic_phone'),''),coalesce(json_extract(NEW.data_json,'$.project_pic_email'),''),coalesce(json_extract(NEW.data_json,'$.implementation_timeline'),''),coalesce(json_extract(NEW.data_json,'$.contract_duration'),''),coalesce(json_extract(NEW.data_json,'$.license_or_sku'),''),coalesce(json_extract(NEW.data_json,'$.asset_profile'),''),coalesce(json_extract(NEW.data_json,'$.end_user'),''),coalesce(json_extract(NEW.data_json,'$.methodology'),''),coalesce(json_extract(NEW.data_json,'$.exclusions'),''),coalesce(json_extract(NEW.data_json,'$.team_composition'),'')))));
 UPDATE india_sales_submissions SET status='superseded' WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id AND status IN ('reported','verified');
 DELETE FROM india_sales_po_checks WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id;
 UPDATE india_sales_opportunities SET stage='solution_design' WHERE id=NEW.id AND stage IN ('commercial_review','quotation_sent','negotiation','pending_po');
END;
CREATE TRIGGER india_flow_po_edit AFTER UPDATE OF data_json ON india_sales_opportunities
WHEN json_array(json_extract(OLD.data_json,'$.po_number'),json_extract(OLD.data_json,'$.po_date'),json_extract(OLD.data_json,'$.po_reference'),json_extract(OLD.data_json,'$.po_amount_before_vat'),json_extract(OLD.data_json,'$.scope_reconciliation'))
 IS NOT json_array(json_extract(NEW.data_json,'$.po_number'),json_extract(NEW.data_json,'$.po_date'),json_extract(NEW.data_json,'$.po_reference'),json_extract(NEW.data_json,'$.po_amount_before_vat'),json_extract(NEW.data_json,'$.scope_reconciliation'))
BEGIN DELETE FROM india_sales_po_checks WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id; END;
CREATE TRIGGER india_flow_account AFTER UPDATE OF legal_name,data_json ON india_sales_accounts
WHEN OLD.legal_name!=NEW.legal_name OR OLD.data_json!=NEW.data_json
BEGIN
 UPDATE india_sales_releases SET status='superseded' WHERE tenant_id=NEW.tenant_id AND opportunity_id IN (SELECT id FROM india_sales_opportunities WHERE company_id=NEW.id AND stage NOT IN ('closed_won','closed_lost')) AND status!='superseded';
 UPDATE india_sales_submissions SET status='superseded' WHERE tenant_id=NEW.tenant_id AND opportunity_id IN (SELECT id FROM india_sales_opportunities WHERE company_id=NEW.id AND stage NOT IN ('closed_won','closed_lost')) AND status IN ('reported','verified');
 DELETE FROM india_sales_po_checks WHERE tenant_id=NEW.tenant_id AND opportunity_id IN (SELECT id FROM india_sales_opportunities WHERE company_id=NEW.id AND stage NOT IN ('closed_won','closed_lost'));
 UPDATE india_sales_opportunities SET stage='solution_design' WHERE company_id=NEW.id AND stage IN ('commercial_review','quotation_sent','negotiation','pending_po');
END;
CREATE TRIGGER india_flow_boq AFTER UPDATE ON india_boq
WHEN OLD.status='approved' AND (NEW.status!=OLD.status OR NEW.edit_seq!=OLD.edit_seq OR NEW.line_items_json!=OLD.line_items_json OR NEW.payment_terms!=OLD.payment_terms OR NEW.vat_rate!=OLD.vat_rate)
BEGIN
 UPDATE india_sales_releases SET status='superseded' WHERE boq_id=NEW.id AND status!='superseded';
 UPDATE india_sales_submissions SET status='superseded' WHERE boq_id=NEW.id AND status IN ('reported','verified');
 DELETE FROM india_sales_po_checks WHERE boq_id=NEW.id;
 UPDATE india_sales_opportunities SET stage='solution_design' WHERE id=NEW.opportunity_id AND stage IN ('commercial_review','quotation_sent','negotiation','pending_po');
END;
CREATE TRIGGER india_flow_release_update BEFORE UPDATE ON india_sales_releases
WHEN NOT (
 (OLD.status='scoped' AND NEW.status='proposed') OR
 (OLD.status='proposed' AND NEW.status='approved') OR
 (OLD.status IN ('scoped','proposed','approved') AND NEW.status='superseded'))
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: release is immutable; create a revision'); END;
CREATE TRIGGER india_flow_release_delete BEFORE DELETE ON india_sales_releases
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: release history is immutable'); END;
CREATE TRIGGER india_flow_negotiation_immutable BEFORE UPDATE ON india_sales_negotiations
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: negotiation history is immutable'); END;
CREATE TRIGGER india_flow_negotiation_delete BEFORE DELETE ON india_sales_negotiations
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: negotiation history is immutable'); END;
CREATE TRIGGER india_flow_submission_insert BEFORE INSERT ON india_sales_submissions
WHEN NOT EXISTS(SELECT 1 FROM india_sales_releases r JOIN india_boq b ON b.id=r.boq_id
 WHERE r.id=NEW.release_id AND r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.opportunity_id AND r.status='approved'
 AND r.boq_id=NEW.boq_id AND r.boq_version=NEW.boq_version AND b.edit_seq=r.boq_edit_seq AND b.status='approved' AND b.quotation_number=NEW.quotation_number)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: approved proposal release required'); END;
CREATE TRIGGER india_flow_submission_review BEFORE UPDATE OF status ON india_sales_submissions
WHEN NEW.status='verified' AND (lower(trim(NEW.created_by))=lower(trim(NEW.verified_by)) OR NOT EXISTS(
 SELECT 1 FROM india_sales_releases r WHERE r.id=NEW.release_id AND r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.opportunity_id AND r.status='approved'))
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: stale submission or maker checker violation'); END;
CREATE TRIGGER india_flow_award_insert BEFORE INSERT ON india_sales_award_documents
WHEN NOT EXISTS(SELECT 1 FROM india_sales_releases r WHERE r.id=NEW.release_id AND r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.opportunity_id AND r.status='approved')
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: current proposal release required for award'); END;
CREATE TRIGGER india_flow_award_review BEFORE UPDATE ON india_sales_award_documents
WHEN NOT EXISTS(SELECT 1 FROM india_sales_releases r WHERE r.id=NEW.release_id AND r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.opportunity_id AND r.status='approved')
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: award belongs to superseded release'); END;
CREATE TRIGGER india_flow_po_insert BEFORE INSERT ON india_sales_po_checks
WHEN NOT EXISTS(
 SELECT 1 FROM india_sales_opportunities d
 JOIN india_sales_releases r ON r.opportunity_id=d.id AND r.tenant_id=d.tenant_id
 JOIN india_boq b ON b.id=r.boq_id AND b.edit_seq=r.boq_edit_seq
 JOIN india_sales_award_documents a ON a.id=NEW.award_id AND a.release_id=r.id AND a.tenant_id=d.tenant_id AND a.opportunity_id=d.id
 JOIN india_sales_negotiations n ON n.release_id=r.id
 JOIN india_sales_submissions sub ON sub.id=n.submission_id AND sub.release_id=r.id AND sub.status='verified'
 WHERE d.id=NEW.opportunity_id AND d.tenant_id=NEW.tenant_id AND d.stage='pending_po' AND r.id=NEW.release_id AND r.status='approved'
 AND b.id=NEW.boq_id AND b.status='approved' AND b.id=json_extract(d.data_json,'$.boq_id')
 AND n.decision='approved' AND n.rowid=(SELECT max(n2.rowid) FROM india_sales_negotiations n2 WHERE n2.release_id=r.id)
 AND abs(n.amount_before_vat-NEW.po_amount_before_vat)<0.01 AND abs(NEW.quotation_amount_before_vat-NEW.po_amount_before_vat)<0.01
 AND lower(trim(d.created_by))!=lower(trim(NEW.verified_by))
 AND a.document_kind IN ('po','spk') AND a.document_number=NEW.po_number COLLATE NOCASE
 AND a.finance_reviewed_by IS NOT NULL AND a.legal_reviewed_by IS NOT NULL
 AND lower(trim(a.finance_reviewed_by))!=lower(trim(a.legal_reviewed_by))
 AND a.po_data_json=json_object('po_number',coalesce(json_extract(d.data_json,'$.po_number'),''),'po_date',coalesce(json_extract(d.data_json,'$.po_date'),''),'po_reference',coalesce(json_extract(d.data_json,'$.po_reference'),''),'po_amount_before_vat',coalesce(json_extract(d.data_json,'$.po_amount_before_vat'),''),'scope_reconciliation',coalesce(json_extract(d.data_json,'$.scope_reconciliation'),''))
 AND NEW.po_number=json_extract(d.data_json,'$.po_number') AND NEW.po_date=json_extract(d.data_json,'$.po_date') AND NEW.po_reference=json_extract(d.data_json,'$.po_reference')
)
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: PO must match current release, approved negotiation and independently reviewed original'); END;
CREATE TRIGGER india_flow_stage BEFORE UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage!=OLD.stage AND NEW.stage IN ('commercial_review','quotation_sent','negotiation','pending_po','closed_won')
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_sales_releases r WHERE r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.id
 AND (NEW.stage='commercial_review' AND r.status IN ('proposed','approved') OR NEW.stage!='commercial_review' AND r.status='approved'))
 THEN RAISE(ABORT,'FLOW_CONFLICT: scope and proposal approval required') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_sales_releases r JOIN india_boq b ON b.id=r.boq_id WHERE r.tenant_id=NEW.tenant_id AND r.opportunity_id=NEW.id AND r.status IN ('proposed','approved') AND b.status='approved' AND b.edit_seq=r.boq_edit_seq AND b.id=json_extract(NEW.data_json,'$.boq_id') AND b.quotation_number=json_extract(NEW.data_json,'$.quotation_number')) THEN RAISE(ABORT,'FLOW_CONFLICT: selected BoQ must match proposal release') END;
 SELECT CASE WHEN NEW.stage IN ('negotiation','pending_po','closed_won') AND NOT EXISTS(
 SELECT 1 FROM india_sales_submissions s JOIN india_sales_releases r ON r.id=s.release_id
 WHERE s.tenant_id=NEW.tenant_id AND s.opportunity_id=NEW.id AND s.status='verified' AND r.status='approved')
 THEN RAISE(ABORT,'FLOW_CONFLICT: verified submission of current release required') END;
 SELECT CASE WHEN NEW.stage IN ('pending_po','closed_won') AND NOT EXISTS(
 SELECT 1 FROM india_sales_negotiations n JOIN india_sales_releases r ON r.id=n.release_id
 WHERE n.tenant_id=NEW.tenant_id AND n.opportunity_id=NEW.id AND r.status='approved' AND n.decision='approved'
 AND n.rowid=(SELECT max(n2.rowid) FROM india_sales_negotiations n2 WHERE n2.release_id=r.id))
 THEN RAISE(ABORT,'FLOW_CONFLICT: latest customer negotiation must be approved') END;
 SELECT CASE WHEN NEW.stage='closed_won' AND NOT EXISTS(
 SELECT 1 FROM india_sales_po_checks p JOIN india_sales_releases r ON r.id=p.release_id JOIN india_sales_award_documents a ON a.id=p.award_id
 WHERE p.tenant_id=NEW.tenant_id AND p.opportunity_id=NEW.id AND r.status='approved' AND a.release_id=r.id
 AND a.finance_reviewed_by IS NOT NULL AND a.legal_reviewed_by IS NOT NULL)
 THEN RAISE(ABORT,'FLOW_CONFLICT: current release PO with Finance and Legal review required') END;
END;
INSERT INTO india_schema_migrations(version) VALUES(12);

CREATE TRIGGER india_flow_lost AFTER UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage='closed_lost' AND OLD.stage!='closed_lost'
BEGIN
 UPDATE india_sales_releases SET status='superseded' WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id AND status!='superseded';
 UPDATE india_sales_submissions SET status='superseded' WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id AND status IN ('reported','verified');
 DELETE FROM india_sales_po_checks WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id;
END;

-- Preserve every invalidated/replaced PO verification, including its original reviewer.
CREATE TABLE india_sales_po_check_history(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER india_flow_po_archive_delete BEFORE DELETE ON india_sales_po_checks
BEGIN INSERT INTO india_sales_po_check_history(id,tenant_id,opportunity_id,snapshot_json)
 VALUES(lower(hex(randomblob(16))),OLD.tenant_id,OLD.opportunity_id,json_object('boq_id',OLD.boq_id,'release_id',OLD.release_id,'award_id',OLD.award_id,'po_number',OLD.po_number,'po_date',OLD.po_date,'po_reference',OLD.po_reference,'po_amount_before_vat',OLD.po_amount_before_vat,'quotation_amount_before_vat',OLD.quotation_amount_before_vat,'verified_by',OLD.verified_by,'verified_at',OLD.verified_at)); END;
CREATE TRIGGER india_flow_po_archive_update BEFORE UPDATE ON india_sales_po_checks
BEGIN INSERT INTO india_sales_po_check_history(id,tenant_id,opportunity_id,snapshot_json)
 VALUES(lower(hex(randomblob(16))),OLD.tenant_id,OLD.opportunity_id,json_object('boq_id',OLD.boq_id,'release_id',OLD.release_id,'award_id',OLD.award_id,'po_number',OLD.po_number,'po_date',OLD.po_date,'po_reference',OLD.po_reference,'po_amount_before_vat',OLD.po_amount_before_vat,'quotation_amount_before_vat',OLD.quotation_amount_before_vat,'verified_by',OLD.verified_by,'verified_at',OLD.verified_at)); END;
CREATE TRIGGER india_flow_po_history_update BEFORE UPDATE ON india_sales_po_check_history
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: PO check history is immutable'); END;
CREATE TRIGGER india_flow_po_history_delete BEFORE DELETE ON india_sales_po_check_history
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: PO check history is immutable'); END;
CREATE UNIQUE INDEX idx_india_award_original ON india_sales_award_documents(tenant_id,opportunity_id,release_id,document_kind,document_number,original_sha256);
-- Existing open offers need technical/commercial revalidation; do not fabricate approvals.
INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,from_stage,to_stage,actor_email,summary)
 SELECT lower(hex(randomblob(16))),tenant_id,'deal',id,'FLOW_REVALIDATION_REQUIRED',stage,'solution_design','schema-migration-0012','Existing offer retained; revalidate Presales, Proposal, submission and negotiation under a versioned release'
 FROM india_sales_opportunities WHERE stage IN ('commercial_review','quotation_sent','negotiation','pending_po');
UPDATE india_sales_opportunities SET stage='solution_design' WHERE stage IN ('commercial_review','quotation_sent','negotiation','pending_po');
UPDATE india_sales_submissions SET status='superseded' WHERE release_id IS NULL AND status IN ('reported','verified') AND opportunity_id IN (SELECT id FROM india_sales_opportunities WHERE stage NOT IN ('closed_won','closed_lost'));
