# INDIA P1–P2 commercial integration

22 October 2026 · Asia/Jakarta. Branch: `feat/india-p1-p2-integration-20261022`.

## Result

This branch combines the existing Activity/SLA work in PR #21 and Lead Intelligence work in PR #22 with tender clause compliance, vendor validation, Opportunity email import, transactional negotiation links, sales forecast and independently reconciled revenue. It reuses the deployed canonical Marketing–Sales and Presales–PO model. There is no production deployment in this change.

| Priority | Entry point | Behavior |
| --- | --- | --- |
| P1 | `/sales/activities` | Owner calendar, Next Action, overdue queue, immutable execution timeline, Lead response SLA and manager alert inbox. |
| P1 | `/sales/lead-intelligence` | Explainable weighted score, Hot/Warm/Cold, nurture cadence, disqualification reasons, controlled reactivation and cohort conversion analysis. Completed Activity tasks contribute engagement; planned/cancelled tasks do not. |
| P1 | `/sales/compliance` | Requirement-by-clause matrix linked to RKS/KAK, mandatory flag, response/evidence, independent reviewer, vendor capability/capacity validation and vendor offer price/expiry checks. |
| P1 | `/sales/communications` | Import original UTF-8 `.eml` files, exact-byte SHA-256, immutable email metadata/plain-text excerpt, reply/thread identifiers, Opportunity and offer-release context. Duplicate Message-ID/hash and cross-owner requests are rejected. |
| P1 | `/sales/lifecycle` | Negotiation can reference an imported inbound email from the same Opportunity and active release. Importing an email never approves a decision or bypasses original evidence, pricing, submission or PO checks. |
| P2 | `/sales/forecast` | Month/Sales filters, policy-weighted pipeline, Commit and Best Case, overdue closing estimates, verified booked sales, independently verified revenue, data-quality gaps, stage/owner comparisons and CSV export. |
| P2 | `/sales/revenue` | GL/invoice/acceptance reconciliation against a verified Closed Won PO; independent approval; immutable decided entries; exact, independently approved reversal; cumulative recognition cannot exceed PO. |

## Operational controls

- All new APIs verify Cloudflare Access and D1 membership through the existing `authorizeBoQ`. Sales A cannot read or mutate Sales B's Opportunity or financial data. Viewer has no access to these commercial APIs.
- Mutations use a D1 batch with an optimistic guard and mandatory audit. An audit failure or concurrent version change rolls back related records. New JSON readers enforce limits while streaming, including chunked requests.
- Vendor/offer approval requires Finance/Admin, independently of the maker. Technical/security/vendor clauses require Presales/Admin; commercial clauses require Finance/Admin. Revisions reset validation, retain previous snapshots, and require independent review again.
- Tender stage advancement, quotation export, submission and forecast Commit recheck current compliance. A reviewed summary without a mandatory clause matrix cannot release a tender quotation. A suspended/expired vendor or expired offer reopens the effective gap.
- Procurement changes require an early stage or controlled return to Solution Design. Closed Opportunity communication is locked.
- Reopening a soft-disqualified Lead archives its previous SLA, starts a new response window, and preserves the lifecycle trail. Nurture reminders are idempotent by plan version and appear in the in-app alert inbox using the existing Cron Worker.

## Financial definitions

Pipeline uses `estimated_value_idr` from the real Opportunity, not an invented quotation amount. Probability policy `stage-v1`: Prospecting 10%, Qualified 25%, Discovery 35%, Solution Design 50%, Commercial Review 60%, Quotation Sent 70%, Negotiation 80%, Pending PO 90%, Won 100%, Lost 0%. Weighted pipeline includes only open, valid, non-omitted deals with expected closing in the selected month.

Commit requires Pending PO, a current approved package/BoQ, a verified submission, the latest approved customer negotiation and current tender compliance. If those prerequisites change, the report downgrades the saved Commit to Best Case and shows a quality issue. Best Case is an inclusive scenario containing Best Case plus Commit; it is not added to Commit again.

Booked Sales uses independently verified PO value before VAT and the actual Closed Won audit date in WIB. Verified Revenue uses independently approved reconciliation entries in their recognition month, including signed reversals. Neither pipeline nor Won status creates accounting revenue automatically. The register does not post to an external ERP/GL. Missing legacy PO/release/closing evidence is exposed as a quality gap.

CSV export uses the same authorized cohort and period and neutralizes spreadsheet formulas in text cells. Invalid amounts are excluded with an explicit issue. Aggregations outside supported safe cent precision fail rather than returning silently rounded totals.

## Email integration boundary

The implemented transport is an authenticated `.eml` import from an existing mailbox. No mailbox OAuth connection, continuous provider sync, outbound send, domain forwarding, or external email/WhatsApp campaign is provisioned by this PR. Imported sender headers are explicitly `imported_unverified`; a human reviewer must inspect original evidence. HTML is not rendered, remote content is not fetched, and attachments remain in the original mailbox/archive. UTF-8 EML is supported, including bounded plain-text MIME/base64/quoted-printable extraction.

## Verification and release status

Final local verification: **PASS**, 237 regression tests in `npm run build:cf`, including the new 23-test integration suite; three additional mobile browser stories passed with no uncaught page errors or horizontal overflow at 375px. The complete Next.js 16.4.2/TypeScript build and OpenNext Worker bundle completed successfully. The browser runner uses a dynamically allocated localhost port to avoid consuming another project's server. Hosted GitHub CI has not run: the push was rejected by automatic approval review because destination-specific publication authorization was not established. All implementation and verification remain committed locally for review.

- Combined handler/schema suite: `npm run test:p1-p2` — 23 tests for authorization, negative scenarios, transaction rollback/CAS, tender release gates, MIME import, duplicate protection, actual negotiation links, forecast, revenue caps/reversals, revised vendor evidence, Activity score contribution, SLA restart and nurture Cron idempotency.
- Browser suite: `node tests/run-commercial-browser.cjs` — three mobile stories through real route handlers and an isolated SQLite D1 adapter. The fixture identity is injected only in the test harness; this does not prove genuine signed Cloudflare Access authentication.
- Existing Activity, Lead Intelligence, Marketing, seven-role Sales, Presales–PO and 44 negative regressions remain release gates. TypeScript, production Next.js 16.4.2 build and OpenNext Cloudflare bundle are required by the new integration CI.
- Real D1 rehearsal database `india-p1-p2-rehearsal-20261022` is separate from shared UAT and production. Migrations through 0020 executed successfully; actual D1 rejected vendor self-approval and premature mandatory-clause approval, and accepted independent reviews. `foreign_key_check` returned no violations and `quick_check=ok`. Aggregate evidence is in `INDIA_P1_P2_D1_EVIDENCE_20261022.json`.
- Shared UAT was read only: schema 0013, frontend SHA `8de0717a…`, zero active non-fixture Sales accounts. Genuine Sales A/Sales B/Admin login testing remains blocked. The new nurture-enabled Cron bundle has not been deployed or observed as a Cloudflare scheduled invocation. Prior PR #21 scheduled evidence applies to that earlier Worker version only.

## Migration and deployment sequence

1. Review the integrated PR and green CI. Resolve any concurrent P0/vault changes explicitly. `0015_secure_document_vault.sql` belongs to a separate workstream; this branch does not include or depend on it. Never infer completeness from the maximum version alone; inspect the migration path manifest and actual objects.
2. Export the target D1, perform an isolated restore rehearsal and verify counts, schema objects, FK checks and quick check. The new empty-database rehearsal here is not a production backup/restore proof.
3. On a dedicated UAT target matching the reviewed source, apply missing 0013, 0014, 0016, 0017, 0018, 0019 and 0020 in order after canonical 0012. Preserve any already-applied 0015. Do not rerun non-idempotent ALTER migrations or use a wildcard migration over an unknown ledger.
4. Deploy the exact frontend source to a UAT-only Worker with a UAT-only D1 and its own Access audience. Create approved real QA memberships for Sales A, Sales B, Admin/Manager, Marketing, Presales, Finance, Approver and Legal as needed. Use genuine login sessions without weakening Access or committing JWTs.
5. Exercise browser/HTTP stories for Activity/SLA, nurture/reactivation, cross-owner denials, matrix revisions, vendor expiry, EML/negotiation linking and independent revenue reconciliation. Verify D1 writes/audits, conflicts and rejected requests.
6. Deploy the revised scheduled Worker only after 0014 and 0020 are present. Observe two distinct actual scheduled invocations and verify nurture/overdue/SLA alert idempotency in D1. Do not equate a manual SQL replay with a scheduled runtime invocation.
7. Complete release review and a fresh production backup before controlled production migration/deployment. Verify production SHA, bindings, schema paths, Smoke tests and monitoring. If rollback is needed, prefer reviewed forward fixes; an old Worker still expects compatible additive schema. Never delete newly created operational records as an automatic rollback.

No customer data, secret, signed export URL or Access token is stored in this document or the evidence file.
