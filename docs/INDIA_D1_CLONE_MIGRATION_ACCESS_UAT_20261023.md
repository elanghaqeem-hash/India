# INDIA — D1 Clone Migration 0015–0024 & Real Access UAT Gate
Date: 23 October 2026
Scope: Cloudflare isolated clone ONLY. Production, live UAT and all other D1 databases are excluded.

## Environment and independent recovery
- Source real UAT D1: `india-uat-users-db` (`eaed652e-7322-4950-a304-dd50baa5de02`), application Worker `uat-india`.
- Target isolated clone: `india-uat-full-restore-20261023` (`5b9b58de-be29-48bb-9023-018c7f15f68b`). At verification it had no Worker binding.
- Production Worker `india` binds `india-staging-db` (`8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`); never apply clone migrations to that resource.
- Real UAT source and clone were compared: 51 tables, 49 indexes, 38 triggers, 83,793 rows (83,712 postal data), `quick_check=ok`, foreign-key check clear. Prior isolated-clone PITR rollback rehearsal passed.
- Before trying migrations, D1 clone SQL export completed at bookmark `00000005-00000000-0000510d-9a5ce02111a8c34c905cc64f6ca8146e`. Capture a fresh clone bookmark and verify Worker binding and schema ledger again before any write.

## Canonical reconciled migration ownership
| Number | File | Source branch |
| --- | --- | --- |
| 0015 | `migrations/0015_secure_document_vault.sql` | `feat/india-ag-vault-tender-integration-20261022` (PR #28) |
| 0016 | `migrations/0016_tender_vendor_compliance.sql` | PR #28 |
| 0017 | `migrations/0017_opportunity_email.sql` | PR #28 |
| 0018 | `migrations/0018_sales_forecast.sql` | PR #28 |
| 0019 | `migrations/0019_verified_revenue.sql` | PR #28 |
| 0020 | `migrations/0020_activity_lead_intelligence.sql` | PR #28 |
| 0021 | `migrations/0021_tender_bid_readiness.sql` | PR #28; Tender retains 0021 |
| 0022 | `migrations/0022_document_vault_governance.sql` | PR #28; Vault governance |
| 0023 | `migrations/0023_tender_vault_integrity.sql` | PR #28; original-file evidence gate |
| 0024 | `migrations/0024_vendor_resource_feasibility.sql` | `feat/india-vendor-resource-feasibility-20261022` (PR #27) |

DO NOT execute historical `0022_vendor_resource_feasibility.sql`: its number collided with Vault. Do not execute the two alternatives for 0021/0022. Do not infer applied migrations from `max(version)` alone: compare the exact `india_schema_file_manifest.path`, `india_schema_migrations.version`, and required tables/triggers.

## Actual execution attempt and blocker
1. Attempted to apply source PR #28 migration 0015 against the isolated clone on 23 October 2026.
2. Cloudflare rejected the D1 POST/query with HTTP 400: **“Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.”**
3. Read-back confirmed clone remains at schema version 0014; no `india_document_*` tables created, `PRAGMA quick_check=ok`, `PRAGMA foreign_key_check` empty and 83,712 postal rows intact. The API did not complete migration 0015.
4. Per Cloudflare's D1 changelog (Sept 1, 2026), both Worker-binding and REST D1 writes are blocked until account quota resets at **midnight UTC**. Do not retry repeated writes or bypass account limits. This is a **BLOCKED** gate, not PASS.

### Recovery-safe run order when quota permits writes
1. Independently inspect clone D1 name/UUID, ensure no Worker references clone, verify real UAT D1 source UUID, and capture NEW clone point-in-time bookmark and SQL export. Recheck `PRAGMA quick_check`, foreign keys and baseline counts. Use a change-window lease to avoid concurrent modification.
2. Obtain exact SQL files using the pinned integration branches above. Confirm each version's source hash; preserve approvals and review original-document handling.
3. Apply **one numbered migration at a time**, sequentially 0015 → 0024, ONLY to clone. Verify API success, exactly one new version ledger row, exact manifest path (0015 requires explicit manifest reconciliation), new required tables/triggers, `PRAGMA foreign_key_check` empty, `PRAGMA quick_check=ok`, and baseline account/member/postal/lead counts. Note 0015 contains an intentional existing-deal `stage='solution_design'` reset and release status cleanup; reconcile approved pre/post state and get change owner approval before applying this non-additive portion.
4. At any error, STOP before next migration. Compare bookmark and clone live state and restore the **clone only** to its approved pre-migration PITR bookmark; verify the unchanged baseline and rerun preflight. Do not reset production or original UAT.
5. Capture final schema ledger 15–24, file paths, DDL/integrity and post-migration snapshot; preserve a downloadable secured SQL backup and retain migration evidence.

## Real Cloudflare Access UAT — outstanding independent gate
Application: `India UAT - operational release gate`, host `uat-india.elang-haqeem.workers.dev`.
Cloudflare Access policy currently allows these exact named accounts; real UAT D1 and clone both have active matching roles:
| Test identity | Expected role |
| --- | --- |
| `jminyak01@gmail.com` | presales |
| `aurakasih6987@gmail.com` | finance |
| `icopdeit@gmail.com` | approver |
| `serayamg@gmail.com` | sales A |
| `technotamaartharaya@gmail.com` | sales B |

Cloudflare One-Time PIN identity provider is permitted, but permission and active membership are NOT evidence of completed real human login.
On the inspected Access authentication logs since 20 October 2026, **no events were returned for these five emails**. Genuine user sign-in and authenticated transaction tests therefore remain **NOT EXECUTED**.

To run real tests, each actual account owner must complete the email OTP challenge and provide a legitimate, short-lived signed Access session/JWT through an approved **secret-management path**, not chat, repo source, or an issue comment. Do not forge or replay a JWT. Validate RS256 signature/JWKS, Access issuer, exact app AUD, expiry, claimed email and role mapping before testing. Existing `scripts/india-cloudflare-access-real-uat.mjs` covers only Sales A/B/Admin; it is **not** a substitute for the five-role feasibility workflow.

**Prerequisite:** deploy the exact reviewed source to an isolated UAT Worker bound to the **migrated clone**, with its own Access application and valid AUD; do NOT point production or the existing UAT Worker to the clone without a separately reviewed switch. Current `uat-india` remains bound to the original 0014 database.

Required transaction UAT once ready:
- Sales A/B: each creates/views their own Opportunities and is denied access to the other's details and write paths (403).
- Presales: draft a real VAPT plan and reserve resource person-days; cannot read confidential Finance HPP or approve their own plan.
- Finance: input confidential labor and supplier license costs; verify quote expiry, capacity and gross margin without leaking data to Sales/Presales.
- Approver: independently approve a current plan and reject same-maker or stale/expired supplier evidence.
- Negative cases: overbooked engineer month, duplicate reservation, tampered scope, mismatched OEM SKU, forged document reference, canceled allocations and stale quotation — all fail closed.
- Confirm Tender→Vault original-file evidence gates plus quote DOCX/stage advancement and immutable audit trail. Record actual actor emails, HTTP status codes, database audit events and no-production-write verification. Never record JWT/cookies/OTP codes.
- Obtain separate Finance, Presales, Security and Release signoff. PR #24/#25/#27/#28 dependencies remain Draft pending review.

## Gate matrix (23 October 2026)
| Gate | Status |
| --- | --- |
| Source migration version ownership 0015–0024 mapped | PASS |
| Original UAT preservation and full isolated clone/rollback | PASS (previously verified) |
| Cloudflare quota allows clone D1 writes | **BLOCKED** |
| Actual numbered migrations applied to clone (0015–0024) | **NOT RUN** |
| Five Access policies and matching UAT/clone role mappings | PASS (configuration only) |
| Real five-account OTP sessions and signed JWT transactions | **NOT RUN** |
| Live combined application deployed against migrated clone | **NOT RUN** |
| Release to production | **HOLD** |

Reference: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
