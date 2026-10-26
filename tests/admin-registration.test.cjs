const test=require('node:test');
const assert=require('node:assert/strict');
const {Harness,expect,tenant}=require('./helpers/sales-flow-harness.cjs');
const payload={
 action:'save',group_key:'sumber_lead',option_value:'partner_referral',
 option_label:'Referensi Partner',description:'Sumber lead dari partner terverifikasi',
 sort_order:10,active:true,version:0
};
test('migration 0031 creates empty auditable admin options without demo data',()=>{
 const h=new Harness(true,true).seed();
 try{
  assert.equal(h.sql.prepare("SELECT count(*) AS n FROM india_admin_options").get().n,0);
  assert.equal(h.sql.prepare("SELECT count(*) AS n FROM india_schema_migrations WHERE version=31").get().n,1);
  assert.equal(h.sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{h.close();}
});
test('only Admin can register or edit option values; authenticated staff may read active choices',async()=>{
 const h=new Harness(true,true).seed();
 try{
  await expect(h.call('admin/options','GET','sales'),403);
  await expect(h.call('admin/options','POST','sales',payload),403);
  await expect(h.call('admin/options','GET','admin'),200);
  await expect(h.call('admin/options','POST','admin',{...payload,group_key:'No spaces'}),422);
  const created=await expect(h.call('admin/options','POST','admin',payload),201);
  assert.equal(created.body.version,1);
  const choices=await expect(h.call('reference/options','GET','sales',null,'?group=sumber_lead'),200);
  assert.deepEqual(choices.body.items,[{value:'partner_referral',label:'Referensi Partner'}]);
  const saved=await expect(h.call('admin/options','GET','admin'),200);
  assert.equal(saved.body.items.length,1);
  assert.equal(saved.body.items[0].updated_by,'admin@flow.invalid');
  assert.equal(h.sql.prepare("SELECT count(*) AS n FROM india_operations_events WHERE tenant_id=? AND area='admin_options'").get(tenant).n,1);
  await expect(h.call('admin/options','POST','admin2',{...payload,version:0}),409);
  await expect(h.call('admin/options','POST','admin2',{...payload,version:1,active:false}),200);
  assert.equal((await expect(h.call('reference/options','GET','viewer',null,'?group=sumber_lead'),200)).body.items.length,0);
  await expect(h.call('admin/options','POST','admin',{...payload,version:1,active:true}),409);
  assert.equal(h.sql.prepare("SELECT version FROM india_admin_options WHERE group_key='sumber_lead'").get().version,2);
  assert.equal(h.sql.prepare("SELECT count(*) AS n FROM india_operations_events WHERE tenant_id=? AND area='admin_options'").get(tenant).n,2);
 }finally{h.close();}
});
test('audit failure rolls back option changes and cross-site origin is rejected',async()=>{
 const h=new Harness(true,true).seed();
 try{
  await expect(h.call('admin/options','POST','admin',payload,'',{Origin:'https://attacker.invalid'}),403);
  h.sql.exec("CREATE TRIGGER fail_option_audit BEFORE INSERT ON india_operations_events WHEN NEW.area='admin_options' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  await expect(h.call('admin/options','POST','admin',payload),503);
  assert.equal(h.sql.prepare('SELECT count(*) AS n FROM india_admin_options').get().n,0);
  assert.equal(h.sql.prepare('SELECT count(*) AS n FROM india_sales_tx_guards').get().n,0);
 }finally{h.close();}
});
test('Admin registration UI enforces server-verified role; options API cannot appear through an unsafe prefix',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 for(const route of ['src/app/api/admin/options/route.ts','src/app/api/boq/members/route.ts','src/app/api/ai/config/route.ts']){
  const source=read(route);
  assert.match(source,/authorizeBoQ\(/);
  assert.match(source,/role\s*!==\s*'admin'|identity\.role\s*!==\s*'admin'|i\.role\s*!==\s*'admin'/);
 }
 assert.match(read('src/app/settings/option-registry/page.tsx'),/allowed&&/);
 assert.match(read('src/lib/enterprise-navigation.ts'),/Registrasi User/);
 assert.match(read('src/lib/enterprise-navigation.ts'),/Opsi/);
 assert.match(read('src/lib/enterprise-navigation.ts'),/API Key/);
});
