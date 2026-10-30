const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const node=fs.readFileSync('src/lib/enterprise-navigation.ts','utf8');
const shell=fs.readFileSync('src/components/layout/AppShell.tsx','utf8');
const header=fs.readFileSync('src/components/layout/Navbar.tsx','utf8');
const q=fs.readFileSync('src/app/api/sales/approval-queue/route.ts','utf8');
const wallet=fs.readFileSync('src/app/flexguard/page.tsx','utf8');
test('approval center is present and badge consumes authenticated role-scoped D1 with unknown != zero',()=>{
 assert.match(node,/Approval Center · Lintas Modul/);
 assert.match(shell,/fetch\('\/api\/sales\/approval-queue'/);
 assert.match(shell,/setPendingApprovalsCount\(null\)/);
 assert.doesNotMatch(shell,/pendingApprovalsCount=\{0\}/);
 assert.match(header,/href="\/approvals"/);
 assert.match(header,/pendingApprovalsCount===null/);
 assert.match(header,/role==='admin'&&<Link/);
});
test('FlexGuard pending entitlement flows to original wallet via canonical D1 query',()=>{
 assert.match(q,/FROM india_flexguard_wallets w/);
 assert.match(q,/w.status='draft'/);
 assert.match(q,/lower\(w.created_by\)!=\?/);
 assert.ok(q.includes("?wallet_id='+encodeURIComponent(row.id)"));
 assert.match(wallet,/wallet_id=/);
});
test('isolated real migrations through 37 parse and existing wallet table supports approval query',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 try{
 for(const name of fs.readdirSync('migrations').filter(s=>/^\d{4}_.+\.sql$/.test(s)).sort())
  db.exec(fs.readFileSync('migrations/'+name,'utf8'));
 const sql=`SELECT 'flexguard_wallet' AS kind,w.id,p.opportunity_id,('FlexGuard entitlement · '||a.legal_name) AS title,w.created_by,w.created_at
 FROM india_flexguard_wallets w
 JOIN india_service_contracts c ON c.id=w.contract_id AND c.tenant_id=w.tenant_id
 JOIN india_sales_accounts a ON a.id=w.customer_id AND a.tenant_id=w.tenant_id
 JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id
 WHERE w.tenant_id=? AND w.status='draft' AND c.status='active' AND c.model='FlexGuard'
 AND lower(w.created_by)!=? ORDER BY w.created_at DESC LIMIT 101`;
 const rows=db.prepare(sql).all('defendit360','checker@synthetic.invalid');
 assert.deepEqual(rows,[]);
 assert.equal(db.prepare('SELECT MAX(version) v FROM india_schema_migrations').get().v,37);
 assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
