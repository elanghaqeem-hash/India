// Guards the #113 compatibility boundary: a branding-only rename must never silently mutate the persisted D1
// tenant key. The original test pinned the literal legacy value; it now enforces the real invariant instead, so the
// key may only change together with an approved rekey migration that actually moves the existing rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync('src/lib/sales-workflow.ts', 'utf8');
const harness = fs.readFileSync('tests/helpers/sales-flow-harness.cjs', 'utf8');
const params = fs.readFileSync('src/lib/rti/parameters.ts', 'utf8');
const migrationsDir = 'migrations';

const codeKey = (source.match(/export const TENANT='([a-z0-9_-]+)';/) || [])[1];
const harnessKey = (harness.match(/tenant='([a-z0-9_-]+)'/) || [])[1];
const paramKey = (params.match(/tenant_key:\s*'([a-z0-9_-]+)'/) || [])[1];

// Every tenant rekey ever applied, oldest first, read from the shipped migrations.
const rekeys = fs.readdirSync(migrationsDir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort()
  .flatMap(f => {
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    const m = sql.match(/SET tenant_id='([a-z0-9_-]+)' WHERE tenant_id='([a-z0-9_-]+)'/);
    return m ? [{ file: f, to: m[1], from: m[2] }] : [];
  });

test('persisted D1 tenant key is never changed by branding alone', () => {
  assert.ok(codeKey, 'src/lib/sales-workflow.ts must export a literal TENANT');
  assert.equal(harnessKey, codeKey, 'test harness tenant must equal the application tenant key');
  assert.equal(paramKey, codeKey, 'Parameter Center company.tenant_key must equal the application tenant key');
  // The brand is RTI, but the brand name alone is not allowed to become the storage key.
  assert.doesNotMatch(source, /export const TENANT='RTI';/, 'the storage key is lowercase and migration-backed, not the display brand');

  const expected = rekeys.length ? rekeys[rekeys.length - 1].to : 'defendit360';
  assert.equal(codeKey, expected,
    rekeys.length
      ? `tenant key must match the last rekey migration (${rekeys[rekeys.length - 1].file})`
      : 'without a rekey migration the historical tenant key must be kept');
});

test('a rekey migration forms an unbroken chain from the historical key', () => {
  let current = 'defendit360';
  for (const r of rekeys) {
    assert.equal(r.from, current, `${r.file} must rekey from ${current}, not ${r.from}`);
    current = r.to;
  }
  assert.equal(current, codeKey, 'the rekey chain must end at the key the application uses');
});

test('the rekey migration moves every tenant-scoped table and restores every trigger', () => {
  if (!rekeys.length) return;
  const last = rekeys[rekeys.length - 1];
  const sql = fs.readFileSync(path.join(migrationsDir, last.file), 'utf8');
  const updates = (sql.match(/UPDATE "[a-z0-9_]+" SET tenant_id=/g) || []).length;
  const drops = (sql.match(/DROP TRIGGER IF EXISTS/g) || []).length;
  const creates = (sql.match(/CREATE TRIGGER/g) || []).length;
  assert.ok(updates > 100, `expected the rekey to cover every tenant table, saw ${updates}`);
  assert.equal(creates, drops, 'every dropped trigger must be recreated in the same migration');
  assert.match(sql, /PRAGMA defer_foreign_keys = on;/, 'composite foreign keys must be deferred during the rekey');
});
