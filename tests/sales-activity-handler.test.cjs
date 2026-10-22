const test=require('node:test'),assert=require('node:assert/strict');
const {Harness,users}=require('./helpers/sales-flow-harness.cjs');
function fixture(){
 const h=new Harness().seed();
 for(const [role,email] of Object.entries(users)){
  h.sql.prepare("INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,?,1)").run(email,role==='other'?'sales':role);
 }
 return h;
}
function schedule(){
 const start=new Date(Date.now()+3600000).toISOString(),due=new Date(Date.now()+7200000).toISOString();
 return {action:'schedule',scope:'opportunity',target_id:'opp-qa',kind:'call',
 subject:'Follow-up penawaran QA',detail:'Hubungi procurement pelanggan',start_at:start,due_at:due};
}
test('actual API: Sales A schedule, Sales B isolated, Admin sees timeline and manager mapping',async()=>{
 const h=fixture();try{
  const payload=schedule();
  assert.equal((await h.call('sales/activities','POST','other',payload)).status,403);
  const created=await h.call('sales/activities','POST','sales',payload);
  assert.equal(created.status,201,JSON.stringify(created));
  const id=created.body.id;
  const [sales,other,admin]=await Promise.all([
   h.call('sales/activities','GET','sales'),h.call('sales/activities','GET','other'),h.call('sales/activities','GET','admin')
  ]);
  assert.equal(sales.status,200);assert.equal(other.status,200);assert.equal(admin.status,200);
  assert.ok(sales.body.tasks.some(t=>t.id===id));
  assert.ok(admin.body.tasks.some(t=>t.id===id));
  assert.equal(other.body.tasks.some(t=>t.id===id),false,'Sales B must never see Sales A');
  assert.equal(other.body.events.some(e=>e.task_id===id),false,'Timeline must be owner isolated');
  const forbidden=await h.call('sales/activities','GET','other',null,'?owner='+encodeURIComponent(users.sales));
  assert.equal(forbidden.status,403);
  assert.equal((await h.call('sales/activities','POST','viewer',payload)).status,403);
  assert.equal((await h.call('sales/activities','POST','sales',payload,'',{Origin:'https://untrusted.example'})).status,403);
  const map=await h.call('sales/activities','POST','admin',{action:'assign_manager',sales_email:users.sales,manager_email:users.admin});
  assert.equal(map.status,200,JSON.stringify(map));
  assert.equal(h.sql.prepare('SELECT manager_email FROM india_sales_team_managers WHERE sales_email=?').get(users.sales).manager_email,users.admin);
  assert.equal((await h.call('sales/activities','POST','sales',{action:'assign_manager',sales_email:users.sales,manager_email:users.admin})).status,403);
  assert.equal((await h.call('sales/activities','POST','admin',{action:'assign_manager',sales_email:users.sales,manager_email:users.sales})).status,422);
 }finally{h.close();}
});
test('actual API: completed outcome, idempotent read, stale CAS and immutable event',async()=>{
 const h=fixture();try{
  const created=await h.call('sales/activities','POST','sales',schedule());
  assert.equal(created.status,201,JSON.stringify(created));
  const id=created.body.id;
  assert.equal((await h.call('sales/activities','PATCH','other',{action:'complete',id,revision:1,outcome:'Called customer'})).status,403);
  assert.equal((await h.call('sales/activities','PATCH','sales',{action:'complete',id,revision:1,outcome:''})).status,422);
  const done=await h.call('sales/activities','PATCH','sales',{action:'complete',id,revision:1,outcome:'Called the customer and confirmed a meeting'});
  assert.equal(done.status,200,JSON.stringify(done));
  const stale=await h.call('sales/activities','PATCH','sales',{action:'cancel',id,revision:1,outcome:'Stale cancellation'});
  assert.equal(stale.status,409);
  const task=h.sql.prepare('SELECT * FROM india_sales_activity_tasks WHERE id=?').get(id);
  assert.equal(task.status,'completed');assert.equal(task.revision,2);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_activity_events WHERE task_id=?').get(id).n,2);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE action='ACTIVITY_COMPLETE'").get().n,1);
  assert.throws(()=>h.sql.prepare('DELETE FROM india_sales_activity_events WHERE task_id=?').run(id),/IMMUTABLE/);
 }finally{h.close();}
});
test('actual API: injected audit failure reverts activity reschedule and events',async()=>{
 const h=fixture();try{
  const created=await h.call('sales/activities','POST','sales',schedule());
  assert.equal(created.status,201,JSON.stringify(created));const id=created.body.id;
  const newDates=schedule();
  h.sql.exec("CREATE TRIGGER fail_activity_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'inject audit outage'); END");
  const x=await h.call('sales/activities','PATCH','sales',{action:'reschedule',id,revision:1,start_at:newDates.start_at,due_at:newDates.due_at});
  assert.equal(x.status,503,JSON.stringify(x));
  assert.equal(h.sql.prepare('SELECT revision FROM india_sales_activity_tasks WHERE id=?').get(id).revision,1);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_sales_activity_events WHERE task_id=?').get(id).n,1);
 }finally{h.close();}
});
