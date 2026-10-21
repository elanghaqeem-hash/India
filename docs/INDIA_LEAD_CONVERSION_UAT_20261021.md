# INDIA — Marketing Lead → Customer → Opportunity: Implementation and UAT

Date: 2026-10-21. Branch: `feat/india-unified-commercial-cycle-phase1-20261021`.
Status: **code implemented + GitHub CI simulator tested**. **NOT remotely migrated or deployed to active Worker**.

## Implemented

- `/marketing/leads`: mobile responsive capture and search; role-aware list (Sales own Leads / Admin all), stage updates, edit qualification fields, reasoned re-open, conversion form, post-conversion link to Sales Pipeline.
- `/api/leads`: authenticated CRUD subset (GET, POST, PATCH), strictly scoped Sales ownership, duplicate normalized email+company prevention, optimistic version, audit, reject unauthenticated roles. Qualified Lead immutable unless explicitly REOPEN with reason.
- `/api/leads/convert`: Sales/Admin-only POST. Validates qualification, company profile, customer identity, owner, positive estimated project value, session origin, explicit intent header. A **single Cloudflare D1 `db.batch` transaction** CAS-converts Lead, inserts Sales Account, inserts Sales Opportunity, writes Lead and Sales audit records; every write is guarded by the same lead/version/created customer & opportunity IDs. Any SQL constraint error rolls back the batch, and repeated conversion cannot create duplicate sales objects. If normalized company already exists, API returns 409 instead of making a duplicate; linking an existing account is a separate future workflow.
- `/api/sales` + `/sales/pipeline`: compatible Sales D1 handler/UI integrated from previously tested snapshot. Owners set from Lead `owner_email`, including Admin-initiated conversion.
- `migrations/0003_sales_workflow.sql`, `0004_india_sales_isolation.sql`, `0005_india_lead_management.sql`, `0006_india_lead_conversion_integrity.sql`: additive schema; does not modify legacy `companies`/`opportunities` data.
- Middleware explicitly lets the JWT-checking Lead and Sales APIs through, while blocking legacy in-memory demo APIs.
- Next.js `16.4.2` + React 19 on integration branch, with Cloudflare OpenNext packaging gate.

## Required production database rollout sequence

1. Back up the target D1 and verify binding name; **never run migrations against a production Worker by mistake**.
2. Preflight unique constraints, specifically `SELECT tenant_id,lower(trim(legal_name)),COUNT(*) FROM india_sales_accounts GROUP BY tenant_id,lower(trim(legal_name)) HAVING COUNT(*)>1` before migration 0006; resolve duplicates by a reviewed data correction, not silent deletion.
3. On dedicated UAT D1 only, apply 0003, then 0004, then 0005, then 0006. Verify `PRAGMA foreign_key_check` returns zero rows and new table/index definitions exist. Earlier isolated UAT D1 had 0003/0004 before this iteration; remote D1 0005/0006 application has **not** been completed in this iteration due unavailable Cloudflare connector.
4. Bind a separate nonproduction Worker to isolated UAT D1, permit only actual test mailbox identities in Cloudflare Access. The `.invalid` identity fixtures cannot sign in to Access.
5. Test Sales A, Sales B, Admin, approver, viewer with real signed JWTs and browser UI; preserve failed request and audit evidence.
6. Merge/deploy only after final D1 migration, UI and role test evidence, rollback preparation, and explicit release approval.

## Tests and expected behavior

- `tests/marketing-lead-atomic.test.cjs`: schema and transaction rollback tests using an in-memory SQLite implementation of the same migration SQL, including duplicate customer normalized name, stale versions, invalid status, and qualification/ownership restrictions.
- `tests/marketing-lead-http-simulation.test.cjs`: invokes actual API handlers (Lead and Sales) with a D1-compatible SQLite adapter, while mocking Access identity in the **test harness only**, never in application code.
  - Sales A creates / qualifies / converts and sees a Prospecting deal.
  - Sales B cannot read or edit Sales A records; Admin can view all.
  - Admin converts Sales B lead but generated Account/Opportunity remain owned by Sales B.
  - Duplicate registration, duplicate conversion, illegal transition, unqualified conversion, qualified edits without REOPEN, and reopening without reason are denied.
- Workflow: `.github/workflows/lead-conversion-uat-ci.yml` runs tests, BoQ/Quotation/Post-PO regression, TypeScript, Next.js build and OpenNext bundle.

## Test boundaries

**Simulated D1 test success is not equivalent to live Cloudflare D1 UAT or JWT-authenticated browser E2E.**
The Cloudflare connector was unavailable during this implementation, so the actual isolated D1 `india-uat-users-db` was not migrated or written to this round. The active INDIA Worker was not changed; no marketing/customer data was added to its production-facing D1.

## Remaining gaps

- Remote Cloudflare D1 UAT migration, multi-role real-JWT HTTP/browser verification, evidence screenshots, email delivery, and production release.
- Existing-customer lead conversion (this new-customer implementation deliberately returns a conflict to avoid duplicates).
- Separate Marketing RBAC role, lead assignment/reassignment approval, campaign attribution analytics and automation.
- Cross-document workflow gates for tender, RKS/KAK, approved BoQ, quotation submission and PO/Legal acceptance remain separate releases.

## Data traceability

`india_marketing_leads.id` → `india_marketing_leads.converted_account_id` +
`converted_opportunity_id` → `india_sales_opportunities.company_id` →
`india_sales_opportunities.data_json.source_lead_id`.

All transaction IDs are generated server side; Client cannot choose UUIDs or override account/deal owner.

## How to check quickly

```bash
npm install --no-audit --no-fund
node --test tests/marketing-lead-atomic.test.cjs tests/marketing-lead-http-simulation.test.cjs
npm run typecheck
npm run build
npx opennextjs-cloudflare build
```

For remote Cloudflare D1 checks, use separate scoped UAT credentials and explicit database ID; do not use the production binding by default.
