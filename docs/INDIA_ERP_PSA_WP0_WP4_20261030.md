# INDIA ERP + PSA — WP0 baseline and WP4 timesheet slice

Date: 30 October 2026 (WIB). Source baseline: `main@045298e9e0682ba6579d1b3a8f6a6f73962aa9d3`.

## WP0 evidence and reuse decision

- The source tree contains 535 files/directories, migrations through 0032, and the existing customer, opportunity, BoQ, approved release, project, delivery, invoice, revenue, Vault, FlexGuard, resource pool and presales allocation models. `AGENTS.md` was not present in the checked tree. `README.md` is historical and still describes a failed build; executable package/configuration and current release documentation are the operational source.
- PR #88 contains the comprehensive ERP audit and prompt; PR #64 remains open, unmergeable against current main. This change does not merge overlapping catalog code.
- Read-only Cloudflare verification: production Worker `india` retains 100% traffic on version `642bc76f-d6ca-4cbb-9324-0564373140d7` from 27 October, bound to D1 `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`. D1 migration ledger max 0032 (32 rows), `quick_check=ok`, two active Admin accounts and no timesheet table. No claim is made that the deployed Worker matches the source commit. No live records, policies, secrets or deployment were changed by this work.
- The existing `india_delivery_projects` and `india_resource_allocations` are reused. No new customer, project, employee, or allocation master was created. The new timesheet is an operational record, with a frozen allocation cost snapshot, not a GL posting or payroll entry.

## WP4 slice: submitted and reviewed project time

| Requirement | UI | API | D1 source/extension | Access and controls |
|---|---|---|---|---|
| Pick an assigned project and record hours | `/psa/timesheets` | `GET/POST /api/psa/timesheets` | Existing project, person and allocation; new `india_project_timesheets` | Signed Access plus active D1 role; assigned person's email, active project/resource/allocation, project dates, daily and allocation capacity |
| Independent review | Same page | `POST action=review` | Timesheet status and `india_operations_events` | Finance/Approver only, no maker self-approval, optimistic version guard, immutable reviewed record |
| Reconcile labor cost later | Finance read | `GET` | Immutable `cost_snapshot_cents` | Visible only to Finance/Approver; no automatic accounting or GL certification |

Migration 0033 is additive, unseeded and does not backfill historical hours. A rejected day can be resubmitted; approved records cannot be edited or deleted. D1 transaction batches roll back both the timesheet and audit event on failure. The rate snapshot derives from the approved presales allocation; changing the resource's current rate does not rewrite a historical submitted rate.

## Validation and release status

Source checks for this branch: `npm run typecheck`; `npm run test:psa-timesheets` (4 synthetic, isolated SQLite/D1-compatible cases); `npm run test:service-operations` (22 cases); navigation/middleware tests (8 cases); `npm run build` (compiled with existing unpdf/Edge warnings). Exact CI status for the branch must be read from the PR after push. These are not authenticated human UAT or Cloudflare D1 migration evidence.

**Release gate: BLOCKED.** Migration 0033 has not run on production or shared UAT. The production role roster still lacks operational identities; real Cloudflare Access maker/checker UAT, original backup with SHA-256 and independent restore, Vault integrity, Finance cost policy, Android acceptance, signoffs and pinned Worker deployment remain outstanding. The full WP0–WP12 scope and 210 additional ERP scenario definitions are not completed by this vertical slice. Existing 210 UAT catalog remains untouched. Follow with controlled isolated migration/UAT and then canonical organization, RBAC and PSA capacity/expense integration; retain no automatic GL postings until Finance policy and ledger are approved.
