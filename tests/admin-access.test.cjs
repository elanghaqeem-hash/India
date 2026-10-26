const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {Harness,users,expect}=require('./helpers/sales-flow-harness.cjs');
const nonAdmins=['marketing','sales','presales','finance','approver','legal','viewer'];
function loadTS(file,mocks={}){
 const mod={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);
 return mod.exports;
}
test('all four administration links are visible only to Admin, including mobile navigation source',()=>{
 const nav=loadTS('src/lib/enterprise-navigation.ts');
 const urls=['/boq/users','/settings/system','/settings/options','/settings/ai'];
 assert.deepEqual(nav.navigationForRole('admin').find(g=>g.id==='administration').items.map(x=>x.href),urls);
 for(const role of [...nonAdmins,null,'forged']){
  const groups=nav.navigationForRole(role);
  assert.equal(groups.some(g=>g.id==='administration'),false);
  assert.equal(groups.flatMap(g=>g.items).some(i=>urls.includes(i.href)),false);
 }
});
test('server rendering withholds administrative children from non-Admin and invalid sessions',async()=>{
 for(const role of ['admin',...nonAdmins,'inactive','invalid','unconfigured']){
  let seen;
  const Guard=loadTS('src/components/admin/AdminAccess.tsx',{
   'next/headers':{headers:async()=>new Headers({'cf-access-jwt-assertion':'synthetic-assertion','x-role':'admin'})},
   'next/link':({children,href,...props})=>React.createElement('a',{href,...props},children),
   '@/lib/boq-auth':{authorizeBoQ:async req=>{seen=req.headers.get('cf-access-jwt-assertion');return ['inactive','invalid','unconfigured'].includes(role)?{ok:false,response:Response.json({}, {status:401})}:{ok:true,identity:{role}};}}
  }).default;
  const html=renderToStaticMarkup(await Guard({children:React.createElement('form',{'data-admin-form':'private'},'ADMIN_PRIVATE_FORM')}));
  assert.equal(seen,'synthetic-assertion');
  assert.equal(html.includes('ADMIN_PRIVATE_FORM'),role==='admin',role);
  if(role!=='admin')assert.match(html,/Akses khusus Admin/);
 }
});
test('users and each settings page use the server Admin boundary',()=>{
 for(const file of ['src/app/boq/users/layout.tsx','src/app/settings/layout.tsx']){
  let called=false;
  const Layout=loadTS(file,{'@/components/admin/AdminAccess':props=>{called=true;return props.children;}}).default;
  renderToStaticMarkup(Layout({children:'test'}));assert.equal(called,true,file);
 }
});
test('users, system settings and keys APIs reject anonymous and every non-Admin before reads or writes',async()=>{
 const h=new Harness().seed();
 try{
  for(const route of ['boq/members','admin/system','ai/config'])for(const role of [...nonAdmins,'unknown'])for(const method of ['GET','POST']){
   const before=h.sql.prepare('SELECT count(*) AS n FROM india_operations_events').get().n;
   await expect(h.call(route,method,role,method==='POST'?{action:'catalog',role:'admin',email:users.sales,active:true}:null,'',{'x-role':'admin','x-india-ai-admin':'1'}),role==='unknown'?401:403);
   assert.equal(h.sql.prepare('SELECT count(*) AS n FROM india_operations_events').get().n,before);
  }
 }finally{h.close();}
});
test('Admin registers, edits and disables a member; audit is retained and self-demotion is blocked',async()=>{
 const h=new Harness().seed();
 try{
  h.sql.prepare('INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,?,1)').run(users.admin,'admin');
  const email='new.user@flow.invalid';
  await expect(h.call('boq/members','POST','admin',{email,role:'sales',active:true,unit_key:''}),200);
  let list=await expect(h.call('boq/members','GET','admin'),200);
  assert.equal(list.body.users.find(m=>m.email===email).role,'sales');
  await expect(h.call('boq/members','POST','admin',{email,role:'finance',active:false,unit_key:''}),200);
  list=await expect(h.call('boq/members','GET','admin'),200);
  assert.equal(list.body.users.find(m=>m.email===email).active,0);
  assert.equal(list.body.users.find(m=>m.email===email).role,'finance');
  assert.equal(h.sql.prepare("SELECT count(*) AS n FROM india_operations_events WHERE area='member' AND entity_id=?").get(email).n,2);
  await expect(h.call('boq/members','POST','admin',{email:users.admin,role:'viewer',active:false}),409);
  await expect(h.call('boq/members','POST','admin',{email:'bad',role:'superadmin',active:true}),422);
  await expect(h.call('boq/members','POST','admin',{email,role:'admin',active:true},'',{Origin:'https://forged.invalid'}),403);
 }finally{h.close();}
});
