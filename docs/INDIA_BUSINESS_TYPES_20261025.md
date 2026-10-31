# INDIA — Bidang Usaha Terstandar

Dropdown Bidang Usaha tersedia pada konversi Lead, Customer/Sales Pipeline, dan form registrasi Post-PO. Implementasi menggunakan katalog dan komponen StandardCustomerChoice yang sudah tersedia pada sumber kanonis INDIA.

- 96 pilihan bidang usaha dari 20 sektor; pengguna dapat langsung memilih.
- Jika sektor industri sudah dipilih, pilihan bidang usaha menyesuaikan sektor tersebut.
- Integrasi 31 Oktober mempertahankan rekomendasi populer ketika sektor belum dipilih; pencarian dan opsi Lihat semua bidang usaha membuka katalog lintas sektor.
- Opsi Lainnya memungkinkan aktivitas usaha spesifik tetap dicatat. Data historis tidak diubah otomatis dan tetap terlihat/editable sesuai izin form.
- Field business_type pada Customer dan businessType pada Post-PO memakai nilai yang sama; tidak ada master duplikat, migrasi atau backfill.

Validasi: TypeScript dan 56 pengujian Sales kanonis lulus. Pada baseline produksi, 192 pengujian dan build Next.js/OpenNext lulus. Integration test menggunakan API konversi sebenarnya dan SQLite/D1 terisolasi, memastikan bidang usaha yang dipilih tersimpan pada Customer serta dipetakan sama ke Post-PO. Render React memeriksa seluruh 96 pilihan, filter 20 sektor, nilai terpilih, serta field historis yang disabled. UAT transaksi dengan sesi Access pengguna asli tidak diklaim.

Patch produksi melanjutkan source release/india-catalog-prod-20261025 dan mempertahankan dropdown layanan, sumber Lead, serta proses pengadaan sebelumnya. Worker version saat preflight awal: 831d3c22-ff5e-4044-ac2e-e23a2570664c, yang dibentuk oleh perubahan secret pada source produksi yang sama. Binding D1, Access, dan secret AI/Document Vault harus dipertahankan saat deploy. Pemeriksaan terbaru dilakukan lagi sebelum dispatch agar deployment lain tidak tertimpa.

Catatan integrasi 31 Oktober: angka pengujian di atas adalah riwayat branch awal. Form kanonis terbaru dipertahankan dan diuji kembali pada kandidat merge; bukan bukti UAT produksi.
