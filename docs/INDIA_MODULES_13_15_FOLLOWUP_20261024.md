# INDIA modules 13–15 — continued execution

24 October 2026 WIB. **DRAFT / PRODUCTION HOLD**. This supersedes the operational blockers recorded on 23 October, without rewriting the historical evidence.

## Candidate source and validation

- Continue from `ce0c64d06c12d0e130345e4dd99608198abda666`, retaining the genuine six-role Access UAT runner and prior tester/OTP onboarding evidence.
- Merge main `08b1a5f108e7a8a5cdf7cda27f3264e31d694982`, then the newly merged main `f2845fc087a8cdcc6cab0061191fade7fba3d2fb`, without conflicts. This retains #38's mobile AI composer fix and #30's bounded multi-turn AI history, Indonesian preference continuity and safe Markdown rendering. Publishing this feature branch does not trigger the main-only production hotfix workflow.
- Full regression and Next/OpenNext Cloudflare packaging PASS on the combined candidate; consolidation 26/26; new offline UAT safety tests 4/4; combined layout/AI conversation/format regressions 16/16. Browser runner PASS: 8 module/stage-filter tests, three mobile/desktop composer scenarios, and two four-turn conversation/reset scenarios. AI responses are mocked in these layout/conversation browser checks; they do not prove real OpenRouter or human Access acceptance.
- Native SQL backup checksum remains `ca7e56c8777353d04c340d853a9ef337343c82c83a958878f07758894963815e`. All 12 canonical migration files 0015–0026 still match the hashes in the prior successful local restore/migration/rollback evidence. Reusing this verified artifact is not a fresh remote restore or migration.

## Live UAT runner corrections

1. Send the genuine signed application JWT as `Cookie: CF_Authorization=...` to the Access edge. The edge supplies `Cf-Access-Jwt-Assertion` to the origin; the client no longer injects that header. Application RS256/issuer/audience verification remains required. See [authorization cookie](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/) and [origin JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
2. Pin signed sessions to the actual UAT Worker's Access issuer and audience. Independently read all six active D1 memberships and require each signed email's exact intended role before the first write. An Admin session mislabeled as Sales is rejected.
3. Transactions can target only the existing restored clone `5b9b58de-be29-48bb-9023-018c7f15f68b`. Shared UAT `eaed652e-7322-4950-a304-dd50baa5de02` remains available for read-only preflight; production and arbitrary database IDs fail before network activity.
4. Require the exact deployed candidate SHA, consolidated schema version 0026, required tables and integrity checks. A generic HTTP 403, including edge error 1010, is not accepted as a genuine Access challenge. Redirects must resolve to the pinned team or UAT origin's `/cdn-cgi/access/` path.
5. Push runs offline safety tests only. Real preflight and transactions require manual workflow dispatch and the protected `india-uat` environment. This separation does not mark any operational gate passed.

## Fresh Cloudflare evidence

Read-only inspections on 23 October 2026 at approximately 23:24–23:28 UTC (24 October, 06:24–06:28 WIB):

| Control | Fresh result |
| --- | --- |
| Restored clone inventory | `india-uat-full-restore-20261023`, ID `5b9b58de-be29-48bb-9023-018c7f15f68b`, present; file size 21,209,088 bytes. Inventory size alone does not prove content integrity. |
| Clone isolation | All 15 current Worker settings inspected successfully; no current Worker binds the clone. |
| Production binding | `india` remains bound to `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`; not modified. |
| Shared UAT | `uat-india` remains bound to `eaed652e-7322-4950-a304-dd50baa5de02`, release SHA `d055bc5928020c35453193921560d3818f811c19` (a different candidate). No encryption-secret bindings observed on this Worker. |
| Vault UAT | `uat-india-vault` remains bound to `2e07af65-99ac-4c6f-a162-361890d1b1d9`, release SHA `64977431588e45dc59f3875f0f82dc365d33bea1`, document encryption secret binding present. |
| Access onboarding | UAT app still has two allowed IdPs and two Allow policies: one approved Admin email and five exact tester email rules; no broad-domain/everyone rule in either Include list. Mailboxes are not stored in this public report. |
| Signed human evidence | Account Access user list still contains only one human identity. The five configured testers' successful OTP sessions and role-bound transactions are not proved by policy entries. |
| Clone SQL inspection | **BLOCKED**: Cloudflare HTTP 400 / code 7500, account free-tier daily row-read limit exceeded. Migration-ledger and object-inventory queries were refused by the provider's daily limit. No schema/version/integrity pass is inferred. |

The earlier database-creation limit is no longer the only relevant issue: a restored clone now exists and must be reused safely. Its content, migration ledger, fresh backup/checksums and rollback must be verified when D1 queries are available. Cloudflare says the daily read limit resets at midnight UTC (07:00 WIB); this report does not schedule or claim a retry.

## Remaining execution gates

- Once D1 queries are available, freshly attest the clone's exact baseline, full legacy objects/counts/hash evidence, current memberships and rollback. Reconcile any noncanonical 0015–0024 ledger/schema before applying the unchanged canonical dependencies through 0026. Do not blindly replay migrations or overwrite active databases.
- Stage the exact CI-green candidate on a separate approved UAT Worker bound to the clone, with an approved Access application/audience and verified Vault key continuity. Keep the other team's `uat-india` candidate intact. The clone is currently unbound; no candidate deployment is claimed.
- Set protected environment variables `INDIA_FEASIBILITY_UAT_WORKER_NAME`, `INDIA_FEASIBILITY_UAT_BASE_URL`, and `INDIA_FEASIBILITY_UAT_D1_ID` to that actual Worker/origin and the clone ID. The safe defaults still point read-only preflight at shared UAT; transactions reject those defaults. Supply the read-only API token, actual Access issuer/audience and six distinct genuine role sessions through the protected environment. Never put JWTs or API/encryption keys in chat or Git.
- Dispatch `READ_ONLY` first. Only after it passes, dispatch `TRANSACTIONS` with `YES_ISOLATED_UAT`; retain audit IDs and independently reconcile results. Module-wide Marketing, Legal and second Admin review, Vault lifecycle, original vendor evidence, financial completeness, real AI/provider transport and Cron acceptance remain separate gates beyond the six-role feasibility runner.
- Reconcile pending release work #23/#31/#32/#34/#37 as applicable. Postal's reserved 0022 still conflicts with Vault's canonical 0022 and must not be applied independently. The main campaign, mobile chat and multi-turn AI changes are included through these merges. Actual signed Admin/OpenRouter UAT for the merged AI conversation still remains a separate gate.

No D1 data/schema mutation, Worker deployment, Access policy change or production operation occurred in this follow-up. PR #35 remains Draft until real operational gates pass.
