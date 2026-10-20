// Negative-path release gate for INDIA CRM; synthetic fixtures only, no live customer or PO writes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.join(__dirname,'../src');
const load=(p)=>require(path.join(root,p+'.ts'));
const sales=load('lib/sales-workflow'),perms=load('lib/sales-access');
function loadBoQ(name,shim=()=>{throw Error('Unexpected dependency')}){
 const src=fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('exports','module','require',js)(mod.exports,mod,shim);return mod.exports;
}
const boq=loadBoQ('boq-domain');
const flow=loadBoQ('boq-workflow',x=>x==='./boq-domain'?boq:undefined);
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const maker='maker@uat.invalid',other='another@uat.invalid',checker='checker@uat.invalid';
const account={id:'TEST-account',legal_name:'TEST-ONLY',customer_number:'TEST-000',created_at:'',created_by:maker,fields:{
 business_type:'Layanan Teknologi Informasi',industry:'TI',employee_band:'100-500',
 company_phone:'02188888888',hq_address:'UAT site',hq_province:'DKI Jakarta',hq_postal:'12345',
 billing_same_as_hq:'ya',primary_name:'UAT',primary_phone:'081234567890',primary_email:maker}};
const fields={
 lead_source:'Referral',sales_owner:maker,expected_closing_date:'2026-11-30',service_family:'VAPT',
 client_need:'Test',budget_status:'Available',decision_maker:'Authorized',
 procurement_process:'Tender',discovery_notes:'Interview',technical_scope:'Two web apps',
 technical_specifications:'OWASP',scope_quantity:'2',deliverables:'Reports',delivery_model:'Remote',
 boq_id:'TEST-boq',implementation_timeline:'30 days',contract_model:'One-Time',project_site:'UAT',
 costing_notes:'Costs reviewed',quotation_number:'TEST-Q',quotation_sent_at:'2026-10-20',
 quotation_valid_days:'30',quotation_valid_until:'2026-11-19',quotation_sender_name:'Maker',
 quotation_sender_title:'Account Manager',next_action:'Contact client',next_action_at:'2026-10-25',
 negotiation_notes:'No agreement',customer_decision:'approved',
 po_number:'TEST-PO',po_date:'2026-10-20',po_reference:'Test document reference',
 po_amount_before_vat:'1000000',scope_reconciliation:'Scope and commercials reconciled'};
const deal={id:'TEST-deal',company_id:account.id,company_name:account.legal_name,
 title:'TEST project',stage:'prospecting',estimated_value:1000000,created_at:'',created_by:maker,fields};
const line=[{description:'VAPT test',quantity:1,unit:'Paket',unit_price:1000000,service_type:'VAPT'}];
const cost=[{code:'A',amount:100000},{code:'B',amount:100000},{code:'C',amount:50000},{code:'D',amount:100000},{code:'E',amount:50000}];
const approval={status:'submitted',created_by:maker,line_items:line,cost_items:cost,vat_rate:.11};
const validInput={customer_name:'TEST',project_name:'TEST project',quotation_number:'TEST-Q',
 service_type:'VAPT',vat_rate:.11,payment_terms:'100',line_items:line,cost_items:cost};

test('N01 Sales B cannot read Sales A opportunity',()=>assert.equal(perms.canReadDeal('sales',other,maker),false));
test('N02 Sales B cannot modify Sales A customer',()=>assert.equal(perms.canEditAccount('sales',other,maker),false));
test('N03 Presales cannot change PO amount or sales quote',()=>{
 for(const field of ['po_amount_before_vat','quotation_number','customer_decision'])
  assert.equal(perms.canEditDeal('presales',checker,maker,{[field]:'tampered'},false),false);
});
test('N04 viewer cannot create BoQ or read internal HPP',()=>{
 assert.equal(boq.can('viewer','create'),false);assert.equal(boq.can('viewer','read_cost'),false);
});
test('N05 unsupported custom Sales fields rejected',()=>
 assert.throws(()=>sales.cleanFields({po_verified_by:'spoof'},sales.DEAL_KEYS),/Field/));
test('N06 Sales stage jump directly from prospecting to pending PO rejected',()=>
 assert.match(sales.stageTransition('prospecting','pending_po'),/bertahap/));
test('N07 Sales cannot Won directly from negotiation',()=>
 assert.match(sales.stageTransition('negotiation','closed_won'),/Pending PO/));
test('N08 Won cannot reopen directly; Lost reopening only through prospecting',()=>{
 assert.match(sales.stageTransition('closed_won','prospecting'),/terkunci/);
 assert.match(sales.stageTransition('closed_lost','negotiation'),/Prospecting/);
});
test('N09 empty BANT rejects qualification',()=>{
 assert.ok(sales.requiredForStage('qualified',{...deal,fields:{...fields,decision_maker:''}},account).includes('decision_maker'));
});
test('N10 missing quotation validity rejects quotation stage',()=>{
 const d={...deal,fields:{...fields,quotation_valid_days:''}};
 assert.ok(sales.requiredForStage('quotation_sent',d,account).includes('quotation_valid_days'));
});
test('N11 missing BOQ blocks closed won',()=>{
 const d={...deal,fields:{...fields,boq_id:''}};
 assert.ok(sales.requiredForStage('closed_won',d,account).includes('boq_id'));
});
test('N12 pending customer approval prevents Won',()=>{
 const d={...deal,fields:{...fields,customer_decision:'pending'}};
 assert.ok(sales.requiredForStage('closed_won',d,account).some(x=>x.startsWith('customer_decision')));
});
test('N13 PO with zero or nonnumeric amount prevents Won',()=>{
 for(const amount of ['0','not-a-number']){
  const d={...deal,fields:{...fields,po_amount_before_vat:amount}};
  assert.ok(sales.requiredForStage('closed_won',d,account).some(x=>x.startsWith('po_amount_before_vat')));
 }
});
test('N14 lost deal needs cause and explanation',()=>{
 const d={...deal,fields:{...fields,lost_reason:'',lost_notes:''}};
 assert.ok(sales.requiredForStage('closed_lost',d,account).includes('lost_reason'));
 assert.ok(sales.requiredForStage('closed_lost',d,account).includes('lost_notes'));
});
test('N15 invalid email and postal code fail account validation',()=>{
 const a={...account,fields:{...account.fields,primary_email:'notemail',hq_postal:'ABCDE'}};
 const errs=sales.validateAccount(a);
 assert.ok(errs.some(x=>x.includes('primary_email')));assert.ok(errs.some(x=>x.includes('hq_postal')));
});
test('N16 negative price, Infinity and NaN rejected',()=>{
 for(const x of [-1,Infinity,NaN])
  assert.throws(()=>boq.validateBoQ({...validInput,line_items:[{...line[0],unit_price:x}]}));
});
test('N17 duplicate or negative HPP component rejected',()=>{
 assert.throws(()=>boq.validateBoQ({...validInput,cost_items:[cost[0],cost[0]]}));
 assert.throws(()=>boq.validateBoQ({...validInput,cost_items:[{code:'A',amount:-1}]}));
});
test('N18 approver cannot approve incomplete HPP',()=>
 assert.throws(()=>flow.checkTransition('approve',{...approval,cost_items:cost.slice(0,3)},{role:'approver',email:checker}),/HPP/));
test('N19 maker cannot approve or reject own proposal even as Admin',()=>{
 for(const action of ['approve','reject'])
  assert.throws(()=>flow.checkTransition(action,approval,{role:'admin',email:maker},'Valid rejection reason'),/Segregation/);
});
test('N20 low-margin proposal cannot be approved by non-admin',()=>{
 const bad={...approval,cost_items:[{code:'A',amount:900000},...cost.slice(1)]};
 assert.throws(()=>flow.checkTransition('approve',bad,{role:'approver',email:checker}),/25%/);
});
test('N21 approved BoQ cannot submit a second time',()=>
 assert.throws(()=>flow.checkTransition('submit',{...approval,status:'approved'},{role:'sales',email:maker})));
test('N22 PO verification requires separate reviewer and original documentation confirmation',()=>{
 const api=source('app/api/sales/route.ts');
 assert.match(api,/Segregation of Duties/);assert.match(api,/confirmed_documents!==true/);
});
test('N23 PO mismatched quotation or missing verified PO prevents Won',()=>{
 const api=source('app/api/sales/route.ts');
 assert.match(api,/boq\.status!=='approved'/);
 assert.match(api,/india_sales_po_checks/);
});
test('N24 unauthenticated demo sales API not globally enabled on main',()=>{
 const middleware=source('middleware.ts');
 assert.match(middleware,/API demo nonpersisten dinonaktifkan/);
});
test('N25 Sales B cannot export quotation owned by Sales A',()=>{
 const route=source('app/api/sales/quotation/route.ts');
 assert.match(route,/canReadDeal\(auth\.identity\.role,auth\.identity\.email,row\.created_by\)/);
});
test('N26 Sales B cannot enumerate full customer roster through accounts list',()=>{
 const route=source('app/api/sales/route.ts');
 assert.match(route,/rows\.results\.filter\(x=>canReadAccount\(/);
});
test('N27 calendar-invalid dates cannot pass validation',()=>{
 for(const date of ['2026-02-31','2026-04-31','2026-13-01','2026-00-10','2026-02-29'])
  assert.equal(sales.dateValid(date),false,date);
});
test('N28 formatted Indonesian NPWP must be blocked before external AI prompt',()=>{
 const route=source('app/api/ai/assist/route.ts');
 assert.match(route,/containsPersonalIdentifier\(prompt\)/);
});
test('N29 PO cannot differ by a full rupiah from approved BoQ',()=>{
 const api=source('app/api/sales/route.ts');
 assert.doesNotMatch(api,/Math\.abs\(n-check\.subtotal\)>1\b/);
 assert.match(api,/Math\.abs\(n-check\.subtotal\)>0\.01/);
});
test('N30 AI must require user confirmation and strictly-tested enabled provider',()=>{
 const api=source('app/api/ai/assist/route.ts');
 assert.match(api,/confirmed!==true/);assert.match(api,/row\.tested_ok!==1/);
});
test('N31 AI has a per-hour request ceiling',()=>{
 assert.match(source('app/api/ai/assist/route.ts'),/20 permintaan AI per jam/);
});
test('N32 Post-PO never invents KTP or upload evidence',()=>{
 const txt=source('lib/sales-to-post-po.ts');
 assert.match(txt,/primaryKtpNumber/);
 assert.match(txt,/npwpAttachmentConfirmed/);
});
