const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/proposals/page.tsx'), 'utf8');
const sheet = readFileSync(join(root, 'src/components/quotation/QuotationDocument.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
const shell = readFileSync(join(root, 'src/components/layout/AppShell.tsx'), 'utf8');
const navbar = readFileSync(join(root, 'src/components/layout/Navbar.tsx'), 'utf8');

test('quotation displays three A4 pages with repeated branding and compact purple pricing table', () => {
  assert.match(page, /<QuotationDocument proposal={selectedProp} format={docFormat} details={docDetails}/);
  assert.match(sheet, /quote-letter-page/);
  assert.match(sheet, /quote-details-page/);
  assert.match(sheet, /quote-terms-page/);
  assert.match(sheet, /quote-brand-logo/);
  assert.match(sheet, /quote-price-table/);
  assert.match(sheet, /RINCIAN HARGA PENAWARAN/);
  assert.match(sheet, /Rules Of Engagement/);
  assert.match(sheet, /Service Level Objective \(SLO\)/);
  assert.match(css, /\.quote-table th \{ color: #fff; background: #683b98/);
  assert.match(css, /@page \{ size: A4 portrait; margin: 0; \}/);
  assert.match(css, /break-after: page/);
});
test('mobile and print views use proposal-based data rather than a hardcoded client or payment account', () => {
  assert.match(sheet, /p\.line_items\.map/);
  assert.match(sheet, /fmtMoney\(p\.grand_total\)/);
  assert.match(sheet, /p\.quotation_number/);
  assert.match(sheet, /p\.payment_terms/);
  assert.doesNotMatch(sheet, /PT Bank Central Nusantara Tbk|122-00-1928374-5|DIGITALLY AUTHORIZED/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media print/);
});
test('shell print mode hides navigation while retaining a mobile-reachable export', () => {
  assert.match(navbar, /<header className="no-print/);
  assert.match(shell, /className="no-print border-b/);
  assert.match(css, /\.no-print\s*\{\s*display: none !important/);
  assert.match(page, /Unduh Quotation \(\.docx\)/);
});
