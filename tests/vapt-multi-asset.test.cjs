const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const ts = require('typescript');
const root = join(__dirname, '..');
const source = file => readFileSync(join(root, file), 'utf8');

// Compile the real TypeScript pricing rules and multi-asset adapter for deterministic tests.
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const js = ts.transpileModule(source(file), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;
  const mod = {exports: {}};
  cache.set(file, mod.exports);
  const execute = new Function('require', 'module', 'exports', js);
  execute(name => {
    if (name === './scoping-calculator') return load('src/lib/scoping-calculator.ts');
    throw Error('Unexpected test dependency: ' + name);
  }, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}
const {
  createVaptAsset, calculateVaptAssetMandays, calculateVaptPortfolio,
  validateVaptAssets, vaptAssetBoqLines
} = load('src/lib/vapt-multi-asset.ts');

test('mixed VAPT categories have independent estimates and a reproducible total', () => {
  const web = createVaptAsset('web', 'web_app'); // 5 MD base + 0.5 extra role
  const api = createVaptAsset('api', 'api'); // 4 MD endpoints + 2 MD missing docs
  const mobile = createVaptAsset('mobile', 'mobile_app'); // both platforms, screens
  assert.equal(calculateVaptAssetMandays(web), 5.5);
  assert.equal(calculateVaptAssetMandays(api), 6);
  assert.equal(calculateVaptAssetMandays(mobile), 11);
  const scope = [web, api, mobile];
  assert.deepEqual(validateVaptAssets(scope), []);
  assert.equal(calculateVaptPortfolio(scope).total_md, 22.5);
  const lines = vaptAssetBoqLines(scope);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map(line => line.quantity), [5.5, 6, 11]);
  assert.ok(lines.every(line => line.unit === 'MD' && line.service_type === 'VAPT'));
  assert.ok(lines.every(line => !('unit_price' in line)), 'scope never invents prices');
});

test('repeated same-category assets retain separate identity and compliance effort', () => {
  const first = createVaptAsset('bank1', 'web_app');
  first.name = 'Core Banking';
  first.asset_count = 2;
  first.is_financial_compliance = true;
  const second = createVaptAsset('bank2', 'web_app');
  second.name = 'Internet Banking';
  second.web_complexity = 'critical';
  assert.equal(calculateVaptAssetMandays(first), 15);
  assert.equal(calculateVaptAssetMandays(second), 12.5);
  const lines = vaptAssetBoqLines([first, second]);
  assert.equal(lines.length, 2);
  assert.match(lines[0].description, /Core Banking/);
  assert.match(lines[1].description, /Internet Banking/);
  assert.equal(calculateVaptPortfolio([first, second]).total_md, 27.5);
});

test('invalid rows, duplicate identifiers, empty scope and overlong scope are blocked', () => {
  assert.notEqual(validateVaptAssets([]).length, 0);
  const a = createVaptAsset('reused', 'api');
  const b = createVaptAsset('reused', 'web_app');
  assert.match(validateVaptAssets([a, b]).join(' '), /duplikat/);
  a.api_n_endpoints = 0;
  assert.match(validateVaptAssets([a]).join(' '), /minimal 1/);
  assert.throws(() => vaptAssetBoqLines([a]));
  a.api_n_endpoints = 15;
  a.asset_count = 101;
  assert.match(validateVaptAssets([a]).join(' '), /1–100/);
  const tooMany = Array.from({length: 31}, (_, index) => createVaptAsset('row-' + index));
  assert.match(validateVaptAssets(tooMany).join(' '), /Maksimal 30/);
});

test('multi-asset editor and BoQ import preserve per-asset rows and approval control', () => {
  const page = source('src/app/scoping/page.tsx');
  const ui = source('src/components/VaptMultiAssetScope.tsx');
  const boq = source('src/app/boq/page.tsx');
  assert.match(page, /<VaptMultiAssetScope/);
  assert.match(page, /vaptAssetBoqLines\(vaptAssets\)/);
  assert.match(page, /version: 2/);
  assert.match(ui, /Tambah Aset VAPT Lainnya/);
  assert.match(ui, /Duplikasi/);
  assert.match(ui, /Hapus/);
  assert.match(boq, /draft.version===2/);
  assert.match(boq, /line_items:items/);
  assert.match(boq, /unit_price:0/);
  assert.match(boq, /Simpan ke D1/);
  assert.match(boq, /Submit Approval/);
});
