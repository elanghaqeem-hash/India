// Browser UI -> actual route handlers -> isolated SQLite D1 adapter. Only Access identity is test supplied.
// This is NOT live Cloudflare Access UAT and never connects to a remote database.
const test=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const {Harness,expect}=require('./helpers/sales-flow-harness.cjs');
const base=process.env.INDIA_UAT_URL||'http://127.0.0.1:3100';
const screenshots=path.join(process.cwd(),'artifacts/browser-uat');fs.mkdirSync(screenshots,{recursive:true});
async function pageFor(browser,d,role,mobile=false){const page=await browser.newPage({viewport:mobile?{width:375,height:812}:{width:1280,height:900}});await page.route('**/api/**',async route=>{const req=route.request(),u=new URL(req.url()),apiPath=u.pathname.slice('/api/'.length);try{const result=await d.call(apiPath,req.method(),role,req.postData()?JSON.parse(req.postData()):undefined,u.search);await route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)});}catch(e){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,message:String(e)})});}});await page.goto(base+'/proposals?opportunity_id=opp-qa',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'QA Flow',exact:true}).waitFor();return page;}
const fillNotes=(p,notes)=>p.getByLabel('Catatan validasi / persetujuan / negosiasi').fill(notes);
async function fillProof(p,ref,sha){await p.getByLabel('Referensi arsip proposal / keputusan pelanggan').fill(ref);await p.getByLabel('SHA-256',{exact:true}).fill(sha);}
async function settle(page){await page.getByRole('status').filter({hasText:'Transaksi dan audit tersimpan.'}).waitFor();}
test('mobile and desktop browser actions use actual transactional Presales, Proposal, approval and Negotiation APIs',async()=>{const d=new Harness().seed(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});let page;
 try{
  page=await pageFor(browser,d,'presales',true);await fillNotes(page,'Presales reviewed the actual scope and deliverables');await page.getByRole('button',{name:'Validasi Scope Presales',exact:true}).click();await settle(page);assert.equal(d.release().status,'scoped');
  await page.screenshot({path:path.join(screenshots,'lifecycle-presales-mobile.png'),fullPage:true});await page.close();
  page=await pageFor(browser,d,'sales',true);await fillNotes(page,'Sales submits final proposal matching approved BoQ');await fillProof(page,'archive/proposal/browser-uat','a'.repeat(64));await page.getByRole('button',{name:'Ajukan Proposal Final',exact:true}).click();await settle(page);assert.equal(d.release().status,'proposed');await page.close();
  page=await pageFor(browser,d,'approver');await fillNotes(page,'Independent approver checks scope commercial terms and document');await page.getByRole('button',{name:'Setujui Proposal',exact:true}).click();await settle(page);assert.equal(d.release().status,'approved');await page.locator('.quotation-sheet').first().waitFor();assert.equal(await page.locator('.quotation-sheet').count(),3);await page.screenshot({path:path.join(screenshots,'lifecycle-approved-desktop.png'),fullPage:true});await page.close();
  for(const s of ['solution_design','commercial_review','quotation_sent'])await expect(d.stage(s),200);
  const proof=await expect(d.call('sales/submission','POST','sales',{opportunity_id:'opp-qa',channel:'email',recipient_email:'pic@flow.invalid',sent_at:new Date().toISOString(),evidence_reference:'archive/mail/browser-uat',evidence_sha256:'b'.repeat(64)}),201);
  await expect(d.call('sales/submission','PATCH','finance',{submission_id:proof.body.id,action:'verified',review_notes:'Original email evidence independently checked'}),200);await expect(d.stage('negotiation'),200);
  page=await pageFor(browser,d,'sales',true);await fillNotes(page,'Customer accepted the exact scope terms and quotation value');await fillProof(page,'archive/customer/browser-uat','c'.repeat(64));await page.getByRole('combobox',{name:/^Keputusan/}).selectOption('approved');await page.getByLabel('Nilai sebelum PPN (IDR)',{exact:true}).fill('1000000');await page.getByRole('button',{name:'Catat Keputusan & Bukti Pelanggan',exact:true}).click();await settle(page);assert.equal(d.sql.prepare('SELECT decision FROM india_sales_negotiations').get().decision,'approved');
  assert.ok((await page.getByRole('link',{name:'Quotation Submission →',exact:true}).getAttribute('href')).includes('opportunity_id=opp-qa'));
  assert.ok((await page.getByRole('link',{name:'PO & Finance–Legal Review →',exact:true}).getAttribute('href')).includes('opportunity_id=opp-qa'));
  const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dims.scroll<=dims.width+2,JSON.stringify(dims));
  assert.equal(await page.locator('.quotation-sheet').count(),3);await page.screenshot({path:path.join(screenshots,'lifecycle-negotiation-mobile.png'),fullPage:true});
  await expect(d.stage('pending_po'),200);assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(page&&!page.isClosed())await page.close();await browser.close();d.close();}
});
