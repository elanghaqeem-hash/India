# INDIA UAT Dummy Users — 20 October 2026

## Verified setup

Cloudflare account: `208155f241d4da84e1a6a9b44b7a8d28`.
- **UAT-exclusive D1**: `india-uat-users-db` (`eaed652e-7322-4950-a304-dd50baa5de02`), created on this run. Schema copied from existing INDIA D1 **definitions only** (22 user tables + 15 indexes), not business data or API key ciphertext.
- **Existing INDIA Worker D1**: `india-staging-db` (`8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`). The production-facing `india` Worker was **NOT** redeployed or pointed to UAT.
- Existing active Admin preserved; no previous live membership edited.

Seven fixture email/role records:

| Email (reserved non-deliverable domain) | Role | UAT isolated database | Existing Worker DB |
|---|---|---|---|
| uat.admin@india.invalid | admin | active | INACTIVE |
| uat.sales.a@india.invalid | sales | active | INACTIVE |
| uat.sales.b@india.invalid | sales | active | INACTIVE |
| uat.presales@india.invalid | presales | active | INACTIVE |
| uat.finance@india.invalid | finance | active | INACTIVE |
| uat.approver@india.invalid | approver | active | INACTIVE |
| uat.viewer@india.invalid | viewer | active | INACTIVE |

All seven UAT rows were created and selected back successfully. Existing INDIA Worker DB's seven placeholder rows were created **with active=0** so Admin can view their roles without granting login access. This avoids polluting real sales/customer records and avoids an accidental production authorization route.

## Login/authentication truth
- No passwords, temporary credentials, API keys or Cloudflare Access identities were created.
- `.invalid` is intentionally non-routable; dummy email rows cannot receive OTPs or complete Cloudflare Access sign-in. D1 membership alone does not grant access.
- `authorizeBoQ` requires signed, verified Cloudflare Access JWT **and** `active=1` membership in the DB bound to the Worker. There is no mock-token bypass.
- The UAT database is **not bound to an application Worker yet**; to conduct interactive UAT, deploy a *separate protected UAT Worker* bound exclusively to this UAT D1 and provision real, allowlisted QA email identities in Cloudflare Access using their verified addresses. Reserved dummy identities serve offline RBAC fixtures rather than live users.
- The above changes do not prove login tests have run.

## Checks completed
1. New database creation success.
2. Schema-only copy success (22 table definitions; 15 indexes).
3. Seven parameterized identity INSERT operations success, and returned records role/active status match.
4. Data isolation check UAT D1: customers = 0, opportunities = 0, BoQs = 0, AI provider rows = 0.
5. Mirror 7 disabled placeholders in existing Worker D1; existing active Admin preserved.

## Cleanup
UAT DB: `DELETE FROM india_members WHERE created_by='INDIA_UAT_FIXTURE_20261020';`
Existing Worker DB: `DELETE FROM india_members WHERE created_by='INDIA_UAT_FIXTURE_DISABLED_20261020' AND active=0;`
Do **not** run cleanup on records with different provenance.

## Next steps for interactive UAT
1. Provision *real* QA testers through Cloudflare Access (no shared passwords), or run automated unit/integration simulations against UAT D1.
2. Deploy an INDIA UAT Worker isolated from the main production-facing `india` Worker.
3. Run A01–A24 scenarios in `docs/INDIA_SALES_UAT_RELEASE.md`.
4. Keep PR Draft until all release gates pass.
