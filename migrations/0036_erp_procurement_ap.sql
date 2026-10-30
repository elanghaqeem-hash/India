-- WP7/WP6 controlled procure-to-pay extension built on canonical validated vendor offers.
-- No payment/GL posting or accounting tax rate is inferred.
CREATE TABLE india_purchase_orders (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,vendor_id TEXT NOT NULL,offer_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,
 po_number TEXT NOT NULL,qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 1000000),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>0 AND unit_price_cents<900000000000000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 review_notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,po_number),UNIQUE(tenant_id,offer_id),
 FOREIGN KEY(tenant_id,offer_id) REFERENCES india_vendor_offers(tenant_id,id),
 FOREIGN KEY(tenant_id,vendor_id) REFERENCES india_vendors(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by))
);
CREATE TRIGGER india_po_source BEFORE INSERT ON india_purchase_orders
WHEN NOT EXISTS(SELECT 1 FROM india_vendor_offers o JOIN india_vendors v
 ON v.tenant_id=o.tenant_id AND v.id=o.vendor_id
 WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.offer_id AND o.vendor_id=NEW.vendor_id AND o.opportunity_id=NEW.opportunity_id
 AND o.status='validated' AND v.status='validated' AND o.valid_until>=date('now') AND v.valid_until>=date('now')
 AND o.quantity>=NEW.qty AND abs(o.unit_price_idr*100-NEW.unit_price_cents)<1)
BEGIN SELECT RAISE(ABORT,'PO_SOURCE_INVALID'); END;
CREATE TRIGGER india_po_review BEFORE UPDATE ON india_purchase_orders
BEGIN
 SELECT CASE WHEN OLD.status!='draft' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.vendor_id IS NOT OLD.vendor_id
 OR NEW.offer_id IS NOT OLD.offer_id OR NEW.opportunity_id IS NOT OLD.opportunity_id
 OR NEW.po_number IS NOT OLD.po_number OR NEW.qty IS NOT OLD.qty OR NEW.unit_price_cents IS NOT OLD.unit_price_cents
 OR NEW.created_by IS NOT OLD.created_by OR lower(NEW.reviewed_by)=lower(OLD.created_by)
 THEN RAISE(ABORT,'PO_IMMUTABLE') END;
END;
CREATE TRIGGER india_po_no_delete BEFORE DELETE ON india_purchase_orders BEGIN SELECT RAISE(ABORT,'PO_IMMUTABLE'); END;
CREATE TABLE india_purchase_receipts (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,po_id TEXT NOT NULL,qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 1000000),
 evidence_document_id TEXT NOT NULL,received_by TEXT NOT NULL COLLATE NOCASE,
 received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,po_id,evidence_document_id),
 FOREIGN KEY(tenant_id,po_id) REFERENCES india_purchase_orders(tenant_id,id)
);
CREATE TRIGGER india_receipt_capacity BEFORE INSERT ON india_purchase_receipts
WHEN NOT EXISTS(SELECT 1 FROM india_purchase_orders p WHERE p.id=NEW.po_id AND p.tenant_id=NEW.tenant_id
 AND p.status='approved' AND lower(p.created_by)!=lower(NEW.received_by)
 AND (SELECT coalesce(sum(qty),0) FROM india_purchase_receipts r WHERE r.po_id=p.id AND r.tenant_id=p.tenant_id)+NEW.qty<=p.qty)
BEGIN SELECT RAISE(ABORT,'PO_OVER_RECEIPT'); END;
CREATE TRIGGER india_receipt_no_delete BEFORE DELETE ON india_purchase_receipts BEGIN SELECT RAISE(ABORT,'RECEIPT_IMMUTABLE'); END;
CREATE TRIGGER india_receipt_no_update BEFORE UPDATE ON india_purchase_receipts BEGIN SELECT RAISE(ABORT,'RECEIPT_IMMUTABLE'); END;
CREATE TABLE india_ap_supplier_invoices (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,po_id TEXT NOT NULL,vendor_id TEXT NOT NULL,
 supplier_invoice_number TEXT NOT NULL,qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 1000000),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<900000000000000),
 evidence_document_id TEXT NOT NULL,due_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL COLLATE NOCASE,
 reviewed_by TEXT COLLATE NOCASE,review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,vendor_id,supplier_invoice_number),
 FOREIGN KEY(tenant_id,po_id) REFERENCES india_purchase_orders(tenant_id,id),
 FOREIGN KEY(tenant_id,vendor_id) REFERENCES india_vendors(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by))
);
CREATE TRIGGER india_ap_match BEFORE INSERT ON india_ap_supplier_invoices
WHEN NOT EXISTS(SELECT 1 FROM india_purchase_orders p WHERE p.tenant_id=NEW.tenant_id
 AND p.id=NEW.po_id AND p.vendor_id=NEW.vendor_id AND p.status='approved'
 AND NEW.amount_cents=NEW.qty*p.unit_price_cents AND NEW.qty<=p.qty)
BEGIN SELECT RAISE(ABORT,'AP_PO_MISMATCH'); END;
CREATE TRIGGER india_ap_review BEFORE UPDATE ON india_ap_supplier_invoices
BEGIN
 SELECT CASE WHEN OLD.status!='draft' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.po_id IS NOT OLD.po_id
 OR NEW.vendor_id IS NOT OLD.vendor_id OR NEW.supplier_invoice_number IS NOT OLD.supplier_invoice_number
 OR NEW.qty IS NOT OLD.qty OR NEW.amount_cents IS NOT OLD.amount_cents
 OR NEW.evidence_document_id IS NOT OLD.evidence_document_id OR NEW.due_date IS NOT OLD.due_date
 OR NEW.created_by IS NOT OLD.created_by OR lower(NEW.reviewed_by)=lower(OLD.created_by)
 THEN RAISE(ABORT,'AP_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status='approved' AND NOT EXISTS(
 SELECT 1 FROM india_purchase_orders p
 WHERE p.id=NEW.po_id AND p.tenant_id=NEW.tenant_id AND p.status='approved'
 AND (SELECT coalesce(sum(r.qty),0) FROM india_purchase_receipts r WHERE r.po_id=p.id AND r.tenant_id=p.tenant_id)>=
 (SELECT coalesce(sum(i.qty),0) FROM india_ap_supplier_invoices i WHERE i.po_id=p.id AND i.tenant_id=p.tenant_id AND i.status='approved')+NEW.qty
 ) THEN RAISE(ABORT,'AP_THREE_WAY_MATCH') END;
END;
CREATE TRIGGER india_ap_no_delete BEFORE DELETE ON india_ap_supplier_invoices BEGIN SELECT RAISE(ABORT,'AP_IMMUTABLE'); END;
CREATE INDEX india_ap_aging ON india_ap_supplier_invoices(tenant_id,status,due_date);
INSERT INTO india_schema_file_manifest(path,source_branch)
VALUES('migrations/0036_erp_procurement_ap.sql','erp-procurement');
INSERT INTO india_schema_migrations(version) VALUES(36);
