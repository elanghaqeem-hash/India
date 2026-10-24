# INDIA — Secure Document Management continuation

Date: 24 October 2026 (WIB). Base: PR #35, commit `487b11478f31be8928121b0715228406af90c8cb`.

Status: source verification PASS; remote migration/rollback PASS; genuine human Access acceptance NOT RUN. Production HOLD.

## Result

Converges the previously separate PR #23 original-document hardening into PR #35's canonical Vault–Tender, commercial and administration code. The canonical migration plan remains unchanged: 0015, 0016–0020, 0021 Tender, 0022 Vault Governance, 0023 Tender evidence, 0024 Targets, 0025 Feasibility, 0026 Administration. No new or renumbered migration is introduced. The previously available PR #28 correction also registers the exact 0015 path in the file manifest.

- Proposal submission/approval, submission registration/review, customer decision and PO registration/independent review authenticate the stored original: exact Opportunity, current release, purpose, SHA-256 and AES-GCM bytes. Inbound email context and Tender/Feasibility checks are preserved.
- Proposal, submission and award workspaces now upload encrypted originals through the existing Vault endpoints. Reference and digest fields are read-only and populated from the server response. Submission time retains local timezone and second precision. Standalone NDA/RKS/KAK/Quotation and numbered original versions remain available in the unified Documents workspace.
- PO verification reauthenticates the selected original. Final Won reauthenticates the exact proposal, verified submission, latest approved customer decision and checked PO/SPK for the current release. A corrupted original cannot advance even after an earlier approval.
- Retention and legal-hold writes compare the reviewed retention/hold state inside the atomic transaction. A concurrent extension or new investigation cannot be overwritten by a stale request; its audit rolls back with the rejected update.
- Restored Vault regression suites are explicit CI gates. Current transactional, commercial, Feasibility and module fixtures now use stored synthetic originals with the canonical Vault schema. Deliberately historical migration tests remain explicit; no application fallback accepts missing Vault schema or metadata-only evidence.

## Verified locally on the combined source

| Check | Result |
|---|---|
| Encrypted Vault, governance, Tender original gates | PASS: 34 tests |
| Actual-handler Sales lifecycle transactions | PASS: 26 tests |
| P1/P2 commercial integration | PASS: 23 tests |
| Modules 13–15 | PASS: 19 tests |
| Negative API/domain cases | PASS: 44 tests |
| Marketing/Sales consolidation | PASS: 26 tests |
| Layout and conversation regressions | PASS: 16 tests |
| Feasibility and Executive suites | PASS |
| Next.js TypeScript and production build | PASS |
| OpenNext Cloudflare Worker bundle | PASS |
| Combined HTTP/browser fixture acceptance | PASS: 18 tests, including the original-document journey through independent role reviews to Won, Android/desktop and cross-owner denial |
| Existing AI composer/conversation browser checks | PASS: three viewport scenarios and two four-turn/reset scenarios; provider responses mocked |

Additional tests verify corruption in each of the four original types after review, missing schema failing closed, concurrent retention extension and concurrent Legal hold changes. Browser identities are fixture identities; this is not genuine Cloudflare Access acceptance. No malware-scanning, electronic-signature validation, automatic destruction or R2 storage claim is made. Retention remains governed preservation/review; originals cannot be physically purged through this implementation.

## Fresh remote clone evidence

Target: existing isolated `india-uat-full-restore-20261023`, D1 `5b9b58de-be29-48bb-9023-018c7f15f68b`. All 15 Worker settings were inspected and none bind this clone. Production/shared UAT/Vault UAT bindings were preserved.

1. Fresh native full SQL export completed. It has 31,642,830 bytes and SHA-256 `920ed54ff2a2554b8a5cf18c6517f91502d2f5733563ae0327ed5b1e2a0c9370`, exactly matching the prior saved clone artifact.
2. Remote read preflight succeeded: ledger 3–14, 51 application tables, `quick_check=ok`, no foreign-key violations and zero transaction guards.
3. The first isolated atomic probe was refused by daily D1 quota. Native export afterward was byte-identical. After UTC day rollover, query/write access resumed and the probe reached its intentional constraint; the probe table did not survive rollback.
4. A real remote 166-statement rehearsal applied all migrations inside one transaction and then deliberately failed with a unique final `marker=17427` constraint. The original ledger/schema/data recovered: zero new Vault/probe objects, clean integrity, and a native full export **byte-identical** to the pre-migration backup.
5. The guarded 164-statement canonical 0015–0026 batch then committed successfully. Ledger 3–26, clean foreign keys, `quick_check=ok` and zero transaction guards were verified remotely.
6. The actual migrated clone's native export was restored and compared with the backup and local rehearsal: **49 non-metadata tables retain all original-column data; 270 schema objects match**. The only changed pre-existing tables are the migration ledger and file manifest; the expected `communication_id` column is present.
7. The inherited PR #35 copy of 0015 omitted its file-manifest insert. Reused the exact existing PR #28 one-line correction after verifying the stored schema fingerprint. A guarded three-statement metadata repair added only the missing path, touching no original bytes. All 12 exact paths 0015–0026 are now present.
8. Final native SQL backup: **31,707,970 bytes**, SHA-256 `ebedb7e1f607f14a5de6124fc7bccaa5d18e181fb503c21ddfa852a79dd4dd93`. It contains the completed schema and manifest. The clone currently has zero Vault originals, so the environment still needs isolated encryption-secret provisioning and real operational file UAT.

Native SQL, detailed remote receipt and local rehearsal evidence are kept in the private continuation artifact, not in Git. No signed URLs, JWTs, provider keys or encryption secrets are included in this source report.

## Remaining operational gates

- Remote migration and rollback on the existing clone are complete. Do not replay them. Preserve the before/after native recovery backups and inspect exact schema paths/objects before further operations.
- Stage an exact CI-green source SHA in an isolated Worker with the correct clone binding, Access issuer/audience and Vault encryption-key continuity. Existing deployed environments still serve earlier code.
- Execute genuine separate signed human Access sessions for the required roles. Fixture identities, an OTP policy, onboarding rows and this local browser journey do not prove those logins.
- Complete independent release review before production promotion. This continuation performs no production deployment and no Access-policy or encryption-key mutation.
