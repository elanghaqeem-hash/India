const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const nextConfig = fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8');

test('Next.js 16.4.2 and React 19 use pinned matching versions', () => {
  assert.equal(pkg.dependencies.next, '16.4.2');
  assert.equal(pkg.dependencies.react, '19.2.0');
  assert.equal(pkg.dependencies['react-dom'], '19.2.0');
  assert.match(pkg.devDependencies['@types/react'], /^\^19\./);
  assert.match(pkg.devDependencies['@types/react-dom'], /^\^19\./);
});

test('Next.js 16 builds with webpack while custom webpack config remains', () => {
  assert.match(nextConfig, /webpack\s*:/);
  assert.equal(pkg.scripts.build, 'next build --webpack');
  assert.equal(pkg.scripts.dev, 'next dev --webpack');
});

test('Cloudflare build includes runtime compatibility guard and supported OpenNext adapter', () => {
  assert.equal(pkg.devDependencies['@opennextjs/cloudflare'], '1.20.12');
  assert.match(pkg.scripts['build:cf'], /test:runtime-compat/);
  assert.match(pkg.scripts['build:cf'], /opennextjs-cloudflare build/);
});
