-- =============================================================================
-- ICOP DefendIT360 — Fase 2: Project Management + Token System Schema
-- Modul 6: Project Delivery VAPT | Modul 8: Token System
-- PostgreSQL 16 | BRD v2.0
-- Generated: 2026-05-25
-- Dependency: 01_auth_rbac + 02_crm + 03_pricing + 04_contract
-- =============================================================================

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE project_status AS ENUM (
    'planning',     -- Setelah kontrak aktif, belum kickoff
    'active',       -- Sedang berjalan
    'hold',         -- Ditahan (menunggu klien/resource)
    'completed',    -- Selesai, BAST signed
    'cancelled'
);

CREATE TYPE milestone_type AS ENUM (
    'kickoff',          -- Kickoff meeting ≤5 HK dari PKS aktif
    'project_plan',     -- PM submit project plan
    'execution_start',  -- Eksekusi dimulai
    'report_initial',   -- Laporan Pendahuluan → trigger Invoice T2 (50%)
    'retest',           -- Retest (free ≤30 hari)
    'bast_final',       -- BAST signed → trigger Invoice T3 (20%)
    'project_close'     -- Project ditutup
);

CREATE TYPE milestone_status AS ENUM (
    'pending', 'in_progress', 'completed', 'overdue', 'skipped'
);

CREATE TYPE token_tx_type AS ENUM (
    'ISSUANCE',     -- Token diterbitkan Finance setelah invoice token paid
    'RESERVE',      -- Token di-reserve saat scoping disetujui klien
    'RELEASE',      -- Token dilepas kembali (reserve > actual)
    'DEBIT',        -- Token didebet aktual setelah laporan approved
    'TOPUP',        -- Penambahan token (pembelian lanjutan)
    'EXPIRY',       -- Token kadaluarsa
    'ADJUSTMENT'    -- Koreksi manual (butuh approval Management)
);

CREATE TYPE token_pkg AS ENUM (
    'Starter',      -- 10 token, 6 bulan, Rp 30-40jt
    'Standard',     -- 25 token, 12 bulan, Rp 65-85jt
    'Professional', -- 50 token, 12 bulan, Rp 120-150jt
    'Enterprise'    -- 100+ token, 24 bulan + rollover
);


-- =============================================================================
-- 1. PROJECTS
--    Project aktif VAPT / ISO / GRC — lifecycle dari PKS aktif → BAST
-- =============================================================================
CREATE TABLE projects (
    id                      BIGSERIAL       PRIMARY KEY,
    contract_id             BIGINT          NOT NULL REFERENCES contracts(id),
    project_number          VARCHAR(50)     NOT NULL UNIQUE,   -- Auto: VAPT-YYYY-NNN
    name                    VARCHAR(500)    NOT NULL,
    service_type            service_type    NOT NULL,          -- VAPT/SOC/CTI/ISO/PDP/IR
    status                  project_status  NOT NULL DEFAULT 'planning',
    -- Tanggal
    start_date              DATE,
    planned_end_date        DATE,
    actual_close_date       DATE,
    kickoff_date            DATE,
    kickoff_minutes_url     TEXT,                   -- URL notulensi kickoff
    -- Tim
    pm_user_id              BIGINT          REFERENCES users(id),
    lead_user_id            BIGINT          REFERENCES users(id),
    senior_user_ids         BIGINT[]        NOT NULL DEFAULT '{}',
    junior_user_ids         BIGINT[]        NOT NULL DEFAULT '{}',
    -- Scope & environment
    test_environment        VARCHAR(30),             -- Production/Staging/Both
    location_type           location_type,
    credentials_received    BOOLEAN         NOT NULL DEFAULT FALSE,
    target_list             JSONB,                  -- [{name, url_ip, type, methodology}]
    concurrent_slot         INTEGER         NOT NULL DEFAULT 1
                                            CHECK (concurrent_slot BETWEEN 1 AND 5),
    -- Link ke sistem VAPT eksisting
    vapt_external_system_id VARCHAR(255),            -- ID project di Sistem VAPT
    -- Token (jika klien pakai token system)
    token_wallet_id         BIGINT,                  -- FK → token_wallets (lihat bawah)
    tokens_reserved         DECIMAL(8,2)    NOT NULL DEFAULT 0,
    tokens_debited          DECIMAL(8,2)    NOT NULL DEFAULT 0,
    -- Notes
    notes                   TEXT,
    -- Timestamps
    created_by              BIGINT          NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_project_concurrent CHECK (concurrent_slot BETWEEN 1 AND 5),
    CONSTRAINT chk_project_dates CHECK (
        planned_end_date IS NULL OR start_date IS NULL OR
        planned_end_date >= start_date
    )
);

CREATE INDEX idx_proj_contract    ON projects (contract_id);
CREATE INDEX idx_proj_status      ON projects (status) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX idx_proj_pm          ON projects (pm_user_id);
CREATE INDEX idx_proj_vapt_ext    ON projects (vapt_external_system_id) WHERE vapt_external_system_id IS NOT NULL;

COMMENT ON TABLE  projects IS 'Project delivery VAPT/ISO/IR. Max 5 concurrent VAPT projects aktif';
COMMENT ON COLUMN projects.concurrent_slot IS 'Slot ke-N dari max 5 VAPT concurrent. Dicek saat create project';
COMMENT ON COLUMN projects.vapt_external_system_id IS 'ID project di Sistem VAPT eksisting — digunakan untuk API sync';


-- =============================================================================
-- 2. PROJECT_MILESTONES
--    Milestone per project — trigger invoice dan BAST
-- =============================================================================
CREATE TABLE project_milestones (
    id              BIGSERIAL           PRIMARY KEY,
    project_id      BIGINT              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_type  milestone_type      NOT NULL,
    milestone_name  VARCHAR(255)        NOT NULL,
    planned_date    DATE,
    actual_date     DATE,
    status          milestone_status    NOT NULL DEFAULT 'pending',
    -- BAST specific
    signed_by_client BOOLEAN            NOT NULL DEFAULT FALSE,
    bast_url        TEXT,               -- URL dokumen BAST signed
    -- Invoice trigger
    triggers_invoice_termin INTEGER,    -- 1, 2, atau 3 — jika milestone ini trigger invoice
    triggered_invoice_id    BIGINT      REFERENCES invoices(id),
    -- Completion
    completed_by    BIGINT              REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_milestone_type UNIQUE (project_id, milestone_type)
);

CREATE INDEX idx_ms_project ON project_milestones (project_id);
CREATE INDEX idx_ms_status  ON project_milestones (status) WHERE status NOT IN ('completed','skipped');

COMMENT ON TABLE  project_milestones IS 'Milestone project — trigger invoice T1/T2/T3 dan BAST';
COMMENT ON COLUMN project_milestones.triggers_invoice_termin IS '1=kickoff(DP), 2=report_initial, 3=bast_final. NULL jika tidak trigger invoice';


-- =============================================================================
-- 3. PROJECT_SYNC_LOGS
--    Log sync dari Sistem VAPT & SOC eksisting via API
-- =============================================================================
CREATE TABLE project_sync_logs (
    id              BIGSERIAL   PRIMARY KEY,
    project_id      BIGINT      NOT NULL REFERENCES projects(id),
    sync_type       VARCHAR(50) NOT NULL,  -- status_update/findings_summary/report_approved/milestone_complete
    direction       VARCHAR(10) NOT NULL,  -- pull / push / webhook
    payload_hash    VARCHAR(64),           -- SHA-256 payload untuk idempotency
    status          VARCHAR(20) NOT NULL,  -- success/failed/skipped
    response_code   INTEGER,
    error_message   TEXT,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_project   ON project_sync_logs (project_id);
CREATE INDEX idx_sync_type      ON project_sync_logs (sync_type, synced_at DESC);
CREATE INDEX idx_sync_failed    ON project_sync_logs (status) WHERE status = 'failed';

COMMENT ON TABLE project_sync_logs IS 'Log API sync ke sistem VAPT & SOC eksisting. Gunakan payload_hash untuk deteksi duplikat';


-- =============================================================================
-- 4. TOKEN_WALLETS
--    Satu wallet per perusahaan klien
-- =============================================================================
CREATE TABLE token_wallets (
    id                  BIGSERIAL       PRIMARY KEY,
    company_id          BIGINT          NOT NULL UNIQUE REFERENCES companies(id),
    -- Balance breakdown
    balance_available   DECIMAL(10,2)   NOT NULL DEFAULT 0
                                        CHECK (balance_available >= 0),
    balance_reserved    DECIMAL(10,2)   NOT NULL DEFAULT 0
                                        CHECK (balance_reserved >= 0),
    balance_total       DECIMAL(10,2)   NOT NULL DEFAULT 0
                                        GENERATED ALWAYS AS (balance_available + balance_reserved) STORED,
    -- Total lifetime
    total_issued        DECIMAL(10,2)   NOT NULL DEFAULT 0,
    total_debited       DECIMAL(10,2)   NOT NULL DEFAULT 0,
    -- Expiry info (untuk paket non-Enterprise)
    latest_expiry_date  DATE,
    low_balance_alert_pct DECIMAL(5,2)  NOT NULL DEFAULT 20.00,  -- Alert jika <20% tersisa
    -- Status
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_company ON token_wallets (company_id);
CREATE INDEX idx_wallet_low     ON token_wallets (balance_available)
    WHERE is_active = TRUE;

-- Setelah wallet dibuat, update FK di projects
ALTER TABLE projects
    ADD CONSTRAINT fk_projects_wallet
    FOREIGN KEY (token_wallet_id) REFERENCES token_wallets(id);

COMMENT ON TABLE  token_wallets IS '1 wallet per perusahaan klien. 1 Token = 1 Manday Senior Analyst';
COMMENT ON COLUMN token_wallets.balance_reserved IS 'Token yang sudah di-reserve (scoping approved) tapi belum didebet';
COMMENT ON COLUMN token_wallets.low_balance_alert_pct IS 'Kirim notifikasi jika available < threshold ini';


-- =============================================================================
-- 5. TOKEN_PACKAGES
--    Paket token yang tersedia
-- =============================================================================
CREATE TABLE token_packages (
    id                  BIGSERIAL   PRIMARY KEY,
    package_name        token_pkg   NOT NULL UNIQUE,
    token_count         INTEGER     NOT NULL CHECK (token_count > 0),
    validity_months     INTEGER     NOT NULL,
    price_floor         DECIMAL(15,2) NOT NULL,   -- Harga minimum
    price_standard      DECIMAL(15,2) NOT NULL,   -- Harga standar
    rollover_allowed    BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed paket dari BRD Modul 8
INSERT INTO token_packages (package_name, token_count, validity_months,
    price_floor, price_standard, rollover_allowed)
VALUES
    ('Starter',      10,  6,  30000000,  35000000, FALSE),
    ('Standard',     25,  12, 65000000,  75000000, FALSE),
    ('Professional', 50,  12, 120000000, 135000000, FALSE),
    ('Enterprise',   100, 24, 200000000, 250000000, TRUE);

COMMENT ON TABLE token_packages IS 'Paket token yang tersedia. Enterprise: 100+ token, 24 bulan, rollover';


-- =============================================================================
-- 6. TOKEN_TRANSACTIONS
--    Immutable ledger semua transaksi token
-- =============================================================================
CREATE TABLE token_transactions (
    id                  BIGSERIAL       PRIMARY KEY,
    wallet_id           BIGINT          NOT NULL REFERENCES token_wallets(id),
    project_id          BIGINT          REFERENCES projects(id),
    invoice_id          BIGINT          REFERENCES invoices(id),
    tx_type             token_tx_type   NOT NULL,
    -- Nilai (selalu positif — tanda ditentukan oleh tx_type)
    token_amount        DECIMAL(10,2)   NOT NULL CHECK (token_amount > 0),
    -- Balance snapshot setelah transaksi
    balance_after_available DECIMAL(10,2) NOT NULL,
    balance_after_reserved  DECIMAL(10,2) NOT NULL,
    -- Metadata
    description         TEXT            NOT NULL,
    po_reference        VARCHAR(100),   -- Nomor PO token dari klien
    expiry_date         DATE,           -- Berlaku untuk ISSUANCE / TOPUP
    package_id          BIGINT          REFERENCES token_packages(id),
    -- Approval
    approved_by         BIGINT          REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    -- Chain integrity (sama seperti audit_logs)
    row_hash            VARCHAR(64)     NOT NULL,
    prev_hash           VARCHAR(64),
    -- People & time
    created_by          BIGINT          NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ttx_wallet     ON token_transactions (wallet_id);
CREATE INDEX idx_ttx_project    ON token_transactions (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_ttx_type       ON token_transactions (tx_type);
CREATE INDEX idx_ttx_created    ON token_transactions (created_at DESC);

-- Immutable — tidak boleh di-UPDATE atau DELETE
REVOKE UPDATE, DELETE ON token_transactions FROM PUBLIC;

COMMENT ON TABLE  token_transactions IS 'Immutable token ledger — RESERVE→DEBIT per project. Hash chain seperti audit_logs';
COMMENT ON COLUMN token_transactions.token_amount IS 'Selalu positif. Arah ditentukan tx_type: ISSUANCE/TOPUP=tambah, DEBIT/EXPIRY=kurang, RESERVE=pindah available→reserved';


-- =============================================================================
-- 7. TOKEN_SCOPING_REQUESTS
--    Request penggunaan token per project (approval klien diperlukan)
-- =============================================================================
CREATE TABLE token_scoping_requests (
    id                  BIGSERIAL   PRIMARY KEY,
    wallet_id           BIGINT      NOT NULL REFERENCES token_wallets(id),
    project_id          BIGINT      NOT NULL REFERENCES projects(id),
    -- Scoping
    requested_tokens    DECIMAL(10,2) NOT NULL CHECK (requested_tokens > 0),
    actual_tokens       DECIMAL(10,2),           -- Terisi setelah project selesai
    scope_document_url  TEXT,                    -- URL dokumen scoping
    methodology_notes   TEXT,
    -- Approval chain
    -- 1. Pentest Lead submit
    submitted_by        BIGINT      NOT NULL REFERENCES users(id),
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 2. Approval Pentest review
    pentest_approved_by BIGINT      REFERENCES users(id),
    pentest_approved_at TIMESTAMPTZ,
    -- 3. Client Approver approve (di portal)
    client_approved_by  BIGINT      REFERENCES users(id),
    client_approved_at  TIMESTAMPTZ,
    client_ip_address   INET,
    -- Status
    status              VARCHAR(30) NOT NULL DEFAULT 'pending_pentest',
    -- pending_pentest → pending_client → approved → reserved → debited → cancelled
    rejection_reason    TEXT,
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tsr_wallet     ON token_scoping_requests (wallet_id);
CREATE INDEX idx_tsr_project    ON token_scoping_requests (project_id);
CREATE INDEX idx_tsr_status     ON token_scoping_requests (status)
    WHERE status NOT IN ('debited','cancelled');

COMMENT ON TABLE  token_scoping_requests IS '3-step approval: Pentest Lead → Approval Pentest → Client Approver. Token di-reserve setelah klien approve';


-- =============================================================================
-- 8. TRIGGERS & FUNCTIONS
-- =============================================================================

-- Auto-update updated_at
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_milestones_updated_at
    BEFORE UPDATE ON project_milestones
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_wallets_updated_at
    BEFORE UPDATE ON token_wallets
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_tsr_updated_at
    BEFORE UPDATE ON token_scoping_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- Fungsi: generate project number otomatis
CREATE OR REPLACE FUNCTION generate_project_number(p_service_type TEXT)
RETURNS VARCHAR AS $$
DECLARE
    prefix      VARCHAR(10);
    seq_num     INTEGER;
BEGIN
    prefix := UPPER(SUBSTR(p_service_type, 1, 4));  -- 'VAPT', 'SOC_', 'ISO_', dll

    SELECT COUNT(*) + 1
    INTO   seq_num
    FROM   projects
    WHERE  EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    AND    service_type::TEXT = p_service_type;

    RETURN prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;


-- Fungsi: buat milestones default saat project dibuat
CREATE OR REPLACE FUNCTION create_default_milestones(p_project_id BIGINT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO project_milestones (project_id, milestone_type, milestone_name, triggers_invoice_termin)
    VALUES
        (p_project_id, 'kickoff',          'Kickoff Meeting',                         1),
        (p_project_id, 'project_plan',     'Project Plan Submitted',                  NULL),
        (p_project_id, 'execution_start',  'Eksekusi Dimulai',                        NULL),
        (p_project_id, 'report_initial',   'Laporan Pendahuluan Approved',             2),
        (p_project_id, 'retest',           'Retest Selesai',                          NULL),
        (p_project_id, 'bast_final',       'BAST Final Signed',                       3),
        (p_project_id, 'project_close',    'Project Ditutup',                         NULL)
    ON CONFLICT (project_id, milestone_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_milestones IS 'Auto-dipanggil saat project dibuat dari route handler';


-- Trigger: update token wallet saat token_transactions diinsert
CREATE OR REPLACE FUNCTION trg_fn_update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    CASE NEW.tx_type
        WHEN 'ISSUANCE', 'TOPUP' THEN
            -- Tambah available balance
            UPDATE token_wallets SET
                balance_available = balance_available + NEW.token_amount,
                total_issued      = total_issued      + NEW.token_amount,
                latest_expiry_date = GREATEST(COALESCE(latest_expiry_date, '1970-01-01'),
                                              COALESCE(NEW.expiry_date, latest_expiry_date, '1970-01-01')),
                updated_at        = NOW()
            WHERE id = NEW.wallet_id;

        WHEN 'RESERVE' THEN
            -- Pindah dari available ke reserved
            UPDATE token_wallets SET
                balance_available = balance_available - NEW.token_amount,
                balance_reserved  = balance_reserved  + NEW.token_amount,
                updated_at        = NOW()
            WHERE id = NEW.wallet_id
            AND   balance_available >= NEW.token_amount;

        WHEN 'RELEASE' THEN
            -- Lepas dari reserved ke available (reserve > actual)
            UPDATE token_wallets SET
                balance_available = balance_available + NEW.token_amount,
                balance_reserved  = balance_reserved  - NEW.token_amount,
                updated_at        = NOW()
            WHERE id = NEW.wallet_id;

        WHEN 'DEBIT' THEN
            -- Kurangi reserved (token aktual terpakai)
            UPDATE token_wallets SET
                balance_reserved = balance_reserved - NEW.token_amount,
                total_debited    = total_debited    + NEW.token_amount,
                updated_at       = NOW()
            WHERE id = NEW.wallet_id;

        WHEN 'EXPIRY', 'ADJUSTMENT' THEN
            -- Kurangi available
            UPDATE token_wallets SET
                balance_available = balance_available - NEW.token_amount,
                updated_at        = NOW()
            WHERE id = NEW.wallet_id;

        ELSE NULL;
    END CASE;

    -- Cek low balance alert (< 20% dari total issued)
    PERFORM 1 FROM token_wallets
    WHERE id = NEW.wallet_id
    AND   total_issued > 0
    AND   balance_available < (total_issued * low_balance_alert_pct / 100.0);

    -- Jika low balance: queue notifikasi (via INSERT ke notification queue)
    -- TODO: tambahkan NOTIFY ke BullMQ listener

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_token_update_wallet
    AFTER INSERT ON token_transactions
    FOR EACH ROW EXECUTE FUNCTION trg_fn_update_wallet_balance();


-- Trigger: auto-trigger invoice saat milestone completed
CREATE OR REPLACE FUNCTION trg_fn_milestone_invoice_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_project    RECORD;
    v_contract   RECORD;
    v_inv_num    VARCHAR(50);
    v_inv_amount DECIMAL(15,2);
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed'
       AND NEW.triggers_invoice_termin IS NOT NULL
       AND NEW.triggered_invoice_id IS NULL THEN

        -- Ambil project dan contract info
        SELECT p.*, c.contract_value, c.id AS c_id, c.payment_terms, c.company_id
        INTO   v_project
        FROM   projects p
        JOIN   contracts c ON c.id = p.contract_id
        WHERE  p.id = NEW.project_id;

        -- Kalkulasi nilai invoice berdasarkan termin dan payment_terms
        v_inv_amount := CASE NEW.triggers_invoice_termin
            WHEN 1 THEN v_project.contract_value * 0.30  -- DP 30%
            WHEN 2 THEN v_project.contract_value * 0.50  -- Termin 2 50%
            WHEN 3 THEN v_project.contract_value * 0.20  -- Final 20%
            ELSE 0
        END;

        IF v_inv_amount > 0 THEN
            -- Generate invoice number
            SELECT generate_invoice_number() INTO v_inv_num;

            -- Insert invoice
            INSERT INTO invoices (
                invoice_number, invoice_type, contract_id, company_id,
                termin_number, termin_percentage, dpp_amount,
                issue_date, created_by
            ) VALUES (
                v_inv_num, 'OTC_TERMIN', v_project.c_id, v_project.company_id,
                NEW.triggers_invoice_termin,
                CASE NEW.triggers_invoice_termin
                    WHEN 1 THEN 30 WHEN 2 THEN 50 WHEN 3 THEN 20 END,
                v_inv_amount,
                CURRENT_DATE,
                COALESCE(NEW.completed_by,
                    (SELECT id FROM users WHERE role_id =
                        (SELECT id FROM roles WHERE name = 'finance' LIMIT 1) LIMIT 1))
            )
            RETURNING id INTO v_inv_num;

            -- Update milestone dengan invoice ID
            UPDATE project_milestones
            SET    triggered_invoice_id = (SELECT id FROM invoices
                                           WHERE invoice_number = v_inv_num LIMIT 1)
            WHERE  id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_milestone_invoice
    AFTER UPDATE ON project_milestones
    FOR EACH ROW EXECUTE FUNCTION trg_fn_milestone_invoice_trigger();


-- =============================================================================
-- 9. VIEWS
-- =============================================================================

-- View: project dashboard aktif dengan progress milestone
CREATE OR REPLACE VIEW v_projects_active AS
SELECT
    p.id, p.project_number, p.name, p.service_type::TEXT, p.status::TEXT,
    p.start_date, p.planned_end_date, p.actual_close_date,
    p.kickoff_date, p.credentials_received, p.concurrent_slot,
    p.vapt_external_system_id,
    p.tokens_reserved, p.tokens_debited,
    -- Contract & company
    c.contract_number, c.contract_value,
    co.name   AS company_name, co.client_tier,
    -- Team
    pm.name   AS pm_name,
    lead.name AS lead_name,
    -- Milestone progress
    (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id) AS total_milestones,
    (SELECT COUNT(*) FROM project_milestones m
     WHERE m.project_id = p.id AND m.status = 'completed') AS completed_milestones,
    (SELECT COUNT(*) FROM project_milestones m
     WHERE m.project_id = p.id AND m.status = 'overdue') AS overdue_milestones,
    -- Next milestone
    (SELECT m.milestone_name FROM project_milestones m
     WHERE m.project_id = p.id AND m.status NOT IN ('completed','skipped')
     ORDER BY m.id LIMIT 1) AS next_milestone,
    -- SLA
    (p.planned_end_date - CURRENT_DATE) AS days_remaining,
    p.created_at
FROM   projects p
JOIN   contracts c  ON c.id  = p.contract_id
JOIN   companies co ON co.id = (SELECT company_id FROM contracts WHERE id = p.contract_id)
LEFT JOIN users pm   ON pm.id   = p.pm_user_id
LEFT JOIN users lead ON lead.id = p.lead_user_id
WHERE  p.status NOT IN ('completed','cancelled');

COMMENT ON VIEW v_projects_active IS 'Dashboard project aktif dengan progress milestone';


-- View: token wallet summary per klien
CREATE OR REPLACE VIEW v_token_wallet_summary AS
SELECT
    w.id              AS wallet_id,
    w.company_id,
    c.name            AS company_name,
    c.client_tier,
    w.balance_available,
    w.balance_reserved,
    w.balance_total,
    w.total_issued,
    w.total_debited,
    w.latest_expiry_date,
    w.is_active,
    -- Utilization rate
    CASE WHEN w.total_issued > 0
        THEN ROUND(w.total_debited / w.total_issued * 100, 1)
        ELSE 0
    END AS utilization_pct,
    -- Low balance warning
    CASE WHEN w.total_issued > 0 AND w.balance_available < (w.total_issued * w.low_balance_alert_pct / 100.0)
        THEN TRUE ELSE FALSE
    END AS low_balance_warning,
    -- Active projects using this wallet
    (SELECT COUNT(*) FROM projects p
     WHERE p.token_wallet_id = w.id AND p.status = 'active') AS active_project_count
FROM  token_wallets w
JOIN  companies c ON c.id = w.company_id
WHERE w.is_active = TRUE;

COMMENT ON VIEW v_token_wallet_summary IS 'Summary wallet token per klien — sumber dashboard token di Client Portal';


-- =============================================================================
-- END OF SCHEMA
-- Tables:    projects, project_milestones, project_sync_logs,
--            token_wallets, token_packages, token_transactions, token_scoping_requests
-- Views:     v_projects_active, v_token_wallet_summary
-- Functions: generate_project_number, create_default_milestones,
--            trg_fn_update_wallet_balance, trg_fn_milestone_invoice_trigger
-- =============================================================================
