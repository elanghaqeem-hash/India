// Route-level negative UAT: mocked Access identity + isolated in-memory D1; no production IO.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const lib=path.join(__dirname,'../src/lib');
function domain(name){return require(path.join(lib,name+'.ts'));}
const sales=domain('sales-workflow'),access=domain('sales-access'),aiPolicy=domain('ai-data-policy');
const boq={boqTotals:()=>({subtotal:1000000})};
const origin='https://india-uat.invalid';
const fakeAuth=(role,email,db)=>({
 authorizeBoQ:async()=>({ok:true,identity:{role,email,db}}),
 privateHeaders:{'Cache-Control':'private, no-store'}
});
const accountA={id:'acc-A',tenant_id:'defendit360',legal_name:'TEST Company A',customer_number:'TEST-A',data_json:'{}',created_at:'',created_by:'sales.a@uat.invalid'};
const accountB={...accountA,id:'acc-B',legal_name:'TEST Company B',created_by:'sales.b@uat.invalid'};
const dealA={id:'deal-A',tenant_id:'defendit360',company_id:'acc-A',title:'TEST Opportunity',stage:'prospecting',
 estimated_value_idr:1000000,data_json:'{}',created_at:'',created_by:'sales.a@uat.invalid'};
function mockDb({accounts=[accountA,accountB],opportunity=dealA}={}){
 const calls=[];
 return {calls,prepare(sql){
  calls.push(sql);
  const prepared={
   bind(...args){return {...prepared,args};},
   async first(){
    if(sql.includes('FROM india_sales_opportunities'))return opportunity;
    if(sql.includes('FROM india_sales_accounts'))return accounts.find(x=>x.id===(this.args||[])[0])||null;
    return null;
   },
   async all(){if(sql.includes('FROM india_sales_accounts'))return {success:true,results:accounts};return {success:true,results:[]};},
   async run(){throw Error('Unexpected database write during negative-path test');}
  };return prepared;
 }};
}
function route(file,role,email,db,additional={}){
 const p=path.join(__dirname,'../src/app/api/',file,'route.ts');
 const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mocks={
  'next/server':{NextResponse:{json:(data,opt={})=>Response.json(data,opt)}},
  '@/lib/boq-auth':fakeAuth(role,email,db),
  '@/lib/boq-domain':boq,
  '@/lib/sales-access':access,
  '@/lib/sales-workflow':sales,
  '@/lib/sales-transactions':domain('sales-transactions'),
  // Stubs are limited to collaborators not reached by these deny-before-side-effect tests.
  '@/lib/sales-journey':{salesJourney:()=>[]},
  '@/lib/sales-procurement':{needsTenderGate:()=>false,procurementGate:()=>[]},
  '@/lib/tender-readiness':{
   tenderReady:async()=>{throw Error('Unauthorized tender readiness lookup reached');},
   guardTender:()=>{throw Error('Unauthorized tender export guard reached');}
  },
  '@/lib/sales-submission':{submissionMatches:()=>false},
  '@/lib/sales-award':{validAwardForWon:()=>false},
  '@/lib/quotation-docx':{createQuotationDocx:()=>{throw Error('Unauthorized Word export reached');}},
  '@/lib/ai-data-policy':aiPolicy,
  '@/lib/ai-credential-vault':{
   listProviders:async()=>[],readProvider:async()=>null,
   decryptProviderKey:async()=>{throw Error('No provider expected');},
   invokeAI:async()=>{throw Error('No outbound provider expected');},
   runPriorityChain:async()=>{throw Error('No outbound provider expected');}
  },
  '@/lib/ai-provider-registry':{isProviderId:x=>x==='openai'},
  ...additional
 };
 const mod={exports:{}};
 new Function('require','module','exports',js)(specifier=>{
  if(!(specifier in mocks))throw Error('Unmocked module '+specifier);
  return mocks[specifier];
 },mod,mod.exports);
 return mod.exports;
}
test('R01 Sales B quotation export is denied before account lookup and DOCX construction',async()=>{
 const db=mockDb();
 const api=route('sales/quotation','sales','sales.b@uat.invalid',db);
 const r=await api.GET(new Request(origin+'/api/sales/quotation?opportunity_id=deal-A'));
 assert.equal(r.status,403);assert.match((await r.json()).message,/Sales/);
 assert.equal(db.calls.some(x=>x.includes('FROM india_sales_accounts')),false);
});
test('R02 Sales B account directory does not reveal Sales A identity or PIC',async()=>{
 const db=mockDb();
 const api=route('sales','sales','sales.b@uat.invalid',db);
 const r=await api.GET(new Request(origin+'/api/sales?entity=accounts'));
 const response=await r.json();
 assert.equal(r.status,200);
 assert.deepEqual(response.accounts.map(x=>x.id),['acc-B']);
});
test('R03 Sales B cannot create a deal against Customer Account owned by Sales A',async()=>{
 const db=mockDb();
 const api=route('sales','sales','sales.b@uat.invalid',db);
 const r=await api.POST(new Request(origin+'/api/sales',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({entity:'deal',company_id:'acc-A',title:'Malicious Sales B',estimated_value:1000000,fields:{}})
 }));
 assert.equal(r.status,403);assert.equal(db.calls.some(x=>x.startsWith('INSERT')),false);
});
test('R04 Sales Maker with Admin privileges cannot verify own PO',async()=>{
 const db=mockDb();
 const api=route('sales','admin','sales.a@uat.invalid',db);
 const r=await api.POST(new Request(origin+'/api/sales',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({entity:'verify_po',id:'deal-A',confirmed_documents:true})
 }));
 assert.equal(r.status,403);assert.match((await r.json()).message,/Segregation of Duties/);
});
test('R05 even a Sales owner cannot jump directly to Closed Won',async()=>{
 const db=mockDb();
 const api=route('sales','sales','sales.a@uat.invalid',db);
 const r=await api.PATCH(new Request(origin+'/api/sales',{method:'PATCH',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({entity:'transition',id:'deal-A',stage:'closed_won'})
 }));
 assert.equal(r.status,409);assert.match((await r.json()).message,/Pending PO/);
});
test('R06 formatted NPWP is rejected from outbound AI before any provider call',async()=>{
 const db=mockDb();
 const api=route('ai/assist','sales','sales.a@uat.invalid',db);
 const r=await api.POST(new Request(origin+'/api/ai/assist',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({purpose:'scoping',provider:'auto',confirmed:true,
   prompt:'Analisis layanan untuk NPWP 12.345.678.9-012.345 secara internal saja'})
 }));
 assert.equal(r.status,422);assert.match((await r.json()).message,/Hapus email/);
 assert.deepEqual(db.calls,[]);
});
test('R07 cross-site Origin header blocks Sales mutation',async()=>{
 const db=mockDb();const api=route('sales','sales','sales.a@uat.invalid',db);
 const r=await api.POST(new Request(origin+'/api/sales',{method:'POST',
  headers:{'Content-Type':'application/json','Origin':'https://evil.invalid'},
  body:JSON.stringify({entity:'account',legal_name:'TEST Company',fields:{}})
 }));
 assert.equal(r.status,403);assert.deepEqual(db.calls,[]);
});
test('R08 invalid JSON never becomes a record',async()=>{
 const db=mockDb();const api=route('sales','admin','admin@uat.invalid',db);
 const r=await api.POST(new Request(origin+'/api/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'}));
 assert.equal(r.status,400);assert.deepEqual(db.calls,[]);
});
