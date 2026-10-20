-- India / DefendIT360 BoQ persistent schema v1. Safe to re-run.
CREATE TABLE IF NOT EXISTS india_schema_migrations(
 version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS india_members(
 email TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), created_by TEXT);
CREATE TABLE IF NOT EXISTS india_boq(
 id TEXT PRIMARY KEY NOT NULL, tenant_id TEXT NOT NULL DEFAULT 'defendit360',
 project_name TEXT NOT NULL, customer_name TEXT NOT NULL, quotation_number TEXT NOT NULL,
 service_type TEXT NOT NULL, opportunity_id TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','archived')),
 currency TEXT NOT NULL DEFAULT 'IDR',
 vat_rate REAL NOT NULL DEFAULT 0 CHECK(vat_rate>=0 AND vat_rate<=1),
 payment_terms TEXT NOT NULL DEFAULT '30-50-20',
 line_items_json TEXT NOT NULL DEFAULT '[]',
 cost_items_json TEXT NOT NULL DEFAULT '[]',
 notes TEXT, created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
 approved_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(tenant_id,quotation_number,version));
CREATE INDEX IF NOT EXISTS idx_india_boq_tenant_updated ON india_boq(tenant_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS india_audit_log(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, boq_id TEXT, action TEXT NOT NULL,
 actor_email TEXT NOT NULL, summary TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_india_audit_tenant ON india_audit_log(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS india_catalog(
 sku TEXT PRIMARY KEY, category TEXT NOT NULL, description TEXT NOT NULL, unit TEXT NOT NULL,
 vendor TEXT, license_status TEXT NOT NULL DEFAULT 'verification_required',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(1);
-- The initial admin must be provisioned through an authorized operational change.
-- No hard-coded company accounts, passwords, or API keys in repository migrations.
