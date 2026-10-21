const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const shell=fs.readFileSync(path.join(root,'src/components/layout/AppShell.tsx'),'utf8');
const navbar=fs.readFileSync(path.join(root,'src/components/layout/Navbar.tsx'),'utf8');

test('D1 pages never expose demo role impersonation controls',()=>{
 assert.match(shell,/pathname\.startsWith\('\/marketing\/leads'\)/);
 assert.match(shell,/pathname\.startsWith\('\/sales\/pipeline'\)/);
 assert.match(shell,/pathname\.startsWith\('\/boq'\)/);
 assert.match(shell,/enableRoleSimulation=\{!isD1Page\}/);
 assert.match(navbar,/enableRoleSimulation \? \(/);
 assert.match(navbar,/Akses Cloudflare/);
 assert.match(navbar,/Hak akses diverifikasi oleh login Cloudflare Access/);
});
test('D1 pages never show fabricated demo approval counts',()=>{
 assert.match(shell,/pendingApprovalsCount=\{isD1Page \? 0 : pendingCount\}/);
});
