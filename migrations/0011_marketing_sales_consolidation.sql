-- INDIA consolidated Marketing -> Sales schema extension.
-- Apply only AFTER the canonical PR12 migrations 0003..0010. Do not execute this
-- file on the former PR18 UAT schema before running the reviewed bridge.
-- Identifiers and timestamps remain immutable; audit is append-only in the API.
ALTER TABLE india_marketing_leads
 ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1);

CREATE TABLE IF NOT EXISTS india_marketing_lead_events (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 lead_id TEXT NOT NULL,
 action TEXT NOT NULL,
 actor_email TEXT NOT NULL COLLATE NOCASE,
 from_status TEXT,
 to_status TEXT,
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(lead_id) REFERENCES india_marketing_leads(id)
);
CREATE INDEX IF NOT EXISTS idx_india_consolidated_lead_event
 ON india_marketing_lead_events(tenant_id,lead_id,created_at DESC);

-- The canonical one-to-one lineage is stored in india_sales_lead_links.
-- Prevent accidental duplicate pairing across tenants or historic imports.
CREATE UNIQUE INDEX IF NOT EXISTS idx_india_consolidated_lead_account_opportunity
 ON india_sales_lead_links(tenant_id,lead_id,opportunity_id);

-- Track paths rather than only integers: both predecessor branches used
-- version 5 and 6 for DIFFERENT migrations.
CREATE TABLE IF NOT EXISTS india_schema_file_manifest (
 path TEXT PRIMARY KEY NOT NULL,
 source_branch TEXT NOT NULL,
 applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch)
 VALUES('migrations/0011_marketing_sales_consolidation.sql','consolidated');
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(11);
