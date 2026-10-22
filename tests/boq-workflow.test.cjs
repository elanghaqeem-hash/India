const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function loadTS(name,requireShim=()=>{throw Error('Unexpected import')}){
 const source=fs.readFileSync(path.join(__dirname,'../src/lib/',name+'.ts'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const obj={};new Function('exports','module','require',js)(obj,{exports:obj},requireShim);
 return obj;
}
const domain=loadTS('boq-domain');
const wf=loadTS('boq-workflow',name=>name==='./boq-domain'?domain:undefined);
const base={status:'submitted',created_by:'maker@company.example',vat_rate:0.11,
 line_items:[{description:'VAPT',quantity:1,unit:'Lot',unit_price:1000000,service_type:'VAPT'}],
 cost_items:[{code:'A',amount:100000},{code:'B',amount:100000},{code:'C',amount:50000},{code:'D',amount:100000},{code:'E',amount:50000}]};
test('maker checker segregation applies to admin and approver without bypass',()=>{
 for(const role of ['admin','approver']){
  assert.throws(()=>wf.checkTransition('approve',base,{email:base.created_by,role}),/Segregation/);
  assert.throws(()=>wf.checkTransition('reject',base,{email:base.created_by,role},'Bad scope'),/Segregation/);
 }
 assert.equal(wf.checkTransition('approve',base,{email:'approver@company.example',role:'approver'}).note,'APPROVED');
});
test('sales and presales cannot approve; submitted state required',()=>{
 assert.throws(()=>wf.checkTransition('approve',base,{email:'sales@company.example',role:'sales'}));
 assert.throws(()=>wf.checkTransition('approve',{...base,status:'draft'},{email:'approver@company.example',role:'approver'}));
 assert.equal(wf.checkTransition('submit',{...base,status:'draft'},{email:'sales@company.example',role:'sales'}).note,'SUBMITTED');
});
test('rejection requires adequate reason, and revisions can be made on finalized items',()=>{
 assert.throws(()=>wf.checkTransition('reject',base,{email:'other@company.example',role:'approver'},'No'),/5/);
 for(const status of ['submitted','approved','rejected'])assert.equal(
 wf.checkTransition('revise',{...base,status},{email:'sales@company.example',role:'sales'}).note,'NEW_DRAFT_VERSION');
 assert.throws(()=>wf.checkTransition('revise',{...base,status:'draft'},{email:'sales@company.example',role:'sales'}));
});
test('low margin needs administrative exception with a reason',()=>{
 const costly={...base,cost_items:[{code:'A',amount:700000},{code:'B',amount:70000},{code:'C',amount:30000},{code:'D',amount:60000},{code:'E',amount:50000}]};
 assert.throws(()=>wf.checkTransition('approve',costly,{email:'approve@company.example',role:'approver'}),/25%/);
 assert.throws(()=>wf.checkTransition('approve',costly,{email:'admin@company.example',role:'admin'},'short'),/25%/);
 assert.equal(wf.checkTransition('approve',costly,{email:'admin@company.example',role:'admin'},'approved by management after special review').note,'APPROVED');
});
test('HPP must have all five buckets',()=>{
 assert.throws(()=>wf.checkTransition('approve',{...base,cost_items:base.cost_items.slice(0,4)},
  {email:'approver@company.example',role:'approver'}),/HPP/);
});
test('API mutations must use optimistic locking and only audit successful actions',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app/api/boq/[id]/route.ts'),'utf8');
 assert.ok(source.match(/edit_seq=edit_seq\+1/g)?.length>=4);
 assert.ok(source.match(/AND edit_seq=\?/g)?.length>=4);
 assert.match(source,/await atomicSales/);
 const transactions=fs.readFileSync(path.join(__dirname,'../src/lib/sales-transactions.ts'),'utf8');
 assert.match(transactions,/INSERT INTO india_sales_tx_guards/);
 assert.match(transactions,/return db.batch/);
 const testMigration=fs.readFileSync(path.join(__dirname,'../migrations/0002_india_boq_edit_seq.sql'),'utf8');
 assert.match(testMigration,/ADD COLUMN edit_seq INTEGER NOT NULL DEFAULT 0/);
});
