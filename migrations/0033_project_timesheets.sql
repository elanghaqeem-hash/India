-- WP4: project time certification. No synthetic employee, rate, or financial posting.
CREATE TABLE india_project_timesheets (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL,
 person_id TEXT NOT NULL, allocation_id TEXT NOT NULL, work_date TEXT NOT NULL,
 minutes INTEGER NOT NULL CHECK(minutes BETWEEN 15 AND 480 AND minutes % 15=0),
 cost_snapshot_cents INTEGER NOT NULL CHECK(cost_snapshot_cents>=0 AND cost_snapshot_cents<9000000000000000),
 billable INTEGER NOT NULL CHECK(billable IN (0,1)),
 description TEXT NOT NULL CHECK(length(description) BETWEEN 12 AND 1000),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL COLLATE NOCASE,
 reviewed_by TEXT COLLATE NOCASE, review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES india_resource_people(tenant_id,id),
 FOREIGN KEY(tenant_id,allocation_id) REFERENCES india_resource_allocations(tenant_id,id),
 CHECK(status!='approved' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE INDEX india_timesheet_project_date ON india_project_timesheets(tenant_id,project_id,work_date,status);
CREATE UNIQUE INDEX india_timesheet_active_day ON india_project_timesheets(tenant_id,project_id,person_id,work_date) WHERE status!='rejected';
CREATE TRIGGER india_timesheet_no_delete BEFORE DELETE ON india_project_timesheets
 BEGIN SELECT RAISE(ABORT,'TIMESHEET_IMMUTABLE'); END;
CREATE TRIGGER india_timesheet_transition BEFORE UPDATE ON india_project_timesheets
 BEGIN
  SELECT CASE WHEN OLD.status!='submitted' OR NEW.status NOT IN ('approved','rejected')
   OR NEW.version!=OLD.version+1 OR NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
   OR NEW.project_id IS NOT OLD.project_id OR NEW.person_id IS NOT OLD.person_id
   OR NEW.allocation_id IS NOT OLD.allocation_id OR NEW.work_date IS NOT OLD.work_date
   OR NEW.minutes IS NOT OLD.minutes OR NEW.billable IS NOT OLD.billable
   OR NEW.cost_snapshot_cents IS NOT OLD.cost_snapshot_cents
   OR NEW.description IS NOT OLD.description OR NEW.created_by IS NOT OLD.created_by
   OR lower(NEW.reviewed_by)=lower(OLD.created_by)
   THEN RAISE(ABORT,'TIMESHEET_IMMUTABLE') END;
 END;
CREATE TRIGGER india_timesheet_capacity BEFORE INSERT ON india_project_timesheets
 BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM india_delivery_projects p
    JOIN india_resource_allocations a ON a.tenant_id=p.tenant_id AND a.opportunity_id=p.opportunity_id AND a.id=NEW.allocation_id
    JOIN india_resource_people r ON r.tenant_id=a.tenant_id AND r.id=a.person_id
    WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.project_id AND p.status='active'
      AND r.id=NEW.person_id AND r.active=1 AND a.status='active'
      AND substr(NEW.work_date,1,7)=a.allocation_month
      AND NEW.work_date BETWEEN p.start_date AND p.end_date
      AND lower(NEW.created_by)=lower(r.email)
      AND NEW.minutes+coalesce((SELECT sum(t.minutes) FROM india_project_timesheets t
          WHERE t.tenant_id=NEW.tenant_id AND t.person_id=NEW.person_id AND t.work_date=NEW.work_date AND t.status!='rejected'),0)<=480
      AND NEW.minutes+coalesce((SELECT sum(t.minutes) FROM india_project_timesheets t
          WHERE t.tenant_id=NEW.tenant_id AND t.allocation_id=NEW.allocation_id AND t.status!='rejected'),0)<=round(a.person_days*480)
  ) THEN RAISE(ABORT,'TIMESHEET_CAPACITY_CONFLICT') END;
 END;
CREATE TRIGGER india_timesheet_review_capacity BEFORE UPDATE OF status ON india_project_timesheets WHEN NEW.status='approved'
 BEGIN
  SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM india_resource_allocations a JOIN india_resource_people r ON r.id=a.person_id AND r.tenant_id=a.tenant_id
   WHERE a.id=NEW.allocation_id AND a.tenant_id=NEW.tenant_id AND a.status='active' AND r.active=1
    AND (SELECT coalesce(sum(t.minutes),0) FROM india_project_timesheets t WHERE t.tenant_id=NEW.tenant_id AND t.allocation_id=a.id AND t.status!='rejected')<=round(a.person_days*480)
  ) THEN RAISE(ABORT,'TIMESHEET_CAPACITY_CONFLICT') END;
 END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0033_project_timesheets.sql','psa-timesheets');
INSERT INTO india_schema_migrations(version) VALUES(33);
