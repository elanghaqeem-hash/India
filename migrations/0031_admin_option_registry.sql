-- INDIA admin-managed dropdown options. Additive, with no production/demo seed.
CREATE TABLE india_admin_options (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 group_key TEXT NOT NULL CHECK(length(group_key) BETWEEN 2 AND 61),
 option_value TEXT NOT NULL CHECK(length(option_value) BETWEEN 2 AND 61),
 option_label TEXT NOT NULL CHECK(length(option_label) BETWEEN 2 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),
 sort_order INTEGER NOT NULL DEFAULT 100 CHECK(sort_order BETWEEN 0 AND 9999),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,group_key,option_value)
);
CREATE INDEX india_admin_options_display ON india_admin_options(tenant_id,group_key,active,sort_order,option_label);
CREATE TRIGGER india_admin_options_no_delete BEFORE DELETE ON india_admin_options
 BEGIN SELECT RAISE(ABORT,'OPTION_DELETE_FORBIDDEN_USE_DEACTIVATE'); END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0031_admin_option_registry.sql','admin-registration-center');
INSERT INTO india_schema_migrations(version) VALUES(31);
