# PR #35 + #36 — controlled integration (24 October 2026)

Source baseline: PR #35 at `93e3ac8cb721328d50eeda720bf44260a495edf8`; PR #36 at `4d9d1d05ffe04d5eee77005a284c3199613d6fa4`. This combined candidate retains the latest PR #35 Document Vault, Tender and release gates while adding PR #36 Customer 360, Won-to-delivery, BAST, billing, payment and renewal changes. Five overlapping files were reviewed: package scripts, Vault uploads, fixture harness, Lead Intelligence clock (already fixed upstream), and migration fixture expectations.

## Verified D1 baseline

Read-only Cloudflare D1 clone `india-uat-full-restore-20261023` (`5b9b58de-be29-48bb-9023-018c7f15f68b`) on 24 October 2026: migration ledger 3–26, canonical 0015–0026 manifest, `PRAGMA quick_check = ok`, `PRAGMA foreign_key_check = []`; 0027 absent. Earlier independent full SQL backup and actual rollback evidence are recorded in `INDIA_SECURE_DOCUMENT_CONTINUATION_20261024.md`. No migration, data writes or Worker deployment was attempted by this integration.

## Mandatory release gates (production HOLD)

1. **Exact-head hosted CI:** full inherited Vault/original-document, commercial, service-operations, role/isolation, Cloudflare build and desktop/Android-emulation browser suites. Do not use PR #36's previous green SHA as evidence for the merged tree.
2. **D1 0027:** retained full independent pre-0027 native backup, isolated atomic rehearsal with forced failure and proof of unchanged original data/schema, then canonical 0027 migration on the isolated clone and post-migration checks. Never replay 0015–0026. Do not migrate production during this gate.
3. **Isolated combined Worker:** pinned release SHA and clone D1; Access application issuer/audience; encryption-key continuity (Vault AES-GCM). No reassignment of shared UAT/production bindings.
4. **Genuine signed Access user acceptance:** distinct Sales A, Sales B, Presales/PM, Finance maker, independent Approver, Legal and Admin identities; test denial of self-approval, cross-owner reads and finance leakage. CI fixture headers are never real authentication.
5. **Real operational end-to-end and financial reconciliation:** documents/proposal/PO originals; approved Won; sourced handover; PM and service evidence; independently reviewed BAST, invoice, partial payments and reversal; linked GL, actual-cost completeness and provisional margin; renewal. Physical Android and desktop evidence.
6. **External service and operational review:** provider transport with protected UAT keys, vendor original evidence, two real Cron invocations, storage/retention and malware operational handling, monitoring/alerting, rollback decision and independent release sign-off.

Keep #35 and #36 Draft and avoid `main` merge or production deployment until every mandatory gate is evidenced.