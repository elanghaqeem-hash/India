# INDIA — Executive Sales Dashboard (PR #26)
Tanggal: 22 Oktober 2026 · Asia/Jakarta
Base: PR #24 (`feat/india-p1-p2-integration-20261022`). Feature branch: `feat/india-executive-sales-dashboard-20261022`.
Status: **Draft / code ready; production deploy BLOCKED until UAT and review.**

## Tujuan dan akses

- Halaman: `/sales/executive` (desktop dan mobile), API: `GET/POST /api/sales/executive`.
- Semua nominal diturunkan dari Cloudflare D1; **tidak ada angka default/simulasi**. `GET` tidak mengubah D1.
- Autentikasi: Cloudflare Access JWT diverifikasi server-side oleh `authorizeBoQ`. Tanpa JWT -> 401, role tidak diizinkan -> 403.
- Sales melihat opportunity, forecast, target, aktivitas, dan CSV miliknya sendiri; tidak bisa memaksa owner lain melalui query string.
- Admin, Finance, Approver bisa melihat seluruh tim dan filter owner. Hanya Admin yang dapat menetapkan/merevisi target Sales aktif; mutasi target memakai CAS via `india_sales_tx_guards`, event immutable dan audit Sales.
- Semua endpoint private/no-store. Export CSV menetralkan formula spreadsheet yang berasal dari teks.

## Sumber KPI dan formula

| KPI | Sumber D1 | Definisi |
| --- | --- | --- |
| Target | `india_sales_targets` (migrasi 0022) | Jumlah target bulanan Sales aktif. Jika target satu Sales aktif belum tersedia, target tingkat tim **NULL**, bukan 0. |
| Realisasi booked | `india_sales_po_checks` + `india_sales_award_documents` + `india_sales_releases` + `india_sales_audit` | Hanya PO dengan Finance & Legal review independen, paket approved, nilai reconciled, `closed_won` dan bulan audit Won dalam periode. Sama dengan sumber forecast PR #24. |
| Attainment | Target & booked | Booked / Target × 100, hanya jika coverage lengkap dan Target > 0. Gap = Target - Booked. |
| Open & weighted pipeline | `india_sales_opportunities` + `india_sales_forecasts` | Open deal yang target close-nya dalam bulan pelaporan; weighted berdasarkan stage-v1 dari modul Forecast. |
| Deal aging | `india_sales_opportunities.created_at` | Umur Opportunity terbuka saat laporan dilihat, WIB; bucket 0–30, 31–60, 61–90, >90 hari. Tidak mengikuti bulan untuk snapshot umur. |
| Win/Loss | `india_sales_audit.to_stage` dan stage Opportunity terkini | Keputusan final pada bulan laporan. Won hanya bila didukung bukti PO valid. Closed Lost tanpa audit masuk kualitas data, tidak dihitung. |
| Proposal conversion | `india_sales_releases.proposal_snapshot` dan keputusan Won/Lost bulan laporan | Won berproposal / (Won+Lost berproposal) × 100. Tidak menggunakan pembagi semua quotation sepanjang waktu. |
| Submitted | `india_sales_submissions` | Jumlah Opportunity unik dengan submission berstatus verified, tanggal kirim dalam periode WIB. |
| Revenue per service | `india_sales_revenue` status approved + `data_json.service_family` | Pengakuan GL/invoice/BAST disahkan independen berdasarkan tanggal recognition; beda dengan booked PO. |
| Sales productivity | `india_sales_activity_tasks` | Task `completed` saja pada bulan `completed_at` WIB, menurut call/meeting/visit/follow-up. |

## Perubahan
- `src/lib/sales-forecast-d1.ts`: ekstraksi query sumber tunggal dari Forecast API tanpa perubahan rumus.
- `src/lib/executive-sales.ts`: fungsi agregasi deterministik dan quality gaps.
- `src/app/api/sales/executive/route.ts`: D1-read + Admin target CAS transaction.
- `src/app/sales/executive/page.tsx`: mobile-responsive chart, filter, CSV, Admin target form.
- `migrations/0022_executive_sales_targets.sql`: tabel target dan immutable events; tanpa backfill.
- `tests/india-executive-dashboard.test.cjs`: akses, isolasi Sales A/B, empty state, target mutation/concurrency, activity, booked/revenue dan CSV.
- `.github/workflows/india-executive-dashboard-ci.yml`: regresi + typecheck + production Next.js build.

## Release gate (wajib)

1. Jangan mengeksekusi migrasi berdasarkan nomor maksimum saja. Verifikasi `india_schema_file_manifest` dari seluruh workstream. PR #25 memakai 0021 Tender; PR #23 memakai versi 0021 lain untuk Vault. Rekonsiliasi jalur migrasi terpisah itu **lebih dahulu**.
2. Pastikan PR #24 (Forecast/Revenue, dependensi 0013/0014/0016–0020) telah direview dan benar-benar ada di target UAT; tidak boleh menjalankan dashboard di database produksi skema lama.
3. Backup/export dan restore D1 **terisolasi**, catat DB ID, file SHA dan waktu; jalankan 0022 sekali saja berdasarkan manifest. Uji `PRAGMA quick_check`, `PRAGMA foreign_key_check`, schema manifest, serta jumlah row sebelum/sesudah (target harus tetap 0 jika sebelumnya 0).
4. Uji penetapan target Admin dua versi, stale write bersamaan, immutable target events, audit rollback, Sales A/B isolation melalui JWT Cloudflare Access **asli** (bukan mock). Uji Finance/Approver read-only, Viewer/Legal/Marketing/Presales denied.
5. Uji skenario open/aged; closed Won dengan dokumen PO verified, Lost dengan audit, proposal with/without snapshot; revenue draft/approved/reversal, task planned/completed/cancelled, bulan WIB.
6. Verify pagination/performance pada volume produksi dan browser mobile 375px, menu sidebar/mobile dan CSV formula escaping. Cocokkan manual agregat D1 dengan API/CSV.
7. Setelah semua lulus, merge berurutan dengan dependency, change review, backup baru, rolling deploy, verifikasi HTTP/Access and rollback plan. **Tidak ada deploy produksi dalam PR #26.**

## Limitations

- Dashboard memakai snapshot stage Opportunity sekarang, bukan historical as-of pipeline. Historical snapshot multi-periode membutuhkan event-sourced snapshot khusus di backlog.
- Owner finansial mengikuti `india_sales_opportunities.created_by`, sumber otorisasi resmi PR #24; belum ada tabel reassignment ownership. Transaksi yang dibuat Admin namun tidak dimiliki Sales harus direkonsiliasi sebelum menjadikan attainment per owner sebagai dasar insentif.
- Ketersediaan nomor target memerlukan input Admin; angka null bukan berarti penjualan nol.
- Real Access UAT, backup/migrasi ke database UAT terisolasi, dan deployment produksi belum dibuktikan oleh GitHub CI.
