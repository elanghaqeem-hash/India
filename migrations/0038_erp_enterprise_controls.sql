-- Additive control plane: financial close/reversal, treasury payment, procurement requisition,
-- HR workforce and SIEM/EDR integration credentials metadata (secrets NEVER stored here).
CREATE TABLE india_erp_access_changes(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,capability TEXT NOT NULL,
 unit_id TEXT NOT NULL,operation TEXT NOT NULL CHECK(operation IN ('grant','revoke','suspend')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,reason TEXT NOT NULL CHECK(length(reason)>=12),
 reviewed_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(reviewed_by IS NULL OR (lower(reviewed_by)!=lower(requested_by) AND lower(reviewed_by)!=lower(email)))
);
CREATE TRIGGER india_erp_access_change_review BEFORE UPDATE ON india_erp_access_changes
WHEN OLD.status!='pending' OR NEW.status NOT IN ('approved','rejected') OR
 NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.email IS NOT OLD.email OR
 NEW.capability IS NOT OLD.capability OR NEW.unit_id IS NOT OLD.unit_id OR NEW.operation IS NOT OLD.operation OR
 NEW.requested_by IS NOT OLD.requested_by OR NEW.reason IS NOT OLD.reason OR
 NEW.reviewed_by IS NULL OR lower(NEW.reviewed_by)=lower(OLD.requested_by) OR lower(NEW.reviewed_by)=lower(OLD.email)
BEGIN SELECT RAISE(ABORT,'ACCESS_CHANGE_IMMUTABLE'); END;
CREATE TRIGGER india_erp_access_change_no_delete BEFORE DELETE ON india_erp_access_changes BEGIN SELECT RAISE(ABORT,'ACCESS_CHANGE_IMMUTABLE'); END;
CREATE TABLE india_erp_role_matrix(
 tenant_id TEXT NOT NULL,role TEXT NOT NULL,capability TEXT NOT NULL,unit_kind TEXT NOT NULL,
 can_request INTEGER NOT NULL DEFAULT 0 CHECK(can_request IN (0,1)),
 can_review INTEGER NOT NULL DEFAULT 0 CHECK(can_review IN (0,1)),
 can_execute INTEGER NOT NULL DEFAULT 0 CHECK(can_execute IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,approved_by TEXT NOT NULL,approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,role,capability,unit_kind)
);
CREATE TABLE india_gl_close_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,period_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 reason TEXT NOT NULL CHECK(length(reason)>=12),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,period_id) REFERENCES india_gl_periods(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by))
);
CREATE UNIQUE INDEX india_gl_close_once ON india_gl_close_requests(tenant_id,period_id) WHERE status IN ('pending','approved');
CREATE TABLE india_gl_reversal_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,original_journal_id TEXT NOT NULL,
 reversal_period_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 reason TEXT NOT NULL CHECK(length(reason)>=12),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,original_journal_id) REFERENCES india_gl_journals(tenant_id,id),
 FOREIGN KEY(tenant_id,reversal_period_id) REFERENCES india_gl_periods(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by))
);
CREATE UNIQUE INDEX india_gl_reversal_once ON india_gl_reversal_requests(tenant_id,original_journal_id) WHERE status IN ('pending','approved');
CREATE TABLE india_erp_treasury_payment_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,ap_invoice_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),currency TEXT NOT NULL DEFAULT 'IDR' CHECK(currency='IDR'),
 beneficiary_reference TEXT NOT NULL,bank_account_token TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','sent','settled','failed')),
 requested_by TEXT NOT NULL COLLATE NOCASE,approved_by TEXT COLLATE NOCASE,
 bank_idempotency_key TEXT NOT NULL,bank_reference TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,bank_idempotency_key),
 FOREIGN KEY(tenant_id,ap_invoice_id) REFERENCES india_ap_supplier_invoices(tenant_id,id),
 CHECK(approved_by IS NULL OR lower(approved_by)!=lower(requested_by))
);
CREATE TABLE india_erp_purchase_requisitions(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,
 description TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),
 budget_cents INTEGER NOT NULL CHECK(budget_cents>0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,approved_by TEXT COLLATE NOCASE,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 CHECK(approved_by IS NULL OR lower(approved_by)!=lower(requested_by))
);
CREATE TABLE india_erp_hr_employee_profiles(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,
 employment_status TEXT NOT NULL CHECK(employment_status IN ('onboarding','active','leave','offboarding','terminated')),
 employee_number TEXT NOT NULL,hire_date TEXT NOT NULL,
 created_by TEXT NOT NULL COLLATE NOCASE,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,email),UNIQUE(tenant_id,employee_number),
 FOREIGN KEY(email) REFERENCES india_members(email)
);
CREATE TABLE india_erp_hr_leave_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,employee_id TEXT NOT NULL,
 start_date TEXT NOT NULL,end_date TEXT NOT NULL,leave_type TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 CHECK(end_date>=start_date),CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(requested_by)),
 FOREIGN KEY(tenant_id,employee_id) REFERENCES india_erp_hr_employee_profiles(tenant_id,id)
);
CREATE TABLE india_erp_security_connectors(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('splunk','microsoft_sentinel','elastic','crowdstrike','microsoft_defender','generic_siem','generic_edr')),
 integration_kind TEXT NOT NULL CHECK(integration_kind IN ('siem','edr')),
 secret_binding_name TEXT NOT NULL,endpoint_alias TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 last_verified_at TEXT,created_by TEXT NOT NULL COLLATE NOCASE,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,project_id,provider,endpoint_alias),
 FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id)
);
CREATE TABLE india_erp_security_ingestion_events(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,connector_id TEXT NOT NULL,
 external_event_id TEXT NOT NULL,received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 severity TEXT NOT NULL,case_id TEXT,payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 UNIQUE(tenant_id,connector_id,external_event_id),
 FOREIGN KEY(tenant_id,connector_id) REFERENCES india_erp_security_connectors(tenant_id,id),
 FOREIGN KEY(tenant_id,case_id) REFERENCES india_cyber_cases(tenant_id,id)
);
CREATE TRIGGER india_erp_ingestion_no_update BEFORE UPDATE ON india_erp_security_ingestion_events BEGIN SELECT RAISE(ABORT,'EVENT_IMMUTABLE'); END;
CREATE TRIGGER india_erp_ingestion_no_delete BEFORE DELETE ON india_erp_security_ingestion_events BEGIN SELECT RAISE(ABORT,'EVENT_IMMUTABLE'); END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0038_erp_enterprise_controls.sql','erp-enterprise-controls');
INSERT INTO india_schema_migrations(version) VALUES(38);
