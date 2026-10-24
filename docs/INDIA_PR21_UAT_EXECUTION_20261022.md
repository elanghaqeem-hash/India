# INDIA PR #21 — Eksekusi UAT D1 dan Cron Terisolasi

Tanggal: 22 Oktober 2026 (Asia/Jakarta). Basis sumber: PR #21 head `f36695c395eb27ff0d7a71ab8625a02d035336ab`. Pemeriksaan menggunakan Cloudflare API pada akun yang terkoneksi. Tidak ada perubahan database atau Worker produksi.

## Ringkasan release gate

**PARTIAL PASS — production review/merge BLOCKED.** Backup/export, logical restore, rehearsal dan migrasi D1 UAT berhasil. Pengujian logika reminder/overdue/SLA/escalation terverifikasi di D1 UAT dan idempotent. **Runtime Cron scheduled invocation dan alert D1 terbukti.** Pengujian login signed-human JWT untuk tiga peran belum terpenuhi; Worker frontend UAT belum menjalankan sumber PR #21.

| Tahap | Status dan bukti |
| --- | --- |
| Isolasi | PASS: `uat-india` memiliki D1 binding `eaed652e-7322-4950-a304-dd50baa5de02`; `india` production memakai `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5` |
| Backup | PASS Cloudflare D1 SQL export `eaed652e-7322-4950-a304-dd50baa5de02-00000012-00000000-0000510c-349cf1cf44a304ada15d4854a92e4144.sql`, bookmark `00000012-00000000-0000510c-349cf1cf44a304ada15d4854a92e4144`. Signed download URL expires; do not include URL/tokens in repo |
| Logical restore rehearsal | PASS: database `india-pr21-restore-uat-20261022` (`4539347e-3fdb-4442-997d-4fa69847525d`) reconstructed 40 application tables, 71 rows, all 104 schema objects. Source-vs-restored schema and content exact match; zero FK violations; `quick_check=ok`. This is logical SQL/API restore, **not** direct ingestion of exported SQL file |
| Migration rehearsal | PASS: 0013, 24 statements; `version=13`; failed late SQL request left no partial marker; FK clean and `quick_check=ok` |
| Migration UAT | PASS: 0013 applied to isolated UAT D1 only after max version=12, absence of 0013 objects, FK and quick-check gate; 24 statements success |
| Data preservation | PASS: before / after / after QA cleanup: 2 Leads, 4 Customer Accounts, 4 Opportunities, 14 Sales audit; no QA fixture left; zero FK violations; `quick_check=ok` |
| Cron Worker | DEPLOYED UAT: `india-sales-activity-uat` version `b4e7e40b-7675-4000-b2ed-ae0b1d4e75cf` at 100%, D1 binding UAT only. Schedule temporarily set to 1 minute for observation, restored to `*/15 * * * *` |
| Cron logic on real UAT D1 | PASS manual execution of the seven exact SQL statements taken from PR #21 source against UAT: 1 reminder, 1 overdue, 1 Lead SLA, 2 manager escalations; second execution created no duplicates; zero FK violations. All tagged QA records removed afterward |
| Actual Cloudflare scheduled invocation | PASS: Cloudflare Workers telemetry mencatat `scheduled` Worker `india-sales-activity-uat`, version `b4e7e40b-7675-4000-b2ed-ae0b1d4e75cf`, `outcome=ok` pada 2026-10-22 05:18:09 UTC. Probe `pr21-uat-realcron-proof` dibuat pada 05:17:26 UTC dengan **0 alert**; setelah invocation 05:18:09 terbentuk 3 alert D1 (1 overdue + 2 unassigned_manager) bertimestamp 05:18:09, **tanpa replay SQL manual terhadap probe tersebut**. 05:19:09 UTC scheduled rerun `outcome=ok` preserved exactly the original three alerts without duplicates. All QA fixtures cleaned. Konfigurasi dashboard dikembalikan menjadi `*/15 * * * *` (perubahan terpropagasi bertahap) |
| Real Cloudflare Access multirole | BLOCKED: two active Sales memberships in UAT D1 are non-deliverable `.invalid` fixtures, not actual human QA mailboxes. UAT Access app allows approved administrator only; real Sales A/Sales B and Admin JWTs were not provided/tested. Do not fabricate signed JWTs or relax the Access policy |
| UAT frontend version | BLOCKED: `uat-india` `INDIA_RELEASE_SHA` begins `8de0717a`, not the PR #21 source SHA. Do not claim `/api/sales/activities` or mobile UI real-Access UAT until the reviewed PR branch is deployed to the dedicated UAT Worker |
| Production | UNCHANGED: `india` Worker was not updated, production D1 remains migration 0012 and separate from UAT, no production Cron deployment |

## Required release clearance

1. Provision **real, distinct, approved QA mailboxes** for Sales A, Sales B, and an Admin/Manager; provide membership with correct roles in isolated UAT D1. Configure UAT-only Cloudflare Access allow policies narrowly for these identities; do not use fixture emails or bypass RS256 token verification.
2. Build and deploy exact PR #21 commit to `uat-india`, pin `INDIA_DB` to isolated UAT D1, preserve separate Access AUD/issuer, then attest Worker deployed SHA and binding through API.
3. Use genuine signed human Cloudflare Access JWTs **outside chat and repository logs** for HTTP/browser tests: Sales A and Sales B isolation, Admin calendar filtering, schedule/complete/cancel/reschedule, CAS conflict, expired login, cross-owner denial and mobile browser. Record status codes and D1 audits, not JWT values.
4. **PASS / completed:** Actual `scheduled` invocation at 05:18:09 UTC inserted three alerts (1 overdue, 2 unassigned-manager); a second distinct scheduled invocation at **05:19:09 UTC**, `outcome=ok`, left counts at exactly three with the original `created_at`. This proves end-to-end scheduled idempotency independently of the manual SQL replay. Probe tasks, alerts and Lead QA fixtures were then removed and zero residuals verified.
5. Re-run full GitHub CI, verify D1 FK/quick-check and row-preservation, clean synthetic QA data, submit PR #21 for review only after all gates are green. Production backup, migration and deployment require separate explicit go-live authorization.

### Privacy / security
No Access JWTs, secrets, encrypted AI keys, customer data, or pre-signed export URL are committed in this report. Logical restore equality was computed inside the connected Cloudflare account and only aggregate evidence retained. The previous production Worker and D1 were not modified.
