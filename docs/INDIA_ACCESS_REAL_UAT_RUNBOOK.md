# INDIA — Real Cloudflare Access UAT: Sales A / Sales B / Admin

Status: **SAFE RUNNER READY, LIVE HUMAN-JWT TRANSACTIONS NOT YET EXECUTED**.
Do not call SQLite HTTP simulations a Cloudflare Access login test.

## Isolation preconditions
- Explicit dedicated UAT Worker name begins `uat` or `staging`; test base URL matches Worker hostname and contains `uat` or `staging`.
- Worker `INDIA_DB` is confirmed by the **Cloudflare read-only Worker settings API** to point only at dedicated UAT D1 `eaed652e-7322-4950-a304-dd50baa5de02`. Live D1 `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5` is forbidden.
- Migrations `0003`, `0004`, `0005`, `0006` already applied *on dedicated UAT* and validated with `scripts/india-uat-d1-readonly-preflight.mjs` using a separate D1 Read token.
- Cloudflare Access policy permits **three different real UAT human identities**. `.invalid` fixture accounts cannot receive login. Active `india_members` rows must map Sales A and Sales B to `sales` and Admin to `admin`. Do not bypass Access JWT verification.
- Actual logged-in Cloudflare Access JWTs must be current, signed with RS256, and issued by the UAT Access application AUD. Never commit tokens, paste them into chat, or output them to CI logs.
- The test **creates and preserves** two clearly marked fictitious UAT Lead → Account → Opportunity transactions. No production or external integration side effects permitted.

## GitHub Actions manual setup
Workflow: `.github/workflows/india-real-cloudflare-access-uat.yml`, manual dispatch with `RUN_ISOLATED_UAT_ONLY`.
On GitHub, workflow_dispatch generally requires the workflow file to be present on the default branch before manually running it. Do not merge the feature branch or deploy the production Worker solely to enable testing. Run from an approved dedicated UAT branch/repository workflow when available.

Repository/environment variables:
```text
INDIA_UAT_BASE_URL                = https://<uat-worker>.<account>.workers.dev
INDIA_UAT_ALLOWED_HOST           = <exact same UAT hostname>
INDIA_UAT_WORKER_NAME            = <uat-worker>
INDIA_UAT_ACCESS_TEAM_DOMAIN     = <team>.cloudflareaccess.com
INDIA_UAT_EMAIL_SALES_A          = <real approved UAT mailbox>
INDIA_UAT_EMAIL_SALES_B          = <real approved UAT mailbox>
INDIA_UAT_EMAIL_ADMIN            = <real approved UAT mailbox>
```

Secret names (values MUST stay out of this repository and messages):
```text
INDIA_UAT_CF_WORKER_READ_TOKEN     Cloudflare Workers script-settings Read only
INDIA_UAT_ACCESS_AUD              Access application audience used by UAT Worker
INDIA_UAT_JWT_SALES_A             short-lived signed human identity Access JWT
INDIA_UAT_JWT_SALES_B             short-lived signed human identity Access JWT
INDIA_UAT_JWT_ADMIN               short-lived signed human identity Access JWT
```

The script also requires `INDIA_UAT_D1_ID` pinned to isolated UAT D1 and `INDIA_UAT_ALLOW_WRITE=YES_ISOLATED_UAT`; the manual workflow supplies these two constants.

## Live UAT acceptance evidence
The runner prints only checked scenarios, synthetic record IDs, and a final PASS/BLOCKED result. No JWT or private API token is printed.
1. Cryptographically validate all three RS256 Access JWT identities, issuer and app audience.
2. Read Cloudflare Worker settings and assert that `INDIA_DB` points at UAT D1 (read-only Cloudflare API).
3. Each role authenticates to `GET /api/leads`; confirm role and identity returned by D1 membership.
4. Sales A and B each create Lead. A/B cross-owner GET is 403, Admin sees both.
5. Each Sales Lead goes `new -> contacted -> qualified` with valid qualification.
6. Sales B cannot convert A's Lead. Sales A converts own Lead and Admin converts B's Lead, with ownership preserved.
7. Confirm converted Lead has matching Customer/Opportunity IDs, owners see only their own Sales deals, Admin sees both.
8. Attempt duplicate conversion (409), cross-owner Opportunity detail (403), and cross-owner direct Opportunity creation (403). Verify Sales audit event `LEAD_CONVERSION`.
9. Separately run read-only D1 preflight for migration versions, FK integrity and orphan counts after execution. Record workflow URL, commit SHA, UAT Worker name, D1 ID and run marker.

## Result semantics
- `PASS`: all live authenticated HTTP assertions succeeded, and Worker binding attestation succeeded.
- `BLOCKED_OR_FAIL`: missing or expired JWT, absent Access configuration, UAT binding mismatch, non-JSON Access challenge, transaction failure, or invalid role. **Not** a PASS.
- GitHub CI simulation `17/17` tests and harness safety tests are **not** equivalent to this live procedure.

Do not run this on `india.elang-haqeem.workers.dev` or against the production DB. No production deployment/merge has been authorized by this test procedure.
