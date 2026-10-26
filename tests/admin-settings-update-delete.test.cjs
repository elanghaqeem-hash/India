const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Harness,users,expect}=require('./helpers/sales-flow-harness.cjs');
function fixture(){
 const h=new Harness().seed();
 for(const key of ['admin','admin2','sales'])h.sql.prepare('INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,?,1)')
  .run(users[key],key==='admin2'?'admin':key);
 return h;
}
const sys=(h,role,p)=>h.call('admin/system','POST',role,p);
const org=(h,key,title='RTI',version=0,extra={})=>
 sys(h,'admin',{action:'setting',kind:'organization',setting_key:key,title,level:'institution',parent_key:'',version,...extra});
const approval=(h,id)=>sys(h,'admin2',{action:'approve',id,notes:'Second Admin independently reviewed the request'});
test('RTI organization card update creates revision, replaces own draft and keeps audit history',async()=>{
 const h=fixture();try{
  const old=await expect(org(h,'001'),201);
  const next=await expect(org(h,'001','RTI Indonesia',1,{source_id:old.body.id}),201);
  assert.equal(next.body.version,2);
  assert.equal(h.sql.prepare('SELECT status FROM india_setting_versions WHERE id=?').get(old.body.id).status,'rejected');
  const view=await expect(h.call('admin/system','GET','admin'),200);
  assert.equal(view.body.latestVersions['organization:001'],2);
  assert.equal(view.body.settings.filter(x=>x.setting_key==='001').length,1);
  assert.equal(view.body.settings.find(x=>x.id===next.body.id).title,'RTI Indonesia');
  await expect(approval(h,old.body.id),409);
  await expect(approval(h,next.body.id),200);
  assert.equal(h.sql.prepare('SELECT title FROM india_effective_settings WHERE setting_key=?').get('001').title,'RTI Indonesia');
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE area='setting'").get().n,4);
 }finally{h.close();}
});
test('Delete on draft RTI removes card but retains SQL history and allows the same code again',async()=>{
 const h=fixture();try{
  const created=await expect(org(h,'rti'),201);
  await expect(sys(h,'admin2',{action:'delete_setting',id:created.body.id,version:1}),403);
  await expect(sys(h,'sales',{action:'delete_setting',id:created.body.id,version:1}),403);
  await expect(sys(h,'admin',{action:'delete_setting',id:created.body.id,version:999}),409);
  const removed=await expect(sys(h,'admin',{action:'delete_setting',id:created.body.id,version:1}),200);
  assert.equal(removed.body.status,'discarded');
  const list=await expect(h.call('admin/system','GET','admin'),200);
  assert.ok(!list.body.settings.some(x=>x.setting_key==='rti'));
  assert.equal(list.body.latestVersions['organization:rti'],1);
  assert.equal(h.sql.prepare('SELECT status FROM india_setting_versions WHERE id=?').get(created.body.id).status,'rejected');
  const replacement=await expect(org(h,'rti','RTI Reloaded',1),201);
  assert.equal(replacement.body.version,2);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE action='DISCARD'").get().n,1);
  assert.throws(()=>h.sql.prepare('DELETE FROM india_setting_versions').run(),/SETTING_IMMUTABLE/);
 }finally{h.close();}
});
test('Delete approved RTI creates independently reviewed tombstone and hides only effective setting',async()=>{
 const h=fixture();try{
  const first=await expect(org(h,'rti'),201);
  await expect(approval(h,first.body.id),200);
  await expect(sys(h,'admin',{action:'delete_setting',id:first.body.id,version:999}),409);
  const request=await expect(sys(h,'admin',{action:'delete_setting',id:first.body.id,version:1}),201);
  assert.equal(request.body.status,'deletion_pending');
  assert.equal(h.sql.prepare('SELECT title FROM india_effective_settings WHERE setting_key=?').get('rti').title,'RTI');
  await expect(sys(h,'admin',{action:'approve',id:request.body.id,notes:'Self review is forbidden'}),403);
  await expect(approval(h,request.body.id),200);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_effective_settings WHERE setting_key=?').get('rti').n,0);
  const list=await expect(h.call('admin/system','GET','admin'),200);
  assert.ok(!list.body.settings.some(x=>x.setting_key==='rti'));
  assert.equal(list.body.latestVersions['organization:rti'],2);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_setting_versions WHERE setting_key='rti'").get().n,2);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE action='DELETE_DRAFT'").get().n,1);
 }finally{h.close();}
});
test('Cannot orphan hierarchy or active member assignments, including changes during pending review',async()=>{
 const h=fixture();try{
  const root=await expect(org(h,'root','Parent RTI'),201);
  await expect(approval(h,root.body.id),200);
  const unit=await expect(org(h,'unit','Work Unit',0,{level:'unit',parent_key:'root'}),201);
  await expect(approval(h,unit.body.id),200);
  await expect(sys(h,'admin',{action:'delete_setting',id:root.body.id,version:1}),409);
  const deletion=await expect(sys(h,'admin',{action:'delete_setting',id:unit.body.id,version:1}),201);
  await expect(h.call('boq/members','POST','admin',{email:users.sales,role:'sales',active:true,unit_key:'unit'}),200);
  await expect(approval(h,deletion.body.id),409);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_effective_settings WHERE setting_key=?').get('unit').n,1);
  await expect(h.call('boq/members','POST','admin',{email:users.sales,role:'sales',active:true,unit_key:''}),200);
  await expect(approval(h,deletion.body.id),200);
  const parentDeletion=await expect(sys(h,'admin',{action:'delete_setting',id:root.body.id,version:1}),201);
  await expect(approval(h,parentDeletion.body.id),200);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_effective_settings WHERE kind='organization'").get().n,0);
 }finally{h.close();}
});
test('UI surfaces both actions; fails closed on failed audit and prevents stale deletion',async()=>{
 const ui=fs.readFileSync('src/components/admin/SystemSettings.tsx','utf8');
 assert.match(ui,/>Update<\\/button>/);
 assert.match(ui,/>Delete<\\/button>/);
 assert.match(ui,/window\\.confirm/);
 const h=fixture();try{
  const r=await expect(org(h,'rti'),201);
  h.sql.exec("CREATE TRIGGER abort_setting_audit BEFORE INSERT ON india_operations_events BEGIN SELECT RAISE(ABORT,'injected failure'); END");
  await expect(sys(h,'admin',{action:'delete_setting',id:r.body.id,version:1}),503);
  assert.equal(h.sql.prepare('SELECT status FROM india_setting_versions WHERE id=?').get(r.body.id).status,'draft');
 }finally{h.close();}
});
