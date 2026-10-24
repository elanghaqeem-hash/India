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


## Supplemental live Mistral UAT reconciliation (24 October 2026 WIB)

The isolated D1 clone was inspected after the earlier 0028 Time Travel rehearsal. Actual india_ai_providers contained **only the disabled, unkeyed Mistral row** (priority 7), despite the D1 migration ledger ending at 0028. A schema-only success therefore did **not** prove the seven-provider catalog was populated.

An isolated-UAT-only, guarded idempotent insert restored missing **unkeyed/disabled** provider metadata: openai, gemini, anthropic, groq, openrouter, and deepseek at priorities 1–6. The original Mistral row was not overwritten. Read-only postchecks report seven distinct provider IDs, contiguous priorities 1–7, no configured keys or enabled providers, PRAGMA quick_check=ok, and zero foreign-key violations. **No production D1 or provider credentials were copied or changed.**

The release preflight now explicitly rejects incomplete AI provider records and enabled providers without both an encrypted key and a successful recorded real probe. This removes a false-positive catalog-readiness path. It does NOT replace actual API key provisioning, signed Access-role UAT or transaction-level signoff.

Production is still on migration 0012 with six provider records. The shared UAT D1 is at 0014. The isolated 0028 clone is not connected to a deployed, dedicated Access-protected INDIA candidate Worker and has no live Mistral API test evidence. **Production release remains HOLD** until the original independent backup, Access, credential, operational and signoff gates are satisfied.

---

## Addendum — PR #54 Context Continuity operational release gate (24 Oct 2026)

**Decision: HOLD / BLOCKED for production.** This is the result of an actual read-only GitHub/Cloudflare inspection on 24 October 2026, not an estimated PASS. No production Worker or database was changed.

### Verified source and deployment baselines
- PR #54 `fix(ai): preserve multi-turn INDIA chat context` merged into `main` as **efac1b95ba7769ffb6dbb3eae61d3ae157005d51**.
- All **9/9** head-commit GitHub CI workflows concluded `success`: automated functional release, ICOP chat composer Android/desktop browser, modules 13–15, customer delivery, tender readiness, quotations, executive dashboard, sales activity, and P1/P2 commercial integration. These prove source and simulated gates only, not live-provider/human UAT.
- Production Worker `india` has Cloudflare deployment version `30253763-11da-4171-a53f-9a842e990f00` dated **2026-10-23T15:11:47Z**, older than the PR #54 merge. Its bound D1 remains production `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`; production migration ledger max **0012**.
- Shared UAT Worker `uat-india` has release binding `d055bc5928020c35453193921560d3818f811c19`, not the PR #54 code; UAT D1 binding remains `eaed652e-7322-4950-a304-dd50baa5de02`; migration ledger max **0014**.
- Both Workers carry `INDIA_AI_ENCRYPTION_KEY` as a `secret_text` binding. This **updates an earlier finding** in this document: the shared UAT secret has since been installed. Only secret *existence* was inspected, never its value.
- Cloudflare Access application audience matches each Worker binding. UAT application has one Admin allow rule plus five named commercial allow identities (six eligible emails in total). Database UAT has two active Admin members, but no genuine signed JWT/OTP UAT transaction evidence; a separate Legal identity/signoff is absent.

### Rehearsal database, provider readiness and rollback
- The unbound D1 rehearsal clone `india-uat-full-restore-20261023` (ID `5b9b58de-be29-48bb-9023-018c7f15f68b`) is still at migration max **0028**. It is **not** attached to any of the account's 16 Worker scripts. Its 0029 postal-related reference tables are present with 83,712 entries and 38 provinces, but the canonical 0029 manifest/ledger is **not** applied. Canonical migration 0030 FlexGuard has not been verified on this clone. Do not treat the reference table's existence as successful 0029 migration.
- Shared UAT D1 contains six AI provider metadata rows, with **0 enabled / 0 encrypted keys / 0 successful tests**. OpenRouter is unconfigured in UAT. Production contains enabled/tested OpenRouter and OpenAI, but **production credentials were not copied to UAT** and must not be.
- Cloudflare D1 Time Travel **bookmarks were retrieved successfully** for production, shared UAT and isolated clone. Bookmark values are intentionally not committed to Git. Bookmark availability alone does not pass an independent SQL export/hash/restore or rollback transaction rehearsal gate.
- Cloudflare account has **10/10 D1 databases** allocated. No database was dropped, created, restored, or migrated during this PR #54 inspection.
- UAT/production Access and D1 binding isolation preflight is **PASS**; multi-role genuine user-session verification, actual provider call, full backup/restore, migration reconciliation to canonical 0030, physical Android, Legal/Security/Finance/recovery acceptance and production release remain **BLOCKED**.

### Mandatory manual/controlled gates before deployment
1. Preserve an original immutable D1 export and verify SHA-256 plus an independent restore and rollback rehearsal on a safe, approved environment. Never restore over the shared UAT/production databases or delete existing D1 instances to create a slot.
2. Reconcile source migrations 0015–0030 against the actual UAT 0014 baseline, and 0013–0030 against the **different** production 0012 baseline. Verify manifest, old rows and original Vault/AI encryption continuity before applying anything. An isolated 0028 clone is insufficient for release 0030.
3. Deploy the exact reviewed `main` commit to a dedicated, Access-protected, **unshared UAT** candidate with original D1 isolation and rollback checkpoint; never use `india` or shared `uat-india` as a substitute for the dedicated gate.
4. Admin must install a **separate UAT** OpenRouter credential using the Admin form (never through chat/GitHub). Test Connection must pass and provider must become enabled/tested in UAT D1.
5. Validate real signed Cloudflare Access login per authorized role and negative cross-owner tests. Run the six-turn genuine model scenario including the exact misspelled follow-up **`Mans yg lebih murah`**; reject replies mentioning consumer goods instead of VAPT without caveats.
6. Complete contract-to-cash/Vault and approval operations, physical Android visual acceptance, independent Security/Finance/Legal/recovery signoffs and production rollback rehearsal. Only then approve and run a separately controlled production deployment.

**No deployment, production migration, provider secret access, database restoration or fictional UAT success was performed by this addendum.**
