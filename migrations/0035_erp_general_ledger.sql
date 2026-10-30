-- WP6 general ledger foundation: approved balanced double entry, no auto-posting from commercial registers.
-- All amounts integer IDR cents and source IDs immutable. No synthetic opening balances.
CREATE TABLE india_gl_accounts (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 code TEXT NOT NULL,name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 160),
 category TEXT NOT NULL CHECK(category IN ('asset','liability','equity','revenue','expense')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,legal_entity_id,code),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id)
);
CREATE TRIGGER india_gl_account_entity BEFORE INSERT ON india_gl_accounts
WHEN NOT EXISTS(SELECT 1 FROM india_erp_org_units u WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.legal_entity_id AND u.kind='legal_entity' AND u.active=1)
BEGIN SELECT RAISE(ABORT,'GL_ENTITY_INVALID'); END;
CREATE TRIGGER india_gl_account_no_delete BEFORE DELETE ON india_gl_accounts BEGIN SELECT RAISE(ABORT,'GL_ACCOUNT_ARCHIVE_ONLY'); END;
CREATE TABLE india_gl_periods (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 period TEXT NOT NULL CHECK(period GLOB '20[0-9][0-9]-[0-1][0-9]'),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,legal_entity_id,period),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id)
);
CREATE TRIGGER india_gl_period_closed BEFORE UPDATE ON india_gl_periods
WHEN OLD.status='closed' BEGIN SELECT RAISE(ABORT,'GL_PERIOD_IMMUTABLE'); END;
CREATE TABLE india_gl_journals (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,legal_entity_id TEXT NOT NULL,
 period_id TEXT NOT NULL,source_type TEXT NOT NULL,source_key TEXT NOT NULL,
 memo TEXT NOT NULL CHECK(length(memo) BETWEEN 12 AND 500),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','posted','rejected')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by TEXT NOT NULL COLLATE NOCASE,reviewed_by TEXT COLLATE NOCASE,posted_by TEXT COLLATE NOCASE,
 review_notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,posted_at TEXT,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,source_type,source_key),
 FOREIGN KEY(tenant_id,legal_entity_id) REFERENCES india_erp_org_units(tenant_id,id),
 FOREIGN KEY(tenant_id,period_id) REFERENCES india_gl_periods(tenant_id,id),
 CHECK(reviewed_by IS NULL OR lower(reviewed_by)!=lower(created_by)),
 CHECK(status NOT IN ('approved','posted') OR (reviewed_by IS NOT NULL AND length(review_notes)>=12))
);
CREATE TABLE india_gl_lines (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,journal_id TEXT NOT NULL,
 account_id TEXT NOT NULL,debit_cents INTEGER NOT NULL DEFAULT 0 CHECK(debit_cents>=0 AND debit_cents<9000000000000000),
 credit_cents INTEGER NOT NULL DEFAULT 0 CHECK(credit_cents>=0 AND credit_cents<9000000000000000),
 description TEXT NOT NULL DEFAULT '',
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES india_gl_journals(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES india_gl_accounts(tenant_id,id),
 CHECK((debit_cents>0 AND credit_cents=0) OR (credit_cents>0 AND debit_cents=0))
);
CREATE INDEX india_gl_journal_period ON india_gl_journals(tenant_id,period_id,status);
CREATE INDEX india_gl_line_account ON india_gl_lines(tenant_id,account_id);
CREATE TRIGGER india_gl_line_guard BEFORE INSERT ON india_gl_lines
WHEN NOT EXISTS(SELECT 1 FROM india_gl_journals j
 JOIN india_gl_accounts a ON a.tenant_id=j.tenant_id AND a.legal_entity_id=j.legal_entity_id
 WHERE j.tenant_id=NEW.tenant_id AND j.id=NEW.journal_id AND j.status='draft' AND a.id=NEW.account_id AND a.active=1)
BEGIN SELECT RAISE(ABORT,'GL_LINE_ACCOUNT_OR_JOURNAL_INVALID'); END;
CREATE TRIGGER india_gl_line_immutable_update BEFORE UPDATE ON india_gl_lines BEGIN SELECT RAISE(ABORT,'GL_LINE_IMMUTABLE'); END;
CREATE TRIGGER india_gl_line_immutable_delete BEFORE DELETE ON india_gl_lines BEGIN SELECT RAISE(ABORT,'GL_LINE_IMMUTABLE'); END;
CREATE TRIGGER india_gl_journal_review BEFORE UPDATE ON india_gl_journals
BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id
 OR NEW.legal_entity_id IS NOT OLD.legal_entity_id OR NEW.period_id IS NOT OLD.period_id
 OR NEW.source_key IS NOT OLD.source_key OR NEW.source_type IS NOT OLD.source_type
 OR NEW.memo IS NOT OLD.memo OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
 OR NEW.version!=OLD.version+1 OR NOT (
 (OLD.status='draft' AND NEW.status IN ('approved','rejected'))
 OR (OLD.status='approved' AND NEW.status='posted')
 ) THEN RAISE(ABORT,'GL_JOURNAL_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status IN ('approved','posted') AND NOT EXISTS (
 SELECT 1 FROM india_gl_periods p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.period_id
 AND p.legal_entity_id=NEW.legal_entity_id AND p.status='open'
 ) THEN RAISE(ABORT,'GL_PERIOD_CLOSED') END;
 SELECT CASE WHEN NEW.status='approved' AND (
 (SELECT count(*) FROM india_gl_lines WHERE journal_id=NEW.id AND tenant_id=NEW.tenant_id)<2 OR
 (SELECT coalesce(sum(debit_cents),0) FROM india_gl_lines WHERE journal_id=NEW.id AND tenant_id=NEW.tenant_id)!=
 (SELECT coalesce(sum(credit_cents),0) FROM india_gl_lines WHERE journal_id=NEW.id AND tenant_id=NEW.tenant_id)
 ) THEN RAISE(ABORT,'GL_UNBALANCED') END;
 SELECT CASE WHEN NEW.status='posted' AND NEW.reviewed_by IS NULL THEN RAISE(ABORT,'GL_UNAPPROVED') END;
END;
CREATE TRIGGER india_gl_journal_no_delete BEFORE DELETE ON india_gl_journals BEGIN SELECT RAISE(ABORT,'GL_JOURNAL_IMMUTABLE'); END;
INSERT INTO india_schema_file_manifest(path,source_branch)
VALUES('migrations/0035_erp_general_ledger.sql','erp-finance');
INSERT INTO india_schema_migrations(version) VALUES(35);
