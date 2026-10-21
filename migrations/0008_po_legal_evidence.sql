-- INDIA 0008: Original award/PO/contract evidence register with independent Finance and Legal reviews.
-- SHA and external reference do not store original file bytes. Archival must be separately governed.
CREATE TABLE IF NOT EXISTS india_sales_award_documents (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 opportunity_id TEXT NOT NULL,
 document_kind TEXT NOT NULL CHECK(document_kind IN ('po','spk','contract','award_letter')),
 document_number TEXT NOT NULL,
 file_name TEXT NOT NULL DEFAULT '',
 archive_reference TEXT NOT NULL,
 original_sha256 TEXT NOT NULL CHECK(length(original_sha256)=64),
 created_by TEXT NOT NULL,
 finance_reviewed_by TEXT,
 finance_reviewed_at TEXT,
 finance_review_notes TEXT NOT NULL DEFAULT '',
 legal_reviewed_by TEXT,
 legal_reviewed_at TEXT,
 legal_review_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_india_award_gate ON india_sales_award_documents(tenant_id,opportunity_id,document_kind,created_at DESC);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(8);
