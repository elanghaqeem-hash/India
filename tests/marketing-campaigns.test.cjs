const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const root=path.join(__dirname,'../');
const sql=n=>fs.readFileSync(path.join(root,'migrations',n),'utf8');
const domain=(name)=>{
 const src=fs.readFileSync(path.join(root,'src/lib',name+'.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',js)(s=>{
  if(s==='./sales-workflow')return domain('sales-workflow');
  throw Error('Unexpected import '+s);
 },mod,mod.exports);
 return mod.exports;
};
const campaign=domain('marketing-campaign');
const valid={
 code:'FSI_Q4_2026',name:'Cyber FSI Webinar',channel:'webinar',status:'planned',
 owner_email:'marketing@example.test',budget_idr:15000000,start_date:'2026-10-22',
 end_date:'2026-11-30',notes:'Lead generation for SOC and VAPT'
};
test('Campaign domain checks real owner, status, budget, dates, and role permissions',()=>{
 assert.deepEqual(campaign.validateCampaign(valid),valid);
 for(const bad of [
  {...valid,code:'$!'}, {...valid,name:''},{...valid,channel:'not-allowed'},
  {...valid,owner_email:'not-email'},{...valid,budget_idr:-1},
  {...valid,start_date:'2026-12-01',end_date:'2026-11-01'}
 ])assert.throws(()=>campaign.validateCampaign(bad));
 assert.equal(campaign.canEditCampaign('marketing'),true);
 assert.equal(campaign.canEditCampaign('admin'),true);
 assert.equal(campaign.canEditCampaign('sales'),false);
 assert.equal(campaign.canEditCampaign('viewer'),false);
 assert.equal(campaign.canSelectCampaign('active'),true);
 assert.equal(campaign.canSelectCampaign('paused'),false);
 assert.equal(campaign.campaignProgress({total:4,qualified:2,converted:1}).conversionRate,25);
 assert.equal(campaign.campaignProgress({total:0,qualified:0,converted:0}).conversionRate,0);
});
test('Campaign codes auto-generate securely, validate, and remain unique across new forms',()=>{
 const codes=Array.from({length:128},()=>campaign.generateCampaignCode());
 assert.equal(new Set(codes).size,codes.length);
 for(const code of codes){
  assert.match(code,/^CMP-[0-9]{8}-[A-F0-9]{12}$/);
  assert.equal(campaign.isAutoCampaignCode(code),true);
  assert.equal(campaign.validateCampaign({...valid,code}).code,code);
 }
 assert.equal(campaign.isAutoCampaignCode('FSI_Q4_2026'),false);
});
test('Campaign creation auto-generates missing code on server with collision handling and locks code on edit',()=>{
 const api=fs.readFileSync(path.join(root,'src/app/api/marketing/campaigns/route.ts'),'utf8');
 const page=fs.readFileSync(path.join(root,'src/app/sales/campaigns/page.tsx'),'utf8');
 assert.match(api,/typeof incoming\.code==='string'&&incoming\.code\.trim\(\)\?incoming\.code:generateCampaignCode\(\)/);
 assert.match(api,/isAutoCampaignCode\(v\.code\)/);
 assert.match(api,/UNIQUE constraint failed/);
 assert.match(api,/attempt<4/);
 assert.match(api,/body\.code\.trim\(\)\.toUpperCase\(\)!==current\.code/);
 assert.match(page,/code:generateCampaignCode\(\)/);
 assert.match(page,/Kode unik \(otomatis\)/);
 assert.match(page,/readOnly=\{key==='code'\}/);
 assert.doesNotMatch(page,/Kode unik \*/);
});
test('Campaign migration adds validated master and Lead attribution FK without fake rows',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
 db.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT)");
 for(const name of ['0004_india_sales_isolation.sql','0005_marketing_lead_flow.sql','0009_lead_request_idempotency.sql','0010_marketing_campaigns.sql'])
  db.exec(sql(name));
 const add=db.prepare('INSERT INTO india_marketing_campaigns(id,tenant_id,code,name,channel,status,owner_email,budget_idr,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
 add.run('camp-1','defendit360','FSI_Q4_2026','Cyber FSI Webinar','webinar','active','marketing@example.test',15000000,'marketing@example.test','marketing@example.test');
 assert.throws(()=>add.run('camp-2','defendit360','FSI_Q4_2026','Duplicate','webinar','active','marketing@example.test',10000,'marketing@example.test','marketing@example.test'),/UNIQUE/);
 assert.throws(()=>add.run('camp-3','defendit360','OTHER','Invalid','fake_channel','active','marketing@example.test',10000,'marketing@example.test','marketing@example.test'),/CHECK/);
 assert.throws(()=>add.run('camp-4','defendit360','CAMP-4','Invalid','webinar','active','marketing@example.test',-1,'marketing@example.test','marketing@example.test'),/CHECK/);
 const insertLead=db.prepare("INSERT INTO india_marketing_leads(id,tenant_id,lead_number,account_name,source,campaign,campaign_id,service_family,assigned_sales_email,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
 insertLead.run('lead-1','defendit360','LD-1','PT UAT Cyber','Webinar','Cyber FSI Webinar','camp-1','VAPT','sales@example.test','marketing@example.test','marketing@example.test');
 assert.throws(()=>insertLead.run('lead-2','defendit360','LD-2','PT Other','Webinar','Other','camp-missing','VAPT','sales@example.test','marketing@example.test','marketing@example.test'),/FOREIGN KEY/);
 db.exec("UPDATE india_marketing_leads SET status='converted' WHERE id='lead-1'");
 assert.equal(db.prepare("SELECT COUNT(*) AS leads,SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted FROM india_marketing_leads WHERE campaign_id='camp-1'").get().converted,1);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM india_marketing_campaigns').get().n,1);
 db.close();
});
test('Authenticated Marketing Campaign API and Lead link use D1; no demo or stored fake totals',()=>{
 const api=fs.readFileSync(path.join(root,'src/app/api/marketing/campaigns/route.ts'),'utf8');
 const leads=fs.readFileSync(path.join(root,'src/app/api/marketing/leads/route.ts'),'utf8');
 const mid=fs.readFileSync(path.join(root,'src/middleware.ts'),'utf8');
 for(const expected of ["authorizeBoQ(req)","canEditCampaign(role)","revision=revision+1","updated_at=CURRENT_TIMESTAMP","COUNT(l.id) AS total_leads","l.assigned_sales_email=?","india_marketing_campaigns"])
  assert.ok(api.includes(expected),expected);
 for(const expected of ["campaign_id","india_marketing_campaigns","selected.status!=='active'","v.campaign=selected.name"])
  assert.ok(leads.includes(expected),expected);
 assert.ok(mid.includes("'/api/marketing/campaigns'"));
});
test('Campaign and Lead UI have navigation, database-backed options and responsive layouts',()=>{
 const page=fs.readFileSync(path.join(root,'src/app/sales/campaigns/page.tsx'),'utf8');
 const leads=fs.readFileSync(path.join(root,'src/app/sales/leads/page.tsx'),'utf8');
 assert.match(page,/\/api\/marketing\/campaigns/);
 assert.match(page,/conversionRate/);
 assert.match(page,/request\('PATCH'/);
 assert.match(leads,/campaign_id:id/);
 assert.match(leads,/Campaign terdaftar/);
 const sidebar=fs.readFileSync(path.join(root,'src/components/layout/Sidebar.tsx'),'utf8');
 const navigation=fs.readFileSync(path.join(root,'src/lib/enterprise-navigation.ts'),'utf8');
 assert.match(sidebar,/navigationForRole/);
 assert.match(navigation,/\/sales\/campaigns/);
});

test('Campaign form selects only active server-provided owners and surfaces a failed save without discarding draft',()=>{
 const api=fs.readFileSync(path.join(root,'src/app/api/marketing/campaigns/route.ts'),'utf8');
 const page=fs.readFileSync(path.join(root,'src/app/sales/campaigns/page.tsx'),'utf8');
 assert.match(api,/SELECT email,role FROM india_members WHERE active=1 AND role IN/);
 assert.match(api,/const owners=canEditCampaign\(role\)/);
 assert.match(api,/Owner tidak terdaftar atau tidak aktif/);
 assert.match(page,/owners\.map\(x=><option/);
 assert.match(page,/selectedOwner=owners\.find/);
 assert.match(page,/!ownerValid/);
 assert.match(page,/setError\(e instanceof Error\?e\.message:String\(e\)\)/);
 assert.match(page,/role="alert"/);
 assert.doesNotMatch(page,/\['owner_email','Owner email aktif \*'/);
});

test('Campaign registration API persists valid active Owner, rejects unknown Owner and hides directory from Sales',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY)');
 db.exec("CREATE TABLE india_members(email TEXT PRIMARY KEY COLLATE NOCASE,role TEXT CHECK(role IN ('admin','finance','presales','sales','approver','viewer')),active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,created_by TEXT)");
 for(const name of ['0004_india_sales_isolation.sql','0005_marketing_lead_flow.sql','0009_lead_request_idempotency.sql','0010_marketing_campaigns.sql'])
  db.exec(sql(name));
 db.exec("CREATE TABLE india_sales_audit(id TEXT PRIMARY KEY,tenant_id TEXT,entity_type TEXT,entity_id TEXT,action TEXT,actor_email TEXT,summary TEXT)");
 const members=[
  ['uat.admin@example.test','admin',1],['uat.marketing@example.test','marketing',1],
  ['uat.sales@example.test','sales',1],['uat.inactive@example.test','marketing',0]
 ];
 for(const member of members)db.prepare('INSERT INTO india_members(email,role,active) VALUES(?,?,?)').run(...member);
 const d1={
  prepare(q){return {_q:q,_args:[],
   bind(...a){this._args=a;return this;},
   async all(){return {results:db.prepare(this._q).all(...this._args),success:true};},
   async first(){return db.prepare(this._q).get(...this._args)||null;},
   async run(){const r=db.prepare(this._q).run(...this._args);return {success:true,meta:{changes:r.changes}};}
  };},
  async batch(items){
   db.exec('BEGIN IMMEDIATE');
   try{
    const results=items.map(x=>({success:true,meta:{changes:db.prepare(x._q).run(...x._args).changes}}));
    db.exec('COMMIT');return results;
   }catch(e){db.exec('ROLLBACK');throw e;}
  }
 };
 const mod={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(path.join(root,'src/app/api/marketing/campaigns/route.ts'),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}
 }).outputText;
 new Function('require','module','exports',js)(p=>{
  if(p==='@/lib/boq-auth')return {
   privateHeaders:{'Cache-Control':'no-store'},
   authorizeBoQ:async req=>{
    const email=req.headers.get('x-uat-email');
    const member=db.prepare('SELECT role,active FROM india_members WHERE email=?').get(email);
    return member?.active===1?{ok:true,identity:{db,email,role:member.role}}:
     {ok:false,response:Response.json({success:false,message:'Access denied'},{status:403})};
   }
  };
  if(p==='@/lib/sales-workflow')return domain('sales-workflow');
  if(p==='@/lib/marketing-campaign')return campaign;
  throw Error('Unexpected campaign route import '+p);
 },mod,mod.exports);
 const call=async(method,email,payload)=>{
  const req=new Request('https://india-uat.example.test/api/marketing/campaigns',{
   method,headers:{origin:'https://india-uat.example.test','x-uat-email':email,'Content-Type':'application/json'},
   ...(payload?{body:JSON.stringify(payload)}:{})
  });
  const res=await mod.exports[method](req);
  return {status:res.status,body:await res.json()};
 };
 try{
  const admin='uat.admin@example.test';
  const list=await call('GET',admin);
  assert.equal(list.status,200);
  assert.equal(list.body.role,'admin');
  assert.equal(list.body.owners.length,3);
  assert.equal(list.body.owners.some(x=>x.email==='uat.inactive@example.test'),false);
  const sales=await call('GET','uat.sales@example.test');
  assert.equal(sales.status,200);
  assert.deepEqual(sales.body.owners,[]);
  const unauthorized=await call('POST','uat.sales@example.test',{...valid,owner_email:'uat.sales@example.test'});
  assert.equal(unauthorized.status,403);
  const missing=await call('POST',admin,{...valid,owner_email:'maria.hayu@defendit360.co.id'});
  assert.equal(missing.status,422);
  assert.match(missing.body.message,/Owner tidak terdaftar/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM india_marketing_campaigns').get().n,0);
  const created=await call('POST',admin,{...valid,code:'',owner_email:'uat.marketing@example.test'});
  assert.equal(created.status,201,JSON.stringify(created.body));
  assert.match(created.body.code,/^CMP-/);
  assert.equal(db.prepare('SELECT owner_email FROM india_marketing_campaigns WHERE id=?').get(created.body.id).owner_email,'uat.marketing@example.test');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM india_sales_audit WHERE entity_type='campaign' AND action='CREATE'").get().n,1);
 }finally{db.close();}
});
