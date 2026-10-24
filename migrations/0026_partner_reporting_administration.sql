-- Additive consolidation: no demo rows, no production side effects.
CREATE TABLE india_operations_events (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, area TEXT NOT NULL, entity_id TEXT NOT NULL,
 action TEXT NOT NULL, actor_email TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX india_operations_events_idx ON india_operations_events(tenant_id,area,created_at DESC);
CREATE TRIGGER india_operations_events_no_update BEFORE UPDATE ON india_operations_events BEGIN SELECT RAISE(ABORT,'OPERATIONS_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER india_operations_events_no_delete BEFORE DELETE ON india_operations_events BEGIN SELECT RAISE(ABORT,'OPERATIONS_AUDIT_IMMUTABLE'); END;
CREATE TABLE india_partner_records (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,vendor_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('profile','agreement','license','purchase','evaluation')),
 opportunity_id TEXT,offer_id TEXT,document_id TEXT,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 240),
 data_json TEXT NOT NULL CHECK(json_valid(data_json)),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected','ordered','received','cancelled')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_by TEXT NOT NULL,reviewed_by TEXT,
 review_notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,vendor_id) REFERENCES india_vendors(tenant_id,id),FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,offer_id) REFERENCES india_vendor_offers(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by)),
 CHECK(status NOT IN ('approved','ordered','received') OR reviewed_by IS NOT NULL),
 CHECK(kind!='purchase' OR (opportunity_id IS NOT NULL AND offer_id IS NOT NULL)),
 CHECK(kind NOT IN ('agreement','license') OR document_id IS NOT NULL)
);
CREATE INDEX india_partner_records_vendor ON india_partner_records(tenant_id,vendor_id,kind,status);
CREATE INDEX india_partner_records_deal ON india_partner_records(tenant_id,opportunity_id,kind);
CREATE TABLE india_actual_costs (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,period TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('vendor','labor','license','travel','cloud','other')),
 amount_idr INTEGER NOT NULL CHECK(amount_idr>0 AND amount_idr<100000000000000),
 evidence_reference TEXT NOT NULL,evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 reverses_id TEXT UNIQUE,created_by TEXT NOT NULL,reviewed_by TEXT,notes TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(opportunity_id) REFERENCES india_sales_opportunities(id),FOREIGN KEY(reverses_id) REFERENCES india_actual_costs(id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by))
);
CREATE INDEX india_actual_costs_period ON india_actual_costs(tenant_id,period,opportunity_id,status);
CREATE TRIGGER india_actual_cost_no_delete BEFORE DELETE ON india_actual_costs BEGIN SELECT RAISE(ABORT,'ACTUAL_COST_IMMUTABLE'); END;
CREATE TRIGGER india_actual_cost_approved_no_update BEFORE UPDATE ON india_actual_costs WHEN OLD.status!='draft'
BEGIN SELECT RAISE(ABORT,'ACTUAL_COST_IMMUTABLE'); END;
CREATE TRIGGER india_actual_cost_snapshot_no_update BEFORE UPDATE ON india_actual_costs
WHEN NEW.tenant_id!=OLD.tenant_id OR NEW.opportunity_id!=OLD.opportunity_id OR NEW.period!=OLD.period OR NEW.amount_idr!=OLD.amount_idr
 OR NEW.evidence_reference!=OLD.evidence_reference OR NEW.evidence_sha256!=OLD.evidence_sha256 OR NEW.created_by!=OLD.created_by
 OR NEW.category!=OLD.category OR NEW.notes!=OLD.notes OR NEW.reverses_id IS NOT OLD.reverses_id
BEGIN SELECT RAISE(ABORT,'ACTUAL_COST_IMMUTABLE'); END;
CREATE TABLE india_setting_versions (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('organization','approval','numbering','template','integration','access')),
 setting_key TEXT NOT NULL,title TEXT NOT NULL,data_json TEXT NOT NULL CHECK(json_valid(data_json)),
 version INTEGER NOT NULL CHECK(version>0),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 created_by TEXT NOT NULL,reviewed_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,kind,setting_key,version),CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by))
);
CREATE TRIGGER india_setting_review_immutable BEFORE UPDATE ON india_setting_versions WHEN OLD.status!='draft'
BEGIN SELECT RAISE(ABORT,'SETTING_IMMUTABLE'); END;
CREATE TRIGGER india_setting_snapshot_immutable BEFORE UPDATE ON india_setting_versions
WHEN NEW.data_json!=OLD.data_json OR NEW.kind!=OLD.kind OR NEW.setting_key!=OLD.setting_key OR NEW.version!=OLD.version OR NEW.created_by!=OLD.created_by OR NEW.title!=OLD.title OR NEW.tenant_id!=OLD.tenant_id
BEGIN SELECT RAISE(ABORT,'SETTING_IMMUTABLE'); END;
CREATE TRIGGER india_setting_no_delete BEFORE DELETE ON india_setting_versions BEGIN SELECT RAISE(ABORT,'SETTING_IMMUTABLE'); END;
CREATE VIEW india_effective_settings AS SELECT s.* FROM india_setting_versions s WHERE status='approved' AND version=(SELECT max(x.version) FROM india_setting_versions x WHERE x.tenant_id=s.tenant_id AND x.kind=s.kind AND x.setting_key=s.setting_key AND x.status='approved');
CREATE TABLE india_number_reservations (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,number TEXT NOT NULL,kind TEXT NOT NULL,period TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence>0),actor_email TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,number),UNIQUE(tenant_id,kind,period,sequence)
);
CREATE TRIGGER india_number_no_update BEFORE UPDATE ON india_number_reservations BEGIN SELECT RAISE(ABORT,'NUMBER_IMMUTABLE'); END;
CREATE TRIGGER india_number_no_delete BEFORE DELETE ON india_number_reservations BEGIN SELECT RAISE(ABORT,'NUMBER_IMMUTABLE'); END;
CREATE TABLE india_report_definitions (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,title TEXT NOT NULL,owner_email TEXT NOT NULL,
 definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE india_member_orgs(email TEXT PRIMARY KEY COLLATE NOCASE,unit_key TEXT NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(email) REFERENCES india_members(email));
CREATE TRIGGER india_core_audit_no_update BEFORE UPDATE ON india_audit_log BEGIN SELECT RAISE(ABORT,'CORE_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER india_core_audit_no_delete BEFORE DELETE ON india_audit_log BEGIN SELECT RAISE(ABORT,'CORE_AUDIT_IMMUTABLE'); END;

CREATE TRIGGER india_partner_no_delete BEFORE DELETE ON india_partner_records BEGIN SELECT RAISE(ABORT,'PARTNER_IMMUTABLE'); END;
CREATE TRIGGER india_partner_snapshot_no_update BEFORE UPDATE ON india_partner_records
WHEN NEW.tenant_id!=OLD.tenant_id OR NEW.kind!=OLD.kind OR NEW.vendor_id!=OLD.vendor_id OR NEW.opportunity_id IS NOT OLD.opportunity_id
 OR NEW.offer_id IS NOT OLD.offer_id OR NEW.document_id IS NOT OLD.document_id OR NEW.title!=OLD.title OR NEW.created_by!=OLD.created_by
 OR NEW.version!=OLD.version+1
 OR (NEW.data_json!=OLD.data_json AND NOT(OLD.kind='purchase' AND OLD.status='ordered' AND NEW.status IN ('ordered','received')
 AND json_remove(NEW.data_json,'$.received_quantity','$.received_date')=json_remove(OLD.data_json,'$.received_quantity','$.received_date')
 AND json_extract(NEW.data_json,'$.received_quantity')>json_extract(OLD.data_json,'$.received_quantity')
 AND json_extract(NEW.data_json,'$.received_quantity')<=json_extract(OLD.data_json,'$.quantity')))
BEGIN SELECT RAISE(ABORT,'PARTNER_IMMUTABLE'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0026_partner_reporting_administration.sql','modules-13-15');
INSERT INTO india_schema_migrations(version) VALUES(26);
