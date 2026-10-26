const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Harness,users,expect}=require('./helpers/sales-flow-harness.cjs');

test('organization level rules allow only higher-level approved parents',()=>{
 const h=new Harness().seed();
 try{
  const {isValidOrganizationParentLevel,organizationLevelLabel}=h.load('src/lib/organization-hierarchy.ts');
  assert.equal(isValidOrganizationParentLevel('directorate','institution'),true);
  assert.equal(isValidOrganizationParentLevel('division','institution'),true);
  assert.equal(isValidOrganizationParentLevel('unit','directorate'),true);
  assert.equal(isValidOrganizationParentLevel('branch','division'),true);
  for(const [child,parent] of [['institution','directorate'],['directorate','directorate'],['directorate','division'],['division','unit'],['division','missing']])
   assert.equal(isValidOrganizationParentLevel(child,parent),false,child+' / '+parent);
  assert.equal(organizationLevelLabel('directorate'),'Direktorat');
  const component=fs.readFileSync('src/components/admin/SystemSettings.tsx','utf8');
  assert.match(component,/parents\.length===0/);
  assert.match(component,/Belum ada.*Institusi/);
  assert.match(component,/OrganizationSettingForm/);
 }finally{h.close();}
});

test('draft parents stay unavailable until independent approval; wrong level fails at review',async()=>{
 const h=new Harness().seed();
 try{
  h.sql.prepare('INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,?,1)').run(users.admin2,'admin');
  const create=(key,title,level,parent_key='')=>h.call('admin/system','POST','admin',{action:'setting',kind:'organization',setting_key:key,title,level,parent_key,version:0});
  const approve=id=>h.call('admin/system','POST','admin2',{action:'approve',id,notes:'Independent hierarchy approval checks'});
  const root=await expect(create('company','Real Institution','institution'),201);
  let list=await expect(h.call('admin/system','GET','admin'),200);
  assert.equal(list.body.settings.filter(x=>x.kind==='organization'&&x.status==='draft').length,1);
  assert.equal(list.body.effective.filter(x=>x.kind==='organization').length,0);
  const before=await expect(create('directorate_before','Directorate Pending','directorate','company'),201);
  await expect(approve(before.body.id),409);
  await expect(approve(root.body.id),200);
  list=await expect(h.call('admin/system','GET','admin'),200);
  assert.deepEqual(list.body.effective.filter(x=>x.kind==='organization').map(x=>x.setting_key),['company']);
  await expect(approve(before.body.id),200);
  const invalid=await expect(create('dir_invalid','Wrong Parent Directorate','directorate','directorate_before'),201);
  const refused=await expect(approve(invalid.body.id),409);
  assert.match(refused.body.message,/Tingkat parent/);
  const listAfter=await expect(h.call('admin/system','GET','admin'),200);
  assert.equal(listAfter.body.effective.some(x=>x.setting_key==='dir_invalid'),false);
  assert.equal(listAfter.body.effective.some(x=>x.setting_key==='directorate_before'),true);
 }finally{h.close();}
});
