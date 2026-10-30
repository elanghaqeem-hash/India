const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,won,project,today,expect,tenant,users}=require('./helpers/service-operations-fixture.cjs');
async function setup(){
 const h=await won(fixture());const p=project(h),day=today(),month=day.slice(0,7);
 h.sql.prepare("UPDATE india_delivery_projects SET pm_email=?,start_date=?,end_date='2026-12-31',status='active',version=version+1 WHERE id=?").run(users.presales,day,p.id);
 h.sql.prepare('INSERT INTO india_resource_people(id,tenant_id,email,display_name,skills,capacity_pd_month,daily_cost_idr,created_by) VALUES(?,?,?,?,?,?,?,?)').run('person-timesheet',tenant,users.presales,'Synthetic PSA Consultant','VAPT',20,100000,users.admin);
 h.sql.prepare('INSERT INTO india_resource_allocations(id,tenant_id,opportunity_id,person_id,allocation_month,work_role,person_days,daily_cost_snapshot,created_by) VALUES(?,?,?,?,?,?,?,?,?)').run('allocation-timesheet',tenant,'opp-qa','person-timesheet',month,'Tester',1,100000,users.admin);
 return {h,p,day};
}
const submit=(h,project_id,day,role='presales',extra={})=>h.call('psa/timesheets','POST',role,{action:'submit',project_id,allocation_id:'allocation-timesheet',work_date:day,minutes:480,billable:true,description:'Authorized VAPT execution and customer reporting',...extra});
test('0033 migration is additive and has no fabricated hours',()=>{const h=fixture();try{assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(h.sql.prepare('SELECT count(*) n FROM india_project_timesheets').get().n,0);assert.equal(h.sql.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=33').get().n,1);}finally{h.close();}});
test('assigned consultant submits real persisted hours; finance reviews independently and history remains immutable',async()=>{const {h,p,day}=await setup();try{
 const created=await expect(submit(h,p.id,day),201);const id=created.body.id;
 assert.equal(h.sql.prepare('SELECT minutes FROM india_project_timesheets WHERE id=?').get(id).minutes,480);
 const own=await expect(h.call('psa/timesheets','GET','presales',null,'?project_id='+p.id),200);assert.equal(own.body.items.length,1);assert.equal(own.body.items[0].cost_snapshot_cents,0);
 h.sql.prepare('UPDATE india_resource_people SET daily_cost_idr=200000,version=version+1 WHERE id=?').run('person-timesheet');
 const finance=await expect(h.call('psa/timesheets','GET','finance',null,'?project_id='+p.id),200);assert.equal(finance.body.items[0].cost_snapshot_cents,10000000);
 await expect(h.call('psa/timesheets','POST','presales',{action:'review',id,version:1,approve:true,notes:'Independent review required'}),403);
 await expect(h.call('psa/timesheets','POST','finance',{action:'review',id,version:1,approve:true,notes:'Verified against approved delivery assignment'}),200);
 assert.equal(h.sql.prepare('SELECT status FROM india_project_timesheets WHERE id=?').get(id).status,'approved');
 assert.throws(()=>h.sql.prepare("UPDATE india_project_timesheets SET minutes=15 WHERE id=?").run(id),/IMMUTABLE/);
 await expect(h.call('psa/timesheets','POST','finance',{action:'review',id,version:1,approve:false,notes:'Stale review cannot override approval'}),409);
 assert.equal(h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE area='timesheet'").get().n,2);
}finally{h.close();}});
test('allocation, date, role and concurrency limits reject invalid submissions without audit writes',async()=>{const {h,p,day}=await setup();try{
 await expect(submit(h,p.id,day,'finance'),409);
 await expect(submit(h,p.id,'2027-01-10'),422);
 await expect(submit(h,p.id,day,'viewer'),403);
 await expect(submit(h,p.id,day,'presales',{minutes:481}),422);
 await expect(submit(h,p.id,day),201);
 await expect(submit(h,p.id,day),409);
 assert.equal(h.sql.prepare('SELECT count(*) n FROM india_project_timesheets').get().n,1);
 assert.equal(h.sql.prepare("SELECT count(*) n FROM india_operations_events WHERE area='timesheet'").get().n,1);
}finally{h.close();}});
test('injected audit failure rolls back timesheet submission and rejects forged origin',async()=>{const {h,p,day}=await setup();try{
 await expect(h.call('psa/timesheets','POST','presales',{action:'submit',project_id:p.id,allocation_id:'allocation-timesheet',work_date:day,minutes:30,billable:true,description:'Valid synthetic delivery notes'},'',{Origin:'https://attacker.invalid'}),403);
 h.sql.exec("CREATE TRIGGER fail_timesheet_audit BEFORE INSERT ON india_operations_events WHEN NEW.area='timesheet' BEGIN SELECT RAISE(ABORT,'injected failure'); END");
 await expect(submit(h,p.id,day),503);
 assert.equal(h.sql.prepare('SELECT count(*) n FROM india_project_timesheets').get().n,0);
}finally{h.close();}});
