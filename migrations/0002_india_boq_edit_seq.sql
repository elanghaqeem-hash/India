-- 0002: Prevent double approvals, lost edits, and status races in the BoQ workflow.
-- Added only after verifying the existing table has no edit_seq column.
ALTER TABLE india_boq ADD COLUMN edit_seq INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_india_boq_status_version ON india_boq(tenant_id,status,quotation_number,version);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(2);
