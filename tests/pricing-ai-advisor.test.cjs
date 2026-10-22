const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');

const root = join(__dirname, '..');
const read = path => readFileSync(join(root, path), 'utf8');
const moduleCode = ts.transpileModule(read('src/lib/pricing-advisor.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: 'pricing-advisor.ts',
}).outputText;
const exportsObject = {};
const moduleObject = { exports: exportsObject };
new Function('exports', 'module', 'require', moduleCode)(exportsObject, moduleObject, require);
const { anonymousPricingPrompt, localPricingInsights } = moduleObject.exports;

const snapshot = {
  clientTier: 'A',
  locationType: 'remote',
  selectedRange: 'standard',
  discountPct: 5,
  totalCost: 800000,
  quotedPrice: 900000,
  grossMarginPct: 11.11,
  floorPrice: 1000000,
  standardPrice: 1200000,
  premiumPrice: 1500000,
  requiredLevel: 'director',
};

test('internal advice reports an accurate 25% margin threshold and DoA', () => {
  const notes = localPricingInsights(snapshot);
  assert.ok(notes.some(note => /11\.11%/.test(note)));
  assert.ok(notes.some(note => /Rp 1\.066\.667/.test(note)));
  assert.ok(notes.some(note => /diskon 5\.00%/i.test(note)));
  assert.ok(notes.some(note => /DIRECTOR/.test(note)));
});
test('floor pricing is flagged as 20%, distinct from commercial target 25%', () => {
  const notes = localPricingInsights({ ...snapshot, selectedRange: 'floor' });
  assert.ok(notes.some(note => note.includes('20%') && note.includes('25%')));
});
test('healthy margins remain locally actionable without contacting AI', () => {
  const notes = localPricingInsights({ ...snapshot, selectedRange: 'premium', grossMarginPct: 40 });
  assert.ok(notes.some(note => /memenuhi target/.test(note)));
  assert.ok(notes.some(note => /Premium/.test(note)));
});
test('external AI prompt allowlists categorical context and omits confidential numbers', () => {
  const prompt = anonymousPricingPrompt(snapshot);
  assert.ok(prompt.length >= 15 && prompt.length < 4800);
  assert.match(prompt, /Tier pelanggan A/);
  assert.match(prompt, /skenario harga standard/);
  for (const confidential of ['800000', '900000', '11.11', '1.066.667', '5%', 'director']) {
    assert.ok(!prompt.includes(confidential), 'outbound prompt exposed ' + confidential);
  }
  const malicious = anonymousPricingPrompt({
    clientTier: 'PT Secret Client 123' ,
    locationType: 'secret-project-987',
    selectedRange: 'private-price',
    discountPct: 123456789,
  });
  assert.ok(!malicious.includes('Secret'));
  assert.ok(!malicious.includes('987'));
  assert.ok(!malicious.includes('123456789'));
});
test('pricing UI uses consented multirole AI endpoint and keeps errors outside recommendations', () => {
  const ui = read('src/app/pricing/page.tsx');
  assert.doesNotMatch(ui, /['"]\/api\/ai\/generate['"]/);
  assert.match(ui, /fetch\('\/api\/ai\/assist'/);
  assert.match(ui, /confirmed: true/);
  assert.match(ui, /purpose: 'pricing'/);
  assert.match(ui, /anonymousPricingPrompt\(\{ clientTier, locationType, selectedRange, discountPct \}\)/);
  assert.match(ui, /disabled=\{!aiApproved \|\| aiAdvising \|\| aiAvailability !== 'available'\}/);
  assert.match(ui, /role="alert"/);
  assert.match(ui, /localAdvice\.map/);
});
test('server endpoint authorizes sales, presales and finance and enforces confirmation', () => {
  const route = read('src/app/api/ai/assist/route.ts');
  for (const role of ['sales', 'presales', 'finance']) assert.ok(route.includes("'" + role + "'"));
  assert.match(route, /confirmed!==true/);
  assert.match(route, /containsPersonalIdentifier\(prompt\)/);
  assert.match(route, /runPriorityChain/);
});
