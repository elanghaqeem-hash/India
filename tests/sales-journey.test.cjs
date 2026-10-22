const test=require('node:test'),assert=require('node:assert/strict');
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'../src/lib'),cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const src=fs.readFileSync(path.join(base,name+'.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};cache.set(name,m.exports);
 new Function('require','module','exports',js)((name)=>{
  if(name==='./sales-workflow')return load('sales-workflow');
  if(name==='./sales-procurement')return load('sales-procurement');
  throw Error('Unexpected dependency '+name);
 },m,m.exports);cache.set(name,m.exports);return m.exports;
}
const {salesJourney}=load('sales-journey');
const account={id:'customer',customer_number:'IND-TEST',legal_name:'PT Test',fields:{},created_at:'2026-10-21'};
const deal={id:'deal',company_id:'customer',company_name:'PT Test',title:'VAPT',
 stage:'closed_won',estimated_value:120000000,fields:{boq_id:'boq'},created_at:'2026-10-21'};
test('Journey cockpit never claims operational approval without original PO, signed contract, submission evidence',()=>{
 const list=salesJourney(account,deal,{lead_number:'LD-TEST',boq_linked:true,
  boq_status:'approved',quotation_record:true,po_check:true,submission_proof:false});
 const map=Object.fromEntries(list.map(x=>[x.key,x]));
 assert.equal(map.lead.state,'complete');
 assert.equal(map.commercial.state,'complete');
 assert.equal(map.submission.state,'blocked');
 assert.equal(map.po.state,'manual_review');
 assert.equal(map.won.state,'manual_review');
 assert.match(map.po.missing.join(' '),/PO asli/);
 assert.match(map.po.missing.join(' '),/Legal/);
});
test('Unlinked direct Sales records disclose provenance warning instead of fabricated Lead number',()=>{
 const map=Object.fromEntries(salesJourney(account,{...deal,stage:'prospecting'},
  {boq_linked:false,boq_status:'draft',po_check:false}).map(x=>[x.key,x]));
 assert.equal(map.lead.state,'manual_review');
 assert.equal(map.customer.state,'blocked');
 assert.equal(map.commercial.state,'blocked');
 assert.equal(map.won.state,'pending');
});
test('server+frontend expose the same calculated journey and source Lead reference',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../src/app/sales/pipeline/page.tsx'),'utf8');
 assert.match(api,/salesJourney\(account\(acct\),d/);
 assert.match(api,/documents:documents.results,submissions:submissions.results,awardDocuments:awardDocs.results,journey/);
 assert.match(ui,/Journey 360/);
 assert.match(ui,/detail\.originLead/);
});
