const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('RTICORE / RTI is consistently visible in the main experience', () => {
  const metadata = read('src/app/layout.tsx');
  const login = read('src/app/login/page.tsx');
  const session = read('src/components/auth/LoginSessionStatus.tsx');
  const nav = read('src/components/layout/Navbar.tsx');
  const sidebar = read('src/components/layout/Sidebar.tsx');
  const landing = read('infra/cloudflare/india-public-login.js');
  assert.match(metadata, /RTICORE.*RTI/);
  for (const source of [login, session, nav, sidebar, landing]) {
    assert.match(source, /RTICORE/);
    assert.match(source, /RTI/);
    assert.doesNotMatch(source, /DefendIT360|Technotama|\bINDIA\b(?![-_./:])/i);
  }
});
test('Technical Cloudflare bindings and existing routes remain backward compatible', () => {
  const wrangler = read('wrangler.jsonc');
  const login = read('infra/cloudflare/india-public-login.js');
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.match(wrangler, /"INDIA_DB"/);
  assert.match(login, /https:\/\/india\.elang-haqeem\.workers\.dev\//);
  assert.equal(pkg.name, 'rticore-erp-psa');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
});

test('Legacy tenant, AI model, database and routes remain stable during a branding-only change', () => {
  assert.match(read('src/lib/sales-workflow.ts'), /TENANT='defendit360'/);
  assert.match(read('src/app/api/boq/route.ts'), /'defendit360'/);
  assert.match(read('src/lib/ai-engine.ts'), /technotama-expert-v2/);
});

test('Every application page and shared UI component uses RTICORE / RTI labels', () => {
  const folders = ['src/app', 'src/components'];
  const walk = (dir) => fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(rel) : entry.name.endsWith('.tsx') ? [rel] : [];
  });
  for (const file of folders.flatMap(walk)) {
    assert.doesNotMatch(read(file), /DefendIT360|Technotama|\bINDIA\b(?![-_./:])/i, file);
  }
});
