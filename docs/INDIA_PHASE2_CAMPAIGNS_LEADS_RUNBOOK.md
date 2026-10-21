# INDIA Operational Sales Cycle — Phase 2: Campaign and Lead Conversion

Implementation branch: `feat/india-sales-pipeline-workflow-20261020` (Draft PR #12). Not merged, not deployed.

## Business workflow

`Campaign (optional, active)` → `Lead new` → `assigned` → `qualified` → `converted` → `Customer master + Opportunity prospecting` → `BoQ / Proposal / Negotiation / PO`.

- Marketing/Admin manages Campaign, Lead assignment and qualification; Sales can register/qualify own Leads and convert to Customer/Opportunity; Finance/Approver/Legal/Viewer cannot create Campaigns or convert Leads.
- Campaign includes code, channel, owner, start/end, budget, status, audit and real-time aggregate counts. Sales can read active campaigns; only Marketing/Admin can mutate Campaigns.
- Lead registration requires active Sales owner from `india_members`; no hardcoded accounts, customer, price, or contact defaults.
- Lead qualification requires need, budget status, decision maker and procurement process. Conversion additionally requires estimated value >0 and closing date.
- Conversion runs as D1 batch: optional new Customer, new Opportunity, immutable lead-opportunity link, Lead status update, and audit. Existing Customer matched by normalized legal name; duplicates rejected by unique index. Repeated conversion returns the previously created linked IDs instead of creating new entities.
- Lead create sends a stable UUID `request_key`; new database uniqueness on (tenant, creating actor, request_key) prevents double submission. Repeated *same* payload returns prior Lead ID; changed payload with reused key is rejected. Retry remains possible after a Campaign is paused.
- When an active master Campaign is selected, the server takes its canonical name from D1 and persists `campaign_id` FK in the Lead. No trust in browser-supplied Campaign display names. Unlinked legacy/free-text Campaigns remain supported.
- Campaign KPI Lead/Qualified/Converted counts query D1 and do not fabricate revenue or ROI.

## Schema change / migration order (not a production action)

1. Back up Worker D1 and verify existing migration versions.
2. Apply 0003 and 0004 as needed; confirm no legacy data is deleted. `0004` adds isolated Sales account/opportunity tables rather than modifying legacy `companies`/`opportunities`.
3. Apply 0005 for Marketing Leads + role expansion to Marketing/Legal, then 0006 (procurement), 0007 (quotation submissions), 0008 (award evidence) in appropriate code-release order.
4. Apply **0009** for Lead `request_key`, then **0010** for Campaigns + Lead `campaign_id`.
5. Confirm indexes, records, `PRAGMA foreign_key_check`, and `india_members` active role assignments.
6. Provision verified real Marketing and Sales identities in Cloudflare Access and corresponding active `india_members`; the `.invalid` dummy users are intentionally non-login fixtures.
7. Deploy a protected preview Worker **bound to an isolated UAT D1**; verify JWT, role changes, duplicate submissions, conversion and real browser flows.
8. Complete acceptance and rollback plan before a controlled production release.

## Acceptance tests

| Case | Expected |
|---|---|
| Campaign create by Marketing/Admin | Persist in D1, auditable |
| Campaign create by Sales | HTTP 403 |
| Status planned/paused/completed | Not selectable for new Leads |
| Campaign ID forged from another tenant | Rejected |
| Campaign code repeated within tenant | Rejected (unique key) |
| Lead registered with active Campaign | `campaign_id`, canonical name & attribution persisted |
| Qualified Lead missing BANT details | Transition rejected |
| Lead owner is disabled/unknown | Registration rejected |
| Sales B tries Sales A Lead conversion | HTTP 403 |
| Same lead request UUID retried | Same Lead ID, no extra row |
| Same UUID with altered payload | HTTP 409 |
| Same conversion retried | Same Customer/Opportunity IDs |
| Different Leads from same legal company | Reuse Customer, distinct Opportunity |
| Nonexistent customer reference / malformed stage | Constraint rejects |
| Converted Lead → Sales Pipeline | `opportunity_id` direct navigation; opportunity sales-owned |
| Reports | Aggregates from real D1 rows; no fake numbers |

## Test evidence

- `tests/marketing-campaigns.test.cjs`: role and input validation, real SQLite FK and unique constraints, linked Lead attribution, UI/API wiring.
- `tests/marketing-idempotency.test.cjs`: registration request UUID uniqueness, legacy compatibility, conversion retry safety.
- `tests/marketing-lead-flow.test.cjs` and `tests/marketing-d1-migration.test.cjs`: BANT qualification, D1 conversion mapping, BoQ link, migration and FK.
- `npm run test:marketing`, `npm run test:sales`, TypeScript, Next 16.4.2 Webpack build, OpenNext adapter build run in GitHub Actions.

**Production state as of this implementation:** code only in PR #12; UAT D1 migrations 0005/0009/0010 are not independently confirmed on Cloudflare because connection was unavailable. No claim of successful genuine Cloudflare Access login or live deployment. Migration, actual role provisioning, signed JWT browser UAT, and formal release approval remain mandatory.
