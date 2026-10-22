-- INDIA 0022: additive Sales targets for the Executive D1 dashboard.
-- No seeded targets; historical attainment remains undefined until Admin records a target.
CREATE TABLE india_sales_targets (
 tenant_id TEXT NOT NULL,
 period TEXT NOT NULL CHECK(length(period)=7 AND period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
 owner_email TEXT NOT NULL COLLATE NOCASE,
 amount_idr INTEGER NOT NULL CHECK(amount_idr>0 AND amount_idr<100000000000000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 12 AND 1000),
 updated_by TEXT NOT NULL COLLATE NOCASE,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,period,owner_email),
 FOREIGN KEY(owner_email) REFERENCES india_members(email)
);
CREATE INDEX idx_india_sales_targets_owner ON india_sales_targets(tenant_id,owner_email,period);
CREATE TABLE india_sales_target_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 period TEXT NOT NULL,
 owner_email TEXT NOT NULL COLLATE NOCASE,
 version INTEGER NOT NULL,
 amount_idr INTEGER NOT NULL,
 rationale TEXT NOT NULL,
 actor_email TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,period,owner_email,version),
 FOREIGN KEY(tenant_id,period,owner_email) REFERENCES india_sales_targets(tenant_id,period,owner_email)
);
CREATE TRIGGER india_targets_events_immutable_update BEFORE UPDATE ON india_sales_target_events
BEGIN SELECT RAISE(ABORT,'TARGET_EVENT_IMMUTABLE'); END;
CREATE TRIGGER india_targets_events_immutable_delete BEFORE DELETE ON india_sales_target_events
BEGIN SELECT RAISE(ABORT,'TARGET_EVENT_IMMUTABLE'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch)
VALUES('migrations/0022_executive_sales_targets.sql','executive-sales-dashboard');
INSERT INTO india_schema_migrations(version) VALUES(22);
