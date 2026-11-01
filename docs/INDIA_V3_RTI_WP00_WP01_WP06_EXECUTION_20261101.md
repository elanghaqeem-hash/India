# INDIA v3.0-RTI — WP00 Audit, WP01 & WP06 Foundation Execution Report

1 November 2026 · Prompt `3.0-RTI` · Base `main@f99b95c` (PR #101) · **Source changes only, production HOLD.**

## 1. Ringkasan

| WP | Status | Evidence |
|---|---|---|
| WP00 Current State Audit | READY FOR UAT (review Business Owner/CFO) | Dokumen ini: §2 konflik parameter, §3 matriks M01–M24, §4 release blocker |
| WP01 Parameter center, Org-as-Data, policy engine | READY FOR UAT (mode shadow) | Migrasi 0040 + 0043, policy engine terpasang di seluruh route ERP; test ORG-01..03, RBAC-01, enforce + IDOR di level route PASS |
| WP06 Posting engine, formula library, close | READY FOR UAT | Migrasi 0041–0043, posting worker outbox → GL, tabel pajak/BPJS statutory; test GL-01..03, FML-01, ACD-01, worker, outbox invoice/payment/payroll PASS |
| WP02–WP05, WP07–WP11 | NOT STARTED | — |

Pengujian iterasi 2: `npm run test:rti` 26/26 PASS; rantai test `build:cf` + regresi ERP 532/532 PASS; `tsc --noEmit` bersih; `next build` sukses. Semua data uji sintetis, tanpa identitas atau saldo nyata. Lihat §8 untuk keputusan Business Owner dan perubahan iterasi 2.

## 2. Validasi parameter terhadap repo dan database

| ID | Parameter / asumsi prompt | Kondisi repo aktual | Keputusan |
|---|---|---|---|
| C-01 | Migrasi lanjut dari "0039/0045 kanonis" | Nomor kanonis terakhir **0039**; tidak ada 0040–0045 | Migrasi baru 0040, 0041; test kanonis diperluas ke 0041 |
| C-02 | Struktur `apps/web`, `packages/*` | Satu aplikasi Next.js, domain di `src/lib` | `src/lib/rti/*` dibuat murni (tanpa runtime Next/Cloudflare) setara `packages/domain` + `packages/policy`; pemecahan monorepo lewat ADR terpisah |
| C-03 | Tidak ada nama perusahaan hardcoded (DoD-21) | `TENANT='defendit360'` di `sales-workflow.ts` menjadi kunci D1 seluruh tabel; 142 kemunculan DefendIT360/Technotama/ICOP di 34 file `src` (label UI, quotation, BoQ export) | Kunci tenant dipertahankan sebagai technical key (`company.tenant_key`); label wajib dipindah ke parameter lewat migrasi terkontrol (RB-01) |
| C-04 | Tipe unit organisasi dikonfigurasi | 0034 mengunci `kind` lewat CHECK (5 tipe), tidak bisa diubah tanpa rebuild tabel | Tabel berversi aditif `india_org_units_v` + `india_org_unit_types`; cut-over dual-run |
| C-05 | Permission grammar `<module>.<resource>.<action>` | 0034 memakai 7 capability tetap; `erpGrant()` masih otoritas akses ERP | `india_iam_legacy_role_map` untuk 8 role login; capability lama tetap berlaku sampai cut-over |
| C-06 | Reopen periode oleh CFO, status RESTATED | `india_gl_periods` hanya open/closed; closed immutable oleh trigger | `india_close_runs` menambah PRELIMINARY→SOFT→HARD→AUDITED/RESTATED; reopen GL period butuh mekanisme baru (RB-03) |
| C-07 | P13 adjustment period | CHECK GLOB menerima `YYYY-13`, tetapi `erpPeriod()` menolak bulan 13 | Engine mendukung P13 (FIN_MGR + approval CFO); validator API perlu diubah saat wiring |
| C-08 | reporting_currencies IDR, USD | Treasury `CHECK(currency='IDR')`; AR/AP belum multi-currency | FX revaluation tersedia di engine/formula, belum ada sumber saldo valas |
| C-09 | `ppn_dpp_factor: 0.9166667` | — | Dikoreksi menjadi pecahan eksak `11/12`; desimal pembulatan ditolak validator |
| C-10 | Framework SAK EP + M21 kapitalisasi biaya pengembangan + istilah ECL | SAK EP berbasis pendekatan entitas privat; kapitalisasi R&D dan model ECL tidak bisa diasumsikan | `accounting.dev_cost_capitalization_allowed=false`, `receivable_impairment_model` VERIFY auditor |
| C-11 | Role template default (AR_OFFICER, PAYROLL, PROCUREMENT) | Satu template memegang kedua sisi SOD-02/04/05 | Ditambah COLLECTION_OFFICER, PAYROLL_APPROVER, WAREHOUSE; tidak ada template default yang konflik SoD internal (diuji) |
| C-12 | PPh 21 metode TER | Tabel TER A/B/C tidak tersedia sebagai data terverifikasi | Formula menerima tabel sebagai parameter; payroll PROD diblokir sampai tabel dimuat dari regulasi (RB-05) |
| C-13 | Lockfile & supply chain | `npm ci` gagal di npm 10 (package.json vs lockfile tidak sinkron); `packageManager` npm@11.9.0, CI Node 24 | Verifikasi di CI npm 11; jika masih gagal, regenerasi lockfile di PR terpisah |
| C-14 | GitHub Actions pinned | 27 workflow memakai tag (`@v4`), bukan commit SHA | Gap §10.2, dikerjakan di WP00 hardening |
| C-15 | INDIA Vivid (shadcn/Radix/Recharts, Plus Jakarta Sans) | Tailwind 3 dengan palet `navy`; tanpa shadcn/Recharts | WP02 |
| C-16 | Environments DEV/INT/UAT_SIM/STAGING/PROD | `wrangler.jsonc` hanya `india-staging-db` | Perlu binding D1 per environment |
| C-17 | Ambang approval (`PO_APPROVAL_L2`, dsb.) | Tidak didefinisikan di prompt | Default placeholder di `approval_limits`, VERIFY CFO; engine fail-closed bila parameter hilang |

Parameter bertanda VERIFY (14 kunci, tersimpan `verify_status='VERIFY'` di `india_sys_parameters`): framework akuntansi, kapitalisasi R&D, model impairment, sumber kurs, tarif PPN dan DPP, PPh 23, metode dan tabel PPh 21, PPh badan dan fasilitas 31E, platform e-Faktur, tarif BPJS Kesehatan/Ketenagakerjaan, ambang approval. Tambahan: `org.seed_confirmed=false` sampai struktur RTI dikonfirmasi Business Owner.

## 3. Matriks Module → Gap → Status (M01–M24)

| Kode | Kondisi existing (evidence) | Gap utama v3.0 | Status |
|---|---|---|---|
| M01 | `/sales/executive` (0024 target sales) | Periodic Pack D/W/M/Q/S/A, Daily Flash, cockpit lintas lini bisnis | IN DEVELOPMENT |
| M02 | 0034 org units + `/erp/organization`; 0040 Org-as-Data | API/UI reorganisasi, wizard onboarding legal entity (TAR), matrix org | IN DEVELOPMENT |
| M03 | Campaign, lead, lead intelligence (0010, 0014, 0020) | Partnership campaign Academy, multi-touch attribution | IN DEVELOPMENT |
| M04 | Pipeline, forecast, customer360 (0018, 0019) | Opportunity per business line, cross-sell, account plan | IN DEVELOPMENT |
| M05 | Tender, bid readiness (0016, 0021, 0023) | LPSE/SPSE terjadwal, jaminan penawaran/pelaksanaan | IN DEVELOPMENT |
| M06 | Scoping per layanan siber | Template Software (FP/story point), IT Support, Training | IN DEVELOPMENT |
| M07 | Pricing engine, BoQ, quotation | Model T&M, retainer, per-seat, per-participant, revenue share | IN DEVELOPMENT |
| M08 | Post-PO, award, service contracts (0012, 0027) | Performance obligation register, jaminan bank | IN DEVELOPMENT |
| M09 | Delivery project, timesheet (0033) | EVM/POC/WIP/unbilled otomatis (formula PRJ-*, FIN-REV-* siap, belum di-wiring) | IN DEVELOPMENT |
| M10 | Cyber cases, connector metadata (0037, 0038) | Ingestion SIEM/EDR live | IN DEVELOPMENT |
| M11 | Service operations | Shared desk Cyber + IT, SLA kalender kerja (formula SVC-01C siap) | IN DEVELOPMENT |
| M12 | Procurement/AP, requisition (0036, 0038) | Commitment accounting, accrual GRNI (rule PR-GR/PR-VENDOR-INV siap) | IN DEVELOPMENT |
| M13 | GL manual maker-checker (0035) | Posting engine → `india_gl_journals`, subledger, multi-entity, intercompany | IN DEVELOPMENT |
| M14 | Profil karyawan, cuti (0038) | Payroll, BPJS, PPh 21 TER, cost rate ke GL | NOT STARTED (payroll) |
| M15 | — | Asset register, depresiasi, amortisasi lisensi (formula FIN-07 siap) | NOT STARTED |
| M16 | FlexGuard immutable ledger (0030) | MRR/ARR, deferred revenue per entitlement | IN DEVELOPMENT |
| M17 | Target sales (0024) | Driver-based budget, rolling forecast 12+6 | NOT STARTED |
| M18 | `/reports`, AI Mistral (0028) | Scheduler per siklus, semantic layer, AI narrative; katalog siklus di 0041 | IN DEVELOPMENT |
| M19 | Document vault, audit log (0015, 0022, 0026) | Evidence close, PBC list | IN DEVELOPMENT |
| M20 | Settings, option registry (0031, 0032); parameter center 0040 | UI parameter center, policy engine di route, job monitor | IN DEVELOPMENT |
| M21 | — | Seluruh modul Software Engineering | NOT STARTED |
| M22 | — | Seluruh modul IT Managed Services | NOT STARTED |
| M23 | — (formula ACD-01/02, rule PR-TRAINING/PR-PARTNER-SHARE siap) | Batch, peserta, sertifikat, partner portal | NOT STARTED |
| M24 | `india_gl_close_requests` (0038); 0041 close runs, checklist, report cycle | Accrual/allocation engine, konsolidasi, FS builder, tax workpaper | IN DEVELOPMENT |

## 4. Release blocker register

| ID | Blocker | Dampak | Owner |
|---|---|---|---|
| RB-01 | Label DefendIT360/Technotama/ICOP hardcoded (C-03) | DoD-21 gagal | Engineering |
| RB-02 | Route handler belum memanggil policy engine; ORG-03/RBAC-01 baru terbukti di level engine | Akses v3 belum berlaku | Engineering + SEC_ADMIN |
| RB-03 | GL period tidak bisa dibuka ulang (C-06) | GL-03 end-to-end di D1 | Engineering + CFO |
| RB-04 | 14 parameter VERIFY belum dikonfirmasi | Pajak/akuntansi PROD | CFO, auditor, TAX_OFFICER |
| RB-05 | Tabel TER PPh 21 belum dimuat | Payroll PROD | PAYROLL, TAX_OFFICER |
| RB-06 | Struktur organisasi seed belum dikonfirmasi | UAT organisasi | Business Owner RTI |
| RB-07 | Posting worker (Queue) belum menulis jurnal; API/UI M02, M24 belum ada | Operations-to-Ledger belum operasional | Engineering |
| RB-08 | Blocker existing tetap: UAT manusia Cloudflare Access, D1 restore khusus, provenance deployment, sign-off Finance/Legal/Security | Seluruh rilis | PMO |

## 5. Yang dibangun

**Migrasi 0040** (di-generate dari TS oleh `scripts/rti/build-migrations.cjs`, dicek di CI dengan `--check`): `india_sys_parameters` (maker-checker, effective date, immutable setelah approve), `india_org_unit_types`, `india_org_units_v` (berversi, trigger validasi parent per tipe, history immutable), `india_org_closure`, positions, assignments (acting/PLT/rangkap), relations (matrix), change requests (maker ≠ approver), permission catalog, role templates berversi, role bindings (granter ≠ approver ≠ subject), SoD rules, ABAC policies, legacy role map, break-glass log. Seed: 60 parameter, 11 tipe unit, 26 unit RTI + closure, 57 role template, 143 permission, 9 aturan SoD. Tidak ada user, assignment, atau binding yang di-seed.

**Migrasi 0041**: formula registry (41 formula, 53 test case), 41 account role + COA 5 digit, 20 posting rule, outbox `india_accounting_events` (idempotency unik, immutable setelah posted), journal links (satu jurnal primer per event, reversal wajib alasan), `india_close_runs` (state machine, preparer ≠ approver, checklist wajib selesai sebelum HARD_CLOSED), `india_report_cycle_definitions`, `india_report_snapshots` (hash SHA-256 immutable).

**Domain** `src/lib/rti`: aritmetika uang integer/rasional tanpa floating point; organisasi (closure, cost/profit center turunan, approval line dengan acting/PLT, impact analysis, apply change berbasis effective date, lookup as-was); policy engine (grammar permission, scope own/project/unit/unit_tree/entity/all, MFA, limit approval fail-closed, ABAC deklaratif, SoD binding-time dan same-object, maker-checker, scope filter data layer, masking); formula library §7 lengkap; posting engine (pemilihan rule berversi, validasi periode, P13, dimensi wajib, keseimbangan per mata uang, idempotency, auto-reversal accrual, reversal, trial balance, drill-down, rekonsiliasi subledger); close calendar (WD+n dengan hari libur, deadline per siklus, checklist, flux rule, hard close, reopen CFO).

## 6. Execution Report (format v2.0 §21 + kolom v3.0)

| WP | Parameter Changed | Formula IDs | Posting Rules | Close Cycle Impact |
|---|---|---|---|---|
| WP01 | Seed seluruh blok PARAMETERS + `company.tenant_key`, `approval_limits`, `accounting.dev_cost_capitalization_allowed`, `org.seed_confirmed`; `tax.ppn_dpp_factor` → `11/12` | — | — | Approval line & scope untuk sign-off close |
| WP06 | `accounting.flux_threshold_*`, `close_calendar.semiannual_hard_close_wd`, `tax.pph_badan_31e_*` | FIN-REV-POC-01, FIN-REV-CA-01, FIN-REV-ONEROUS-01, FIN-REV-RATABLE-01, FIN-REV-SSP-01, PRJ-01..08, FIN-01..10, SVC-01A..04, COM-01..03, ACD-01..02, TAX-PPN-01, TAX-PPH23-01, TAX-PPH21-TER-01, TAX-PPH21-DES-01, TAX-PPHB-01 | PR-TIMESHEET, PR-POC, PR-MILESTONE-INV, PR-ADVANCE-INV, PR-SUBSCRIPTION, PR-CASH, PR-GR, PR-VENDOR-INV, PR-PAYMENT, PR-PAYROLL, PR-DEPRECIATION, PR-PREPAID, PR-TRAINING, PR-PARTNER-SHARE, PR-SLA-CREDIT, PR-ECL, PR-ONEROUS, PR-FX, PR-IC, PR-ACCRUAL | Bulanan WD+3/WD+5, triwulanan WD+10, semesteran WD+15, tahunan WD+30, audit-ready D+60; status PRELIMINARY/SOFT/HARD/AUDITED/RESTATED |

## 7. Langkah berikutnya (urutan kritis)

1. Konfirmasi Business Owner atas struktur seed dan role template tambahan (RB-06, C-11); konfirmasi CFO/auditor atas parameter VERIFY (RB-04).
2. WP01 wiring: `authorize()` dan `scopeFilter()` di route ERP, binding dari legacy role map, API/UI M02 untuk change request dan apply job terjadwal.
3. WP06 wiring: posting worker Cloudflare Queue dari `india_accounting_events` ke `india_gl_journals`/`india_gl_lines` + `india_gl_journal_links`; mekanisme reopen periode GL; validator P13.
4. Migrasi label branding ke parameter (RB-01), lalu WP02 INDIA Vivid.

## 8. Iterasi 2 — keputusan Business Owner dan eksekusi (1 November 2026)

### Keputusan yang diterapkan
| No | Keputusan | Implementasi |
|---|---|---|
| 1 | DPP PPN pecahan 11/12 disetujui | `tax.ppn_dpp_factor='11/12'`, tabel `india_tax_rates` PPN_NON_LUXURY |
| 2 | SAK EP tanpa kapitalisasi R&D disetujui | `accounting.*` VERIFIED dengan dasar keputusan |
| 3 | Role COLLECTION_OFFICER, PAYROLL_APPROVER, WAREHOUSE disetujui | Template v1 approved; tidak ada template default yang konflik SoD |
| 4 | Semua label menjadi RTI | 29 file `src` (UI, quotation, BoQ export, Word post-PO, AI prompt) diganti; tidak ada lagi Technotama/DefendIT360 di `src` (dijaga test). Kunci teknis tenant D1 `defendit360` dipertahankan sebagai storage key karena trigger immutabilitas melarang penulisan ulang `tenant_id`; literal di route dihapus dan dipusatkan |
| 5 | Tabel pajak sesuai regulasi | Migrasi 0042: TER bulanan A (44), B (40), C (41) + TER harian (PP 58/2023), PTKP (PMK 101/2016), tarif Pasal 17, tarif PPN/PPh 23/PPh 4(2)/PPh 26/PPh badan, iuran BPJS (batas upah JP Rp11.086.300 sejak Maret 2026), kelas JKK; profil pajak karyawan (NIK/NPWP hanya token vault), payroll run + lines dengan maker-checker |
| 6 | Parameter VERIFY diselesaikan, struktur organisasi dikonfirmasi | Seluruh parameter VERIFIED dengan `reason` berisi dasar hukum; `org.seed_confirmed=true`; ambang approval L1/L2/L3 disetujui |

### Wiring policy engine (RB-02 ditutup)
- `erpGrant()` kini menjalankan grant legacy **dan** policy engine v3 dengan permission eksplisit per aksi (fin.account/period/journal create–approve–post, prc.po create/approve, prc.goods_receipt.create, ap.invoice create/approve, cyb.case create/approve/close). Route organisasi memakai `erpPolicy()` (org.unit, org.staff, org.scope, iam.binding).
- Mode `security.policy_enforcement`: **shadow** (default, log tanpa blokir) → **enforce** setelah seluruh user aktif memiliki binding. Setiap keputusan tercatat append-only di `india_policy_decisions`.
- Unit legacy dipetakan ke model v3 lewat `india_org_unit_legacy_map` (maker-checker). Unit tak terpetakan = `LEGACY_UNIT_UNMAPPED` (fail-closed di enforce).
- Fallback binding dari 8 role login via `india_iam_legacy_role_map` selama masa transisi.
- Test enforce di level route: alur GL maker-checker lolos dengan binding; user tanpa binding ditolak; IDOR lintas legal entity ditolak walau grant legacy valid.

### Posting worker (RB-07 ditutup)
- Outbox transaksional: trigger D1 menulis `india_accounting_events` dalam transaksi yang sama saat invoice pelanggan, pembayaran, dan payroll run disetujui (hanya bila legal entity proyek terpetakan).
- `runPostingBatch()` memposting tiap event dalam satu batch D1 atomik ke `india_gl_journals`/`india_gl_lines` (status posted, reviewer = aturan posting yang di-approve), plus `india_gl_journal_links` dan `india_gl_line_dimensions`. Gagal → exception queue dengan kode (PERIOD_CLOSED, PERIOD_NOT_DEFINED, DIMENSION_REQUIRED, ENTITY_NOT_MAPPED_TO_LEDGER, NO_ACTIVE_RULE), dapat di-requeue.
- Accrual auto-reversal dibuat sebagai event periode berikutnya; reversal manual tetap via jurnal baru.
- API `/api/erp/posting`: GET antrean/exception/riwayat run; POST `run`, `requeue`, `enqueue` (event manual terbatas). Jadwal: workflow `india-posting-worker-schedule.yml` (Access service token + secret `INDIA_JOB_TOKEN`).

### Sisa blocker
| ID | Status |
|---|---|
| RB-01 | Ditutup untuk label; template Word resmi V.042026 (hash-locked) perlu diterbitkan ulang Legal dengan identitas RTI lalu hash baru di-approve |
| RB-02, RB-04, RB-05, RB-06, RB-07 | Ditutup |
| RB-03 | Masih terbuka: reopen `india_gl_periods` (close run sudah mendukung RESTATED) |
| RB-08 | Tetap: UAT manusia Cloudflare Access, D1 restore, sign-off |
| RB-09 (baru) | Sebelum enforce: buat binding untuk semua user aktif, petakan unit legacy, review log shadow minimal satu siklus close |
| RB-10 (baru) | Set secret `INDIA_JOB_TOKEN`, Access service token, dan secret GitHub untuk jadwal posting |

### Sumber regulasi
PP 58/2023 dan lampiran TER; PMK 168/2023; PMK 101/2016; UU 7/2021 (HPP); PMK 131/2024; UU PPh Pasal 21, 23, 26, 31E; PMK 112/2022; PMK 81/2024; Perpres 64/2020; PP 44/2015, PP 45/2015, PP 46/2015; SE BPJS Ketenagakerjaan B/1226/022026.

## 9. Iterasi 3 — tenant key RTI, rename RTICORE, rilis produksi (1 November 2026)

| Item | Implementasi | Evidence |
|---|---|---|
| Kunci tenant D1 `defendit360` → `rti` | Migrasi 0044 di-generate dari skema 0043: `PRAGMA defer_foreign_keys`, drop 233 trigger, update `tenant_id` di 116 tabel, recreate trigger verbatim. Kode memakai `rti` | Rehearsal `tests/rti-v3-tenant-migration.test.cjs`: data hasil alur nyata dipindah ke key lama lalu dimigrasi; jumlah baris tetap, trigger identik, FK bersih, aplikasi tetap bisa bertransaksi |
| Dokumen Vault terenkripsi | AES-GCM AAD dokumen lama terikat ke tenant lama; dekripsi kini mencoba key baru lalu fallback ke key lama (tetap terautentikasi) | Mutation test: tanpa fallback, dokumen lama gagal dibuka; dengan fallback lolos; dokumen yang dimanipulasi tetap ditolak |
| Konstanta kriptografi | `INDIA-AI:` dan `INDIA-DOCUMENT-v1` sengaja **tidak** diubah, karena merupakan bagian ciphertext yang sudah tersimpan | Test keamanan AI vault |
| INDIA → RTICORE | Semua label UI, judul halaman, prompt AI, dokumen dan nama file ekspor; `system.code=RTICORE`; tema `RTICORE Vivid` | Test login, navigasi, layout diperbarui |
| Tetap bernama `india` | Nama Worker Cloudflare, database D1, prefix tabel `india_*`, variabel lingkungan `INDIA_*`, repository | Mengubahnya mengganti target deploy, binding dan URL; dilakukan terpisah bila diperlukan |
| Rilis produksi | Workflow `rticore-production-release.yml`: gate test → build → export D1 + bookmark Time Travel → migrasi tertunda → deploy → verifikasi D1/HTTP → rollback otomatis Worker dan D1 | Berjalan otomatis saat merge ke `main` |

Regresi: 598/598 test PASS, typecheck bersih.
