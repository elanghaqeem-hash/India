-- INDIA 0014: additive lead intelligence, after 0012 (0013 is reserved for Sales Activity PR #21).
-- No fixture rows, historic reason-code fabrication or destructive status backfill.
CREATE TABLE india_lead_disqualifications(
 lead_id TEXT PRIMARY KEY NOT NULL REFERENCES india_marketing_leads(id),
 tenant_id TEXT NOT NULL,
 reason_code TEXT NOT NULL CHECK(reason_code IN ('NO_BUDGET','NO_AUTHORITY','TIMING_LATER','NO_FIT','NO_RESPONSE','DUPLICATE','INVALID_CONTACT','OTHER')),
 reason_text TEXT NOT NULL CHECK(length(trim(reason_text))>=3),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 changed_by TEXT NOT NULL COLLATE NOCASE,
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_india_lead_disq_reason ON india_lead_disqualifications(tenant_id,active,reason_code);
CREATE TABLE india_lead_nurture_plans(
 lead_id TEXT PRIMARY KEY NOT NULL REFERENCES india_marketing_leads(id),
 tenant_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','paused','completed','cancelled')),
 cadence_days INTEGER NOT NULL CHECK(cadence_days IN (7,14,30,60,90)),
 channel TEXT NOT NULL CHECK(channel IN ('call','email','meeting','follow_up')),
 next_touch_at TEXT NOT NULL CHECK(next_touch_at GLOB '????-??-??'),
 last_touch_at TEXT,
 touch_count INTEGER NOT NULL DEFAULT 0 CHECK(touch_count>=0),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 created_by TEXT NOT NULL COLLATE NOCASE,
 updated_by TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_india_nurture_due ON india_lead_nurture_plans(tenant_id,state,next_touch_at);
CREATE TABLE india_lead_intelligence_events(
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 lead_id TEXT NOT NULL REFERENCES india_marketing_leads(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('DISQUALIFY','PLAN','TOUCH','PAUSE','RESUME','REACTIVATE','COMPLETE')),
 actor_email TEXT NOT NULL COLLATE NOCASE,
 reason_code TEXT,
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_india_lead_intelligence_events ON india_lead_intelligence_events(tenant_id,lead_id,created_at DESC);
CREATE TRIGGER india_lead_intelligence_events_immutable_update BEFORE UPDATE ON india_lead_intelligence_events
BEGIN SELECT RAISE(ABORT,'Lead lifecycle events are immutable'); END;
CREATE TRIGGER india_lead_intelligence_events_immutable_delete BEFORE DELETE ON india_lead_intelligence_events
BEGIN SELECT RAISE(ABORT,'Lead lifecycle events are immutable'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch)
 VALUES('migrations/0014_lead_intelligence.sql','lead-intelligence');
INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(14);
