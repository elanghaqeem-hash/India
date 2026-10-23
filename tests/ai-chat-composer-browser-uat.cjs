const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const baseUrl = process.env.INDIA_UAT_BASE || 'http://127.0.0.1:3125';

async function check(browser, name, viewport, mobile) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const nav = page.getByRole('navigation', { name: 'Navigasi utama mobile' });
    await page.getByTitle('Buka AI Business Assistant').click();
    const dialog = page.getByRole('dialog', { name: 'ICOP AI Business Assistant' });
    await dialog.waitFor();
    const input = dialog.getByRole('textbox', { name: 'Pesan untuk AI Business Assistant' });
    const send = dialog.getByRole('button', { name: 'Kirim pesan ke AI' });

    assert.equal(await dialog.evaluate(n => n.parentElement === document.body), true, name + ': dialog portaled directly to body');
    assert.equal(await dialog.evaluate(n => getComputedStyle(n).zIndex), 'auto', name + ': dialog in overlay');

    if (mobile) {
      assert.equal(await nav.isVisible(), false, name + ': underlying navigation hidden');
      assert.equal(await page.evaluate(() => document.body.classList.contains('icop-ai-chat-open')), true);
    }

    const bounds = await input.boundingBox();
    const submitBounds = await send.boundingBox();
    assert.ok(bounds && submitBounds, name + ': input and button have bounds');
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1, name + ': input not clipped');
    assert.ok(submitBounds.y + submitBounds.height <= viewport.height + 1, name + ': send button not clipped');
    assert.ok(bounds.height >= 44 && submitBounds.height >= 44, name + ': accessible touch targets');

    await page.route('**/api/ai/generate', async route => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, content: 'Respons analisis teknis. '.repeat(250), providerUsed: 'Mock for layout only' }),
      });
    });
    await input.fill('Bahas VAPT.');
    await send.click();
    await page.getByText('Via: Mock for layout only').waitFor({ timeout: 12000 });

    const after = await input.boundingBox();
    assert.ok(after && after.y + after.height <= viewport.height + 1, name + ': composer stays visible after long response');

    const scrolling = await dialog.evaluate(node => {
      const el = Array.from(node.querySelectorAll('div')).find(el => getComputedStyle(el).overflowY === 'auto' && el.scrollHeight > el.clientHeight);
      return !!el;
    });
    assert.equal(scrolling, true, name + ': long chat scrolls without moving composer');

    await dialog.getByRole('button', { name: 'Tutup AI Business Assistant' }).click();
    assert.equal(await dialog.isVisible(), false, name + ': dialog closes');
    if (mobile) assert.equal(await nav.isVisible(), true, name + ': navigation restored');
    console.log(name + ': PASS');
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await check(browser, 'Android compact 360x640', { width: 360, height: 640 }, true);
    await check(browser, 'Android 390x844', { width: 390, height: 844 }, true);
    await check(browser, 'Desktop 1280x800', { width: 1280, height: 800 }, false);
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
