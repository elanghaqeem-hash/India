# RTICORE — Admin Mode Uji Role (1 November 2026)

## Tujuan
Pada menu akun pengguna, Admin dapat memilih role lain tanpa logout untuk menguji navigation, workflow, dan pembatasan API pada role tersebut. Identitas email tetap sesuai hasil verifikasi Cloudflare Access, bukan impersonasi akun pengguna lain.

## Role yang tersedia
Administrator, Marketing, Sales, Presales / Solution, Finance, Approver, Legal, dan Viewer.

## Alur
1. Login sebagai anggota `india_members` yang aktif dan mempunyai role `admin`.
2. Buka menu profil di kanan atas; pilih **Ganti Role / Mode Uji**.
3. Pilihan dikirim ke `POST /api/sales/role-switch` dari origin aplikasi yang sama.
4. Server memverifikasi Cloudflare Access JWT dan keanggotaan D1 aktual sebagai Admin, menulis `ROLE_PREVIEW_SWITCH` ke `india_audit_log`, kemudian menetapkan cookie sementara HttpOnly, SameSite=Strict, Secure pada HTTPS selama 60 menit.
5. Semua API menggunakan `authorizeBoQ`: role efektif sekarang role uji. Role asal Admin tetap dapat dilihat melalui `GET /api/sales/identity`, dan tidak dapat diubah oleh browser. Sidebar dan menu mengikuti role efektif setelah navigasi ulang.
6. Pilih **Kembali ke Role Admin** atau Administrator pada menu profil untuk membersihkan cookie sementara.

## Batasan keamanan
- Fitur hanya untuk **anggota Admin aktif**; anggota non-Admin tidak bisa menaikkan role dengan memanipulasi cookie.
- Cookie ini **bukan autentikasi** dan tidak memiliki hak akses mandiri. Server selalu memverifikasi Cloudflare Access + D1 terlebih dahulu.
- Dalam mode Sales, pembatasan atas kepemilikan data masih mengikuti **email Admin yang login**; data milik akun Sales lain tidak otomatis dapat diakses. Untuk UAT data personal gunakan akun Sales nyata yang terdaftar.
- Audit menyimpan identitas pengguna asli dan perubahan role efektif. Jika penyimpanan audit gagal, role tidak berubah.
- Penggunaan HTTPS dan Cloudflare Access production tetap wajib. Fitur bukan jalan pintas untuk menonaktifkan autentikasi.
- Mode uji ini berdampak pada role yang dipakai API, termasuk POST/DELETE; gunakan tenant dan data UAT saat menguji proses berisiko.
- Mode uji tidak memberikan role bersamaan (multi-role entitlement), dan tidak mengubah registrasi role dalam D1.
- Cookie kadaluarsa otomatis dalam satu jam dan hanya berlaku untuk akun Admin asal.

## Verifikasi
- `npm run typecheck`
- `npm run test:role-preview`
- `npm run test:modules-13-15`
- UAT browser: Admin -> Sales -> Finance -> Viewer -> Admin; masing-masing menu dan API harus menolak operasi yang dilarang.
- Periksa D1 `india_audit_log` action `ROLE_PREVIEW_SWITCH`, lalu verifikasi identitas dan privilege normal setelah sesi expired.
- Rilis hanya setelah lint/typecheck, test dan verifikasi di lingkungan yang disetujui.
