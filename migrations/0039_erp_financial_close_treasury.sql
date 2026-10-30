-- 0039 WP6 controlled period close, reversible journal linkage and treasury reconciliation.
CREATE TABLE india_gl_reversal_links(
 tenant_id TEXT NOT NULL,original_journal_id TEXT NOT NULL,reversal_journal_id TEXT NOT NULL,
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,original_journal_id),UNIQUE(tenant_id,reversal_journal_id),
 FOREIGN KEY(tenant_id,original_journal_id) REFERENCES india_gl_journals(tenant_id,id),
 FOREIGN KEY(tenant_id,reversal_journal_id) REFERENCES india_gl_journals(tenant_id,id),
 CHECK(original_journal_id!=reversal_journal_id)
);
CREATE TRIGGER india_gl_reversal_exact BEFORE INSERT ON india_gl_reversal_links
WHEN NOT EXISTS(
 SELECT 1 FROM india_gl_journals a JOIN india_gl_journals b
 ON a.tenant_id=b.tenant_id AND a.legal_entity_id=b.legal_entity_id
 WHERE a.id=NEW.original_journal_id AND b.id=NEW.reversal_journal_id AND a.tenant_id=NEW.tenant_id
 AND a.status='posted' AND b.status='draft' AND b.source_type='reversal'
 AND b.source_key=a.id AND
 (SELECT count(*) FROM india_gl_lines WHERE tenant_id=NEW.tenant_id AND journal_id=b.id)>=2
 AND NOT EXISTS(
 SELECT 1 FROM (
 SELECT account_id,sum(debit_cents) d,sum(credit_cents) c FROM india_gl_lines
 WHERE tenant_id=NEW.tenant_id AND journal_id=a.id GROUP BY account_id
 ) x LEFT JOIN (
 SELECT account_id,sum(debit_cents) d,sum(credit_cents) c FROM india_gl_lines
 WHERE tenant_id=NEW.tenant_id AND journal_id=b.id GROUP BY account_id
 ) y ON x.account_id=y.account_id
 WHERE y.account_id IS NULL OR x.d!=y.c OR x.c!=y.d
 )
 AND (SELECT count(DISTINCT account_id) FROM india_gl_lines WHERE tenant_id=NEW.tenant_id AND journal_id=a.id)=
 (SELECT count(DISTINCT account_id) FROM india_gl_lines WHERE tenant_id=NEW.tenant_id AND journal_id=b.id)
)
BEGIN SELECT RAISE(ABORT,'GL_REVERSAL_NOT_EXACT'); END;
CREATE TRIGGER india_gl_reversal_no_delete BEFORE DELETE ON india_gl_reversal_links BEGIN SELECT RAISE(ABORT,'GL_REVERSAL_IMMUTABLE'); END;
CREATE TRIGGER india_gl_reversal_no_update BEFORE UPDATE ON india_gl_reversal_links BEGIN SELECT RAISE(ABORT,'GL_REVERSAL_IMMUTABLE'); END;
CREATE TABLE india_gl_close_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,period_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 notes TEXT NOT NULL CHECK(length(notes) BETWEEN 12 AND 800),
 snapshot_debits INTEGER NOT NULL CHECK(snapshot_debits>=0),
 snapshot_credits INTEGER NOT NULL CHECK(snapshot_credits>=0),
 created_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 review_notes TEXT,version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,
 UNIQUE(tenant_id,period_id),FOREIGN KEY(tenant_id,period_id) REFERENCES india_gl_periods(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by)),
 CHECK(status='pending' OR (reviewed_by IS NOT NULL AND coalesce(length(review_notes),0)>=12))
);
CREATE TRIGGER india_gl_close_review BEFORE UPDATE ON india_gl_close_requests
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.period_id IS NOT OLD.period_id
 OR NEW.notes IS NOT OLD.notes OR NEW.snapshot_debits IS NOT OLD.snapshot_debits
 OR NEW.snapshot_credits IS NOT OLD.snapshot_credits OR NEW.created_by IS NOT OLD.created_by
 OR lower(NEW.reviewed_by)=lower(OLD.created_by)
BEGIN SELECT RAISE(ABORT,'GL_CLOSE_IMMUTABLE'); END;
CREATE TRIGGER india_gl_close_no_delete BEFORE DELETE ON india_gl_close_requests BEGIN SELECT RAISE(ABORT,'GL_CLOSE_IMMUTABLE'); END;
CREATE TRIGGER india_gl_close_apply AFTER UPDATE OF status ON india_gl_close_requests
WHEN NEW.status='approved' AND OLD.status='pending'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_gl_periods p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.period_id AND p.status='open') OR
 EXISTS(SELECT 1 FROM india_gl_journals j WHERE j.tenant_id=NEW.tenant_id AND j.period_id=NEW.period_id AND j.status IN ('draft','approved')) OR
 (SELECT coalesce(sum(l.debit_cents),0) FROM india_gl_lines l JOIN india_gl_journals j ON j.tenant_id=l.tenant_id AND j.id=l.journal_id
 WHERE j.tenant_id=NEW.tenant_id AND j.period_id=NEW.period_id AND j.status='posted')!=NEW.snapshot_debits OR
 (SELECT coalesce(sum(l.credit_cents),0) FROM india_gl_lines l JOIN india_gl_journals j ON j.tenant_id=l.tenant_id AND j.id=l.journal_id
 WHERE j.tenant_id=NEW.tenant_id AND j.period_id=NEW.period_id AND j.status='posted')!=NEW.snapshot_credits OR
 NEW.snapshot_debits!=NEW.snapshot_credits
 THEN RAISE(ABORT,'GL_CLOSE_RECONCILIATION') END;
 UPDATE india_gl_periods SET status='closed' WHERE tenant_id=NEW.tenant_id AND id=NEW.period_id AND status='open';
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'GL_CLOSE_CONFLICT') END;
END;
CREATE TRIGGER india_gl_close_period_direct BEFORE UPDATE OF status ON india_gl_periods
WHEN NEW.status='closed' AND NOT EXISTS(SELECT 1 FROM india_gl_close_requests c
 WHERE c.tenant_id=OLD.tenant_id AND c.period_id=OLD.id AND c.status='approved')
BEGIN SELECT RAISE(ABORT,'GL_CLOSE_APPROVAL_REQUIRED'); END;
CREATE TABLE india_treasury_accounts(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 bank_name TEXT NOT NULL,masked_number TEXT NOT NULL CHECK(length(masked_number) BETWEEN 4 AND 32),
 currency TEXT NOT NULL DEFAULT 'IDR' CHECK(currency='IDR'),
 gl_account_id TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by TEXT NOT NULL,UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 FOREIGN KEY(tenant_id,gl_account_id) REFERENCES india_gl_accounts(tenant_id,id)
);
CREATE TRIGGER india_treasury_bank_gl_guard BEFORE INSERT ON india_treasury_accounts
WHEN NOT EXISTS(SELECT 1 FROM india_gl_accounts g WHERE g.id=NEW.gl_account_id AND g.tenant_id=NEW.tenant_id AND g.legal_entity_id=NEW.legal_entity_id AND g.category='asset' AND g.active=1)
BEGIN SELECT RAISE(ABORT,'TREASURY_BANK_GL_INVALID'); END;
CREATE TABLE india_treasury_payments(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,ap_invoice_id TEXT NOT NULL,
 bank_account_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<900000000000000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','recorded','settled','rejected')),
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,recorded_by TEXT COLLATE NOCASE,settled_by TEXT COLLATE NOCASE,
 review_notes TEXT,bank_reference TEXT,bank_evidence_document_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,settled_at TEXT,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,bank_reference),
 FOREIGN KEY(tenant_id,ap_invoice_id) REFERENCES india_ap_supplier_invoices(tenant_id,id),
 FOREIGN KEY(tenant_id,bank_account_id) REFERENCES india_treasury_accounts(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by)),
 CHECK(status NOT IN ('approved','recorded','settled') OR (reviewed_by IS NOT NULL AND coalesce(length(review_notes),0)>=12)),
 CHECK(status NOT IN ('recorded','settled') OR (bank_reference IS NOT NULL AND bank_evidence_document_id IS NOT NULL))
);
CREATE TRIGGER india_treasury_payment_create BEFORE INSERT ON india_treasury_payments
WHEN NOT EXISTS(SELECT 1 FROM india_ap_supplier_invoices i
 JOIN india_purchase_orders p ON p.id=i.po_id AND p.tenant_id=i.tenant_id
 JOIN india_erp_opportunity_scopes s ON s.opportunity_id=p.opportunity_id AND s.tenant_id=p.tenant_id AND s.status='approved'
 JOIN india_treasury_accounts a ON a.tenant_id=s.tenant_id AND a.legal_entity_id=s.legal_entity_id
 WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.ap_invoice_id AND i.status='approved'
 AND s.legal_entity_id=NEW.legal_entity_id AND a.id=NEW.bank_account_id AND a.active=1
 AND (SELECT coalesce(sum(x.amount_cents),0) FROM india_treasury_payments x
 WHERE x.tenant_id=NEW.tenant_id AND x.ap_invoice_id=i.id AND x.status!='rejected')+NEW.amount_cents<=i.amount_cents)
BEGIN SELECT RAISE(ABORT,'TREASURY_AP_SCOPE_OR_LIMIT'); END;
CREATE TRIGGER india_treasury_payment_review BEFORE UPDATE ON india_treasury_payments
BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.legal_entity_id IS NOT OLD.legal_entity_id
 OR NEW.ap_invoice_id IS NOT OLD.ap_invoice_id OR NEW.bank_account_id IS NOT OLD.bank_account_id
 OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.created_by IS NOT OLD.created_by
 OR NEW.version!=OLD.version+1 OR NOT (
 (OLD.status='draft' AND NEW.status IN ('approved','rejected')) OR
 (OLD.status='approved' AND NEW.status='recorded') OR
 (OLD.status='recorded' AND NEW.status='settled')
 ) THEN RAISE(ABORT,'TREASURY_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status='recorded' AND (NEW.recorded_by IS NULL OR lower(NEW.recorded_by)=lower(NEW.created_by)
 OR lower(NEW.recorded_by)=lower(NEW.reviewed_by)) THEN RAISE(ABORT,'TREASURY_SOD') END;
 SELECT CASE WHEN NEW.status='settled' AND (NEW.settled_by IS NULL OR lower(NEW.settled_by)=lower(NEW.recorded_by)) THEN RAISE(ABORT,'TREASURY_SOD') END;
END;
CREATE TRIGGER india_treasury_payment_no_delete BEFORE DELETE ON india_treasury_payments BEGIN SELECT RAISE(ABORT,'TREASURY_IMMUTABLE'); END;
CREATE VIEW india_treasury_ap_outstanding AS SELECT i.tenant_id,i.id invoice_id,i.amount_cents,
 (SELECT coalesce(sum(p.amount_cents),0) FROM india_treasury_payments p WHERE p.tenant_id=i.tenant_id AND p.ap_invoice_id=i.id AND p.status='settled') settled_cents
 FROM india_ap_supplier_invoices i WHERE i.status='approved';
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0039_erp_financial_close_treasury.sql','erp-extensions');
INSERT INTO india_schema_migrations(version) VALUES(39);
