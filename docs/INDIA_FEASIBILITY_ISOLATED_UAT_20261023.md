# INDIA Vendor, Resource & Solution Feasibility — Isolated Operational UAT
Date: 23 October 2026 (Asia/Jakarta)  
Repository: elanghaqeem-hash/India  
Candidate: PR #35 `feat/india-modules-13-15-completion-20261022`; original component PR #27  
Disposition: **PARTIAL PASS / RELEASE BLOCKED**. This is an evidence report, not a deployment authorization.

## Controls directly verified against connected Cloudflare resources (not simulated)

| Gate | Evidence | Result |
|---|---|---|
| Tenant/account access | Authorized Cloudflare account accessible; read-only inventory inspected | PASS |
| Production/UAT Worker separation | `india` Worker `INDIA_DB` -> `india-staging-db` (`8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`); `uat-india` Worker `INDIA_DB` -> `india-uat-users-db` (`eaed652e-7322-4950-a304-dd50baa5de02`) | PASS |
| UAT rehearsal schema | `india-p1-p2-rehearsal-20261022` D1 `8685031e-ab08-4c51-ae4f-740f45a3c99d`: `PRAGMA quick_check` = ok; `PRAGMA foreign_key_check` = 0 rows | PASS |
| Rehearsal version fingerprint | Schema migrations present through version 23; 6 opportunity rows; no feasibility plan, resource, allocation or cost tables yet | BASELINE ONLY |
| Authentication fail-closed | Anonymous `https://uat-india.elang-haqeem.workers.dev/api/sales/feasibility` and `/sales/feasibility` returned HTTP 403; no browser login bypass | PASS (negative only) |
| Real Access role policy | `India UAT - operational release gate` application contains a single allow policy `UAT - existing approved administrator only`; Sales/Presales/Finance/Approver users not confirmed authorized | BLOCKED |
| Candidate Worker version | `uat-india` release binding reports SHA `4f96492279b83817eb0f0bc6a7f5d1a78b5f6494`, not PR #35 candidate `894fb7568876ec201330a5d3a1bedff29f1989c3` | BLOCKED |
| New D1 provisioning | Cloudflare refused `india-feasibility-uat-20261023` creation with code **7406**, D1 limit 10 databases/account; no existing D1 deleted | BLOCKED |
| Rehearsal backup | D1 export initiated/bookmark obtained, but **no durable SQL dump obtained or restore exercised**. Time Travel bookmark retrieved read-only. Neither counts as a verified backup/restore rehearsal | BLOCKED |
| Remote feasibility migration | No DDL/write attempted on rehearsal or production because backup/rollback and dedicated-target gates failed | NOT RUN |
| Real signed JWT multi-role HTTP UAT | No signed JWTs for Sales A/B, Presales, Finance, Approver, Admin were obtained or used. Not equivalent to synthetic harness | NOT RUN |

## GitHub hosted CI evidence (non-live operational tests)

- PR #27 `28a657a901276b5ca12968b948cc15ab0baca401`: [successful push CI](https://github.com/elanghaqeem-hash/India/actions/runs/39748732060) and [PR CI](https://github.com/elanghaqeem-hash/India/actions/runs/39748739234). New feasibility tests 5/5, Sales 47/47, negatives 44/44, tender/P1–P2 regression, TypeScript/OpenNext packaging passed.
- PR #35 `894fb7568876ec201330a5d3a1bedff29f1989c3`: [modules acceptance CI](https://github.com/elanghaqeem-hash/India/actions/runs/39866044432) successful; uses consolidated migration sequence and Android/desktop emulation with real route handlers but **isolated SQLite**. This is not a Cloudflare Access login or live D1 migration exercise.

## Critical migration collision

The original PR #27 path `migrations/0022_vendor_resource_feasibility.sql` conflicts with the `migrations/0022_document_vault_governance.sql` already present in the rehearsal database. Its sibling `0023_tender_vault_integrity.sql` is also present. Thus applying the original `0022` is forbidden. PR #35 has renumbered feasibility to `migrations/0025_vendor_resource_feasibility.sql`, preceded by 0024 sales target schema. Confirm no later branch reuses 0025 before UAT migration.

## Release acceptance matrix still requiring live evidence

1. **Preflight**: identify approved isolated Worker+DB, verify bindings, isolate external integrations, secure durable SQL export, demonstrate full restore to a separate UAT database, and document rollback/bookmark verification.
2. **Migration**: apply canonical 0024 then 0025 (and any integrated dependencies) on the UAT-only target; check migrated manifest, FK, quick_check, no orphaned rows and unchanged pre-existing records.
3. **Operations**: authenticated Presales creates VAPT two-app plan and 8.2 PD; Finance registers engineer HPP, supplier offer and valid FortiSIEM SKU; Presales reserves resources; independent Approver approves; verify approved readback and stage/quotation gates.
4. **Negative scenarios**: Sales B denied Sales A deal; Sales/Presales HPP redacted; unauthorized roles denied mutations; overbooking across two Opportunities rejected; stale/repriced/expired supplier quote rejected; independent reviewer cannot approve self-owned changes; any plan/cost/assignee update invalidates approval.
5. **Solution lines**: independent VAPT, SOC/MDR 24x7, FortiSIEM, GRC, Managed Security sizing; reconcile license quantity/term, internal+external HPP, gross margin and approved BoQ.
6. **Evidence**: cross-reference original vendor files in Vault, not only archive path or SHA-256 metadata; use human UAT role identities with real signed JWT, screenshots/logs and result references.
7. **Exit**: reviewer + Finance + IT Security sign-off, no production deployment until prior dependency PR release gates all pass.

## No-impact attestation
Read-only Cloudflare inventory, D1 queries, Worker/Access configuration inspections and anonymous HTTP requests only. One new D1 creation attempt was **refused** by Cloudflare (7406). No successful D1 creation, deletion, restore, migration or data modification and no Worker deploy/Access policy alteration occurred. The only persisted changes are GitHub documentation updates.
