# INDIA — Canonical D1 Unified Approval Inbox (2026-10-24 WIB)

## Scope and reuse
Builds on merged PR #48 without a second approval master. The read-only queue reuses `authorizeBoQ`, existing D1 transactions and route-specific approval handlers. Canonical approval decisions remain in BoQ, Tender, Award, Feasibility, Billing and Contract workflows, which independently enforce document integrity, authority and maker-checker.

## Coverage and limits
- Eligible D1 submitted BoQ for Admin/Approver.
- Tender deadlines and mandatory checklist reviews, with technical vs financial role separation.
- Original PO/SPK finance review for Finance/Approver and legal review only for Legal; excludes creator and other reviewer.
- Draft feasibility, invoice, payment and configured contract for Finance/Approver/Admin, excluding original maker.
- Cursor-free per-category bound queries limited to 101; response signals truncation. The inbox is NOT an enterprise-wide exhaustive task count.
- No approval mutations in the queue API; HTTP GET only. Links deep-link with canonical Opportunity IDs.
- An unavailable migration/DB results in HTTP 503 and explicit UI failure, never a falsely empty inbox.
- Existing `/approvals` route remains public within Access perimeter but content waits for verified Access/D1 role; all backend data requires signed JWT and D1 authorization.

## Not implemented by this change
True assigned-reviewer policy and cross-business generalized DoA inbox, notification delivery, SLA escalation, pagination beyond capped results, record-level assignment of approvals, real JWT UAT, production migration, signed approvals and full Document Vault original review. No new migration, dummy business records or production write.

## Verification
New `tests/unified-approval-queue.test.cjs` is wired into existing `npm run test:modules-13-15`. Exact-head CI and branch review required. Backend SQL is all parameter bound and fixed by role. Test harness identities are synthetic and do NOT count as human Cloudflare Access UAT.

**Production HOLD** per Issue #46, unchanged by this source-only feature.
