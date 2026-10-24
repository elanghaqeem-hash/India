# INDIA Sprint 1 — Release Readiness Diagnostics (24 October 2026)

## Scope
Extends existing Admin /settings/system Health tab and GET /api/admin/system?section=health. Reuses the D1 ledger and canonical migration manifest queries already present, with no new database table, migration, API route or secret.

## Diagnosis rules
- Require versions 0013–0028 in india_schema_migrations (includes canonical 0028 Mistral).
- Require the canonical path for each 0021–0028 migration in india_schema_file_manifest.
- Flag unexpected same-version manifest paths from old PRs (0021/0022/0024/0025 branch collisions).
- Flag manifest rows that claim migration 0021–0028 applied when ledger disagrees.
- Render missing version and path details in Administration Health. The REST payload includes a machine-readable readiness summary.

## Safety boundary
Ledger/manifest consistency means only that the names agree; it does NOT prove checksum match, actual SQL execution, data equality, original Vault decryption, backup/restore rehearsal, source of a D1 bookmark, signed Cloudflare Access multirole session, real financial transaction, physical Android, or release authorization.

Production gate remains **HOLD** even when schema status says "reconciled". UI explicitly lists independently required evidence and does not permit approving itself. Existing APIs continue enforcing Access server-side.

## Verification
Run npm run test:modules-13-15; exact PR-head GitHub CI and review required. No UAT worker, production Worker, D1 or Cloudflare Access mutation included in this PR.
