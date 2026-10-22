const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const JSZip=require('jszip');
const src=fs.readFileSync(path.join(__dirname,'../src/lib/sales-loss-report.ts'),'utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const mod={exports:{}};
new Function('exports','module','require',compiled)(mod.exports,mod,require);
const {createLossReportDocx}=mod.exports;
const deal={id:'test-loss-01',company_id:'test-company',company_name:'TEST COMPANY',
 title:'VAPT Offline Lost',stage:'closed_lost',estimated_value:350000000,created_at:'2026-10-20',
 fields:{service_family:'VAPT',sales_owner:'Sales TEST',lost_reason:'Tidak menang tender',
 lost_notes:'Pelanggan menyatakan penawaran lain lebih sesuai dengan kebutuhan <scope> & jadwal.',
 competitor:'',customer_decision:'rejected',next_action:'Kaji penawaran alternatif'}};
const company={id:'test-company',legal_name:'PT Test & Co',customer_number:'TEST-ACC',fields:{},created_at:'2026-10-20'};
test('Closed Lost generates valid Word package, escaped details, unsigned review with real fields',async()=>{
 const bytes=await createLossReportDocx(deal,company,'2026-10-20T16:00:00Z');
 const zip=await JSZip.loadAsync(bytes);
 const doc=await zip.file('word/document.xml').async('string');
 assert.match(doc,/CLOSED LOST/);
 assert.match(doc,/PT Test &amp; Co/);
 assert.match(doc,/&lt;scope&gt; &amp; jadwal/);
 assert.match(doc,/350\.000\.000/);
 assert.match(doc,/BELUM DISETUJUI/);
 assert.match(doc,/Kaji penawaran alternatif/);
 assert.doesNotMatch(doc,/NPWP|KTP|nomor rekening/i);
});
test('Won, missing reason or narrative never produce an official loss report',async()=>{
 await assert.rejects(createLossReportDocx({...deal,stage:'closed_won'},company,''));
 await assert.rejects(createLossReportDocx({...deal,fields:{...deal.fields,lost_reason:''}},company,''));
 await assert.rejects(createLossReportDocx({...deal,fields:{...deal.fields,lost_notes:''}},company,''));
});
test('Loss export route authenticates and enforces owners/closed lost before generation',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/loss-report/route.ts'),'utf8');
 assert.match(route,/authorizeBoQ\(req\)/);
 assert.match(route,/canReadDeal\(role,email,raw\.created_by\)/);
 assert.match(route,/raw\.stage!=='closed_lost'/);
 assert.match(route,/LOST_REPORT_EXPORT/);
});
