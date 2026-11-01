// Rehearsal of migration 0050 (tenant key defendit360 -> rti) on a database populated by real application flows.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { fixture, won, invoice, operation, today, expect } = require('./helpers/service-operations-fixture.cjs');
const root = path.resolve(__dirname, '..');
const M50 = fs.readFileSync(path.join(root, 'migrations/0050_rti_tenant_key.sql'), 'utf8');

function snapshot(sql) {
  const tables = sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t => t.name);
  const tenantTables = tables.filter(t => sql.prepare(`PRAGMA table_info("${t}")`).all().some(c => c.name === 'tenant_id'));
  return {
    counts: Object.fromEntries(tables.filter(t => t !== 'india_schema_migrations' && t !== 'india_schema_file_manifest').map(t => [t, sql.prepare(`SELECT count(*) n FROM "${t}"`).get().n])),
    triggers: sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all().map(x => x.name + '|' + x.sql),
    tenantTables,
  };
}
// Turn the synthetic dataset into a "production-like" legacy dataset that carries the old key.
// Vault originals are re-sealed so their AES-GCM additional data is bound to the legacy key, exactly like production.
async function toLegacy(h, sql, tenantTables, triggers) {
  const vault = h.load('src/lib/document-vault.ts');
  const docs = sql.prepare('SELECT * FROM india_document_vault').all();
  const plain = []; for (const d of docs) plain.push(await vault.openDocument(h, d));
  const resealed = []; for (let i = 0; i < docs.length; i++) resealed.push(await vault.sealDocument({ ...docs[i], tenant_id: 'defendit360' }, plain[i]));
  sql.exec('BEGIN'); sql.exec('PRAGMA defer_foreign_keys=ON');
  for (const t of triggers) sql.exec(`DROP TRIGGER "${t.name}"`);
  for (const t of tenantTables) sql.exec(`UPDATE "${t}" SET tenant_id='defendit360' WHERE tenant_id='rti'`);
  docs.forEach((d, i) => { sql.prepare('UPDATE india_document_vault SET iv=? WHERE id=?').run(resealed[i].iv, d.id); sql.prepare('DELETE FROM india_document_chunks WHERE document_id=?').run(d.id); resealed[i].chunks.forEach((c, p) => sql.prepare('INSERT INTO india_document_chunks(document_id,part,ciphertext) VALUES(?,?,?)').run(d.id, p, c)); });
  for (const t of triggers) sql.exec(t.sql);
  sql.exec('COMMIT');
}

test('0050 moves every tenant row to rti, preserves rows, triggers, FKs and keeps the app working', async () => {
  const h = await won(fixture(49)); try {
    const inv = await invoice(h, 400_000);
    const pay = await expect(operation(h, 'finance', 'payment', { invoice_id: inv.id, document_id: inv.document, payment_date: today(), reference: 'MIG-REF-01', amount_idr: 510_000 }), 201);
    await expect(operation(h, 'approver', 'review_payment', { id: pay.body.id, approve: true, notes: 'Bank statement independently matched' }), 201);
    const before = snapshot(h.sql);
    const triggerRows = h.sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
    await toLegacy(h, h.sql, before.tenantTables, triggerRows);
    // Under the old key, a reader that only knows the new key could not authenticate these originals
    const legacyDoc = h.sql.prepare('SELECT * FROM india_document_vault LIMIT 1').get();
    assert.equal(legacyDoc.tenant_id, 'defendit360');
    const legacyRows = before.tenantTables.reduce((n, t) => n + h.sql.prepare(`SELECT count(*) n FROM "${t}" WHERE tenant_id='defendit360'`).get().n, 0);
    assert.ok(legacyRows > 30, 'legacy dataset populated: ' + legacyRows);
    // Apply 0050 exactly as shipped, inside one transaction (D1 executes a migration file atomically)
    h.sql.exec('BEGIN'); h.sql.exec(M50.replace(/PRAGMA defer_foreign_keys = (on|off);/g, m => m.endsWith('on;') ? 'PRAGMA defer_foreign_keys=ON;' : '')); h.sql.exec('COMMIT');
    const after = snapshot(h.sql);
    assert.deepEqual(after.counts, before.counts, 'row counts unchanged');
    assert.deepEqual(after.triggers, before.triggers, 'triggers recreated verbatim');
    for (const t of after.tenantTables) assert.equal(h.sql.prepare(`SELECT count(*) n FROM "${t}" WHERE tenant_id!='rti'`).get().n, 0, t);
    assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(h.sql.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=50').get().n, 1);
    // Immutability triggers are active again after the migration
    assert.throws(() => h.sql.prepare("UPDATE india_billing_payments SET amount_cents=1 WHERE id=?").run(pay.body.id), /constraint|IMMUTABLE|CHECK|ABORT/i);
    // Application reads the migrated data with the new key
    // Documents sealed under the old key stay readable (AES-GCM AAD fallback to the legacy tenant key)
    const vault = h.load('src/lib/document-vault.ts');
    const oldDocs = h.sql.prepare('SELECT * FROM india_document_vault').all();
    assert.ok(oldDocs.length >= 3);
    for (const d of oldDocs) assert.equal(d.tenant_id, 'rti');
    for (const d of oldDocs) assert.equal((await vault.openDocument(h, d)).length, d.byte_length);
    // A tampered binding still fails closed
    await assert.rejects(vault.openDocument(h, { ...oldDocs[0], opportunity_id: 'opp-other' }));
    // (a second BAST + invoice on the existing migrated project only succeeds if the project is found under 'rti')
    const inv2 = await invoice(h, 400_000);
    assert.equal(h.sql.prepare('SELECT tenant_id FROM india_billing_invoices WHERE id=?').get(inv2.id).tenant_id, 'rti');
    assert.equal(h.sql.prepare("SELECT count(*) n FROM india_billing_invoices WHERE tenant_id='rti'").get().n, 2);
  } finally { h.close(); }
});
