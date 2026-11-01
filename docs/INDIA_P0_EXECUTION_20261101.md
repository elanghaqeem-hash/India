# INDIA / RTICORE — P0 Execution & Non-Production Release Containment
Date: 2026-11-01 (Asia/Jakarta)
Scope: PR #96 / #103 / #104, production D1, signed Access UAT, CI release gate.
Decision: **HOLD — NOT CERTIFIED**. No production write, Worker deploy or Cloudflare Access change was performed.

## Executed controls
1. Changed `tests/india-login-browser.test.cjs` to expect `Login RTICORE` and correct forbidden identity text.
2. Changed `tests/ai-chat-composer-browser-uat.cjs` to target the actual `RTICORE AI Business Assistant` accessible dialog.
3. Replaced `.github/workflows/rticore-production-release.yml` with an explicit manual-only, non-deploying `exit 1` HARD HOLD. The previous candidate had automatic `push: main`, exposed an entire production D1 export as a CI artifact and could restore production D1 to a previous bookmark without a concurrent-write fence. No credentials, backups, account data, or JWTs are included here.
4. Added `scripts/india-p0-source-gate.mjs` and `.github/workflows/india-p0-source-gate.yml` to reject duplicate canonical migration IDs (>=0030), accidental automatic production release and stale tested login/AI label selectors.
5. Converted PR #103 and #104 to **Draft**, preserving all source code until a single canonical migration lineage is established. PR #96 remains Draft/conflicting.

## Unresolved canonical D1 collision (DO NOT MERGE AS-IS)
- Production and main: migrations 0001–0039 canonical; D1 max version 39 (read-only inspection).
- PR #103: reuses 0040–0045 for legacy WP2 and financial close/Treasury/HR/connector expansions, with preservation tests.
- PR #104: reuses 0040–0044 for RTI parameter/policy, posting, tax/payroll, policy runtime and bulk tenant rekey. Migrating either branch independently makes the other's numeric lineage incompatible.
- The new source gate only detects duplicates **after** both sets enter one tree; it cannot certify cross-PR compatibility. The two PRs remain Draft until a reconciled integration candidate has exactly one immutable version per number.
- Required integration: inventory table/trigger names, normalize all additive migrations after 0039 with disjoint versions; regenerate any derived SQL and update every manifest assertion, test fixture and report; preserve existing columns/rows; replay against an independently restored original, with backup checksum, row projections, foreign keys, trigger checks and injected-failure rollback. Do not renumber files alone or delete legacy SQL to force merge.
- Tenant rekey `0044_rti_tenant_key.sql` changes keys across 116 tables and recreates 233 triggers. Defer until separate approved cutover with actual data continuity and Vault decryption tests. Consider a compatibility key strategy instead of bulk production rekey.

## P0 operational blockers
- A real, dedicated, Access-protected current-schema UAT environment with isolated D1 and original cryptographic key continuity.
- Actual signed JWT session tests for Admin, Marketing, Sales A/B (two distinct holders), Presales, Finance, Approver, Legal, Viewer and approved extended enterprise roles.
- Approved staff organizational assignments, ERP legal entity scopes, least-privilege grants and revocation/SoD tests. The production D1 role roster is not equivalent to verified signed Access UAT.
- All 210 legacy + 210 ERP cases executed with real actor, real evidence, source SHA, before/after D1 and separate approval: **0 cases may be declared operational PASS from test catalog or synthetic CI alone**.
- Independent backup, original SHA-256, private durable storage, restore and rollback rehearsal; verify RPO/RTO, business source documents and decryption continuity.
- Independent Security, Finance, Legal, HR, Procurement, Cyber Operations, Recovery and Release Owner signoff; signed Ed25519 exact-SHA release receipt, zero open P0/P1.
- GitHub main branch protection and required checks must be configured by repository administrator using Settings → Rules → Rulesets (or Branches); this connector exposes read-only protection status, not a protection mutation endpoint. Require PR reviews, no direct pushes, required P0/automated tests, and prevent bypass.

## Exit criteria for P0
No migration deploy or label rename production until:
1. Candidate CI at the exact SHA is green, including browser and the new P0 source guard.
2. One canonical migration chain and independent data-preserving restore rehearsal are green.
3. Branch protection is demonstrably active.
4. Authentic Access role identity/grant/revocation UAT and 420 operational UAT cases have evidence.
5. Separate release authority signed artifact and functional owners approve exactly the candidate SHA.
6. A follow-up audited workflow reinstates controlled deployment with verified safe backup handling and rollback strategy.

**State: P0 containment implemented in PR #104, full P0 business completion blocked on external evidence and migration reconciliation.**
