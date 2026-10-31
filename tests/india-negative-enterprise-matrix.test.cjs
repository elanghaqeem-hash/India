// INDIA negative enterprise role/menu/API matrix. Isolated SQLite fixtures only.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const load=(name)=>{
  const code=fs.readFileSync(path.join(root,'src/lib',name+'.ts'),'utf8');
  const out=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function('module','exports','require',out)(m,m.exports,require);
  return m.exports;
};
const {roles,can}=load('boq-domain');
const {INDIA_NAVIGATION,navigationForRole,firstAccessibleHref}=load('enterprise-navigation');
const access=load('sales-access');
const {fixture,users}=require('./helpers/service-operations-fixture.cjs');
const items=INDIA_NAVIGATION.flatMap(group=>group.items.map(item=>({...item,group:group.id})));
const roleSet=['admin','marketing','sales','presales','finance','approver','legal','viewer'];
const actionRoles={
 create:['admin','finance','presales','sales'],
 read_cost:['admin','finance'],
 edit_cost:['admin','finance'],
 edit_draft:['admin','finance','presales','sales'],
 submit:['admin','finance','presales','sales'],
 approve:['admin','approver'],
 manage_members:['admin']
};
test('canonical baseline: eight identities, 37 unique navigable pages and 12 business groups',()=>{
 assert.deepEqual(roles,roleSet);
 assert.equal(items.length,37);
 assert.equal(INDIA_NAVIGATION.length,12);
 assert.equal(new Set(items.map(x=>x.href)).size,items.length);
 for(const item of items){
  assert.match(item.href,/^\/[a-z0-9/-]+$/);
  assert.ok(fs.existsSync(path.join(root,'src/app',item.href.slice(1),'page.tsx')),item.href);
  assert.ok(item.roles.length>0,item.href);
  for(const role of item.roles)assert.ok(roleSet.includes(role),item.href+' unexpected role '+role);
 }
});
for(const role of roleSet){
 test('negative navigation ACL matrix for '+role+' across all 37 menus',()=>{
  const visible=navigationForRole(role).flatMap(g=>g.items);
  const hrefs=new Set(visible.map(x=>x.href));
  for(const item of items){
   assert.equal(hrefs.has(item.href),item.roles.includes(role),role+' permission '+item.href);
  }
  assert.equal(visible.length,items.filter(x=>x.roles.includes(role)).length);
  assert.equal(firstAccessibleHref(role),visible[0]?.href||null);
 });
 test('negative BoQ capability matrix for '+role+' across all 7 actions',()=>{
  for(const [action,allowed] of Object.entries(actionRoles))
   assert.equal(can(role,action),allowed.includes(role),role+' '+action);
 });
}
test('missing/invalid/unknown role has zero accessible menus',()=>{
 for(const role of [null,undefined,'','superadmin','approver;admin','Admin','finance ']){
  assert.deepEqual(navigationForRole(role),[]);
  assert.equal(firstAccessibleHref(role),null);
 }
});
test('Sales B cannot manipulate Sales A records, Presales cannot alter price or PO',()=>{
 const maker=users.sales,other=users.other;
 assert.equal(access.canReadDeal('sales',other,maker),false);
 assert.equal(access.canReadAccount('sales',other,maker),false);
 assert.equal(access.canEditAccount('sales',other,maker),false);
 assert.equal(access.canChangeStage('sales',other,maker),false);
 for(const fields of [{po_amount_before_vat:'1'},{quotation_number:'FRAUD'},{customer_decision:'approved'}]){
  assert.equal(access.canEditDeal('presales',users.presales,maker,fields,false),false);
 }
 assert.equal(access.canEditDeal('presales',users.presales,maker,{technical_scope:'Valid'},true),false);
});
test('ERP denial matrix: every unauthorized role is rejected before changing business tables',async()=>{
 const h=fixture();
 try{
  const cases=[
   {route:'erp/organization',allowed:['admin'],payload:{action:'create_unit',id:'negative-unit',code:'NO',label:'Not allowed unit',kind:'legal_entity',parent_id:null}},
   {route:'erp/ledger',allowed:['finance'],payload:{action:'period',legal_entity_id:'legal-invalid',period:'2026-10'}},
   {route:'erp/procurement',allowed:['admin','presales'],payload:{action:'create_po',offer_id:'missing-offer',po_number:'NEG-PO-001',qty:1}},
   {route:'erp/cyber-operations',allowed:['admin','presales'],payload:{action:'open',project_id:'missing-project',kind:'vapt_finding',external_ref:'NEG-01',title:'Unapproved test finding',severity:'high',classification:'restricted'}}
  ];
  for(const c of cases){
   for(const role of roleSet.filter(x=>!c.allowed.includes(x))){
    const result=await h.call(c.route,'POST',role,c.payload);
    assert.equal(result.status,403,c.route+' '+role+': '+JSON.stringify(result.body));
   }
  }
  for(const table of ['india_erp_org_units','india_gl_periods','india_purchase_orders','india_cyber_cases'])
   assert.equal(h.sql.prepare('SELECT count(*) AS n FROM '+table).get().n,0,table);
 }finally{h.close();}
});
test('cross-site POST on all 4 ERP APIs rejected for all 8 signed mock roles, with zero writes',async()=>{
 const h=fixture();
 try{
  for(const role of roleSet){
   for(const route of ['erp/organization','erp/ledger','erp/procurement','erp/cyber-operations']){
    const r=await h.call(route,'POST',role,{action:'invalid'},' ',{Origin:'https://evil.invalid'});
    assert.equal(r.status,403,role+' '+route+' '+JSON.stringify(r.body));
   }
  }
  for(const table of ['india_erp_org_units','india_gl_journals','india_purchase_orders','india_cyber_cases'])
   assert.equal(h.sql.prepare('SELECT count(*) AS n FROM '+table).get().n,0,table);
 }finally{h.close();}
});
test('ERP rejects malformed transactions without financial or cyber side effects',async()=>{
 const h=fixture();
 try{
  const attempts=[
   ['erp/organization','admin',{action:'create_unit',id:'bad-parent',code:'AA',label:'Bad unit',kind:'legal_entity',parent_id:'!invalid'}],
   ['erp/ledger','finance',{action:'journal',legal_entity_id:'legal-x',period_id:'period-x',memo:'Invalid journal entry for test',source_key:'NEG-BAD',source_type:'manual',lines:[{account_id:'1000',debit_cents:100,credit_cents:0},{account_id:'2000',debit_cents:0,credit_cents:99}]}],
   ['erp/ledger','finance',{action:'journal',legal_entity_id:'legal-x',period_id:'period-x',memo:'Invalid decimal amount for test',source_key:'NEG-DEC',source_type:'manual',lines:[{account_id:'1000',debit_cents:99.5,credit_cents:0},{account_id:'2000',debit_cents:0,credit_cents:99.5}]}],
   ['erp/procurement','admin',{action:'create_po',offer_id:'bad!',po_number:'NEG-P0',qty:-1}],
   ['erp/cyber-operations','admin',{action:'open',project_id:'missing',kind:'unsupported',external_ref:'F-01',title:'Invalid type test',severity:'urgent',classification:'public'}],
  ];
  for(const [route,role,payload] of attempts){
   const r=await h.call(route,'POST',role,payload);
   assert.equal(r.status,422,route+': '+JSON.stringify(r.body));
  }
  for(const table of ['india_erp_org_units','india_gl_journals','india_gl_lines','india_purchase_orders','india_cyber_cases'])
   assert.equal(h.sql.prepare('SELECT count(*) AS n FROM '+table).get().n,0,table);
  assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{h.close();}
});
test('ERP GET organization forbids all 6 roles other than Admin and Approver',async()=>{
 const h=fixture();
 try{
  for(const role of roleSet.filter(x=>!['admin','approver'].includes(x))){
   const r=await h.call('erp/organization','GET',role,null);
   assert.equal(r.status,403,role+': '+JSON.stringify(r.body));
  }
 }finally{h.close();}
});
