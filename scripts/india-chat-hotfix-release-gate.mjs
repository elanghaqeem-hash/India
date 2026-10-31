#!/usr/bin/env node
/**
 * Production INDIA UI-only hotfix release gate.
 * Never logs secrets. Restricts the target to the existing Worker "india"
 * with its original production D1 and Cloudflare Access bindings.
 */
import { readFileSync, appendFileSync } from 'node:fs';

const ACCOUNT = '208155f241d4da84e1a6a9b44b7a8d28';
const PROD_D1 = '8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const PROD_AUD = '0411bb42ccf17d67c3e8b81d8e8c6d6124dbfec5025cab563e6a8aea68e70398';
const TEAM = 'green-heart-e2b0.cloudflareaccess.com';
const HOST = 'india.elang-haqeem.workers.dev';
const REQUIRED_MERGE = 'ae4336a48514cefe4df768936a6e1946673603f0';
const token = process.env.CLOUDFLARE_API_TOKEN || '';
const phase = process.argv[2] || 'before';
if (!token) {
  console.error('BLOCKED: CLOUDFLARE_API_TOKEN not configured for GitHub Actions; no production deploy.');
  process.exit(2);
}

const api = async (path, opts = {}) => {
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(20000)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.success) throw Error('Cloudflare API failed HTTP ' + r.status + ' on ' + path);
  return data.result;
};

async function inspect() {
  const [settings, versions] = await Promise.all([
    api('/workers/scripts/india/settings'),
    api('/workers/scripts/india/deployments'),
  ]);
  const bindings = settings.bindings || [];
  const find = name => bindings.filter(b => b.name === name);
  const exactly = name => {
    const rows = find(name);
    if (rows.length !== 1) throw Error('Binding missing/duplicated: ' + name);
    return rows[0];
  };
  const db = exactly('INDIA_DB');
  if (!['d1', 'd1_database'].includes(db.type) || (db.id || db.database_id) !== PROD_D1) {
    throw Error('STOP: production D1 binding is not the approved database.');
  }
  if (exactly('INDIA_ACCESS_AUD').text !== PROD_AUD ||
      exactly('INDIA_ACCESS_TEAM_DOMAIN').text !== TEAM) {
    throw Error('STOP: production Cloudflare Access configuration differs.');
  }
  if (exactly('INDIA_AI_ENCRYPTION_KEY').type !== 'secret_text') {
    throw Error('STOP: existing AI encryption secret not preserved.');
  }
  const latest = versions.deployments?.[0];
  const versionId = latest?.versions?.find(x => x.percentage === 100)?.version_id;
  if (!versionId || !/^[0-9a-f-]{36}$/.test(versionId)) throw Error('Cannot establish exact 100% production version.');
  return { versionId, createdOn: latest.created_on };
}

try {
  const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  if (wrangler.name !== 'india' || wrangler.d1_databases?.length !== 1 ||
      wrangler.d1_databases[0].database_id !== PROD_D1 ||
      wrangler.vars?.INDIA_ACCESS_AUD !== PROD_AUD ||
      wrangler.vars?.INDIA_ACCESS_TEAM_DOMAIN !== TEAM) {
    throw Error('BLOCKED: deployment config does not match existing production Access/D1.');
  }
  const release = process.env.GITHUB_SHA || '';
  if (!/^[0-9a-f]{40}$/.test(release) ||
      !readFileSync('src/components/layout/Navbar.tsx', 'utf8').includes('createPortal(') ||
      !readFileSync('src/app/globals.css', 'utf8').includes('india-ai-chat-open')) {
    throw Error('BLOCKED: hotfix source or release SHA missing.');
  }

  if (phase === 'before') {
    const previous = await inspect();
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'previous_version=' + previous.versionId + '\n');
    console.log(JSON.stringify({
      gate: 'PRE_DEPLOY_PASS', worker: 'india', domain: HOST,
      approvedMerge: REQUIRED_MERGE, release, previousVersion: previous.versionId,
      productionBindingPreserved: true, noD1Writes: true
    }));
  } else if (phase === 'after') {
    const previous = process.env.INDIA_PREVIOUS_VERSION || '';
    if (!/^[0-9a-f-]{36}$/.test(previous)) throw Error('Rollback checkpoint absent; cannot verify release.');
    const current = await inspect();
    if (current.versionId === previous) throw Error('Worker version unchanged: hotfix was not deployed.');
    console.log(JSON.stringify({
      gate: 'POST_DEPLOY_PASS', worker: 'india', release,
      previousVersion: previous, currentVersion: current.versionId,
      productionBindingPreserved: true, noD1Writes: true,
      note: 'Visual real-user Android keyboard confirmation remains distinct from CI browser test'
    }));
  } else throw Error('Unknown phase');
} catch (e) {
  console.error(JSON.stringify({gate: 'BLOCKED_OR_FAIL',phase,reason: String(e.message || e).slice(0,230),noSecretsLogged:true}));
  process.exitCode = 2;
}
