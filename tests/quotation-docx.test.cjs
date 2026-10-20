const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { join } = require('node:path');

async function exporter() {
  return import(pathToFileURL(join(__dirname, '../src/lib/quotation-docx.ts')).href);
}
const base = {
  id: 'test-1', opportunity_id: 'op-1', opportunity_name: 'Pengujian Mobile Android iOS',
  company_id: 'c1', company_name: 'PT Contoh Klien',
  quotation_number: 'X/DEIT/2026', version: 1, status: 'draft',
  subtotal: 70_000_000, vat_amount: 7_700_000, grand_total: 77_700_000,
  discount_pct: 0, payment_terms: '50-50', valid_days: 14,
  valid_until: '2026-11-03', client_tier: 'A', selected_price_range: 'standard',
  line_items: [
    { line_number: 1, service_type: 'VAPT', description: 'Mobile App Android',
      quantity: 1, unit: 'Aplikasi', unit_price: 35_000_000, line_total: 35_000_000 },
    { line_number: 2, service_type: 'VAPT', description: 'Mobile App iOS',
      quantity: 1, unit: 'Aplikasi', unit_price: 35_000_000, line_total: 35_000_000 },
  ],
  created_by: 'Test', created_at: '2026-10-20T10:00:00Z',
};

function unpack(bytes, target) {
  const decoder = new TextDecoder();
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  while (pos + 30 <= bytes.length && data.getUint32(pos, true) === 0x04034b50) {
    const size = data.getUint32(pos + 18, true);
    const nameLen = data.getUint16(pos + 26, true);
    const extra = data.getUint16(pos + 28, true);
    const file = decoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const start = pos + 30 + nameLen + extra;
    if (file === target) return decoder.decode(bytes.subarray(start, start + size));
    pos = start + size;
  }
  throw new Error('File not present: ' + target);
}

test('selects correct product/service quotation layout without copying example customers', async () => {
  const api = await exporter();
  assert.equal(api.resolveQuotationFormat(base), 'mobile');
  const multi = { ...base, opportunity_name: 'VAPT Aplikasi Web dan API' };
  assert.equal(api.resolveQuotationFormat(multi), 'vapt');
  const soc = {
    ...base, opportunity_name: 'Layanan Managed SOC 24x7',
    line_items: [{ ...base.line_items[0], service_type: 'SOC', description: 'SOC Monitoring' }],
  };
  assert.equal(api.resolveQuotationFormat(soc), 'soc');
  assert.equal(api.resolveQuotationFormat(base, 'soc'), 'soc');
});

test('generated mobile DOCX is valid OOXML package and matches proposal commercial values', async () => {
  const api = await exporter();
  const bytes = api.createQuotationDocx(base, 'mobile', {
    endUser: 'Klien <End User> & Co',
    methodology: 'Blackbox sesuai SOW yang disetujui',
    assets: 'Android dan iOS',
  });
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  assert.match(unpack(bytes, '[Content_Types].xml'), /wordprocessingml\.document\.main\+xml/);
  const doc = unpack(bytes, 'word/document.xml');
  assert.match(doc, /PT Contoh Klien/);
  assert.match(doc, /Klien &lt;End User&gt; &amp; Co/);
  assert.match(doc, /70\.000\.000/);
  assert.match(doc, /77\.700\.000/);
  assert.match(doc, /Android dan iOS/);
  assert.match(doc, /Rules of Engagement/);
  assert.doesNotMatch(doc, /Mitsubishi Motors|Lembaga Penjamin Simpanan|Danakini Finance/);
  assert.doesNotMatch(doc, /122-00-1928374-5|DIGITALLY AUTHORIZED/);
});

test('managed SOC layout leaves customer-specific SLA and SIEM uncommitted until supplied', async () => {
  const api = await exporter();
  const bytes = api.createQuotationDocx(base, 'soc');
  const doc = unpack(bytes, 'word/document.xml');
  assert.match(doc, /Service Level Objective/);
  assert.match(doc, /belum disepakati/);
  assert.match(doc, /Platform SIEM\/EDR/);
  assert.doesNotMatch(doc, /Microsoft Sentinel|FortiSIEM|≤ 15 menit/);
  assert.doesNotMatch(doc, /1%\/hari/);
});

test('cost item mismatch is visible; malformed amounts are rejected', async () => {
  const api = await exporter();
  const issue = { ...base, subtotal: 71_000_000 };
  const doc = unpack(api.createQuotationDocx(issue, 'vapt'), 'word/document.xml');
  assert.match(doc, /PERLU REKONSILIASI/);
  assert.throws(() => api.createQuotationDocx({ ...base, vat_amount: -1 }), /tidak valid/);
  assert.throws(() => api.createQuotationDocx({ ...base, line_items: [] }), /minimal satu/);
});

test('DOCX source-aligned letterhead and purple table contain the expected four columns', async () => {
  const api = await exporter();
  const xml = unpack(api.createQuotationDocx(base, 'mobile'), 'word/document.xml');
  assert.match(xml, /member of XLSMART/);
  assert.match(xml, /Head Office/);
  assert.match(xml, /PT\. DATA ENKRIPSI INFORMASI TEKNOLOGI/);
  assert.match(xml, /Product/);
  assert.match(xml, /Layanan/);
  assert.match(xml, /Qty/);
  assert.match(xml, /Price/);
  assert.match(xml, /63369B/);
  assert.match(xml, /RINCIAN HARGA PENAWARAN/);
});
