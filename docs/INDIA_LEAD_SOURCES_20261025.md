# INDIA — Sumber Lead Terstandar

Lead Baru dan Sales Pipeline memakai komponen dropdown yang sama. Pengguna memilih sumber lead tanpa mengetik ulang. Nilai awal kosong dan Lead Baru belum dapat disimpan sebelum sumber dipilih.

Pilihan:

1. Website / Formulir Online
2. Organic Search / SEO
3. Iklan Digital / SEM
4. LinkedIn
5. Media Sosial
6. Email Campaign
7. WhatsApp / Telepon Masuk
8. Webinar
9. Seminar / Konferensi
10. Workshop / Training
11. Pameran / Expo
12. Referral Pelanggan
13. Referral Internal
14. Partner / Distributor / Principal
15. Asosiasi / Komunitas
16. Outbound Prospecting
17. Tender / RFP / RFQ
18. Pelanggan Existing / Renewal
19. Cross-sell / Upsell
20. Kunjungan / Pertemuan Bisnis
21. Marketplace / Portal Pengadaan
22. Lainnya

Nilai sumber lama tetap ditampilkan sebagai “data sebelumnya” dan tidak diubah otomatis. Pilihan baru tersimpan pada kolom sumber yang sama dan ikut menjadi lead_source saat konversi Opportunity. Tidak ada migrasi atau pengubahan data produksi.

Validasi perubahan: 56 pengujian Sales lulus, termasuk semua pilihan sumber tersimpan dan terbawa melalui API konversi pada adapter SQLite/D1 terisolasi. Uji browser komponen React pada lebar 390px lulus untuk dropdown native, pilihan kosong wajib, perubahan pilihan, pelestarian sumber historis, dan tidak ada overflow horizontal. Pemeriksaan TypeScript serta build Next.js dan OpenNext Cloudflare lulus.

Status otorisasi: pengguna telah memberikan izin eksplisit untuk seluruh push repository dan produksi pada 25 Oktober 2026. Hasil push, PR dan verifikasi deployment dicatat setelah eksekusi; izin ini tidak dianggap sebagai bukti pengujian operasional.

## Integration review — 31 October 2026

Historical validation above applies to the original branch, not the merged candidate. The canonical Lead and Pipeline forms retain authenticated `ManagedOptionSelect` and D1 Admin-managed options, automatic billing addresses, searchable business types and multi-asset scoping. The 35 service classifications reuse existing BoQ, conversion and Post-PO flows. No production UAT or deployment is asserted by this merge.
