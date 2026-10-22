-- Pre-bridge for the REAL PR18 UAT schema. This is NOT a standard numbered migration.
-- Run only after VERIFIED BACKUP and the read-only shape/integrity preflight.
-- The migration orchestrator must wrap PRE + PR12 0005..0010 + 0011 + POST in one transaction.
-- Never run on a canonical PR12 database or on production without release approval.
ALTER TABLE india_marketing_leads RENAME TO india_marketing_leads_phase18_archive;
ALTER TABLE india_marketing_lead_events RENAME TO india_marketing_lead_events_phase18_archive;
-- This index name otherwise collides with PR12's canonical lead-owner index.
DROP INDEX IF EXISTS idx_india_leads_owner;
