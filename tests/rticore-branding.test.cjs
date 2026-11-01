const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const read = (path) => readFileSync(path, 'utf8');
const brandedSurfaces = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/login/page.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/layout/Navbar.tsx',
  'src/components/layout/MobileNav.tsx',
  'src/components/quotation/QuotationDocument.tsx',
  'src/lib/quotation-docx.ts',
  'src/lib/post-po-documents.ts',
];

test('brand surfaces have no legacy company names', () => {
  for (const path of brandedSurfaces) {
    const text = read(path);
    assert.doesNotMatch(text, /DefendIT360|Technotama/i, path);
  }
});
test('login, metadata, navigation and quotation show RTICORE / RTI', () => {
  assert.match(read('src/app/layout.tsx'), /RTICORE/);
  assert.match(read('src/app/layout.tsx'), /RTI/);
  assert.match(read('src/app/login/page.tsx'), /Login RTICORE/);
  assert.match(read('src/components/layout/Sidebar.tsx'), /RTICORE Navigation/);
  assert.match(read('src/components/quotation/QuotationDocument.tsx'), />RTI</);
  assert.match(read('src/lib/quotation-docx.ts'), /RTICORE_RTI_Quotation_/);
  assert.match(read('src/lib/post-po-documents.ts'), /RTICORE_RTI_/);
});
test('compatibility bindings are not accidentally renamed', () => {
  const wrangler = read('wrangler.jsonc');
  assert.match(wrangler, /"INDIA_DB"/);
  assert.match(wrangler, /"INDIA_ACCESS_TEAM_DOMAIN"/);
  assert.match(wrangler, /"name": "india"/);
});
