-- Internal reconciled revenue register; does not post to an external accounting system.
CREATE TABLE india_sales_revenue(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,release_id TEXT NOT NULL REFERENCES india_sales_releases(id),
 recognition_date TEXT NOT NULL,amount_before_vat REAL NOT NULL CHECK(amount_before_vat!=0 AND abs(amount_before_vat)<1e14),
 ledger_reference TEXT NOT NULL,invoice_reference TEXT NOT NULL,acceptance_reference TEXT NOT NULL,
 evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),notes TEXT NOT NULL,
 reversal_of TEXT REFERENCES india_sales_revenue(id),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 created_by TEXT NOT NULL,reviewed_by TEXT,review_notes TEXT,reviewed_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,ledger_reference),FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 CHECK((reversal_of IS NULL AND amount_before_vat>0) OR (reversal_of IS NOT NULL AND amount_before_vat<0)),
 CHECK(status!='approved' OR (reviewed_by IS NOT NULL AND lower(created_by)!=lower(reviewed_by)))
);
CREATE UNIQUE INDEX india_revenue_reversal ON india_sales_revenue(reversal_of) WHERE reversal_of IS NOT NULL AND status!='rejected';
CREATE INDEX india_revenue_period ON india_sales_revenue(tenant_id,status,recognition_date,opportunity_id);
CREATE TRIGGER india_revenue_frozen BEFORE UPDATE ON india_sales_revenue WHEN OLD.status!='draft'
BEGIN SELECT RAISE(ABORT,'REVENUE_CONFLICT: approved/rejected records are immutable'); END;
CREATE TRIGGER india_revenue_no_delete BEFORE DELETE ON india_sales_revenue
BEGIN SELECT RAISE(ABORT,'REVENUE_CONFLICT: use a reviewed reversal'); END;
CREATE TRIGGER india_revenue_approve BEFORE UPDATE OF status ON india_sales_revenue WHEN NEW.status='approved'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_sales_opportunities d JOIN india_sales_po_checks p ON p.tenant_id=d.tenant_id AND p.opportunity_id=d.id
 JOIN india_sales_releases r ON r.id=p.release_id AND r.status='approved' JOIN india_sales_award_documents a ON a.id=p.award_id AND a.release_id=r.id
 WHERE d.id=NEW.opportunity_id AND d.tenant_id=NEW.tenant_id AND d.stage='closed_won' AND r.id=NEW.release_id
 AND a.finance_reviewed_by IS NOT NULL AND a.legal_reviewed_by IS NOT NULL AND lower(a.finance_reviewed_by)!=lower(a.legal_reviewed_by)
 AND (SELECT coalesce(sum(x.amount_before_vat),0) FROM india_sales_revenue x WHERE x.tenant_id=NEW.tenant_id AND x.opportunity_id=NEW.opportunity_id AND x.status='approved')+NEW.amount_before_vat BETWEEN 0 AND p.po_amount_before_vat+0.001)
 THEN RAISE(ABORT,'REVENUE_CONFLICT: verified Closed Won PO required; cumulative recognition exceeds PO') END;
 SELECT CASE WHEN NEW.reversal_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM india_sales_revenue x WHERE x.id=NEW.reversal_of
 AND x.tenant_id=NEW.tenant_id AND x.opportunity_id=NEW.opportunity_id AND x.release_id=NEW.release_id AND x.status='approved'
 AND x.reversal_of IS NULL AND abs(x.amount_before_vat+NEW.amount_before_vat)<0.001)
 THEN RAISE(ABORT,'REVENUE_CONFLICT: reversal must exactly offset its approved source') END;
END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0019_verified_revenue.sql','p1-p2-integration');
INSERT INTO india_schema_migrations(version) VALUES(19);
