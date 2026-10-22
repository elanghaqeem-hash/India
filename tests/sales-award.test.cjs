const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=fs.readFileSync(path.join(__dirname,'../src/lib/sales-award.ts'),'utf8');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports',js)(m,m.exports);
const {awardReviewAllowed,validAwardForWon}=m.exports;
const item={id:'award-1',opportunity_id:'opp-1',document_kind:'po',document_number:'PO-TEST',
 archive_reference:'dms://uat/doc/po',original_sha256:'a'.repeat(64),created_by:'sales@example.test',
 finance_reviewed_by:null,legal_reviewed_by:null};
test('legal role is not replaceable by Admin/Finance; original PO maker cannot self-verify',()=>{
 assert.match(awardReviewAllowed(item,'admin','admin@example.test','legal'),/Legal/);
 assert.match(awardReviewAllowed(item,'sales','sales@example.test','finance'),/Finance/);
 assert.equal(awardReviewAllowed(item,'finance','finance@example.test','finance'),null);
 assert.equal(awardReviewAllowed(item,'legal','legal@example.test','legal'),null);
 assert.match(awardReviewAllowed(item,'finance','sales@example.test','finance'),/Maker/);
});
test('Closed Won requires both different Finance+Legal identities and PO number match',()=>{
 const complete={...item,finance_reviewed_by:'finance@example.test',legal_reviewed_by:'legal@example.test'};
 assert.equal(validAwardForWon(complete,'PO-TEST'),true);
 for(const bad of [
 {...complete,legal_reviewed_by:null},
 {...complete,finance_reviewed_by:null},
 {...complete,legal_reviewed_by:'finance@example.test'},
 {...complete,original_sha256:'bad'},
 {...complete,archive_reference:''},
 {...complete,document_number:'PO-OTHER'},
 {...complete,document_kind:'contract'}
 ])assert.equal(validAwardForWon(bad,'PO-TEST'),false);
});
test('Award route enforces Cloudflare Access, reviewer identity, immutable evidence, and stage Won gate',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/award/route.ts'),'utf8');
 const sales=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(route,/authorizeBoQ\(req\)/);
 assert.match(route,/awardReviewAllowed\(doc,role,email/);
 assert.match(route,/document_number/);assert.match(route,/f\.po_number/);
 assert.match(sales,/Closed Won ditolak: bukti PO\/SPK asli/);
 assert.match(sales,/validAwardForWon\(x,d\.fields\.po_number/);
});
