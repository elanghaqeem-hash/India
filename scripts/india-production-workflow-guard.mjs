#!/usr/bin/env node
/**
 * P0 production deployment trigger guard.
 * Source-level control only: not production certification, signed human UAT,
 * or a substitute for environment protection or branch rulesets.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), '.github/workflows');
const files = readdirSync(dir).filter(name => /\.ya?ml$/.test(name));
const problems = [];

for (const file of files) {
  const yaml = readFileSync(join(dir, file), 'utf8');
  // Only scan top-level YAML events, excluding comments and nested step text.
  const eventBlock = yaml.match(/^on:\s*\n((?:^[ \t]+.*(?:\n|$)|^[ \t]*\n)*)/m)?.[1] || '';
  const events = Array.from(eventBlock.matchAll(/^  (\w[\w-]*)\s*:/gm), m => m[1]);
  const push = events.includes('push');
  const manual = events.includes('workflow_dispatch');
  const production = /environment:\s*production\b|\bgroup:\s*[^\n]*production-release|\bD1_NAME:\s*india-staging-db\b/i.test(yaml)
    || /(?:india-chat-prod-hotfix-release|rticore-production-release)\.yml/.test(file);
  const productionDeploy = /\b(?:opennextjs-cloudflare\s+deploy|wrangler\s+deploy(?:\s|$)|wrangler\s+d1\s+(?:execute|time-travel\s+restore))\b/i.test(yaml);
  if (production && productionDeploy && push) problems.push(file + ': push-triggered production deployment/migration prohibited');
  if (production && productionDeploy && !manual) problems.push(file + ': production deployment must support deliberate manual invocation');
}
if (problems.length) {
  for (const message of problems) console.error('P0 WORKFLOW GUARD FAIL: ' + message);
  process.exit(1);
}
console.log('P0 WORKFLOW GUARD PASS: scanned ' + files.length + ' workflows, no push-triggered production mutation.');
console.log('This is a static safety gate, NOT release authorization.');
