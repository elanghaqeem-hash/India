-- INDIA marketing safe retry semantics. Apply after 0005, only after backup.
-- Existing lead IDs remain unchanged; old rows have NULL request_key.
ALTER TABLE india_marketing_leads ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_india_marketing_lead_request
ON india_marketing_leads(tenant_id,created_by,request_key)
WHERE request_key IS NOT NULL;
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(9);
