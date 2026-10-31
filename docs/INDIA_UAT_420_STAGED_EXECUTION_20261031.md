# INDIA — Staged Execution Ledger for 420 UAT Scenarios

**Date:** 2026-10-31 (Asia/Jakarta)  
**Company:** Technotama  
**Repository:** `elanghaqeem-hash/India`  
**Source baseline before this branch:** `739526dbc27f6631b521347fe37835232479f9f3`  
**Environment:** GitHub Actions isolated synthetic CI. **NOT** production or signed Cloudflare Access user UAT.

## Scope and batches

| Batch | Definition set | Count | Automated catalog control | Real user UAT |
| --- | --- | ---: | --- | --- |
| 1 | Legacy P00–O18 CRM / Sales / Tender / PSA / Admin / Security | 210 | Seven-batch CI, historical definition checks | NOT RUN |
| 2 | ERP GL / Financial Close | 35 | Case/schema validation + isolated ERP regressions | NOT RUN |
| 3 | ERP P2P / AP / Treasury | 35 | Case/schema validation + ERP/operations regressions | NOT RUN |
| 4 | ERP Cybersecurity Operations | 45 | Case/schema validation + isolated ERP/operations regressions | NOT RUN |
| 5 | ERP HR / Resource / Assets | 30 | Case/schema validation + PSA regressions | NOT RUN |
| 6 | ERP Cross-domain End-to-End | 30 | Case/schema validation + Sales/Post-PO/operations regressions | NOT RUN |
| 7 | ERP Security / Access / Recovery | 35 | Case/schema validation + negative/release regressions | NOT RUN |
| **TOTAL** | **All unique scenario definitions** | **420** | **CATALOG ONLY, not 420 completed UAT cases** | **NOT RUN** |

**Interpretation:** A green GitHub Actions job indicates catalog integrity and/or the named synthetic test suites ran without failure. It MUST NOT change a business UAT case from `NOT_RUN` to `PASS`. The 210 legacy catalog definitions do not contain executable step-by-step signed evidence; expansion for business acceptance is required.

## Retriggered technical execution — 31 Oct 2026

| Existing workflow | GitHub Actions run | Outcome | Meaning |
| --- | --- | --- | --- |
| ERP 210 catalog integrity | [41084269695](https://github.com/elanghaqeem-hash/India/actions/runs/41084269695) | SUCCESS; 3/3 tests | Two catalogs valid; not live executions |
| Positive all-role synthetic | [41184365659](https://github.com/elanghaqeem-hash/India/actions/runs/41184365659) | SUCCESS; 6/6 phases | Synthetic source, SQLite, localhost/Playwright; 88 ERP positive *definitions*, not 88 operational PASS |
| Negative all-role synthetic | [41184430577](https://github.com/elanghaqeem-hash/India/actions/runs/41184430577) | SUCCESS | Denials and SQL guards for eight current login roles and 37 menu routes |
| Fail-closed evidence controls | [41177303276](https://github.com/elanghaqeem-hash/India/actions/runs/41177303276) | SUCCESS; 9/9 tests | Invalid/unsigned release artifacts rejected; **NOT CERTIFIED** |

These reruns execute the earlier PR heads. The new seven-batch PR workflow is used to test its own pinned new source candidate on `main` base, without modifying production.

## How to execute isolated batches

Run `node scripts/india-uat-420-batches.mjs --batch=1` through `--batch=7` for offline catalog-by-case checks and a JSON register `artifacts/india-uat420/batch-N.json`. The PR-only CI invokes per-batch technical regressions and uploads non-sensitive catalog results. The JSON explicitly declares `business_uat_executed_cases: 0`, `business_uat_passed_cases: 0`, and `release_gate: HOLD`; this is deliberately fail-closed until authenticated evidence exists.

## Real UAT blockers / next operational gates

1. Deploy dedicated latest-schema non-production UAT Worker with isolated D1 and Cloudflare Access; reconcile and independently restore backup, record immutable SHA-256.
2. Provision distinct authorized human users (the existing 8 login roles plus approved enterprise Finance, HR, Procurement, SOC/VAPT and release functions), with organization grants and verified revocation/maker-checker.
3. Populate each case with exact environment/source SHA, role holder identity, timestamps, API/browser trace, before/after database and audit evidence, and original document/ledger references. Store private receipts outside GitHub.
4. Execute genuine financial close/reversal, Treasury/AP, HR, SIEM/EDR, original Vault, mobile/Access, cross-owner negative and rollback tests without actual bank transfers or external response actions unless explicitly approved.
5. Obtain independent Security, Finance, Legal, HR, Procurement, Cyber Operations, Recovery and Release approvals. Verify release authority signature and zero unresolved P0/P1.
6. Only then update individual verified case statuses and assess promotion. Do not turn `HOLD` into `PASS` using catalog checks or CI result flags.

**Production:** no write, deployment, capability elevation, or approval bypass authorized by this staged synthetic test work.
