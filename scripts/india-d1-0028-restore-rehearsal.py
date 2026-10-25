#!/usr/bin/env python3
"""Restore a native Cloudflare D1 SQL export into memory, and rehearse 0028.
No Cloudflare writes, no live credentials, no plaintext rows or PII in output.
Never use this tool to infer that physical UAT or human signoff has passed.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def statements(content):
    pending = ""
    for line in content.splitlines(keepends=True):
        for character in line:
            pending += character
            if character == ";" and sqlite3.complete_statement(pending):
                yield pending
                pending = ""
    require(not re.sub(r"--[^\n]*", "", pending).strip(), "SQL contains unfinished statement")


def tables(connection):
    return sorted(row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
    ))


def snapshot(connection, projection=None):
    result = {}
    for name in (sorted(projection) if projection is not None else tables(connection)):
        safe = '"' + name.replace('"', '""') + '"'
        rows = []
        selection = ",".join('"'+c.replace('"', '""')+'"' for c in projection[name]) if projection is not None else "*"
        for row in connection.execute("SELECT " + selection + " FROM " + safe):
            normalized = [
                {"blob_sha256": hashlib.sha256(x).hexdigest()} if isinstance(x, bytes) else x for x in row
            ]
            rows.append(json.dumps(normalized, ensure_ascii=True, separators=(",", ":"), default=str))
        digest = hashlib.sha256()
        for value in sorted(rows):
            digest.update(value.encode())
            digest.update(b"\n")
        result[name] = {"rows": len(rows), "sha256": digest.hexdigest()}
    return result


def state(connection):
    versions = [r[0] for r in connection.execute(
        "SELECT version FROM india_schema_migrations ORDER BY version"
    )]
    manifest = [r[0] for r in connection.execute(
        "SELECT path FROM india_schema_file_manifest ORDER BY path"
    )]
    quick = connection.execute("PRAGMA quick_check").fetchone()[0]
    fks = len(connection.execute("PRAGMA foreign_key_check").fetchall())
    require(quick == "ok" and fks == 0, "SQLite integrity/foreign key check failed")
    return versions, manifest


def clone(source):
    target = sqlite3.connect(":memory:")
    source.backup(target)
    target.execute("PRAGMA foreign_keys=ON")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup_sql", type=Path)
    parser.add_argument("--migration", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--source-bookmark", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    require(re.fullmatch(r"[0-9a-f]{64}", args.expected_sha256 or ""), "SHA-256 pinned value mandatory")
    require(re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}", args.source_bookmark or ""),
            "Native Cloudflare bookmark is required")
    require(args.output.resolve() != args.backup_sql.resolve(), "Refusing to overwrite original backup")
    require(not args.output.exists(), "Evidence file already exists; never overwrite previous proof")
    payload = args.backup_sql.read_bytes()
    require(len(payload) >= 100 and len(payload) <= 500_000_000, "Backup size out of bounds")
    checksum = hashlib.sha256(payload).hexdigest()
    require(checksum == args.expected_sha256, "Original SQL backup checksum mismatch")
    migration = args.migration.read_text(encoding="utf8")
    require("migrations/0028_ai_mistral_provider.sql" in migration, "Unexpected migration file")
    require("VALUES(28)" in migration, "Expected 0028 ledger write absent")

    db = sqlite3.connect(":memory:")
    db.executescript(payload.decode("utf8"))
    db.execute("PRAGMA foreign_keys=ON")
    before_v, before_paths = state(db)
    require(before_v and max(before_v) == 27 and 28 not in before_v,
            "Input must be a PRE-0028 SQL backup from the isolated clone")
    require("migrations/0028_ai_mistral_provider.sql" not in before_paths,
            "Input backup already includes 0028")
    before = snapshot(db)
    require("india_ai_providers" in before, "Provider table absent from backup")
    original_providers = list(db.execute(
        "SELECT provider_id, model, priority, enabled, key_iv, key_ciphertext, tested_at, tested_ok, updated_at, updated_by FROM india_ai_providers ORDER BY provider_id"
    ))
    original_trigger_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'"
    ).fetchone()[0]

    failed = clone(db)
    failed.execute("BEGIN IMMEDIATE")
    injected = False
    try:
        for statement in statements(migration):
            failed.execute(statement)
        failed.execute("INSERT INTO __india_intentional_failure_missing_table VALUES(1)")
        failed.commit()
    except sqlite3.OperationalError as error:
        failed.rollback()
        require("__india_intentional_failure_missing_table" in str(error),
                "Unexpected migration error, not controlled failure injection")
        injected = True
    require(injected, "Failure injection did not trigger")
    require(state(failed)[0] == before_v and state(failed)[1] == before_paths,
            "Rollback changed source ledger/manifest")
    require(snapshot(failed) == before, "Rollback changed original tables or rows")

    passed = clone(db)
    passed.execute("BEGIN IMMEDIATE")
    for statement in statements(migration):
        passed.execute(statement)
    passed.commit()
    after_v, after_paths = state(passed)
    require(max(after_v) == 28 and after_v.count(28) == 1, "Migration ledger 0028 missing/duplicated")
    require(after_paths.count("migrations/0028_ai_mistral_provider.sql") == 1,
            "Migration manifest 0028 missing/duplicated")
    providers = list(passed.execute(
        "SELECT provider_id, model, priority, enabled, key_iv, key_ciphertext, tested_at, tested_ok, updated_at, updated_by FROM india_ai_providers ORDER BY provider_id"
    ))
    require([p for p in providers if p[0] != "mistral"] == original_providers,
            "Existing provider configs, ciphertext or timestamps changed")
    require(len([p for p in providers if p[0] == "mistral" and p[3] == 0 and p[5] is None]) == 1,
            "Mistral must be disabled without API key")
    require(passed.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'").fetchone()[0] ==
            original_trigger_count, "Existing database triggers changed")
    after = snapshot(passed)
    protected = set(before) - {"india_schema_migrations", "india_schema_file_manifest", "india_ai_providers"}
    require(all(before[t] == after[t] for t in protected),
            "Migration changed original business/financial tables")
    report = {
        "scope": "INDEPENDENT_LOCAL_SQL_EXPORT_RESTORE_REHEARSAL",
        "result": "PASS",
        "source_bookmark": args.source_bookmark,
        "backup_sha256": checksum,
        "backup_bytes": len(payload),
        "baseline_version": max(before_v),
        "rehearsal_version": max(after_v),
        "legacy_tables_preserved": len(protected),
        "legacy_data_preserved": True,
        "provider_ciphertext_and_metadata_preserved": True,
        "migration_rollback_after_injected_failure": "PASS",
        "sqlite_integrity": "PASS",
        "note": "Does not prove live Cloudflare Access, physical Android, production backup, actual Finance transactions or signoff.",
    }
    args.output.write_text(json.dumps(report, sort_keys=True, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, sort_keys=True))
    failed.close()
    passed.close()
    db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"result": "BLOCKED_OR_FAIL", "reason": str(error)[:190]}), file=sys.stderr)
        sys.exit(2)
