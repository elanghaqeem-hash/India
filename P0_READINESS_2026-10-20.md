# India / ICOP CyberBusiness 360 — P0 staged readiness (20 Oct 2026)

## Verified live resources
- GitHub: `elanghaqeem-hash/India`, default `main`.
- Worker `india` exists and was last deployed via Wrangler on 2026-10-20 06:54 UTC.
- Worker `india` has only `ASSETS` binding: no D1 binding, and public business API is denied.
- Existing UI is a DEMO, including locally seeded sample entities in `src/lib/store.ts`. Do not market as production.
- Source `icop_*_schema.sql` describes PostgreSQL 16, so it CANNOT be applied directly to Cloudflare D1 SQLite.

## P0 delivered on feature branch
- Isolated D1 staging database `india-staging-db` (`8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`).
- `migrations/0001_init.sql`: ten-entity tenant-separated schema, foreign keys, wallet balance checks, immutable ledger, idempotency, audit log.
- Migration applied remotely to staging; verified migration marker `0001_init` and expected tables and triggers.
- `wrangler.jsonc` includes a staging-only `DB` binding. No production binding or API write activation.
- `/api/health` is the only permitted API route; GET probes D1 and returns no private data.
- `src/lib/server/wallet-ledger.ts` is server-only by architecture and intentionally not connected to a public mutation route. Enforces server-verified identity, tenant, active role, integer amounts, and rejects DEBIT until DoA/BAST approval workflows exist.
- AI config GET and POST responses redact key material.

## Confirmed D1 integration tests (UAT fixture in staging only)
- INSERT tenants/users/company/wallet: PASS.
- Ledger issuance 100.00 MD: PASS.
- Reserve 30.00 MD: PASS.
- Reserve above available balance: REJECTED by SQLite trigger (expected).
- Debit 20.00 MD and release 10.00 MD: PASS; purchased 100, available 80, reserved 0, consumed 20.
- Duplicate idempotency key: REJECTED by unique constraint (expected).
- Attempt to UPDATE ledger: REJECTED by immutable trigger (expected).
- Attempt reserve from expired wallet: REJECTED (expected).
- Cross-tenant wallet transaction: REJECTED (expected).
- `PRAGMA integrity_check` through Cloudflare D1 REST returned SQLITE_AUTH, so **do not claim integrity-check PASS**.

## Next gated steps — NOT finished
1. Regenerate/commit `package-lock.json`; run GitHub PR CI typecheck + OpenNext build. Current repo has no package lock.
2. Configure preview deployment `india-staging`; verify `/api/health` HTTP 200 using staging D1 binding, and all business /api/* HTTP 503.
3. Implement trusted identity (OIDC/Cloudflare Access JWT verification against issuer JWKS), active user/role and tenant mapping from database; reject cross-tenant paths, protect same-origin actions against CSRF.
4. Replace UI memory store with tenant-aware D1 queries for customers, opportunities, proposals, approvals and wallets. No demo-to-production migration.
5. Build safe money/token API flows with idempotency, SoD, DoA, linked signed contract, signed BAST, audit trails and structured errors.
6. Configure protected provider secrets only on server, API abuse/rate protection, CSP/security headers, monitoring and backup/restore drills.
7. Run E2E read/write/reload/parallel-request tests; reject overdraw, duplicate and cross-tenant cases; restore-test before production.
8. Review schema parity with PostgreSQL specification and decide whether D1 fulfills audit/reporting and future relational workload requirements.
9. Only after all gates pass create isolated production DB and controlled migration, test deployment promotion. Never auto-seed demo records.

**Release gate**: `main` Worker stays demo; feature branch PR is not proof of production readiness.
