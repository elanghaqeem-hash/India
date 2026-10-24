-- Reopening a soft-disqualified lead starts an auditable fresh response SLA.
CREATE TABLE india_lead_sla_history(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,lead_id TEXT NOT NULL REFERENCES india_marketing_leads(id),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER india_lead_sla_history_update BEFORE UPDATE ON india_lead_sla_history
BEGIN SELECT RAISE(ABORT,'SLA_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_lead_sla_history_delete BEFORE DELETE ON india_lead_sla_history
BEGIN SELECT RAISE(ABORT,'SLA_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_lead_reactivated_sla AFTER UPDATE OF status ON india_marketing_leads
WHEN OLD.status='disqualified' AND NEW.status IN ('new','assigned')
BEGIN
 INSERT INTO india_lead_sla_history(id,tenant_id,lead_id,snapshot_json)
 SELECT lower(hex(randomblob(16))),tenant_id,lead_id,json_object('owner_email',owner_email,'assigned_at',assigned_at,'response_due_at',response_due_at,'first_response_at',first_response_at,'baseline',baseline)
 FROM india_sales_lead_sla WHERE tenant_id=NEW.tenant_id AND lead_id=NEW.id;
 UPDATE india_sales_lead_sla SET owner_email=NEW.assigned_sales_email,first_response_at=NULL,baseline='new',assigned_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),
 response_due_at=strftime('%Y-%m-%dT%H:%M:%SZ','now',printf('+%d minutes',coalesce((SELECT lead_response_minutes FROM india_sales_activity_policy WHERE tenant_id=NEW.tenant_id),120)))
 WHERE tenant_id=NEW.tenant_id AND lead_id=NEW.id;
END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0020_activity_lead_intelligence.sql','p1-p2-integration');
INSERT INTO india_schema_migrations(version) VALUES(20);
