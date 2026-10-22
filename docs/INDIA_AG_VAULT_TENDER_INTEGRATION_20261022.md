# INDIA A–G: Canonical Vault × Tender integration (22 October 2026)

Release state: **DRAFT / NOT PRODUCTION-APPROVED**. Base: PR #25 (contains PR #24 and PR #21/#22).
Existing INDIA production and Cloudflare Access policies must remain unchanged.

## Reconciliation
- `0021_tender_bid_readiness.sql` retains integer **21**.
- PR #23's `0021_document_vault_governance.sql` is imported as `0022_document_vault_governance.sql`, recorded under integer **22**, with prior 0015 encrypted original-file schema.
- `0023_tender_vault_integrity.sql` adds a read-only evidence view and fail-closed triggers for mandatory Tender checklist review, mandatory clause review, RKS/KAK requirement approval and forward Tender stages.
- Migrations must run as the **explicit ordered path** 0012, 0013, 0014, 0015, 0016–0020, 0021, 0022, 0023. Already applied versions must be checked by exact filename and table/trigger fingerprints, not by MAX(version).
- Never import the old PR #23 SQL as 0021 beside Tender 0021. Source PR #23 remains an independent candidate, not an authorized release artifact.

## Vault → Tender proof rules
- File bytes are uploaded via signed Cloudflare Access to `/api/sales/document-vault`; the Worker computes SHA-256 and stores AES-256-GCM ciphertext and immutable chunk versions in D1.
- Pre-release NDA, RKS, KAK, Quotation, supporting evidence are tied to exact Opportunity and stored under library document ID.
- Mandatory Tender checklist evidence must specify `vault:<document_id>`, server-issued checksum and exact original filename. A forged typed reference or hash is rejected; independent approval decrypts and rehashes the original before acceptance.
- Reviewed RKS/KAK source must reference matching kind and stored original, and mandatory Tender clauses must reference matching stored evidence; this is enforced with SQL triggers and GET readiness gap reporting.
- Tender stage changes reject missing/mismatched originals even if a different API attempts a direct status bypass.
- Vault upload, download, legal hold and retention governance have individual immutable audit records. Evidence is not a substitute for customer acknowledgment, signature validity or anti-malware scanning.

## Security & operational limitations
- Requires a dedicated `INDIA_DOCUMENT_ENCRYPTION_KEY` per UAT environment. Never share or rotate it while encryption-dependent files remain stored without a planned re-encryption.
- Avoid uploading customer-sensitive documents until genuine JWT/role tests are completed. Do not weaken access policies for QA.
- The old historical SQL-based test harness exercises pre-Vault migration paths explicitly; the new integration tests load the **full** 0015 + 0022 + 0023 stack and demonstrate SQL fail-closed review and encrypted original proof.
- Original PR #23 release/Negotiation/PO routes were separately hardened. This integration imports their encrypted original routes/schema but the overlapping PR #23 and PR #24 lifecycle handler changes still require a combined full-route review and E2E coverage before production.
- Stored originals currently reside in encrypted D1 chunks, maximum 8 MiB per uploaded file. Antivirus scanning, R2 archive tier, electronic-signature verification, real mailbox OAuth, and engineer resource calendars are separate future acceptance requirements for A–G.

## Isolated UAT runbook
1. Pin reviewed source SHA to protected isolated UAT Worker; confirm D1 ID, Access AUD, encryption secret binding through read-only settings. No production Worker binding.
2. Export the source UAT D1; record checksum, row counts, schema/manifest; restore into an isolated rehearsal target and prove byte-for-byte data row preservation.
3. Before mutation verify no 0021 conflict; apply reviewed missing schema 0015, 0016–0020, 0021, 0022, 0023 atomically on the rehearsal database. Test late injected DDL/DML failure rolls the whole batch back.
4. Check `PRAGMA foreign_key_check`, `PRAGMA quick_check`, table/index/trigger presence, migration manifest, document byte counts and all historical audits.
5. Run negative and positive HTTP/browser tests using genuine **different** Access identities (Sales A, Sales B, Admin, Marketing, Presales, Finance, Approver, Legal); verify cross-owner denial, forged reference denial, mismatch SHA, missing original, independent approval and stage bypass blocking.
6. Exercise **one genuine Tender** lifecycle on isolated test data: RKS and KAK upload -> per-clause original -> mandatory 3-category checklist -> independently approved deadline -> GO -> READY -> approved BoQ/release -> independent Quotation/Negotiation/PO -> Won; audit every action.
7. Confirm two distinct Cron scheduled events after A/B integration and check idempotent reminders; separate from Tender/Vault, no real outbound messages.
8. Verify TypeScript, full regression, Cloudflare packaging, security gates, original Word/Excel exports and human approvals; only then consider a separate production release authorization.

**Do not deploy production until all release gates PASS with saved evidence.**
