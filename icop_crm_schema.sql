-- =============================================================================
-- ICOP DefendIT360 — CRM Schema
-- Modul 1: Direct Sales & Tender | Modul 2: Channel Partner
-- PostgreSQL 16 | BRD v2.0
-- Generated: 2026-05-25
-- Dependency: icop_auth_rbac_schema.sql harus dijalankan lebih dulu
-- =============================================================================

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE industry_type AS ENUM (
    'Banking', 'Asuransi', 'Multifinance', 'Sekuritas', 'Fintech',
    'BUMN', 'Pemerintah', 'Healthcare', 'Retail', 'Manufaktur', 'Lainnya'
);

CREATE TYPE client_tier AS ENUM ('S', 'A', 'B', 'C', 'D', 'E');

CREATE TYPE company_size AS ENUM (
    '<50', '50-200', '201-500', '501-1000', '>1000'
);

CREATE TYPE lead_source AS ENUM (
    'Referral', 'Event', 'Cold Call', 'Website',
    'Channel Partner', 'LinkedIn', 'Tender', 'Lainnya'
);

CREATE TYPE opportunity_stage AS ENUM (
    'prospecting',      -- 10%  — identifikasi target, kontak pertama
    'qualified',        -- 25%  — BANT terpenuhi
    'quotation_sent',   -- 40%  — proposal dikirim, HS approve
    'negotiation',      -- 60%  — diskusi harga/scope aktif
    'po_received',      -- 85%  — PO diterima, trigger doc checklist
    'closed_won',       -- 100% — kontrak aktif, handover PM
    'closed_lost'       -- 0%   — catat alasan, masuk resales pipeline
);

CREATE TYPE service_type AS ENUM (
    'VAPT', 'SOC', 'CTI', 'ISO', 'PDP', 'Hardening', 'IR', 'Lainnya'
);

CREATE TYPE tender_source AS ENUM (
    'LPSE', 'Media', 'Jaringan Personal', 'Undangan Langsung', 'Lainnya'
);

CREATE TYPE go_no_go AS ENUM ('pending', 'go', 'no_go');

CREATE TYPE partner_type AS ENUM (
    'Referral', 'Reseller', 'SI', 'Teknologi'
);

CREATE TYPE partner_status AS ENUM (
    'active', 'suspended', 'terminated'
);

CREATE TYPE commission_type AS ENUM (
    'referral_fee', 'wholesale_margin', 'revenue_share'
);

CREATE TYPE commission_status AS ENUM (
    'pending', 'approved', 'paid', 'cancelled'
);

CREATE TYPE contact_type AS ENUM (
    'main', 'technical', 'billing', 'tax', 'project'
);

CREATE TYPE lost_reason AS ENUM (
    'Harga terlalu tinggi',
    'Dipilih kompetitor',
    'Tidak ada budget',
    'Timing tidak tepat',
    'Internal klien tidak setuju',
    'Lainnya'
);


-- =============================================================================
-- 1. CHANNEL_PARTNERS
--    Didefinisikan lebih dulu karena di-referens oleh companies
-- =============================================================================
CREATE TABLE channel_partners (
    id                      BIGSERIAL       PRIMARY KEY,
    company_name            VARCHAR(255)    NOT NULL UNIQUE,
    partner_code            VARCHAR(20)     NOT NULL UNIQUE,    -- Auto: CP-YYYY-NNN
    partner_type            partner_type    NOT NULL,
    contact_name            VARCHAR(255)    NOT NULL,
    contact_email           VARCHAR(255)    NOT NULL UNIQUE,
    contact_phone           VARCHAR(20),
    -- Komersial
    commission_rate         DECIMAL(5,2),                       -- % untuk Referral (5-10%)
    wholesale_discount      DECIMAL(5,2),                       -- % untuk Reseller (15-25%)
    revenue_share_deit_pct  DECIMAL(5,2)    NOT NULL DEFAULT 75.00,  -- % DEIT untuk SI
    -- Spesialisasi & scope
    specialization          TEXT[]          NOT NULL DEFAULT '{}',   -- Array sektor
    -- Perjanjian
    nda_signed_at           DATE,
    pks_signed_at           DATE,
    pks_expiry_date         DATE,
    -- Ketentuan deal
    min_deal_per_year       DECIMAL(15,2),
    lead_protection_months  INTEGER         NOT NULL DEFAULT 12,
    -- Status & akses
    status                  partner_status  NOT NULL DEFAULT 'active',
    portal_user_id          BIGINT          REFERENCES users(id),    -- Akun portal mitra
    notes                   TEXT,
    -- Approval
    approved_by             BIGINT          REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    -- Soft delete & timestamps
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cp_referral_rate CHECK (
        partner_type != 'Referral' OR commission_rate IS NOT NULL
    ),
    CONSTRAINT chk_cp_reseller_discount CHECK (
        partner_type != 'Reseller' OR wholesale_discount IS NOT NULL
    ),
    CONSTRAINT chk_cp_commission_range CHECK (
        commission_rate IS NULL OR (commission_rate BETWEEN 0 AND 100)
    ),
    CONSTRAINT chk_cp_discount_range CHECK (
        wholesale_discount IS NULL OR (wholesale_discount BETWEEN 0 AND 100)
    )
);

CREATE INDEX idx_cp_status  ON channel_partners (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cp_type    ON channel_partners (partner_type);
CREATE INDEX idx_cp_email   ON channel_partners (contact_email);

COMMENT ON TABLE  channel_partners IS 'Mitra rekanan channel sales: Referral, Reseller, SI, Teknologi';
COMMENT ON COLUMN channel_partners.partner_code        IS 'Auto-generate: CP-YYYY-NNN. Digunakan untuk attribution deal';
COMMENT ON COLUMN channel_partners.lead_protection_months IS 'Durasi proteksi lead dari partner sebelum bisa ditender ulang';


-- =============================================================================
-- 2. COMPANIES
--    Klien dan prospek — satu record per entitas hukum
-- =============================================================================
CREATE TABLE companies (
    id                      BIGSERIAL       PRIMARY KEY,
    -- Identitas
    name                    VARCHAR(255)    NOT NULL,
    legal_name              VARCHAR(255),                        -- Nama PT/CV sesuai akta
    customer_id             VARCHAR(20)     UNIQUE,             -- Auto: DEIT-YYYY-NNN (setelah registrasi)
    npwp                    VARCHAR(20)     UNIQUE,             -- XX.XXX.XXX.X-XXX.XXX
    industry                industry_type   NOT NULL,
    company_size            company_size,
    asset_band              VARCHAR(30),                        -- ENUM tier aset (dari OPSAF)
    client_tier             client_tier,                        -- S/A/B/C/D/E — auto dari industry+asset
    -- Kontak & lokasi
    website                 VARCHAR(255),
    phone                   VARCHAR(20),
    fax                     VARCHAR(20),
    address                 TEXT,
    province                VARCHAR(50),
    zip_code                VARCHAR(10),
    city                    VARCHAR(100),
    country                 VARCHAR(50)     NOT NULL DEFAULT 'Indonesia',
    billing_address         TEXT,
    billing_province        VARCHAR(50),
    billing_zip             VARCHAR(10),
    -- Status
    is_prospect             BOOLEAN         NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Relasi
    source                  lead_source,
    channel_partner_id      BIGINT          REFERENCES channel_partners(id),
    assigned_sales_user_id  BIGINT          REFERENCES users(id),
    created_by              BIGINT          NOT NULL REFERENCES users(id),
    -- Registrasi
    registration_form_submitted_at  TIMESTAMPTZ,
    -- Soft delete & timestamps
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_co_name       ON companies (name) WHERE deleted_at IS NULL;
CREATE INDEX idx_co_tier       ON companies (client_tier);
CREATE INDEX idx_co_sales      ON companies (assigned_sales_user_id);
CREATE INDEX idx_co_partner    ON companies (channel_partner_id);
CREATE INDEX idx_co_prospect   ON companies (is_prospect) WHERE deleted_at IS NULL;
CREATE INDEX idx_co_customer   ON companies (customer_id) WHERE customer_id IS NOT NULL;

-- FK balik ke companies dari users (ditambah setelah companies dibuat)
ALTER TABLE users
    ADD CONSTRAINT fk_users_company
    FOREIGN KEY (company_id) REFERENCES companies(id);

COMMENT ON TABLE  companies IS 'Klien aktif dan prospek DefendIT360 — satu record per entitas hukum';
COMMENT ON COLUMN companies.customer_id IS 'Format DEIT-YYYY-NNN. Ter-generate saat Formulir Registrasi Pelanggan disubmit';
COMMENT ON COLUMN companies.client_tier IS 'S=Premium, A=Standard, B=Value, C=Overseas, D=Gov/Tender, E=Channel. Auto-kalkulasi dari industry+asset_band';


-- =============================================================================
-- 3. CONTACTS
--    PIC per perusahaan — bisa lebih dari satu per company
-- =============================================================================
CREATE TABLE contacts (
    id              BIGSERIAL       PRIMARY KEY,
    company_id      BIGINT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    -- Identitas
    name            VARCHAR(255)    NOT NULL,
    title           VARCHAR(100),                   -- Jabatan
    email           VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),
    whatsapp        VARCHAR(20),                    -- Untuk WA notification
    telegram_chat_id VARCHAR(50),                   -- Untuk Telegram notif
    ktp_number      VARCHAR(16),                    -- NIK 16 digit — encrypted at rest (main PIC only)
    -- Tipe & status
    contact_type    contact_type    NOT NULL DEFAULT 'main',
    project_ref     VARCHAR(50),                    -- Untuk contact_type='project', isi project_number
    is_primary      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_billing      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_technical    BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Soft delete & timestamps
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_company    ON contacts (company_id);
CREATE INDEX idx_contact_email      ON contacts (email);
CREATE INDEX idx_contact_type       ON contacts (company_id, contact_type);

-- Hanya boleh 1 primary contact per company
CREATE UNIQUE INDEX uq_contact_primary
    ON contacts (company_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL;

COMMENT ON TABLE  contacts IS 'PIC per perusahaan. Bisa lebih dari satu per company dengan role berbeda';
COMMENT ON COLUMN contacts.ktp_number IS 'NIK 16 digit. WAJIB dienkripsi di application layer sebelum disimpan. Hanya untuk main PIC';


-- =============================================================================
-- 4. OPPORTUNITIES
--    Pipeline deal — satu record per peluang bisnis
-- =============================================================================
CREATE TABLE opportunities (
    id                      BIGSERIAL           PRIMARY KEY,
    -- Relasi utama
    company_id              BIGINT              NOT NULL REFERENCES companies(id),
    primary_contact_id      BIGINT              REFERENCES contacts(id),
    assigned_sales_user_id  BIGINT              NOT NULL REFERENCES users(id),
    channel_partner_id      BIGINT              REFERENCES channel_partners(id),
    -- Detail opportunity
    name                    VARCHAR(500)        NOT NULL,
    stage                   opportunity_stage   NOT NULL DEFAULT 'prospecting',
    services_interested     service_type[]      NOT NULL DEFAULT '{}',
    -- Nilai & probabilitas
    expected_value          DECIMAL(15,2)       CHECK (expected_value > 0),
    win_probability         INTEGER             NOT NULL DEFAULT 10
                                                CHECK (win_probability BETWEEN 0 AND 100),
    expected_close_date     DATE,
    closed_date             DATE,               -- Actual close date
    -- Closed Lost
    lost_reason             lost_reason,
    lost_competitor         VARCHAR(255),       -- Nama kompetitor jika kalah
    -- Flags
    is_tender               BOOLEAN             NOT NULL DEFAULT FALSE,
    source                  lead_source,
    -- Follow-up
    next_action             TEXT,
    next_action_date        DATE,
    -- Catatan
    notes                   TEXT,
    -- Timestamps
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_opp_closed_lost_reason CHECK (
        stage != 'closed_lost' OR lost_reason IS NOT NULL
    ),
    CONSTRAINT chk_opp_next_action CHECK (
        stage = 'closed_won' OR stage = 'closed_lost' OR next_action IS NOT NULL
    ),
    CONSTRAINT chk_opp_win_prob_stage CHECK (
        -- Win probability harus 100 jika closed_won
        stage != 'closed_won' OR win_probability = 100
    )
);

CREATE INDEX idx_opp_company    ON opportunities (company_id);
CREATE INDEX idx_opp_sales      ON opportunities (assigned_sales_user_id);
CREATE INDEX idx_opp_stage      ON opportunities (stage) WHERE stage NOT IN ('closed_won','closed_lost');
CREATE INDEX idx_opp_partner    ON opportunities (channel_partner_id) WHERE channel_partner_id IS NOT NULL;
CREATE INDEX idx_opp_close_date ON opportunities (expected_close_date) WHERE stage NOT IN ('closed_won','closed_lost');

COMMENT ON TABLE  opportunities IS 'Pipeline deal direct dan channel. Satu record per peluang bisnis';
COMMENT ON COLUMN opportunities.is_tender IS 'TRUE = ada record terkait di tender_opportunities';


-- =============================================================================
-- 5. TENDER_OPPORTUNITIES
--    Detail tender untuk opportunity dengan is_tender = TRUE
-- =============================================================================
CREATE TABLE tender_opportunities (
    id                      BIGSERIAL       PRIMARY KEY,
    opportunity_id          BIGINT          NOT NULL UNIQUE REFERENCES opportunities(id) ON DELETE CASCADE,
    -- Identitas tender
    tender_name             VARCHAR(500)    NOT NULL,
    contracting_entity      VARCHAR(255)    NOT NULL,           -- Nama instansi/BUMN
    tender_source           tender_source   NOT NULL,
    lpse_url                TEXT,
    -- Nilai
    hps_value               DECIMAL(15,2),                      -- Harga Perkiraan Sendiri
    -- Timeline kritis
    registration_deadline   TIMESTAMPTZ,
    aanwijzing_date         TIMESTAMPTZ,
    submission_deadline     TIMESTAMPTZ     NOT NULL,           -- Deadline utama — untuk SLA
    result_date             DATE,                               -- Estimasi pengumuman
    -- Keputusan
    go_no_go                go_no_go        NOT NULL DEFAULT 'pending',
    go_no_go_notes          TEXT,
    go_no_go_by             BIGINT          REFERENCES users(id),
    go_no_go_at             TIMESTAMPTZ,
    -- Jaminan penawaran
    bid_bond_required       BOOLEAN         NOT NULL DEFAULT FALSE,
    bid_bond_amount         DECIMAL(15,2),
    bid_bond_ref            VARCHAR(255),                       -- No. jaminan penawaran
    -- Submit
    submitted_at            TIMESTAMPTZ,
    submit_evidence_url     TEXT,                               -- Bukti submit (screenshot/PDF)
    -- Hasil
    result                  VARCHAR(20),                        -- 'menang' | 'kalah' | 'gugur'
    sppbj_number            VARCHAR(100),                       -- Surat Penunjukan PBJ
    sppbj_date              DATE,
    sppbj_url               TEXT,
    -- Kalah / gugur
    loss_reason_tender      TEXT,
    lessons_learned         TEXT,
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tender_bid_bond CHECK (
        bid_bond_required = FALSE OR bid_bond_amount IS NOT NULL
    ),
    CONSTRAINT chk_tender_sppbj CHECK (
        result != 'menang' OR sppbj_number IS NOT NULL
    )
);

CREATE INDEX idx_tender_opp         ON tender_opportunities (opportunity_id);
CREATE INDEX idx_tender_deadline    ON tender_opportunities (submission_deadline)
    WHERE result IS NULL;
CREATE INDEX idx_tender_result      ON tender_opportunities (result) WHERE result IS NOT NULL;

COMMENT ON TABLE  tender_opportunities IS 'Detail tender dan pengadaan formal. Selalu berpasangan dengan opportunities.is_tender=TRUE';
COMMENT ON COLUMN tender_opportunities.submission_deadline IS 'Digunakan untuk SLA tracking — alert H-3 dan H-1 otomatis';


-- =============================================================================
-- 6. PARTNER_COMMISSIONS
--    Komisi channel partner per deal yang berhasil
-- =============================================================================
CREATE TABLE partner_commissions (
    id                  BIGSERIAL           PRIMARY KEY,
    channel_partner_id  BIGINT              NOT NULL REFERENCES channel_partners(id),
    opportunity_id      BIGINT              NOT NULL REFERENCES opportunities(id),
    contract_id         BIGINT,             -- FK ke contracts — ditambah saat modul Contract dibuat
    trigger_invoice_id  BIGINT,             -- FK ke invoices — ditambah saat modul Invoice dibuat
    -- Komersial
    commission_type     commission_type     NOT NULL,
    gross_deal_value    DECIMAL(15,2)       NOT NULL CHECK (gross_deal_value > 0),
    commission_rate     DECIMAL(5,2)        NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
    commission_amount   DECIMAL(15,2)       NOT NULL CHECK (commission_amount >= 0),
    -- Status & approval
    status              commission_status   NOT NULL DEFAULT 'pending',
    approved_by         BIGINT              REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    payment_reference   VARCHAR(255),       -- Nomor transfer bank
    payment_notes       TEXT,
    -- Timestamps
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_pc_approved_has_approver CHECK (
        status NOT IN ('approved','paid') OR approved_by IS NOT NULL
    ),
    CONSTRAINT chk_pc_paid_has_ref CHECK (
        status != 'paid' OR payment_reference IS NOT NULL
    )
);

CREATE INDEX idx_pc_partner     ON partner_commissions (channel_partner_id);
CREATE INDEX idx_pc_status      ON partner_commissions (status) WHERE status NOT IN ('paid','cancelled');
CREATE INDEX idx_pc_opp         ON partner_commissions (opportunity_id);

COMMENT ON TABLE  partner_commissions IS 'Komisi per deal channel partner. Dibuat otomatis saat Closed Won dan invoice T1 terbayar';


-- =============================================================================
-- 7. OPPORTUNITY_ACTIVITIES
--    Log aktivitas follow-up per opportunity (timeline/history)
-- =============================================================================
CREATE TABLE opportunity_activities (
    id              BIGSERIAL   PRIMARY KEY,
    opportunity_id  BIGINT      NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id         BIGINT      NOT NULL REFERENCES users(id),
    activity_type   VARCHAR(50) NOT NULL,
    -- Nilai: call, meeting, email, whatsapp, proposal_sent, demo,
    --        stage_change, note, quotation_sent, po_received, won, lost
    stage_from      opportunity_stage,
    stage_to        opportunity_stage,
    subject         VARCHAR(500),
    notes           TEXT,
    activity_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_action     TEXT,
    next_action_date DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oa_opportunity ON opportunity_activities (opportunity_id);
CREATE INDEX idx_oa_date        ON opportunity_activities (activity_date DESC);
CREATE INDEX idx_oa_user        ON opportunity_activities (user_id);

COMMENT ON TABLE opportunity_activities IS 'Timeline aktivitas per opportunity — log follow-up, stage changes, notes';


-- =============================================================================
-- 8. SLA_TRACKING (subset untuk CRM)
--    Track SLA proses CRM: follow-up, proposal, dll
-- =============================================================================
CREATE TABLE sla_tracking (
    id                      BIGSERIAL       PRIMARY KEY,
    process_type            VARCHAR(50)     NOT NULL,
    -- Nilai: follow_up / proposal_create / hs_approve_proposal /
    --        contract_process / tender_submit / tender_alert
    entity_type             VARCHAR(50)     NOT NULL,   -- opportunity / tender_opportunity / contract / ...
    entity_id               BIGINT          NOT NULL,
    sla_target_hours        DECIMAL(8,2)    NOT NULL,
    is_working_hours_only   BOOLEAN         NOT NULL DEFAULT TRUE,
    started_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    deadline_at             TIMESTAMPTZ     NOT NULL,   -- Computed: started_at + sla_target
    is_breached             BOOLEAN         NOT NULL DEFAULT FALSE,
    breach_escalated_at     TIMESTAMPTZ,
    assigned_to_user_id     BIGINT          REFERENCES users(id),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sla_deadline CHECK (deadline_at > started_at)
);

CREATE INDEX idx_sla_entity     ON sla_tracking (entity_type, entity_id);
CREATE INDEX idx_sla_deadline   ON sla_tracking (deadline_at)
    WHERE completed_at IS NULL AND is_breached = FALSE;
CREATE INDEX idx_sla_breached   ON sla_tracking (is_breached) WHERE is_breached = TRUE;

COMMENT ON TABLE sla_tracking IS 'Timer SLA per proses. Breach check via BullMQ scheduler tiap 15 menit';


-- =============================================================================
-- 9. TRIGGERS
-- =============================================================================

-- Auto-update updated_at
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_tender_opp_updated_at
    BEFORE UPDATE ON tender_opportunities
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_cp_updated_at
    BEFORE UPDATE ON channel_partners
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_pc_updated_at
    BEFORE UPDATE ON partner_commissions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- Trigger: auto-log activity saat stage opportunity berubah
CREATE OR REPLACE FUNCTION trg_fn_log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO opportunity_activities (
            opportunity_id, user_id, activity_type,
            stage_from, stage_to, subject, activity_date
        )
        VALUES (
            NEW.id,
            COALESCE(
                current_setting('app.current_user_id', TRUE)::BIGINT,
                NEW.assigned_sales_user_id
            ),
            'stage_change',
            OLD.stage,
            NEW.stage,
            'Stage changed: ' || OLD.stage::TEXT || ' → ' || NEW.stage::TEXT,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_opp_stage_change
    AFTER UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION trg_fn_log_stage_change();


-- Trigger: auto-generate customer_id saat is_prospect jadi FALSE (klien aktif)
CREATE OR REPLACE FUNCTION trg_fn_gen_customer_id()
RETURNS TRIGGER AS $$
DECLARE
    seq_num  INTEGER;
    new_id   VARCHAR(20);
BEGIN
    IF OLD.is_prospect = TRUE AND NEW.is_prospect = FALSE
       AND NEW.customer_id IS NULL THEN
        SELECT COUNT(*) + 1
        INTO   seq_num
        FROM   companies
        WHERE  customer_id IS NOT NULL
        AND    EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

        new_id := 'DEIT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 3, '0');
        NEW.customer_id := new_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_gen_customer_id
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION trg_fn_gen_customer_id();


-- =============================================================================
-- 10. VIEWS
-- =============================================================================

-- View: pipeline aktif dengan info klien dan sales
CREATE OR REPLACE VIEW v_pipeline_active AS
SELECT
    o.id                    AS opportunity_id,
    o.name                  AS opportunity_name,
    o.stage,
    o.expected_value,
    o.win_probability,
    o.expected_close_date,
    o.next_action,
    o.next_action_date,
    o.is_tender,
    o.services_interested,
    o.created_at,
    -- Company
    c.id                    AS company_id,
    c.name                  AS company_name,
    c.client_tier,
    c.industry,
    -- Sales
    u.id                    AS sales_user_id,
    u.name                  AS sales_name,
    -- Channel partner (nullable)
    cp.id                   AS partner_id,
    cp.company_name         AS partner_name,
    cp.partner_type
FROM  opportunities   o
JOIN  companies       c   ON c.id  = o.company_id
JOIN  users           u   ON u.id  = o.assigned_sales_user_id
LEFT  JOIN channel_partners cp ON cp.id = o.channel_partner_id
WHERE o.stage NOT IN ('closed_won', 'closed_lost')
AND   c.deleted_at IS NULL;

COMMENT ON VIEW v_pipeline_active IS 'Pipeline aktif — gunakan untuk dashboard CRM dan forecast';


-- View: weighted pipeline per sales (untuk revenue forecast)
CREATE OR REPLACE VIEW v_pipeline_weighted AS
SELECT
    u.id                    AS sales_user_id,
    u.name                  AS sales_name,
    o.stage,
    COUNT(*)                AS deal_count,
    SUM(o.expected_value)   AS total_value,
    SUM(o.expected_value * o.win_probability / 100.0) AS weighted_value
FROM  opportunities o
JOIN  users         u ON u.id = o.assigned_sales_user_id
WHERE o.stage NOT IN ('closed_won', 'closed_lost')
AND   o.expected_value IS NOT NULL
GROUP BY u.id, u.name, o.stage;

COMMENT ON VIEW v_pipeline_weighted IS 'Weighted pipeline per sales — sumber KPI revenue forecast';


-- View: tender aktif dengan countdown deadline
CREATE OR REPLACE VIEW v_tender_active AS
SELECT
    t.id                    AS tender_id,
    o.id                    AS opportunity_id,
    o.name                  AS opportunity_name,
    t.tender_name,
    t.contracting_entity,
    t.tender_source,
    t.hps_value,
    t.go_no_go,
    t.submission_deadline,
    EXTRACT(EPOCH FROM (t.submission_deadline - NOW())) / 86400.0 AS days_remaining,
    t.aanwijzing_date,
    t.result,
    -- Company
    c.name                  AS company_name,
    c.client_tier,
    -- Sales
    u.name                  AS sales_name
FROM  tender_opportunities t
JOIN  opportunities        o ON o.id = t.opportunity_id
JOIN  companies            c ON c.id = o.company_id
JOIN  users                u ON u.id = o.assigned_sales_user_id
WHERE t.result IS NULL      -- Tender masih aktif
AND   t.go_no_go = 'go';

COMMENT ON VIEW v_tender_active IS 'Tender aktif dengan sisa waktu — sumber alert H-3 dan H-1';


-- =============================================================================
-- 11. HELPER FUNCTIONS
-- =============================================================================

-- Fungsi: generate partner_code otomatis
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS VARCHAR AS $$
DECLARE
    seq_num     INTEGER;
    new_code    VARCHAR(20);
BEGIN
    SELECT COUNT(*) + 1
    INTO   seq_num
    FROM   channel_partners
    WHERE  EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    new_code := 'CP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 3, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Fungsi: hitung win probability berdasarkan stage (auto-suggest)
CREATE OR REPLACE FUNCTION suggested_win_probability(p_stage opportunity_stage)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE p_stage
        WHEN 'prospecting'      THEN 10
        WHEN 'qualified'        THEN 25
        WHEN 'quotation_sent'   THEN 40
        WHEN 'negotiation'      THEN 60
        WHEN 'po_received'      THEN 85
        WHEN 'closed_won'       THEN 100
        WHEN 'closed_lost'      THEN 0
        ELSE 10
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fungsi: tentukan client_tier berdasarkan industry dan asset_band
CREATE OR REPLACE FUNCTION calculate_client_tier(
    p_industry   industry_type,
    p_asset_band VARCHAR
)
RETURNS client_tier AS $$
BEGIN
    -- Tier S: Bank BUKU III/IV, BUMN strategis, aset >10T
    IF p_asset_band = '>10T' OR p_industry IN ('Banking') THEN
        RETURN 'S';
    END IF;
    -- Tier D: Pemerintah
    IF p_industry = 'Pemerintah' THEN
        RETURN 'D';
    END IF;
    -- Tier B: SME
    IF p_asset_band IN ('<500M', '500M-2T') THEN
        RETURN 'B';
    END IF;
    -- Tier A: default standard
    RETURN 'A';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_client_tier IS 'Kalkulasi client tier awal — Pre-Sales dapat override setelah validasi';


-- =============================================================================
-- END OF SCHEMA
-- Tables:    channel_partners, companies, contacts, opportunities,
--            tender_opportunities, partner_commissions,
--            opportunity_activities, sla_tracking
-- Views:     v_pipeline_active, v_pipeline_weighted, v_tender_active
-- Functions: generate_partner_code, suggested_win_probability,
--            calculate_client_tier
--            trg_fn_log_stage_change, trg_fn_gen_customer_id
-- =============================================================================
