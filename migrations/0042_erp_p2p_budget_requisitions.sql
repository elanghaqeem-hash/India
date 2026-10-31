-- 0040 P2P extension: requisition, independent approval, controlled sourcing and committed budget.
-- Existing approved vendor offer→PO flow stays compatible until transition signoff.
CREATE TABLE india_procurement_budgets(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 period TEXT NOT NULL CHECK(period GLOB '20[0-9][0-9]-[0-1][0-9]'),
 code TEXT NOT NULL,limit_cents INTEGER NOT NULL CHECK(limit_cents>0 AND limit_cents<9000000000000000),
 created_by TEXT NOT NULL,approved_by TEXT,approved_at TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,legal_entity_id,period,code),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(status!='approved' OR (approved_by IS NOT NULL AND lower(approved_by)!=lower(created_by)))
);
CREATE TRIGGER india_proc_budget_review BEFORE UPDATE ON india_procurement_budgets
WHEN OLD.status!='draft' OR NEW.status!='approved' OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.legal_entity_id IS NOT OLD.legal_entity_id OR NEW.period IS NOT OLD.period
 OR NEW.code IS NOT OLD.code OR NEW.limit_cents IS NOT OLD.limit_cents OR NEW.created_by IS NOT OLD.created_by
 OR lower(NEW.approved_by)=lower(OLD.created_by)
BEGIN SELECT RAISE(ABORT,'BUDGET_IMMUTABLE'); END;
CREATE TABLE india_procurement_requisitions(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,
 budget_id TEXT NOT NULL,request_number TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 8 AND 180),
 qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 1000000),
 ceiling_cents INTEGER NOT NULL CHECK(ceiling_cents>0 AND ceiling_cents<900000000000000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 review_notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,request_number),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,budget_id) REFERENCES india_procurement_budgets(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by)),
 CHECK(status='draft' OR (reviewed_by IS NOT NULL AND coalesce(length(review_notes),0)>=12))
);
CREATE TRIGGER india_proc_requisition_source BEFORE INSERT ON india_procurement_requisitions
WHEN NOT EXISTS(SELECT 1 FROM india_procurement_budgets b
 JOIN india_erp_opportunity_scopes s ON s.tenant_id=b.tenant_id AND s.legal_entity_id=b.legal_entity_id
 WHERE b.id=NEW.budget_id AND b.tenant_id=NEW.tenant_id AND b.status='approved'
 AND s.opportunity_id=NEW.opportunity_id AND s.status='approved'
 AND b.limit_cents>=NEW.ceiling_cents)
BEGIN SELECT RAISE(ABORT,'REQUISITION_NO_BUDGET'); END;
CREATE TRIGGER india_proc_requisition_review BEFORE UPDATE ON india_procurement_requisitions
WHEN OLD.status!='draft' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.opportunity_id IS NOT OLD.opportunity_id
 OR NEW.budget_id IS NOT OLD.budget_id OR NEW.qty IS NOT OLD.qty OR NEW.ceiling_cents IS NOT OLD.ceiling_cents
 OR NEW.request_number IS NOT OLD.request_number OR NEW.title IS NOT OLD.title
 OR NEW.created_by IS NOT OLD.created_by OR lower(NEW.reviewed_by)=lower(OLD.created_by)
BEGIN SELECT RAISE(ABORT,'REQUISITION_IMMUTABLE'); END;
CREATE TABLE india_procurement_commitments(
 tenant_id TEXT NOT NULL,requisition_id TEXT NOT NULL,po_id TEXT NOT NULL,
 created_by TEXT NOT NULL,PRIMARY KEY(tenant_id,requisition_id),
 UNIQUE(tenant_id,po_id),
 FOREIGN KEY(tenant_id,requisition_id) REFERENCES india_procurement_requisitions(tenant_id,id),
 FOREIGN KEY(tenant_id,po_id) REFERENCES india_purchase_orders(tenant_id,id)
);
CREATE TRIGGER india_proc_commitment_validate BEFORE INSERT ON india_procurement_commitments
WHEN NOT EXISTS(SELECT 1 FROM india_procurement_requisitions r
 JOIN india_purchase_orders p ON p.tenant_id=r.tenant_id AND p.opportunity_id=r.opportunity_id
 JOIN india_procurement_budgets b ON b.tenant_id=r.tenant_id AND b.id=r.budget_id
 WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.requisition_id AND r.status='approved' AND p.id=NEW.po_id
 AND p.qty<=r.qty AND p.qty*p.unit_price_cents<=r.ceiling_cents
 AND (SELECT coalesce(sum(pr.ceiling_cents),0) FROM india_procurement_requisitions pr
 JOIN india_procurement_commitments cm ON cm.tenant_id=pr.tenant_id AND cm.requisition_id=pr.id
 WHERE pr.tenant_id=r.tenant_id AND pr.budget_id=r.budget_id)+r.ceiling_cents<=b.limit_cents)
BEGIN SELECT RAISE(ABORT,'P2P_COMMITMENT_BUDGET'); END;
CREATE TRIGGER india_proc_commitment_no_delete BEFORE DELETE ON india_procurement_commitments BEGIN SELECT RAISE(ABORT,'P2P_COMMITMENT_IMMUTABLE'); END;
CREATE VIEW india_procurement_budget_usage AS SELECT b.tenant_id,b.id budget_id,b.limit_cents,
 coalesce((SELECT sum(r.ceiling_cents) FROM india_procurement_requisitions r
 JOIN india_procurement_commitments c ON c.tenant_id=r.tenant_id AND c.requisition_id=r.id
 WHERE r.budget_id=b.id AND r.tenant_id=b.tenant_id),0) committed_cents
 FROM india_procurement_budgets b;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0042_erp_p2p_budget_requisitions.sql','erp-extensions');
INSERT INTO india_schema_migrations(version) VALUES(42);
