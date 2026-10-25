const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.join(__dirname,'../src/lib');
const raw=fs.readFileSync(path.join(root,'sales-procurement.ts'),'utf8');
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('exports','module',js)(m.exports,m);
const {needsTenderGate,canDecideBid,procurementGate}=m.exports;
const {PROCUREMENT_PROCESSES}=require('../src/lib/sales-workflow.ts');
const base={opportunity_id:'opp-u',tenant_id:'defendit360',channel:'tender',bid_decision:'pending',proposed_by:'sales@example.test',decided_by:null,decision_reason:''};
const rks={kind:'rks',status:'reviewed',compliance_status:'compliant',reviewed_by:'presales@example.test',file_reference:'archive/RKS-2026-v1',source_content_hash:'a'.repeat(64)};
test('Tender, RFQ, RFP require decisions; direct sales bypasses tender-specific gate',()=>{
 for(const x of ['Tender LPSE','RFQ private','RFP BUMN','pengadaan publik'])assert.equal(needsTenderGate(x),true);
 for(const process of PROCUREMENT_PROCESSES.filter(x=>/RFQ|RFP|^Tender /.test(x)))assert.equal(needsTenderGate(process),true,'Formal procurement must retain Bid/No-Bid gate: '+process);
 for(const x of ['Direct Sales','Referral','Upsell'])assert.equal(needsTenderGate(x),false);
 assert.deepEqual(procurementGate('Direct Sales',null,[]),[]);
});
test('Sales maker cannot self-approve Bid even if Admin role; Approver independent can decide pending',()=>{
 assert.match(canDecideBid(base,'sales','sales@example.test'),/Hanya Approver/);
 assert.match(canDecideBid(base,'admin','sales@example.test'),/Maker/);
 assert.equal(canDecideBid(base,'approver','approver@example.test'),null);
 assert.match(canDecideBid({...base,bid_decision:'go'},'approver','approver@example.test'),/terkunci/);
});
test('Tender quotation must block without GO and fully reviewed traceable RKS/KAK',()=>{
 assert.equal(procurementGate('Tender',null,[]).length,2);
 assert.equal(procurementGate('Tender',{...base,bid_decision:'conditional_go',decided_by:'approver@example.test'},[rks]).length,1);
 assert.equal(procurementGate('Tender',{...base,bid_decision:'go',decided_by:'approver@example.test'},[{...rks,file_reference:''}]).length,1);
 assert.equal(procurementGate('Tender',{...base,bid_decision:'go',decided_by:'approver@example.test'},[{...rks,source_content_hash:'bad'}]).length,1);
 assert.equal(procurementGate('Tender',{...base,bid_decision:'go',decided_by:'approver@example.test'},[{...rks,reviewed_by:null}]).length,1);
 assert.deepEqual(procurementGate('Tender',{...base,bid_decision:'go',decided_by:'approver@example.test'},[rks]),[]);
});
test('Opportunity stage transition checks D1 GO + RKS matrix before quotation',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(route,/needsTenderGate\(tenderProcess/);
 assert.match(route,/procurementGate\(tenderProcess,bid/);
 assert.match(route,/Bid\/No-Bid dan persyaratan RKS\/KAK harus lolos/);
 const handler=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/procurement/route.ts'),'utf8');
 assert.match(handler,/authorizeBoQ\(req\)/);
 assert.match(handler,/created_by\.toLowerCase\(\)===email\.toLowerCase\(\)/);
 assert.match(handler,/reference arsip|Reference arsip/);
 assert.match(handler,/source_content_hash/);
});
test('RKS must not silently become valid without a checked procurement assessment',()=>{
 const code=fs.readFileSync(path.join(root,'sales-journey.ts'),'utf8');
 assert.match(code,/!input\.procurement_gaps\|\|input\.procurement_gaps\.length>0/);
});
