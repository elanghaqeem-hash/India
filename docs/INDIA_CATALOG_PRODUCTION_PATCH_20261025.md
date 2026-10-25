# INDIA catalog production patch — 25 October 2026

This release backports only the 35 service families and 22 standard lead sources requested by the user. The canonical implementation is tracked separately in PR #64.

## Exact production base

- Source base: `08b1a5f108e7a8a5cdf7cda27f3264e31d694982`, the commit recorded by the successful Cloudflare build serving current production.
- Existing 100% Worker version / rollback checkpoint: `30253763-11da-4171-a53f-9a842e990f00`.
- Target Worker: `india`.
- Existing D1 and Access audience/team settings are retained exactly from the production base.
- No schema migration, remote data change, encryption key creation/rotation, provider modification, dependency upgrade or unrelated feature rollout is included.

## Compatibility proof

Lead and Sales Pipeline share the native lead-source dropdown. Existing source values are shown and retained until a user deliberately changes them. All service family values accepted by Lead validation are copied unchanged into Opportunity and Post-PO. BoQ service mappings use existing categories supported by the current database. No additional table, column, trigger, D1 query or environment binding is required by the catalog changes.

The patch preserves production's existing customer/address forms and application shell. New canonical main modules requiring migrations 0013–0030 are not included in this patch.

## Performed checks

- TypeScript passed.
- 192 production-base regression test executions passed in `npm run build:cf`, including catalog registration/conversion against the actual route handlers and an isolated SQLite/D1 adapter. Every one of the 35 service families and 22 source options is covered.
- Next.js production build and OpenNext Cloudflare Worker packaging passed.
- Read-only production D1 preflight: quick_check=ok, foreign_key_check returned no rows, and the migration ledger contains 0001–0012. These are infrastructure checks, not real signed-in user transaction UAT.
- Canonical PR #64 checks were also all successful when inspected.

## Controlled rollout

Deploy this branch's pinned commit through the existing Cloudflare build trigger. Recheck the target Worker, current version, original D1, Access binding values and existing secret binding names immediately before dispatch. After deployment verify a new 100% version, unchanged bindings/schema, and production page/asset availability.

On a release health regression, redeploy checkpoint version `30253763-11da-4171-a53f-9a842e990f00` through the Worker deployments API and verify the restored version. No database rollback is needed for this code-only patch because no remote schema/data write is performed by the release.

The user explicitly authorized all repository pushes and production deployment in this conversation. Signed real-user Access transaction UAT is reported separately and must not be inferred from the synthetic tests above.

## Production outcome

- Cloudflare build `8a63935a-9453-4384-ab6a-a7d6aa5366cd`: success.
- Deployed source commit: `97ac143de5a1694d4ae9235e8ba566371d314086`.
- Deployment ID: `7ea0dcb2-f1b6-44aa-bfc8-73a9aa65a020`.
- Active Worker version: `1b686467-7df5-44ac-a8c1-f71a8b371d3a`, serving 100% traffic.
- Post-deploy checks passed: original D1 binding, original Access audience/team values, existing secret binding names, quick_check=ok, no foreign-key violations, schema ledger still 12 versions with max=12.
- All verification SQL operations reported zero rows written.
- Browser navigation to the production Lead page reached the expected Cloudflare Access sign-in page after deployment. No authenticated transaction or physical-device UAT is claimed.
- Rollback checkpoint remains `30253763-11da-4171-a53f-9a842e990f00`. No rollback was necessary.
