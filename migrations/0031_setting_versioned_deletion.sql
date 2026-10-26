-- Settings deletion is a versioned, maker/checker-approved tombstone.
-- Retain the immutable settings ledger and audit trail; only hide approved tombstones from effective reads.
CREATE TABLE india_migration_0031_dependency(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO india_migration_0031_dependency(ok)
 SELECT CASE WHEN EXISTS(SELECT 1 FROM india_schema_migrations WHERE version=30) THEN 1 ELSE 0 END;
DROP TABLE india_migration_0031_dependency;

DROP VIEW india_effective_settings;
CREATE VIEW india_effective_settings AS
 SELECT s.* FROM india_setting_versions s
 WHERE s.status='approved'
 AND s.version=(
  SELECT max(x.version) FROM india_setting_versions x
  WHERE x.tenant_id=s.tenant_id AND x.kind=s.kind
    AND x.setting_key=s.setting_key AND x.status='approved'
 )
 AND coalesce(json_extract(s.data_json,'$.deleted'),0)=0;

INSERT INTO india_schema_file_manifest(path,source_branch)
 VALUES('migrations/0031_setting_versioned_deletion.sql','settings-update-delete');
INSERT INTO india_schema_migrations(version) VALUES(31);
