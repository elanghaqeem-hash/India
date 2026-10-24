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

## Isolated Cloudflare D1 execution — 22 October 2026

- UAT source: `india-uat-users-db` / `eaed652e-7322-4950-a304-dd50baa5de02`, initial max migration=13 and `quick_check=ok` / FK=0.
- A fresh **Cloudflare SQL export was generated** at bookmark `00000022-00000000-0000510c-18b487aa3247d1f368ca0945773b423f`. The export URL is short-lived and not stored in GitHub; an offline/downloaded copy could not be obtained in this execution environment.
- Creating another restore DB failed safely: Cloudflare quota 7406 (10 databases per account). Reused previously restored PR21 clone `4539347e-3fdb-4442-997d-4fa69847525d`. All 126 schema objects compared equal; readable application rows matched, apart from SQL migration ledger timestamps. Reserved Cloudflare internal `_cf_KV` does not permit normal query-based comparison.
- Migration `0014_lead_intelligence.sql` rehearsed on the restore clone **first**, then applied to UAT source in an independent 11-statement D1 API batch. Both now show version 14, empty new nurture tables, `quick_check=ok`, zero FK violations. UAT source still retains two preexisting Lead rows, eight members, two Lead/Opportunity links, and fourteen Sales audit records.
- Production binding `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5` remains on max version 12; no production D1 or Worker deployment occurred.
- Signed-human five-role UAT remains **BLOCKED**: Cloudflare Access on `uat-india.elang-haqeem.workers.dev` permits only the approved real administrator; UAT Sales A and B identities are `.invalid` fixtures, and no real Marketing/Viewer signed sessions are available. Its frontend release SHA remains `8de0717aae6b406f9d217a855e28c85ff40bc238` (not PR #22). No fake JWTs, role-policy weakening, or false HTTP/browser UAT PASS.
- PR #21 Cron source now conditionally enables versioned nurturing reminders after migration 0014. Its [GitHub activity CI run](https://github.com/elanghaqeem-hash/India/actions/runs/39737795151) passed. The UAT Cron Worker upload succeeded with version `5bb2c333-cf49-4a80-8c20-cea2ad87e60c` and UAT-only D1 binding. Actual scheduled invocation of that exact version and idempotency remain a separate evidence gate.

## Revised PR #21 Cron / 0014 UAT probe result
The real UAT scheduled Worker version `5bb2c333-cf49-4a80-8c20-cea2ad87e60c` is deployed at 100% with only the UAT D1 binding. Synthetic active plan `pr22-uat-nurture-probe-20261022` was due before current WIB date. D1 reported **0** matching alerts before Cron; at **2026-10-22 07:15:48 UTC** it had **1** versioned `lead:nurture:` reminder without manual alert SQL replay. At 07:18:53 UTC count was still one. No claim is made for an independently logged second invocation after the upload: observability was temporarily unset by the upload and subsequently restored; two-tick live proof is an outstanding release gate. The test cadence `* * * * *` was restored to `*/15 * * * *`, and all probe records were cleaned. Original UAT counts and database integrity were reverified.
Five-role signed human Access UAT remains **blocked** pending real test identities, revised UAT Access allow policy approval and deployment of the reviewed frontend branch. No production migration or deployment.
