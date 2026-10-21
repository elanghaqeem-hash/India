-- INDIA 0007: Quotation transmission and independent receipt-evidence review.
-- Store references/checksums, NOT SMTP messages or original document bytes.
CREATE TABLE IF NOT EXISTS india_sales_submissions(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 opportunity_id TEXT NOT NULL,
 boq_id TEXT NOT NULL,
 quotation_number TEXT NOT NULL,
 boq_version INTEGER NOT NULL,
 recipient_email TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('email','procurement_portal','physical')),
 sent_at TEXT NOT NULL,
 evidence_reference TEXT NOT NULL,
 evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','verified','rejected','superseded')),
 created_by TEXT NOT NULL,
 verified_by TEXT,
 reviewed_at TEXT,
 review_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id,boq_id,boq_version,recipient_email),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(boq_id) REFERENCES india_boq(id)
);
CREATE INDEX IF NOT EXISTS idx_sales_submission_stage ON india_sales_submissions(tenant_id,opportunity_id,status,created_at DESC);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(7);
