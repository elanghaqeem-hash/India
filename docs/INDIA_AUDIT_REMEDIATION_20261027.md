# INDIA — Audit Remediation & Release Hold (27 October 2026)

**Target:** Technotama INDIA, `elanghaqeem-hash/India`. Initial baseline `d02ffb12`. The controlled audit report is `INDIA_Audit_Menyeluruh_2026-10-26.md` and contains 12 findings IND-AUD-01..12.

## Executable source remediation in this branch

| Finding | Change | Evidence / limitation |
|---|---|---|
| IND-AUD-08 / 12 | Reuse PR #64's 22 Lead Sources + 15 Procurement Process choices in `sales-workflow.ts`; shared `ManagedOptionSelect` in Marketing Lead / qualification and Pipeline | Admin's authenticated D1 option registry `/api/reference/options` is additive. Historical saved values remain visible. No unsolicited database seed or overwriting production records. PR #64 remains open until remaining service-catalog work is reconciled separately. |
| IND-AUD-01 | Admin Health adds per-role minimum active D1 roster (2 Admin, 2 Sales, Marketing, Presales, Finance, Approver, Legal, Viewer) | Counts are NOT verified Cloudflare Access JWT sessions; user provisioning and IAM signoff cannot be simulated. |
| IND-AUD-06 | Admin Health shows enabled AI providers, encrypted-key presence and `tested_ok + tested_at` counts | Historical probe metadata only; no decrypting secrets or provider calls. Two active providers lacked successful probe records at the prior audit. |
| IND-AUD-09 | Scoping has explicit session draft save/restore/delete for calculation fields and assets, maximum 30 min and 70 KB. | Deliberately excludes RKS/TOR file bytes, AI text and responses. No D1 transaction until submitted in the canonical workflow; permission checks unchanged. |
| IND-AUD-07 | PR #83 merged before this branch, carrying versioned settings Update/Delete and migration 0032 | Actual maker/checker authenticated UAT and new Worker rollout remain mandatory. |
| IND-AUD-10 | Legacy /api/approvals, opportunities, tenders, wallets and proposals remain denied by middleware; canonical authenticated proposals lifecycle is unchanged | Do not restore old in-memory endpoints. UI/link audit remains an ongoing regression check. |

## Blocking external evidence — never mark PASS based on source CI

| Finding | Blocker & accountable verification |
|---|---|
| IND-AUD-01 | IAM owner: enroll real UAT identities via Cloudflare Access and D1 with a second independent Admin and full role set. Verify signed JWT allow/deny and ownership checks. Preserve the last Admin rule. Never mint fabricated staff email addresses or widen Access policies without approved roster. |
| IND-AUD-02, 04 | DBA/release owner: capture signed receipt of D1 0031/0032 execution, independently durable original backup + SHA-256, restored isolated D1 matching original records, encryption continuity and rehearsed rollback. D1 `quick_check=ok` alone is insufficient. |
| IND-AUD-03 | UAT owner: execute each of the 210 unique cases in `docs/INDIA_UAT_210_CATALOG.json` with genuine Access identities and per-case, timestamped evidence hashes. The source catalog is NOT proof of any PASS. |
| IND-AUD-05 | Release engineer: build a pinned source SHA and deploy only via the signed evidence / release-gated workflow. Compare the Worker version/traffic and D1 + Access bindings; run post-deploy authenticated smoke, rollback ready. |
| IND-AUD-06 | AI/Admin: test each active provider's actual configured model/key using controlled, consented requests and confirm fresh success metadata. Record failures without exposing keys. |
| IND-AUD-07 | Independent Admin checker: verify draft update, optimistic-lock conflict, tombstone approval, child hierarchy validation, audit immutability on the deployed Worker. |
| IND-AUD-11 | SRE: collect real, role-authenticated production or isolated-UAT p50/p95/error/timeout and enforce agreed performance SLO and alerting. Observability enabled in Wrangler is not proof of SLA. |
| IND-AUD-12 | Maintainer: reconcile the remaining PR #64 35-service catalog and old changes against latest main. Cherry-pick only necessary code with full regression gates; never merge stale implementation wholesale. |

## Release criteria
- Main and exact candidate SHA, CI, source tests and isolated SQLite migrations pass.
- Gated evidence: D1 original backup, restore and rollback; encryption secret continuity; 210 real signed UAT cases; real Access across roles; negative RBAC/object ownership; Post-PO document integrity; Android handset; Security/Finance/Operations signoff.
- All gates validated by `scripts/india-release-evidence.mjs` and existing protected workflow before production mutation. **Gate stays HOLD until independent proof exists.**
- Never commit credentials, customer PII, JWT, or SQL dump to GitHub. Do not create fake business records or attempt live transaction UAT on customer production.

## Verified at audit baseline (read-only)
- D1 version 32, `PRAGMA quick_check=ok`, FK check empty, Admin options table present. Worker version at that moment still `3db61493-6a0d-4553-b8c2-f52a82293950`; 1 active Admin identity, 4 AI providers enabled, 2 successfully tested. These are historical observations; recheck before any release.

## Acceptance scripts
`npm run typecheck`, `npm run test:admin`, `npm run test:modules-13-15`, `npm run test:sales`, `npm run test:scoping-upload`, `npm run gate:automated`, and `npm run build:cf`. Automated PASS is only source and isolated database coverage.
