const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {spawnSync}=require('node:child_process');
const source=fs.readFileSync('src/lib/flexguard-ledger.ts','utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(transpiled,{exports:mod.exports,require:n=>{throw Error(n)}});
const {walletTotals,canPostFlex}=mod.exports;
test('real event balance invariants and positive integer units',()=>{
 const t=walletTotals([{kind:'ISSUE',units:10},{kind:'RESERVE',units:4},{kind:'DEBIT',units:3},
  {kind:'REFUND',units:2},{kind:'RELEASE',units:1}]);
 assert.equal(t.issued,10);assert.equal(t.available,9);assert.equal(t.reserved,0);assert.equal(t.consumed,1);
 assert.throws(()=>walletTotals([{kind:'RESERVE',units:1}]),/INSUFFICIENT/);
 assert.throws(()=>walletTotals([{kind:'ISSUE',units:1.5}]),/integer/);
});
test('role-specific authorizations deny unrelated maker and viewer',()=>{
 assert.equal(canPostFlex('viewer','ISSUE'),false);
 assert.equal(canPostFlex('sales','ISSUE'),false);
 assert.equal(canPostFlex('finance','ISSUE'),true);
 assert.equal(canPostFlex('presales','DEBIT'),true);
 assert.equal(canPostFlex('finance','REFUND'),true);
});
test('original SQLite migration enforces financial guards, immutable ledger and source',()=>{
 const r=spawnSync('python3',['tests/flexguard-sql-rehearsal.py'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
 assert.match(r.stdout,/PASS/);
});
test('FlexGuard endpoint uses verified Access, original Vault and no memory ledger',()=>{
 const r=fs.readFileSync('src/app/api/sales/flexguard/route.ts','utf8');
 const page=fs.readFileSync('src/app/flexguard/page.tsx','utf8');
 assert.match(r,/await authorizeBoQ\(req\)/);
 assert.match(r,/await supportingOriginal\(db,doc,opp\)/);
 assert.match(r,/await db\.batch\(/);
 assert.doesNotMatch(r,/appStore/);
 assert.match(page,/\/api\/sales\/flexguard/);
 assert.doesNotMatch(page,/appStore|\/api\/wallets/);
});
