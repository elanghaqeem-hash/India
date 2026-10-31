# INDIA — Pilihan Proses Pengadaan

Lead Qualification dan Sales Pipeline menggunakan dropdown yang sama dengan 15 pilihan:

1. Pengadaan Langsung
2. Penunjukan Langsung / Sole Source
3. Permintaan Penawaran / RFQ
4. Permintaan Proposal / RFP
5. Tender Terbuka / Lelang Umum
6. Tender Terbatas / Undangan
7. Seleksi Konsultan
8. Beauty Contest / Pitching
9. E-Purchasing / E-Katalog
10. Tender Elektronik / E-Procurement
11. Pembelian Melalui Partner / Distributor
12. Kontrak Payung / Framework Agreement
13. Perpanjangan Kontrak / Renewal
14. Addendum / Perubahan Kontrak
15. Lainnya

Pilihan awal kosong. Nilai historis yang belum termasuk daftar tetap ditampilkan sebagai “data sebelumnya” dan disimpan tanpa perubahan sampai pengguna sengaja memilih nilai lain. Field tetap terkunci mengikuti status Lead Converted atau hak edit Sales Pipeline. Qualification dan konversi tetap memakai kolom procurement_process yang sudah ada; tidak ada migrasi atau backfill database.

Validasi: seluruh 15 nilai diuji melalui API registrasi/qualification/konversi pada adapter SQLite/D1 terisolasi dan tetap sama pada Opportunity. Pemeriksaan TypeScript lulus; 192 eksekusi pengujian pada baseline produksi dan build Next.js/OpenNext lulus. Pada implementasi kanonis, 56 pengujian Sales lulus. Render React memastikan 15 opsi, pilihan aktif, field disabled, dan pelestarian nilai historis. Pengujian ini tidak menggantikan UAT transaksi dengan sesi Cloudflare Access asli.

Produksi menggunakan patch lanjutan pada branch release/india-catalog-prod-20261025, mempertahankan pembaruan katalog sebelumnya. Versi Worker sebelum rilis adalah 1b686467-7df5-44ac-a8c1-f71a8b371d3a sebagai titik rollback. Worker, binding D1, Access, kredensial, dan skema tidak diubah oleh patch ini. Hasil deployment dicatat setelah verifikasi.

## Integration review — 31 October 2026

Historical validation above applies to the original branch, not the merged candidate. The canonical Lead and Pipeline forms retain authenticated `ManagedOptionSelect` and D1 Admin-managed options, automatic billing addresses, searchable business types and multi-asset scoping. The 35 service classifications reuse existing BoQ, conversion and Post-PO flows. No production UAT or deployment is asserted by this merge.
