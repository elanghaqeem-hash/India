# INDIA — Hasil Simulasi Multirole (20 Oktober 2026)

## Ruang lingkup dan bukti

**Jenis pengujian:** simulasi *isolated D1 database* + pengujian fungsi bisnis, RBAC, Word exporter dan build di GitHub Actions. **Bukan** pengujian login melalui Cloudflare Access (alamat dummy dengan domain `.invalid` tidak bisa dipakai login). SQL fixtures tidak mengeksekusi endpoint HTTP serta tidak membuktikan policy Cloudflare Access.

**Lingkungan:** database `india-uat-users-db` (ID `eaed652e-7322-4950-a304-dd50baa5de02`) terpisah dari Worker `india`. Tenant fixtures: `defendit360`, secara fisik hanya dalam D1 UAT. Jangan copy fixtures ke database Worker aktual.

**P0 schema compatibility issue ditemukan dan ditangani:** tabel legacy `opportunities` tidak mengizinkan seluruh stage dan tabel legacy `companies` memiliki foreign key terhadap identitas user yang tidak sesuai dengan autentikasi email. Migrasi `0004_india_sales_isolation.sql` menggunakan **tabel baru** `india_sales_accounts` dan `india_sales_opportunities` tanpa menghapus tabel legacy. Migrasi berhasil diterapkan pada UAT D1 dan diperiksa dengan `PRAGMA foreign_key_check`: 0 temuan.

## Hasil transaksi fixture SQL UAT

| Indikator | Nilai |
|---|---:|
| Dummy identity terdaftar aktif di UAT | 7 |
| Customer master sintetis | 2 |
| Opportunities | 2 |
| BoQ UAT yang disetujui | 1 |
| PO terverifikasi secara simulasi | 1 |
| Dokumen metadata berstatus draft | 2 |
| Audit stage berubah | 9 |
| Pengujian tahap/approval/audit/dokumen menggunakan SQL | 27/27 sukses |
| 4 percobaan data invalid yang diharapkan ditolak | 4/4 ditolak |
| Foreign key check | PASS (0 temuan) |
| Pemanggilan AI eksternal | 0 (tidak dilakukan) |

**Won:** `uat-opp-won-20261020` / Sales A; satu BoQ `uat-boq-won-20261020` / Sales A; approval oleh `uat.approver@india.invalid`; verifikasi nominal PO oleh `uat.finance@india.invalid`; stage final `closed_won`.

- 2 line VAPT: Rp70.000.000 dan Rp50.000.000.
- Nilai sebelum PPN: Rp120.000.000; PPN ilustratif 11%: Rp13.200.000; total: Rp133.200.000.
- HPP komponen A–E: Rp75.000.000, margin kotor: 37,5% (semuanya angka TEST, bukan penawaran pelanggan).
- PO `UAT-PO-001` Rp120.000.000 sebelum PPN cocok dengan BoQ, diperiksa Finance yang berbeda dari Maker Sales.
- Post-PO dokumen metadata tetap *draft*: KTP, NPWP dan lampiran asli tidak diakui secara otomatis.

**Lost:** `uat-opp-lost-20261020` / Sales B. Berakhir `closed_lost` dari Prospecting dengan alasan `Kebutuhan ditunda`. Nilai peluang simulasi Rp90.000.000; ini bukan revenue atau kerugian keuangan riil.

### Negative tests database

1. Stage `won_without_po` tidak dikenal → CHECK menolak, status final tetap `closed_won`.
2. Customer number `IND-UAT-1001` duplikat → UNIQUE menolak, tidak ada row tambahan.
3. Opportunity yang mengarah ke company_id tidak ada → FOREIGN KEY menolak, tidak ada row tambahan.
4. JSON metadata tidak valid → CHECK(json_valid) menolak, data asli utuh.

## Pengujian kode multirole

Workflow CI pada branch: `INDIA Sales Multirole UAT`, `.github/workflows/sales-multirole-uat-ci.yml`. Termasuk `tests/sales-multirole-simulation.test.cjs` (12 skenario) dan suite regresi Sales lainnya.

| Modul / aktor | Expected |
|---|---|
| Viewer | Tidak bisa buat/approve BoQ atau membaca HPP |
| Sales A vs Sales B | B tidak dapat membaca/mengubah deal A |
| Presales | Hanya field teknis termasuk team/technical writer, bukan komersial/PO |
| Finance | HPP / PO verification oleh checker terpisah |
| Approver | BoQ hanya approved sesudah submit dan terpisah dari maker |
| Admin | Tidak boleh menyetujui BoQ buatan sendiri |
| Stage-gate | Urutan 9 tahap ke Won; tidak boleh loncat |
| BoQ dan Quotation | Harga, PPN, total, HPP, margin konsisten |
| Quotation DOCX | Paket Word valid dengan sender dari form, label DRAFT |
| Won/Post-PO | PO yang cocok dan evidence harus dikonfirmasi; PIC, scope, milestone terpetakan |
| Lost | Bisa dari tahap awal dengan alasan & narasi; laporan Word unsigned |
| AI | Provider untested tidak terpilih otomatis; consent wajib; quota dan human review |

**Batas klaim:** unit test dan SQL-seeded data **tidak** menguji Cloudflare Access JWT, pengiriman AI riil, UI browser nyata, atau upload template DOCX asli via user. 24-item UAT manual masih memerlukan verifikasi tersendiri.

## Blocker Go-Live

- `india` Worker tetap mengarah ke D1 existing dan tidak diubah.
- 7 akun `.invalid` hanya dapat menjadi identitas fixture; perlu akun QA nyata + Cloudflare Access policy untuk pengujian end-to-end HTTP.
- UAT D1 **tidak memiliki** provider AI key (0), sehingga AI model invocation bukan bagian dari simulasi.
- Perubahan `0004` belum diterapkan di Worker D1.
- PR #12 tetap Draft; branch dapat memerlukan sinkronisasi/resolve conflict dengan `main` sebelum merge. Tidak ada klaim deployment produksi.

## Pemulihan fixtures

Jangan menghapus database UAT saat hasil masih dibutuhkan. Untuk membersihkan data contoh nantinya, gunakan prefix `uat-` dan `created_by='INDIA_UAT_FIXTURE_20261020'` secara eksplisit serta verifikasi nama database target.
