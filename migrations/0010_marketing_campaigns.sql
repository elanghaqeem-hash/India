-- INDIA Marketing Phase 2: tenant-scoped campaign master + linked leads.
-- Apply after 0009; backup required before live deployment. No seed/dummy data.
CREATE TABLE IF NOT EXISTS india_marketing_campaigns (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('webinar','event','partnership','outbound','referral','digital','other')),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','paused','completed','cancelled')),
 owner_email TEXT NOT NULL COLLATE NOCASE,
 budget_idr INTEGER NOT NULL DEFAULT 0 CHECK(budget_idr>=0),
 start_date TEXT NOT NULL DEFAULT '',
 end_date TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_by TEXT NOT NULL COLLATE NOCASE,
 updated_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,code)
);
CREATE INDEX IF NOT EXISTS idx_india_campaign_tenant_status
ON india_marketing_campaigns(tenant_id,status,updated_at DESC);
ALTER TABLE india_marketing_leads ADD COLUMN campaign_id TEXT REFERENCES india_marketing_campaigns(id);
CREATE INDEX IF NOT EXISTS idx_india_marketing_leads_campaign_id
ON india_marketing_leads(tenant_id,campaign_id);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(10);
