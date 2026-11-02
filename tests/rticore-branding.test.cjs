const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Check visible and newly generated copy. Historical migrations, AAD and route identifiers stay stable.
const surfaces = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/components/layout/Navbar.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/components/layout/AppShell.tsx",
  "src/components/layout/MobileNav.tsx",
  "src/components/auth/LoginSessionStatus.tsx",
  "src/components/erp/ERPDesk.tsx",
  "src/app/boq/page.tsx",
  "src/app/boq/users/page.tsx",
  "src/app/scoping/page.tsx",
  "src/app/sales/executive/page.tsx",
  "src/app/sales/documents/page.tsx",
  "src/app/sales/forecast/page.tsx",
  "src/app/sales/leads/page.tsx",
  "src/app/sales/pipeline/page.tsx",
  "src/app/sales/procurement/page.tsx",
  "src/app/sales/submission/page.tsx",
  "src/app/sales/activities/page.tsx",
  "src/app/customers/page.tsx",
  "src/app/partners/page.tsx",
  "src/app/post-po/page.tsx",
  "src/app/reports/page.tsx",
  "src/app/settings/ai/page.tsx",
  "src/app/settings/option-registry/page.tsx",
  "src/components/admin/SystemSettings.tsx",
  "src/components/ai/AIWorkbench.tsx",
  "src/components/quotation/QuotationDocument.tsx",
  "src/components/sales/CommercialUI.tsx",
  "src/components/sales/ProposalWorkspace.tsx",
  "src/lib/ai-engine.ts",
  "src/lib/ai-workspace-identity.ts",
  "src/lib/boq-xlsx.ts",
  "src/lib/post-po-documents.ts",
  "src/lib/quotation-docx.ts",
  "src/lib/sales-loss-report.ts",
  "src/app/api/ai/generate/route.ts",
  "src/app/api/sales/quotation/route.ts"
];
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

for (const file of surfaces) {
  test('RTICORE user-facing branding: ' + file, () => {
    const content = read(file);
    assert.doesNotMatch(content, /DefendIT360|Technotama|\\bINDIA\\b|\\bIndia\\b/);
  });
}

test('Browser title, login and AI assistant consistently identify RTICORE and RTI', () => {
  assert.match(read('src/app/layout.tsx'), /RTICORE — RTI/);
  assert.match(read('src/app/login/page.tsx'), /Login RTICORE/);
  assert.match(read('src/components/layout/Navbar.tsx'), /RTICORE AI Business Assistant/);
  assert.match(read('src/lib/ai-workspace-identity.ts'), /asisten bisnis RTI/);
});
