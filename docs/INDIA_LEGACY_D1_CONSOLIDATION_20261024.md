# INDIA — Sprint 1 P0 Legacy Route Consolidation (2026-10-24 WIB)

## Baseline / non-duplication
Baseline main: `1362673291864e5e53c2daf81808deed6b527f4e`.
Reuses `/api/sales/identity`, `firstAccessibleHref`, `/boq`, `/sales/bid-readiness`, `/sales/delivery`, `/sales/award`, `/sales/billing`, `/sales/renewals`.
No new D1 migration, customer master, opportunity ledger, endpoint or secret. Original legacy libraries remain available for deliberate future porting, but are no longer invoked as live operations.

| Route | Prior risk | Changed behavior | Gate |
|---|---|---|---|
| `/` | appStore fictional pipeline, approvals, wallet and KPI | Cloudflare Access + active D1 role checked, then redirect to role-permitted workspace | Authenticated real-role browser UAT BLOCKED |
| `/pricing` | in-memory price without canonical approval | Redirect to BoQ D1, preserve validated `opportunity_id` | Detailed legacy pricing algorithm parity NOT VERIFIED |
| `/approvals` | local fallback could claim successful approval when API failed | Role-filtered links to actual D1 approval flows; no fake pending totals | Unified cross-module approval queue still GAP |
| `/tender` | random tender IDs, fake HPS, browser-only bid decision | Redirect to canonical D1 Bid Readiness with optional opportunity ID | Actual tender registration UAT BLOCKED |
| `/flexguard` | mutable fake token wallet and manually fabricated ledger rows | Disable wallet operations and present explicit BLOCKED state | D1 immutable token ledger must be developed |
| `/post-po` | local/dummy official documents and unsourced Sales fallback | Redirect to canonical post-Won delivery with opportunity ID | Standalone original DOCX workflow needs reviewed port, not claimed complete |

### API security
`/api/tenders`, `/api/wallets`, `/api/approvals`, `/api/opportunities`, `/api/proposals` remain unavailable through the existing fail-closed middleware. Canonical D1 routes enforce JWT, role and ownership in their handlers.

### Tests / Evidence
New source regression in `tests/india-legacy-consolidation.test.cjs` wired into `test:modules-13-15`. The existing technical-writer calculator assertions remain, while the retired demo-pricing UI expectation is updated. GitHub Actions must verify the exact PR-head (not considered PASS before execution).

### Release decision
**HOLD.** Changes are source-only; no production database migration, Access mutation, Worker deploy, real role session, native backup, independent restore or finance sign-off. See `docs/INDIA_OPERATIONAL_RELEASE_GATE_20261024.md` and Issue #46. In particular, disabling FlexGuard is a safety closure rather than a completed token-management feature.
