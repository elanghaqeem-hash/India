# INDIA — Lead Scoring, Nurturing & Disqualification (2026-10-22)

## Scope and dependency
- Branch: `feat/india-lead-scoring-nurturing-20261022`, based on deployed `main` (migrations 0001–0012).
- Additive migration `0014_lead_intelligence.sql`; 0013 is reserved for the independent open Sales Activity/SLA PR #21. Migration 0014 does NOT require 0013.
- Reuse existing canonical `india_marketing_leads`, BANT qualification, `india_marketing_activities`, immutable Customer/Opportunity links, `india_sales_audit` and Cloudflare Access JWT role membership.
- Production D1, Cloudflare Worker, real customers and Cloudflare Access policies must not be changed before signed UAT and review.

## Product rules
- Score = BANT completeness and positive budget signal (0–60) + customer fit / reachable data (0–25) + actually logged activity categories (0–15), clamped 0–100.
- Temperature = Hot 75–100, Warm 45–74, Cold 0–44. Version `v1`, explainable breakdown. This is a *data readiness and recorded engagement score*, not probability of buying; an email logged by a Sales member is not proven customer engagement.
- Qualified status requires existing BANT gates; scoring never promotes a Lead to Qualified or overrides PO and maker/checker gates.
- Reason codes: NO_BUDGET, NO_AUTHORITY, TIMING_LATER, NO_FIT, NO_RESPONSE, DUPLICATE, INVALID_CONTACT, OTHER. Mandatory factual reason text.
- Only NO_BUDGET, TIMING_LATER, NO_RESPONSE are eligible for automatic workflow reactivation. Other reasons need review through separate future Admin override; never reopen converted leads.
- Soft disqualification creates in-app nurture plan (7/14/30-day cadence based on temperature); hard reason cancels the plan. Plans can be created/updated manually, paused, resumed, completed; recording a touch posts a real Marketing activity and advances the next date.
- Nurturing does **not** send email, WhatsApp, or external messages without explicit consent and delivery integrations. It creates an operator due queue. PR #21 Cron integration remains separate and must be verified in UAT after reconciliation.
- Reactivation returns an eligible disqualified Lead to Assigned, retaining Lead ID, attribution, history, owner, and revalidating BANT via the existing flow. Qualified or Converted state completes any active nurture plan.
- Conversion analysis draws from all visible Leads with owner-scoped D1 queries, uses actual linked Opportunities and their Won stage, and includes an explicit `LEGACY_UNCLASSIFIED` bucket for historic disqualified Leads without stored reason codes. No fabricated history.

## Database and access integrity
1. Back up D1 and record backup SHA-256 and version/file ledger.
2. Restore into disposable, separate UAT D1. Verify counts of leads, activities, lead links, accounts, opportunities, members and audit rows.
3. Apply 0014 once after existing canonical migrations. Do not run against older PR18 legacy schema.
4. Check `PRAGMA foreign_key_check`, `PRAGMA quick_check`, reason/status consistency, table and index count, immutable event trigger rejection, and repeat migration refusal.
5. Run role UAT using genuine signed Cloudflare Access identities: Sales A, Sales B, Marketing, Admin, Viewer. Verify owner isolation, Origin validation, stale versions, concurrent touch and audit-failure rollback.
6. Verify a complete synthetic lifecycle on UAT only: Lead + BANT → score → soft disqualify → due nurture → touch → reactivate → Assigned → re-Qualified → single Customer/Opportunity conversion; plus permanent-reason denial, owner cross-read denial, legacy reason bucket and metric denominator checks.
7. Review PR #21’s migration 0013 and activity orchestrator: do not merge two out-of-order schemas without an isolated 0012→0013→0014 rehearsal; do not send duplicate reminders.
8. Only after CI + real UAT pass: reviewer-approved production backup, controlled forward migration 0013 (if merged) and 0014, deploy Worker, smoke-test JWT, D1 and mobile UI. Never downgrade schema to roll back app code.

## CI and local checks
- `npm run test:lead-intelligence`
- `npm run test:marketing` (includes above)
- `npm run typecheck`
- `npm run build`
- `npm run build:cf`
- Validate release on `/sales/leads`, `/sales/lead-intelligence`, `/api/marketing/lead-intelligence`, and existing `/api/marketing/leads`.
- Automated SQLite D1 adapter tests use **test-only mocked identities**, not genuine Cloudflare Access; must not be presented as live UAT.

## Not included in this incremental PR
Outbound automated communications, consent capture/provider sending, policy editor and score weight administration, machine-learning win probability, real Cloudflare Access human UAT, D1 production migration, Cron production installation.
