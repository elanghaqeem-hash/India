# INDIA — Tender Compliance & Bid Readiness
Date: 22 October 2026. Scope: canonical D1 Opportunity Sales workflow, not the legacy in-memory /tender demo.

## Delivered
- Reuse draft PR #24 requirement and vendor matrices with independent review.
- Migration 0021_tender_bid_readiness.sql creates versioned deadlines, three-category checklist, immutable histories and a fail-closed D1 stage gate.
- Mobile and desktop workspace at /sales/bid-readiness; server API at /api/sales/bid-readiness. Existing signed Cloudflare Access, D1 membership, Sales owner isolation, optimistic concurrency and atomic audit writes are retained.
- Exact submission time with explicit timezone offset, independently reviewed by Admin/Approver. No artificial 23:59 time.
- Each tender must have a mandatory and approved item in administrative, technical and commercial categories. All mandatory items require a named file, archive reference, SHA-256 and independent reviewer. Optional items never override mandatory gaps. Source clause IDs are scoped to the same Opportunity.
- All RKS/KAK/RFP/RFQ sources must be reviewed/compliant and contain fully reviewed mandatory clauses. Vendor capacity/price/expiry checks inherited from PR #24.
- Revisions reset approval and archive old values. An expired deadline or document invalidates readiness.
- Three server-generated, role-guarded CSV exports: Compliance Matrix, Tender Checklist and Bid Readiness Report. Formula injection is neutralized in the exported text.
- Readiness controls already used in quotation export, submission and forecast Commit now use this stronger predicate; SQL trigger applies it to stage transitions. Indicative percentage is not approval authority.

## Model checklist examples (not seeded)
Administrative: legal/tax certificates, NDA, declarations, company eligibility, signed forms.
Technical: security scope, methodology, engineer certifications, deliverables, implementation schedule.
Commercial: official quotation, detailed BoQ, tax/pricing terms, bank guarantee if required.
Actual mandatory items must be entered according to each customer's approved RKS/KAK.

## Acceptance / UAT
1. Backup the target D1, restore into isolated UAT, verify migration path 0012, 0016–0020 and separate 0015 vault if relevant before applying 0021. Inspect manifest, not only the highest version.
2. Authenticated Sales A can modify own tender; Sales B cannot read/write Sales A; viewer and marketing denied. Deny forged Origin and invalid Access token.
3. Enforce independent review for deadlines, technical, administrative and commercial documents. Reject missing original reference, bad hash, unknown clause, stale version, duplicate codes, expired timestamps, self-review and unauthorized post-stage editing.
4. No GO, no deadline or no mandatory category returns NOT READY. An additional unreviewed KAK blocks even when a previous RKS was approved.
5. After GO, all RKS clauses compliant, future approved submission time, and three approved document categories, D1 returns READY and allows stage progression. Simulate expiry and revisions to force NOT READY.
6. Validate CSV exports, escaping, row integrity, 375px browser, no tenant data leaks, D1 foreign key check and quick_check, 44 negative tests and existing seven-role regressions.
7. Conduct genuine Cloudflare Access signed human UAT as Sales A/B, Presales, Finance, Approver and Admin. Test fixtures do not establish production authentication readiness.
8. Confirm source SHA, SQL schema path, Worker D1 binding and Cloudflare Access audience before any production promotion. Verify cron separately with PR #21 if deadline reminders are integrated later.

## Release notes and limitations
This branch depends on draft PR #24; secure original document storage is being developed independently in PR #23 with migration 0015. Archive references and SHA-256 in this feature are currently user-supplied metadata and are NOT cryptographic proof that original files exist in the Document Vault. Before production, integrate verified original-file checks and UAT, or keep submission gate closed if organization policy requires stored originals.

Deadline alerts are presented in the dashboard as expired or due within 72 hours. Automated external reminders or email/WhatsApp notifications are not claimed.

Changes must be reviewed and merged through the dependency chain after UAT. Do not apply migration 0021 to production before backup, restore rehearsal and schema verification. Preserve audit history on rollback and prefer reviewed forward fixes.
