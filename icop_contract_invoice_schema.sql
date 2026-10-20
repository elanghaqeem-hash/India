-- =============================================================================
-- ICOP DefendIT360 — Contract Management & Invoicing Dasar Schema
-- Modul 4: Contract Mgmt (NDA + PKS + e-Sign)
-- Modul 9: Invoicing Dasar (Termin 1/2/3, MRC)
-- PostgreSQL 16 | BRD v2.0
-- Generated: 2026-05-25
-- Dependency: icop_auth_rbac_schema.sql + icop_crm_schema.sql
--             + icop_pricing_proposal_schema.sql
-- =============================================================================

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE contract_type AS ENUM (
    'PKS_VAPT',     -- Perjanjian Kerja Sama VAPT
    'PKS_SOC',      -- Perjanjian Kerja Sama SOC/MDR
    'PKS_ISO',      -- Perjanjian Kerja Sama ISO Implementation
    'PKS_CTI',      -- Perjanjian Kerja Sama CTI/ETLM
    'PKS_GRC',      -- PDP/GRC/DPO
    'PKS_IR',       -- Incident Response
    'PKS_Channel',  -- Perjanjian Channel Partner
    'SPK',          -- Surat Perintah Kerja (pengadaan)
    'NDA'           -- Non-Disclosure Agreement
);

CREATE TYPE contract_status AS ENUM (
    'draft',
    'pending_review',   -- Legal review
    'pending_sign',     -- Menunggu tanda tangan
    'active',           -- Kontrak aktif / berjalan
    'expired',          -- Berakhir natural
    'terminated',       -- Dihentikan sebelum waktunya
    'cancelled'
);

CREATE TYPE esign_method AS ENUM (
    'privy',        -- Privy.id (default untuk swasta/Tbk)
    'vida',         -- VIDA (alternatif)
    'wet',          -- Tanda tangan basah (BUMN/Gov)
    'docusign'      -- Untuk klien internasional
);

CREATE TYPE doc_required_type AS ENUM (
    'registration_form',    -- Formulir Registrasi Pelanggan
    'nda',                  -- NDA signed
    'npwp',                 -- Copy NPWP
    'ktp_director',         -- KTP Direktur/PJ
    'po_spk'                -- PO / SPK dari klien
);

CREATE TYPE invoice_type AS ENUM (
    'OTC_TERMIN',       -- One-time project, per termin
    'MRC_MONTHLY',      -- Monthly Recurring Contract (SOC/CTI)
    'TOKEN',            -- Token top-up
    'RETEST',           -- Retest tambahan (di luar 30 hari free)
    'CHANNEL_COMM'      -- Tagihan komisi ke channel partner
);

CREATE TYPE invoice_status AS ENUM (
    'draft',
    'sent',
    'overdue',
    'paid',
    'partial',          -- Dibayar sebagian
    'cancelled'
);

CREATE TYPE payment_method AS ENUM (
    'Transfer',
    'RTGS',
    'Virtual_Account',
    'Tunai',
    'Cek',
    'Giro'
);


-- =============================================================================
-- 1. CONTRACTS
--    PKS, SPK, NDA aktif — sumber kebenaran kontrak
-- =============================================================================
CREATE TABLE contracts (
    id                  BIGSERIAL       PRIMARY KEY,
    opportunity_id      BIGINT          REFERENCES opportunities(id),
    proposal_id         BIGINT          REFERENCES proposals(id),
    company_id          BIGINT          NOT NULL REFERENCES companies(id),
    -- Identitas kontrak
    contract_number     VARCHAR(100)    NOT NULL UNIQUE,
    contract_type       contract_type   NOT NULL,
    status              contract_status NOT NULL DEFAULT 'draft',
    -- Nilai & terms
    contract_value      DECIMAL(15,2)   NOT NULL DEFAULT 0 CHECK (contract_value >= 0),
    payment_terms       payment_terms   NOT NULL DEFAULT '30-50-20',
    penalty_rate_permil DECIMAL(6,3)    NOT NULL DEFAULT 1.000,   -- 1‰/hari sesuai BRD
    max_penalty_pct     DECIMAL(5,2)    NOT NULL DEFAULT 5.00,    -- Maks 5% total proyek
    -- Periode
    start_date          DATE            NOT NULL,
    end_date            DATE            NOT NULL,
    -- Renewal
    auto_renewal        BOOLEAN         NOT NULL DEFAULT FALSE,
    renewal_notice_days INTEGER         NOT NULL DEFAULT 90,
    -- E-Sign
    esign_method        esign_method    NOT NULL DEFAULT 'privy',
    esign_doc_id        VARCHAR(255),   -- ID dokumen dari Privy/VIDA
    esign_doc_url       TEXT,           -- URL dokumen yang sudah ditandatangani
    materai_applied     BOOLEAN         NOT NULL DEFAULT FALSE,   -- e-Materai PERURI Rp 10.000
    materai_serial      VARCHAR(100),
    -- Tanda tangan
    client_signed_at    TIMESTAMPTZ,
    deit_signed_at      TIMESTAMPTZ,
    -- PO klien
    client_po_number    VARCHAR(100),   -- Nomor PO/SPK dari sistem klien
    delivery_address    TEXT,
    client_notes        TEXT,
    -- Approval (deals >Rp 250jt atau diskon >15% butuh Management)
    requires_management_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by         BIGINT          REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    -- People
    created_by          BIGINT          NOT NULL REFERENCES users(id),   -- Admin/Legal
    reviewed_by         BIGINT          REFERENCES users(id),            -- Strategic/Legal
    reviewed_at         TIMESTAMPTZ,
    -- Soft delete & timestamps
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_contract_dates CHECK (end_date > start_date),
    CONSTRAINT chk_contract_signed CHECK (
        -- Kontrak aktif harus sudah ditandatangani keduanya
        status != 'active' OR
        (client_signed_at IS NOT NULL AND deit_signed_at IS NOT NULL)
    ),
    CONSTRAINT chk_contract_approval CHECK (
        -- Deals yang butuh approval management harus punya approver
        requires_management_approval = FALSE OR approved_by IS NOT NULL
    )
);

CREATE INDEX idx_con_company        ON contracts (company_id);
CREATE INDEX idx_con_opportunity    ON contracts (opportunity_id);
CREATE INDEX idx_con_status         ON contracts (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_con_end_date       ON contracts (end_date)
    WHERE status = 'active';

COMMENT ON TABLE  contracts IS 'Kontrak aktif: PKS, SPK, NDA. Status active = kedua pihak sudah tanda tangan';
COMMENT ON COLUMN contracts.penalty_rate_permil IS '1 permil per hari (0.001 = 1‰). Beda dari quotation denda 1%/hari — BRD menggunakan PKS standard';
COMMENT ON COLUMN contracts.max_penalty_pct     IS 'Denda maksimum 5% dari total nilai proyek';
COMMENT ON COLUMN contracts.client_po_number    IS 'Dari Formulir Proyek Seksi 2 — auto-fill saat klien submit form';


-- =============================================================================
-- 2. DOCUMENT_REQUIRED_CHECKLIST
--    5 dokumen wajib yang dikumpulkan dari klien setelah klien setuju quotation
-- =============================================================================
CREATE TABLE document_required_checklist (
    id              BIGSERIAL           PRIMARY KEY,
    contract_id     BIGINT              NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    doc_type        doc_required_type   NOT NULL,
    is_received     BOOLEAN             NOT NULL DEFAULT FALSE,
    received_at     TIMESTAMPTZ,
    file_url        TEXT,               -- MinIO / S3 storage URL
    file_hash       VARCHAR(64),        -- SHA-256 untuk integritas file
    file_name       VARCHAR(255),
    file_size_kb    INTEGER,
    uploaded_by     BIGINT              REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_doc_checklist UNIQUE (contract_id, doc_type)
);

CREATE INDEX idx_drc_contract   ON document_required_checklist (contract_id);
CREATE INDEX idx_drc_received   ON document_required_checklist (is_received)
    WHERE is_received = FALSE;

COMMENT ON TABLE  document_required_checklist IS '5 dokumen wajib: registration_form, nda, npwp, ktp_director, po_spk. Semua harus received sebelum PKS ditandatangani';
COMMENT ON COLUMN document_required_checklist.file_hash IS 'SHA-256 dari file — verifikasi integritas dokumen';


-- =============================================================================
-- 3. CONSENT_LOGS
--    Log persetujuan T&C dan UU PDP dari klien (e-sign & portal)
-- =============================================================================
CREATE TABLE consent_logs (
    id              BIGSERIAL   PRIMARY KEY,
    company_id      BIGINT      NOT NULL REFERENCES companies(id),
    contact_id      BIGINT      REFERENCES contacts(id),
    contract_id     BIGINT      REFERENCES contracts(id),
    consent_type    VARCHAR(50) NOT NULL,
    -- Nilai: terms_and_conditions, pdp_consent, privacy_policy,
    --        registration_form, project_form
    consent_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    ip_address      INET,
    user_agent      TEXT,
    consented_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_company  ON consent_logs (company_id);
CREATE INDEX idx_consent_contract ON consent_logs (contract_id);

COMMENT ON TABLE consent_logs IS 'Immutable log persetujuan UU PDP, T&C, dan privacy policy. Tidak boleh di-UPDATE/DELETE';
REVOKE UPDATE, DELETE ON consent_logs FROM PUBLIC;


-- =============================================================================
-- 4. INVOICES
--    Invoice yang diterbitkan kepada klien
-- =============================================================================
CREATE TABLE invoices (
    id                  BIGSERIAL       PRIMARY KEY,
    invoice_number      VARCHAR(50)     NOT NULL UNIQUE,    -- Format: INV-YYYY-NNN
    invoice_type        invoice_type    NOT NULL,
    contract_id         BIGINT          NOT NULL REFERENCES contracts(id),
    company_id          BIGINT          NOT NULL REFERENCES companies(id),
    -- Termin (untuk OTC)
    termin_number       INTEGER         CHECK (termin_number BETWEEN 1 AND 3),
    termin_percentage   DECIMAL(5,2)    CHECK (termin_percentage BETWEEN 0 AND 100),
    -- Milestone trigger (ditambah saat modul Project aktif, Fase 2)
    bast_milestone_id   BIGINT,         -- FK → project_milestones (Fase 2)
    -- Billing period (untuk MRC)
    billing_period_start DATE,
    billing_period_end   DATE,
    -- Tanggal
    issue_date          DATE            NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE            NOT NULL,           -- issue_date + 14 HK
    -- Nilai
    dpp_amount          DECIMAL(15,2)   NOT NULL DEFAULT 0 CHECK (dpp_amount >= 0),
    vat_rate            DECIMAL(5,2)    NOT NULL DEFAULT 11.00,
    vat_amount          DECIMAL(15,2)   NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (ROUND(dpp_amount * vat_rate / 100, 0)) STORED,
    total_amount        DECIMAL(15,2)   NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (dpp_amount + ROUND(dpp_amount * vat_rate / 100, 0)) STORED,
    paid_amount         DECIMAL(15,2)   NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    outstanding         DECIMAL(15,2)   NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (
            dpp_amount + ROUND(dpp_amount * vat_rate / 100, 0) - paid_amount
        ) STORED,
    penalty_amount      DECIMAL(15,2)   NOT NULL DEFAULT 0,
    -- Status
    status              invoice_status  NOT NULL DEFAULT 'draft',
    -- Faktur pajak
    faktur_number       VARCHAR(30),    -- Nomor seri faktur pajak DJP
    faktur_url          TEXT,           -- URL e-faktur PDF
    -- Timestamps
    sent_at             TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    -- People
    created_by          BIGINT          NOT NULL REFERENCES users(id),   -- Finance
    approved_by         BIGINT          REFERENCES users(id),            -- Finance Mgr (>100jt)
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_invoice_termin CHECK (
        invoice_type != 'OTC_TERMIN' OR
        (termin_number IS NOT NULL AND termin_percentage IS NOT NULL)
    ),
    CONSTRAINT chk_invoice_mrc_period CHECK (
        invoice_type != 'MRC_MONTHLY' OR
        (billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL)
    ),
    CONSTRAINT chk_invoice_due_date CHECK (due_date >= issue_date),
    CONSTRAINT chk_invoice_paid_amount CHECK (paid_amount <= total_amount)
);

CREATE INDEX idx_inv_contract   ON invoices (contract_id);
CREATE INDEX idx_inv_company    ON invoices (company_id);
CREATE INDEX idx_inv_status     ON invoices (status) WHERE status NOT IN ('paid','cancelled');
CREATE INDEX idx_inv_due        ON invoices (due_date)
    WHERE status IN ('sent','overdue');
CREATE INDEX idx_inv_number     ON invoices (invoice_number);

COMMENT ON TABLE  invoices IS 'Invoice ke klien. OTC: termin 30/50/20. MRC: billing bulanan. Approval Finance Mgr untuk >Rp 100jt';
COMMENT ON COLUMN invoices.due_date       IS 'issue_date + 14 hari kerja. Dihitung saat insert via trigger';
COMMENT ON COLUMN invoices.penalty_amount IS 'Akumulasi denda 1‰/hari dari nilai invoice. Diupdate via scheduler harian';


-- =============================================================================
-- 5. PAYMENTS
--    Catatan pembayaran — bisa partial/multiple per invoice
-- =============================================================================
CREATE TABLE payments (
    id              BIGSERIAL       PRIMARY KEY,
    invoice_id      BIGINT          NOT NULL REFERENCES invoices(id),
    amount          DECIMAL(15,2)   NOT NULL CHECK (amount > 0),
    payment_date    DATE            NOT NULL,
    payment_method  payment_method  NOT NULL,
    bank_reference  VARCHAR(255),   -- Nomor referensi bank / transfer
    proof_url       TEXT,           -- Upload bukti transfer (MinIO/S3)
    proof_hash      VARCHAR(64),    -- SHA-256 file bukti
    notes           TEXT,
    -- Konfirmasi Finance
    confirmed_by    BIGINT          REFERENCES users(id),
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_invoice    ON payments (invoice_id);
CREATE INDEX idx_pay_date       ON payments (payment_date DESC);
CREATE INDEX idx_pay_unconfirmed ON payments (confirmed_by) WHERE confirmed_by IS NULL;

COMMENT ON TABLE  payments IS 'Pembayaran per invoice. Bisa partial. Update invoice.paid_amount via trigger';
COMMENT ON COLUMN payments.proof_hash IS 'SHA-256 dari file bukti transfer — verifikasi integritas';


-- =============================================================================
-- 6. DUNNING_RECORDS
--    Log tindakan collection / penagihan untuk invoice overdue
-- =============================================================================
CREATE TABLE dunning_records (
    id              BIGSERIAL   PRIMARY KEY,
    invoice_id      BIGINT      NOT NULL REFERENCES invoices(id),
    dunning_level   INTEGER     NOT NULL,   -- 1=reminder, 2=second notice, 3=formal letter
    action_type     VARCHAR(50) NOT NULL,   -- whatsapp/email/phone/letter/site_visit
    notes           TEXT,
    promise_date    DATE,       -- Janji bayar dari klien
    promise_amount  DECIMAL(15,2),
    done_by         BIGINT      NOT NULL REFERENCES users(id),   -- Collection
    done_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dunning_invoice ON dunning_records (invoice_id);
CREATE INDEX idx_dunning_date    ON dunning_records (done_at DESC);

COMMENT ON TABLE dunning_records IS 'Log semua tindakan collection per invoice overdue';


-- =============================================================================
-- 7. TRIGGERS & FUNCTIONS
-- =============================================================================

-- Auto-update updated_at
CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_drc_updated_at
    BEFORE UPDATE ON document_required_checklist
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- Trigger: set due_date otomatis (issue_date + 14 hari kerja, Senin-Jumat)
CREATE OR REPLACE FUNCTION add_working_days(p_start DATE, p_days INTEGER)
RETURNS DATE AS $$
DECLARE
    result_date DATE := p_start;
    days_added  INTEGER := 0;
BEGIN
    WHILE days_added < p_days LOOP
        result_date := result_date + 1;
        IF EXTRACT(DOW FROM result_date) NOT IN (0, 6) THEN  -- 0=Sun, 6=Sat
            days_added := days_added + 1;
        END IF;
    END LOOP;
    RETURN result_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION trg_fn_set_invoice_due_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.due_date IS NULL OR NEW.due_date = NEW.issue_date THEN
        NEW.due_date := add_working_days(NEW.issue_date, 14);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_due_date
    BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION trg_fn_set_invoice_due_date();


-- Trigger: update invoice.paid_amount setelah payment ditambah
CREATE OR REPLACE FUNCTION trg_fn_update_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO   total_paid
    FROM   payments
    WHERE  invoice_id = NEW.invoice_id
    AND    confirmed_at IS NOT NULL;  -- Hanya hitung yang sudah dikonfirmasi

    UPDATE invoices
    SET    paid_amount = total_paid,
           status      = CASE
               WHEN total_paid >= total_amount THEN 'paid'::invoice_status
               WHEN total_paid > 0             THEN 'partial'::invoice_status
               ELSE status
           END,
           paid_at     = CASE
               WHEN total_paid >= total_amount AND paid_at IS NULL THEN NOW()
               ELSE paid_at
           END,
           updated_at  = NOW()
    WHERE  id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_update_invoice
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION trg_fn_update_invoice_paid();


-- Fungsi: hitung dan update denda harian invoice overdue
-- (Dijalankan via BullMQ scheduler setiap hari pukul 07:00 WIB)
CREATE OR REPLACE FUNCTION calculate_daily_penalties()
RETURNS INTEGER AS $$
DECLARE
    updated_count   INTEGER := 0;
    inv             RECORD;
    days_overdue    INTEGER;
    daily_rate      DECIMAL(6,3);
    new_penalty     DECIMAL(15,2);
    max_penalty     DECIMAL(15,2);
    contract_val    DECIMAL(15,2);
BEGIN
    FOR inv IN
        SELECT i.id, i.outstanding, i.due_date, i.penalty_amount,
               c.penalty_rate_permil, c.max_penalty_pct, c.contract_value
        FROM   invoices  i
        JOIN   contracts c ON c.id = i.contract_id
        WHERE  i.status IN ('sent', 'overdue', 'partial')
        AND    i.due_date < CURRENT_DATE
        AND    i.outstanding > 0
    LOOP
        days_overdue := (CURRENT_DATE - inv.due_date)::INTEGER;
        daily_rate   := inv.penalty_rate_permil / 1000.0;  -- permil ke desimal
        new_penalty  := ROUND(inv.outstanding * daily_rate * days_overdue, 0);
        max_penalty  := ROUND(inv.contract_value * inv.max_penalty_pct / 100.0, 0);

        -- Denda tidak boleh melebihi max_penalty_pct dari contract_value
        new_penalty := LEAST(new_penalty, max_penalty);

        UPDATE invoices
        SET    penalty_amount = new_penalty,
               status         = 'overdue',
               updated_at     = NOW()
        WHERE  id = inv.id;

        updated_count := updated_count + 1;
    END LOOP;

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_daily_penalties IS 'Jalankan via BullMQ scheduler setiap hari pukul 07:00 WIB';


-- Fungsi: generate invoice number otomatis
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    seq_num     INTEGER;
    new_number  VARCHAR(50);
BEGIN
    SELECT COUNT(*) + 1
    INTO   seq_num
    FROM   invoices
    WHERE  EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    new_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_number IS 'Format: INV-YYYY-NNNN. Increment per tahun';


-- =============================================================================
-- 8. VIEWS
-- =============================================================================

-- View: aging report untuk Collection
CREATE OR REPLACE VIEW v_aging_report AS
SELECT
    i.id                    AS invoice_id,
    i.invoice_number,
    i.invoice_type,
    i.issue_date,
    i.due_date,
    i.total_amount,
    i.paid_amount,
    i.outstanding,
    i.penalty_amount,
    i.status,
    -- Aging bucket
    CASE
        WHEN CURRENT_DATE <= i.due_date                     THEN 'current'
        WHEN CURRENT_DATE BETWEEN i.due_date + 1
             AND i.due_date + 30                            THEN '1-30'
        WHEN CURRENT_DATE BETWEEN i.due_date + 31
             AND i.due_date + 60                            THEN '31-60'
        WHEN CURRENT_DATE BETWEEN i.due_date + 61
             AND i.due_date + 90                            THEN '61-90'
        ELSE '>90'
    END                     AS aging_bucket,
    (CURRENT_DATE - i.due_date) AS days_overdue,
    -- Company & contract
    c.name                  AS company_name,
    c.client_tier,
    con.contract_number,
    -- Dunning info
    (SELECT MAX(done_at)
     FROM dunning_records dr
     WHERE dr.invoice_id = i.id) AS last_dunning_at,
    (SELECT COUNT(*)
     FROM dunning_records dr
     WHERE dr.invoice_id = i.id) AS dunning_count
FROM  invoices  i
JOIN  companies c   ON c.id  = i.company_id
JOIN  contracts con ON con.id = i.contract_id
WHERE i.status NOT IN ('paid', 'cancelled')
AND   i.outstanding > 0
ORDER BY i.due_date ASC;

COMMENT ON VIEW v_aging_report IS 'Aging AR per invoice — bucket current/1-30/31-60/61-90/>90 hari';


-- View: kontrak aktif dengan status renewal
CREATE OR REPLACE VIEW v_contracts_active AS
SELECT
    con.id,
    con.contract_number,
    con.contract_type,
    con.status,
    con.contract_value,
    con.start_date,
    con.end_date,
    con.auto_renewal,
    con.renewal_notice_days,
    con.esign_method,
    con.client_signed_at,
    con.deit_signed_at,
    -- Hari tersisa
    (con.end_date - CURRENT_DATE)   AS days_remaining,
    -- H-90 flag untuk renewal reminder
    (con.end_date - CURRENT_DATE) <= con.renewal_notice_days AS renewal_due_soon,
    -- Company & sales
    c.name          AS company_name,
    c.client_tier,
    u.name          AS created_by_name,
    -- Dokumen checklist status
    (SELECT COUNT(*) FROM document_required_checklist drc
     WHERE drc.contract_id = con.id AND drc.is_received = FALSE) AS docs_pending_count
FROM  contracts con
JOIN  companies c   ON c.id  = con.company_id
JOIN  users     u   ON u.id  = con.created_by
WHERE con.status = 'active'
AND   con.deleted_at IS NULL;

COMMENT ON VIEW v_contracts_active IS 'Kontrak aktif dengan flag renewal H-90. Sumber BullMQ renewal reminder scheduler';


-- View: invoice summary per company (untuk Finance dashboard)
CREATE OR REPLACE VIEW v_invoice_summary_by_company AS
SELECT
    c.id            AS company_id,
    c.name          AS company_name,
    c.client_tier,
    COUNT(i.id)                                             AS total_invoices,
    SUM(i.total_amount)                                     AS total_billed,
    SUM(i.paid_amount)                                      AS total_paid,
    SUM(i.outstanding)                                      AS total_outstanding,
    SUM(i.penalty_amount)                                   AS total_penalty,
    SUM(CASE WHEN i.status = 'overdue' THEN i.outstanding ELSE 0 END) AS overdue_amount,
    COUNT(CASE WHEN i.status = 'overdue' THEN 1 END)        AS overdue_count
FROM  companies c
LEFT JOIN invoices i ON i.company_id = c.id AND i.status NOT IN ('draft','cancelled')
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.client_tier;

COMMENT ON VIEW v_invoice_summary_by_company IS 'Summary AR per klien — sumber KPI DSO Finance';


-- =============================================================================
-- END OF SCHEMA
-- Tables:    contracts, document_required_checklist, consent_logs,
--            invoices, payments, dunning_records
-- Views:     v_aging_report, v_contracts_active, v_invoice_summary_by_company
-- Functions: add_working_days, generate_invoice_number,
--            calculate_daily_penalties, trg_fn_update_invoice_paid,
--            trg_fn_set_invoice_due_date
-- =============================================================================
