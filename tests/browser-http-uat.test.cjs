// Browser/HTTP UAT on a localhost production build. Browser identities are API response
// fixtures, NOT actual Cloudflare Access sessions or a replacement for live multirole UAT.
const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const artifactDir=path.join(process.cwd(),'artifacts','browser-uat');
fs.mkdirSync(artifactDir,{recursive:true});
const base=process.env.INDIA_UAT_URL||'http://127.0.0.1:3100';
const salesAccount={id:'uat-customer-a',legal_name:'PT DATA UAT NONPRODUKSI',
  customer_number:'IND-UAT-001',fields:{},created_at:'2026-10-21',created_by:'sales.a@uat.invalid'};
const roles=[
  {name:'admin',canCreate:true},
  {name:'sales',canCreate:true},
  {name:'presales',canCreate:false},
  {name:'finance',canCreate:false},
  {name:'approver',canCreate:false},
  {name:'legal',canCreate:false},
];
test('HTTP gate: unauthenticated CRM, BoQ and AI endpoints fail closed in localhost Worker-less runtime',async()=>{
 for(const endpoint of ['/api/sales?entity=accounts','/api/boq','/api/ai/assist']){
  const response=await fetch(base+endpoint,{headers:{Accept:'application/json'}});
  assert.ok([401,403,503].includes(response.status),endpoint+' unexpectedly returned '+response.status);
  const body=await response.json();
  assert.equal(body.success,false,endpoint+' leaked successful data without Access JWT');
 }
});
test('Browser fixtures: six role-specific Sales interfaces enforce create-button gating on desktop and mobile',async(t)=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const role of roles){
   await t.test('role='+role.name,async()=>{
    const page=await browser.newPage({viewport:role.name==='sales'?{width:375,height:812}:{width:1280,height:820}});
    try{
     let mockedResponses=0;
     await page.route('**/api/sales?**',async route=>{
       const u=new URL(route.request().url());
       const entity=u.searchParams.get('entity');
       mockedResponses++;
       const data=entity==='accounts'
         ? {success:true,accounts:[salesAccount],role:role.name}
         : {success:true,deals:[],role:role.name};
       await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
     });
     const received=page.waitForResponse(r=>r.url().includes('/api/sales?entity=deals')&&r.status()===200);
     const response=await page.goto(base+'/sales/pipeline',{waitUntil:'domcontentloaded'});
     assert.equal(response?.status(),200,'Sales page does not render');
     await received;
     await page.getByRole('heading',{name:'Sales Pipeline & Opportunity 360'}).waitFor();
     const customer=page.getByRole('button',{name:'+ Customer',exact:true});
     const opportunity=page.getByRole('button',{name:'+ Opportunity',exact:true});
     await page.waitForFunction((allow)=>(
       [...document.querySelectorAll('button')].filter(b=>b.textContent?.trim()==='+ Customer')
         .every(b=>b.disabled!==allow)
     ),role.canCreate);
     assert.equal(await customer.isEnabled(),role.canCreate,'Wrong create-customer privilege for '+role.name);
     assert.equal(await opportunity.isEnabled(),role.canCreate,'Wrong create-opportunity privilege for '+role.name);
     assert.ok(mockedResponses>=2,'UI did not request role-scoped API data');
     await page.screenshot({path:path.join(artifactDir,'fixture-'+role.name+'.png'),fullPage:true});
     if(role.canCreate){
       await opportunity.click();
       await page.getByText('Pelanggan Terdaftar *',{exact:false}).waitFor();
     }
     if(role.name==='sales'){
       const dimensions=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:window.innerWidth}));
       assert.ok(dimensions.scrollWidth<=dimensions.width+2,
         'Mobile pipeline overflows horizontally: '+JSON.stringify(dimensions));
     }
    }finally{await page.close();}
   });
  }
 }finally{await browser.close();}
});
test('Browser unauthenticated account access never enables create actions',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
   const received=page.waitForResponse(r=>r.url().includes('/api/sales?entity=deals'));
   const response=await page.goto(base+'/sales/pipeline',{waitUntil:'domcontentloaded'});
   assert.equal(response?.status(),200);
   await received;
   const customer=page.getByRole('button',{name:'+ Customer',exact:true});
   assert.equal(await customer.isEnabled(),false);
   assert.equal(await page.getByRole('button',{name:'+ Opportunity',exact:true}).isEnabled(),false);
   const status=page.locator('div[role="status"].whitespace-pre-wrap');
   await status.waitFor();
   assert.match(await status.innerText(),/D1 runtime|Database|login|Access|autentikasi/i);
   await page.screenshot({path:path.join(artifactDir,'no-cloudflare-jwt.png'),fullPage:true});
  }finally{await page.close();}
 }finally{await browser.close();}
});
