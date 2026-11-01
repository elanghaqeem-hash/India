# INDIA PR #96 / #101 / #103 — 1 November 2026

Production release status: **BLOCKED**. Source integration and automated validation do not certify operational use.

## Integration
- PR #101 merged as `f99b95cae647dd45ea20304605bbf812ac8e8129`; this adds staged catalog/CI tooling and no application runtime change.
- PR #103 is the canonical replacement candidate for #96. Existing migrations 0001–0039 remain unchanged. Only additive 0040–0045 may be used; never replay the conflicting #96 versions 0038–0039.
- Candidate includes the current main login behavior and #101 tooling.
- HR GET now filters people and skills to the authorized legal entity, including descendants. Regression test covers a second legal entity and denies unauthorized access.
- Historical financial-close records without snapshots are rejected for approval with a clear 409 response. An independent reviewer can reject and Finance can submit a fresh request; old maker/reason remain immutable. SQL guards also reject missing snapshots and historical-evidence rewrites.
- Restore rehearsal accepts explicit target migrations and rejects incomplete/duplicate chains and failed preservation. Legacy default target 30 remains compatible.

## Executed evidence
- ERP extension handler tests: 8 PASS / 0 FAIL, including two new regressions.
- ERP foundation handler tests: 6 PASS / 0 FAIL.
- Enterprise contract and negative matrix: 26 PASS / 0 FAIL.
- UAT catalog tests: 3 PASS / 0 FAIL.
- Seven batch catalog checks: PASS; 420 definitions verified, **0 operational case PASS**.
- TypeScript: PASS.
- Automated functional gate: 16/16 groups PASS, 40 menu routes; source/synthetic evidence only.
- Original production export from 31 October (24,983,156 bytes), SHA-256 `3cf0bf3854b4f7125bdbc8c180dba7971f39bdc8795f7517b0ee34e439c67dab`, restored twice locally. Migrations 0040–0045 applied, 119 original table projections preserved, quick_check OK, zero FK violations. Injected failure rolled back to the exact original schema and fingerprints. See evidence/pr103-20261101/original-backup-local-replay.json. SQL/customer data is not committed.

## Production blockers and next release steps
1. Cloudflare rejected creation of dedicated `india-pr103-restore-20261101`: HTTP 403, code 7406, account maximum 10 databases. All five historical INDIA rehearsal databases inspected contain existing data (41–168 tables); none was deleted or overwritten. Provision additional capacity or designate a disposable database after safeguarding its data, then restore/reconcile the original export on remote D1.
2. Obtain real Cloudflare Access UAT with distinct authorized role holders, source-bound evidence and the independent function/release signoffs required by the master prompt. Synthetic tests are not substitutes.
3. Recheck current production source/schema, take a fresh export, verify financial/Vault reconciliation, apply reviewed 0040–0045, deploy the approved exact SHA through Cloudflare Builds, then verify routes, bindings, monitoring and rollback.

## Production observation
Worker `india` remains deployment `874bde7c-6260-4cb1-be97-65d29aa78a78`, version `d0a595ed-95e9-470b-8830-862e5e26f42b`, at 100% traffic. Production D1 remains schema 0039, quick_check OK and zero FK violations. No production SQL was changed in this execution. Automatic build trigger still selects `release/india-signed-production`, not `main`.
