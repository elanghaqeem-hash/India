# INDIA Marketing–Sales consolidation: database compatibility gate (2026-10-22)

Status: integration branch; NOT a production release.

## Verified collision between PR #12 and PR #18
Both PRs independently define india_marketing_leads with incompatible column sets, workflow status enums, and distinct migration files sharing version 0005 and 0006. PR #12 also rebuilds india_members to introduce marketing/legal roles, while PR #18 uses existing roles. Both define normalized unique Sales Account indexes. GitHub's "mergeable" status does NOT mean schema compatibility.

## Canonical database baseline
The dedicated UAT D1 eaed652e-7322-4950-a304-dd50baa5de02 has migration versions 4,5,6 (0005_india_lead_management and 0006_india_lead_conversion_integrity). Keep PR #18's lead table and atomic conversion route as the canonical source. Existing lead IDs, converted_account_id, converted_opportunity_id, version CAS and audit history must remain unchanged.

## Safe integration plan
1. Freeze PR #12's 0005_marketing_lead_flow.sql and 0006_bid_and_requirements.sql: DO NOT execute these against UAT or production, and DO NOT merge both numbered migration series as-is.
2. Add PR #12 capabilities as new, forward-only migrations starting at 0011 or later (after auditing every version 0007–0010 for compatibility); keep canonical india_marketing_leads. New tables: campaigns, marketing activities, bid requirements, submission, award evidence, idempotency. Add only missing lead columns with explicit backfill, constraints and integrity checks.
3. Consolidate API to one canonical /api/leads CRUD and /api/leads/convert; legacy /api/marketing/leads must be a backwards-compatible adapter or retired after callers are migrated. Never have two independent Lead stores.
4. Map fields: account_name → company_name, source → lead_source, campaign → campaign_code, service_family → service_interest, assigned_sales_email → owner_email, expected_closing_date → target_date. Preserve estimated_value_idr and qualification_json as additive fields or typed extensions, not destructive replacements.
5. Map status assigned/contacted via an explicit stage policy and maintain audit of every transition. Do not silently translate historical statuses.
6. Introduce Marketing RBAC via additive membership migration, not PR #12's DROP/RENAME on live india_members without foreign-key and auth review.
7. Run negative, duplicate, stale-version, cross-owner, Sales A/B/Admin, rollback, and Cloudflare Access real-JWT browser UAT on isolated D1 before merge.

## Non-negotiable release gates
- Full schema version registry with exactly one meaning per version; no duplicate 0005/0006.
- PRAGMA foreign_key_check = 0; normalized customer duplicates = 0; orphan lead links = 0.
- Existing 2 synthetic UAT lead conversions and Sales Account/Opportunity records remain intact.
- No legacy in-memory opportunity path used for production transactions.
- All new mutations require Cloudflare Access JWT, tenant + owner scoping, RBAC, CSRF, and audit.
- CI typecheck, Next 16.4.2 build, OpenNext bundle, regression and browser/HTTP UAT pass.
- Explicit approval required for production migration and deployment.

## Current evidence
Cloudflare isolated UAT 0005/0006 applied and two synthetic SQL conversion records created 2026-10-22; D1 FK check returned zero violations. This does not prove real Cloudflare Access login, browser E2E, or D1 db.batch atomicity. PR #12 and #18 remain Draft and unmerged.
