# INDIA 13–15 — Sinkronisasi dan eksekusi gate UAT

23 Oktober 2026 WIB. **DRAFT / NO PRODUCTION DEPLOY**.

Status operasional terbaru ada pada [eksekusi lanjutan 24 Oktober](INDIA_MODULES_13_15_FOLLOWUP_20261024.md). Daftar blocker di bawah adalah bukti historis saat pemeriksaan awal, bukan inventaris terkini.

## Selesai

- Kandidat `0a30cde` disinkronkan dengan main `f2dd4b6` tanpa konflik, mempertahankan filter 10 tahap PR #29 dan immutable generated campaign codes. History kedua parent dipertahankan; tidak melakukan rebase/force-push.
- Memperbaiki tanggal fixture Lead Nurture yang memakai UTC sementara aplikasi memakai WIB. Kegagalan menjelang tengah malam WIB bukan alasan melonggarkan validasi tanggal aplikasi.
- Seluruh regresi dan OpenNext Worker packaging lulus; 26 konsolidasi dan 19 acceptance module tests lulus. Runner browser kini turut memeriksa filter dari main: 8 pemeriksaan desktop/Android emulation lulus.
- Native Cloudflare SQL export UAT `eaed652e-7322-4950-a304-dd50baa5de02` selesai. File 31,641,970 byte diunduh dan diverifikasi SHA-256 `ca7e56c8777353d04c340d853a9ef337343c82c83a958878f07758894963815e`.
- Backup direstore dari file SQL native yang benar-benar diunduh, ke SQLite lokal terisolasi. Bukan replay fixture atau klaim restore remote D1.
- Latihan migrasi 0015–0026 pada salinan backup lulus. Seluruh data pada kolom asli dari 49 tabel non-metadata tetap identik. Dua tabel metadata berubah sesuai rencana. Kolom `india_sales_negotiations.communication_id` ditambahkan oleh 0017 sesuai sumber.
- Uji late failure setelah semua migrasi membatalkan DDL/data/ledger sepenuhnya; baseline 0014 kembali identik. Foreign keys bersih dan quick_check=ok pada baseline, rollback dan hasil migrasi.
- Bukti agregat: `INDIA_MODULES_13_15_UAT_EVIDENCE_20261023.json`. SQL, row contents, JWT, API token, private key dan signed export URL tidak dimasukkan ke Git.

## Blocker aktual yang diperiksa

1. **Kapasitas D1:** POST pembuatan `india-modules-13-15-uat-20261023` ditolak provider: HTTP 403 / **7406 System limit reached: databases per account (10)**. Koneksi sudah memiliki `d1.write`; reconnect bukan penyelesaian. Tidak ada database existing dihapus, direstore menimpa, atau diambil alih. Source UAT dan production tetap tidak berubah.
2. **Human Cloudflare Access:** hanya satu akun manusia terdaftar dan diizinkan pada dua aplikasi INDIA UAT. UAT D1 memiliki satu Admin nonfixture dan tujuh membership fixture. Sales A/B, Marketing, Presales, Finance, Approver, Legal dan Admin reviewer kedua belum tersedia sebagai distinct approved human identities. JWT asli juga belum tersedia. Akun `.invalid`, service token atau mengganti-ganti role satu akun tidak boleh dianggap pengujian multirole asli.
3. **Pemeriksaan HTTP otomatis:** permintaan tanpa sesi mendapat HTTP 403 / Cloudflare error 1010. Ini bukan bukti keberhasilan login atau keputusan role Access.
4. **Versi UAT:** frontend `uat-india` masih menandai SHA `8de0717a...`, Vault UAT `64977431...`; keduanya belum melayani kandidat 13–15 ini. Tidak mengklaim bahwa authenticated UI UAT kandidat sudah lulus.

## Langkah yang memerlukan input operasional

- Sediakan satu slot D1 tambahan, atau tetapkan database rehearsal yang secara eksplisit boleh digunakan ulang setelah backup terverifikasi. Jangan memilih database atau menghapusnya berdasarkan nama saja. Database proyek lain, production, serta UAT yang sedang terikat Worker tetap dilindungi.
- Tetapkan email QA manusia berbeda untuk Sales A/B, Marketing, Presales, Finance, Approver, Legal, Admin dan Admin reviewer kedua. Pertahankan least privilege, simpan JWT hanya di secret store/lingkungan uji; jangan kirim JWT di chat atau commit.
- Setelah target aman tersedia: restore native backup ke D1 baru, validasi hash/count/objects, migrasikan 0015–0026 secara terkontrol, stage exact CI-green SHA dengan audience serta encryption-key continuity UAT, lalu jalankan authenticated API/browser acceptance.
- Produksi baru dapat dipertimbangkan setelah remote restore/migration, human multirole acceptance, lifecycle convergence Vault/Tender/Feasibility, Cron dan review release benar-benar lulus.

## Reproduksi latihan lokal

`python3 scripts/india-uat-snapshot-rehearsal.py /path/to/verified-uat.sql /path/to/new-private-output-directory`

Script tidak mengakses network atau D1; menolak output yang sudah ada dan baseline selain versi 0014. Isi baris tidak dicetak. Database SQLite hasil latihan adalah artefak privat, tidak boleh diunggah ke repo publik.
