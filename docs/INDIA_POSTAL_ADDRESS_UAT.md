# INDIA — Pemilihan Wilayah dari Kode Pos

## Implementasi
- Form *Customer Registration* di `/sales/pipeline` dan form konversi *Lead → Customer* di `/sales/leads` memakai komponen `PostalAddressFields` yang sama.
- Ketika kode pos mencapai lima digit, aplikasi meminta hasil kepada endpoint `/api/reference/postal` (Cloudflare Access JWT + role). **Middleware harus mengizinkan endpoint tersebut.**
- Respons terdiri dari data D1, bukan daftar dropdown buatan. Pilih provinsi → kabupaten/kota → kecamatan/distrik → desa/kelurahan. Tiap perubahan induk mereset pilihan tingkat bawah.
- Kode pos berbeda dapat memiliki beberapa kandidat; pengguna menentukan desa/kelurahan yang benar. Tidak ada auto-assignment tanpa pilihan.
- Server membandingkan kembali kombinasi kode pos + identitas wilayah yang tersimpan di D1 sebelum membuat/memperbarui Customer maupun mengonversi Lead.
- Field lama tetap berada di `india_sales_accounts.data_json`; kode wilayah baru bersifat tambahan dan tidak mengubah struktur transaksi pelanggan lain.
- Segmentasi pelanggan bersifat opsional. Detail RT/RW/nomor jalan tetap di kolom alamat bebas.

## Provenansi dan pembetulan sumber
- Master sumber terbuka: `mrayhanfadil/kodepos-id`, commit `33d362f827030606ab15a4f29a42c22c2eba3c7b`, perolehan 21 Agustus 2026.
- Source CSV mempunyai 83.712 entri desa/kelurahan, tetapi **hanya 37 `prov_code` unik** karena Papua Barat Daya salah memakai kode provinsi 92 yang juga dipakai Papua Barat.
- **Normalisasi saat impor:** jika `provinsi = Papua Barat Daya`, simpan provinsi Kemendagri **96**, bukan 92. Kode desa sumber **92.xx.yy.zzzz** diawetkan dalam namespace internal `PBD:92.xx.yy.zzzz`. Key kabupaten/kecamatan berupa `PBD-xx` dan `PBD-xx-yy` sebagai *identifier internal*, **bukan** kode administratif resmi. Jangan ekspor kode PBD internal ke API pemerintah sebagai kode Kemendagri.
- Data sumber mencakup **38 nama provinsi** setelah pemetaan internal dan perlu pencocokan berkala dengan Kemendagri/PT Pos Indonesia jika digunakan sebagai alamat pengiriman legal.
- Dataset ini bukan jaminan kode pos setiap alamat sudah mutakhir dan bukan master resmi PT Pos Indonesia. Verifikasi ulang penamaan, pemekaran wilayah dan lisensi sumber sebelum rollout luas.
- Tidak ada data pelanggan/CRM yang dikirim ke penyedia data eksternal; pencarian runtime memakai D1.

## Penerapan ke D1 UAT — hasil aktual 22 Oktober 2026
Database target **`india-uat-users-db`** (D1 `eaed652e-7322-4950-a304-dd50baa5de02`, bukan Worker produksi).
- Backup ekspor D1 dan bookmark *time travel* diperiksa lebih dulu; **uji restore terpisah belum dijalankan**.
- Migrasi aditif `0022_indonesia_postal_reference.sql` diterapkan di UAT.
- Impor bertahap pada database UAT berhasil mencatat **83.712** wilayah unik, **38** provinsi, dan **10.668** kode pos unik.
- Marker `india_postal_import_state` hanya menjadi `ready` setelah perhitungan angka tersebut dan pemeriksaan `source_version` lulus.
- Contoh `40111` → Kelurahan Braga, Kecamatan Sumur Bandung, Kota Bandung, Jawa Barat.
- `12345` adalah angka ilustratif yang tidak ditemukan dalam dataset. Hasilnya harus kosong dan tidak boleh dibuat-buat.
- **Belum ada klaim bahwa Worker atau browser aplikasi UAT/produksi sudah memakai database ini**. Pastikan *D1 binding* Worker UAT diverifikasi sebelum test autentikasi nyata.

## Migrasi dan pengoperasian lanjutan
1. Rekonsiliasi nomor migrasi `0022` dengan PR lainnya; jangan menjalankan migrasi ke database produksi sebelum gate selesai.
2. Pastikan D1 UAT backup/export & bookmark diketahui serta pemulihan ditest pada backup terisolasi.
3. Unduh file CSV sumber terpin dan generate bagian SQL: `python3 scripts/import-indonesia-postal.py --out /tmp/india-postal-uat`. Skrip memastikan 38 kode provinsi setelah koreksi PBD. Pastikan izin pakai dataset.
4. Terapkan migrasi `0022` terlebih dahulu. Impor bagian `[0-9][0-9][0-9].sql` ke D1 UAT. **Jalankan `zz-finalize.sql` hanya di akhir**, setelah semua batch dan rekonsiliasi cakupan lulus.
5. Cek `SELECT COUNT(*) AS rows, COUNT(DISTINCT postal_code) AS postals, COUNT(DISTINCT province_code) AS provinces FROM india_postal_areas;` dan `SELECT * FROM india_postal_import_state;`; hasil harus sesuai manifest.
6. Jalankan `npm run test:postal`, `npm run test:marketing`, `npm run test:sales`, `npm run typecheck`, `npm run build`, dan Cloudflare adapter build.
7. Lakukan pengujian browser Android/desktop pada Worker UAT dengan **Cloudflare Access asli** (Sales A, Sales B, Marketing, Admin, dan viewer negatif): 401 tanpa login, 403 akses terlarang, 422 kode salah, 503 master belum final, 200 kode benar, 200 kosong jika tidak ditemukan, kode wilayah ditolak jika mismatch.
8. Verifikasi pengendalian akses Customer, transaksi konversi Lead dan audit tetap aman. Jangan merge atau deploy produksi sebelum semua gate lulus.

## Rollback
Rollback aplikasi menggunakan versi terakhir yang lolos CI. Migrasi master bersifat aditif dan tidak menghapus Customer; untuk UAT yang terganggu, gunakan bookmark/export yang tersedia dengan prosedur restore terotorisasi dan tanpa kehilangan perubahan UAT lain.
