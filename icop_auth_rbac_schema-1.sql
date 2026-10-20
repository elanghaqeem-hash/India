-- =============================================================================
-- ICOP DefendIT360 — Auth & RBAC Schema
-- PostgreSQL 16 | BRD v2.0
-- Generated: 2026-05-25
-- =============================================================================
-- Konvensi:
--   - snake_case untuk semua nama
--   - Primary key: BIGSERIAL
--   - Timestamps: TIMESTAMPTZ DEFAULT NOW()
--   - Soft delete: deleted_at TIMESTAMPTZ (nullable)
--   - RLS diaktifkan untuk tabel sensitif
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email


-- =============================================================================
-- 1. ROLES
--    Daftar role sistem — internal & client
-- =============================================================================
CREATE TABLE roles (
    id              BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL UNIQUE,   -- slug: head_sales, pentest_lead
    display_name    VARCHAR(100)    NOT NULL,
    is_client_role  BOOLEAN         NOT NULL DEFAULT FALSE,
    description     TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  roles IS 'Daftar role sistem ICOP — internal karyawan & user klien portal';
COMMENT ON COLUMN roles.is_client_role IS 'TRUE untuk client_maker dan client_approver';


-- -----------------------------------------------------------------------------
-- Seed: 18 roles sesuai BRD v2.0 Bab 5
-- -----------------------------------------------------------------------------
INSERT INTO roles (name, display_name, is_client_role, description) VALUES
    ('super_admin',       'Super Admin',            FALSE, 'Full access, konfigurasi sistem, user management. MFA wajib.'),
    ('head_sales',        'Head Sales',             FALSE, 'Approve proposal, revenue dashboard, approve diskon, kelola channel partner.'),
    ('sales',             'Sales / AM',             FALSE, 'CRM, buat prospect/quotation, kelola tender, input deal channel.'),
    ('pre_sales',         'Pre-Sales',              FALSE, 'Edit scope teknis, kalibrasi pricing, jalankan Pricing Wizard.'),
    ('channel_partner',   'Channel Partner (Mitra)',FALSE, 'Portal partner: status deal referral, komisi, dokumen mitra.'),
    ('project_manager',   'Project Manager',        FALSE, 'Project plan, resource, milestone, BoQ internal monitor.'),
    ('pentest_lead',      'Pentest Lead',           FALSE, 'Scoping, assign member, kompilasi laporan VAPT.'),
    ('pentest_member',    'Pentest Member',         FALSE, 'Input findings via VAPT system, upload evidence.'),
    ('approval_pentest',  'Approval Pentest',       FALSE, 'Quality gate: scoping, project plan, laporan final VAPT.'),
    ('soc_lead',          'SOC Lead',               FALSE, 'Kelola ops SOC via API bridge, approve monthly report.'),
    ('soc_analyst',       'SOC Analyst',            FALSE, 'Handle tiket dari sistem SOC, update status.'),
    ('finance',           'Finance',                FALSE, 'Invoice, faktur pajak, konfirmasi pembayaran, BoQ margin monitor.'),
    ('collection',        'Collection',             FALSE, 'Aging report, dunning, promise-to-pay tracking.'),
    ('admin_legal',       'Admin / Legal',          FALSE, 'Generate kontrak, upload dokumen signed, kelola template.'),
    ('strategic_legal',   'Strategic / Legal',      FALSE, 'Review kontrak risiko tinggi, compliance calendar.'),
    ('hr',                'HR',                     FALSE, 'Data karyawan, onboarding SME, KPI tracking, timesheet.'),
    ('management',        'Management',             FALSE, 'Executive dashboard, final approval threshold tinggi, semua KPI.'),
    ('client_maker',      'Klien Maker',            TRUE,  'Submit request, download laporan, view portal. Hanya data perusahaan sendiri.'),
    ('client_approver',   'Klien Approver',         TRUE,  'Approve token debet, acknowledge laporan, riwayat token.');


-- =============================================================================
-- 2. PERMISSIONS
--    Hak akses per module + action
-- =============================================================================
CREATE TABLE permissions (
    id          BIGSERIAL   PRIMARY KEY,
    module      VARCHAR(50) NOT NULL,   -- crm, pricing, contract, project, finance, ...
    action      VARCHAR(50) NOT NULL,   -- create, read, update, delete, approve, export
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_perm_module_action UNIQUE (module, action)
);

CREATE INDEX idx_perm_module_action ON permissions (module, action);

COMMENT ON TABLE permissions IS 'Definisi hak akses atomik per modul dan aksi';


-- -----------------------------------------------------------------------------
-- Seed: Permissions per modul (lengkap semua modul Fase 1 + berikutnya)
-- -----------------------------------------------------------------------------
INSERT INTO permissions (module, action, description) VALUES
    -- AUTH & USER MANAGEMENT
    ('users',       'create',   'Buat user baru'),
    ('users',       'read',     'Lihat data user'),
    ('users',       'update',   'Edit data user'),
    ('users',       'delete',   'Nonaktifkan / hapus user'),
    ('users',       'manage_roles', 'Assign/ubah role user'),
    -- CRM
    ('crm',         'create',   'Tambah prospek / lead baru'),
    ('crm',         'read',     'Lihat data CRM dan pipeline'),
    ('crm',         'update',   'Edit data prospek / opportunity'),
    ('crm',         'delete',   'Hapus / archive lead'),
    ('crm',         'approve',  'Approve qualify opportunity'),
    ('crm',         'export',   'Export data CRM'),
    -- TENDER
    ('tender',      'create',   'Daftarkan tender baru'),
    ('tender',      'read',     'Lihat pipeline tender'),
    ('tender',      'update',   'Update status / dokumen tender'),
    ('tender',      'go_no_go', 'Buat keputusan Go/No-Go tender'),
    -- PRICING ENGINE
    ('pricing',     'create',   'Jalankan Pricing Wizard / buat BoQ'),
    ('pricing',     'read',     'Lihat hasil kalkulasi harga'),
    ('pricing',     'update',   'Kalibrasi / edit hasil pricing'),
    ('pricing',     'approve',  'Approve harga di luar standard'),
    -- PROPOSAL & QUOTATION
    ('proposal',    'create',   'Buat proposal baru'),
    ('proposal',    'read',     'Lihat proposal'),
    ('proposal',    'update',   'Edit draft proposal'),
    ('proposal',    'approve',  'Approve / reject proposal (Head Sales)'),
    ('proposal',    'send',     'Kirim quotation ke klien'),
    -- CONTRACT
    ('contract',    'create',   'Generate draft PKS / NDA'),
    ('contract',    'read',     'Lihat dokumen kontrak'),
    ('contract',    'update',   'Edit / revisi kontrak'),
    ('contract',    'approve',  'Approve kontrak (Management, deal >250jt)'),
    ('contract',    'sign',     'Kirim / proses e-sign'),
    -- CHANNEL PARTNER
    ('channel',     'create',   'Onboard mitra baru'),
    ('channel',     'read',     'Lihat data mitra dan deal channel'),
    ('channel',     'update',   'Update data mitra'),
    ('channel',     'approve',  'Approve onboarding mitra (Management)'),
    ('channel',     'commission_view', 'Lihat komisi channel partner'),
    -- PROJECT DELIVERY
    ('project',     'create',   'Buat project baru dari kontrak aktif'),
    ('project',     'read',     'Lihat detail project'),
    ('project',     'update',   'Update project plan / milestone'),
    ('project',     'approve',  'Approve laporan final (Approval Pentest)'),
    ('project',     'close',    'Close project dan trigger invoice T3'),
    -- FINANCE & INVOICING
    ('finance',     'create',   'Buat invoice / faktur pajak'),
    ('finance',     'read',     'Lihat data keuangan dan invoice'),
    ('finance',     'update',   'Update status pembayaran'),
    ('finance',     'approve',  'Approve invoice >100jt (Finance Mgr)'),
    ('finance',     'export',   'Export laporan keuangan'),
    -- COLLECTION
    ('collection',  'read',     'Lihat aging report'),
    ('collection',  'update',   'Update janji bayar / dunning status'),
    -- SOC
    ('soc',         'read',     'Lihat data SOC / incidents'),
    ('soc',         'update',   'Update status incident'),
    ('soc',         'approve',  'Approve monthly SOC report'),
    -- KPI & ANALYTICS
    ('kpi',         'read',     'Lihat dashboard KPI'),
    ('kpi',         'export',   'Export laporan KPI'),
    -- HR
    ('hr',          'create',   'Tambah data karyawan / SME'),
    ('hr',          'read',     'Lihat data HR dan sertifikasi'),
    ('hr',          'update',   'Update data karyawan / timesheet'),
    -- COMPLIANCE
    ('compliance',  'read',     'Lihat compliance calendar'),
    ('compliance',  'update',   'Update status item compliance'),
    -- AUDIT TRAIL
    ('audit',       'read',     'Lihat audit log'),
    ('audit',       'export',   'Export audit trail'),
    -- ADMIN / SYSTEM
    ('admin',       'read',     'Akses panel admin'),
    ('admin',       'update',   'Update konfigurasi sistem'),
    ('admin',       'manage',   'Full system management'),
    -- CLIENT PORTAL (khusus role klien)
    ('portal',      'read',     'Akses portal klien'),
    ('portal',      'download', 'Download laporan / dokumen'),
    ('portal',      'approve',  'Approve (token debet, acknowledge laporan)');


-- =============================================================================
-- 3. ROLE_PERMISSIONS
--    Junction table: many-to-many roles ↔ permissions
-- =============================================================================
CREATE TABLE role_permissions (
    role_id         BIGINT  NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   BIGINT  NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_rp_role       ON role_permissions (role_id);
CREATE INDEX idx_rp_permission ON role_permissions (permission_id);

COMMENT ON TABLE role_permissions IS 'Mapping many-to-many antara role dan permission';


-- -----------------------------------------------------------------------------
-- Helper function: assign permissions ke role berdasarkan nama
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_permission(
    p_role_name       VARCHAR,
    p_module          VARCHAR,
    p_action          VARCHAR
) RETURNS VOID AS $$
BEGIN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM   roles r, permissions p
    WHERE  r.name   = p_role_name
    AND    p.module = p_module
    AND    p.action = p_action
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- Seed: Mapping role → permissions sesuai BRD Bab 5
-- -----------------------------------------------------------------------------

-- SUPER ADMIN: semua permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- HEAD SALES
SELECT assign_permission('head_sales', 'crm',       'read');
SELECT assign_permission('head_sales', 'crm',       'update');
SELECT assign_permission('head_sales', 'crm',       'approve');
SELECT assign_permission('head_sales', 'crm',       'export');
SELECT assign_permission('head_sales', 'tender',    'read');
SELECT assign_permission('head_sales', 'tender',    'go_no_go');
SELECT assign_permission('head_sales', 'proposal',  'read');
SELECT assign_permission('head_sales', 'proposal',  'approve');
SELECT assign_permission('head_sales', 'channel',   'read');
SELECT assign_permission('head_sales', 'channel',   'update');
SELECT assign_permission('head_sales', 'channel',   'commission_view');
SELECT assign_permission('head_sales', 'kpi',       'read');
SELECT assign_permission('head_sales', 'kpi',       'export');

-- SALES / AM
SELECT assign_permission('sales', 'crm',        'create');
SELECT assign_permission('sales', 'crm',        'read');
SELECT assign_permission('sales', 'crm',        'update');
SELECT assign_permission('sales', 'tender',     'create');
SELECT assign_permission('sales', 'tender',     'read');
SELECT assign_permission('sales', 'tender',     'update');
SELECT assign_permission('sales', 'proposal',   'create');
SELECT assign_permission('sales', 'proposal',   'read');
SELECT assign_permission('sales', 'proposal',   'update');
SELECT assign_permission('sales', 'proposal',   'send');
SELECT assign_permission('sales', 'channel',    'read');
SELECT assign_permission('sales', 'kpi',        'read');

-- PRE-SALES
SELECT assign_permission('pre_sales', 'crm',       'read');
SELECT assign_permission('pre_sales', 'pricing',   'create');
SELECT assign_permission('pre_sales', 'pricing',   'read');
SELECT assign_permission('pre_sales', 'pricing',   'update');
SELECT assign_permission('pre_sales', 'proposal',  'read');
SELECT assign_permission('pre_sales', 'proposal',  'update');

-- CHANNEL PARTNER (mitra — akses terbatas portal)
SELECT assign_permission('channel_partner', 'channel',  'read');
SELECT assign_permission('channel_partner', 'channel',  'commission_view');
SELECT assign_permission('channel_partner', 'portal',   'read');
SELECT assign_permission('channel_partner', 'portal',   'download');

-- PROJECT MANAGER
SELECT assign_permission('project_manager', 'project',  'create');
SELECT assign_permission('project_manager', 'project',  'read');
SELECT assign_permission('project_manager', 'project',  'update');
SELECT assign_permission('project_manager', 'crm',      'read');
SELECT assign_permission('project_manager', 'contract', 'read');
SELECT assign_permission('project_manager', 'kpi',      'read');

-- PENTEST LEAD
SELECT assign_permission('pentest_lead', 'project',  'read');
SELECT assign_permission('pentest_lead', 'project',  'update');
SELECT assign_permission('pentest_lead', 'crm',      'read');
SELECT assign_permission('pentest_lead', 'contract', 'read');

-- PENTEST MEMBER
SELECT assign_permission('pentest_member', 'project', 'read');

-- APPROVAL PENTEST
SELECT assign_permission('approval_pentest', 'project',  'read');
SELECT assign_permission('approval_pentest', 'project',  'approve');

-- SOC LEAD
SELECT assign_permission('soc_lead', 'soc',      'read');
SELECT assign_permission('soc_lead', 'soc',      'update');
SELECT assign_permission('soc_lead', 'soc',      'approve');
SELECT assign_permission('soc_lead', 'project',  'read');
SELECT assign_permission('soc_lead', 'kpi',      'read');

-- SOC ANALYST
SELECT assign_permission('soc_analyst', 'soc', 'read');
SELECT assign_permission('soc_analyst', 'soc', 'update');

-- FINANCE
SELECT assign_permission('finance', 'finance',    'create');
SELECT assign_permission('finance', 'finance',    'read');
SELECT assign_permission('finance', 'finance',    'update');
SELECT assign_permission('finance', 'finance',    'approve');
SELECT assign_permission('finance', 'finance',    'export');
SELECT assign_permission('finance', 'collection', 'read');
SELECT assign_permission('finance', 'project',    'read');
SELECT assign_permission('finance', 'kpi',        'read');

-- COLLECTION
SELECT assign_permission('collection', 'collection', 'read');
SELECT assign_permission('collection', 'collection', 'update');
SELECT assign_permission('collection', 'finance',    'read');

-- ADMIN / LEGAL
SELECT assign_permission('admin_legal', 'contract',   'create');
SELECT assign_permission('admin_legal', 'contract',   'read');
SELECT assign_permission('admin_legal', 'contract',   'update');
SELECT assign_permission('admin_legal', 'contract',   'sign');
SELECT assign_permission('admin_legal', 'channel',    'create');
SELECT assign_permission('admin_legal', 'channel',    'read');
SELECT assign_permission('admin_legal', 'channel',    'update');
SELECT assign_permission('admin_legal', 'crm',        'read');

-- STRATEGIC / LEGAL
SELECT assign_permission('strategic_legal', 'contract',    'read');
SELECT assign_permission('strategic_legal', 'contract',    'approve');
SELECT assign_permission('strategic_legal', 'compliance',  'read');
SELECT assign_permission('strategic_legal', 'compliance',  'update');

-- HR
SELECT assign_permission('hr', 'hr',         'create');
SELECT assign_permission('hr', 'hr',         'read');
SELECT assign_permission('hr', 'hr',         'update');
SELECT assign_permission('hr', 'compliance', 'read');
SELECT assign_permission('hr', 'kpi',        'read');

-- MANAGEMENT
SELECT assign_permission('management', 'crm',        'read');
SELECT assign_permission('management', 'crm',        'approve');
SELECT assign_permission('management', 'proposal',   'read');
SELECT assign_permission('management', 'proposal',   'approve');
SELECT assign_permission('management', 'contract',   'read');
SELECT assign_permission('management', 'contract',   'approve');
SELECT assign_permission('management', 'channel',    'approve');
SELECT assign_permission('management', 'finance',    'read');
SELECT assign_permission('management', 'finance',    'approve');
SELECT assign_permission('management', 'kpi',        'read');
SELECT assign_permission('management', 'kpi',        'export');
SELECT assign_permission('management', 'audit',      'read');
SELECT assign_permission('management', 'audit',      'export');
SELECT assign_permission('management', 'compliance', 'read');

-- CLIENT MAKER (portal klien)
SELECT assign_permission('client_maker', 'portal', 'read');
SELECT assign_permission('client_maker', 'portal', 'download');

-- CLIENT APPROVER (portal klien)
SELECT assign_permission('client_approver', 'portal', 'read');
SELECT assign_permission('client_approver', 'portal', 'download');
SELECT assign_permission('client_approver', 'portal', 'approve');


-- =============================================================================
-- 4. USERS
--    Akun pengguna — internal DEIT & klien portal (dipisah via is_client)
-- =============================================================================
CREATE TABLE users (
    id                  BIGSERIAL       PRIMARY KEY,
    email               CITEXT          NOT NULL UNIQUE,  -- case-insensitive
    password_hash       VARCHAR(255)    NOT NULL,          -- bcrypt, cost >= 12
    name                VARCHAR(255)    NOT NULL,
    role_id             BIGINT          NOT NULL REFERENCES roles(id),
    company_id          BIGINT,           -- NULL = karyawan internal DEIT
                                          -- FK ke companies akan ditambah saat tabel companies dibuat (Modul CRM)
    is_client           BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    mfa_enabled         BOOLEAN         NOT NULL DEFAULT FALSE,
    mfa_secret          TEXT,             -- TOTP secret, encrypted at rest (AES-256)
    mfa_backup_codes    TEXT[],           -- Array of hashed backup codes
    last_login_at       TIMESTAMPTZ,
    failed_login_count  INTEGER         NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,      -- NULL = tidak dikunci
    password_changed_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,      -- Soft delete
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_client_has_company CHECK (
        -- Klien wajib punya company_id; internal boleh NULL
        (is_client = TRUE  AND company_id IS NOT NULL) OR
        (is_client = FALSE)
    ),
    CONSTRAINT chk_mfa_secret CHECK (
        -- Jika MFA diaktifkan, secret harus ada
        (mfa_enabled = FALSE) OR
        (mfa_enabled = TRUE AND mfa_secret IS NOT NULL)
    )
);

CREATE INDEX idx_users_email       ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_company     ON users (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_users_role        ON users (role_id);
CREATE INDEX idx_users_active      ON users (is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE  users IS 'Akun pengguna ICOP — karyawan internal dan user klien portal';
COMMENT ON COLUMN users.company_id IS 'NULL untuk user internal DEIT. FK ke companies ditambah saat modul CRM dibuat.';
COMMENT ON COLUMN users.mfa_secret IS 'TOTP secret terenkripsi AES-256 di application layer sebelum disimpan';
COMMENT ON COLUMN users.locked_until IS 'Account lock setelah 5x failed login. NULL = tidak dikunci';


-- =============================================================================
-- 5. SESSIONS
--    Session management — JWT / opaque token tracking
-- =============================================================================
CREATE TABLE sessions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255)    NOT NULL UNIQUE,  -- SHA-256 dari raw token
    refresh_hash    VARCHAR(255)    UNIQUE,           -- SHA-256 dari refresh token
    ip_address      INET,
    user_agent      TEXT,
    device_name     VARCHAR(255),    -- "Chrome / MacBook", "Mobile Android"
    is_revoked      BOOLEAN         NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMPTZ     NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user      ON sessions (user_id);
CREATE INDEX idx_sessions_token     ON sessions (token_hash) WHERE is_revoked = FALSE;
CREATE INDEX idx_sessions_expires   ON sessions (expires_at) WHERE is_revoked = FALSE;

COMMENT ON TABLE  sessions IS 'Session aktif — invalidasi on logout, expiry, atau revoke manual';
COMMENT ON COLUMN sessions.token_hash IS 'SHA-256 dari access token — raw token TIDAK disimpan';


-- =============================================================================
-- 6. AUDIT_LOGS
--    Immutable append-only audit trail — tidak boleh di-UPDATE atau DELETE
-- =============================================================================
CREATE TABLE audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      REFERENCES users(id),       -- NULL = aksi sistem/otomatis
    action      VARCHAR(50) NOT NULL,
    -- Nilai action: LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGE,
    --   MFA_ENABLE, MFA_DISABLE, ROLE_CHANGE, USER_CREATE, USER_DEACTIVATE,
    --   CREATE, UPDATE, DELETE, APPROVE, REJECT, EXPORT, LOCK, UNLOCK
    entity_type VARCHAR(50) NOT NULL,                   -- users, roles, contracts, ...
    entity_id   BIGINT,
    old_value   JSONB,                                  -- Snapshot sebelum perubahan
    new_value   JSONB,                                  -- Snapshot sesudah perubahan
    ip_address  INET,
    user_agent  TEXT,
    session_id  UUID        REFERENCES sessions(id),
    row_hash    VARCHAR(64) NOT NULL,                   -- SHA-256(id||user_id||action||entity_type||entity_id||created_at)
    prev_hash   VARCHAR(64),                            -- Hash row sebelumnya — hash chain integrity
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()      -- Immutable clock timestamp
);

CREATE INDEX idx_audit_entity   ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_user     ON audit_logs (user_id);
CREATE INDEX idx_audit_created  ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_action   ON audit_logs (action);

COMMENT ON TABLE  audit_logs IS 'Immutable audit trail — TIDAK BOLEH UPDATE/DELETE. Hash chain untuk deteksi manipulasi.';
COMMENT ON COLUMN audit_logs.row_hash  IS 'SHA-256 dari konten row untuk integritas';
COMMENT ON COLUMN audit_logs.prev_hash IS 'Hash row sebelumnya — membangun chain untuk deteksi manipulasi retroaktif';

-- Proteksi: Cabut hak UPDATE dan DELETE dari semua role kecuali superuser
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;


-- =============================================================================
-- 7. PASSWORD_RESET_TOKENS
--    Token reset password — expire 1 jam, single-use
-- =============================================================================
CREATE TABLE password_reset_tokens (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,    -- SHA-256 dari raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,                     -- NULL = belum dipakai
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_user    ON password_reset_tokens (user_id);
CREATE INDEX idx_prt_expires ON password_reset_tokens (expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE password_reset_tokens IS 'Token reset password — single-use, expiry 1 jam';


-- =============================================================================
-- 8. MFA_CHALLENGES
--    Log challenge MFA — deteksi brute force TOTP
-- =============================================================================
CREATE TABLE mfa_challenges (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge   VARCHAR(255) NOT NULL,           -- Encoded challenge / nonce
    is_verified BOOLEAN     NOT NULL DEFAULT FALSE,
    ip_address  INET,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_user    ON mfa_challenges (user_id);
CREATE INDEX idx_mfa_expires ON mfa_challenges (expires_at) WHERE is_verified = FALSE;

COMMENT ON TABLE mfa_challenges IS 'Challenge MFA sementara — expire 5 menit, invalidasi setelah verified';


-- =============================================================================
-- 9. TRIGGERS — auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- 10. ROW-LEVEL SECURITY (RLS)
--     Isolasi data per company_id untuk user klien di Client Portal
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: User internal (is_client=FALSE) bisa baca semua user aktif
CREATE POLICY users_internal_read ON users
    FOR SELECT
    USING (
        current_setting('app.is_client', TRUE)::BOOLEAN IS DISTINCT FROM TRUE
    );

-- Policy: User klien hanya bisa baca user di company mereka sendiri
CREATE POLICY users_client_isolation ON users
    FOR SELECT
    USING (
        company_id = current_setting('app.company_id', TRUE)::BIGINT
    );

COMMENT ON TABLE users IS 'RLS aktif — user klien hanya bisa akses data company mereka sendiri';


-- =============================================================================
-- 11. VIEWS — Helper untuk aplikasi
-- =============================================================================

-- View: user lengkap dengan nama role
CREATE OR REPLACE VIEW v_users_with_role AS
SELECT
    u.id,
    u.email,
    u.name,
    u.is_client,
    u.is_active,
    u.mfa_enabled,
    u.last_login_at,
    u.failed_login_count,
    u.locked_until,
    u.company_id,
    u.deleted_at,
    u.created_at,
    r.id            AS role_id,
    r.name          AS role_name,
    r.display_name  AS role_display_name,
    r.is_client_role
FROM  users u
JOIN  roles r ON r.id = u.role_id
WHERE u.deleted_at IS NULL;

COMMENT ON VIEW v_users_with_role IS 'User aktif dengan info role — gunakan di aplikasi untuk reduce JOIN';


-- View: permission set lengkap per user (flat list untuk middleware check)
CREATE OR REPLACE VIEW v_user_permissions AS
SELECT
    u.id        AS user_id,
    u.email,
    u.role_id,
    r.name      AS role_name,
    p.module,
    p.action,
    p.module || ':' || p.action AS permission_key  -- e.g. 'crm:create'
FROM  users u
JOIN  roles            r  ON r.id  = u.role_id
JOIN  role_permissions rp ON rp.role_id = r.id
JOIN  permissions      p  ON p.id  = rp.permission_id
WHERE u.deleted_at IS NULL
AND   u.is_active  = TRUE;

COMMENT ON VIEW v_user_permissions IS 'Flat list permission per user aktif — cache di Redis per user_id';


-- =============================================================================
-- 12. SEED — Super Admin default (untuk initial setup)
-- =============================================================================
-- CATATAN: Ganti password ini SEGERA setelah first login!
-- Password sementara: "DefendIT360!ChangeMe" → hash bcrypt cost 12
INSERT INTO users (email, password_hash, name, role_id, is_client, mfa_enabled)
SELECT
    'superadmin@defendit360.id',
    '$2b$12$PLACEHOLDER_REPLACE_WITH_REAL_BCRYPT_HASH',   -- WAJIB diganti sebelum deploy
    'Super Administrator',
    r.id,
    FALSE,
    FALSE   -- MFA harus diaktifkan saat first login
FROM roles r
WHERE r.name = 'super_admin'
ON CONFLICT (email) DO NOTHING;


-- =============================================================================
-- CLEANUP HELPER FUNCTION
-- =============================================================================

-- Fungsi: hapus session expired (jalankan via cron / BullMQ scheduler)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE expires_at < NOW()
    AND   is_revoked = FALSE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fungsi: unlock account yang sudah melewati masa lock
CREATE OR REPLACE FUNCTION auto_unlock_accounts()
RETURNS INTEGER AS $$
DECLARE
    unlocked_count INTEGER;
BEGIN
    UPDATE users
    SET    failed_login_count = 0,
           locked_until       = NULL,
           updated_at         = NOW()
    WHERE  locked_until IS NOT NULL
    AND    locked_until < NOW();

    GET DIAGNOSTICS unlocked_count = ROW_COUNT;
    RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions  IS 'Jalankan tiap jam via BullMQ scheduler';
COMMENT ON FUNCTION auto_unlock_accounts      IS 'Jalankan tiap 15 menit via BullMQ scheduler';


-- =============================================================================
-- END OF SCHEMA
-- Tables created: roles, permissions, role_permissions, users,
--                 sessions, audit_logs, password_reset_tokens, mfa_challenges
-- Views created:  v_users_with_role, v_user_permissions
-- Functions:      assign_permission, trigger_set_updated_at,
--                 cleanup_expired_sessions, auto_unlock_accounts
-- =============================================================================
