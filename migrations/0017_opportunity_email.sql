-- Imported email is attributed to the authenticated importer, never treated as provider-authenticated evidence.
CREATE TABLE india_opportunity_emails(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,release_id TEXT,
 message_id TEXT NOT NULL,in_reply_to TEXT NOT NULL DEFAULT '',subject TEXT NOT NULL,
 sender_email TEXT NOT NULL,recipient_emails TEXT NOT NULL CHECK(json_valid(recipient_emails)),
 direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),sent_at TEXT NOT NULL,
 excerpt TEXT NOT NULL,source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
 verification TEXT NOT NULL DEFAULT 'imported_unverified' CHECK(verification='imported_unverified'),
 imported_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,message_id),UNIQUE(tenant_id,source_sha256),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(release_id) REFERENCES india_sales_releases(id)
);
CREATE INDEX india_email_opportunity ON india_opportunity_emails(tenant_id,opportunity_id,sent_at DESC);
ALTER TABLE india_sales_negotiations ADD COLUMN communication_id TEXT REFERENCES india_opportunity_emails(id);
CREATE TRIGGER india_email_immutable_update BEFORE UPDATE ON india_opportunity_emails
BEGIN SELECT RAISE(ABORT,'EMAIL_IMMUTABLE'); END;
CREATE TRIGGER india_email_immutable_delete BEFORE DELETE ON india_opportunity_emails
BEGIN SELECT RAISE(ABORT,'EMAIL_IMMUTABLE'); END;
CREATE TRIGGER india_negotiation_email_link BEFORE INSERT ON india_sales_negotiations
WHEN NEW.communication_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM india_opportunity_emails e WHERE e.id=NEW.communication_id
 AND e.tenant_id=NEW.tenant_id AND e.opportunity_id=NEW.opportunity_id AND e.direction='inbound' AND (e.release_id IS NULL OR e.release_id=NEW.release_id))
BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: email must belong to the same opportunity and release'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0017_opportunity_email.sql','p1-p2-integration');
INSERT INTO india_schema_migrations(version) VALUES(17);
