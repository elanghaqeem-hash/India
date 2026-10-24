const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/proposals/page.tsx'), 'utf8')+readFileSync(join(root, 'src/components/sales/ProposalWorkspace.tsx'), 'utf8');
const sheet = readFileSync(join(root, 'src/components/quotation/QuotationDocument.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
const shell = readFileSync(join(root, 'src/components/layout/AppShell.tsx'), 'utf8');
const navbar = readFileSync(join(root, 'src/components/layout/Navbar.tsx'), 'utf8');

test('quotation displays three A4 pages with repeated branding and compact purple pricing table', () => {
  assert.match(page, /<QuotationDocument proposal={preview.proposal} format="auto" details={preview.details}/);
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


test('AI assistant dialog stays above fixed mobile navigation and fits the dynamic viewport', () => {
  const mobileNav = readFileSync(join(root, 'src/components/layout/MobileNav.tsx'), 'utf8');
  const navigationLayer = mobileNav.match(/<nav[^>]*className="[^"]*\bz-(\d+)\b/);
  const assistantLayer = navbar.match(/Global AI Assistant Drawer \/ Modal[\s\S]*?className="[^"]*z-\[(\d+)\]/);
  assert.ok(navigationLayer && assistantLayer, 'both stacked layers must be explicit');
  assert.ok(Number(assistantLayer[1]) > Number(navigationLayer[1]), 'AI dialog must be above mobile navigation');
  assert.match(navbar, /role="dialog" aria-modal="true" aria-label="ICOP AI Business Assistant"/);
  assert.match(navbar, /icop-ai-chat-overlay fixed inset-0 z-\[200\] flex h-\[100dvh\]/);
  assert.match(navbar, /h-full max-h-full min-h-0/);
  assert.match(navbar, /window\.visualViewport/);
  assert.match(navbar, /viewport\?\.addEventListener\('resize', syncViewport\)/);
  assert.match(navbar, /sm:h-\[85dvh\]/);
});

test('AI chat has independently scrolling messages and a visible safe-area composer', () => {
  assert.match(navbar, /min-h-0 flex-1 space-y-3\.5 overflow-y-auto overscroll-contain/);
  assert.match(navbar, /flex shrink-0 items-center gap-2 border-t/);
  assert.match(navbar, /pb-\[max\(12px,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(navbar, /min-h-11 min-w-0 flex-1 rounded-xl/);
  assert.match(navbar, /aria-label="Kirim pesan ke AI"/);
  assert.match(navbar, /if \(event.key === 'Escape'\) setAiAssistantOpen\(false\)/);
  assert.match(navbar, /createPortal\(/);
  assert.match(navbar, /document\.body/);
  assert.match(css, /icop-ai-chat-open nav\[aria-label=/);
});
