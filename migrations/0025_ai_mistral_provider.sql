-- INDIA: add Mistral AI as provider #7 without modifying existing keys/statuses.
-- Apply once, after an isolated UAT backup/restore gate; do not apply to production directly.
-- D1/SQLite requires a table rebuild to extend a CHECK constraint.
-- Do not use BEGIN/COMMIT: Wrangler D1 migrations manage transaction boundaries.
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
VALUES ('mistral','mistral-small-latest',7,0,'system:migration-0025');
