# INDIA — Presales hingga verifikasi PO secara transaksional

Tanggal: 22 Oktober 2026. Basis: PR #19, commit `c6b1df2` (Marketing–Sales kanonis).
Perubahan ini merupakan PR lanjutan; tidak memodifikasi branch PR #19, database remote, Worker, atau produksi.

## Perilaku operasional

| Tahap | Pelaksana | Data dan bukti yang diwajibkan | Hasil |
|---|---|---|---|
| Presales | Presales / Admin | Discovery dan technical scope lengkap pada Sales Form, catatan validasi | Paket versi baru berstatus Scoped; snapshot scope dan Customer disimpan |
| Proposal / SOW | Sales pemilik / Presales / Admin | BoQ approved dari Opportunity dan Customer yang sama, field quotation lengkap, referensi arsip proposal final dan SHA-256 | Proposed; snapshot final terikat ke ID, versi dan edit sequence BoQ |
| Persetujuan proposal | Approver / Admin independen | Catatan keputusan; pemeriksa berbeda dari pembuat Opportunity, proposal dan BoQ | Approved; membuka pengiriman quotation |
| Quotation Submission | Sales pemilik / Admin; Finance / Approver / Admin sebagai checker | Quotation paket aktif, penerima, channel, timestamp setelah approval, referensi arsip dan checksum bukti pengiriman | Reported lalu Verified; hanya bukti versi aktif membuka Negotiation |
| Negotiation | Sales pemilik / Admin | Keputusan pelanggan, nilai sebelum PPN, catatan, referensi dan checksum bukti keputusan | Riwayat immutable; keputusan terakhir Approved membuka Pending PO |
| PO / SPK | Sales pemilik / Admin; Finance dan Legal sebagai checker berbeda | Nomor PO, data rekonsiliasi yang sama dengan Sales Form, referensi arsip asli dan SHA-256 | Review Finance dan Legal terikat ke paket dan snapshot data PO |
| Verifikasi PO | Finance / Approver / Admin independen | Paket approved aktif, submission verified, keputusan pelanggan terakhir approved, nilai sesuai BoQ, PO asli dengan dua review | Pemeriksaan dan audit commit bersama; membuka Closed Won |

Proposal sekarang menggunakan D1 dan autentikasi yang sama dengan Sales. `/api/proposals` diarahkan ke handler lifecycle yang sama, sehingga status `sent/accepted` lama tidak dapat ditulis secara bebas. Tidak ada fallback ke data proposal di memori.

Menu `/proposals` dan `/sales/lifecycle` menampilkan paket aktif, riwayat versi, validasi Presales, pengajuan dan approval proposal, bukti keputusan negosiasi, serta tautan ke Sales Form, BoQ, submission dan review PO yang membawa Opportunity ID yang sama. Preview quotation tiga halaman A4 dan ekspor DOCX memakai generator existing dan data D1 approved.

## Revisi dan integritas

- Satu paket aktif per tenant dan Opportunity. Riwayat paket serta negosiasi tidak dapat ditimpa atau dihapus.
- Perubahan material pada scope, identitas Customer, harga/BoQ atau ketentuan setelah proposal diajukan membatalkan paket dan submission terkait, mengarsipkan pemeriksaan PO lama, serta membuka ulang Solution Design.
- Persiapan komersial saat paket masih Scoped dapat dilakukan tanpa mengulang validasi teknis. Snapshot proposal final direkam saat diajukan.
- BoQ yang sudah digunakan sebuah paket harus direvisi menjadi ID/versi baru untuk paket pengganti; approval dan bukti submission lama tidak diwariskan.
- Perubahan follow-up mempertahankan paket approved. Perubahan nomor/tanggal/referensi/nilai PO atau rekonsiliasi scope membatalkan pemeriksaan PO, dan review dokumen harus cocok snapshot terbaru.
- Keputusan negosiasi terbaru menentukan gate. Mengisi `customer_decision=approved` pada Sales Form tidak menggantikan bukti keputusan pelanggan.
- Revision Required membuka siklus Presales, BoQ, approval dan submission ulang. Closed Lost membatalkan paket aktif; Reopen mempertahankan sejarah dan memerlukan validasi baru.
- Pemeriksaan PO yang dibatalkan atau diganti disalin ke `india_sales_po_check_history`, termasuk reviewer dan timestamp asli.

Mutasi Opportunity, tahapan, paket, BoQ, submission, award, verifikasi PO dan audit terkait menggunakan satu `D1.batch()`. Optimistic guard dievaluasi di dalam transaksi, sebelum perubahan. Konflik versi, pelanggaran gate atau kegagalan audit membatalkan seluruh batch. Trigger database memeriksa kembali dependensi saat menulis, sehingga pembacaan sebelum transaksi tidak menjadi satu-satunya perlindungan.

Referensi arsip dan checksum bukan penyimpanan file. Proposal, receipt pengiriman, bukti keputusan pelanggan dan PO asli tetap harus tersedia di arsip perusahaan dan diperiksa checker. Register tidak mengirim email atau memberikan tanda tangan elektronik otomatis.

## Migrasi 0012 dan urutan rilis

`migrations/0012_presales_po_transactions.sql` menambah tabel paket, negosiasi, transaction guards dan sejarah pemeriksaan PO; menambah flow version serta hubungan paket ke submission, award dan pemeriksaan PO; memasang trigger integritas.

Data lama tidak diberi approval sintetis. Penawaran terbuka pada Commercial Review, Quotation Sent, Negotiation atau Pending PO dikembalikan ke Solution Design dengan audit `FLOW_REVALIDATION_REQUIRED`. Bukti lama tetap tersedia, tetapi submission terbuka tanpa paket ditandai Superseded. Customer, Opportunity, BoQ dan dokumen historis tidak dihapus. Deal yang sudah Closed Won/Lost tetap pada tahap historisnya.

1. Selesaikan review basis PR #19 dan perubahan ini sebagai satu kandidat rilis yang konsisten.
2. Ambil backup database UAT yang identitas dan binding-nya telah diverifikasi; simpan checksum serta buktikan restore.
3. Terapkan migrasi 0012 hanya setelah 0001–0011 kanonis tersedia, menggunakan ledger migrasi. Jalankan sebagai transaksi atomik; tidak dijalankan otomatis oleh CI.
4. Periksa foreign keys, jumlah Customer/Opportunity/BoQ/dokumen sebelum–sesudah, status penawaran yang memerlukan revalidasi, dan audit migrasi.
5. Jalankan HTTP/browser UAT pada hostname dan D1 UAT terpisah dengan identitas Cloudflare Access asli: Sales A, Sales B, Admin, Presales, Finance, Approver dan Legal. Buktikan pemisahan maker–checker, isolasi Sales, revisi material, submission versi lama, penolakan PO berbeda dan rollback.
6. Merge dan deployment tetap menunggu UAT asli tersebut; identitas uji lokal bukan bukti login Cloudflare Access.

Jika tahap DDL/DML migrasi gagal, rollback seluruh transaksi. Setelah migrasi dipakai untuk transaksi baru, jangan menjalankan down-migration yang membuang riwayat; gunakan perbaikan maju atau pemulihan backup dalam maintenance window yang sudah direview.

## Bukti verifikasi lokal

- 214 pengujian non-browser PASS, termasuk 26 pengujian baru pada actual route handlers dengan adapter SQLite yang menjalankan batch sebagai transaksi.
- 10 pemeriksaan HTTP/browser PASS: enam fixture role existing, fail-closed tanpa Access, serta browser mobile/desktop yang memanggil handler lifecycle sebenarnya melalui identitas test-only.
- Total 224 PASS, tanpa skip. Seluruh 44 skenario negatif existing tetap disertakan.
- TypeScript, build produksi Next.js 16.4.2 dan packaging OpenNext Cloudflare PASS.
- Browser memeriksa transaksi Presales, pengajuan proposal, approval independen, keputusan negosiasi, tautan Opportunity konsisten, preview tiga halaman A4 dan tidak ada overflow horizontal pada viewport 375 px.
- Audit-failure injection membuktikan rollback scope, proposal, approval, perubahan deal, review submission, review Legal, revisi/submit BoQ, pemeriksaan PO dan Closed Won.
- Konflik transaksi bersamaan, lifecycle revisi dengan BoQ baru, migrasi data lama, riwayat PO immutable, quotation kedaluwarsa dan timestamp bukti tidak valid diuji.

Perintah: `npm run test:sales-transactions`, suite regression existing, `npm run typecheck`, `npm run build`, `npm run test:browser-http-uat`, `npx opennextjs-cloudflare build`.

Status remote: migrasi 0012, login multirole Cloudflare Access asli, merge dan deployment belum dilakukan oleh perubahan ini.
