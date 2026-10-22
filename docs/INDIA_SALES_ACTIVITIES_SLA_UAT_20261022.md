# INDIA — Activity Timeline, Next Action, Overdue, SLA dan Manager Escalation

Tanggal: 22 Oktober 2026. Base: main `df5c95e` (Marketing–Sales–Presales–PO production release).
Status: feature branch / PR only. **No production migration, cron deployment, notification dispatch or real Access UAT is asserted.**

## Tahap implementasi
1. **D1 0013 (additive):** policy SLA, activity tasks, immutable events, manager mapping, response tracking, alert inbox. Existing `india_marketing_activities`, `india_sales_activities`, Lead IDs, account IDs, opportunity IDs and audit remain untouched. No demo data.
2. **API:** `GET/POST/PATCH /api/sales/activities` uses existing signed Cloudflare Access JWT and `india_members`; Sales views/mutates only own lead/opportunity; Admin sees all. Writes include immutable event and existing audit. Version CAS via `india_sales_tx_guards` for reschedule/complete/cancel.
3. **UI:** `/sales/activities` plus mobile/desktop links from Lead and Pipeline: Activity Timeline, Next Action, per-Sales calendar, Overdue Queue, Lead SLA and alert inbox. Browser presents timestamps WIB.
4. **Automatic job (not yet deployed):** separate Cloudflare Worker `automation/sales-cron`, scheduled every 15 minutes. Writes idempotent **in-app alerts** to the same D1; repeat Cron runs never duplicate alerts for the same task revision or SLA due time. No external email, WhatsApp, or push is implied.
5. **Escalation:** Sales owner receives overdue/SLA alert when due; Manager (active `admin` role mapped to Sales) receives escalation 60 minutes later. Missing/disabled manager goes to active Admin inbox with `unassigned_manager` notice instead of silent loss.

## SOP operasional
- Capture Lead in Marketing, with assigned active Sales account. A new Lead automatically receives response SLA from its creation instant.
- Register Visit, Call, Meeting or Follow-up from the existing Lead/Opportunity ID. Specify subject, description, start, completion deadline. Default reminder is 30 minutes before start. D1 rejects overlapping on-site Visit/Meeting slots for the same Sales, including concurrent submissions.
- Execution result **must be recorded by the logged-in user** as Completed with written outcome, or Cancelled with reason. Rescheduling increments revision and creates an event.
- Only *Completed customer contact* types Call, Visit and Meeting count as first response for Lead SLA. Scheduling, notes, follow_up and data entry do not constitute a customer response.
- At due time, Cron produces owner alerts. At +60 minutes, mapped Manager gets escalation. Every 15-minute check is idempotent.
- A Lead converted/disqualified or Opportunity Won/Lost automatically cancels pending tasks in the same D1 transaction and records system timeline events.
- Lead reassignment transfers pending tasks and resets the SLA clock **only if no first customer response was recorded**.
- Historic pre-0013 Leads with open status start a fresh 120-minute migration grace window, `baseline=legacy_unverified`. Historical first-response evidence remains *unknown*, not falsely treated as breached or fulfilled.

## Policy default (adjust through controlled D1 migration/admin procedure)
| Parameter | Initial setting | Meaning |
|---|---|---|
| Lead first-response SLA | 120 minutes | Elapsed time, including nonbusiness hours |
| Reminder | 30 minutes before activity start | In-app, upon scheduler run |
| Manager escalation | 60 minutes after breach | Mapped active Admin manager |
| Scheduler | 15 minutes | Cloudflare Cron separate Worker |
| Time storage | ISO UTC | WIB presentation |
| Calendar | Seven days per week | Frontend filters owner |

Policy is a baseline, not a claim of an OJK-defined SLA. Business-hour/holiday calendars, external message delivery, read receipts and delegation require separate implementation before marketing as supported.

## UAT & release checklist
1. Review code, TypeScript, Next.js 16.4.2 build and tests: `npm run test:activities`, `npm run test:marketing`, `npm run test:sales`, `npm run test:sales-transactions`, `npm run test:india-negative`. All are required release gates.
2. Inspect actual Worker binding and confirmed **isolated** UAT D1 identifier. Take database backup (checksum) and test full restore before any migration.
3. Apply 0013 after verified migrations 1–12 only on isolated UAT D1. Check `PRAGMA foreign_key_check`, `PRAGMA quick_check`, schema ledger, pre/post Lead/Opportunity/account/audit counts. Do not apply automatically in CI.
4. With real Cloudflare Access JWTs and active memberships, execute Sales A, Sales B, Admin/Manager: A cannot schedule/change/read B; Admin can filter both; inactive manager rejected; missing manager escalates to Admin; activity status CAS and audit failures roll back.
5. Verify first contact SLA; backfilled legacy Lead grace; new Lead triggers; reassignment; tasks closed by conversion/Won/Lost; in-app overdue / reminder; notification acknowledged only by recipient; scheduler double-run idempotent.
6. Deploy Cron to *isolated UAT Worker* using `npx wrangler deploy --config automation/sales-cron/wrangler.toml`. UAT config pins D1 `eaed652e-7322-4950-a304-dd50baa5de02`. Verify Cron logs, scheduled run and database alerts before enabling production.
7. Review live UAT evidence, back up production D1, apply production 0013 transactionally, deploy tested frontend, set explicit production Cron binding **only after operator approval**. Never point UAT Cron at production DB.
8. Keep prior Worker version and DB backup; roll back Worker independently. Because schema is additive and has genuine new events, prefer forward migrations/patches over destructive rollback.

## Security / known boundaries
- No unauthenticated API access and no role switching from the demo app shell affects the server authorization.
- Sales Manager is mapped to an existing active `admin` membership; a standalone `sales_manager` role with narrower permissions does **not** yet exist.
- Notification is delivered to the in-app inbox by a deployed Cron Worker, not through SMTP/WhatsApp. The scheduler config in this PR is **UAT-only**.
- Existing Marketing Lead and Sales Opportunity activity notes are shown read-only alongside new task events in the consolidated Activity Timeline; their original records remain untouched.
- User-visible counters are live computed from D1, while alerts are durable scheduler products; overdue can appear before the next Cron tick. Next Action also includes newly assigned Leads awaiting first response even if a calendar activity has not yet been created.
- A successful GitHub CI run does not establish a successful multirole signed human Cloudflare Access UAT.
