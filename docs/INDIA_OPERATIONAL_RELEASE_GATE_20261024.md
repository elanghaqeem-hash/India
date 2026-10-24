# INDIA — Operational Release Gate Evidence (24 October 2026 WIB)

**OVERALL RELEASE: HOLD** — subsystem PASS does not imply final production authorization.

| Gate | Verified evidence | Status |
|---|---|---|
| Source | #44 merged; main d0499e043354e6f2f67b2784c52a87f712d7c523; 8 exact-head CI workflows green | PASS: source |
| Clone migration | Isolated D1 5b9b58de-be29-48bb-9023-018c7f15f68b has canonical 0028 + 0028 manifest, Mistral disabled, SQLite quick_check ok, no FK violations | PASS: isolated schema |
| Time Travel rollback rehearsal | Restored clone to pre-0028 bookmark 00000019-00000000-0000510e-5b0ebacb47f79d2ee5c6cdb32a4ca579; verified migration back to 0027, 95 tables, 141 triggers, 13 members, 4 opportunities, quick_check ok, no FK violations; re-applied all 10 statements of 0028; bookmark now 0000001a-00000004-0000510e-e0496243ae9de85678fc00ed884fa20f | PASS for this Time Travel rehearsal only |
| Independent backup / restore | Native D1 SQL export was generated at original 0027 bookmark and temporary signed download URL issued. Original bytes NOT downloaded, durably stored, hashed, or independently restored. | BLOCKED |
| Cloudflare Access configuration | Existing UAT Worker AUD matches existing Access application; 6 policy-eligible active D1 accounts (Admin 1, Sales 2, Presales 1, Finance 1, Approver 1) also present in clone; Legal absent | PARTIAL / BLOCKED |
| Genuine human signed Access UAT | No real JWT sessions or signed user transactions verified | BLOCKED |
| Dedicated UAT Worker | Existing uat-india points to SHARED UAT D1 eaed652e-7322-4950-a304-dd50baa5de02 version 0014, not isolated 0028 clone; release SHA d055bc5928020c35453193921560d3818f811c19 | BLOCKED |
| UAT encryption continuity | Shared UAT Worker has neither INDIA_AI_ENCRYPTION_KEY nor INDIA_DOCUMENT_ENCRYPTION_KEY binding, and original key continuity is unverified | BLOCKED |
| Contract-to-cash UAT | No genuine authenticated Won / Vault / delivery / BAST / invoice / partial payment / exact reversal / revenue / renewal proof | BLOCKED |
| Physical Android and signoff | Playwright Android emulation passed prior CI but physical device and independent Security/Finance/Recovery/release owner signoff absent | BLOCKED |
| Production | india Worker remains bound to D1 8395dd84-1b7d-4eaf-9990-1d8e75a42cb5 at migration 0012, untouched | HOLD |

## Independent local backup restore and failure-injection rehearsal

Never put a native SQL dump, Access JWT, API key, or customer record in GitHub source or public workflow artifacts. Save the immutable PRE-0028 clone SQL export into secure private storage, compute the SHA-256 from actual downloaded bytes, and run:

    python3 scripts/india-d1-0028-restore-rehearsal.py \
      /secure/private/clone-pre-0028.sql \
      --migration migrations/0028_ai_mistral_provider.sql \
      --source-bookmark 00000019-00000000-0000510e-5b0ebacb47f79d2ee5c6cdb32a4ca579 \
      --expected-sha256 ACTUAL_64_HEX_SHA256 \
      --output /secure/private/india-restore-evidence.json

This runner rejects a mismatched checksum, unpinned bookmark, wrong baseline or output overwrite. It restores the dump into memory, preserves the original business tables using deterministic SHA-256 row fingerprints, checks independent simulated rollback after injected failure, migrates successfully to 0028 and verifies old AI provider ciphertext and metadata are unchanged. It never contacts Cloudflare or emits PII. Passing this local runner is NOT full independent Cloudflare D1 restore or human UAT. CI exercises the same logic with SYNTHETIC, non-customer SQL only.

## Dedicated release-candidate UAT preflight

Run from a restricted environment:

    node scripts/india-operational-gate.mjs --preflight

Required environment values:

- INDIA_GATE_WORKER_NAME: dedicated uat-india-* Worker, never existing india or shared uat-india
- INDIA_GATE_D1_ID: 5b9b58de-be29-48bb-9023-018c7f15f68b only
- INDIA_GATE_SHA: exact deployed 40-digit release commit
- INDIA_GATE_ACCESS_APP_ID: new Access application protecting dedicated candidate Worker
- INDIA_GATE_TOKEN: Cloudflare READ-ONLY API token, supplied via secure secret storage only

The runner verifies actual Worker D1/Access binding, pinned deployed version, AI and Document encryption secret BINDING EXISTENCE only, canonical ledger 0013–0028 and manifest 0021–0028, no collisions, foreign key/quick_check, and eligibility of seven active D1 users: Admin, Sales A/B, Presales, Finance, Approver and Legal. It fails closed with exit 2, prints no email addresses, and NEVER claims production is ready. The accompanying workflow runs synthetic safety checks on PR and a manually triggered protected india-uat LIVE_READONLY job if the real dedicated environment has been provisioned.

## Final approval sequence

1. Create a dedicated candidate Worker and Access application bound ONLY to the isolated clone, with secret continuity verified out-of-band. Provision a distinct real Legal identity.
2. Securely download/hash the ORIGINAL export, independently restore into local SQLite and a disposable second Cloudflare D1 environment when capacity permits. Do not delete any existing D1 database to obtain an empty slot.
3. Run actual human Access JWT sessions for Admin, two Sales, Presales, Finance, Approver and Legal with both allow and negative cross-owner tests.
4. Complete original Document Vault proposal/PO, Won, VAPT/SOC delivery, BAST, invoice, partial payment and reversal, audit, margin and renewal tests on the deployed 0028 UAT candidate. Reconcile GL and balances.
5. Execute physical Android tests, observe monitoring/alerts and obtain signed Security, Finance, Operations/recovery and release-owner acceptance.
6. Obtain separate explicit authorization, then migrate production incrementally from ACTUAL baseline 0012 with independently proved backups and rollback. Never skip a version, invent signoff, or bind a shared DB to a candidate Worker.

No production deployment or migration is authorized by this document.
