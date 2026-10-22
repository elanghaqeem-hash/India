
-- INDIA Activity Orchestration v1, additive to canonical migration 0012.
-- Historical india_marketing_activities / india_sales_activities remain untouched.
-- Timestamps are UTC; SLA is initially elapsed clock time (not business hours).
CREATE TABLE india_sales_activity_policy (
 tenant_id TEXT PRIMARY KEY,
 lead_response_minutes INTEGER NOT NULL DEFAULT 120 CHECK(lead_response_minutes BETWEEN 15 AND 10080),
 escalation_minutes INTEGER NOT NULL DEFAULT 60 CHECK(escalation_minutes BETWEEN 0 AND 10080),
 reminder_minutes INTEGER NOT NULL DEFAULT 30 CHECK(reminder_minutes BETWEEN 0 AND 10080)
);
INSERT OR IGNORE INTO india_sales_activity_policy(tenant_id) VALUES('defendit360');

CREATE TABLE india_sales_team_managers (
 tenant_id TEXT NOT NULL,
 sales_email TEXT NOT NULL COLLATE NOCASE,
 manager_email TEXT NOT NULL COLLATE NOCASE,
 assigned_by TEXT NOT NULL COLLATE NOCASE,
 assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,sales_email),
 CHECK(sales_email<>manager_email)
);

CREATE TABLE india_sales_activity_tasks (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 lead_id TEXT REFERENCES india_marketing_leads(id),
 opportunity_id TEXT REFERENCES india_sales_opportunities(id),
 owner_email TEXT NOT NULL COLLATE NOCASE,
 kind TEXT NOT NULL CHECK(kind IN ('visit','call','meeting','follow_up')),
 subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 200),
 detail TEXT NOT NULL DEFAULT '',
 start_at TEXT NOT NULL,
 due_at TEXT NOT NULL,
 reminder_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','completed','cancelled')),
 outcome TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 completed_at TEXT,
 created_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((lead_id IS NOT NULL AND opportunity_id IS NULL) OR (lead_id IS NULL AND opportunity_id IS NOT NULL)),
 CHECK(datetime(start_at) IS NOT NULL AND datetime(due_at) IS NOT NULL AND datetime(reminder_at) IS NOT NULL),
 CHECK(datetime(due_at)>=datetime(start_at))
);
CREATE INDEX idx_india_activity_owner_due ON india_sales_activity_tasks(tenant_id,owner_email,status,due_at);
CREATE INDEX idx_india_activity_lead ON india_sales_activity_tasks(tenant_id,lead_id,created_at DESC);
CREATE INDEX idx_india_activity_opportunity ON india_sales_activity_tasks(tenant_id,opportunity_id,created_at DESC);


-- Prevent double-booking actual customer visits and meetings for the same Sales.
-- Follow-up deadlines and asynchronous calls intentionally do not block a calendar slot.
CREATE TRIGGER india_activity_meeting_conflict_insert BEFORE INSERT ON india_sales_activity_tasks
WHEN NEW.status='planned' AND NEW.kind IN ('visit','meeting')
 AND EXISTS(SELECT 1 FROM india_sales_activity_tasks t WHERE t.tenant_id=NEW.tenant_id
  AND t.owner_email=NEW.owner_email AND t.status='planned' AND t.kind IN ('visit','meeting')
  AND datetime(NEW.start_at)<datetime(t.due_at) AND datetime(NEW.due_at)>datetime(t.start_at))
BEGIN SELECT RAISE(ABORT,'ACTIVITY_CALENDAR_CONFLICT'); END;
CREATE TRIGGER india_activity_meeting_conflict_update BEFORE UPDATE OF start_at,due_at,kind,owner_email,status ON india_sales_activity_tasks
WHEN NEW.status='planned' AND NEW.kind IN ('visit','meeting')
 AND EXISTS(SELECT 1 FROM india_sales_activity_tasks t WHERE t.tenant_id=NEW.tenant_id AND t.id<>NEW.id
  AND t.owner_email=NEW.owner_email AND t.status='planned' AND t.kind IN ('visit','meeting')
  AND datetime(NEW.start_at)<datetime(t.due_at) AND datetime(NEW.due_at)>datetime(t.start_at))
BEGIN SELECT RAISE(ABORT,'ACTIVITY_CALENDAR_CONFLICT'); END;

CREATE TABLE india_sales_activity_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 task_id TEXT NOT NULL REFERENCES india_sales_activity_tasks(id),
 action TEXT NOT NULL CHECK(action IN ('scheduled','rescheduled','completed','cancelled')),
 actor_email TEXT NOT NULL COLLATE NOCASE,
 detail TEXT NOT NULL DEFAULT '',
 at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_india_activity_events ON india_sales_activity_events(tenant_id,task_id,at DESC);
CREATE TRIGGER india_activity_events_immutable_update BEFORE UPDATE ON india_sales_activity_events
BEGIN SELECT RAISE(ABORT,'ACTIVITY_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_activity_events_immutable_delete BEFORE DELETE ON india_sales_activity_events
BEGIN SELECT RAISE(ABORT,'ACTIVITY_HISTORY_IMMUTABLE'); END;

CREATE TABLE india_sales_lead_sla (
 tenant_id TEXT NOT NULL,
 lead_id TEXT NOT NULL REFERENCES india_marketing_leads(id),
 owner_email TEXT NOT NULL COLLATE NOCASE,
 assigned_at TEXT NOT NULL,
 response_due_at TEXT NOT NULL,
 first_response_at TEXT,
 baseline TEXT NOT NULL DEFAULT 'new' CHECK(baseline IN ('new','legacy_unverified')),
 PRIMARY KEY(tenant_id,lead_id)
);
CREATE INDEX idx_india_sla_open ON india_sales_lead_sla(tenant_id,first_response_at,response_due_at);
-- Seed SLA from genuine existing leads; do not infer a past response from note-only logs.
INSERT OR IGNORE INTO india_sales_lead_sla(tenant_id,lead_id,owner_email,assigned_at,response_due_at,baseline)
SELECT l.tenant_id,l.id,l.assigned_sales_email,strftime('%Y-%m-%dT%H:%M:%SZ','now'),
 strftime('%Y-%m-%dT%H:%M:%SZ','now',printf('+%d minutes',coalesce(p.lead_response_minutes,120))),'legacy_unverified'
FROM india_marketing_leads l LEFT JOIN india_sales_activity_policy p ON p.tenant_id=l.tenant_id
WHERE l.status NOT IN ('converted','disqualified');
CREATE TRIGGER india_lead_sla_new AFTER INSERT ON india_marketing_leads
BEGIN
 INSERT OR IGNORE INTO india_sales_lead_sla(tenant_id,lead_id,owner_email,assigned_at,response_due_at)
 VALUES(NEW.tenant_id,NEW.id,NEW.assigned_sales_email,strftime('%Y-%m-%dT%H:%M:%SZ','now'),
 strftime('%Y-%m-%dT%H:%M:%SZ','now',printf('+%d minutes',coalesce((SELECT lead_response_minutes FROM india_sales_activity_policy WHERE tenant_id=NEW.tenant_id),120))));
END;
CREATE TRIGGER india_lead_sla_reassigned AFTER UPDATE OF assigned_sales_email ON india_marketing_leads
WHEN NEW.assigned_sales_email<>OLD.assigned_sales_email
BEGIN
 UPDATE india_sales_lead_sla SET owner_email=NEW.assigned_sales_email,
 assigned_at=CASE WHEN first_response_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ','now') ELSE assigned_at END,
 response_due_at=CASE WHEN first_response_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ','now',printf('+%d minutes',coalesce((SELECT lead_response_minutes FROM india_sales_activity_policy WHERE tenant_id=NEW.tenant_id),120))) ELSE response_due_at END
 WHERE tenant_id=NEW.tenant_id AND lead_id=NEW.id;
END;

CREATE TABLE india_sales_activity_alerts (
 alert_key TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 task_id TEXT REFERENCES india_sales_activity_tasks(id),
 lead_id TEXT REFERENCES india_marketing_leads(id),
 recipient_email TEXT NOT NULL COLLATE NOCASE,
 alert_type TEXT NOT NULL CHECK(alert_type IN ('reminder','overdue','lead_sla','manager_escalation','unassigned_manager')),
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT,
 CHECK((task_id IS NOT NULL AND lead_id IS NULL) OR (task_id IS NULL AND lead_id IS NOT NULL))
);
CREATE INDEX idx_india_alert_recipient ON india_sales_activity_alerts(tenant_id,recipient_email,read_at,created_at DESC);
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(13);

-- Existing Lead records do not prove initial contact timestamps. Legacy backfill starts
-- a fresh grace window, marked unverified, rather than producing fabricated historic breaches.
CREATE TRIGGER india_activity_lead_closed AFTER UPDATE OF status ON india_marketing_leads
WHEN NEW.status IN ('converted','disqualified') AND OLD.status<>NEW.status
BEGIN
 INSERT INTO india_sales_activity_events(id,tenant_id,task_id,action,actor_email,detail)
 SELECT lower(hex(randomblob(16))),t.tenant_id,t.id,'cancelled','india-system','Lead closed: '||NEW.status
 FROM india_sales_activity_tasks t WHERE t.tenant_id=NEW.tenant_id AND t.lead_id=NEW.id AND t.status='planned';
 UPDATE india_sales_activity_tasks SET status='cancelled',outcome='Lead closed: '||NEW.status,revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE tenant_id=NEW.tenant_id AND lead_id=NEW.id AND status='planned';
END;
CREATE TRIGGER india_activity_deal_closed AFTER UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage IN ('closed_won','closed_lost') AND OLD.stage<>NEW.stage
BEGIN
 INSERT INTO india_sales_activity_events(id,tenant_id,task_id,action,actor_email,detail)
 SELECT lower(hex(randomblob(16))),t.tenant_id,t.id,'cancelled','india-system','Opportunity closed: '||NEW.stage
 FROM india_sales_activity_tasks t WHERE t.tenant_id=NEW.tenant_id AND t.opportunity_id=NEW.id AND t.status='planned';
 UPDATE india_sales_activity_tasks SET status='cancelled',outcome='Opportunity closed: '||NEW.stage,revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id AND status='planned';
END;
CREATE TRIGGER india_activity_lead_transfer AFTER UPDATE OF assigned_sales_email ON india_marketing_leads
WHEN NEW.assigned_sales_email<>OLD.assigned_sales_email
BEGIN
 INSERT INTO india_sales_activity_events(id,tenant_id,task_id,action,actor_email,detail)
 SELECT lower(hex(randomblob(16))),t.tenant_id,t.id,'rescheduled','india-system',
 'Owner transferred from '||OLD.assigned_sales_email||' to '||NEW.assigned_sales_email
 FROM india_sales_activity_tasks t WHERE t.tenant_id=NEW.tenant_id AND t.lead_id=NEW.id AND t.status='planned';
 UPDATE india_sales_activity_tasks SET owner_email=NEW.assigned_sales_email,revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE tenant_id=NEW.tenant_id AND lead_id=NEW.id AND status='planned';
END;
