const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const baseUrl = process.env.INDIA_CHAT_UAT_BASE || 'http://127.0.0.1:3124';
const turns = [
  'Jelaskan penetration testing untuk aplikasi web.',
  'Alat apa saja yang bisa digunakan?',
  'Gunakan bahasa Indonesia saja',
  'Jelaskan kegunaan Burp Suite dari pembahasan sebelumnya.',
];
const responses = [
  'Penetration testing adalah pengujian keamanan aplikasi web yang dilakukan secara berizin.',
  'Burp Suite dan Nmap dapat digunakan untuk pengujian keamanan aplikasi web.',
  'Baik, kita tetap membahas penetration testing dan menggunakan Bahasa Indonesia.',
  'Burp Suite digunakan untuk menguji lalu lintas HTTP dan kerentanan aplikasi web.',
];

async function runScenario(browser, name, viewport, mobile) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const sent = [];
  try {
    await page.route('**/api/ai/generate', async route => {
      const request = JSON.parse(route.request().postData() || '{}');
      sent.push(request);
      const content = responses[sent.length - 1] || 'Respons tambahan.';
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, content, providerUsed: 'UAT Mock', modelUsed: 'mock' }),
      });
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.getByTitle('Buka AI Business Assistant').click();
    const dialog = page.getByRole('dialog', { name: 'ICOP AI Business Assistant' });
    await dialog.waitFor({ timeout: 10000 });
    const input = page.getByRole('textbox', { name: 'Pesan untuk AI Business Assistant' });
    const send = page.getByRole('button', { name: 'Kirim pesan ke AI' });

    for (let i = 0; i < turns.length; i += 1) {
      await input.fill(turns[i]);
      await send.click();
      await page.getByText(responses[i], { exact: true }).waitFor({ timeout: 10000 });
    }

    assert.equal(sent.length, 4, name + ': four intercepted requests');
    assert.deepEqual(sent.map(x => x.prompt), turns, name + ': sequence preserved');
    assert.deepEqual(sent.map(x => x.history.length), [0, 2, 4, 6], name + ': Q&A context grows');
    assert.deepEqual(sent[1].history.map(x => x.role), ['user', 'assistant']);
    assert.equal(sent[1].history[0].content, turns[0]);
    assert.equal(sent[1].history[1].content, responses[0]);
    assert.equal(sent[3].history[4].content, turns[2]);
    assert.equal(sent[3].history[5].content, responses[2]);

    const rect = await input.boundingBox();
    assert.ok(rect, name + ': composer exists');
    assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height + 1, name + ': composer is inside viewport');

    await page.getByRole('button', { name: 'Mulai percakapan baru tanpa konteks sebelumnya' }).click();
    await input.fill('Pertanyaan baru tentang tender');
    await send.click();
    assert.equal(sent[4]?.history?.length, 0, name + ': New Chat resets history');

    console.log(name + ': PASS (four continuous turns, in-viewport composer, new chat resets)');
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await runScenario(browser, 'Android viewport 390x844', { width: 390, height: 844 }, true);
    await runScenario(browser, 'Desktop viewport 1280x800', { width: 1280, height: 800 }, false);
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
