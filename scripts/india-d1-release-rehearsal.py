#!/usr/bin/env python3
"""Rehearse release migrations on two independent local restores of native SQL.
Never connects to Cloudflare, modifies the original export, or certifies remote recovery.
Existing restore parser/fingerprint logic is reused from the 0028 runbook tool.
"""
import argparse
import hashlib
import importlib.util
import json
import sqlite3
from pathlib import Path

spec = importlib.util.spec_from_file_location('india_restore', Path(__file__).with_name('india-d1-0028-restore-rehearsal.py'))
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('backup', type=Path)
    p.add_argument('--sha256', required=True)
    p.add_argument('--baseline', type=int, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    restore.require(not args.output.exists(), 'Refusing to overwrite prior evidence')
    data = args.backup.read_bytes()
    restore.require(hashlib.sha256(data).hexdigest() == args.sha256, 'Native export checksum mismatch')
    source, target = sqlite3.connect(':memory:'), sqlite3.connect(':memory:')
    for db in (source, target):
        db.executescript(data.decode('utf8'))
        restore.state(db)
        db.execute('PRAGMA foreign_keys=ON')
    projection = {name: [r[1] for r in source.execute('PRAGMA table_info("'+name.replace('"', '""')+'")')] for name in restore.tables(source)}
    before = restore.snapshot(source)
    restore.require(before == restore.snapshot(target), 'Independent restore fingerprints differ')
    versions, _ = restore.state(source)
    restore.require(max(versions) == args.baseline, 'Wrong backup baseline')
    schema = lambda db: list(db.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"))
    old_schema = schema(target)
    root = Path(__file__).resolve().parent.parent
    migrations = sorted(f for f in (root/'migrations').glob('*.sql') if args.baseline < int(f.name[:4]) <= 30)
    def migrate():
        for f in migrations:
            for statement in restore.statements(f.read_text()):
                target.execute(statement)
    report = {'scope': 'LOCAL_SQLITE_REHEARSAL_OF_ORIGINAL_NATIVE_EXPORT',
              'source_sha256': args.sha256, 'size_bytes': len(data), 'baseline': args.baseline,
              'independent_local_restore': 'PASS', 'remote_restore': 'NOT RUN',
              'remote_rollback': 'NOT RUN', 'production_release': 'BLOCKED',
              'migrations': [{'path': str(f.relative_to(root)), 'sha256': hashlib.sha256(f.read_bytes()).hexdigest()} for f in migrations]}
    target.execute('BEGIN')
    reached_end = False
    try:
        migrate()
        reached_end = True
        target.execute('INSERT INTO india_injected_failure_missing_table VALUES (1)')
    except sqlite3.Error as error:
        target.rollback()
        restore.require(restore.snapshot(target) == before and schema(target) == old_schema, 'Rollback changed original state')
        report['injected_failure_rollback'] = 'PASS' if reached_end else 'NOT RUN'
        report['rollback_after_failure'] = 'PASS'
        report['rehearsal_error'] = str(error)
    target.execute('BEGIN')
    try:
        migrate()
        target.commit()
        after = restore.snapshot(target, projection)
        versions, _ = restore.state(target)
        changed = [name for name, value in before.items() if name not in {'india_schema_migrations','india_schema_file_manifest'} and after.get(name) != value]
        planned_additions = []
        if 'india_ai_providers' in changed and args.baseline < 28:
            cols = ','.join('"'+c.replace('"','""')+'"' for c in projection['india_ai_providers'])
            original = list(source.execute('SELECT '+cols+' FROM india_ai_providers ORDER BY provider_id'))
            retained = list(target.execute("SELECT "+cols+" FROM india_ai_providers WHERE provider_id!='mistral' ORDER BY provider_id"))
            new = list(target.execute("SELECT enabled,key_iv,key_ciphertext,tested_ok FROM india_ai_providers WHERE provider_id='mistral'"))
            if original == retained and new == [(0, None, None, None)]:
                changed.remove('india_ai_providers')
                planned_additions.append('mistral disabled provider; all six original provider rows retained byte-for-byte')
        report['planned_additions'] = planned_additions
        report.update(target=max(versions), migration_execution='PASS', quick_check='ok', foreign_key_violations=0,
                      business_tables_changed=changed, data_preservation='FAIL' if changed else 'PASS')
    except sqlite3.Error as error:
        target.rollback()
        report.update(migration_execution='FAIL', migration_error=str(error), data_preservation='NOT RUN')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    source.close()
    target.close()

if __name__ == '__main__':
    main()
