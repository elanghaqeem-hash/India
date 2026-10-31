-- Fail-closed controls: draft-only financial close; manual payment approval cannot execute a bank transfer.
CREATE TRIGGER india_erp_close_guard BEFORE INSERT ON india_gl_close_requests
WHEN NOT EXISTS(SELECT 1 FROM india_gl_periods p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.period_id
 AND p.legal_entity_id=NEW.legal_entity_id AND p.status='open'
 AND NOT EXISTS(SELECT 1 FROM india_gl_journals j WHERE j.tenant_id=p.tenant_id AND j.period_id=p.id AND j.status IN ('draft','approved')))
BEGIN SELECT RAISE(ABORT,'GL_CLOSE_UNPOSTED_JOURNALS'); END;
CREATE TRIGGER india_erp_reversal_guard BEFORE INSERT ON india_gl_reversal_requests
WHEN NOT EXISTS(SELECT 1 FROM india_gl_journals j JOIN india_gl_periods p
 ON p.tenant_id=j.tenant_id AND p.id=NEW.reversal_period_id AND p.legal_entity_id=j.legal_entity_id
 WHERE j.tenant_id=NEW.tenant_id AND j.id=NEW.original_journal_id AND j.status='posted' AND p.status='open')
BEGIN SELECT RAISE(ABORT,'REVERSAL_SOURCE_OR_PERIOD_INVALID'); END;
CREATE TRIGGER india_erp_payment_guard BEFORE INSERT ON india_erp_treasury_payment_requests
WHEN NOT EXISTS(SELECT 1 FROM india_ap_supplier_invoices i WHERE i.tenant_id=NEW.tenant_id
 AND i.id=NEW.ap_invoice_id AND i.status='approved' AND i.amount_cents=NEW.amount_cents)
BEGIN SELECT RAISE(ABORT,'PAYMENT_AP_NOT_APPROVED'); END;
CREATE TRIGGER india_erp_payment_no_delete BEFORE DELETE ON india_erp_treasury_payment_requests BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;
CREATE TRIGGER india_erp_payment_no_update BEFORE UPDATE ON india_erp_treasury_payment_requests
WHEN OLD.status NOT IN ('pending','approved','sent') OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.ap_invoice_id IS NOT OLD.ap_invoice_id OR NEW.amount_cents IS NOT OLD.amount_cents
 OR NEW.currency IS NOT OLD.currency OR NEW.beneficiary_reference IS NOT OLD.beneficiary_reference
 OR NEW.bank_account_token IS NOT OLD.bank_account_token OR NEW.bank_idempotency_key IS NOT OLD.bank_idempotency_key
 OR NEW.requested_by IS NOT OLD.requested_by
 OR NOT ((OLD.status='pending' AND NEW.status IN ('approved','rejected') AND NEW.approved_by IS NOT NULL AND lower(NEW.approved_by)!=lower(OLD.requested_by))
 OR (OLD.status='approved' AND NEW.status='sent' AND NEW.approved_by IS OLD.approved_by)
 OR (OLD.status='sent' AND NEW.status IN ('settled','failed') AND NEW.approved_by IS OLD.approved_by))
BEGIN SELECT RAISE(ABORT,'PAYMENT_TRANSITION_INVALID'); END;
CREATE TRIGGER india_erp_access_change_no_rewrite BEFORE INSERT ON india_erp_access_changes
WHEN NOT EXISTS(SELECT 1 FROM india_erp_org_units u JOIN india_members m
 ON lower(m.email)=lower(NEW.email) AND m.active=1 WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.unit_id AND u.active=1)
BEGIN SELECT RAISE(ABORT,'ACCESS_CHANGE_UNKNOWN_USER_OR_UNIT'); END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0039_erp_enterprise_guards.sql','erp-enterprise-controls');
INSERT INTO india_schema_migrations(version) VALUES(39);
