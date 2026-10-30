const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const file='src/lib/enterprise-navigation.ts';
const transpiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};
vm.runInNewContext(transpiled,{exports:exportsObject,require:n=>{throw Error('Unexpected runtime dependency '+n)}},{filename:file});
const {INDIA_NAVIGATION,navigationForRole}=exportsObject;

test('twelve business and administration menu groups, no duplicate or demo routes',()=>{
 assert.equal(INDIA_NAVIGATION.length,12);
 assert.equal(new Set(INDIA_NAVIGATION.map(x=>x.id)).size,12);
 const all=INDIA_NAVIGATION.flatMap(x=>x.items.map(i=>i.href));
 assert.equal(new Set(all).size,all.length);
 for(const href of all){
  assert.match(href,/^\/(?:sales\/|psa\/timesheets$|customers$|partners$|reports$|settings\/|boq(?:\/users)?$|flexguard$|post-po$|approvals$|scoping$)/);
  assert.ok(fs.existsSync(path.join(root,'src/app',href.replace(/^\//,''),'page.tsx')),href);
 }
 for(const legacy of ['/','/pricing','/tender','/proposals'])
  assert.ok(!all.includes(legacy),legacy);
});

test('user roles are filtered; Admin alone gets secret-management menu',()=>{
 const admin=navigationForRole('admin').flatMap(g=>g.items.map(x=>x.href));
 assert.ok(admin.includes('/settings/system'));assert.ok(admin.includes('/settings/ai'));
 for(const role of ['sales','marketing','presales','finance','approver','legal','viewer']){
  const routes=navigationForRole(role).flatMap(g=>g.items.map(x=>x.href));
  assert.ok(!routes.includes('/settings/system'),role);
  assert.ok(!routes.includes('/settings/ai'),role);
 }
 assert.deepEqual(Array.from(navigationForRole('viewer').flatMap(g=>g.items.map(x=>x.href))),['/boq']);
 assert.equal(navigationForRole('made-up-role').length,0);
 assert.equal(navigationForRole(null).length,0);
 assert.ok(!navigationForRole('sales').flatMap(x=>x.items.map(i=>i.href)).includes('/sales/billing'));
});

test('Smart Scoping is discoverable in Presales for Admin, Sales and Presales only',()=>{
 const presales=INDIA_NAVIGATION.find(group=>group.id==='presales');
 assert.ok(presales);
 assert.ok(presales.items.some(item=>item.href==='/scoping'&&item.label==='Smart Scoping & Sizing'));
 for(const role of ['admin','sales','presales']){
  const links=navigationForRole(role).flatMap(group=>group.items.map(item=>item.href));
  assert.ok(links.includes('/scoping'),role);
 }
 for(const role of ['finance','approver','legal','marketing','viewer']){
  const links=navigationForRole(role).flatMap(group=>group.items.map(item=>item.href));
  assert.ok(!links.includes('/scoping'),role);
 }
 const scoped=read('src/app/scoping/page.tsx');
 assert.match(scoped,/SCOPING_SERVICE_TYPES\.map/);
});

test('current-user endpoint delegates to server Access and never reads client role',()=>{
 const handler=read('src/app/api/sales/identity/route.ts');
 assert.match(handler,/await authorizeBoQ\(req\)/);
 assert.match(handler,/if\(!auth\.ok\)return auth\.response/);
 assert.match(handler,/auth\.identity\.email/);
 assert.match(handler,/auth\.identity\.role/);
 assert.doesNotMatch(handler,/new URL\(req\.url\)\.searchParams/);
});

test('shell and header never supply demo users or selectable role; mobile has all groups',()=>{
 const shell=read('src/components/layout/AppShell.tsx');
 const header=read('src/components/layout/Navbar.tsx');
 const side=read('src/components/layout/Sidebar.tsx');
 const mobile=read('src/components/layout/MobileNav.tsx');
 assert.match(shell,/fetch\('\/api\/sales\/identity'/);
 assert.match(shell,/fetch\('\/api\/sales\/approval-queue'/);
 assert.match(shell,/pendingApprovalsCount=\{pendingApprovalsCount\}/);
 assert.doesNotMatch(shell,/useState<SystemRole>\('sales'\)/);
 assert.doesNotMatch(header,/RBAC Simulation|onRoleChange\(|const roles: Array/);
 assert.match(header,/Sesi belum terverifikasi/);
 assert.match(side,/navigationForRole\(role\)/);
 assert.match(mobile,/navigationForRole\(role\)/);
 assert.match(mobile,/aria-label="Buka seluruh menu INDIA"/);
 assert.match(header,/href="\/approvals"/);
 assert.match(header,/role==='admin'&&<Link/);
});
