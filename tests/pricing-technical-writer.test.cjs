const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/lib/pricing-engine.ts'), 'utf8');
const page = readFileSync(join(root, 'src/app/pricing/page.tsx'), 'utf8');
const types = readFileSync(join(root, 'src/lib/types.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: 'pricing-engine.ts',
}).outputText;
const exportsObject = {};
const engineModule = { exports: exportsObject };
new Function('exports', 'module', 'require', transpiled)(exportsObject, engineModule, require);
const { RATE_CARD_COST, BASE_SELLING_RATE, calculateHRCost, calculateBoQ } = engineModule.exports;

test('technical writer is available for all locations without an invented rate', () => {
  assert.match(types, /\| 'technical_writer'/);
  for (const location of ['remote', 'jabotabek', 'luar_jabotabek', 'overseas']) {
    assert.equal(RATE_CARD_COST[location].technical_writer, 0);
  }
  assert.equal(BASE_SELLING_RATE.technical_writer, 0);
  const result = calculateHRCost([{ role_level: 'technical_writer', mandays: 3 }], 'remote');
  assert.equal(result.totalHRCost, 0);
  assert.equal(result.totalSellingBaseline, 0);
});

test('manual cost and selling rates flow through totals', () => {
  const result = calculateHRCost([
    { role_level: 'project_manager', mandays: 2 },
    { role_level: 'technical_writer', mandays: 3, cost_rate_override: 350000, selling_rate_override: 750000 },
  ], 'remote');
  assert.equal(result.details[1].daily_cost_rate, 350000);
  assert.equal(result.details[1].subtotal, 1050000);
  assert.equal(result.totalHRCost, 4050000);
  assert.equal(result.totalSellingBaseline, 12250000);
  const boq = calculateBoQ({
    component_a_total: result.totalHRCost,
    component_b_total: 0,
    component_c_total: 0,
    component_d_total: 0,
    component_e_total: 0,
    quoted_price: 15000000,
  });
  assert.equal(boq.component_a_total, 4050000);
  assert.equal(boq.total_internal_cost, 4050000);
});

test('existing staffing rates are preserved', () => {
  const result = calculateHRCost([
    { role_level: 'project_manager', mandays: 2 },
    { role_level: 'lead', mandays: 4 },
    { role_level: 'senior', mandays: 8 },
    { role_level: 'junior', mandays: 4 },
    { role_level: 'technical_writer', mandays: 0 },
  ], 'remote');
  assert.equal(result.totalHRCost, 21000000);
});

test('retired pricing UI cannot persist demo price or bypass D1 BoQ approval', () => {
  assert.match(page, /from 'next\\/navigation'/);
  assert.match(page, /redirect\\('\/boq'/);
  assert.doesNotMatch(page, /appStore|generateQuotationNumber|calculate3Ranges/);
  const boqPage = readFileSync(join(root, 'src/app/boq/page.tsx'), 'utf8');
  assert.match(boqPage, /\/api\/boq/);
});
