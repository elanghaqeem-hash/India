const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const file=fs.readFileSync(path.join(__dirname,'../src/lib/sales-submission.ts'),'utf8');
const js=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);
const {sha256Valid,verifySubmissionRights,submissionMatches}=mod.exports;
const boq={id:'boq-uat-01',version:1,quotation_number:'UAT-Q-001',status:'approved',opportunity_id:'opp-uat-01'};
const doc={id:'submission-uat-01',opportunity_id:'opp-uat-01',boq_id:'boq-uat-01',boq_version:1,
 quotation_number:'UAT-Q-001',recipient_email:'client@example.test',channel:'email',status:'reported',
 created_by:'sales@example.test',verified_by:null,evidence_reference:'archive/uat-001',evidence_sha256:'a'.repeat(64)};
test('reported quotation proof is not sufficient to advance Negotiation',()=>{
 assert.equal(submissionMatches(doc,boq,doc.opportunity_id),false);
 assert.equal(submissionMatches({...doc,status:'verified',verified_by:'checker@example.test'},boq,doc.opportunity_id),true);
});
test('independent checker cannot verify own evidence; viewer/presales/sales cannot verify',()=>{
 assert.match(verifySubmissionRights(doc,'admin','sales@example.test'),/Segregation/);
 assert.match(verifySubmissionRights(doc,'sales','sales@example.test'),/Hanya/);
 assert.equal(verifySubmissionRights(doc,'finance','finance@example.test'),null);
 assert.match(verifySubmissionRights({...doc,evidence_sha256:'fake'},'finance','finance@example.test'),/checksum/);
});
test('quotation version, number and opportunity must match approved BoQ without stale acceptance',()=>{
 const ok={...doc,status:'verified',verified_by:'approver@example.test'};
 for(const corrupt of [{...boq,version:2},{...boq,quotation_number:'REV-2'},{...boq,id:'different'},{...boq,status:'draft'},{...boq,opportunity_id:'another'}])
  assert.equal(submissionMatches(ok,corrupt,doc.opportunity_id),false);
 assert.equal(sha256Valid('x'.repeat(64)),false);
 assert.equal(sha256Valid('A'.repeat(64)),true);
});
test('Sales API requires independent matching quote submission evidence for negotiated/PO/Won stages',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(api,/\['negotiation','pending_po','closed_won'\]\.includes\(stage\)/);
 assert.match(api,/submissionMatches\(x,finalBoq,d\.id\)/);
 assert.match(api,/Quotation yang disetujui harus memiliki bukti submission/);
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/submission/route.ts'),'utf8');
 assert.match(route,/authorizeBoQ\(req\)/);
 assert.match(route,/verifySubmissionRights\(row,role,email\)/);
 assert.match(route,/india_sales_submissions/);
});
