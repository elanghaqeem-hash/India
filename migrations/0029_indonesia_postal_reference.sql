-- Canonical INDIA 0029: rebase PR #32; never overwrite canonical migration 0022 Document Vault.
-- Reference population is a separate strictly verified, protected operation.
CREATE TABLE india_migration_0029_dependency(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO india_migration_0029_dependency(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM india_schema_migrations WHERE version=28) THEN 1 ELSE 0 END;
DROP TABLE india_migration_0029_dependency;
CREATE TABLE IF NOT EXISTS india_postal_areas (
 region_code TEXT PRIMARY KEY NOT NULL,
 postal_code TEXT NOT NULL CHECK(length(postal_code)=5),
 province_code TEXT NOT NULL,
 province_name TEXT NOT NULL,
 regency_code TEXT NOT NULL,
 regency_name TEXT NOT NULL,
 district_code TEXT NOT NULL,
 district_name TEXT NOT NULL,
 village_name TEXT NOT NULL,
 village_kind TEXT NOT NULL CHECK(village_kind IN ('Desa','Kelurahan')),
 source_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_india_postal_areas_postal
 ON india_postal_areas(postal_code,province_code,regency_code,district_code);
CREATE INDEX IF NOT EXISTS idx_india_postal_areas_regency
 ON india_postal_areas(regency_code,district_code);

-- Import state is marked ready ONLY by the importer after a complete reference load.
-- An incomplete or interrupted UAT/production import must fail closed.
CREATE TABLE IF NOT EXISTS india_postal_import_state (
 singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
 status TEXT NOT NULL CHECK(status = 'ready'),
 source_version TEXT NOT NULL,
 row_count INTEGER NOT NULL CHECK(row_count >= 80000),
 province_count INTEGER NOT NULL CHECK(province_count = 38),
 postal_count INTEGER NOT NULL CHECK(postal_count > 0),
 verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cloudflare Free-compatible format for production. One row stores all authentic
-- matching desa/kelurahan for a single 5-digit postal code. This avoids the
-- per-village secondary-index write amplification on the D1 Free daily quota.
-- The legacy village table above remains supported for UAT and existing data.
CREATE TABLE IF NOT EXISTS india_postal_lookup (
 postal_code TEXT PRIMARY KEY NOT NULL CHECK(length(postal_code)=5),
 areas_json TEXT NOT NULL CHECK(json_valid(areas_json)),
 village_count INTEGER NOT NULL CHECK(village_count>0),
 source_version TEXT NOT NULL
);

INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0029_indonesia_postal_reference.sql','pr32-canonical-reconciliation');
INSERT INTO india_schema_migrations(version) VALUES(29);
