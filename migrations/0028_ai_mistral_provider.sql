-- INDIA: add Mistral AI as provider #7 without modifying existing keys/statuses.
-- Apply once, after an isolated UAT backup/restore gate; do not apply to production directly.
-- Canonical 0028 follows 0027 Customer-to-Cash, preserving 0025 Feasibility.
-- D1/SQLite requires a table rebuild to extend a CHECK constraint.
-- Do not use BEGIN/COMMIT: Wrangler D1 migrations manage transaction boundaries.
CREATE TABLE india_migration_0028_dependency (ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO india_migration_0028_dependency(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM india_schema_migrations WHERE version=27) THEN 1 ELSE 0 END;
DROP TABLE india_migration_0028_dependency;

CREATE TABLE india_ai_providers_mistral (
 provider_id TEXT PRIMARY KEY CHECK(provider_id IN ('openai','gemini','anthropic','groq','openrouter','deepseek','mistral')),
 model TEXT NOT NULL,
 priority INTEGER NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 key_iv TEXT,
 key_ciphertext TEXT,
 tested_at TEXT,
 tested_ok INTEGER CHECK(tested_ok IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by TEXT NOT NULL
);

-- Preserve all provider configurations, priorities, existing ciphertext and timestamps.
INSERT INTO india_ai_providers_mistral (
 provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at,updated_by
)
SELECT provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at,updated_by
FROM india_ai_providers;

DROP TABLE india_ai_providers;
ALTER TABLE india_ai_providers_mistral RENAME TO india_ai_providers;

-- Mistral is visible in Admin but disabled until its own key passes the live probe.
INSERT INTO india_ai_providers(provider_id,model,priority,enabled,updated_by)
SELECT 'mistral','mistral-small-latest',coalesce((SELECT max(priority)+1 FROM india_ai_providers),7),0,'system:migration-0028';

INSERT INTO india_schema_file_manifest(path,source_branch)
VALUES('migrations/0028_ai_mistral_provider.sql','mistral-pr39-canonical-reconciliation');
INSERT INTO india_schema_migrations(version) VALUES(28);
