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
// The release workflow is armed (hold lifted 2026-11-01 by the repository/business owner) but must keep every
// control that justified lifting it. These are source-level guards, not an operational certification.
if (/^\s+push\s*:/m.test(workflow)) fail('Production release workflow has an automatic push trigger');
if (!/workflow_dispatch\s*:/.test(workflow)) fail('Production release must use manual dispatch only');
if (!workflow.includes('DEPLOY RTICORE PRODUCTION')) fail('Production release must require a typed confirmation string');
if (!/time-travel info/.test(workflow)) fail('Production release must capture a D1 Time Travel bookmark before migrating');
if (/upload-artifact/.test(workflow)) fail('This repository is public: the production D1 export must never be uploaded as an artifact');
if (!/Roll back Worker version on failure/.test(workflow)) fail('Production release must roll back the Worker on failure');
if (!/foreign_key_check/.test(workflow) || !/row counts preserved/.test(workflow)) fail('Production release must verify foreign keys and row preservation');
if (!/steps\.deploy\.outcome != 'success'/.test(workflow)) fail('D1 auto-restore must be fenced to pre-deploy failures only');
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
console.log('P0 SOURCE GATE PASS: migrations unique 0030-' + latest + ', guarded manual release armed, browser selectors match RTICORE. NOT operational certification.');
