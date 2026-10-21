-- INDIA 0005: Marketing lead-to-opportunity workflow.
-- Apply after 0004 to a BACKED UP environment, once, during controlled maintenance.
-- Do not put test users or fixture leads in production.
CREATE TABLE india_members_v2 (
 email TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('admin','marketing','finance','presales','sales','approver','legal','viewer')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 created_by TEXT
);
INSERT INTO india_members_v2(email,role,active,created_at,created_by)
 SELECT email,role,active,created_at,created_by FROM india_members;
DROP TABLE india_members;
ALTER TABLE india_members_v2 RENAME TO india_members;

CREATE TABLE IF NOT EXISTS india_marketing_leads (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 lead_number TEXT NOT NULL,
 account_name TEXT NOT NULL,
 source TEXT NOT NULL,
 campaign TEXT NOT NULL DEFAULT '',
 service_family TEXT NOT NULL,
 contact_name TEXT NOT NULL DEFAULT '',
 contact_email TEXT NOT NULL DEFAULT '',
 assigned_sales_email TEXT NOT NULL COLLATE NOCASE,
 estimated_value_idr INTEGER NOT NULL DEFAULT 0 CHECK(estimated_value_idr>=0),
 expected_closing_date TEXT NOT NULL DEFAULT '',
 qualification_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(qualification_json)),
 status TEXT NOT NULL DEFAULT 'new'
 CHECK(status IN ('new','assigned','qualified','disqualified','converted')),
 created_by TEXT NOT NULL COLLATE NOCASE,
 updated_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,lead_number)
);
CREATE INDEX IF NOT EXISTS idx_india_leads_owner ON india_marketing_leads(tenant_id,assigned_sales_email,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_india_leads_campaign ON india_marketing_leads(tenant_id,source,campaign,status);
CREATE TABLE IF NOT EXISTS india_marketing_activities (
 id TEXT PRIMARY KEY NOT NULL, tenant_id TEXT NOT NULL,
 lead_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('call','email','meeting','follow_up','note')),
 summary TEXT NOT NULL, next_action_at TEXT,
 created_by TEXT NOT NULL COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(lead_id) REFERENCES india_marketing_leads(id)
);
CREATE INDEX IF NOT EXISTS idx_india_lead_activities ON india_marketing_activities(tenant_id,lead_id,created_at DESC);
CREATE TABLE IF NOT EXISTS india_sales_lead_links (
 tenant_id TEXT NOT NULL,
 lead_id TEXT NOT NULL PRIMARY KEY,
 customer_id TEXT NOT NULL,
 opportunity_id TEXT NOT NULL UNIQUE,
 converted_by TEXT NOT NULL,
 converted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(lead_id) REFERENCES india_marketing_leads(id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES india_sales_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(5);
