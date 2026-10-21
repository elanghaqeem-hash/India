-- Phase 2: real D1 lead lifecycle; do not touch legacy in-memory opportunity API.
CREATE TABLE IF NOT EXISTS india_marketing_leads (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 company_name TEXT NOT NULL,
 contact_name TEXT NOT NULL,
 contact_email TEXT NOT NULL,
 contact_phone TEXT NOT NULL DEFAULT '',
 service_interest TEXT NOT NULL,
 lead_source TEXT NOT NULL,
 campaign_code TEXT NOT NULL DEFAULT '',
 qualification_notes TEXT NOT NULL DEFAULT '',
 budget_status TEXT NOT NULL DEFAULT '',
 decision_authority TEXT NOT NULL DEFAULT '',
 requirement_summary TEXT NOT NULL DEFAULT '',
 target_date TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','disqualified','converted')),
 owner_email TEXT NOT NULL COLLATE NOCASE,
 converted_account_id TEXT,
 converted_opportunity_id TEXT,
 created_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 CHECK(status!='converted' OR (converted_account_id IS NOT NULL AND converted_opportunity_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_india_leads_owner ON india_marketing_leads(tenant_id,owner_email,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_india_leads_active_dedupe ON india_marketing_leads(tenant_id,lower(trim(contact_email)),lower(trim(company_name))) WHERE status NOT IN ('disqualified');
CREATE TABLE IF NOT EXISTS india_marketing_lead_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 lead_id TEXT NOT NULL,
 action TEXT NOT NULL,
 actor_email TEXT NOT NULL,
 from_status TEXT,
 to_status TEXT,
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(lead_id) REFERENCES india_marketing_leads(id)
);
CREATE INDEX IF NOT EXISTS idx_india_lead_events ON india_marketing_lead_events(tenant_id,lead_id,created_at);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(5);
