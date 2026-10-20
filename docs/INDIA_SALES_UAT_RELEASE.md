# INDIA Sales CRM — UAT & Production Release Gate

Status: **release candidate di branch**, bukan bukti bahwa pengujian login/browser/produksi selesai.

## 1. Artefak resmi yang digunakan kembali
1. BoQ customer, internal standard dan onsite XLSX dari module /boq D1.
2. Quotation VAPT Mobile, VAPT multi-asset dan Managed SOC DOCX yang dihasilkan generator `src/lib/quotation-docx.ts` dari approved D1 BoQ. Bukan salinan pricing pelanggan contoh.
3. Registrasi Pelanggan V.042026 dan Form Project One-Time V.042026: form lama `/post-po`, pemetaan `sales-to-post-po.ts`, dengan upload template resmi di browser. Pembuktian KTP/NPWP dan PO tetap manual.
4. Closed Lost internal analysis DOCX dari `/api/sales/loss-report` dan riwayat Opportunity.

## 2. Skenario UAT (staging, data sintetis, hapus sesudah test)

| ID | Alur dan kontrol | Expected result |
|---|---|---|
| A01 | GET /api/sales tanpa sesi Cloudflare Access | 401; data pelanggan tidak dikirim |
| A02 | Viewer/role tak terdaftar membuat Customer | 403 |
| A03 | Sales A registrasi Customer + Opportunity kosong | tersimpan D1, Opportunity ID & Customer ID unik |
| A04 | Sales B membaca detail atau mengubah Opportunity milik Sales A | 403 |
| A05 | Presales memperbarui technical_scope dan asset_profile | perubahan diizinkan, tercatat |
| A06 | Presales mengubah quotation_number atau po_amount_before_vat | 403 |
| A07 | Sales lompat Prospecting langsung ke Quotation | 409 dengan daftar stage yang harus dipenuhi |
| A08 | Sales lengkapi Discovery, Technical, jadwal, BoQ | lanjut stage setelah gate terpenuhi |
| A09 | BoQ tanpa Approved, tidak satu Opportunity ID, atau beda nama pelanggan | Quotation/Closed Won ditolak |
| A10 | Maker BoQ berusaha approve sendiri (termasuk Admin) | 403; approver independen |
| A11 | Quotation approved di-download DOCX | nominal dan SKU sesuai D1, sender dari form, tanda tangan belum diotorisasi |
| A12 | PO berbeda nominal/scope dibanding approved BoQ | verifikasi PO ditolak |
| A13 | Pembuat Opportunity berusaha memverifikasi PO sendiri (Admin sekalipun) | 403 |
| A14 | Finance/Approver independen verifikasi PO manual dengan evidence reference | audit identitas+timestamp; verifikasi bukan upload asli |
| A15 | Sales menekan Won tanpa verifikasi PO valid | 409 |
| A16 | Setelah Won, Post-PO prefill Customer ID, PIC, PO, VAT-exclusive fee, milestones | field hasil pemetaan sesuai sumber, bukti KTP/NPWP tetap kosong |
| A17 | Upload Word template V.0426, lengkapi dan validasi Post-PO | dua Word sesuai layout template asli, tanpa nama/angka fiktif |
| A18 | Prospecting tanpa BANT diakhiri Lost disertai alasan dan catatan | Closed Lost diperbolehkan tanpa memalsukan qualification |
| A19 | Closed Lost download laporan evaluasi DOCX | Word hanya berisi data sumber, label Internal Draft dan audit |
| A20 | Generate AI dengan provider yang aktif, tested_ok=1, prompt anonim, user consent | draft + nama provider/model & audit, tidak mengubah data pokok |
| A21 | Pilih AI belum tested/aktif atau prompt mengandung KTP/NPWP/email | request ditolak |
| A22 | Permintaan AI >20/jam/pengguna | 429 |
| A23 | Dua user mengubah kesempatan yang sama tanpa refresh | 409, tidak menimpa perubahan pengguna lain |
| A24 | Layar 360/BoQ/Post-PO mobile 360-430px | menu dapat dijangkau, input/CTA tidak saling menimpa |

## 3. Pelaksanaan UAT dan segregation of duties

- Admin: provisioning email nyata di menu `/boq/users` dan pengelolaan provider.
- Sales: Maker customer/opportunity, stage, proposal/quotation dan Closing.
- Presales: technical scoping; tidak boleh mengubah PO/komersial.
- Finance/Approver: approved BoQ via workflow terpisah dan verifikasi PO independen.
- Management: meninjau laporan Lost dan handover, persetujuan final belum otomatis dibuktikan oleh generator.
- PM: memastikan readiness, timeline dan handover setelah Won.

Tidak boleh memakai email/password hardcoded, nomor PO fiktif atau NPWP/KTP sintetis pada tenant pelanggan riil. Data UAT hanya digunakan di staging yang terisolasi, bertanda TEST/uat dan dibersihkan setelah tes.

## 4. Batasan saat ini
- Cloudflare Worker `india` yang tersedia masih mereferensikan deployment di luar PR; branch baru belum dipromosikan.
- Cloudflare Access JWT dibutuhkan untuk UAT transaksi melalui HTTP; koneksi API GitHub/Cloudflare administratif tidak menggantikannya.
- Form V.0426 menerima Word template lokal per sesi. Penyimpanan bukti sensitif, arsip dokumen, persetujuan tanda tangan digital, dan vault terenkripsi belum dinyatakan tersedia.
- KTP, konfirmasi lampiran NPWP/KTP, dan tanda tangan harus diperiksa dengan metode yang disetujui organisasi.
- Tidak ada otomatisasi persetujuan legal atau Finance oleh AI.
- Review peraturan pajak, termin, dan klaim layanan tetap berada pada pemilik proses.

## 5. Kriteria Go-Live
1. Semua GitHub Actions regression+TypeScript+Next build+Cloudflare adapter PASS pada HEAD terbaru.
2. Migrasi D1, backup, retention, secrets, Cloudflare Access app policy dan recovery diverifikasi.
3. Minimum 4 role nyata tersedia, owner visibility+Maker Checker tervalidasi melalui sesi terpisah.
4. Semua skenario A01-A24 yang applicable lulus dengan bukti log/screenshot dan dokumen hasil.
5. Penanggung jawab Sales, Presales, Finance, IT/Security dan Operasional menyetujui daftar pengecualian.
6. Baru kemudian PR #12 dapat dipromosikan, di-merge dan dideploy; verifikasi smoke test pascadeploy wajib sebelum aktivasi pelanggan.

**Tidak boleh mengklaim PASS/Go-Live bila hanya pengujian unit atau build lulus.**
