#!/usr/bin/env node
/**
 * Genuine ICOP AI UAT: signed human Admin Cloudflare Access + configured
 * OpenRouter on an isolated candidate UAT Worker. This is NOT a mock test.
 * Never use on production. No customer records or provider secrets logged.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const UAT_WORKER = 'uat-india';
const UAT_HOST = 'uat-india.elang-haqeem.workers.dev';
const UAT_DB = 'eaed652e-7322-4950-a304-dd50baa5de02';
const PROD_DB = '8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const PROD_HOST = 'india.elang-haqeem.workers.dev';
const ACCOUNT = '208155f241d4da84e1a6a9b44b7a8d28';
const env = process.env;
let count = 0;
const pass = (label, ok) => {
  if (!ok) throw Error('FAILED: ' + label);
  count++;
  console.log('PASS ' + label);
};
const required = name => {
  const value = (env[name] || '').trim();
  if (!value) throw Error('BLOCKED: missing ' + name);
  return value;
};
const forbidden = /(?:panci|wajan|blender|alat dapur|resep masakan)/i;
const allowUrl = new URL('https://' + UAT_HOST);

function config() {
  const url = new URL(required('INDIA_AI_CHAT_UAT_URL'));
  pass('UAT HTTPS origin only', url.origin === allowUrl.origin &&
    (url.pathname === '/' || url.pathname === '') &&
    !url.username && !url.password && !url.search && !url.hash && !url.port &&
    url.hostname !== PROD_HOST);
  pass('Worker UAT allowlist', required('INDIA_AI_CHAT_UAT_WORKER') === UAT_WORKER);
  pass('Dedicated D1 only', required('INDIA_AI_CHAT_UAT_D1_ID') === UAT_DB &&
    UAT_DB !== PROD_DB);
  const aud = required('INDIA_AI_CHAT_UAT_ACCESS_AUD');
  const domain = required('INDIA_AI_CHAT_UAT_ACCESS_DOMAIN');
  pass('Access team domain', /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain));
  pass('Access application audience', aud.length >= 32);
  const jwt = required('INDIA_AI_CHAT_UAT_ADMIN_JWT');
  pass('JWT shape', jwt.split('.').length === 3);
  const sha = required('INDIA_AI_CHAT_EXPECTED_SHA');
  pass('Exact candidate commit pinned', /^[0-9a-f]{40}$/.test(sha));
  const cfReadToken = required('INDIA_AI_CHAT_UAT_CF_READ_TOKEN');
  return { url, aud, domain, jwt, sha, cfReadToken };
}

async function checkWorker(c) {
  const endpoint = 'https://api.cloudflare.com/client/v4/accounts/' +
    ACCOUNT + '/workers/scripts/' + UAT_WORKER + '/settings';
  const res = await fetch(endpoint, {
    headers: { Authorization: 'Bearer ' + c.cfReadToken },
    redirect: 'manual',
    signal: AbortSignal.timeout(15000)
  });
  pass('Cloudflare Worker metadata available', res.status === 200);
  const json = await res.json();
  pass('UAT Worker configuration available', json.success === true && !!json.result);
  const bindings = json.result.bindings || [];
  const single = name => {
    const matches = bindings.filter(b => b.name === name);
    return matches.length === 1 ? matches[0] : null;
  };
  const db = single('INDIA_DB');
  pass('Worker uses isolated UAT D1', !!db &&
    ['d1', 'd1_database'].includes(db.type) &&
    (db.id || db.database_id) === UAT_DB);
  pass('UAT Worker holds separate AI encryption secret',
    single('INDIA_AI_ENCRYPTION_KEY')?.type === 'secret_text');
  pass('UAT deployment exactly matches reviewed PR commit',
    single('INDIA_RELEASE_SHA')?.text === c.sha);
  pass('UAT Worker Access matches intended application',
    single('INDIA_ACCESS_AUD')?.text === c.aud);
  pass('UAT Worker Access matches team domain',
    single('INDIA_ACCESS_TEAM_DOMAIN')?.text === c.domain);
}

async function checkAdmin(c) {
  const jwks = createRemoteJWKSet(new URL('https://' + c.domain + '/cdn-cgi/access/certs'));
  const { payload } = await jwtVerify(c.jwt, jwks, {
    issuer: 'https://' + c.domain,
    audience: c.aud,
    algorithms: ['RS256'],
    clockTolerance: 30
  });
  const email = String(payload.email || '').trim().toLowerCase();
  pass('Access JWT has real email identity',
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.invalid'));
  // The subsequent /api/ai/config request is the authoritative server-side
  // Admin membership check against this isolated UAT D1; no email is logged.
}

async function request(c, path, payload) {
  const url = new URL(path, c.url);
  if (url.origin !== allowUrl.origin) throw Error('STOP: target moved off UAT origin');
  const method = payload === undefined ? 'GET' : 'POST';
  const headers = {
    Accept: 'application/json',
    'cf-access-jwt-assertion': c.jwt,
    'x-india-ai-admin': '1'
  };
  if (method === 'POST') {
    headers.Origin = c.url.origin;
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method, headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: 'manual', cache: 'no-store',
    signal: AbortSignal.timeout(50000)
  });
  if (res.status >= 300 && res.status < 400) {
    throw Error('BLOCKED: Access redirected to login; signed Admin session missing/expired');
  }
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    throw Error('BLOCKED: non-JSON response (' + res.status + '), likely Access login page');
  }
  const data = await res.json();
  if (!res.ok || !data.success) {
    // Do not include upstream messages: they could contain customer or model content.
    throw Error('BLOCKED: UAT endpoint ' + path + ' rejected (HTTP ' + res.status + ')');
  }
  return data;
}

function assertIndonesian(text, label) {
  const sample = text.toLowerCase();
  const nativeMarkers = /\b(?:dan|yang|untuk|dengan|dalam|pengujian|keamanan|aplikasi|adalah|sebagai|alat|perlu|pada|risiko|biaya|estimasi|hari|penilaian)\b/g;
  pass(label + ': Bahasa Indonesia', (sample.match(nativeMarkers) || []).length >= 2);
  pass(label + ': not a generic unrelated-topic answer', !forbidden.test(sample));
}
function referencedToolNames(text) {
  const names = ['Burp Suite', 'Nmap', 'OWASP ZAP', 'Metasploit', 'Nikto', 'sqlmap', 'Nuclei', 'Wireshark'];
  return names.filter(name => text.toLowerCase().includes(name.toLowerCase()));
}

async function run() {
  const c = config();
  await checkWorker(c);
  await checkAdmin(c);
  const provider = (await request(c, '/api/ai/config')).configs
    ?.find(p => p.id === 'openrouter');
  pass('OpenRouter configured on isolated UAT D1',
    provider?.enabled === true && provider?.testedOk === true && provider?.hasKey === true);
  const model = provider.model;
  pass('OpenRouter model configured', typeof model === 'string' && model.length > 0);
  const prompts = [
    'Jelaskan tujuan dan tahapan penetration testing atau VAPT untuk aplikasi web dalam Bahasa Indonesia.',
    'Alat apa saja yang bisa digunakan untuk itu?',
    'Jelaskan fungsi dua alat yang baru Anda sebutkan dan perbedaannya.',
    'Gunakan bahasa Indonesia saja',
    'Berapa estimasi person-days untuk pekerjaan tersebut? Jelaskan asumsi, tanpa mengarang harga atau data klien.'
  ];
  const history = [];
  const answers = [];
  for (let i = 0; i < prompts.length; i++) {
    const result = await request(c, '/api/ai/generate', { prompt: prompts[i], history });
    pass('Turn ' + (i + 1) + ': substantive AI response', typeof result.content === 'string' && result.content.length > 25);
    if (i !== 3) {
      pass('Turn ' + (i + 1) + ': actual OpenRouter provider',
        /openrouter/i.test(result.providerUsed || '') && result.modelUsed === model);
      assertIndonesian(result.content, 'Turn ' + (i + 1));
    } else {
      pass('Turn 4: language preference confirmed without topic reset',
        /bahasa indonesia/i.test(result.content) && /sebelumnya tetap berlanjut/i.test(result.content) &&
        /penetration testing|VAPT|alat/i.test(result.content));
    }
    if (i === 1) {
      pass('Turn 2: related penetration-testing tools instead of kitchen tools',
        referencedToolNames(result.content).length >= 2);
    }
    if (i === 2) {
      const tools = referencedToolNames(answers[1]);
      pass('Turn 3: refers to previously mentioned tool(s)',
        tools.some(t => result.content.toLowerCase().includes(t.toLowerCase())));
    }
    answers.push(result.content);
    history.push({ role: 'user', content: prompts[i] }, { role: 'assistant', content: result.content });
    // Match frontend history budgeting for long responses.
    const chosen = [];
    let budget = 18000;
    for (let j = history.length - 2; j >= 0 && chosen.length < 12; j -= 2) {
      const q = history[j], a = history[j + 1];
      const truncated = a.content.length <= 4800 ? a.content :
        a.content.slice(0, 3000) + '\n[Bagian tengah jawaban terdahulu diringkas untuk batas konteks]\n' +
        a.content.slice(-1400);
      const qa = [{ ...q }, { ...a, content: truncated }];
      if (qa[0].content.length + qa[1].content.length > budget) break;
      chosen.unshift(...qa);
      budget -= qa[0].content.length + qa[1].content.length;
    }
    history.length = 0;
    history.push(...chosen);
  }
  console.log(JSON.stringify({
    result: 'PASS', kind: 'REAL_ADMIN_CLOUDFLARE_ACCESS_OPENROUTER_UAT',
    candidate_sha: c.sha, target_worker: UAT_WORKER, database: 'isolated UAT',
    provider: 'OpenRouter', model, validated_turns: prompts.length,
    checks: count, no_customer_data: true, actual_model_calls: 4
  }));
}
run().catch(err => {
  console.error(JSON.stringify({
    result: 'BLOCKED_OR_FAIL', kind: 'REAL_ADMIN_CLOUDFLARE_ACCESS_OPENROUTER_UAT',
    validated_checks_before_blocker: count,
    reason: String(err.message || 'Unexpected error').slice(0, 200),
    no_secrets_logged: true
  }));
  process.exitCode = 2;
});
