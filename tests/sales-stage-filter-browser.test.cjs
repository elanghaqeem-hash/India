// Browser verification of the existing INDIA stage-filter fix (PR #29).
// The Sales API response is a test fixture; this does not exercise remote D1 or real Access.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.INDIA_UAT_URL || 'http://127.0.0.1:3100';
const artifacts = path.join(process.cwd(), 'artifacts', 'browser-uat');
fs.mkdirSync(artifacts, { recursive: true });
const stages = [
  'Prospecting', 'Qualified', 'Discovery / Scoping', 'Solution & BoQ',
  'Commercial Approval', 'Quotation Sent', 'Negotiation', 'Pending PO',
  'Closed Won', 'Closed Lost',
];
let deals = [
  { id: 'uat-prospect-1', company_id: 'uat-account', company_name: 'UAT fixture',
    title: 'Prospect Alpha', stage: 'prospecting', estimated_value: 100,
    fields: {}, created_at: '2026-10-22' },
  { id: 'uat-prospect-2', company_id: 'uat-account', company_name: 'UAT fixture',
    title: 'Prospect Beta', stage: 'prospecting', estimated_value: 200,
    fields: {}, created_at: '2026-10-22' },
  { id: 'uat-negotiation', company_id: 'uat-account', company_name: 'UAT fixture',
    title: 'Negotiation Gamma', stage: 'negotiation', estimated_value: 300,
    fields: {}, created_at: '2026-10-22' },
  { id: 'uat-won', company_id: 'uat-account', company_name: 'UAT fixture',
    title: 'Won Delta', stage: 'closed_won', estimated_value: 400,
    fields: {}, created_at: '2026-10-22' },
  { id: 'uat-lost', company_id: 'uat-account', company_name: 'UAT fixture',
    title: 'Lost Epsilon', stage: 'closed_lost', estimated_value: 500,
    fields: {}, created_at: '2026-10-22' },
];

test('Sales stage filter: full labels, counts and interactions on mobile and desktop', async t => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const layout of [
      { name: 'android-375', width: 375, height: 812, mobile: true },
      { name: 'desktop-1280', width: 1280, height: 900, mobile: false },
    ]) {
      await t.test(layout.name, async () => {
        const page = await browser.newPage({
          viewport: { width: layout.width, height: layout.height },
          isMobile: layout.mobile, hasTouch: layout.mobile,
        });
        try {
          await page.route('**/api/sales?**', async route => {
            const entity = new URL(route.request().url()).searchParams.get('entity');
            await route.fulfill({
              status: 200, contentType: 'application/json',
              body: JSON.stringify(entity === 'accounts'
                ? { success: true, accounts: [], role: 'sales' }
                : { success: true, deals, role: 'sales' }),
            });
          });
          const loaded = page.waitForResponse(r =>
            r.url().includes('/api/sales?entity=deals') && r.status() === 200);
          assert.equal((await page.goto(base + '/sales/pipeline',
            { waitUntil: 'domcontentloaded' }))?.status(), 200);
          await loaded;
          const filter = page.getByRole('button', { name: /^Filter tahap:/ });
          await page.getByText('Menampilkan 5 dari 5 Opportunity').waitFor();
          assert.match(await filter.getAttribute('aria-label'), /Semua Tahap/);
          await filter.click();
          let panel = page.getByRole('group', { name: 'Pilihan tahap opportunity' });
          await panel.waitFor();
          const buttons = panel.locator('button[aria-pressed]');
          assert.equal(await buttons.count(), 11, 'Expected All + 10 canonical stages');
          for (let i = 0; i < stages.length; i++) {
            assert.ok((await buttons.nth(i + 1).innerText()).includes(stages[i]),
              'Missing full stage ' + stages[i]);
          }
          assert.match(await buttons.nth(0).innerText(), /5/);
          assert.match(await buttons.nth(1).innerText(), /2/);
          assert.match(await buttons.nth(7).innerText(), /1/);
          assert.match(await buttons.nth(9).innerText(), /1/);
          assert.match(await buttons.nth(10).innerText(), /1/);

          const dims = await page.evaluate(() => ({
            width: innerWidth, scroll: document.documentElement.scrollWidth,
          }));
          assert.ok(dims.scroll <= dims.width + 2, 'Filter causes horizontal overflow: ' + JSON.stringify(dims));
          await page.screenshot({ path: path.join(artifacts, 'stage-filter-' + layout.name + '.png') });

          await buttons.nth(7).click(); // Negotiation
          assert.equal(await panel.count(), 0);
          assert.match(await filter.getAttribute('aria-label'), /Negotiation/);
          assert.match(await page.getByRole('status').filter({ hasText: 'Menampilkan' }).innerText(),
            /Menampilkan 1 dari 5 Opportunity/);
          await page.getByRole('button', { name: /Negotiation Gamma/ }).waitFor();
          assert.equal(await page.getByRole('button', { name: /Prospect Alpha/ }).count(), 0);

          await filter.click();
          panel = page.getByRole('group', { name: 'Pilihan tahap opportunity' });
          await panel.waitFor();
          await page.keyboard.press('Escape');
          assert.equal(await panel.count(), 0, 'Escape should dismiss filter');
          assert.match(await filter.getAttribute('aria-label'), /Negotiation/);

          await filter.click();
          await panel.waitFor();
          await page.getByRole('heading', { name: 'Sales Pipeline & Opportunity 360' }).click();
          assert.equal(await panel.count(), 0, 'Outside click should dismiss filter');

          await filter.click();
          panel = page.getByRole('group', { name: 'Pilihan tahap opportunity' });
          await panel.getByRole('button', { name: 'Reset Filter' }).click();
          assert.match(await filter.getAttribute('aria-label'), /Semua Tahap/);
          await page.getByText('Menampilkan 5 dari 5 Opportunity').waitFor();
          await filter.click();
          panel = page.getByRole('group', { name: 'Pilihan tahap opportunity' });
          await panel.locator('button[aria-pressed]').nth(2).click(); // Qualified, zero records
          await page.getByText('Tidak ada Opportunity pada tahap ini.', { exact: false }).waitFor();
          await page.screenshot({ path: path.join(artifacts, 'stage-filter-empty-' + layout.name + '.png') });
        } finally {
          await page.close();
        }
      });
    }
  } finally {
    await browser.close();
  }
});
