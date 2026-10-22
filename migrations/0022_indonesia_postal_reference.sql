-- Migration number reserved after pending INDIA 0021 sequence; reconcile with open PRs before merge.
-- Reference master (not customer data); import using scripts/import-indonesia-postal.py.
-- Safe additive D1 migration. Populate UAT first; never ship an empty reference silently.
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
