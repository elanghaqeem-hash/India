-- INDIA canonical 0030 FlexGuard, after 0029 PR32 postal. NEVER apply to production before release gates.
CREATE TABLE india_migration_0030_dependency(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO india_migration_0030_dependency(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM india_schema_migrations WHERE version=29) THEN 1 ELSE 0 END;
DROP TABLE india_migration_0030_dependency;

CREATE TABLE india_flexguard_wallets(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 customer_id TEXT NOT NULL,
 contract_id TEXT NOT NULL,
 entitlement_units INTEGER NOT NULL CHECK(entitlement_units BETWEEN 1 AND 100000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active')),
 created_by TEXT NOT NULL COLLATE NOCASE,
 approved_by TEXT,
 approved_at TEXT,
 approved_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,contract_id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES india_sales_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,contract_id) REFERENCES india_service_contracts(tenant_id,id),
 CHECK(status!='active' OR (approved_by IS NOT NULL AND lower(approved_by)!=lower(created_by) AND length(approved_notes)>=12))
);
CREATE TABLE india_flexguard_events(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 wallet_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('ISSUE','TOPUP','RESERVE','RELEASE','DEBIT','REFUND','EXPIRY')),
 units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 100000),
 invoice_id TEXT,
 opportunity_id TEXT,
 source_event_id TEXT,
 document_id TEXT,
 request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 16 AND 128),
 actor_email TEXT NOT NULL,
 explanation TEXT NOT NULL CHECK(length(explanation) BETWEEN 12 AND 1000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,request_key),UNIQUE(wallet_id,invoice_id),
 FOREIGN KEY(tenant_id,wallet_id) REFERENCES india_flexguard_wallets(tenant_id,id),
 FOREIGN KEY(invoice_id) REFERENCES india_billing_invoices(id),
 FOREIGN KEY(opportunity_id) REFERENCES india_sales_opportunities(id),
 FOREIGN KEY(source_event_id) REFERENCES india_flexguard_events(id)
);
CREATE INDEX india_flexguard_wallet_customer ON india_flexguard_wallets(tenant_id,customer_id,status);
CREATE INDEX india_flexguard_event_wallet ON india_flexguard_events(tenant_id,wallet_id,created_at);
CREATE INDEX india_flexguard_event_source ON india_flexguard_events(source_event_id,kind);
CREATE TRIGGER india_flexguard_wallet_no_delete BEFORE DELETE ON india_flexguard_wallets BEGIN SELECT RAISE(ABORT,'FLEXGUARD_IMMUTABLE'); END;
CREATE TRIGGER india_flexguard_wallet_frozen BEFORE UPDATE ON india_flexguard_wallets
WHEN OLD.status='active' OR NEW.status!='active'
 OR NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.customer_id!=OLD.customer_id
 OR NEW.contract_id!=OLD.contract_id OR NEW.entitlement_units!=OLD.entitlement_units
 OR lower(NEW.created_by)!=lower(OLD.created_by)
BEGIN SELECT RAISE(ABORT,'FLEXGUARD_IMMUTABLE'); END;
CREATE TRIGGER india_flexguard_event_no_update BEFORE UPDATE ON india_flexguard_events BEGIN SELECT RAISE(ABORT,'FLEXGUARD_IMMUTABLE'); END;
CREATE TRIGGER india_flexguard_event_no_delete BEFORE DELETE ON india_flexguard_events BEGIN SELECT RAISE(ABORT,'FLEXGUARD_IMMUTABLE'); END;
CREATE TRIGGER india_flexguard_event_guards BEFORE INSERT ON india_flexguard_events BEGIN
 SELECT CASE WHEN NOT EXISTS(
   SELECT 1 FROM india_flexguard_wallets w JOIN india_service_contracts c ON c.id=w.contract_id AND c.tenant_id=w.tenant_id
   WHERE w.id=NEW.wallet_id AND w.tenant_id=NEW.tenant_id AND w.status='active'
   AND c.status='active' AND c.model='FlexGuard' AND c.end_date>=date('now')
 ) AND NEW.kind!='EXPIRY' THEN RAISE(ABORT,'FLEXGUARD_WALLET_NOT_ACTIVE') END;
 SELECT CASE WHEN NEW.kind='EXPIRY' AND NOT EXISTS(
   SELECT 1 FROM india_flexguard_wallets w JOIN india_service_contracts c ON c.id=w.contract_id
   WHERE w.id=NEW.wallet_id AND c.end_date<date('now')
 ) THEN RAISE(ABORT,'FLEXGUARD_NOT_EXPIRED') END;
 SELECT CASE WHEN NEW.kind IN ('ISSUE','TOPUP') AND NOT EXISTS(
   SELECT 1 FROM india_flexguard_wallets w
   JOIN india_service_contracts c ON c.id=w.contract_id AND c.tenant_id=w.tenant_id
   JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id
   JOIN india_billing_invoices i ON i.project_id=p.id AND i.tenant_id=p.tenant_id
   WHERE w.id=NEW.wallet_id AND w.tenant_id=NEW.tenant_id AND i.id=NEW.invoice_id
   AND i.status='approved' AND
   (SELECT coalesce(sum(pay.amount_cents),0) FROM india_billing_payments pay
     WHERE pay.tenant_id=i.tenant_id AND pay.invoice_id=i.id AND pay.status='approved')>=i.amount_cents+i.vat_cents
 ) THEN RAISE(ABORT,'FLEXGUARD_PAYMENT_UNVERIFIED') END;
 SELECT CASE WHEN NEW.kind IN ('ISSUE','TOPUP') AND
  (SELECT coalesce(sum(e.units),0) FROM india_flexguard_events e
    WHERE e.wallet_id=NEW.wallet_id AND e.kind IN ('ISSUE','TOPUP'))+NEW.units >
  (SELECT entitlement_units FROM india_flexguard_wallets WHERE id=NEW.wallet_id)
 THEN RAISE(ABORT,'FLEXGUARD_QUOTA_EXCEEDED') END;
 SELECT CASE WHEN NEW.kind NOT IN ('ISSUE','TOPUP') AND NEW.invoice_id IS NOT NULL
  THEN RAISE(ABORT,'FLEXGUARD_INVOICE_INVALID') END;
 SELECT CASE WHEN NEW.kind IN ('RESERVE','RELEASE','DEBIT') AND NOT EXISTS(
  SELECT 1 FROM india_flexguard_wallets w JOIN india_service_contracts c ON c.id=w.contract_id
  JOIN india_delivery_projects p ON p.id=c.project_id
  JOIN india_sales_opportunities d ON d.company_id=p.customer_id AND d.tenant_id=p.tenant_id
  WHERE w.id=NEW.wallet_id AND d.id=NEW.opportunity_id AND d.stage='closed_won'
 ) THEN RAISE(ABORT,'FLEXGUARD_OPPORTUNITY_INVALID') END;
 SELECT CASE WHEN NEW.kind IN ('RESERVE','EXPIRY') AND
  NEW.units>(SELECT coalesce(sum(CASE e.kind
    WHEN 'ISSUE' THEN e.units WHEN 'TOPUP' THEN e.units
    WHEN 'RELEASE' THEN e.units WHEN 'REFUND' THEN e.units
    WHEN 'RESERVE' THEN -e.units WHEN 'EXPIRY' THEN -e.units ELSE 0 END),0)
    FROM india_flexguard_events e WHERE e.wallet_id=NEW.wallet_id)
  THEN RAISE(ABORT,'FLEXGUARD_INSUFFICIENT_AVAILABLE') END;
 SELECT CASE WHEN NEW.kind IN ('RELEASE','DEBIT') AND NOT EXISTS(
  SELECT 1 FROM india_flexguard_events src
  WHERE src.id=NEW.source_event_id AND src.wallet_id=NEW.wallet_id AND src.kind='RESERVE'
    AND src.opportunity_id=NEW.opportunity_id
    AND src.units>=NEW.units+coalesce((SELECT sum(t.units) FROM india_flexguard_events t
         WHERE t.source_event_id=src.id AND t.kind IN ('RELEASE','DEBIT')),0)
 ) THEN RAISE(ABORT,'FLEXGUARD_RESERVATION_EXCEEDED') END;
 SELECT CASE WHEN NEW.kind='REFUND' AND NOT EXISTS(
   SELECT 1 FROM india_flexguard_events src WHERE src.id=NEW.source_event_id
    AND src.kind='DEBIT' AND src.wallet_id=NEW.wallet_id
    AND src.units>=NEW.units+coalesce((SELECT sum(t.units) FROM india_flexguard_events t
        WHERE t.source_event_id=src.id AND t.kind='REFUND'),0)
 ) THEN RAISE(ABORT,'FLEXGUARD_REFUND_EXCEEDED') END;
 SELECT CASE WHEN NEW.kind='DEBIT' AND (NEW.document_id IS NULL OR length(NEW.document_id)<8)
  THEN RAISE(ABORT,'FLEXGUARD_EVIDENCE_MISSING') END;
 SELECT CASE WHEN NEW.kind IN ('RELEASE','DEBIT','REFUND') AND NEW.source_event_id IS NULL
  THEN RAISE(ABORT,'FLEXGUARD_SOURCE_MISSING') END;
END;
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0030_flexguard_immutable_ledger.sql','flexguard-canonical-d1');
INSERT INTO india_schema_migrations(version) VALUES(30);
