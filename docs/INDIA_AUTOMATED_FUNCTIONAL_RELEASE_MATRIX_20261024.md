# INDIA — Comprehensive Automated Feature/Menu Gates (24 October 2026)

## Scope
`npm run gate:automated` is a strictly **source and isolated in-memory database** acceptance suite. It runs 10 business-menu groups + 4 integration categories, TypeScript typecheck, 25+ existing transaction, security, provider and workflow test scripts, and route/middleware existence checks. It fails the job if **any** item fails. It writes a non-sensitive JSON evidence file under `artifacts/india-automated-gate/result.json`.

Automatic PASS does not mean a screen was manually exercised, real Cloudflare UAT migrated, an original PO signed, a secret configured, or production deployed.

## Reused canonical artifacts
- PR #49 D1 reviewer queue, with true maker-checker filters.
- PR #50 canonical 0029 Indonesian postcode picker and 0030 immutable FlexGuard ledger.
- PR #50 Post-PO original official-template DOCX mapping.
- Existing Sales and Service Operations, Marketing, BoQ, Tender, Vendor and Analytics suites.

## Current code changes
Approval Center is now in role-aware navigation. Header bell goes to Approval Center and uses a real D1-backed pending count, `null` when unavailable instead of falsely showing zero; refreshed after login / tab visibility. The new queue category `flexguard_wallet` points to the corresponding wallet and only eligible Admin/Approver who is not the maker. AI key shortcut is Admin-only.

## Hard external gates excluded from code PASS
Real signed Cloudflare Access UAT for independent roles including Legal; dedicated isolated Worker and migrations 0029/0030; native D1 original backup/hash and independently restored Cloudflare DB; encryption-key continuity; genuine DOCX/archive and customer-to-cash/FlexGuard signed transactions; physical Android; provider credential probes; separate release signoffs and controlled production deployment. These are **PENDING**, never automatically stamped PASS.

To reproduce: run `npm run gate:automated` on the candidate SHA with Node 24 and Python3. Read the resulting JSON, which records each business group and evidence command. If a test fails, source acceptance must remain FAIL.
