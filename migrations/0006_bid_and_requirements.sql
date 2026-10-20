-- INDIA 0006: tender decision, RKS/KAK checklist and submission evidence metadata.
-- Metadata is NOT an original document archive. Keep signed documents in approved secure storage.
CREATE TABLE IF NOT EXISTS india_sales_bids (
 opportunity_id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('direct','rfq','rfp','tender')),
 tender_number TEXT NOT NULL DEFAULT '',
 tender_deadline TEXT NOT NULL DEFAULT '',
 summary TEXT NOT NULL DEFAULT '',
 bid_decision TEXT NOT NULL DEFAULT 'pending' CHECK(bid_decision IN ('pending','go','conditional_go','no_go')),
 decision_reason TEXT NOT NULL DEFAULT '',
 proposed_by TEXT NOT NULL,
 decided_by TEXT,
 decided_at TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_sales_bids_decision ON india_sales_bids(tenant_id,bid_decision,updated_at DESC);
CREATE TABLE IF NOT EXISTS india_sales_requirements (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 opportunity_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('rks','kak','rfp','rfq','nda','technical','commercial','vendor_quote','clarification')),
 title TEXT NOT NULL,
 file_reference TEXT NOT NULL DEFAULT '',
 file_name TEXT NOT NULL DEFAULT '',
 source_content_hash TEXT NOT NULL DEFAULT '',
 requirement_summary TEXT NOT NULL DEFAULT '',
 compliance_status TEXT NOT NULL DEFAULT 'pending' CHECK(compliance_status IN ('pending','compliant','partial','non_compliant','not_applicable')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','superseded')),
 review_notes TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 reviewed_by TEXT,
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_sales_requirements_opportunity ON india_sales_requirements(tenant_id,opportunity_id,kind,status);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(6);
