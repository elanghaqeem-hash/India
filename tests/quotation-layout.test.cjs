const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/proposals/page.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
const shell = readFileSync(join(root, 'src/components/layout/AppShell.tsx'), 'utf8');
const navbar = readFileSync(join(root, 'src/components/layout/Navbar.tsx'), 'utf8');

test('quotation keeps an A4 desktop/print table and separate mobile cards', () => {
  assert.match(page, /quotation-mobile-list/);
  assert.match(page, /lg:hidden print:hidden/);
  assert.match(page, /quotation-desktop-table/);
  assert.match(page, /lg:block print:block print:overflow-visible/);
  assert.match(css, /size: A4 portrait/);
  assert.match(css, /\.quotation-desktop-table/);
});

test('mobile and print views derive monetary fields from the same selected proposal', () => {
  assert.match(page, /formatIDR\(item\.unit_price\)/);
  assert.match(page, /formatIDR\(item\.line_total\)/);
  assert.match(page, /formatIDR\(selectedProp\.grand_total\)/);
  assert.match(page, /selectedProp\.line_items\.map\(item =>/);
  assert.match(page, /<table className="quotation-desktop-table/);
});

test('mobile shell prevents page-level horizontal overflow', () => {
  assert.match(shell, /min-w-0/);
  assert.match(shell, /overflow-x-clip/);
  assert.match(page, /quotation-document min-w-0 w-full max-w-full overflow-hidden/);
});

test('print hides navigation and mobile shortcut remains accessible', () => {
  assert.match(navbar, /<header className="no-print/);
  assert.match(navbar, /Pengaturan AI & API Key/);
  assert.match(shell, /className="no-print border-b/);
  assert.match(css, /\.no-print\s*\{\s*display: none !important/);
});
