const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const routes=['page.tsx','pricing/page.tsx','approvals/page.tsx','tender/page.tsx','flexguard/page.tsx','post-po/page.tsx'];
test('legacy pages never expose browser demo store or invented business balances',()=>{
 for(const suffix of routes){
  const p='src/app/'+suffix,c=read(p);
  assert.doesNotMatch(c,/appStore|post-po-dummy|createDemoPostPoPacket|fillEmptyPostPoWithDummy/,p);
  assert.doesNotMatch(c,/Math\.random\(|paguBudget \* 0\.95|Pre-Sales \(Hendri\)/,p);
 }
});
test('legacy route compatibility reuses existing D1-backed sales workspaces',()=>{
 for(const [name,target] of [['pricing','/boq'],['tender','/sales/bid-readiness']]){
  const source=read('src/app/'+name+'/page.tsx');
  assert.match(source,/from 'next\/navigation'/);
  assert.ok(source.includes("redirect('"+target+"'"),name);
  assert.match(source,/encodeURIComponent\(id\)/);
 }
 for(const target of ['boq','sales/bid-readiness','sales/delivery']){
  assert.ok(fs.existsSync(path.join(root,'src/app',target,'page.tsx')),target);
 }
});
test('root and approval center derive role from real Access/D1 identity',()=>{
 for(const page of ['src/app/page.tsx','src/app/approvals/page.tsx']){
  const code=read(page);
  assert.match(code,/fetch\('\/api\/sales\/identity'/);
  assert.doesNotMatch(code,/role: *'admin'|getState\(\)/);
 }
 assert.match(read('src/app/page.tsx'),/firstAccessibleHref/);
 assert.match(read('src/app/approvals/page.tsx'),/STATIONS\.filter\(s=>role&&s\.roles\.includes\(role\)\)/);
 assert.match(read('src/app/flexguard/page.tsx'),/BLOCKED/);
 assert.match(read('src/app/post-po/page.tsx'),/hasDualVerifiedPO/);
 assert.doesNotMatch(read('src/app/flexguard/page.tsx'),/\/api\/wallets/);
});
test('old mutable API routes stay fail closed by middleware',()=>{
 const code=read('src/middleware.ts');
 const allow=code.match(/const D1_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1]||'';
 for(const route of ['/api/tenders','/api/wallets','/api/approvals','/api/opportunities','/api/proposals']){
  assert.ok(!allow.includes("'"+route+"'"),route);
 }
});
