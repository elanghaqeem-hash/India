-- v3.0-RTI: policy runtime (legacy unit map, decision log) and transactional outbox for the posting worker.
-- Outbox events are written by triggers inside the same D1 transaction as the approved source document, and only
-- when the project's legal entity is mapped to the v3 organization model. The worker posts them to india_gl_*.
CREATE TABLE india_org_unit_legacy_map(
 tenant_id TEXT NOT NULL,legacy_unit_id TEXT NOT NULL,org_unit_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 maker TEXT NOT NULL COLLATE NOCASE,checker TEXT COLLATE NOCASE,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(tenant_id,legacy_unit_id),
 FOREIGN KEY(tenant_id,legacy_unit_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(checker IS NULL OR lower(checker)!=lower(maker)),CHECK(status='pending' OR checker IS NOT NULL)
);
CREATE TRIGGER india_org_unit_legacy_map_target BEFORE INSERT ON india_org_unit_legacy_map
WHEN NOT EXISTS(SELECT 1 FROM india_org_units_v u WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.org_unit_id AND u.valid_to IS NULL AND u.status='active')
 OR NOT EXISTS(SELECT 1 FROM india_org_units_v u WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.legal_entity_id AND u.type='LEGAL_ENTITY' AND u.valid_to IS NULL)
BEGIN SELECT RAISE(ABORT,'LEGACY_MAP_TARGET_INVALID'); END;
CREATE TRIGGER india_org_unit_legacy_map_immutable BEFORE UPDATE ON india_org_unit_legacy_map
WHEN OLD.status!='pending' OR NEW.org_unit_id IS NOT OLD.org_unit_id OR NEW.legal_entity_id IS NOT OLD.legal_entity_id OR NEW.maker IS NOT OLD.maker
BEGIN SELECT RAISE(ABORT,'LEGACY_MAP_IMMUTABLE'); END;
CREATE TABLE india_policy_decisions(
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,permission TEXT NOT NULL,resource_json TEXT NOT NULL CHECK(json_valid(resource_json)),
 mode TEXT NOT NULL CHECK(mode IN ('shadow','enforce')),allow INTEGER NOT NULL CHECK(allow IN (0,1)),reason TEXT NOT NULL,binding_id TEXT,sod_rule TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(tenant_id,id)
);
CREATE INDEX india_policy_decisions_review ON india_policy_decisions(tenant_id,allow,created_at);
CREATE TRIGGER india_policy_decisions_no_update BEFORE UPDATE ON india_policy_decisions BEGIN SELECT RAISE(ABORT,'POLICY_LOG_IMMUTABLE'); END;
CREATE TRIGGER india_policy_decisions_no_delete BEFORE DELETE ON india_policy_decisions BEGIN SELECT RAISE(ABORT,'POLICY_LOG_IMMUTABLE'); END;
CREATE TABLE india_gl_line_dimensions(
 tenant_id TEXT NOT NULL,line_id TEXT NOT NULL,account_role TEXT NOT NULL,dimensions_json TEXT NOT NULL CHECK(json_valid(dimensions_json)),
 PRIMARY KEY(tenant_id,line_id),FOREIGN KEY(tenant_id,line_id) REFERENCES india_gl_lines(tenant_id,id)
);
CREATE TRIGGER india_gl_line_dimensions_immutable BEFORE UPDATE ON india_gl_line_dimensions BEGIN SELECT RAISE(ABORT,'GL_LINE_IMMUTABLE'); END;
CREATE TRIGGER india_gl_line_dimensions_no_delete BEFORE DELETE ON india_gl_line_dimensions BEGIN SELECT RAISE(ABORT,'GL_LINE_IMMUTABLE'); END;
CREATE TABLE india_posting_worker_runs(
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,trigger TEXT NOT NULL CHECK(trigger IN ('manual','schedule','test')),actor TEXT NOT NULL,
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,finished_at TEXT,picked INTEGER NOT NULL DEFAULT 0,posted INTEGER NOT NULL DEFAULT 0,
 exceptions INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(tenant_id,id)
);
CREATE TRIGGER india_outbox_invoice_approved AFTER UPDATE OF status ON india_billing_invoices
WHEN OLD.status='draft' AND NEW.status='approved'
BEGIN
 INSERT INTO india_accounting_events(tenant_id,id,event_type,legal_entity_id,period,occurred_on,currency,amounts_json,dimensions_json,source_type,source_id,idempotency_key)
 SELECT NEW.tenant_id,'EVT-INV-'||NEW.id,'INVOICE_ON_ACCEPTANCE',m.legal_entity_id,substr(NEW.issue_date,1,7),NEW.issue_date,'IDR',
  json_object('gross',NEW.amount_cents+NEW.vat_cents,'net',NEW.amount_cents,'ppn',NEW.vat_cents),
  json_object('customer',p.customer_id,'project',p.id,'business_line',CASE p.service_family WHEN 'Cybersecurity Governance' THEN 'GOVERNANCE' WHEN 'GRC' THEN 'GOVERNANCE' WHEN 'Cybersecurity Technology' THEN 'TECH_TRADING' WHEN 'TECHNOLOGY' THEN 'TECH_TRADING' ELSE 'CYBERSECURITY' END,'invoice_number',NEW.number),
  'billing_invoice',NEW.id,'billing_invoice:'||NEW.id
 FROM india_delivery_projects p
 JOIN india_erp_project_scopes s ON s.tenant_id=p.tenant_id AND s.project_id=p.id AND s.status='approved'
 JOIN india_org_unit_legacy_map m ON m.tenant_id=s.tenant_id AND m.legacy_unit_id=s.legal_entity_id AND m.status='approved'
 WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.project_id;
END;
CREATE TRIGGER india_outbox_payment_approved AFTER UPDATE OF status ON india_billing_payments
WHEN OLD.status='draft' AND NEW.status='approved'
BEGIN
 INSERT INTO india_accounting_events(tenant_id,id,event_type,legal_entity_id,period,occurred_on,currency,amounts_json,dimensions_json,source_type,source_id,idempotency_key)
 SELECT NEW.tenant_id,'EVT-PAY-'||NEW.id,CASE WHEN NEW.amount_cents>0 THEN 'CASH_RECEIVED' ELSE 'CASH_REVERSED' END,m.legal_entity_id,substr(NEW.payment_date,1,7),NEW.payment_date,'IDR',
  CASE WHEN NEW.amount_cents>0 THEN json_object('cash',NEW.amount_cents,'pph23',0,'settled',NEW.amount_cents) ELSE json_object('amount',-NEW.amount_cents) END,
  json_object('customer',p.customer_id,'project',p.id,'business_line',CASE p.service_family WHEN 'Cybersecurity Governance' THEN 'GOVERNANCE' WHEN 'GRC' THEN 'GOVERNANCE' WHEN 'Cybersecurity Technology' THEN 'TECH_TRADING' WHEN 'TECHNOLOGY' THEN 'TECH_TRADING' ELSE 'CYBERSECURITY' END,'bank_reference',NEW.reference),
  'billing_payment',NEW.id,'billing_payment:'||NEW.id
 FROM india_billing_invoices i JOIN india_delivery_projects p ON p.tenant_id=i.tenant_id AND p.id=i.project_id
 JOIN india_erp_project_scopes s ON s.tenant_id=p.tenant_id AND s.project_id=p.id AND s.status='approved'
 JOIN india_org_unit_legacy_map m ON m.tenant_id=s.tenant_id AND m.legacy_unit_id=s.legal_entity_id AND m.status='approved'
 WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.invoice_id;
END;
CREATE TRIGGER india_outbox_payroll_approved AFTER UPDATE OF status ON india_payroll_runs
WHEN OLD.status='calculated' AND NEW.status='approved'
BEGIN
 INSERT INTO india_accounting_events(tenant_id,id,event_type,legal_entity_id,period,occurred_on,currency,amounts_json,dimensions_json,source_type,source_id,idempotency_key)
 VALUES(NEW.tenant_id,'EVT-PAYROLL-'||NEW.id,'PAYROLL_POSTED',NEW.legal_entity_id,NEW.period,date(NEW.period||'-01','+1 month','-1 day'),'IDR',
  json_object('gross_salary',NEW.gross_cents,'bpjs_employer',NEW.bpjs_employer_cents,'net_pay',NEW.net_cents,'pph21',NEW.pph21_cents,'bpjs_total',NEW.bpjs_employer_cents+NEW.bpjs_employee_cents),
  json_object('cost_center','PAYROLL-'||NEW.period,'payroll_run',NEW.id),'payroll_run',NEW.id,'payroll_run:'||NEW.id);
END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0049_rti_policy_runtime_outbox.sql','rti-v3-wiring');
INSERT INTO india_schema_migrations(version) VALUES(49);
