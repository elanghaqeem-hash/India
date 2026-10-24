// Browser UI -> actual route handlers -> isolated SQLite D1 adapter. Only Access identity is test supplied.
// This is NOT live Cloudflare Access UAT and never connects to a remote database.
const test=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const {Harness,expect}=require('./helpers/sales-flow-harness.cjs');
const base=process.env.INDIA_UAT_URL||'http://127.0.0.1:3100';
const screenshots=path.join(process.cwd(),'artifacts/browser-uat');fs.mkdirSync(screenshots,{recursive:true});
async function pageFor(browser,d,role,mobile=false,pathname='/proposals'){const page=await browser.newPage({viewport:mobile?{width:375,height:812}:{width:1280,height:900}});page.setDefaultTimeout(15000);await page.route('**/api/**',async route=>{const req=route.request(),u=new URL(req.url()),apiPath=u.pathname.slice('/api/'.length);try{
 if(apiPath==='sales/vault'){
  const handler=d.load('src/app/api/sales/vault/route.ts');const r=await handler[req.method()](new Request('https://flow.invalid/api/'+apiPath+u.search,{method:req.method(),headers:{Origin:'https://flow.invalid','x-test-role':role},...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})}));
  await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});return;
 }
 const result=await d.call(apiPath,req.method(),role,req.postData()?JSON.parse(req.postData()):undefined,u.search);await route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)});
 }catch(e){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,message:String(e)})});}});await page.goto(base+pathname+'?opportunity_id=opp-qa',{waitUntil:'networkidle'});if(pathname==='/proposals')await page.getByRole('heading',{name:'QA Flow',exact:true}).waitFor();else await page.getByRole('heading',{level:1}).waitFor();return page;}
const fillNotes=(p,notes)=>p.getByLabel('Catatan validasi / persetujuan / negosiasi').fill(notes);
async function fillProof(p,ref,sha){await p.getByLabel('Upload dokumen asli ke Document Vault').setInputFiles({name:'browser-evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic browser original '+ref)});await p.getByRole('status').filter({hasText:'Dokumen asli tersimpan.'}).waitFor();assert.match(await p.getByLabel('SHA-256',{exact:true}).inputValue(),/^[a-f0-9]{64}$/);}
async function settle(page){await page.getByRole('status').filter({hasText:'Transaksi dan audit tersimpan.'}).waitFor();}
test('mobile and desktop browser uploads connect proposal, submission, independent reviews and original PO to Won',async()=>{const d=new Harness().seed(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});let page;
 try{
  page=await pageFor(browser,d,'presales',true);await fillNotes(page,'Presales reviewed the actual scope and deliverables');await page.getByRole('button',{name:'Validasi Scope Presales',exact:true}).click();await settle(page);assert.equal(d.release().status,'scoped');
  await page.screenshot({path:path.join(screenshots,'lifecycle-presales-mobile.png'),fullPage:true});await page.close();
  page=await pageFor(browser,d,'sales',true);await fillNotes(page,'Sales submits final proposal matching approved BoQ');await fillProof(page,'archive/proposal/browser-uat','a'.repeat(64));await page.getByRole('button',{name:'Ajukan Proposal Final',exact:true}).click();await settle(page);assert.equal(d.release().status,'proposed');await page.close();
  page=await pageFor(browser,d,'approver');await fillNotes(page,'Independent approver checks scope commercial terms and document');await page.getByRole('button',{name:'Setujui Proposal',exact:true}).click();await settle(page);assert.equal(d.release().status,'approved');await page.locator('.quotation-sheet').first().waitFor();assert.equal(await page.locator('.quotation-sheet').count(),3);await page.screenshot({path:path.join(screenshots,'lifecycle-approved-desktop.png'),fullPage:true});await page.close();
  for(const s of ['solution_design','commercial_review','quotation_sent'])await expect(d.stage(s),200);
  page=await pageFor(browser,d,'sales',true,'/sales/submission');await page.getByLabel('Email penerima resmi').fill('pic@flow.invalid');await page.getByLabel('Waktu pengiriman').fill(await page.evaluate(()=>{const d=new Date(Date.now()+1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,19).replace(/:00$/,'');}));
  await page.getByLabel('Upload dokumen asli ke Document Vault').setInputFiles({name:'receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic browser submission receipt')});await page.getByRole('status').filter({hasText:'Dokumen asli tersimpan.'}).waitFor();
  page.once('dialog',x=>x.accept());await page.getByRole('button',{name:'Catat Submission (Reported)',exact:true}).click();await page.getByRole('status').filter({hasText:'Pengiriman tercatat'}).waitFor();await page.close();
  page=await pageFor(browser,d,'finance',true,'/sales/submission');await page.getByPlaceholder('Catatan verifikasi bukti asli minimal 15 karakter').fill('Original email evidence independently checked');page.once('dialog',x=>x.accept());await page.getByRole('button',{name:'Verified',exact:true}).click();await page.getByRole('status').filter({hasText:'Hasil pemeriksaan bukti'}).waitFor();await page.close();await expect(d.stage('negotiation'),200);
  page=await pageFor(browser,d,'sales',true);await fillNotes(page,'Customer accepted the exact scope terms and quotation value');await fillProof(page,'archive/customer/browser-uat','c'.repeat(64));await page.getByRole('combobox',{name:/^Keputusan/}).selectOption('approved');await page.getByLabel('Nilai sebelum PPN (IDR)',{exact:true}).fill('1000000');await page.getByRole('button',{name:'Catat Keputusan & Bukti Pelanggan',exact:true}).click();await settle(page);assert.equal(d.sql.prepare('SELECT decision FROM india_sales_negotiations').get().decision,'approved');
  assert.ok((await page.getByRole('link',{name:'Quotation Submission →',exact:true}).getAttribute('href')).includes('opportunity_id=opp-qa'));
  assert.ok((await page.getByRole('link',{name:'PO & Finance–Legal Review →',exact:true}).getAttribute('href')).includes('opportunity_id=opp-qa'));
  const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dims.scroll<=dims.width+2,JSON.stringify(dims));
  assert.equal(await page.locator('.quotation-sheet').count(),3);await page.screenshot({path:path.join(screenshots,'lifecycle-negotiation-mobile.png'),fullPage:true});
  await expect(d.stage('pending_po'),200);await page.close();
  page=await pageFor(browser,d,'sales',true,'/sales/award');await page.getByLabel('Upload dokumen asli ke Document Vault').setInputFiles({name:'original-po.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic original PO for the browser UAT')});await page.getByRole('status').filter({hasText:'Dokumen asli tersimpan.'}).waitFor();await page.getByRole('button',{name:'Register Dokumen (Pending Review)',exact:true}).click();await page.getByRole('status').filter({hasText:'Metadata dokumen dicatat'}).waitFor();await page.close();
  for(const role of ['finance','legal']){
   page=await pageFor(browser,d,role,true,'/sales/award');
   const download=page.waitForEvent('download');await page.getByRole('link',{name:'Unduh dokumen asli',exact:true}).click();assert.equal((await download).suggestedFilename(),'original-po.pdf');
   await page.getByLabel('Catatan pemeriksaan asli').fill('Original PO scope and amount independently checked by '+role);page.once('dialog',x=>x.accept());await page.getByRole('button',{name:'Verifikasi sebagai '+(role==='legal'?'Legal':'Finance'),exact:true}).click();await page.getByRole('status').filter({hasText:'Hasil review '+role}).waitFor();
   const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dims.scroll<=dims.width+2,JSON.stringify(dims));await page.close();
  }
  await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);await expect(d.stage('closed_won'),200);assert.equal(d.deal().stage,'closed_won');assert.equal(d.sql.prepare('SELECT count(*) n FROM india_document_vault').get().n,4);assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(page&&!page.isClosed())await page.close();await browser.close();d.close();}
});
