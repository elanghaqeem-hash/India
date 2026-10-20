-- AI provider settings (no plaintext provider credentials in D1).
-- Apply to the INDIA D1 binding before opening the admin menu.
CREATE TABLE IF NOT EXISTS india_ai_providers (
 provider_id TEXT PRIMARY KEY CHECK(provider_id IN ('openai','gemini','anthropic','groq','openrouter','deepseek')),
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
CREATE TABLE IF NOT EXISTS india_ai_config_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_email TEXT NOT NULL,
 provider_id TEXT NOT NULL,
 action TEXT NOT NULL,
 happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_time ON india_ai_config_audit(happened_at);
