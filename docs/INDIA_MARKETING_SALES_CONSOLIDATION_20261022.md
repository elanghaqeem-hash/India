# INDIA — Marketing / Sales consolidated release (PR12 + PR18)

**Scope:** A single commercial workflow and one canonical runtime schema. This PR is based on PR #12 and integrates PR #18's version-locked conversion and audit. Do not merge both source PRs separately.

## Canonical process

Marketing Campaign (Marketing/Admin) -> Lead registration (Marketing/Sales/Admin) -> Sales assignment -> activities and BANT (Need/Budget/Decision Maker/Procurement) -> Qualified -> *transactional Lead conversion* -> Sales Account + Opportunity -> Bid/No-Bid / Tender RKS/KAK -> Scoping / vendor and capacity -> Approved BoQ -> Quotation / evidence -> Negotiation -> PO, independent Finance/Legal reviews -> Closed Won or Lost -> Post-PO handover.

- **Canonical UI:** `/sales/campaigns`, `/sales/leads`, `/sales/pipeline`. Previous `/marketing/*` bookmarks redirect to the same Marketing UI (never to a second store).
- **Canonical API:** `/api/marketing/campaigns`, `/api/marketing/leads`, `/api/sales` and its bid, submission, award and quotation routes. Do NOT deploy the duplicate PR18 `/api/leads` and `/api/leads/convert` endpoints alongside the canonical Marketing API.
- **Customer master:** `india_sales_accounts`. **Opportunity:** `india_sales_opportunities`. **Lead:** `india_marketing_leads`. **Lineage:** `india_sales_lead_links` (one Lead -> one Opportunity; existing Customer reuse only when owner matches). Marketing source and campaign remain traceable. Audit writes to `india_marketing_lead_events` and `india_sales_audit`.
- Cloudflare Access signed JWT + membership in `india_members`; Sales only owns its Leads/Accounts/Deals, Marketing owns campaign and lead coordination, Admin may convert without taking ownership; independent approvers and Finance/Legal cannot self-approve their own deals.

## Critical legacy incompatibility

Both predecessor PRs use integer migration **0005** and **0006** for different SQL files.
**NEVER** interpret `india_schema_migrations.version IN (5,6)` as evidence that the PR12 Marketing Lead schema exists. PR18 UAT data uses `company_name,owner_email,service_interest,contact_phone,converted_account_id`; PR12 uses `account_name,assigned_sales_email,service_family,qualification_json`, and the canonical link table.

Two distinct rollout paths, never mixed:

1. **Fresh environment with only Sales migrations 0003/0004:** apply PR12 canonical migrations `0005_marketing_lead_flow.sql` through `0010_marketing_campaigns.sql`, then `0011_marketing_sales_consolidation.sql`.
2. **Pre-existing PR18 UAT with legacy 0005/0006:** after a verified D1 export/snapshot and maintenance gate, preflight exact SQL column names and converted FK links, then execute in a rollback-capable staging rehearsal **as one transaction**:
   - `scripts/india-pr18-to-canonical-pre.sql` renames PR18 Lead and event tables to permanent `*_phase18_archive` and frees a legacy index name.
   - Apply canonical PR12 `0005_marketing_lead_flow.sql` through `0010_marketing_campaigns.sql`, regardless of collided integer versions, followed by `0011_marketing_sales_consolidation.sql`.
   - `scripts/india-pr18-to-canonical-post.sql` inserts PR18 Leads preserving original IDs, owner and timestamps, copies historical events, and recreates one-to-one Sales links for converted Leads.
   - Verify `PRAGMA foreign_key_check` empty, row counts match archives, converted links point to the original Account/Opportunity, no duplicate customer identity, role preservation and all appropriate indexes. Commit only after all assertions are true.
   - After commit, inspect both the file-manifest names and integer versions; keep the archive immutable until governed retention is approved.

**No production migration or automatic alteration of the existing live UAT database is performed by this GitHub PR.** The SQL pre/post bridge has no automatic deployment. D1 remote REST's independent SQL requests are NOT an atomic transaction: do not manually issue the individual bridge statements one by one. Use a reviewed atomic runner, rehearsal and a tested restore mechanism before touching the UAT D1. Verify whether the Cloudflare runtime supports the selected DDL atomicity path before execution.

### Data handling

Previously `qualified` but unconverted PR18 Leads are deliberately mapped to `assigned` during bridge because PR18 qualification lacks the canonical Procurement field. Requalify them after an actual procurement answer is collected. Previously `converted` records retain status, IDs and opportunity links. No fabricated dates, budgets or procurement answers. User data is not dropped; archives remain accessible for audit.

### Conversion API acceptance gates

- POST `/api/marketing/leads`, entity `convert`, must send the current Lead `version` and `x-india-lead-action: convert` from same origin.
- Signed Access identity must be Sales owner or Admin, and the Lead must be Qualified.
- Conversion executes a **single D1 batch**: compare-and-swap update first, guarded inserts for Customer (if new), Opportunity, Link and dual audit; every dependent INSERT has a guard on the successfully incremented Lead version.
- Concurrent or stale request cannot produce another Account/Opportunity. Successful retry returns the existing linked IDs. An existing Customer owned by another Sales is blocked pending a separately approved reassignment; ownership is not silently transferred.
- The Customer profile is entered once on the Marketing form for downstream Registration/Project documents. Contact identity is server-derived from the qualified Lead.
- Sales owner remains `assigned_sales_email` even when an Admin submits the conversion.

### Release gating

- Green CI: `node --test tests/marketing-sales-consolidation.test.cjs`, current PR12 Sales and Marketing suites, negative/API tests, BoQ/quotation/Post-PO regression, `npm run typecheck`, `npm run build`, OpenNext build.
- Test preservation from an exact PR18 SQL fixture and the live schema's **read-only** fingerprint before any DB writing.
- Real Cloudflare Access JWT UAT with Marketing, Sales A/B, Admin, Presales/Finance/Approver, same-origin and cross-owner negative paths; mobile browser, duplicate conversion, network retry and transaction rollback.
- Production merge/deploy **HOLD** until verified remote UAT evidence and explicit release gate. PR #12 and PR #18 must be superseded rather than merged in addition to this consolidation branch.
