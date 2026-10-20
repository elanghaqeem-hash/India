const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise actual compiled export code; no mocked spreadsheet builder.
const source = fs.readFileSync(path.join(__dirname, '../src/lib/boq-xlsx.ts'), 'utf8');
const cjs = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObj = {};
new Function('exports', 'module', 'TextEncoder', cjs)(exportsObj, { exports: exportsObj }, TextEncoder);

const proposal = {
  id: 'test-1', opportunity_id: 'opp-abc', opportunity_name: 'SOC + VAPT scope',
  company_id: 'company-1', company_name: 'Bank & Co <Enterprise>',
  quotation_number: 'TEST/QT/X/2026', version: 1, status: 'draft',
  subtotal: 15000000, vat_amount: 1650000, grand_total: 16650000,
  discount_pct: 0, payment_terms: '30-50-20',
  valid_days: 14, valid_until: '2026-10-30', client_tier: 'A',
  selected_price_range: 'standard', created_by: 'unit-test', created_at: '2026-10-20',
  line_items: [
    { line_number: 1, service_type: 'VAPT', description: 'API Security Testing', quantity: 1, unit: 'Lot', unit_price: 5000000, line_total: 5000000 },
    { line_number: 2, service_type: 'SOC', description: 'MDR monitoring', quantity: 10, unit: 'Bulan', unit_price: 1000000, line_total: 10000000 },
  ],
};

const pricing = {
  id: 'pricing-1', opportunity_id: proposal.opportunity_id,
  boq: { component_a_total: 1111111, component_b_total: 222222,
    component_c_total: 333333, component_d_total: 444444, component_e_total: 555555,
    total_internal_cost: 2666665 }
};

function unzipStored(data) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const d = new TextDecoder();
  const result = new Map();
  let pos = 0;
  while (pos < data.length && v.getUint32(pos, true) === 0x04034b50) {
    const size = v.getUint32(pos + 18, true);
    const nameSize = v.getUint16(pos + 26, true);
    const extra = v.getUint16(pos + 28, true);
    const nameStart = pos + 30, dataStart = nameStart + nameSize + extra;
    const name = d.decode(data.subarray(nameStart, nameStart + nameSize));
    result.set(name, d.decode(data.subarray(dataStart, dataStart + size)));
    pos = dataStart + size;
  }
  return result;
}
function sheetNames(files) {
  const w = files.get('xl/workbook.xml');
  return [...w.matchAll(/<sheet name="([^"]+)"/g)].map(x => x[1].replace(/&amp;/g, '&'));
}
function validatePackage(files, expectedSheets) {
  assert.equal(files.size, expectedSheets + 5);
  assert.ok(files.get('[Content_Types].xml').includes('spreadsheetml.sheet.main'));
  assert.ok(files.get('xl/_rels/workbook.xml.rels').includes('styles.xml'));
  for (let i = 1; i <= expectedSheets; i++) {
    assert.ok(files.get('xl/worksheets/sheet' + i + '.xml').includes('<worksheet'));
  }
}

test('customer export produces three sheets and contains only selling prices', () => {
  const result = exportsObj.createProposalBoQ(proposal, 'customer', pricing);
  const files = unzipStored(result);
  validatePackage(files, 3);
  assert.deepEqual(sheetNames(files), ['Summary', 'BoQ Quotation', 'Parameters']);
  const xml = files.get('xl/worksheets/sheet2.xml');
  assert.match(xml, /Parameters!C7/);
  assert.match(xml, /Summary!D8/);
  assert.match(xml, /Summary!\$C\$8/); // Qty follows the actual selected option
  assert.ok(xml.includes('API Security Testing'));
  assert.ok(![...files.values()].join(' ').includes('1111111')); // finance-only HPP
  assert.ok(![...files.values()].join(' ').includes('555555')); // finance-only travel
});

test('internal format produces seven sheets, linked aggregate HPP only if opportunity matches', () => {
  const files = unzipStored(exportsObj.createProposalBoQ(proposal, 'standard', pricing));
  validatePackage(files, 7);
  assert.deepEqual(sheetNames(files),
    ['Ringkasan P&L', 'BoQ Internal', 'Parameter', 'Lingkup & Sizing', 'Jadwal & Alokasi', 'Cash Flow', 'Asumsi']);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /1111111/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /555555/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /Parameter!C9/);
  assert.ok(files.get('xl/worksheets/sheet3.xml').includes('0.11'));
  const unrelated = { ...pricing, opportunity_id: 'other-opportunity' };
  const rejected = unzipStored(exportsObj.createProposalBoQ(proposal, 'standard', unrelated));
  assert.ok(!rejected.get('xl/worksheets/sheet2.xml').includes('1111111'));
  assert.ok(rejected.get('xl/worksheets/sheet2.xml').includes('LENGKAPI KOMPONEN A-E'));
});

test('onsite export preserves onsite travel worksheet and costs separated', () => {
  const files = unzipStored(exportsObj.createProposalBoQ(proposal, 'onsite', pricing));
  validatePackage(files, 7);
  assert.equal(sheetNames(files)[3], 'Biaya Onsite');
  assert.match(files.get('xl/worksheets/sheet4.xml'), /J9/);
  assert.match(files.get('xl/worksheets/sheet7.xml'), /rekonsiliasi|Cash Flow/i);
});

test('user-provided text is XML-safe, and customer option quantities are editable', () => {
  const files = unzipStored(exportsObj.createProposalBoQ(proposal, 'customer'));
  assert.ok(files.get('xl/worksheets/sheet1.xml').includes('Bank &amp; Co &lt;Enterprise&gt;'));
  assert.ok(files.get('xl/worksheets/sheet3.xml').includes('Essential'));
  assert.ok(files.get('xl/worksheets/sheet3.xml').includes('Recommended'));
  assert.ok(files.get('xl/worksheets/sheet3.xml').includes('Comprehensive'));
});


test('payment installments use grand total including tax and sum to quoted value', () => {
  const files = unzipStored(exportsObj.createProposalBoQ(proposal, 'customer'));
  const s = files.get('xl/worksheets/sheet1.xml');
  assert.match(s, /C16\*B13/);
  assert.match(s, /C17\*B13/);
  assert.match(s, /C18\*B13/);
  assert.ok(!s.includes('C16*B11'), 'must not calculate payments on pre-tax subtotal');
});

test('internal P&L requires all five cost buckets before showing aggregate margin', () => {
  const files = unzipStored(exportsObj.createProposalBoQ(proposal, 'standard'));
  const boq = files.get('xl/worksheets/sheet2.xml');
  const pnl = files.get('xl/worksheets/sheet1.xml');
  assert.match(boq, /COUNT\(H[0-9]+:H[0-9]+\)=5/);
  assert.match(boq, /LENGKAPI KOMPONEN A-E/);
  assert.match(pnl, /B10=&quot;&quot;/);
});

test('12-week cashflow includes late settlement and a 100-percent allocation gate', () => {
  const files = unzipStored(exportsObj.createProposalBoQ(proposal, 'onsite', pricing));
  const allocations = files.get('xl/worksheets/sheet5.xml');
  const cashflow = files.get('xl/worksheets/sheet6.xml');
  assert.match(allocations, /W12/);
  assert.match(allocations, /O8:O12/);
  assert.match(cashflow, /W12/);
  assert.match(cashflow, /\$B\$14/);
  assert.match(cashflow, /SUM\(B9:M9\)/);
});
