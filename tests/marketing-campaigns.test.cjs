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
