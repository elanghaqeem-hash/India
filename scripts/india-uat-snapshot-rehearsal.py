#!/usr/bin/env python3
"""Local-only rehearsal of the module 13–15 migrations on an exported UAT SQL file.
Never contacts Cloudflare; never overwrites an existing output directory.
Prints hashes/counts only, never row contents. Requires the canonical 0014 baseline.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def columns(db, table):
    return [r[1] for r in db.execute('PRAGMA table_info(' + quoted(table) + ')')]


def state(db, original_columns):
    output = {}
    for table, names in original_columns.items():
        query = 'SELECT ' + ','.join(map(quoted, names)) + ' FROM ' + quoted(table)
        rows = [json.dumps(tuple(row), ensure_ascii=True, separators=(',', ':'),
                           default=lambda b: {'hex': b.hex()}) for row in db.execute(query)]
        digest = hashlib.sha256(json.dumps(names).encode())
        for row in sorted(rows):
            digest.update(row.encode())
            digest.update(b'\n')
        output[table] = {'rows': len(rows), 'sha256': digest.hexdigest()}
    return output


def statements(text):
    pending = ''
    for char in text:
        pending += char
        if char == ';' and sqlite3.complete_statement(pending):
            yield pending
            pending = ''
    if re.sub(r'--[^\n]*', '', pending).strip():
        raise ValueError('Incomplete migration SQL')


def versions(db):
    return [r[0] for r in db.execute('SELECT version FROM india_schema_migrations ORDER BY version')]


def integrity(db):
    violations = len(db.execute('PRAGMA foreign_key_check').fetchall())
    quick = db.execute('PRAGMA quick_check').fetchone()[0]
    if violations or quick != 'ok':
        raise ValueError('Foreign key / quick_check validation failed')
    return {'foreign_key_violations': violations, 'quick_check': quick}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup_sql', type=Path)
    parser.add_argument('output_directory', type=Path)
    args = parser.parse_args()
    payload = args.backup_sql.read_bytes()
    if not payload:
        raise ValueError('Empty backup')
    sql = payload.decode('utf-8')
    if re.search(r'^\s*(?:BEGIN(?: TRANSACTION| IMMEDIATE)?|COMMIT|END TRANSACTION)\s*;', sql, re.M):
        raise ValueError('Backup has explicit transaction boundaries; review before restoring')
    args.output_directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    baseline = sqlite3.connect(args.output_directory / 'baseline.sqlite')
    baseline.executescript('BEGIN IMMEDIATE;\n' + sql + '\nCOMMIT;')
    baseline.execute('PRAGMA foreign_keys=ON')
    names = [r[0] for r in baseline.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")]
    original_columns = {t: columns(baseline, t) for t in names}
    before = state(baseline, original_columns)
    current = versions(baseline)
    if not current or max(current) != 14:
        raise ValueError('Require canonical 0014 UAT baseline; no automatic repair/backfill')
    root = Path(__file__).resolve().parents[1]
    plan = sorted(p for p in (root / 'migrations').glob('*.sql') if 15 <= int(p.name[:4]) <= 26)
    if [int(p.name[:4]) for p in plan] != list(range(15, 27)):
        raise ValueError('Missing or duplicate migration 0015–0026')
    report = {'scope': 'LOCAL_ONLY: restore exported SQL and rehearse migrations; not remote restore/migration',
              'backup_sha256': hashlib.sha256(payload).hexdigest(), 'backup_bytes': len(payload),
              'baseline_tables': len(names), 'baseline_rows': sum(r['rows'] for r in before.values()),
              'baseline_versions': current, 'baseline_integrity': integrity(baseline),
              'migration_plan': [{'path': 'migrations/' + p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in plan]}
    for label, inject in [('late_failure_rollback', True), ('migration_success', False)]:
        db = sqlite3.connect(args.output_directory / (label + '.sqlite'))
        baseline.backup(db)
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE')
        try:
            for path in plan:
                for statement in statements(path.read_text()):
                    db.execute(statement)
            if inject:
                db.execute('INSERT INTO __india_injected_missing_table VALUES(1)')
            db.commit()
        except sqlite3.OperationalError as error:
            db.rollback()
            if not inject or '__india_injected_missing_table' not in str(error):
                raise
        after = state(db, original_columns)
        changed = [t for t in names if before[t] != after[t]]
        added = {t: [n for n in columns(db, t) if n not in original_columns[t]] for t in names}
        added = {t: n for t, n in added.items() if n}
        allowed = set() if inject else {'india_schema_migrations', 'india_schema_file_manifest'}
        if set(changed) - allowed:
            raise ValueError('Unexpected legacy data changes: ' + ','.join(sorted(set(changed) - allowed)))
        expected_added = {} if inject else {'india_sales_negotiations': ['communication_id']}
        if added != expected_added:
            raise ValueError('Unexpected legacy column changes: ' + json.dumps(added))
        if inject:
            if versions(db) != current or db.execute("SELECT count(*) FROM sqlite_master WHERE name='india_partner_records'").fetchone()[0]:
                raise ValueError('Rollback left partial migration state')
        elif max(versions(db)) != 26:
            raise ValueError('Migration ledger incomplete')
        report[label] = {'status': 'PASS', **integrity(db), 'versions': versions(db),
                         'legacy_tables_preserved_exactly_on_original_columns': len(names) - len(changed),
                         'changed_metadata_tables': changed, 'expected_added_columns': added}
        db.close()
    baseline.close()
    (args.output_directory / 'evidence.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
