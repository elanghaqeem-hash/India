-- INDIA Sales CRM workflow and audit layer on existing companies/opportunities D1 tables.
-- Scope: tenant_id = defendit360. No seed/dummy customers.
CREATE TABLE IF NOT EXISTS india_sales_audit (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL, action TEXT NOT NULL, from_stage TEXT, to_stage TEXT,
 actor_email TEXT NOT NULL, summary TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_india_sales_audit ON india_sales_audit(tenant_id,entity_id,created_at DESC);
CREATE TABLE IF NOT EXISTS india_sales_activities (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('call','email','meeting','follow_up','tender','note')),
 subject TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', next_action_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_india_sales_activities ON india_sales_activities(tenant_id,opportunity_id,created_at DESC);
CREATE TABLE IF NOT EXISTS india_sales_documents (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 kind TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','verified','superseded')),
 reference TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, 
 checklist_json TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_india_sales_documents ON india_sales_documents(tenant_id,opportunity_id);
CREATE TABLE IF NOT EXISTS india_sales_po_checks (
 opportunity_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, boq_id TEXT NOT NULL,
 po_number TEXT NOT NULL, po_date TEXT NOT NULL, po_reference TEXT NOT NULL,
 po_amount_before_vat REAL NOT NULL, quotation_amount_before_vat REAL NOT NULL,
 verified_by TEXT NOT NULL, verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS india_sales_ai_audit (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT,
 purpose TEXT NOT NULL, provider_id TEXT NOT NULL, model TEXT NOT NULL,
 actor_email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(3);
