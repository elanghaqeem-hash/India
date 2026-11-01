# PR #96 canonical compatibility assessment — 31 October 2026

**Branch:** integration/pr96-reconcile-canonical-d1-20261031
**Main before review:** 739526dbc27f6631b521347fe37835232479f9f3
**Source:** PR #96 c8130162bff5a6f809e030e95ed9ab9d5d72afa7
**Disposition:** NOT APPROVED FOR PRODUCTION. Keep PR #96 open until replay passes.

## Verified blockers
- Production D1 has versions 0001–0039. Canonical main files `0038_erp_enterprise_controls.sql` and `0039_erp_enterprise_guards.sql` already create `india_gl_close_requests`, `india_erp_access_changes`, `india_erp_role_matrix`, Treasury/HR/SIEM foundation and associated triggers. Live D1 last version=39.
- PR #96 repeats versions 38 and 39 with incompatible `india_gl_close_requests` schema, and repeats trigger name `india_erp_access_change_review`. Direct merge or migration replay would fail.
- Proposed safe migration chain must start at 0040, retain all old records, and avoid dropping canonical tables, renumbering existing 0038/0039, suppressing previous guards, or seeding live postings.
- Close requests on main require `legal_entity_id`, `requested_by` and `reason`; PR #96 new route inserts only `created_by`, `notes`, debit/credit snapshots. Any additive repair must preserve and populate both contracts, and verify pending/approved historical rows.
- Revocation must preserve the existing D1 grant trigger and enforce effective denial for signed old JWT; UI hiding is not sufficient.
- Existing production Worker traffic remains on `dfdef248-5246-4310-b607-9c2956d11f75`; this is NOT proven to contain main PR #99/#100.
- Cloudflare Builds for Worker `india` targets branch `release/india-signed-production` rather than `main`. No matching branch was returned in GitHub branch search as of this assessment. Do not fabricate signed release evidence to make this trigger work.

## Required acceptance
1. Create additive versions 0040+ with no duplicate table/trigger names, no resets to india_schema_migrations, and full up/down rollback planning.
2. Restore original real backup to independent isolated D1, preserve row counts/checksums and migrate; test `PRAGMA foreign_key_check`, `quick_check`, pre-existing finance records, original Vault and login settings.
3. Unit/integration/UAT: signed Access real identities for all approved roles, cross-owner denials, makers/checkers, GL exact reversal and close, P2P 3-way match, Treasury reconciliation without external transfer, HR access deactivation, SOC dispatch sandbox.
4. Enforce independent Security/Finance/Legal/HR/Procurement/Cyber/Operations/Release owner approvals and 420 full UAT evidence per operational certification doc.
5. Only promote an exact commit to the approved signed release branch after the release gate. Verify deployed Worker SHA/version, bindings, D1 migrations, route smoke and rollback.

**No production write/merge/deploy is authorized by this assessment alone.**
