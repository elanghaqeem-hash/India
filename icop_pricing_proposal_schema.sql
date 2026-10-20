-- =============================================================================
-- ICOP DefendIT360 — Pricing Engine, Proposal & BoQ Schema
-- Modul 3A: Pricing Engine | Modul 4: Quotation ke Kontrak
-- PostgreSQL 16 | BRD v2.0
-- Generated: 2026-05-25
-- Dependency: icop_auth_rbac_schema.sql + icop_crm_schema.sql
-- =============================================================================

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE proposal_status AS ENUM (
    'draft',
    'pending_approval',     -- Menunggu Head Sales approve
    'approved',             -- Head Sales approve, siap dikirim
    'sent',                 -- Quotation sudah dikirim ke klien
    'accepted',             -- Klien setuju
    'rejected',             -- Ditolak Head Sales
    'expired',              -- Melewati valid_until tanpa respons
    'cancelled'
);

CREATE TYPE payment_terms AS ENUM (
    '30-50-20',             -- Standard aktual dari quotation
    '30-60-10',             -- Dari PKS
    '50-50',                -- 2 termin
    '100'                   -- Full di awal
);

CREATE TYPE price_range AS ENUM ('floor', 'standard', 'premium');

CREATE TYPE vapt_type AS ENUM (
    'web_app', 'mobile_app', 'api', 'network_infra', 'red_team', 'source_code'
);

CREATE TYPE box_method AS ENUM ('black_box', 'grey_box', 'white_box');

CREATE TYPE location_type AS ENUM (
    'remote', 'jabotabek', 'luar_jabotabek', 'overseas'
);

CREATE TYPE role_level AS ENUM (
    'project_manager', 'lead', 'senior', 'junior', 'forensic', 'sme_external',
    'soc_analyst_l1', 'soc_analyst_l2', 'cti_analyst'
);


-- =============================================================================
-- 1. PRICING_SESSIONS
--    Satu sesi Pricing Wizard per opportunity — bisa ada multiple versi
-- =============================================================================
CREATE TABLE pricing_sessions (
    id              BIGSERIAL       PRIMARY KEY,
    opportunity_id  BIGINT          NOT NULL REFERENCES opportunities(id),
    created_by      BIGINT          NOT NULL REFERENCES users(id),  -- Pre-Sales / Sales
    version         INTEGER         NOT NULL DEFAULT 1,
    service_type    service_type    NOT NULL,  -- VAPT / SOC / CTI / dll
    client_tier     client_tier     NOT NULL,
    tier_multiplier DECIMAL(5,3)    NOT NULL,  -- S=1.3-1.5, A=1.0, B=0.85-0.95, C=2.0, D=0.7-0.9, E=0.75-0.85
    location_type   location_type   NOT NULL DEFAULT 'remote',
    -- Total MD (VAPT) atau EPS (SOC) atau footprint_score (CTI)
    total_md        DECIMAL(8,2),
    total_eps       INTEGER,
    footprint_score INTEGER,
    -- Tiga range harga output
    floor_price     DECIMAL(15,2),      -- Internal Cost / (1 - 20%)
    standard_price  DECIMAL(15,2),      -- Rate Card x Tier Multiplier
    premium_price   DECIMAL(15,2),      -- Standard x 1.25
    -- Internal cost total (BoQ A+B+C+D+E)
    total_internal_cost DECIMAL(15,2),
    selected_range  price_range,        -- Range yang dipilih Pre-Sales
    final_price     DECIMAL(15,2),      -- Harga final (bisa di antara range)
    -- Status
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,  -- FALSE = diganti versi baru
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pricing_opp_version UNIQUE (opportunity_id, version)
);

CREATE INDEX idx_ps_opportunity ON pricing_sessions (opportunity_id);
CREATE INDEX idx_ps_active      ON pricing_sessions (opportunity_id) WHERE is_active = TRUE;

COMMENT ON TABLE  pricing_sessions IS 'Sesi Pricing Wizard per opportunity. Satu aktif per opportunity, versi sebelumnya diarsip';
COMMENT ON COLUMN pricing_sessions.tier_multiplier IS 'S=1.3-1.5, A=1.0, B=0.85-0.95, C=2.0-2.5, D=0.7-0.9, E=0.75-0.85';
COMMENT ON COLUMN pricing_sessions.floor_price     IS 'FLOOR = Total Internal Cost / (1 - 0.20). Tidak boleh lebih rendah tanpa Management approve';
COMMENT ON COLUMN pricing_sessions.premium_price   IS 'PREMIUM = Standard x 1.25. Untuk Tier S, rush, atau scope sangat kompleks';


-- =============================================================================
-- 2. PRICING_VAPT_INPUTS
--    Parameter input wizard VAPT per sesi
-- =============================================================================
CREATE TABLE pricing_vapt_inputs (
    id                  BIGSERIAL   PRIMARY KEY,
    pricing_session_id  BIGINT      NOT NULL REFERENCES pricing_sessions(id) ON DELETE CASCADE,
    vapt_type           vapt_type   NOT NULL,
    line_number         INTEGER     NOT NULL DEFAULT 1,  -- Urutan jika multi-asset

    -- Web App
    web_complexity      VARCHAR(20),    -- simple/medium/complex/critical
    web_n_modules       INTEGER,
    web_n_roles         INTEGER,
    web_n_api_endpoints INTEGER,
    web_auth_type       VARCHAR(30),    -- basic/sso/mfa/smartcard
    web_compliance      TEXT[],         -- OWASP/SEOJK/PCI-DSS, multi-select

    -- Mobile App
    mobile_platform     VARCHAR(20),    -- android/ios/both
    mobile_complexity   VARCHAR(20),
    mobile_n_screens    INTEGER,
    mobile_has_api      BOOLEAN,
    mobile_n_api        INTEGER,
    mobile_feature      VARCHAR(30),    -- basic/payment/biometric/offline

    -- API / Web Service
    api_n_endpoints     INTEGER,
    api_has_docs        BOOLEAN,        -- Swagger/Postman tersedia?

    -- Network / Infra
    net_n_external_ip   INTEGER,
    net_n_internal_host INTEGER,
    net_has_ad          BOOLEAN DEFAULT FALSE,
    net_has_wifi        BOOLEAN DEFAULT FALSE,
    net_n_wifi_cluster  INTEGER,
    net_n_firewalls     INTEGER,
    net_n_cloud_accounts INTEGER,

    -- Red Team
    redteam_scope       VARCHAR(30),    -- assumed_breach/limited/standard/full_apt

    -- Shared params
    box_method          box_method      NOT NULL DEFAULT 'grey_box',
    has_is_financial    BOOLEAN         NOT NULL DEFAULT FALSE,  -- Trigger critical minimum

    -- Kalkulasi MD (output wizard)
    calculated_md       DECIMAL(8,2),

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pvi_session ON pricing_vapt_inputs (pricing_session_id);

COMMENT ON TABLE pricing_vapt_inputs IS 'Input parameter wizard VAPT per asset/scope. Bisa ada multiple rows per sesi (multi-asset)';


-- =============================================================================
-- 3. PRICING_SOC_INPUTS
--    Parameter input wizard SOC/MDR
-- =============================================================================
CREATE TABLE pricing_soc_inputs (
    id                  BIGSERIAL   PRIMARY KEY,
    pricing_session_id  BIGINT      NOT NULL UNIQUE REFERENCES pricing_sessions(id) ON DELETE CASCADE,

    -- EPS Estimation
    n_servers           INTEGER     NOT NULL DEFAULT 0,
    n_network_devices   INTEGER     NOT NULL DEFAULT 0,
    n_endpoints         INTEGER     NOT NULL DEFAULT 0,
    n_cloud_services    INTEGER     NOT NULL DEFAULT 0,
    n_web_apps          INTEGER     NOT NULL DEFAULT 0,
    has_active_directory BOOLEAN    NOT NULL DEFAULT FALSE,
    traffic_intensity   VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low/medium/high

    -- Kalkulasi EPS (output)
    estimated_eps_min   INTEGER,
    estimated_eps_max   INTEGER,
    eps_tier            VARCHAR(20),    -- micro/small/medium/large/enterprise

    -- SOC Contract params
    contract_duration_months INTEGER NOT NULL DEFAULT 12,
    service_level       VARCHAR(20) NOT NULL DEFAULT '8x5',     -- 8x5/12x5/24x7
    has_threat_hunting  BOOLEAN     NOT NULL DEFAULT FALSE,
    has_ir_retainer     BOOLEAN     NOT NULL DEFAULT FALSE,

    -- MRC output
    mrc_floor           DECIMAL(15,2),
    mrc_standard        DECIMAL(15,2),
    mrc_premium         DECIMAL(15,2),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pricing_soc_inputs IS 'Input wizard SOC/MDR — estimasi EPS dan kalkulasi MRC';


-- =============================================================================
-- 4. PRICING_CTI_INPUTS
--    Parameter input wizard CTI/ETLM
-- =============================================================================
CREATE TABLE pricing_cti_inputs (
    id                  BIGSERIAL   PRIMARY KEY,
    pricing_session_id  BIGINT      NOT NULL UNIQUE REFERENCES pricing_sessions(id) ON DELETE CASCADE,

    -- Digital Footprint
    n_domains           INTEGER     NOT NULL DEFAULT 0,
    n_subsidiaries      INTEGER     NOT NULL DEFAULT 0,
    n_key_executives    INTEGER     NOT NULL DEFAULT 0,
    has_mobile_apps     BOOLEAN     NOT NULL DEFAULT FALSE,
    n_mobile_apps       INTEGER,
    has_brand_monitoring BOOLEAN    NOT NULL DEFAULT FALSE,
    industry_threat_level VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low/medium/high/critical

    -- Footprint score (output)
    footprint_score     INTEGER,
    cti_tier            VARCHAR(20),   -- basic/standard/advanced/elite

    -- Contract params
    contract_duration_months INTEGER NOT NULL DEFAULT 12,
    include_etlm        BOOLEAN     NOT NULL DEFAULT FALSE,
    include_rfi         BOOLEAN     NOT NULL DEFAULT FALSE,
    n_rfi_per_month     INTEGER     NOT NULL DEFAULT 0,

    -- MRC output
    mrc_floor           DECIMAL(15,2),
    mrc_standard        DECIMAL(15,2),
    mrc_premium         DECIMAL(15,2),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pricing_cti_inputs IS 'Input wizard CTI/ETLM — digital footprint dan kalkulasi MRC';


-- =============================================================================
-- 5. PROPOSALS
--    Quotation yang dikirim ke klien — versi-able, maker-checker
-- =============================================================================
CREATE TABLE proposals (
    id                  BIGSERIAL       PRIMARY KEY,
    opportunity_id      BIGINT          NOT NULL REFERENCES opportunities(id),
    pricing_session_id  BIGINT          REFERENCES pricing_sessions(id),
    -- Nomor & versi
    quotation_number    VARCHAR(50)     NOT NULL UNIQUE,
    -- Format: /DEIT-RCS/MMM/YYYY atau /DEIT-RCS/MMM/YYYY/REV-N
    version             INTEGER         NOT NULL DEFAULT 1,
    -- Status & approval
    status              proposal_status NOT NULL DEFAULT 'draft',
    -- Nilai
    subtotal            DECIMAL(15,2)   NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    vat_amount          DECIMAL(15,2)   NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    grand_total         DECIMAL(15,2)   NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
    -- Terms
    payment_terms       payment_terms   NOT NULL DEFAULT '30-50-20',
    valid_days          INTEGER         NOT NULL DEFAULT 14,
    valid_until         DATE            NOT NULL,
    discount_pct        DECIMAL(5,2)    NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    client_tier         client_tier     NOT NULL DEFAULT 'A',
    selected_price_range price_range,
    -- People
    created_by          BIGINT          NOT NULL REFERENCES users(id),   -- Sales
    submitted_by        BIGINT          REFERENCES users(id),            -- Sales (submit ke HS)
    submitted_at        TIMESTAMPTZ,
    approved_by         BIGINT          REFERENCES users(id),            -- Head Sales / Management
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    sent_at             TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    -- Catatan
    cover_letter        TEXT,
    internal_notes      TEXT,
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_proposal_grand_total CHECK (
        grand_total = subtotal + vat_amount
    ),
    CONSTRAINT chk_proposal_valid_until CHECK (
        valid_until >= created_at::DATE
    ),
    CONSTRAINT chk_proposal_discount_approval CHECK (
        -- Diskon >15% wajib ada approver
        discount_pct <= 15 OR approved_by IS NOT NULL
    )
);

CREATE INDEX idx_prop_opportunity  ON proposals (opportunity_id);
CREATE INDEX idx_prop_status       ON proposals (status) WHERE status NOT IN ('accepted','expired','cancelled');
CREATE INDEX idx_prop_valid        ON proposals (valid_until) WHERE status = 'sent';
CREATE INDEX idx_prop_created_by   ON proposals (created_by);

COMMENT ON TABLE  proposals IS 'Quotation ke klien. Maker=Sales, Checker=Pre-Sales, Approver=Head Sales. Diskon >15% butuh Management';
COMMENT ON COLUMN proposals.quotation_number IS 'Format: /DEIT-RCS/MMM/YYYY. Increment REV-N saat revisi';
COMMENT ON COLUMN proposals.discount_pct     IS 'Diskon >15% memerlukan approval Management sesuai BRD DoA';


-- =============================================================================
-- 6. PROPOSAL_LINE_ITEMS
--    Detail baris per layanan dalam satu proposal
-- =============================================================================
CREATE TABLE proposal_line_items (
    id              BIGSERIAL       PRIMARY KEY,
    proposal_id     BIGINT          NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    line_number     INTEGER         NOT NULL,
    service_type    service_type    NOT NULL,
    description     TEXT            NOT NULL,
    quantity        DECIMAL(8,2)    NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit            VARCHAR(50)     NOT NULL DEFAULT 'Paket',  -- Paket/MD/Bulan/Tahun
    unit_price      DECIMAL(15,2)   NOT NULL CHECK (unit_price >= 0),
    line_total      DECIMAL(15,2)   NOT NULL CHECK (line_total >= 0),
    notes           TEXT,

    CONSTRAINT uq_proposal_line UNIQUE (proposal_id, line_number),
    CONSTRAINT chk_line_total CHECK (
        ABS(line_total - (quantity * unit_price)) < 1  -- Toleransi pembulatan Rp 1
    )
);

CREATE INDEX idx_pli_proposal ON proposal_line_items (proposal_id);

COMMENT ON TABLE proposal_line_items IS 'Line item per layanan dalam proposal. Digunakan auto-fill Formulir Proyek';


-- =============================================================================
-- 7. BOQ_INTERNAL
--    BoQ Internal per proposal — komponen A+B+C+D+E
-- =============================================================================
CREATE TABLE boq_internal (
    id                  BIGSERIAL       PRIMARY KEY,
    proposal_id         BIGINT          NOT NULL UNIQUE REFERENCES proposals(id),
    project_id          BIGINT,         -- FK → projects; NULL sampai project dibuat (Fase 2)
    -- Komponen A-E
    component_a_total   DECIMAL(15,2)   NOT NULL DEFAULT 0,  -- HR cost (PM+Lead+Senior+Junior)
    component_b_total   DECIMAL(15,2)   NOT NULL DEFAULT 0,  -- Komisi sales + channel partner
    component_c_total   DECIMAL(15,2)   NOT NULL DEFAULT 2000000,  -- Dokumen (default Rp 2jt)
    component_d_total   DECIMAL(15,2)   NOT NULL DEFAULT 0,  -- Third party tools
    component_e_total   DECIMAL(15,2)   NOT NULL DEFAULT 0,  -- Akomodasi
    total_internal_cost DECIMAL(15,2)   NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (
            component_a_total + component_b_total + component_c_total +
            component_d_total + component_e_total
        ) STORED,
    -- Profitabilitas
    quoted_price        DECIMAL(15,2)   NOT NULL DEFAULT 0,  -- Harga ke klien (excl PPN)
    gross_profit        DECIMAL(15,2)   NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (quoted_price - (
            component_a_total + component_b_total + component_c_total +
            component_d_total + component_e_total
        )) STORED,
    gross_margin_pct    DECIMAL(5,2)    NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (
            CASE WHEN quoted_price > 0 THEN
                ROUND(
                    (quoted_price - (component_a_total + component_b_total +
                     component_c_total + component_d_total + component_e_total))
                    / quoted_price * 100, 2
                )
            ELSE 0 END
        ) STORED,
    margin_warning      BOOLEAN         NOT NULL DEFAULT FALSE,  -- TRUE jika margin < 25%
    location_type       location_type,
    notes               TEXT,
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boq_proposal   ON boq_internal (proposal_id);
CREATE INDEX idx_boq_warning    ON boq_internal (margin_warning) WHERE margin_warning = TRUE;

COMMENT ON TABLE  boq_internal IS 'BoQ Internal A+B+C+D+E. Margin < 25% → margin_warning=TRUE (sistem alert merah)';
COMMENT ON COLUMN boq_internal.component_a_total IS 'Total HR cost: PM + Lead + Senior + Junior + Forensic + SME';
COMMENT ON COLUMN boq_internal.component_b_total IS 'Komisi AM/Sales internal + komisi channel partner (referral fee)';
COMMENT ON COLUMN boq_internal.component_c_total IS 'Cetak laporan. Default Rp 2,000,000 per project';
COMMENT ON COLUMN boq_internal.component_d_total IS 'Third party: Nessus, Burpsuite Pro, subcon, translator, badan sertifikasi';
COMMENT ON COLUMN boq_internal.component_e_total IS 'Akomodasi: tiket, hotel, transport, meals, pocket money';


-- =============================================================================
-- 8. BOQ_HR_DETAILS
--    Detail personil per role untuk komponen A
-- =============================================================================
CREATE TABLE boq_hr_details (
    id              BIGSERIAL       PRIMARY KEY,
    boq_id          BIGINT          NOT NULL REFERENCES boq_internal(id) ON DELETE CASCADE,
    role_level      role_level      NOT NULL,
    mandays         DECIMAL(6,2)    NOT NULL DEFAULT 0 CHECK (mandays >= 0),
    daily_rate      DECIMAL(10,0)   NOT NULL CHECK (daily_rate > 0),
    -- Rate card aktual dari BRD Bab 3.1
    -- domestic:  PM=1.5jt, Lead=2jt, Senior=1jt, Junior=500rb, SME=2-4jt
    -- overseas:  PM=4jt,   Lead=4jt, Senior=3.9jt, Junior=1.5jt
    subtotal        DECIMAL(15,2)   NOT NULL DEFAULT 0
        GENERATED ALWAYS AS (mandays * daily_rate) STORED,
    location_type   location_type   NOT NULL DEFAULT 'remote',
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boq_hr_boq ON boq_hr_details (boq_id);

COMMENT ON TABLE  boq_hr_details IS 'Detail baris HR per role untuk BoQ Komponen A';
COMMENT ON COLUMN boq_hr_details.daily_rate IS 'Rate card BRD 3.1: PM=1.5jt, Lead=2jt, Senior=1jt, Junior=500rb (domestic)';


-- =============================================================================
-- 9. RATE_CARD
--    Rate card resmi — sumber kebenaran untuk semua kalkulasi
--    (Harus diisi oleh Management sebelum Pricing Engine aktif)
-- =============================================================================
CREATE TABLE rate_card (
    id              BIGSERIAL       PRIMARY KEY,
    role_level      role_level      NOT NULL,
    location_type   location_type   NOT NULL,
    rate_per_md     DECIMAL(10,0)   NOT NULL CHECK (rate_per_md > 0),
    effective_date  DATE            NOT NULL,
    expiry_date     DATE,           -- NULL = masih berlaku
    approved_by     BIGINT          NOT NULL REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_rate_card_role_location_date
        UNIQUE (role_level, location_type, effective_date)
);

CREATE INDEX idx_rc_role     ON rate_card (role_level);
CREATE INDEX idx_rc_active   ON rate_card (effective_date, expiry_date);

-- Seed rate card dari BRD 3.1
INSERT INTO rate_card (role_level, location_type, rate_per_md, effective_date, approved_by)
SELECT r.role_level, r.loc, r.rate, '2026-01-01'::DATE, u.id
FROM (VALUES
    ('project_manager'::role_level,  'remote'::location_type,    1500000),
    ('project_manager',              'jabotabek',                 1500000),
    ('project_manager',              'luar_jabotabek',            1500000),
    ('project_manager',              'overseas',                  4000000),
    ('lead'::role_level,             'remote'::location_type,    2000000),
    ('lead',                         'jabotabek',                 2000000),
    ('lead',                         'luar_jabotabek',            2000000),
    ('lead',                         'overseas',                  4000000),
    ('senior'::role_level,           'remote'::location_type,    1000000),
    ('senior',                       'jabotabek',                 1000000),
    ('senior',                       'luar_jabotabek',            1000000),
    ('senior',                       'overseas',                  3900000),
    ('junior'::role_level,           'remote'::location_type,     500000),
    ('junior',                       'jabotabek',                  500000),
    ('junior',                       'luar_jabotabek',             500000),
    ('junior',                       'overseas',                  1500000),
    ('forensic'::role_level,         'remote'::location_type,    2000000),
    ('forensic',                     'overseas',                  5000000),
    ('soc_analyst_l1'::role_level,   'jabotabek'::location_type,  700000),
    ('soc_analyst_l1',               'overseas',                  2500000),
    ('soc_analyst_l2'::role_level,   'jabotabek'::location_type, 1200000),
    ('soc_analyst_l2',               'overseas',                  3500000),
    ('cti_analyst'::role_level,      'remote'::location_type,    1500000),
    ('cti_analyst',                  'overseas',                  4000000)
) AS r(role_level, loc, rate)
CROSS JOIN (SELECT id FROM users WHERE email = 'superadmin@defendit360.id' LIMIT 1) u
ON CONFLICT DO NOTHING;

COMMENT ON TABLE rate_card IS 'Rate card resmi — WAJIB diisi dan di-approve Management sebelum Pricing Engine aktif. Sumber BRD 3.1';


-- =============================================================================
-- 10. TRIGGERS & FUNCTIONS
-- =============================================================================

-- Auto-update updated_at
CREATE TRIGGER trg_ps_updated_at
    BEFORE UPDATE ON pricing_sessions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_boq_updated_at
    BEFORE UPDATE ON boq_internal
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- Trigger: set valid_until otomatis dari valid_days saat proposal dibuat
CREATE OR REPLACE FUNCTION trg_fn_set_proposal_valid_until()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.valid_until IS NULL THEN
        NEW.valid_until := (NOW() + (NEW.valid_days || ' days')::INTERVAL)::DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proposal_valid_until
    BEFORE INSERT ON proposals
    FOR EACH ROW EXECUTE FUNCTION trg_fn_set_proposal_valid_until();


-- Trigger: auto-set margin_warning saat BoQ diupdate
CREATE OR REPLACE FUNCTION trg_fn_check_margin_warning()
RETURNS TRIGGER AS $$
BEGIN
    -- Warning jika gross margin < 25%
    NEW.margin_warning := (
        NEW.quoted_price > 0 AND
        (NEW.quoted_price - (NEW.component_a_total + NEW.component_b_total +
         NEW.component_c_total + NEW.component_d_total + NEW.component_e_total))
        / NEW.quoted_price * 100 < 25.0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_boq_margin_warning
    BEFORE INSERT OR UPDATE ON boq_internal
    FOR EACH ROW EXECUTE FUNCTION trg_fn_check_margin_warning();


-- Trigger: auto-expire proposals yang sudah melewati valid_until
-- (Dijalankan via BullMQ scheduler setiap pagi)
CREATE OR REPLACE FUNCTION expire_old_proposals()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE proposals
    SET    status     = 'expired',
           updated_at = NOW()
    WHERE  status     = 'sent'
    AND    valid_until < CURRENT_DATE;

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_proposals IS 'Jalankan via BullMQ scheduler setiap hari pukul 00:05 WIB';


-- Fungsi: generate quotation_number otomatis
CREATE OR REPLACE FUNCTION generate_quotation_number(p_version INTEGER DEFAULT 1)
RETURNS VARCHAR AS $$
DECLARE
    month_roman VARCHAR(5);
    new_number  VARCHAR(50);
    seq_num     INTEGER;
BEGIN
    month_roman := CASE EXTRACT(MONTH FROM NOW())::INTEGER
        WHEN 1  THEN 'I'    WHEN 2  THEN 'II'   WHEN 3  THEN 'III'
        WHEN 4  THEN 'IV'   WHEN 5  THEN 'V'    WHEN 6  THEN 'VI'
        WHEN 7  THEN 'VII'  WHEN 8  THEN 'VIII' WHEN 9  THEN 'IX'
        WHEN 10 THEN 'X'    WHEN 11 THEN 'XI'   WHEN 12 THEN 'XII'
    END;

    SELECT COUNT(*) + 1
    INTO   seq_num
    FROM   proposals
    WHERE  EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
    AND    EXTRACT(YEAR  FROM created_at) = EXTRACT(YEAR  FROM NOW());

    new_number := LPAD(seq_num::TEXT, 3, '0') ||
                  '/DEIT-RCS/' || month_roman ||
                  '/' || TO_CHAR(NOW(), 'YYYY');

    IF p_version > 1 THEN
        new_number := new_number || '/REV-' || (p_version - 1)::TEXT;
    END IF;

    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_quotation_number IS 'Format: NNN/DEIT-RCS/BLN-ROMAWI/YYYY. REV-N untuk revisi';


-- =============================================================================
-- 11. VIEWS
-- =============================================================================

-- View: Proposal dengan status approval dan margin info
CREATE OR REPLACE VIEW v_proposals_with_margin AS
SELECT
    p.id,
    p.quotation_number,
    p.version,
    p.status,
    p.grand_total,
    p.discount_pct,
    p.valid_until,
    p.payment_terms,
    p.client_tier,
    p.created_at,
    p.sent_at,
    p.accepted_at,
    -- Opportunity & company
    o.name          AS opportunity_name,
    c.name          AS company_name,
    c.client_tier   AS company_tier,
    -- People
    sales.name      AS created_by_name,
    approver.name   AS approved_by_name,
    -- BoQ margin
    b.total_internal_cost,
    b.quoted_price,
    b.gross_margin_pct,
    b.margin_warning,
    -- Pricing range
    ps.floor_price,
    ps.standard_price,
    ps.premium_price
FROM      proposals        p
JOIN      opportunities    o   ON o.id  = p.opportunity_id
JOIN      companies        c   ON c.id  = o.company_id
JOIN      users            sales ON sales.id = p.created_by
LEFT JOIN users            approver ON approver.id = p.approved_by
LEFT JOIN boq_internal     b   ON b.proposal_id = p.id
LEFT JOIN pricing_sessions ps  ON ps.id = p.pricing_session_id AND ps.is_active = TRUE;

COMMENT ON VIEW v_proposals_with_margin IS 'Proposal lengkap dengan info margin BoQ — alert merah jika margin_warning=TRUE';


-- View: Rate card aktif saat ini
CREATE OR REPLACE VIEW v_rate_card_active AS
SELECT
    id, role_level, location_type, rate_per_md, effective_date, notes
FROM  rate_card
WHERE effective_date <= CURRENT_DATE
AND  (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
ORDER BY role_level, location_type;

COMMENT ON VIEW v_rate_card_active IS 'Rate card yang berlaku saat ini — gunakan di Pricing Engine untuk kalkulasi';


-- =============================================================================
-- END OF SCHEMA
-- Tables:    pricing_sessions, pricing_vapt_inputs, pricing_soc_inputs,
--            pricing_cti_inputs, proposals, proposal_line_items,
--            boq_internal, boq_hr_details, rate_card
-- Views:     v_proposals_with_margin, v_rate_card_active
-- Functions: generate_quotation_number, expire_old_proposals,
--            trg_fn_set_proposal_valid_until, trg_fn_check_margin_warning
-- =============================================================================
