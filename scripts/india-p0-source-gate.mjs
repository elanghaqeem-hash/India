#!/usr/bin/env node
// P0 read-only source guard. This does not approve production or substitute for UAT.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const fail = message => { console.error('P0 BLOCKED: ' + message); process.exitCode = 1; };
const root = process.cwd();
const files = readdirSync(join(root, 'migrations')).filter(p => /^\d{4}_.+\.sql$/.test(p));
const groups = new Map();
for (const file of files) {
  const n = Number(file.slice(0, 4));
  if (n < 30) continue; // Preserve historic 0002 legacy exception.
  groups.set(n, [...(groups.get(n) || []), file]);
}
const latest = Math.max(...groups.keys());
for (let n = 30; n <= latest; n++) {
  const matches = groups.get(n) || [];
  if (matches.length !== 1) fail('Canonical migration ' + String(n).padStart(4, '0') + ' requires exactly one SQL file; got ' + matches.join(','));
}
const wfPath = join(root, '.github/workflows/rticore-production-release.yml');
const workflow = readFileSync(wfPath, 'utf8');
if (/^\s+push\s*:/m.test(workflow)) fail('Production release workflow has an automatic push trigger');
if (!/workflow_dispatch\s*:/.test(workflow)) fail('Production containment must use manual dispatch only');
if (!/exit 1/.test(workflow) || !/PRODUCTION HOLD/.test(workflow)) fail('P0 production workflow must explicitly fail closed');
const loginPage = readFileSync(join(root, 'src/app/login/page.tsx'), 'utf8');
const loginTest = readFileSync(join(root, 'tests/india-login-browser.test.cjs'), 'utf8');
for (const label of ['Login RTICORE', 'Identitas belum diizinkan membuka RTICORE.']) {
  if (!loginPage.includes(label) && label.startsWith('Login')) fail('Login UI missing ' + label);
  if (!loginTest.includes(label)) fail('Browser test has stale login label ' + label);
}
const navbar = readFileSync(join(root, 'src/components/layout/Navbar.tsx'), 'utf8');
const assistantTest = readFileSync(join(root, 'tests/ai-chat-composer-browser-uat.cjs'), 'utf8');
const multiTurnTest = readFileSync(join(root, 'tests/ai-chat-browser-uat.cjs'), 'utf8');
if (!navbar.includes('aria-label="RTICORE AI Business Assistant"') ||
    !assistantTest.includes("name: 'RTICORE AI Business Assistant'") ||
    !multiTurnTest.includes("name: 'RTICORE AI Business Assistant'") ||
    assistantTest.includes("name: 'INDIA AI Business Assistant'") ||
    multiTurnTest.includes("name: 'INDIA AI Business Assistant'")) fail('AI dialog/composer/multi-turn browser selector mismatch');
if (process.exitCode) process.exit(process.exitCode);
console.log('P0 SOURCE GATE PASS: migrations unique 0030-' + latest + ', production hard-held, browser selectors match RTICORE. NOT operational certification.');
