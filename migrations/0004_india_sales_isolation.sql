-- Dedicated D1 Sales CRM tables.
-- Preserve legacy companies/opportunities and their incompatible stage/FK constraints.
-- New records use Cloudflare Access email (not legacy users.id).
CREATE TABLE IF NOT EXISTS india_sales_accounts (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 legal_name TEXT NOT NULL,
 customer_number TEXT NOT NULL,
 data_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(data_json)),
 created_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,customer_number)
);
CREATE INDEX IF NOT EXISTS idx_india_sales_accounts_tenant ON india_sales_accounts(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS india_sales_opportunities (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 company_id TEXT NOT NULL,
 title TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'prospecting'
 CHECK(stage IN ('prospecting','qualified','discovery','solution_design','commercial_review','quotation_sent','negotiation','pending_po','closed_won','closed_lost')),
 estimated_value_idr INTEGER NOT NULL CHECK(estimated_value_idr>0),
 data_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(data_json)),
 created_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES india_sales_accounts(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_india_sales_opportunity_stage ON india_sales_opportunities(tenant_id,stage,created_at DESC);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(4);
