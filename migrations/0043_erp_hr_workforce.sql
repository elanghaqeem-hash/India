-- 0041 HR workforce: canonical India member identity, approvals, assets, training and leave.
-- No fabricated payroll, no plaintext salaries/national identity numbers/medical information.
CREATE TABLE india_hr_employees(
 tenant_id TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,
 employment_type TEXT NOT NULL CHECK(employment_type IN ('permanent','contract','intern','external')),
 start_date TEXT NOT NULL,end_date TEXT,
 status TEXT NOT NULL DEFAULT 'onboarding' CHECK(status IN ('onboarding','active','offboarded')),
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL COLLATE NOCASE,
 approved_by TEXT COLLATE NOCASE,reason TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,email),FOREIGN KEY(email) REFERENCES india_members(email),
 CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE TRIGGER india_hr_employee_review BEFORE UPDATE ON india_hr_employees
WHEN NEW.tenant_id IS NOT OLD.tenant_id OR NEW.email IS NOT OLD.email
 OR NEW.employment_type IS NOT OLD.employment_type OR NEW.start_date IS NOT OLD.start_date
 OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
 OR NEW.version!=OLD.version+1 OR NOT (
 (OLD.status='onboarding' AND NEW.status='active') OR
 (OLD.status='active' AND NEW.status='offboarded')
 )
 OR NEW.approved_by IS NULL OR lower(NEW.approved_by)=lower(OLD.created_by)
 OR lower(NEW.approved_by)=lower(OLD.email) OR coalesce(length(NEW.reason),0)<12
BEGIN SELECT RAISE(ABORT,'HR_LIFECYCLE_IMMUTABLE'); END;
CREATE TRIGGER india_hr_employee_no_delete BEFORE DELETE ON india_hr_employees BEGIN SELECT RAISE(ABORT,'HR_IMMUTABLE'); END;
CREATE TABLE india_hr_leave_policies(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 leave_type TEXT NOT NULL CHECK(leave_type IN ('annual','sick','unpaid','special')),
 calendar_year INTEGER NOT NULL CHECK(calendar_year BETWEEN 2020 AND 2150),
 days_entitlement INTEGER NOT NULL CHECK(days_entitlement>=0 AND days_entitlement<=365),
 created_by TEXT NOT NULL,approved_by TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,legal_entity_id,leave_type,calendar_year),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 CHECK(status!='approved' OR (approved_by IS NOT NULL AND lower(approved_by)!=lower(created_by)))
);
CREATE TRIGGER india_hr_leave_policy_approve BEFORE UPDATE ON india_hr_leave_policies
WHEN OLD.status!='draft' OR NEW.status!='approved' OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.legal_entity_id IS NOT OLD.legal_entity_id OR NEW.leave_type IS NOT OLD.leave_type
 OR NEW.calendar_year IS NOT OLD.calendar_year OR NEW.days_entitlement IS NOT OLD.days_entitlement
 OR NEW.created_by IS NOT OLD.created_by OR lower(NEW.approved_by)=lower(OLD.created_by)
BEGIN SELECT RAISE(ABORT,'HR_POLICY_IMMUTABLE'); END;
CREATE TABLE india_hr_leave_requests(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,
 policy_id TEXT NOT NULL,from_date TEXT NOT NULL,to_date TEXT NOT NULL,
 business_days INTEGER NOT NULL CHECK(business_days BETWEEN 1 AND 365),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,
 notes TEXT NOT NULL DEFAULT '',review_notes TEXT,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,email) REFERENCES india_hr_employees(tenant_id,email),
 FOREIGN KEY(tenant_id,policy_id) REFERENCES india_hr_leave_policies(tenant_id,id),
 CHECK(from_date<=to_date),
 CHECK(reviewed_by IS NULL OR (lower(reviewed_by)!=lower(created_by) AND lower(reviewed_by)!=lower(email))),
 CHECK(status='draft' OR (reviewed_by IS NOT NULL AND coalesce(length(review_notes),0)>=12))
);
CREATE TRIGGER india_hr_leave_review BEFORE UPDATE ON india_hr_leave_requests
BEGIN
 SELECT CASE WHEN OLD.status!='draft' OR NEW.status NOT IN ('approved','rejected') OR NEW.version!=OLD.version+1
 OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.id IS NOT OLD.id OR NEW.email IS NOT OLD.email
 OR NEW.policy_id IS NOT OLD.policy_id OR NEW.from_date IS NOT OLD.from_date
 OR NEW.to_date IS NOT OLD.to_date OR NEW.business_days IS NOT OLD.business_days
 OR NEW.created_by IS NOT OLD.created_by OR lower(NEW.reviewed_by)=lower(OLD.created_by)
 OR lower(NEW.reviewed_by)=lower(OLD.email) THEN RAISE(ABORT,'HR_LEAVE_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status='approved' AND NOT EXISTS(
 SELECT 1 FROM india_hr_employees e JOIN india_erp_staff_org s ON s.email=e.email AND s.tenant_id=e.tenant_id AND s.status='approved'
 JOIN india_erp_org_units u ON u.id=s.unit_id AND u.tenant_id=s.tenant_id
 JOIN india_hr_leave_policies p ON p.tenant_id=e.tenant_id AND p.id=NEW.policy_id AND p.status='approved'
 WHERE e.tenant_id=NEW.tenant_id AND e.email=NEW.email AND e.status='active'
 AND strftime('%Y',NEW.from_date)=cast(p.calendar_year as text) AND strftime('%Y',NEW.to_date)=cast(p.calendar_year as text)
 AND (u.id=p.legal_entity_id OR EXISTS(
 WITH RECURSIVE anc(id,parent_id) AS (SELECT id,parent_id FROM india_erp_org_units WHERE tenant_id=NEW.tenant_id AND id=u.id
 UNION ALL SELECT x.id,x.parent_id FROM india_erp_org_units x JOIN anc a ON x.id=a.parent_id WHERE x.tenant_id=NEW.tenant_id)
 SELECT 1 FROM anc WHERE id=p.legal_entity_id))
 AND (SELECT coalesce(sum(r.business_days),0) FROM india_hr_leave_requests r
 WHERE r.tenant_id=NEW.tenant_id AND r.email=NEW.email AND r.policy_id=NEW.policy_id AND r.status='approved')+NEW.business_days<=p.days_entitlement
 AND NOT EXISTS(SELECT 1 FROM india_hr_leave_requests r WHERE r.tenant_id=NEW.tenant_id AND r.email=NEW.email AND r.status='approved' AND r.id!=NEW.id AND r.from_date<=NEW.to_date AND r.to_date>=NEW.from_date)
 ) THEN RAISE(ABORT,'HR_LEAVE_BALANCE_OR_OVERLAP') END;
END;
CREATE TABLE india_hr_skills(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,
 skill TEXT NOT NULL,level TEXT NOT NULL CHECK(level IN ('foundation','intermediate','advanced','expert')),
 evidence_document_id TEXT,expires_at TEXT,
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,email,skill),
 FOREIGN KEY(tenant_id,email) REFERENCES india_hr_employees(tenant_id,email)
);
CREATE TABLE india_hr_assets(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 tag TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('laptop','mobile','security_token','equipment','license')),
 model TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','assigned','retired')),
 assigned_to TEXT COLLATE NOCASE,created_by TEXT NOT NULL,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,tag),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 FOREIGN KEY(tenant_id,assigned_to) REFERENCES india_hr_employees(tenant_id,email),
 CHECK((status='assigned' AND assigned_to IS NOT NULL) OR (status!='assigned' AND assigned_to IS NULL))
);
CREATE TABLE india_hr_asset_events(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,asset_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('assign','return','retire')),
 employee_email TEXT COLLATE NOCASE,evidence_document_id TEXT,
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,asset_id) REFERENCES india_hr_assets(tenant_id,id)
);
CREATE TRIGGER india_hr_asset_events_no_mutate BEFORE UPDATE ON india_hr_asset_events BEGIN SELECT RAISE(ABORT,'HR_ASSET_EVENT_IMMUTABLE'); END;
CREATE TRIGGER india_hr_asset_events_no_delete BEFORE DELETE ON india_hr_asset_events BEGIN SELECT RAISE(ABORT,'HR_ASSET_EVENT_IMMUTABLE'); END;
CREATE TRIGGER india_hr_employee_offboard_lock AFTER UPDATE OF status ON india_hr_employees
WHEN NEW.status='offboarded'
BEGIN
 -- Effective authorization fails closed regardless of stale historic grants.
 UPDATE india_members SET active=0 WHERE lower(email)=lower(NEW.email);
END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0043_erp_hr_workforce.sql','erp-extensions');
INSERT INTO india_schema_migrations(version) VALUES(43);
