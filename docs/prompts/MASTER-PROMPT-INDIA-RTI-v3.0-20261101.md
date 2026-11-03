INDIA Master Execution Prompt v3.0 — RTI Parameterized Edition
1 Nov 2026 · @Teguh
0. Cara Pakai dan Blok Parameter Global
Prompt ini adalah template eksekusi: semua nilai di dalam {{...}} diisi dari blok parameter di bawah, dan sistem wajib menyimpan nilai yang sama sebagai konfigurasi di database (tabel sys_parameter, org_unit, role_template, fin_calendar) sehingga perubahan organisasi tidak memerlukan perubahan kode. Versi ini menggantikan v2.0 dan mempertahankan seluruh ketentuan v2.0 kecuali yang secara eksplisit diubah.
Aturan pemakaian:
1. Isi atau ubah blok PARAMETERS sebelum eksekusi; nilai default sudah disiapkan untuk PT Riset Teknologi Indonesia (RTI).
2. Agent wajib membaca parameter ini terlebih dahulu, lalu memvalidasinya terhadap kondisi repository dan database aktual.
3. Parameter yang bertanda VERIFY wajib diverifikasi ke sumber resmi (DJP, IAI, OJK, BPJS) sebelum dipakai di produksi.
4. Setiap perubahan parameter di produksi melewati maker-checker dan tercatat di audit trail dengan effective date.
PARAMETERS:
  prompt_version: "3.0-RTI"
  system:
    code: "INDIA"
    name: "Integrated Cybersecurity & IT Enterprise ERP + PSA"
    repository: "https://github.com/elanghaqeem-hash/India"
    main_branch: "main"
  company:
    holding_code: "RTI"
    legal_name: "PT Riset Teknologi Indonesia"
    brand: "Risetin"
    domain: "risetin.co.id"
    hq_address: "Graha Mustika Ratu Lt. 7, Jl. Jend. Gatot Subroto Kav. 74-75, Menteng Dalam, Tebet, Jakarta Selatan"
    business_lines: [ADVISORY, SOFTWARE, IT_SUPPORT, GOVERNANCE, CYBERSECURITY, TRAINING, TECH_TRADING]
    affiliated_entities:          # entitas lain yang dapat di-onboard sebagai legal entity
      - { code: "TAR", legal_name: "PT Technotama Artha Raya", status: "onboarding" }
    partners:
      - { code: "ADTC", name: "AD Training Center", scheme: "revenue_share", rti_share: 0.60, partner_share: 0.40, base: "net_distributable_revenue" }
  accounting:
    framework: "SAK_EP"           # opsi: SAK (PSAK berbasis IFRS) | SAK_EP | SAK_EMKM  [VERIFY dengan auditor]
    functional_currency: "IDR"
    reporting_currencies: [IDR, USD]
    fiscal_year_start_month: 1
    period_type: "monthly"        # 12 periode + 1 adjustment period (P13)
    rounding: { amount: 0, display: "thousand|million" }
    fx_rate_source: "BI_JISDOR"   # [VERIFY]
  tax:                            # seluruh nilai [VERIFY] terhadap regulasi terkini
    ppn_rate: 0.12
    ppn_dpp_factor: 0.9166667     # DPP nilai lain 11/12 untuk barang/jasa non-mewah
    pph23_service_rate: 0.02
    pph21_method: "TER"
    pph_badan_rate: 0.22
    pph_badan_31e_facility: true
    e_invoice_platform: "CORETAX"
  payroll:
    bpjs_kesehatan: { employer: 0.04, employee: 0.01, cap_param: "BPJS_KES_CAP" }
    bpjs_tk: { jkk: "by_risk_class", jkm: 0.003, jht_er: 0.037, jht_ee: 0.02, jp_er: 0.02, jp_ee: 0.01, jp_cap_param: "JP_CAP" }
  reporting_cycles: [DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL]
  close_calendar:
    monthly_soft_close_wd: 3      # hari kerja ke-3
    monthly_hard_close_wd: 5
    quarterly_hard_close_wd: 10
    annual_hard_close_wd: 30
    audit_ready_days_after_ye: 60
  timezone: "Asia/Jakarta"
  holiday_calendar: "ID_NATIONAL + company_collective_leave"
  environments: [DEV, INT, UAT_SIM, STAGING, PROD]
  ui:
    theme: "INDIA Vivid"
    default_mode: "light"
    language: [id-ID, en-US]
  security:
    asvs_level: 2
    mfa_required_roles: ["EXEC", "FIN", "ADMIN", "SEC", "PRIVILEGED"]
    session_idle_min: 30
    session_absolute_hours: 12
1. Mandat v3.0 dan Delta terhadap v2.0
Mandat v3.0: INDIA menjadi Enterprise Operating System RTI yang menjalankan seluruh proses dari aktivitas teknis operasional (scoping, delivery, timesheet, tiket, SOC, training) sampai laporan keuangan harian hingga tahunan, dengan struktur organisasi yang bisa tumbuh tanpa ubah kode. Seluruh prinsip v2.0 tetap berlaku: REUSE, AUDIT, INTEGRATE, IMPROVE, AUTOMATE, VALIDATE, SECURE, DEPLOY.
Area
v2.0
v3.0 (wajib)
Identitas perusahaan
Hardcoded "Technotama"
Parameter company.*; default RTI; multi-entity siap onboarding
Struktur organisasi
Hierarki statis 7 level
Organization-as-Data: tipe unit, level, dan relasi dikonfigurasi; reorganisasi berbasis effective date
Role
Daftar role tetap
Role template + scope binding ke unit; role baru tanpa deploy
Lini bisnis
Fokus cybersecurity
Tambahan Software Development, IT Managed Support, Training Academy & Partnership, Technology Trading
Akuntansi
Daftar fitur Finance
Operations-to-Ledger engine dengan posting rules terkonfigurasi, subledger, dan rekonsiliasi otomatis
Laporan
Katalog laporan
Siklus D/W/M/Q/S/A dengan close calendar, checklist, dan approval per periode
Formula
Contoh KPI
Formula library terversi (akuntansi, proyek, layanan, pajak) dengan unit test per formula
Desain
Navy gelap
Tema INDIA Vivid: cerah, fresh, aksesibel, dengan dark mode
Keamanan
Daftar kontrol
Policy engine RBAC+ABAC+SoD terpusat, ASVS L2, UU PDP, ISO 27001:2022 mapping
Ketentuan mutlak tambahan:
• Tidak ada nama perusahaan, unit, role, akun GL, tarif pajak, atau ambang approval yang di-hardcode di kode aplikasi.
• Semua angka keuangan di dashboard harus dapat di-drill sampai jurnal dan dokumen sumbernya.
• Setiap formula punya ID, versi, effective date, owner, dan test case dengan nilai ekspektasi.
• Rename istilah lama (ICOP, DefendIT360, Technotama) di UI menjadi label yang diambil dari parameter, melalui migrasi terkontrol.
2. Organization-as-Data: Struktur Organisasi RTI yang Parameterized
Struktur organisasi disimpan sebagai data berversi, bukan kode: unit baru, pemecahan direktorat, atau entitas baru cukup ditambahkan lewat menu M02 dengan approval, lalu RBAC, approval line, cost center, budget, dan laporan otomatis mengikuti. Seed di bawah adalah struktur awal RTI berdasarkan lini bisnisnya; agent wajib mengonfirmasi struktur aktual ke Business Owner sebelum UAT.
2.1 Model data organisasi
• org_unit_type — tipe unit yang dapat dikonfigurasi: HOLDING, LEGAL_ENTITY, DIRECTORATE, DIVISION, DEPARTMENT, UNIT, TEAM, SQUAD, BRANCH, PROJECT_ORG, PARTNER_ORG. Setiap tipe punya allowed_parent_types, can_own_budget, can_be_profit_center, can_hold_employees.
• org_unit — id, code, name, type, parent_id, legal_entity_id, head_position_id, cost_center_code, profit_center_code, location_id, currency, valid_from, valid_to, status, version.
• org_closure — closure table (ancestor, descendant, depth) untuk query hierarki cepat dan scope ABAC; dibangun ulang otomatis setiap perubahan.
• position — jabatan terpisah dari orang: position_id, org_unit_id, title, grade, reports_to_position_id, is_head, headcount_budget.
• assignment — orang ke jabatan dengan valid_from/valid_to, mendukung acting, PLT, dan rangkap jabatan.
• org_change_request — reorganisasi (create, rename, move, merge, split, close) dengan impact analysis: user terdampak, role binding, approval line, cost center, budget, transaksi terbuka.
• Matrix organization: org_relation (FUNCTIONAL, PROJECT, SOLID_LINE, DOTTED_LINE) untuk karyawan yang melapor ke lebih dari satu atasan.
2.2 Seed struktur RTI (default, dapat diubah)
ORG_SEED:
  - { code: RTI, type: HOLDING, name: "PT Riset Teknologi Indonesia" }
  - { code: RTI-LE01, type: LEGAL_ENTITY, parent: RTI, name: "PT Riset Teknologi Indonesia", profit_center: true }
  - { code: BOD, type: DIRECTORATE, parent: RTI-LE01, name: "Board of Directors / Office of CEO" }
  - { code: DIR-COM, type: DIRECTORATE, parent: RTI-LE01, name: "Commercial & Growth" }
  -   { code: DIV-MKT, type: DIVISION, parent: DIR-COM, name: "Marketing & Partnership" }
  -   { code: DIV-SAL, type: DIVISION, parent: DIR-COM, name: "Sales & Account Management" }
  -   { code: DIV-BID, type: DIVISION, parent: DIR-COM, name: "Presales, Tender & Bid" }
  - { code: DIR-OPS, type: DIRECTORATE, parent: RTI-LE01, name: "Delivery & Operations" }
  -   { code: DIV-CYB, type: DIVISION, parent: DIR-OPS, name: "Cybersecurity Services", profit_center: true }
  -     { code: DEP-VAPT, type: DEPARTMENT, parent: DIV-CYB }
  -     { code: DEP-SOC, type: DEPARTMENT, parent: DIV-CYB, name: "SOC/MDR" }
  -     { code: DEP-DFIR, type: DEPARTMENT, parent: DIV-CYB, name: "DFIR & CTI" }
  -   { code: DIV-GRC, type: DIVISION, parent: DIR-OPS, name: "Governance, Risk & Advisory", profit_center: true }
  -   { code: DIV-SWE, type: DIVISION, parent: DIR-OPS, name: "Software Engineering & Product", profit_center: true }
  -   { code: DIV-ITS, type: DIVISION, parent: DIR-OPS, name: "IT Managed Support & Service Desk", profit_center: true }
  -   { code: DIV-ACD, type: DIVISION, parent: DIR-OPS, name: "Training & Cybersecurity Academy", profit_center: true }
  -   { code: DIV-PMO, type: DIVISION, parent: DIR-OPS, name: "PMO & Resource Management" }
  - { code: DIR-FIN, type: DIRECTORATE, parent: RTI-LE01, name: "Finance, Procurement & Corporate" }
  -   { code: DEP-ACC, type: DEPARTMENT, parent: DIR-FIN, name: "Accounting & Tax" }
  -   { code: DEP-TRS, type: DEPARTMENT, parent: DIR-FIN, name: "Treasury & Collection" }
  -   { code: DEP-PRC, type: DEPARTMENT, parent: DIR-FIN, name: "Procurement & Vendor" }
  -   { code: DEP-HCM, type: DEPARTMENT, parent: DIR-FIN, name: "Human Capital" }
  -   { code: DEP-GA, type: DEPARTMENT, parent: DIR-FIN, name: "General Affairs & Asset" }
  - { code: DIR-GOV, type: DIRECTORATE, parent: RTI-LE01, name: "Risk, Compliance, Legal & Internal Audit" }
  - { code: DIR-TEC, type: DIRECTORATE, parent: RTI-LE01, name: "Internal IT & Information Security" }
  - { code: PRT-ADTC, type: PARTNER_ORG, parent: DIV-ACD, name: "AD Training Center (partner)" }
2.3 Aturan turunan otomatis
Objek
Diturunkan dari
Aturan
Cost center
org_unit.cost_center_code
Default = kode unit; unit tanpa budget mewarisi cost center parent
Profit center
can_be_profit_center
Revenue dan direct cost dialokasikan ke profit center terdekat ke atas
Approval line
position.reports_to + approval policy
Diresolusi saat submit, disimpan sebagai snapshot di transaksi
Data scope
org_closure
Scope OWN_UNIT, UNIT_AND_BELOW, LEGAL_ENTITY, ALL
Budget owner
Head position unit
Berpindah otomatis saat assignment berubah
Dashboard filter
Hierarki unit
Roll-up nilai dari descendant ke ancestor
2.4 Proses reorganisasi
1. HR/Corporate membuat org_change_request dengan effective date.
2. Sistem menjalankan impact analysis dan menampilkan daftar dampak.
3. Approval: Head unit terdampak, CFO (jika menyentuh cost/profit center), CEO.
4. Pada effective date, scheduled job menerapkan perubahan, membangun ulang org_closure, memindahkan role binding, dan menutup versi lama.
5. Transaksi historis tetap merujuk versi unit saat transaksi dibuat; laporan bisa ditampilkan as-was atau as-is (restated mapping).
Onboarding legal entity baru (misalnya PT Technotama Artha Raya) memakai wizard: data legal, NPWP, COA template, periode fiskal, mata uang, rekening bank, struktur awal, role binding, dan intercompany mapping.
3. RBAC + ABAC + SoD yang Parameterized
Setiap keputusan akses dihitung oleh satu policy engine di server: izin = role template yang di-bind ke scope organisasi, dipersempit oleh atribut (kepemilikan, klasifikasi, status transaksi, nilai, environment), lalu diperiksa terhadap aturan SoD. Sidebar dan tombol hanya mencerminkan hasil engine ini, bukan sumber kebenaran.
3.1 Permission grammar
Format: <module>.<resource>.<action>[:<qualifier>]
• Action baku: view, create, edit, delete, submit, approve, reject, post, reverse, close, reopen, export, import, assign, configure, impersonate.
• Qualifier: own, unit, unit_tree, entity, all, masked, limit:<param>.
• Contoh: fin.journal.post:entity, crm.opportunity.edit:own, hr.payroll.view:masked, prc.po.approve:limit:PO_APPROVAL_L2.
3.2 Model data akses
• permission (katalog, di-generate dari registry route/API saat build, tidak boleh ada endpoint tanpa permission).
• role_template (kumpulan permission, berversi), role_binding (user/position + role_template + org_scope + valid_from/to + granted_by + approved_by).
• Binding ke position lebih diutamakan daripada ke user, sehingga mutasi jabatan otomatis memindahkan akses (Joiner-Mover-Leaver).
• abac_policy dalam bentuk deklaratif (JSON/CEL), contoh: invoice berstatus POSTED tidak bisa di-edit siapa pun; dokumen klasifikasi RESTRICTED hanya untuk member proyek; data payroll hanya HCM dan CFO.
• approval_limit per role dan mata uang, diambil dari parameter, bukan kode.
3.3 Role template default
Kelompok
Role template
Scope default
MFA
Executive
CEO, COO, CFO, CTO, CISO
entity / all
Wajib
Commercial
MKT_MGR, MKT_OFF, SALES_MGR, AE, PRESALES, BID_MGR, PARTNER_MGR
unit_tree / own
Sesuai risiko
Delivery
PMO_HEAD, PM, DELIVERY_MGR, RESOURCE_MGR, TRAINER, TRAINING_COORD
unit_tree / project
Sesuai risiko
Technical
VAPT_LEAD, PENTESTER, SOC_MGR, SOC_ANALYST, DFIR, CTI, GRC_CONSULTANT, SWE_LEAD, DEVELOPER, QA_ENGINEER, SUPPORT_ENGINEER
project / own
Wajib untuk evidence
Corporate
FIN_MGR, ACCOUNTANT, TAX_OFFICER, TREASURY, AR_OFFICER, AP_OFFICER, PROCUREMENT, HR, PAYROLL, ASSET_MGR, LEGAL
entity
Wajib
Assurance
RISK_MGR, COMPLIANCE, INTERNAL_AUDITOR (read-only all), DPO, INDEPENDENT_APPROVER
all (read)
Wajib
Admin
SUPER_ADMIN (break-glass), SYS_ADMIN, SEC_ADMIN, INTEGRATION_ADMIN
all
Wajib + PAM
External
CUSTOMER_USER, CUSTOMER_APPROVER, VENDOR_USER, EXTERNAL_CONSULTANT, PARTNER_USER
own tenant
Wajib
Role baru dibuat dengan meng-clone template, mengubah permission, lalu melewati approval Security Admin dan pemilik proses. Delapan role login existing dipetakan ke template ini melalui tabel legacy_role_map.
3.4 Segregation of Duties (rule engine)
Aturan SoD disimpan sebagai data sod_rule(conflict_a, conflict_b, severity, mitigation) dan diperiksa pada tiga titik: saat role binding dibuat, saat transaksi di-approve (approver tidak boleh sama dengan maker pada objek yang sama), dan pada review akses periodik.
ID
Konflik
Severity
SOD-01
Create vendor master vs approve/release payment
Critical
SOD-02
Create PO vs record goods receipt untuk PO yang sama
High
SOD-03
Post journal vs approve period close
Critical
SOD-04
Create invoice customer vs record cash receipt
High
SOD-05
Edit payroll master vs approve payroll run
Critical
SOD-06
Grant role vs hold that role
Critical
SOD-07
Set pricing/discount vs approve own quotation
High
SOD-08
Pentester mengubah finding vs QA approve finding yang sama
Medium
SOD-09
Developer deploy ke PROD vs approve release
Critical
3.5 Kontrol akses wajib lain
• Delegation dan acting dengan masa berlaku, tetap tercatat atas nama delegator dan delegate.
• Break-glass account: tersegel, alert real-time ke CISO, review 24 jam.
• User access review triwulanan per unit (dibuat otomatis oleh job, tanda tangan Head unit).
• Field-level security: gaji, NIK, rekening, evidence klien di-mask sesuai permission :masked.
• Tenant isolation: setiap query wajib melewati repository layer yang menyuntikkan filter legal_entity_id dan scope; test otomatis IDOR untuk seluruh endpoint.
4. Peta Modul M01–M24
M01–M20 dari v2.0 dipertahankan seluruhnya (submenu, fungsi, dashboard, laporan); v3.0 menambah empat modul untuk lini bisnis RTI dan pusat close keuangan, serta menambah fungsi pada modul existing yang tercantum di kolom kanan. Menu ditampilkan dari tabel menu_registry yang terikat ke permission, sehingga modul dapat diaktifkan per legal entity.
Kode
Modul
Tambahan wajib v3.0
M01
Executive Command Center
Periodic Pack D/W/M/Q/S/A, flash report harian, CEO cockpit mobile
M02
Organization & Master Data
Org-as-Data, reorganisasi berversi, onboarding legal entity, matrix org
M03
Marketing & Demand Generation
Partnership campaign untuk Academy, attribution multi-touch
M04
CRM, Sales & Account
Opportunity per business line, cross-sell matrix, account plan tahunan
M05
Tender & Bid
Integrasi LPSE/SPSE sebagai sumber manual/terjadwal, jaminan penawaran/pelaksanaan
M06
Service Catalog & Scoping
Template scoping untuk Software (FP/story point), IT Support (device/user/site), Training (batch/peserta)
M07
CPQ, BOQ, Pricing
Pricing model: fixed fee, T&M, retainer, subscription, per-seat, per-participant, revenue share
M08
Contract & Legal
Performance obligation register (dasar pengakuan pendapatan), jaminan bank
M09
Project & PSA
EVM (CPI/SPI), EAC/ETC, POC, WIP, unbilled revenue otomatis
M10
Cybersecurity Operations
Tetap seperti v2.0 (VAPT, SOC/MDR, DFIR, CTI, GRC, Training)
M11
Service Desk
Shared service desk untuk Cyber dan IT Support, SLA kalender kerja
M12
Procurement-to-Pay
Commitment accounting, accrual GRNI otomatis
M13
Finance ERP
Operations-to-Ledger engine, subledger, multi-entity, intercompany
M14
HR & Resource
Payroll ke GL, cost rate per karyawan, BPJS, PPh 21 TER
M15
Asset, License, Subscription
Depresiasi otomatis, amortisasi prepaid lisensi
M16
FlexGuard Managed Service
MRR/ARR, usage billing, deferred revenue per entitlement
M17
Budget & Planning
Driver-based budget, rolling forecast 12+6 bulan
M18
Reporting, BI & AI
Report scheduler per siklus, semantic layer, AI narrative
M19
Document, Risk, Compliance, Audit
Evidence close, PBC list untuk auditor eksternal
M20
Administration & Integration
Parameter center, policy engine, job monitor
M21
Software Engineering & Product Delivery
Baru
M22
IT Managed Services & Field Support
Baru
M23
Training Academy & Partnership
Baru
M24
Financial Close & Statutory Reporting Center
Baru
M21 — Software Engineering & Product Delivery
• Submenu: Product Backlog, Epic/Story, Sprint Planning, Sprint Board, Release, Environment Register, Code Repository Link, Defect, Test Case, UAT Sign-off, Change Request, Maintenance Contract, Capitalization Tracker.
• Fungsi: estimasi story point/function point ke man-day; sinkronisasi issue dan PR dari GitHub/GitLab via webhook; timesheet per story; burn-down/burn-up; velocity; kapitalisasi biaya pengembangan produk internal sesuai kriteria aset takberwujud (fase riset di-expense, fase pengembangan dikapitalisasi bila memenuhi kriteria); warranty dan maintenance billing.
• Laporan: Sprint Report, Release Notes, Defect Density, Velocity Trend, Project Margin per Release, Capitalized Development Cost.
M22 — IT Managed Services & Field Support
• Submenu: Managed Contract, Customer Site & Device Register, CMDB Lite, Preventive Maintenance Schedule, Work Order, Field Visit & Check-in, Spare Part, Remote Monitoring Alert, SLA Credit, Monthly Service Report.
• Fungsi: kontrak per user/device/site; jadwal PM otomatis; work order dari tiket; check-in lokasi teknisi (dengan persetujuan karyawan); konsumsi spare part ke inventory dan COGS; perhitungan SLA credit/penalti ke invoice; recurring billing.
• Laporan: SLA Performance per Site, PM Compliance, Work Order Aging, Device Health, Service Profitability.
M23 — Training Academy & Partnership
• Submenu: Program Catalog, Curriculum & Module, Batch/Class, Trainer Pool & Fee, Venue & Logistik, Participant Registration & Payment, Attendance, Pre/Post Test, Certificate (nomor unik + QR verifikasi), Evaluation, Partner Agreement, Revenue Share Settlement, Corporate In-house Order.
• Fungsi: pendaftaran publik dan in-house; invoice per peserta atau per batch; deferred revenue sampai batch selesai; biaya langsung per batch (trainer, venue, konsumsi, sertifikasi); perhitungan Net Distributable Revenue dan bagi hasil partner berdasarkan parameter (default RTI 60% : partner 40%); statement bagi hasil ke partner portal.
• Laporan: Batch P&L, Participant Funnel, Trainer Performance, Certificate Register, Partner Settlement Statement, NPS/Kirkpatrick Level 1–2.
M24 — Financial Close & Statutory Reporting Center
• Submenu: Close Calendar, Close Checklist, Subledger Reconciliation, Accrual Engine, Allocation Engine, FX Revaluation, Intercompany Matching & Elimination, Consolidation, Adjustment (P13), Financial Statement Builder, Notes to FS, Tax Provision & Deferred Tax, SPT Masa/Tahunan Workpaper, Audit PBC, Management Pack, Close Sign-off.
• Fungsi: dijelaskan detail di Bagian 5–7.
• Laporan: Close Status Board, Reconciliation Exceptions, Consolidated FS, FS per Entity, Tax Workpaper, Audit Adjustment Log.
5. Operations-to-Ledger Engine
Setiap aktivitas operasional yang berdampak keuangan menghasilkan satu accounting_event, lalu posting engine mengubahnya menjadi jurnal seimbang memakai posting rule yang dikonfigurasi Finance. User operasional tidak pernah membuat jurnal manual; jurnal manual hanya untuk Finance dengan maker-checker.
5.1 Alur
1. Transaksi sumber disimpan (timesheet approved, GR, invoice, payroll run, BAST, usage record, batch selesai).
2. Dalam satu DB transaction, sistem menulis accounting_event (outbox) dengan event_type, source_doc, entity, amount, currency, dimensions, idempotency_key.
3. Posting worker mengambil event, memilih posting_rule aktif berdasarkan event_type + kondisi (business line, kontrak, pajak), lalu menulis journal_header + journal_line ke subledger dan GL.
4. Validasi: debit = kredit per mata uang, periode terbuka, akun aktif, dimensi wajib terisi. Gagal = event masuk antrean exception, tidak hilang.
5. Rekonsiliasi otomatis subledger ke GL control account setiap malam.
5.2 Dimensi wajib per journal line
legal_entity, account, org_unit/cost_center, profit_center, business_line, project, customer, vendor, employee, contract, product/service, intercompany_partner, tax_code, currency, fx_rate_id. Dimensi wajib per akun diatur di account_dimension_rule.
5.3 Katalog posting rule default
Event
Debit
Kredit
Catatan
TIMESHEET_APPROVED (proyek)
WIP / Project Cost
Payroll Cost Absorbed
Tarif = cost rate karyawan berlaku
PROJECT_PROGRESS_RECOGNIZED
Unbilled Revenue (contract asset)
Revenue
Metode POC input (cost-to-cost)
MILESTONE_INVOICED
Accounts Receivable
Unbilled Revenue / Contract Liability; PPN Keluaran
PPN dari parameter
ADVANCE_INVOICED
Accounts Receivable
Contract Liability; PPN Keluaran
Uang muka/termin di depan
SUBSCRIPTION_PERIOD_ELAPSED
Contract Liability
Revenue
Ratable harian/bulanan
CASH_RECEIVED
Bank; Prepaid PPh 23
Accounts Receivable
PPh 23 dipotong pelanggan
GOODS_RECEIVED (belum invoice)
Inventory / Expense / Asset
GRNI Accrual

VENDOR_INVOICE_MATCHED
GRNI Accrual; PPN Masukan
Accounts Payable; Utang PPh 23
Three-way match lulus
PAYMENT_RELEASED
Accounts Payable
Bank
Setelah maker-checker
PAYROLL_POSTED
Salary Expense / Absorbed Cost; BPJS Expense
Salary Payable; Utang PPh 21; Utang BPJS

DEPRECIATION_RUN
Depreciation Expense
Accumulated Depreciation
Bulanan
PREPAID_AMORTIZED
Expense
Prepaid (lisensi, asuransi, sewa jangka pendek)

TRAINING_BATCH_COMPLETED
Contract Liability
Training Revenue
Deferred sampai batch selesai
PARTNER_SHARE_ACCRUED
Revenue Share Expense / Cost of Revenue
Payable to Partner
Berdasarkan NDR
SLA_CREDIT_ISSUED
Revenue (contra)
AR / Contract Liability

ECL_PROVISION
Impairment Expense
Allowance for ECL
Bulanan dari provision matrix
FX_REVALUATION
Unrealized FX Loss/AR-AP
AR-AP/Unrealized FX Gain
Akhir bulan
INTERCOMPANY_CHARGE
IC Receivable / Expense
Revenue / IC Payable
Dieliminasi saat konsolidasi
PERIOD_ACCRUAL
Expense
Accrued Expense
Auto-reverse hari pertama periode berikut
Nama dan nomor akun di atas adalah peran akun (account_role), dipetakan ke COA aktual tiap legal entity melalui account_role_map. COA template default (SAK EP, 5 digit) di-seed dan dapat diubah Finance.
5.4 Aturan integritas
• Jurnal POSTED immutable; koreksi hanya via reversal + jurnal baru, keduanya menyimpan reversal_of_id dan alasan.
• Idempotency: event dengan key yang sama tidak boleh menghasilkan jurnal kedua.
• Back-dated posting ke periode tertutup ditolak; posting ke P13 hanya role FIN_MGR dengan approval CFO.
• Setiap angka laporan keuangan dapat di-drill: FS line → akun → jurnal → event → dokumen sumber → attachment.
6. Siklus Pelaporan D/W/M/Q/S/A dan Close Calendar
Sistem menjalankan enam siklus pelaporan secara terjadwal: harian dan mingguan bersifat operasional-manajerial (soft numbers, tanpa lock periode), sedangkan bulanan sampai tahunan adalah siklus close resmi dengan checklist, rekonsiliasi, sign-off, dan lock periode. Setiap paket laporan menampilkan status data: PRELIMINARY, SOFT CLOSED, HARD CLOSED, AUDITED.
Siklus
Jadwal default (parameter)
Proses otomatis
Output utama
Penerima
Sign-off
Harian
06.00 WIB setiap hari kerja
Posting event tertunda, import mutasi bank, auto-match, cash position, AR/AP due, SLA breach, timesheet missing
Daily Flash: kas & bank, penerimaan/pembayaran, booking & invoicing hari ini, pipeline baru, tiket/insiden kritis, utilisasi kemarin
CEO, CFO, COO, Head unit
Tidak (informasi)
Mingguan
Senin 07.00 WIB
13-week cash forecast roll, AR aging + collection list, pipeline movement, project health, timesheet compliance, PO terbuka
Weekly Business Review per business line, Collection Plan, Resource Plan 4 minggu
BOD, Head unit
Head unit konfirmasi commentary
Bulanan
Soft close WD+3, hard close WD+5
Accrual & auto-reversal, depresiasi, amortisasi, POC revenue, deferred revenue release, ECL, FX reval, payroll, alokasi overhead, IC matching, rekonsiliasi subledger & bank
Laporan posisi keuangan, laba rugi (by nature dan by business line), arus kas, TB, Management Pack, Project P&L, Budget vs Actual, SPT Masa PPN/PPh workpaper
BOD, Komisaris (ringkas)
Accountant → FIN_MGR → CFO
Triwulanan
WD+10 setelah akhir kuartal
Semua proses bulanan + review estimasi (EAC proyek, ECL matrix, provisi), user access review, rolling forecast update
Quarterly FS lengkap, KPI scorecard, forecast revisi, Risk & Compliance report, laporan ke bank/investor bila ada covenant
BOD, Komisaris, pemegang saham
CFO → CEO
Semesteran
WD+15 setelah Juni
Semua proses triwulanan + impairment indicator review, review kebijakan akuntansi, mid-year budget revision
Interim FS H1 dengan catatan ringkas, mid-year business review, budget revisi
BOD, Komisaris, RUPS bila diminta
CFO → CEO → Komisaris
Tahunan
Hard close WD+30, audit-ready D+60
Year-end closing entries, tutup akun nominal ke laba ditahan, fiscal correction, PPh badan & pajak tangguhan, physical count aset/inventory, konfirmasi saldo AR/AP, konsolidasi
Laporan keuangan lengkap + CALK, workpaper SPT Tahunan Badan, PBC list auditor, Annual Report pack, budget tahun depan
BOD, Komisaris, RUPS, auditor eksternal, DJP
CFO → CEO → Komisaris; auditor
6.1 Close checklist bulanan (template, dapat dikonfigurasi)
WD
Tugas
Owner
Kontrol
WD-2
Cut-off reminder ke seluruh unit (timesheet, GR, BAST, invoice vendor)
FIN_MGR
Notifikasi otomatis
WD0
Timesheet lock, payroll posted
HR, PM
Timesheet compliance ≥ 98%
WD+1
Posting depresiasi, amortisasi, deferred revenue, POC
Sistem + Accountant
Exception queue kosong
WD+1
Bank reconciliation semua rekening
Treasury
Selisih = 0 atau dijelaskan
WD+2
Accrual (GRNI, utilitas, bonus, cuti), ECL, FX reval
Accountant
Review FIN_MGR
WD+2
IC matching dan konfirmasi
Accountant tiap entitas
Selisih IC = 0
WD+3
Soft close: subledger AR/AP/Asset/Payroll/Inventory vs GL
Sistem
Selisih = 0
WD+3
Project review: EAC, loss provision kontrak merugi
PMO + Finance
Sign-off PM
WD+4
Flux analysis (variance > threshold wajib commentary)
Accountant
Threshold parameter, default 10% dan Rp 50 juta
WD+4
Pajak masa: PPN, PPh 21/23/4(2) workpaper
TAX_OFFICER
Rekonsiliasi ke GL
WD+5
Review, approval, hard close, lock periode
FIN_MGR → CFO
SoD: preparer ≠ approver
WD+5
Publish Management Pack dan dashboard periode
Sistem
Status HARD CLOSED
Reopen periode hanya oleh CFO dengan alasan, otomatis membuat audit event, menurunkan status laporan terkait menjadi RESTATED, dan mengirim notifikasi ke penerima laporan sebelumnya.
6.2 Report scheduler
• Setiap laporan didefinisikan di report_definition (ID, owner, siklus, parameter, format PDF/XLSX/CSV, distribusi, klasifikasi).
• Distribusi via in-app inbox dan email dengan link terautentikasi (bukan lampiran data sensitif).
• Snapshot laporan yang diterbitkan disimpan immutable (hash SHA-256) di Document Vault sebagai evidence.
7. Formula Library dan Model Perhitungan
Semua perhitungan memakai satu formula library terversi di server (formula_registry), dipanggil oleh transaksi, laporan, dan dashboard yang sama, sehingga tidak ada dua angka berbeda untuk satu KPI. Perhitungan uang memakai decimal fixed-point (integer sen/rupiah atau DECIMAL), tidak pernah floating point.
formula_registry:
  id: "FIN-REV-POC-01"
  name: "Revenue POC cost-to-cost"
  version: 1
  effective_from: "2027-01-01"
  owner_role: "FIN_MGR"
  inputs: [contract_price, cost_to_date, estimated_total_cost, revenue_recognized_to_date]
  output: revenue_this_period
  rounding: "HALF_UP, 0 decimal IDR"
  tests: [ { inputs: {...}, expected: ... } ]
  reference: "PSAK 115 / SAK EP setara  [VERIFY sesuai framework]"
7.1 Pengakuan pendapatan per model kontrak
Model
Dasar pengakuan
Business line
Fixed-price proyek (VAPT, GRC, software)
Over time, input method cost-to-cost; point-in-time bila tidak memenuhi kriteria over time
CYB, GRC, SWE
Time & Material
Jam approved × rate kontrak
Semua jasa
Subscription / retainer / managed service
Ratable sepanjang periode layanan
SOC, ITS, FlexGuard
Usage / kredit
Saat kredit dikonsumsi; kredit kedaluwarsa diakui sesuai pola breakage
FlexGuard
Training publik/in-house
Saat batch selesai (atau per sesi bila kontrak per sesi)
ACD
Penjualan lisensi/hardware OEM
Point-in-time saat kontrol beralih; uji principal vs agent
Tech trading
Bundling
Alokasi harga transaksi ke performance obligation berdasarkan standalone selling price relatif
Semua
\text{Revenue}_{t} = \text{Contract Price} \times \frac{\text{Cost to Date}_{t}}{\text{EAC}_{t}} - \text{Revenue Recognized}_{t-1}
\text{Contract Asset (Unbilled)} = \max(0,\ \text{Revenue Recognized} - \text{Amount Billed}) ,\quad \text{Contract Liability} = \max(0,\ \text{Amount Billed} - \text{Revenue Recognized})
Kontrak merugi (onerous): bila EAC > nilai kontrak, seluruh kerugian yang diperkirakan diakui segera sebagai provisi.
7.2 Proyek dan resource
ID
Metrik
Formula
PRJ-01
Cost rate karyawan per jam
(Gaji + tunjangan + BPJS employer + benefit + overhead loading) ÷ jam kerja tersedia per bulan
PRJ-02
EAC
Actual Cost + ETC (bottom-up dari PM); alternatif AC + (BAC − EV) ÷ CPI
PRJ-03
Earned Value (EV)
% complete × BAC
PRJ-04
CPI / SPI
EV ÷ AC; EV ÷ PV
PRJ-05
Project gross margin
(Recognized revenue − direct cost) ÷ recognized revenue
PRJ-06
Utilization billable
Approved billable hours ÷ available hours (kalender kerja dikurangi libur dan cuti)
PRJ-07
Realization rate
Billed value ÷ (billable hours × standard rate)
PRJ-08
Backlog
Nilai kontrak − revenue yang sudah diakui
7.3 Keuangan dan treasury
ID
Metrik
Formula
FIN-01
DSO
(Rata-rata AR ÷ revenue kredit periode) × jumlah hari periode
FIN-02
DPO
(Rata-rata AP ÷ pembelian kredit periode) × jumlah hari
FIN-03
Cash conversion cycle
DSO + DIO − DPO
FIN-04
Current ratio / quick ratio
Aset lancar ÷ liabilitas lancar; (kas + AR) ÷ liabilitas lancar
FIN-05
EBITDA
Laba usaha + depresiasi + amortisasi
FIN-06
ECL (provision matrix)
Σ saldo AR per bucket umur × loss rate historis per bucket × faktor forward-looking
FIN-07
Depresiasi garis lurus
(Harga perolehan − nilai residu) ÷ umur manfaat (bulan), prorata bulan perolehan sesuai kebijakan
FIN-08
13-week cash forecast
Saldo awal + penerimaan terjadwal (AR due × collection probability per bucket) − pembayaran terjadwal (AP due, payroll, pajak, PO commitment)
FIN-09
Budget variance
Actual − Budget; dipecah price/rate variance dan volume variance
FIN-10
FX revaluation
Saldo valas × (kurs penutupan − kurs tercatat)
7.4 Layanan siber dan commercial
ID
Metrik
Formula
SVC-01
MTTA / MTTR
Rata-rata (acknowledged − created); rata-rata (resolved − created), jam kerja atau 24×7 sesuai SLA
SVC-02
SLA compliance
Kasus eligible selesai dalam SLA ÷ kasus eligible selesai
SVC-03
VAPT risk score
Skor CVSS v4.0 × faktor kritikalitas aset (parameter)
SVC-04
Remediation rate
Finding closed (verified retest) ÷ total finding per severity
COM-01
Weighted pipeline
Σ nilai opportunity × probabilitas stage
COM-02
Win rate
Won ÷ (won + lost) pada periode closing
COM-03
MRR / ARR / churn
Σ recurring revenue bulanan aktif; MRR × 12; MRR hilang ÷ MRR awal
ACD-01
Net Distributable Revenue
Revenue batch − biaya langsung yang disepakati di perjanjian (trainer, venue, konsumsi, sertifikasi, pajak final bila ada)
ACD-02
Bagi hasil partner
NDR × partner_share (default 0,40); bagian RTI = NDR × rti_share (default 0,60)
7.5 Pajak (semua tarif dari parameter, [VERIFY])
• PPN keluaran = DPP × tarif; untuk barang/jasa non-mewah DPP = 11/12 × harga jual sehingga beban efektif 11%. Faktur via Coretax, nomor faktur disimpan di invoice.
• PPh 23 jasa = 2% × bruto jasa (tanpa PPN); bukti potong dari pelanggan direkonsiliasi ke akun prepaid PPh 23.
• PPh 21 bulanan = penghasilan bruto × tarif efektif rata-rata (TER) kategori PTKP; Desember = PPh setahun (tarif progresif pasal 17) − PPh yang sudah dipotong Jan–Nov.
• PPh Badan = penghasilan kena pajak (laba komersial ± koreksi fiskal) × tarif, dengan fasilitas pasal 31E bila memenuhi syarat; pajak tangguhan atas beda temporer bila framework mewajibkan.
• Setiap kode pajak punya mapping akun, tarif, effective date, dan test case.
8. Dashboard dan KPI Engine Parameterized
Dashboard dibangun dari definisi KPI dan widget yang disimpan sebagai data, sehingga unit baru otomatis punya dashboard dengan roll-up ke atas, dan setiap angka menampilkan sumber, waktu refresh, status periode, dan link drill-down.
kpi_definition:
  id: "KPI-FIN-DSO"
  formula_ref: "FIN-01"
  grain: [legal_entity, business_line, org_unit, customer]
  periods: [MTD, QTD, HTD, YTD, rolling_12m]
  target_source: "budget_version:approved"
  thresholds: { green: "<=45", amber: "46-60", red: ">60" }   # parameter per entitas
  direction: "lower_is_better"
  owner_role: "FIN_MGR"
  security: "fin.kpi.view:entity"
  drill_to: "report:AR_AGING"
8.1 Workspace per persona
Persona
Halaman pertama setelah login
KPI inti
CEO/BOD
Executive Cockpit
Revenue vs budget, gross margin, EBITDA, kas, backlog, win rate, SLA kritikal, top 5 risiko
CFO/Finance
Finance Hub + Close Board
Kas & 13-week forecast, AR aging/DSO, AP due, status close, exception posting, pajak jatuh tempo
Sales/Marketing
My Pipeline
Pipeline tertimbang, target vs actual, aktivitas overdue, MQL→SQL
PM/PMO
My Projects
CPI/SPI, margin proyek, milestone due, timesheet pending, risiko
Engineer/Analyst
My Work
Tugas hari ini, tiket/alert ter-assign, SLA timer, timesheet minggu ini
SOC Manager
SOC Board
Alert backlog, MTTA/MTTR, insiden terbuka per severity, shift coverage
Academy
Academy Board
Batch berjalan, peserta terdaftar vs kuota, batch P&L, settlement partner
HR
People Hub
Headcount, utilisasi, sertifikasi kedaluwarsa, cuti, payroll status
Auditor/Compliance
Assurance Board
Temuan terbuka, SoD conflict, access review, evidence close
Customer/Vendor/Partner
Portal Home
Proyek/PO/settlement milik mereka saja
8.2 Standar komponen
• Baris atas: 4–6 KPI card dengan nilai, delta vs periode lalu, delta vs target, sparkline, dan badge status periode.
• Baris tengah: tren (line), komposisi (stacked bar 100%), funnel, aging (bar per bucket), bridge/waterfall untuk perubahan laba atau kas.
• Baris bawah: action list (approval, overdue, exception) yang bisa dieksekusi tanpa pindah halaman.
• Filter global: periode, legal entity, business line, unit (tree picker), customer, proyek; disimpan sebagai saved view.
• Mode presentasi untuk rapat BOD dan export PDF berformat board pack.
• Pre-aggregation tabel ringkasan (fact_* dan agg_*) di-refresh oleh job; dashboard tidak menjalankan query berat ke tabel transaksi.
9. Design System "INDIA Vivid"
Tampilan baru memakai latar terang yang bersih dengan aksen gradasi indigo ke cyan dan warna per lini bisnis yang cerah, tetap memenuhi kontras WCAG 2.2 AA; navy gelap v2.0 hanya dipakai di dark mode. Semua warna, radius, dan ukuran adalah design token (CSS variables + Tailwind theme), sehingga tema bisa diganti lewat parameter ui.theme tanpa ubah komponen.
9.1 Palet warna (light mode)
Token
Hex
Pemakaian
Catatan kontras
--brand-primary
#4F46E5
Tombol utama, link aktif, fokus
Teks putih di atasnya lolos AA
--brand-secondary
#06B6D4
Aksen, highlight, ilustrasi, gradasi
Jangan untuk teks di atas putih
--brand-gradient
#4F46E5 → #06B6D4
Header login, hero card, progress
Dekoratif saja
--accent-violet
#8B5CF6
Badge AI, fitur baru

--bg-app
#F6F7FB
Latar aplikasi

--bg-surface
#FFFFFF
Card, tabel, form

--bg-subtle
#EEF2FF
Baris terpilih, chip filter

--text-primary
#0F172A
Teks utama

--text-secondary
#475569
Teks pendukung
Lolos AA di atas putih
--border
#E2E8F0
Garis card, tabel

--success / text
#10B981 / #047857
Status selesai, positif
Teks pakai versi gelap
--warning / text
#F59E0B / #B45309
Mendekati SLA, perlu perhatian

--danger / text
#F43F5E / #BE123C
Error, breach, kritikal

--info / text
#3B82F6 / #1D4ED8
Informasi

Dark mode: --bg-app #0B1020, --bg-surface #131B2E, --text-primary #E2E8F0, --text-secondary #94A3B8, brand primary dicerahkan ke #818CF8. Status tidak pernah dibedakan hanya dengan warna: selalu ada ikon dan label.
9.2 Warna lini bisnis (chart dan badge, konsisten di semua laporan)
Lini bisnis
Warna
Cybersecurity
#4F46E5 indigo
Governance & Advisory
#8B5CF6 violet
Software Engineering
#3B82F6 blue
IT Managed Support
#14B8A6 teal
Training Academy
#F59E0B amber
Technology Trading
#EC4899 pink
9.3 Tipografi, ruang, bentuk
• Font UI: Plus Jakarta Sans (variable); angka di tabel dan KPI memakai font-variant-numeric: tabular-nums; kode dan hash: JetBrains Mono.
• Skala: body 16px, small 14px (hanya metadata), H1 28px, H2 22px, H3 18px, KPI value 32px; line-height 1,5.
• Spacing grid 4px; radius card 16px, input dan tombol 10px, chip penuh; bayangan lembut 0 1px 2px + 0 8px 24px dengan alpha rendah.
• Ikon Lucide 20px, stroke 1,75.
• Motion 150–200 ms ease-out untuk drawer dan toast; hormati prefers-reduced-motion.
9.4 Pola layout dan komponen
• Sidebar putih dengan grup modul berwarna ikon lini bisnis, collapsible ke rail ikon, favorit, dan pencarian menu; di mobile menjadi bottom navigation 5 item + drawer.
• Top bar: command palette (Ctrl/Cmd+K) untuk cari transaksi, pelanggan, menu, dan aksi cepat; environment badge berwarna (SIMULATION oranye, STAGING ungu, PROD tidak ada badge).
• Halaman list: header + KPI strip + filter bar + tabel server-side + detail drawer kanan; halaman detail: header status dengan stepper workflow, tab (Ringkasan, Item, Dokumen, Approval, Jurnal, Riwayat).
• Form: wizard bertahap untuk proses kompleks (scoping, onboarding entitas, close), field kondisional, autosave draft, validasi inline, ringkasan sebelum submit.
• Empty state dengan ilustrasi ringan dan satu aksi utama; skeleton loading; toast sukses hanya setelah server mengonfirmasi persistensi.
• Halaman login: panel kiri gradasi brand dengan ilustrasi abstrak jaringan aman, panel kanan form SSO/email + MFA, pesan error yang jelas.
• Komponen dibangun dengan shadcn/ui + Radix (aksesibel) dan Recharts/ECharts untuk grafik, mengikuti token di atas.
9.5 Validasi desain
• Lolos audit axe-core otomatis di CI untuk semua halaman utama.
• Usability test dengan minimal 5 pengguna per persona inti; target task success ≥ 90% dan SUS ≥ 75.
• Design token dan komponen didokumentasikan di Storybook dan disimpan di repository.
10. Cybersecurity Baseline dan Penegakan RBAC
Target keamanan: OWASP ASVS 5.0 Level 2 untuk seluruh aplikasi (Level 3 untuk modul Finance payment, IAM, dan Evidence Vault), kontrol dipetakan ke ISO/IEC 27001:2022 Annex A dan UU No. 27/2022 tentang Pelindungan Data Pribadi. Setiap kontrol wajib punya test otomatis atau evidence manual yang tersimpan.
10.1 Titik penegakan otorisasi
1. Edge: Cloudflare WAF, rate limit, bot management, Access untuk area admin dan non-production.
2. Middleware: validasi session/token, MFA claim, environment check, CSRF untuk request berbasis cookie.
3. Route handler: authorize(subject, action, resource) wajib dipanggil; build gagal bila ada route tanpa deklarasi permission (lint rule + test registry).
4. Data-access layer: filter tenant, legal entity, dan scope disuntikkan otomatis; query mentah tanpa scope ditolak code review dan lint.
5. Field layer: masking dan redaksi berdasarkan permission :masked dan klasifikasi data.
6. Workflow layer: status transaksi menentukan aksi yang valid (state machine), approval tidak bisa dilompati lewat API.
10.2 Kontrol utama
Domain
Kontrol wajib
Identitas
SSO OIDC/SAML, MFA (TOTP/WebAuthn passkey; SMS bukan default), lockout progresif, deteksi login anomali, tanpa akun default
Session
Cookie HttpOnly; Secure; SameSite=Lax/Strict, idle 30 menit, absolute 12 jam (parameter), revoke instan saat user dinonaktifkan atau role berubah
Data
Klasifikasi PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED; enkripsi at-rest; enkripsi aplikasi (envelope) untuk NIK, rekening, gaji, kredensial klien, evidence; TLS 1.2+
Kunci & secret
Secrets Store/Worker secret bindings, rotasi terjadwal, tidak ada secret di repo, browser, atau localStorage; secret scanning di CI
Input/output
Validasi skema (Zod) di server, parameterized query, output encoding, CSP ketat dengan nonce, HSTS, X-Content-Type-Options, frame-ancestors none
File
Allowlist tipe dan ukuran, malware scan sebelum tersedia, simpan di R2 privat, unduh via signed URL berumur pendek, strip metadata bila perlu
Logging
Audit log append-only (who, what, when, where, before/after, reason) dengan hash chain; security log ke SIEM; tanpa data sensitif mentah di log
Supply chain
Lockfile, SCA (Dependabot/OSV), SAST (CodeQL/Semgrep), SBOM CycloneDX per release, signed commit/tag untuk release, pinned GitHub Actions
Pengujian
DAST (OWASP ZAP) di UAT, VAPT independen sebelum go-live dan tahunan, test IDOR/BOLA otomatis untuk semua endpoint
PDP
Register aktivitas pemrosesan (RoPA), consent dan dasar hukum, hak subjek data (akses, koreksi, hapus) via workflow, DPIA untuk modul HR/payroll dan portal, notifikasi kegagalan PDP 3×24 jam
Ketahanan
Backup terenkripsi, restore teruji, runbook insiden, RPO/RTO disetujui
10.3 Data klien keamanan
• Evidence VAPT/DFIR, kredensial uji, dan IOC klien berklasifikasi RESTRICTED, hanya untuk member engagement, dengan watermark unduhan dan log akses.
• Chain of custody DFIR: hash saat ingest, setiap akses tercatat, tidak bisa diubah.
• Data klien tidak dikirim ke penyedia AI eksternal yang belum disetujui; mode AI untuk data RESTRICTED hanya memakai model yang disetujui dengan zero-retention atau self-hosted.
• Aktivitas pengujian aktif hanya setelah RoE dan surat otorisasi pelanggan berstatus APPROVED di sistem.
11. Arsitektur, Job Scheduler, dan Integrasi
Baseline tetap Next.js + TypeScript di Cloudflare Workers (OpenNext) dengan D1, R2, Queues, Workflows, dan Cron Triggers; keputusan memindahkan ledger ke managed PostgreSQL (via Hyperdrive/private connectivity) diambil lewat Architecture Decision Record berbasis uji beban, bukan preferensi.
11.1 Struktur lapisan kode
• apps/web — UI (App Router), hanya memanggil API, tidak ada logika bisnis.
• packages/domain — entity, state machine, formula library, posting rules engine (murni, mudah di-unit-test).
• packages/policy — RBAC/ABAC/SoD engine dan permission registry.
• packages/data — repository dengan scope injection, migrasi D1 berurutan (lanjut dari 0039/0045 kanonis), seed parameter.
• packages/jobs — handler Cron/Queue/Workflow untuk siklus D/W/M/Q/S/A.
• packages/integrations — connector dengan registry, retry, idempotency, dead-letter.
• docs/ — ADR, spesifikasi, runbook, evidence UAT.
11.2 Keputusan database yang wajib diuji
Kriteria
Ambang yang memicu evaluasi PostgreSQL
Ukuran DB per entitas
Mendekati batas ukuran D1 pada paket aktif [VERIFY batas terkini]
Concurrency tulis
Antrean posting > 5 menit pada beban puncak close
Query laporan
p95 laporan bulanan > 10 detik setelah pre-aggregation
Transaksi multi-tabel
Kebutuhan locking yang tidak bisa dipenuhi batch/transaction D1
Opsi tengah: D1 per legal entity (sharding alami) + gudang data analitik terpisah untuk BI.
11.3 Jadwal job default (WIB, parameter)
Job
Jadwal
Fungsi
posting-worker
Continuous (Queue)
Event akuntansi → jurnal
bank-import
05.30 harian
Import mutasi (file/API bank yang disetujui), auto-match
daily-flash
06.00 hari kerja
Bangun dan kirim Daily Flash
sla-monitor
Setiap 5 menit
Timer SLA tiket/insiden, eskalasi
timesheet-reminder
16.00 Jumat
Pengingat timesheet belum lengkap
weekly-pack
07.00 Senin
Cash forecast, collection plan, WBR
recurring-billing
01.00 tanggal 1
Invoice subscription/managed service
month-end-batch
WD+1 01.00
Depresiasi, amortisasi, deferred release, POC, accrual
fx-revaluation
Hari terakhir bulan 23.00
Revaluasi valas
subledger-recon
02.00 harian + WD+3
Rekonsiliasi subledger vs GL
access-review
Hari pertama kuartal
Membuat kampanye user access review
backup-verify
03.00 harian
Backup + verifikasi integritas, restore test mingguan
agg-refresh
Setiap 15 menit
Refresh tabel agregat dashboard
Semua job idempotent, mencatat run ID, durasi, jumlah record, error, dan tampil di Job Monitor (M20) dengan alert bila gagal.
11.4 Integrasi prioritas RTI
Integrasi
Tujuan
Metode
Microsoft 365 / Google Workspace
SSO, email, kalender, dokumen
OIDC/SAML, Graph/Workspace API
GitHub / GitLab
Story, PR, release untuk M21
Webhook bertanda tangan
Coretax DJP
e-Faktur, bukti potong
Impor/ekspor file sesuai format resmi atau API bila tersedia [VERIFY]
Bank
Mutasi rekening, instruksi bayar
File statement (MT940/CSV) dulu; API host-to-host setelah verifikasi keamanan
BPJS
Iuran
Ekspor format laporan
SIEM/EDR klien
SOC/MDR
Connector read-only, kredensial per klien di vault
LPSE/SPSE
Tender discovery
Input manual/terjadwal sesuai ketentuan situs
Payment gateway
Pendaftaran Academy
Webhook bertanda tangan, rekonsiliasi harian
AI provider (termasuk Mistral)
Copilot
Gateway internal dengan allowlist model, redaksi PII, logging biaya
12. UAT, Definition of Done, Roadmap, dan Artefak
Seluruh ketentuan Bagian 16, 17, 19, 20, dan 21 v2.0 tetap berlaku; v3.0 menambah skenario untuk organisasi dinamis, posting engine, siklus close, dan modul M21–M24, serta menambah tiga kriteria DoD.
12.1 Tambahan skenario UAT wajib
ID
Skenario
Hasil yang diharapkan
ORG-01
Buat divisi baru di bawah DIR-OPS via M02 dengan approval
Unit, cost center, menu, dashboard, approval line aktif tanpa deploy
ORG-02
Pindahkan departemen ke divisi lain dengan effective date
Role binding dan scope berpindah pada tanggal efektif; transaksi lama tetap pada versi lama
ORG-03
User unit A membuka transaksi unit B via ubah ID di URL/API
Ditolak 403/404, tercatat di security log
RBAC-01
Grant role yang memicu SOD-01
Ditolak atau butuh mitigasi dengan approval CISO
GL-01
Timesheet approved → WIP → POC revenue → invoice → cash + PPh 23
Jurnal lengkap, seimbang, dapat di-drill dari FS ke timesheet
GL-02
Event yang sama dikirim dua kali
Hanya satu jurnal (idempotent)
GL-03
Posting ke periode tertutup
Ditolak; reopen hanya CFO dan status laporan menjadi RESTATED
CLS-01
Close bulanan penuh WD0–WD+5
Checklist hijau, subledger = GL, Management Pack terbit dengan hash
CLS-02
Close tahunan + tutup buku
Akun nominal nol, laba ditahan benar, saldo awal tahun baru sesuai
FML-01
Seluruh formula library
Semua test case nilai ekspektasi lulus
ACD-01
Batch training 20 peserta + biaya langsung
Revenue diakui saat selesai, NDR dan bagi hasil 60:40 benar, statement partner terbit
SWE-01
Story dari GitHub → timesheet → release → invoice milestone
Tertelusur end-to-end
ITS-01
Breach SLA kontrak managed support
SLA credit otomatis mengurangi invoice
UX-01
Pengguna baru per persona menyelesaikan 3 tugas inti tanpa pelatihan
Task success ≥ 90%, SUS ≥ 75
Setiap skenario dijalankan positif dan negatif, di lingkungan UAT_SIM dengan data sintetis, dan dicatat dengan format test case v2.0 beserta evidence (screenshot, response API, jurnal, hash laporan).
12.2 Tambahan Definition of Done
21. Tidak ada nilai organisasi, role, akun, tarif, atau ambang yang di-hardcode (diverifikasi lint/grep di CI).
22. Setiap angka keuangan baru punya formula ID, test case, dan drill-down ke sumber.
23. Halaman baru lolos audit aksesibilitas otomatis dan mengikuti token INDIA Vivid.
12.3 Roadmap work package v3.0
WP
Fokus
Gate keluar
WP00
Audit repo, PR, migrasi, baseline keamanan
Current State Audit + release blocker register disetujui
WP01
Parameter center, Org-as-Data, policy engine RBAC/ABAC/SoD
ORG-01..03, RBAC-01 PASS
WP02
Design system INDIA Vivid, layout, login, komponen
UX-01 pilot PASS, axe-core bersih
WP03
Commercial (M03–M08) + pricing model baru
Lead-to-contract E2E PASS
WP04
PSA, M21, M22, M23
SWE-01, ITS-01, ACD-01 PASS
WP05
Cyber Operations M10, M11
Journey J03–J06 PASS
WP06
Posting engine, GL, AR/AP, pajak, M24
GL-01..03, FML-01 PASS
WP07
Procurement, HR/payroll, asset
J09, J10 PASS
WP08
Siklus D/W/M/Q/S/A, dashboard, BI, AI
CLS-01, CLS-02 PASS pada data sintetis 12 bulan
WP09
Governance, portal eksternal
Isolasi portal PASS
WP10
UAT operasional nyata, VAPT, DR drill
Tidak ada Sev-1/Sev-2 terbuka
WP11
Rilis terkontrol dan hypercare
DEPLOYED AND VERIFIED dengan evidence
Urutan kritis: WP01 dan WP06 adalah fondasi; modul lain boleh paralel setelah WP01 selesai, tetapi tidak ada modul yang berdampak keuangan dirilis sebelum WP06 PASS.
12.4 Tambahan artefak (melengkapi 30 artefak v2.0)
31. Parameter Catalog dan nilai per environment.
32. Organization Model Specification dan prosedur reorganisasi.
33. Policy & Permission Registry (otomatis dari kode) dan SoD Rule Book.
34. Posting Rules Catalog dan COA Mapping per entitas.
35. Formula Library dengan test case.
36. Close Calendar, Close Checklist, dan Close Runbook.
37. Report Definition Catalog per siklus D/W/M/Q/S/A.
38. INDIA Vivid Design Token dan Storybook.
39. Spesifikasi M21–M24.
40. PDP Compliance Pack (RoPA, DPIA, prosedur hak subjek data).
13. Instruksi Eksekusi Final
Mulai dari audit repository INDIA yang sebenarnya, lalu kerjakan WP00 → WP11 dengan parameter di Bagian 0 sebagai sumber konfigurasi tunggal; jangan berhenti pada rekomendasi atau mockup.
1. Baca blok PARAMETERS dan ORG_SEED; laporkan nilai yang bertentangan dengan kondisi repo/database dan nilai bertanda VERIFY yang belum terverifikasi.
2. Jalankan audit v2.0 Bagian 2 dan hasilkan matriks Module → Gap → Status untuk M01–M24.
3. Bangun fondasi WP01 (parameter center, Org-as-Data, policy engine) sebelum menyentuh modul lain; migrasi D1 baru dimulai setelah nomor kanonis terakhir yang tervalidasi.
4. Bangun posting engine dan formula library (WP06) dengan test case sebelum dashboard keuangan apa pun dibuat.
5. Terapkan INDIA Vivid secara bertahap per halaman yang disentuh, tanpa memutus fungsi existing.
6. Setiap WP dilaporkan dengan format Execution Report v2.0 Bagian 21, ditambah kolom: Parameter Changed, Formula IDs, Posting Rules, Close Cycle Impact.
7. Status hanya boleh salah satu dari: NOT STARTED, IN DEVELOPMENT, READY FOR UAT, UAT PASSED, RELEASE BLOCKED, APPROVED FOR PRODUCTION, DEPLOYED AND VERIFIED, dan harus disertai evidence.
8. Bila menemukan ketidakpastian akuntansi atau pajak, buat parameter dengan nilai default yang aman, tandai VERIFY, dan minta konfirmasi Finance/auditor; jangan menebak di kode.
FINAL OBJECTIVE: INDIA menjadi Enterprise Operating System PT Riset Teknologi Indonesia (dan entitas yang di-onboard kemudian) yang menghubungkan aktivitas teknis harian sampai laporan keuangan harian, mingguan, bulanan, triwulanan, semesteran, dan tahunan, dengan struktur organisasi yang tumbuh tanpa ubah kode, RBAC yang ketat, tampilan yang cerah dan mudah dipakai, serta setiap angka dapat ditelusuri ke sumbernya.