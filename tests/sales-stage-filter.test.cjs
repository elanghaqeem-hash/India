const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const workflow = require('../src/lib/sales-workflow.ts');
const { SALES_STAGES } = workflow;
// Node's ESM loader requires explicit extensions; transpile just this pure helper
// so the same tests work on Node 22 and Node 24 in hosted CI.
const source = fs.readFileSync(path.join(__dirname, '../src/lib/sales-stage-filter.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)((name) => {
  if (name === './sales-workflow') return workflow;
  throw Error('Unexpected dependency: ' + name);
}, mod, mod.exports);
const { buildStageFilterOptions } = mod.exports;

test('filter exposes full canonical names and IDs, not individual characters', () => {
  const options = buildStageFilterOptions([]);
  assert.equal(options.length, SALES_STAGES.length + 1);
  assert.deepEqual(options.slice(1).map(option => [option.id, option.label]),
    SALES_STAGES.map(([id, label]) => [id, label]));
  assert.equal(options[0].label, 'Semua Tahap');
  assert.ok(options.every(option => option.label.length > 2));
});

test('stage totals reflect only actual opportunity records, including won and lost', () => {
  const options = buildStageFilterOptions([
    { stage: 'prospecting' }, { stage: 'prospecting' },
    { stage: 'negotiation' }, { stage: 'closed_won' }, { stage: 'closed_lost' },
  ]);
  const byId = Object.fromEntries(options.map(option => [option.id, option.count]));
  assert.equal(byId.all, 5);
  assert.equal(byId.prospecting, 2);
  assert.equal(byId.negotiation, 1);
  assert.equal(byId.closed_won, 1);
  assert.equal(byId.closed_lost, 1);
  assert.equal(byId.quotation_sent, 0);
});

test('stage filter remains a read-only UI filter, independent of workflow mutation', () => {
  const pipeline = fs.readFileSync(path.join(__dirname, '../src/app/sales/pipeline/page.tsx'), 'utf8');
  const component = fs.readFileSync(path.join(__dirname, '../src/components/sales/StageFilter.tsx'), 'utf8');
  assert.match(pipeline, /<StageFilter deals=\{deals\} value=\{filter\} onChange=\{setFilter\}/);
  assert.doesNotMatch(pipeline, /stages\.map\(\(\[id,l\]\)/);
  assert.match(component, /aria-pressed=\{value === option\.id\}/);
  assert.match(component, /max-h-\[min\(55vh,27rem\)\]/);
  assert.match(component, /bottom-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(component, /z-\[60\]/);
  assert.match(component, /onKeyDown=/);
  assert.match(component, /document\.addEventListener\('pointerdown'/);
});
