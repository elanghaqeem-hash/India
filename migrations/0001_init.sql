-- ICOP CyberBusiness 360 / India
-- D1 SQLite migration 0001. Staging only; deliberately no demo/customer seeds.
-- Source PostgreSQL specification files remain reference, not executable on D1.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  external_subject TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','head_sales','sales','pre_sales','channel_partner','project_manager','pentest_lead','pentest_member','approval_pentest','soc_lead','soc_analyst','finance','collection','admin_legal','strategic_legal','hr','management','client_maker','client_approver')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,external_subject)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id,role);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  legal_name TEXT NOT NULL,
  customer_number TEXT,
  data_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(data_json)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,customer_number),
  FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'prospecting' CHECK(stage IN ('prospecting','qualified','quotation_sent','negotiation','po_received','closed_won','closed_lost')),
  estimated_value_idr INTEGER NOT NULL DEFAULT 0 CHECK(estimated_value_idr>=0),
  data_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(data_json)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,company_id) REFERENCES companies(tenant_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage ON opportunities(tenant_id,stage);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  quotation_number TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','sent','accepted','rejected','expired','cancelled')),
  grand_total_idr INTEGER NOT NULL DEFAULT 0 CHECK(grand_total_idr>=0),
  data_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(data_json)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,quotation_number),
  FOREIGN KEY(tenant_id,company_id) REFERENCES companies(tenant_id,id),
  FOREIGN KEY(tenant_id,opportunity_id) REFERENCES opportunities(tenant_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status ON proposals(tenant_id,status);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revision_requested')),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_at TEXT,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,proposal_id) REFERENCES proposals(tenant_id,id),
  FOREIGN KEY(tenant_id,requested_by) REFERENCES users(tenant_id,id),
  FOREIGN KEY(tenant_id,decided_by) REFERENCES users(tenant_id,id),
  CHECK(status != 'approved' OR (decided_by IS NOT NULL AND decided_by != requested_by))
);
CREATE INDEX IF NOT EXISTS idx_approvals_tenant_status ON approvals(tenant_id,status);

-- 1 unit = 0.01 manday. Integer accounting prevents rounding drift.
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  contract_number TEXT NOT NULL,
  purchased_units INTEGER NOT NULL DEFAULT 0 CHECK(purchased_units >= 0),
  available_units INTEGER NOT NULL DEFAULT 0 CHECK(available_units >= 0),
  reserved_units INTEGER NOT NULL DEFAULT 0 CHECK(reserved_units >= 0),
  consumed_units INTEGER NOT NULL DEFAULT 0 CHECK(consumed_units >= 0),
  expires_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,contract_number),
  FOREIGN KEY(tenant_id,company_id) REFERENCES companies(tenant_id,id),
  CHECK(purchased_units = available_units + reserved_units + consumed_units)
);
CREATE INDEX IF NOT EXISTS idx_wallets_tenant ON wallets(tenant_id,company_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  tx_type TEXT NOT NULL CHECK(tx_type IN ('ISSUANCE','TOPUP','RESERVE','RELEASE','DEBIT')),
  amount_units INTEGER NOT NULL CHECK(amount_units>0),
  reference_code TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  service_scope TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id,idempotency_key),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,wallet_id) REFERENCES wallets(tenant_id,id),
  FOREIGN KEY(tenant_id,performed_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_date ON wallet_transactions(tenant_id,wallet_id,created_at);

-- A ledger insert and balance update are one SQLite statement/transaction.
-- RAISE(ABORT) rejects invalid movement and rolls back the ledger insert.
CREATE TRIGGER IF NOT EXISTS wallet_ledger_apply
AFTER INSERT ON wallet_transactions
BEGIN
  SELECT RAISE(ABORT,'wallet_expired')
   WHERE NEW.tx_type IN ('RESERVE','DEBIT') AND
         (SELECT expires_on FROM wallets WHERE tenant_id=NEW.tenant_id AND id=NEW.wallet_id) < date('now');
  SELECT RAISE(ABORT,'insufficient_available')
   WHERE NEW.tx_type='RESERVE' AND
         (SELECT available_units FROM wallets WHERE tenant_id=NEW.tenant_id AND id=NEW.wallet_id) < NEW.amount_units;
  SELECT RAISE(ABORT,'insufficient_reserved')
   WHERE NEW.tx_type IN ('RELEASE','DEBIT') AND
         (SELECT reserved_units FROM wallets WHERE tenant_id=NEW.tenant_id AND id=NEW.wallet_id) < NEW.amount_units;

  UPDATE wallets SET
    purchased_units = purchased_units + CASE WHEN NEW.tx_type IN ('ISSUANCE','TOPUP') THEN NEW.amount_units ELSE 0 END,
    available_units = available_units +
      CASE WHEN NEW.tx_type IN ('ISSUANCE','TOPUP','RELEASE') THEN NEW.amount_units
           WHEN NEW.tx_type='RESERVE' THEN -NEW.amount_units ELSE 0 END,
    reserved_units = reserved_units +
      CASE WHEN NEW.tx_type='RESERVE' THEN NEW.amount_units
           WHEN NEW.tx_type IN ('RELEASE','DEBIT') THEN -NEW.amount_units ELSE 0 END,
    consumed_units = consumed_units +
      CASE WHEN NEW.tx_type='DEBIT' THEN NEW.amount_units ELSE 0 END
  WHERE tenant_id=NEW.tenant_id AND id=NEW.wallet_id;
END;

CREATE TRIGGER IF NOT EXISTS wallet_ledger_immutable_update
BEFORE UPDATE ON wallet_transactions
BEGIN
  SELECT RAISE(ABORT,'immutable_wallet_ledger');
END;

CREATE TRIGGER IF NOT EXISTS wallet_ledger_immutable_delete
BEFORE DELETE ON wallet_transactions
BEGIN
  SELECT RAISE(ABORT,'immutable_wallet_ledger');
END;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(tenant_id) REFERENCES tenants(id),
  FOREIGN KEY(tenant_id,actor_user_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_events(tenant_id,created_at);
CREATE TRIGGER IF NOT EXISTS audit_events_immutable_update
BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT,'immutable_audit_event'); END;
CREATE TRIGGER IF NOT EXISTS audit_events_immutable_delete
BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT,'immutable_audit_event'); END;

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0001_init');
