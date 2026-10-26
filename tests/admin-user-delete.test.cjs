const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Harness,users,expect}=require('./helpers/sales-flow-harness.cjs');

function env(){
 const h=new Harness().seed();
 h.sql.prepare('INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,?,1)').run(users.admin,'admin');
 return h;
}
const create=(h,email='uat.delete@india.invalid',active=false,role='viewer')=>
 h.call('boq/members','POST','admin',{email,role,active,unit_key:''});
const del=(h,email='uat.delete@india.invalid',role='admin',headers={})=>
 h.call('boq/members','DELETE',role,{email},'',headers);

test('Delete UI appears for registered user and requires confirmation; active button disabled',()=>{
 const s=fs.readFileSync('src/app/boq/users/page.tsx','utf8');
 assert.match(s,/Delete<\/button>/);
 assert.match(s,/window\.confirm/);
 assert.match(s,/method:'DELETE'/);
 assert.match(s,/disabled=\{busy\|\|!!m\.active\}/);
});
test('Only a server-authorized Admin may delete, cross-origin request is rejected',async()=>{
 const h=env();try{
  await expect(create(h),200);
  for(const role of ['sales','finance','presales','approver','viewer','marketing','legal'])await expect(del(h,undefined,role),403);
  await expect(del(h,undefined,'unknown'),401);
  await expect(del(h,undefined,'admin',{Origin:'https://evil.invalid'}),403);
  assert.ok(h.sql.prepare("SELECT 1 FROM india_members WHERE email='uat.delete@india.invalid'").get());
 }finally{h.close();}
});
test('Inactive registration is deleted atomically with unit assignment, immutable audit remains',async()=>{
 const h=env();try{
  const email='uat.delete@india.invalid';
  await expect(create(h,email,false,'finance'),200);
  h.sql.prepare('INSERT INTO india_member_orgs(email,unit_key,updated_by) VALUES(?,?,?)').run(email,'unit_example',users.admin);
  const before=h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE area='member' AND entity_id=?").get(email).n;
  const result=await expect(del(h,email),200);assert.equal(result.body.success,true);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_members WHERE email=?').get(email).n,0);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_member_orgs WHERE email=?').get(email).n,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE area='member' AND entity_id=?").get(email).n,before+1);
  assert.equal(h.sql.prepare("SELECT action FROM india_operations_events WHERE area='member' AND entity_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(email).action,'DELETE');
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_audit_log WHERE action='MEMBER_DELETE' AND summary LIKE ?").get(email+':%').n,1);
  await expect(del(h,email),404);
  await expect(create(h,email,false,'viewer'),200);
 }finally{h.close();}
});
test('Active accounts require deactivation and admin cannot delete itself',async()=>{
 const h=env();try{
  const email='uat.active@india.invalid';await expect(create(h,email,true,'sales'),200);
  await expect(del(h,email),409);
  await expect(del(h,users.admin),409);
  assert.equal(h.sql.prepare('SELECT active FROM india_members WHERE email=?').get(email).active,1);
  await expect(h.call('boq/members','POST','admin',{email,role:'sales',active:false,unit_key:''}),200);
  await expect(del(h,email),200);
 }finally{h.close();}
});
test('Concurrent activation or audit write error rolls back member deletion completely',async()=>{
 const h=env();try{
  const email='uat.delete@india.invalid';await expect(create(h,email),200);
  h.beforeBatch=()=>h.sql.prepare('UPDATE india_members SET active=1 WHERE email=?').run(email);
  await expect(del(h,email),409);
  assert.equal(h.sql.prepare('SELECT active FROM india_members WHERE email=?').get(email).active,1);
  await expect(h.call('boq/members','POST','admin',{email,role:'viewer',active:false,unit_key:''}),200);
  h.sql.exec("CREATE TRIGGER reject_delete_audit BEFORE INSERT ON india_operations_events WHEN NEW.action='DELETE' BEGIN SELECT RAISE(ABORT,'audit-failure'); END");
  await expect(del(h,email),503);
  assert.equal(h.sql.prepare('SELECT active FROM india_members WHERE email=?').get(email).active,0);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_audit_log WHERE action='MEMBER_DELETE'").get().n,0);
 }finally{h.close();}
});
test('Referenced member is not silently deleted when another table requires its identity',async()=>{
 const h=env();try{
  const email='uat.delete@india.invalid';await expect(create(h,email),200);
  h.sql.exec("CREATE TABLE uat_member_dependency(id TEXT PRIMARY KEY,email TEXT NOT NULL REFERENCES india_members(email))");
  h.sql.prepare('INSERT INTO uat_member_dependency(id,email) VALUES(?,?)').run('dependent-1',email);
  await expect(del(h,email),409);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_members WHERE email=?').get(email).n,1);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_audit_log WHERE action='MEMBER_DELETE'").get().n,0);
 }finally{h.close();}
});
