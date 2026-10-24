CREATE TABLE india_sales_forecasts(
 tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,expected_close_date TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('pipeline','best_case','commit','omit')),
 reason TEXT NOT NULL CHECK(length(trim(reason))>=12),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,opportunity_id),FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE TABLE india_sales_forecast_events(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,version INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),actor_email TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id,version),FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE TRIGGER india_forecast_events_update BEFORE UPDATE ON india_sales_forecast_events
BEGIN SELECT RAISE(ABORT,'FORECAST_IMMUTABLE'); END;
CREATE TRIGGER india_forecast_events_delete BEFORE DELETE ON india_sales_forecast_events
BEGIN SELECT RAISE(ABORT,'FORECAST_IMMUTABLE'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0018_sales_forecast.sql','p1-p2-integration');
INSERT INTO india_schema_migrations(version) VALUES(18);
