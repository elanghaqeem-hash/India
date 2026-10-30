// Regression for the real Next middleware route allowlist, not a fake HTTP UAT.
// This gate does NOT establish authenticated Access acceptance or D1 readiness.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const base = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'src/middleware.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const sandboxModule = { exports: {} };
const nextServer = {
  NextResponse: {
    next: () => ({ status: 200, allowed: true }),
    json: (body, options) => ({ status: options.status, body, headers: options.headers })
  }
};
vm.runInNewContext(js, {
  exports: sandboxModule.exports,
  require: name => {
    assert.equal(name, 'next/server');
    return nextServer;
  }
}, { filename: 'src/middleware.ts' });
const { middleware, isEnabledD1ApiRoute } = sandboxModule.exports;

const permitted = [
  '/api/boq', '/api/boq/catalog', '/api/ai/config', '/api/ai/generate',
  '/api/ai/assist', '/api/scoping/upload', '/api/reference/postal',
  '/api/marketing/leads', '/api/marketing/campaigns',
  '/api/marketing/lead-intelligence', '/api/sales',
  '/api/sales/customer360', '/api/sales/service-operations',
  '/api/partners', '/api/reports', '/api/admin/system', '/api/psa/timesheets',
];
const blocked = [
  '/api/opportunities', '/api/proposals', '/api/tenders', '/api/approvals',
  '/api/partners/export', '/api/reports/arbitrary', '/api/admin/system/debug',
  '/api/partners-malicious', '/api/report', '/api/admin',
  '/api/unknown', '/api/boq-impersonation', '/api/ai/unsafe', '/api/psa/timesheets/export',
];

test('existing D1 routes plus authenticated 0026 enterprise handlers are reachable', () => {
  for (const path of permitted) {
    assert.equal(isEnabledD1ApiRoute(path), true, path);
    assert.equal(middleware({ nextUrl: { pathname: path } }).status, 200, path);
  }
});

test('legacy/unreviewed APIs and misleading prefix paths remain fail-closed', () => {
  for (const path of blocked) {
    assert.equal(isEnabledD1ApiRoute(path), false, path);
    const result = middleware({ nextUrl: { pathname: path } });
    assert.equal(result.status, 503, path);
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
});

test('each newly enabled route still calls real server-side Access authorization', () => {
  for (const route of ['partners', 'reports', 'admin/system', 'psa/timesheets']) {
    const code = fs.readFileSync(path.join(base, 'src/app/api', route, 'route.ts'), 'utf8');
    assert.match(code, /import\s*\{[^}]*authorizeBoQ[^}]*\}\s*from\s*['"]@\/lib\/boq-auth['"]/);
    assert.match(code, /await\s+authorizeBoQ\(req\)/);
    assert.match(code, /if\s*\(!a\.ok\)\s*return\s+a\.response/);
  }
});
