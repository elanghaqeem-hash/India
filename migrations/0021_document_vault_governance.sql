-- P0 Document Vault governance + pre-release originals. Additive after 0015; 0016–0020 reserved by PR #24.
-- No original or ciphertext from 0015 is changed or deleted.
CREATE TABLE india_document_governance (
 document_id TEXT PRIMARY KEY REFERENCES india_document_vault(id),
 tenant_id TEXT NOT NULL,
 opportunity_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version > 0),
 retention_until TEXT CHECK(retention_until IS NULL OR (length(retention_until)=10 AND date(retention_until)=retention_until)),
 legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
 hold_reason TEXT,
 updated_by TEXT,
 updated_at TEXT,
 UNIQUE(tenant_id, opportunity_id, kind, version)
);
-- Backfill exact historical original versions, preserving source rows and checksums.
INSERT INTO india_document_governance(document_id,tenant_id,opportunity_id,kind,version)
 SELECT id,tenant_id,opportunity_id,kind,
 row_number() OVER (PARTITION BY tenant_id,opportunity_id,kind ORDER BY created_at,id)
 FROM india_document_vault;
CREATE INDEX idx_india_governance_retention ON india_document_governance(retention_until,legal_hold);
CREATE TABLE india_document_library (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('nda','rks','kak','quotation','supporting')),
 version INTEGER NOT NULL CHECK(version > 0),
 file_name TEXT NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
 media_type TEXT NOT NULL, byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 8388608),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 iv TEXT NOT NULL CHECK(length(iv)=16),
 chunk_count INTEGER NOT NULL CHECK(chunk_count BETWEEN 1 AND 33),
 retention_until TEXT CHECK(retention_until IS NULL OR (length(retention_until)=10 AND date(retention_until)=retention_until)),
 legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
 hold_reason TEXT, updated_by TEXT, updated_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 UNIQUE(tenant_id,opportunity_id,kind,version)
);
CREATE INDEX idx_india_library_opp ON india_document_library(tenant_id,opportunity_id,kind,version);
CREATE INDEX idx_india_library_retention ON india_document_library(retention_until,legal_hold);
CREATE TABLE india_document_library_chunks (
 document_id TEXT NOT NULL REFERENCES india_document_library(id),
 part INTEGER NOT NULL CHECK(part BETWEEN 0 AND 32),
 ciphertext TEXT NOT NULL CHECK(length(ciphertext) BETWEEN 4 AND 349528),
 PRIMARY KEY(document_id,part)
);
CREATE TRIGGER india_library_chunk_parent BEFORE INSERT ON india_document_library_chunks
 WHEN NOT EXISTS(SELECT 1 FROM india_document_library WHERE id=NEW.document_id AND NEW.part<chunk_count)
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: library document chunk mismatch'); END;
CREATE TRIGGER india_library_update_guard BEFORE UPDATE OF id,tenant_id,opportunity_id,kind,version,file_name,media_type,byte_length,sha256,iv,chunk_count,created_by,created_at ON india_document_library
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_library_delete_guard BEFORE DELETE ON india_document_library
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_library_chunk_update BEFORE UPDATE ON india_document_library_chunks
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TRIGGER india_library_chunk_delete BEFORE DELETE ON india_document_library_chunks
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: original document is immutable'); END;
CREATE TABLE india_document_access_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 opportunity_id TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('release','library')),
 document_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('UPLOAD','DOWNLOAD','RETENTION_SET','LEGAL_HOLD_SET','LEGAL_HOLD_RELEASE')),
 actor_email TEXT NOT NULL,
 actor_role TEXT NOT NULL,
 description TEXT,
 event_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_india_document_events ON india_document_access_events(tenant_id,opportunity_id,event_at DESC);
CREATE TRIGGER india_document_event_update BEFORE UPDATE ON india_document_access_events
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: audit is immutable'); END;
CREATE TRIGGER india_document_event_delete BEFORE DELETE ON india_document_access_events
 BEGIN SELECT RAISE(ABORT,'FLOW_CONFLICT: audit is immutable'); END;
INSERT INTO india_schema_migrations(version) VALUES(21);
